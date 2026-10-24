#!/usr/bin/env python3
"""
Builds the Scoutly places archive (PMTiles container, JSON tiles) from an Overture Maps release.

    Overture parquet --DuckDB--> adaptive quadtree --gzip JSON--> places.pmtiles --> Cloudflare R2

* Adaptive quadtree: levels 7, 9, 11, 13, 15. A cell becomes a leaf when it holds at most
  --leaf-max places (default 2500); otherwise it is split into the 16 cells two levels down.
  A viewport therefore always needs a handful of small (50-300 KB) objects, in dense cities
  and in empty regions alike.
* Contacts: phones, websites and socials are stored as-is (the app already shows them).
  E-mails are stored AES-256-GCM encrypted (key: SCOUTLY_PLACES_KEY) so the public archive never
  carries a readable e-mail; the API decrypts and re-seals them behind the credit gate.
* Tile row layout is documented in TILE_COLUMNS and mirrored in server/placesTiles.ts.

Usage:
    python build.py --source 's3://overturemaps-us-west-2/release/<release>/theme=places/type=place/*' \
                    --release <release> --out places.pmtiles [--countries BR,US] [--bbox w,s,e,n]
"""
from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import os
import sys
import tempfile
import time
from datetime import datetime, timezone

import duckdb
import pyarrow as pa
from pmtiles.tile import Compression, TileType, zxy_to_tileid
from pmtiles.writer import Writer

LEVELS = [7, 9, 11, 13, 15]
MAX_Z = LEVELS[-1]
TILE_COLUMNS = [
    "id", "name", "lon", "lat", "category", "taxonomy", "confidence",
    "websites", "phones", "socials", "address", "emailSealed", "status",
]


def log(message: str) -> None:
    print(f"[places-tiles {time.strftime('%H:%M:%S')}] {message}", flush=True)


def email_key() -> bytes | None:
    secret = os.environ.get("SCOUTLY_PLACES_KEY", "").strip()
    if not secret:
        return None
    return hashlib.sha256(f"scoutly-places-email:{secret}".encode()).digest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, help="parquet glob (local path or s3://...)")
    parser.add_argument("--release", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--countries", default="", help="comma separated ISO codes; empty = world")
    parser.add_argument("--bbox", default="", help="west,south,east,north")
    parser.add_argument("--min-confidence", type=float, default=0.35)
    parser.add_argument("--leaf-max", type=int, default=2500)
    parser.add_argument("--batch-rows", type=int, default=3_000_000, help="rows aggregated per pass (memory knob)")
    parser.add_argument("--threads", type=int, default=0)
    parser.add_argument("--memory-limit", default="")
    parser.add_argument("--tmp-dir", default=tempfile.gettempdir())
    args = parser.parse_args()

    con = duckdb.connect(os.path.join(args.tmp_dir, "places-build.duckdb"))
    if args.threads:
        con.execute(f"PRAGMA threads={args.threads}")
    if args.memory_limit:
        con.execute(f"PRAGMA memory_limit='{args.memory_limit}'")
    con.execute(f"PRAGMA temp_directory='{args.tmp_dir}'")
    if args.source.startswith("s3://"):
        con.execute("INSTALL httpfs; LOAD httpfs; SET s3_region='us-west-2';")

    where = [
        "names.primary IS NOT NULL",
        "length(trim(names.primary)) > 1",
        "coalesce(operating_status, 'open') NOT IN ('permanently_closed', 'closed')",
        f"coalesce(confidence, 0) >= {float(args.min_confidence)}",
        "coalesce(basic_category, taxonomy.primary) IS NOT NULL",
    ]
    countries = [c.strip().upper() for c in args.countries.split(",") if c.strip()]
    if countries:
        where.append("addresses[1].country IN (" + ",".join(f"'{c}'" for c in countries if c.isalpha()) + ")")
    if args.bbox:
        w, s, e, n = (float(v) for v in args.bbox.split(","))
        where.append(f"bbox.xmin >= {w} AND bbox.xmax <= {e} AND bbox.ymin >= {s} AND bbox.ymax <= {n}")

    log("reading places and assigning z15 cells")
    con.execute(f"""
        CREATE OR REPLACE TABLE pl AS
        SELECT
            id,
            trim(names.primary) AS name,
            round(bbox.xmin, 6) AS lon,
            round(bbox.ymin, 6) AS lat,
            coalesce(basic_category, taxonomy.primary) AS category,
            taxonomy.primary AS taxonomy,
            round(confidence, 2) AS confidence,
            CASE operating_status WHEN 'temporarily_closed' THEN 't' WHEN 'open' THEN 'o' ELSE NULL END AS status,
            list_slice(websites, 1, 2) AS websites,
            list_slice(phones, 1, 2) AS phones,
            list_slice(socials, 1, 4) AS socials,
            nullif(concat_ws(', ', nullif(addresses[1].freeform, ''), nullif(addresses[1].locality, ''),
                nullif(addresses[1].region, ''), nullif(addresses[1].postcode, ''), nullif(addresses[1].country, '')), '') AS address,
            emails,
            CAST(floor((bbox.xmin + 180.0) / 360.0 * 32768) AS INTEGER) AS tx,
            CAST(floor((1.0 - ln(tan(radians(least(greatest(bbox.ymin, -85.05), 85.05)))
                + 1.0 / cos(radians(least(greatest(bbox.ymin, -85.05), 85.05)))) / pi()) / 2.0 * 32768) AS INTEGER) AS ty
        FROM read_parquet('{args.source}', filename=false)
        WHERE {' AND '.join(where)}
    """)
    total = con.execute("SELECT count(*) FROM pl").fetchone()[0]
    log(f"{total:,} places kept")
    if total == 0:
        log("nothing to write")
        return 1

    # ---- adaptive quadtree: per-level cell counts, leaf level per place ----
    for z in LEVELS:
        shift = MAX_Z - z
        con.execute(f"""
            CREATE OR REPLACE TABLE cnt{z} AS
            SELECT (tx >> {shift}) AS x, (ty >> {shift}) AS y, count(*) AS c FROM pl GROUP BY 1, 2
        """)
    lm = args.leaf_max
    joins = " ".join(
        f"JOIN cnt{z} k{z} ON k{z}.x = (p.tx >> {MAX_Z - z}) AND k{z}.y = (p.ty >> {MAX_Z - z})" for z in LEVELS
    )
    cases = " ".join(f"WHEN k{z}.c <= {lm} THEN {z}" for z in LEVELS[:-1])
    log("assigning leaf levels")
    con.execute(f"""
        CREATE OR REPLACE TABLE leafed AS
        SELECT p.*, CASE {cases} ELSE {MAX_Z} END AS lz
        FROM pl p {joins}
    """)
    con.execute("DROP TABLE pl")

    # ---- e-mail sealing (Python side, only for rows that have e-mails) ----
    key = email_key()
    em_rows = con.execute("SELECT count(*) FROM leafed WHERE emails IS NOT NULL AND len(emails) > 0").fetchone()[0]
    sealed = {}
    if key and em_rows:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        aes = AESGCM(key)
        log(f"sealing e-mails for {em_rows:,} places")
        con.execute("CREATE OR REPLACE TABLE em (id VARCHAR, blob VARCHAR)")
        # a separate cursor: writing on `con` would invalidate a streaming result on the same connection
        cur = con.cursor().execute("SELECT id, emails FROM leafed WHERE emails IS NOT NULL AND len(emails) > 0")
        batch = []
        while True:
            rows = cur.fetchmany(200_000)
            if not rows:
                break
            for pid, emails in rows:
                nonce = os.urandom(12)
                body = json.dumps(list(emails)[:3], separators=(",", ":")).encode()
                blob = base64.urlsafe_b64encode(nonce + aes.encrypt(nonce, body, pid.encode())).decode().rstrip("=")
                batch.append((pid, blob))
            chunk = pa.table({"id": [b[0] for b in batch], "blob": [b[1] for b in batch]})
            con.register("em_chunk", chunk)
            con.execute("INSERT INTO em SELECT id, blob FROM em_chunk")
            con.unregister("em_chunk")
            batch.clear()
    else:
        if em_rows:
            log("SCOUTLY_PLACES_KEY not set: e-mails are NOT included")
        con.execute("CREATE OR REPLACE TABLE em (id VARCHAR, blob VARCHAR)")

    # ---- tile payloads (batched by z7 cell so memory stays flat for a worldwide build) ----
    log("building tile payloads")
    cells = con.execute("SELECT x, y, c FROM cnt7 ORDER BY x, y").fetchall()
    batches, current, rows_in_batch = [], [], 0
    for x7, y7, c in cells:
        if current and rows_in_batch + c > args.batch_rows:
            batches.append(current)
            current, rows_in_batch = [], 0
        current.append((x7, y7))
        rows_in_batch += c
    if current:
        batches.append(current)
    log(f"{len(cells):,} z7 cells in {len(batches)} batches")

    def tile_sql(batch):
        keys = ",".join(f"({x}::BIGINT * 65536 + {y}::BIGINT)" for x, y in batch)
        return f"""
            SELECT lz AS z, (tx >> {MAX_Z} - lz) AS x, (ty >> {MAX_Z} - lz) AS y, count(*) AS n,
                   CAST(to_json(list(json_array(
                       l.id, l.name, l.lon, l.lat, l.category, l.taxonomy, l.confidence,
                       coalesce(l.websites, []), coalesce(l.phones, []), coalesce(l.socials, []),
                       l.address, em.blob, l.status
                   ) ORDER BY l.confidence DESC NULLS LAST, l.id)) AS VARCHAR) AS payload
            FROM leafed l LEFT JOIN em ON em.id = l.id
            WHERE ((l.tx >> {MAX_Z - 7})::BIGINT * 65536 + (l.ty >> {MAX_Z - 7})::BIGINT) IN ({keys})
            GROUP BY ALL
        """

    lon_min, lat_min, lon_max, lat_max = con.execute("SELECT min(lon), min(lat), max(lon), max(lat) FROM leafed").fetchone()

    out_tmp = args.out + ".partial"
    stats = {"tiles": 0, "places": 0, "bytes": 0, "maxTile": 0, "byZ": {}, "leafKeys": []}
    with open(out_tmp, "wb") as fh:
        writer = Writer(fh)
        for index, batch in enumerate(batches):
            cur = con.cursor().execute(tile_sql(batch))
            while True:
                rows = cur.fetchmany(2000)
                if not rows:
                    break
                for z, x, y, n, payload in rows:
                    blob = gzip.compress(payload.encode("utf-8"), compresslevel=9, mtime=0)
                    writer.write_tile(zxy_to_tileid(int(z), int(x), int(y)), blob)
                    stats["tiles"] += 1
                    stats["places"] += int(n)
                    stats["bytes"] += len(blob)
                    stats["maxTile"] = max(stats["maxTile"], len(blob))
                    stats["byZ"][int(z)] = stats["byZ"].get(int(z), 0) + 1
                    stats["leafKeys"].append((int(z), int(x), int(y)))
            log(f"batch {index + 1}/{len(batches)}: {stats['tiles']:,} tiles, {stats['places']:,} places, {stats['bytes'] / 1e9:.2f} GB")
        header = {
            "tile_type": TileType.UNKNOWN,
            "tile_compression": Compression.GZIP,
            "min_zoom": min(LEVELS),
            "max_zoom": max(LEVELS),
            "min_lon_e7": int(lon_min * 1e7), "min_lat_e7": int(lat_min * 1e7),
            "max_lon_e7": int(lon_max * 1e7), "max_lat_e7": int(lat_max * 1e7),
            "center_zoom": 11,
            "center_lon_e7": int((lon_min + lon_max) / 2 * 1e7),
            "center_lat_e7": int((lat_min + lat_max) / 2 * 1e7),
        }
        metadata = {
            "name": "scoutly-places",
            "format": 1,
            "release": args.release,
            "builtAt": datetime.now(timezone.utc).isoformat(),
            "levels": LEVELS,
            "leafMax": args.leaf_max,
            "columns": TILE_COLUMNS,
            "countries": countries or "world",
            "minConfidence": args.min_confidence,
            "emailsIncluded": bool(key and em_rows),
            "stats": stats,
        }
        # Interior quadtree cells get a tiny shared marker tile so readers can tell
        # "descend further" (marker) from "nothing here" (no entry) without probing every child.
        marker = gzip.compress(b"{}", compresslevel=9, mtime=0)
        interior = set()
        for z, x, y in stats.pop("leafKeys"):
            for parent_z in LEVELS:
                if parent_z >= z:
                    break
                shift = z - parent_z
                interior.add((parent_z, x >> shift, y >> shift))
        for z, x, y in interior:
            writer.write_tile(zxy_to_tileid(z, x, y), marker)
        stats["interiorTiles"] = len(interior)
        writer.finalize(header, metadata)
    os.replace(out_tmp, args.out)
    size = os.path.getsize(args.out)
    log(f"done: {stats['tiles']:,} tiles / {stats['places']:,} places / {size / 1e9:.2f} GB "
        f"(largest tile {stats['maxTile'] / 1024:.0f} KB, by level {stats['byZ']})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
