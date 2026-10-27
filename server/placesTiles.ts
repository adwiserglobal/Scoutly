import { createDecipheriv, createHash } from 'node:crypto';
import { readFile, open } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import type { OverturePlace } from './overtureService.js';

/**
 * Global places archive (PMTiles container with gzip JSON tiles), built monthly from Overture by
 * scripts/places-tiles/build.py and served from object storage (Cloudflare R2) behind a CDN.
 *
 *   SCOUTLY_PLACES_URL  public URL of the archive. Either a direct .pmtiles URL, or a base URL ending in "/"
 *                       that holds manifest.json ({"file": "places-<release>.pmtiles"}); the manifest lets a
 *                       monthly rebuild go live atomically. An absolute file path also works (tests).
 *   SCOUTLY_PLACES_KEY  secret used to decrypt the e-mails stored in the tiles
 *
 * A viewport is answered with a few ranged GETs of 50-300 KB each, so a first visit to any city
 * in the world costs the same as São Paulo. Tiles are kept in a per-instance LRU.
 */

const DEFAULT_LEVELS = [7, 9, 11, 13, 15];
const HEADER_FETCH_BYTES = 16384;
const MAX_TILES_PER_QUERY = 48;
const MAX_TILES_DEEP_QUERY = 160;
const TILE_CACHE_SIZE = 160;
const DIRECTORY_CACHE_SIZE = 64;

interface Header {
  rootOffset: number;
  rootLength: number;
  metadataOffset: number;
  metadataLength: number;
  leafOffset: number;
  leafLength: number;
  dataOffset: number;
  dataLength: number;
}

interface Entry {
  tileId: number;
  offset: number;
  length: number;
  runLength: number;
}

interface Archive {
  source: string;
  header: Header;
  root: Entry[];
  levels: number[];
  release: string | null;
}

export function placesTilesUrl(): string {
  return String(process.env.SCOUTLY_PLACES_URL || '').trim();
}

export function hasPlacesTiles(): boolean {
  return placesTilesUrl().length > 0;
}

// ---------------------------------------------------------------------------
// Byte access
// ---------------------------------------------------------------------------

async function readRange(source: string, offset: number, length: number): Promise<Buffer> {
  if (source.startsWith('/')) {
    const handle = await open(source, 'r');
    try {
      const buffer = Buffer.alloc(length);
      const { bytesRead } = await handle.read(buffer, 0, length, offset);
      return buffer.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(source, {
        headers: { Range: `bytes=${offset}-${offset + length - 1}` },
        signal: AbortSignal.timeout(7000),
      });
      if (response.status !== 206 && response.status !== 200) throw new Error(`places archive HTTP ${response.status}`);
      const body = Buffer.from(await response.arrayBuffer());
      // A server that ignores Range returns the whole file; never keep that.
      if (response.status === 200) return body.subarray(offset, offset + length);
      return body;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('places archive unavailable');
}

// ---------------------------------------------------------------------------
// PMTiles v3 (header, directories, Hilbert tile ids)
// ---------------------------------------------------------------------------

function parseHeader(buffer: Buffer): Header {
  if (buffer.subarray(0, 7).toString('latin1') !== 'PMTiles' || buffer[7] !== 3) {
    throw new Error('places archive is not a PMTiles v3 file');
  }
  const u64 = (position: number) => Number(buffer.readBigUInt64LE(position));
  return {
    rootOffset: u64(8),
    rootLength: u64(16),
    metadataOffset: u64(24),
    metadataLength: u64(32),
    leafOffset: u64(40),
    leafLength: u64(48),
    dataOffset: u64(56),
    dataLength: u64(64),
  };
}

function readVarint(buffer: Buffer, state: { pos: number }): number {
  let result = 0;
  let multiplier = 1;
  for (;;) {
    const byte = buffer[state.pos++];
    result += (byte & 0x7f) * multiplier;
    if (byte < 0x80) return result;
    multiplier *= 128;
  }
}

function parseDirectory(compressed: Buffer): Entry[] {
  const buffer = gunzipSync(compressed);
  const state = { pos: 0 };
  const count = readVarint(buffer, state);
  const entries: Entry[] = new Array(count);
  let lastId = 0;
  for (let i = 0; i < count; i += 1) {
    lastId += readVarint(buffer, state);
    entries[i] = { tileId: lastId, offset: 0, length: 0, runLength: 0 };
  }
  for (let i = 0; i < count; i += 1) entries[i].runLength = readVarint(buffer, state);
  for (let i = 0; i < count; i += 1) entries[i].length = readVarint(buffer, state);
  for (let i = 0; i < count; i += 1) {
    const value = readVarint(buffer, state);
    entries[i].offset = i > 0 && value === 0 ? entries[i - 1].offset + entries[i - 1].length : value - 1;
  }
  return entries;
}

function zxyToTileId(z: number, x: number, y: number): number {
  let acc = (4 ** z - 1) / 3;
  for (let a = z - 1; a >= 0; a -= 1) {
    const s = 1 << a;
    const rx = s & x;
    const ry = s & y;
    acc += ((3 * rx) ^ ry) * s;
    if (ry === 0) {
      if (rx !== 0) {
        x = s - 1 - x;
        y = s - 1 - y;
      }
      [x, y] = [y, x];
    }
  }
  return acc;
}

function findEntry(entries: Entry[], tileId: number): Entry | null {
  let low = 0;
  let high = entries.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const entry = entries[mid];
    if (entry.tileId <= tileId) {
      if (entry.tileId === tileId) return entry;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  const candidate = entries[high];
  if (!candidate) return null;
  if (candidate.runLength === 0) return candidate; // leaf directory pointer
  return tileId - candidate.tileId < candidate.runLength ? candidate : null;
}

// ---------------------------------------------------------------------------
// Caches and archive loading
// ---------------------------------------------------------------------------

class Lru<T> {
  private map = new Map<string, T>();
  constructor(private max: number) {}
  get(key: string) {
    const value = this.map.get(key);
    if (value !== undefined) {
      this.map.delete(key);
      this.map.set(key, value);
    }
    return value;
  }
  set(key: string, value: T) {
    this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.max) this.map.delete(this.map.keys().next().value as string);
  }
}

let archivePromise: Promise<Archive> | null = null;
let archiveLoadedAt = 0;
const ARCHIVE_TTL_MS = 10 * 60 * 1000; // pick up a new monthly build (manifest) without a redeploy
const directoryCache = new Lru<Entry[]>(DIRECTORY_CACHE_SIZE);
const tileCache = new Lru<any[][] | null>(TILE_CACHE_SIZE);
const inFlight = new Map<string, Promise<any[][] | null>>();

async function resolveSource(): Promise<string> {
  const configured = placesTilesUrl();
  if (!configured.endsWith('/')) return configured;
  const response = await fetch(`${configured}manifest.json`, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`places manifest HTTP ${response.status}`);
  const manifest = await response.json();
  const file = String(manifest?.file || '').replace(/^\/+/, '');
  if (!/^[\w.\-]+\.pmtiles$/.test(file)) throw new Error('places manifest has no valid file');
  return `${configured}${file}`;
}

async function loadArchive(): Promise<Archive> {
  const source = await resolveSource();
  const head = await readRange(source, 0, HEADER_FETCH_BYTES);
  const header = parseHeader(head);
  const root = parseDirectory(head.subarray(header.rootOffset, header.rootOffset + header.rootLength));
  let levels = DEFAULT_LEVELS;
  let release: string | null = null;
  try {
    const metadata = JSON.parse(gunzipSync(await readRange(source, header.metadataOffset, header.metadataLength)).toString('utf8'));
    if (Array.isArray(metadata.levels) && metadata.levels.length) levels = metadata.levels.map(Number);
    release = typeof metadata.release === 'string' ? metadata.release : null;
  } catch {
    /* metadata is optional */
  }
  return { source, header, root, levels, release };
}

async function getArchive(): Promise<Archive> {
  if (!archivePromise || Date.now() - archiveLoadedAt > ARCHIVE_TTL_MS) {
    archiveLoadedAt = Date.now();
    const next = loadArchive();
    archivePromise = next.catch((error) => {
      if (archivePromise === next) archivePromise = null;
      throw error;
    });
  }
  return archivePromise;
}

async function readTile(archive: Archive, z: number, x: number, y: number): Promise<any[][] | null> {
  const key = `${archive.source}/${z}/${x}/${y}`;
  const cached = tileCache.get(key);
  if (cached !== undefined) return cached;
  const pending = inFlight.get(key);
  if (pending) return pending;

  const task = (async () => {
    const tileId = zxyToTileId(z, x, y);
    let entries = archive.root;
    for (let depth = 0; depth < 4; depth += 1) {
      const entry = findEntry(entries, tileId);
      if (!entry) return null;
      if (entry.runLength > 0) {
        const compressed = await readRange(archive.source, archive.header.dataOffset + entry.offset, entry.length);
        return JSON.parse(gunzipSync(compressed).toString('utf8')) as any[][];
      }
      const leafKey = `dir/${archive.source}/${entry.offset}`;
      let leaf = directoryCache.get(leafKey);
      if (!leaf) {
        leaf = parseDirectory(await readRange(archive.source, archive.header.leafOffset + entry.offset, entry.length));
        directoryCache.set(leafKey, leaf);
      }
      entries = leaf;
    }
    return null;
  })();

  inFlight.set(key, task);
  try {
    const rows = await task;
    tileCache.set(key, rows);
    return rows;
  } finally {
    inFlight.delete(key);
  }
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

const lonToX = (lon: number, z: number) => Math.min(2 ** z - 1, Math.max(0, Math.floor(((lon + 180) / 360) * 2 ** z)));
const latToY = (lat: number, z: number) => {
  const rad = (Math.min(85.05, Math.max(-85.05, lat)) * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z);
  return Math.min(2 ** z - 1, Math.max(0, y));
};

interface TileRef {
  /** Zoom the tile is stored at (leaf level, or level + 1 for an overview). */
  z: number;
  x: number;
  y: number;
  /** Level of the quadtree cell this tile describes. */
  level: number;
}

const LOD_MAX_CELLS = 16;

/**
 * Tiles to read for a bbox.
 *  - exact (deep) mode descends to every leaf: all places of the area, used by searches;
 *  - overview mode stops at the finest level that needs at most LOD_MAX_CELLS cells and reads the
 *    overview tile of cells that are not leaves, so a city-sized viewport costs a handful of reads.
 * When more tiles than allowed remain, the ones closest to the bbox center win.
 */
async function coveringTiles(
  archive: Archive,
  west: number,
  south: number,
  east: number,
  north: number,
  maxTiles: number,
  overview: boolean,
): Promise<TileRef[]> {
  const found: TileRef[] = [];
  const levels = archive.levels;
  const cellsAt = (level: number) => {
    const x0 = lonToX(west, level);
    const x1 = lonToX(east, level);
    const y0 = latToY(north, level);
    const y1 = latToY(south, level);
    return { x0, x1, y0, y1, count: (x1 - x0 + 1) * (y1 - y0 + 1) };
  };

  // Overview level: the finest one whose cell count stays small.
  let targetLevel = levels[0];
  if (overview) {
    for (const level of levels) {
      if (cellsAt(level).count <= LOD_MAX_CELLS) targetLevel = level;
    }
  }

  const first = cellsAt(levels[0]);
  if (first.count > maxTiles * 4) return found; // continent-sized viewport
  let frontier: Array<[number, number]> = [];
  for (let x = first.x0; x <= first.x1; x += 1) for (let y = first.y0; y <= first.y1; y += 1) frontier.push([x, y]);

  for (let li = 0; li < levels.length && frontier.length; li += 1) {
    const level = levels[li];
    const kinds = await Promise.all(frontier.map(([x, y]) => cellKind(archive, level, x, y)));
    const next: Array<[number, number]> = [];
    kinds.forEach((info, index) => {
      const [x, y] = frontier[index];
      if (info.kind === 'leaf') {
        found.push({ z: level, x, y, level });
      } else if (info.kind === 'interior') {
        if (overview && info.hasPreview && level >= targetLevel) {
          found.push({ z: level + 1, x, y, level });
        } else if (li + 1 < levels.length) {
          const nextLevel = levels[li + 1];
          const size = 2 ** (nextLevel - level);
          const cx0 = Math.max(x * size, lonToX(west, nextLevel));
          const cx1 = Math.min(x * size + size - 1, lonToX(east, nextLevel));
          const cy0 = Math.max(y * size, latToY(north, nextLevel));
          const cy1 = Math.min(y * size + size - 1, latToY(south, nextLevel));
          for (let cx = cx0; cx <= cx1; cx += 1) for (let cy = cy0; cy <= cy1; cy += 1) next.push([cx, cy]);
        }
      }
    });
    frontier = next;
    if (found.length + frontier.length > maxTiles * 4) break;
  }

  if (found.length <= maxTiles) return found;
  const centerLon = (west + east) / 2;
  const centerLat = (south + north) / 2;
  const distance = (tile: TileRef) => {
    const n = 2 ** tile.level;
    const lon = ((tile.x + 0.5) / n) * 360 - 180;
    const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (tile.y + 0.5)) / n))) * 180) / Math.PI;
    return (lon - centerLon) ** 2 + (lat - centerLat) ** 2;
  };
  return found.sort((a, b) => distance(a) - distance(b)).slice(0, maxTiles);
}

type TileKind = 'leaf' | 'interior' | 'none';

/** Archives built before overview tiles marked interior cells with a tiny shared tile. */
const LEGACY_MARKER_MAX_BYTES = 40;

function hasEntry(archive: Archive, z: number, x: number, y: number): Promise<{ length: number } | null> {
  return findTileEntry(archive, zxyToTileId(z, x, y));
}

async function findTileEntry(archive: Archive, tileId: number): Promise<{ length: number } | null> {
  let entries = archive.root;
  for (let depth = 0; depth < 4; depth += 1) {
    const entry = findEntry(entries, tileId);
    if (!entry) return null;
    if (entry.runLength > 0) return { length: entry.length };
    const leafKey = `dir/${archive.source}/${entry.offset}`;
    let leaf = directoryCache.get(leafKey);
    if (!leaf) {
      leaf = parseDirectory(await readRange(archive.source, archive.header.leafOffset + entry.offset, entry.length));
      directoryCache.set(leafKey, leaf);
    }
    entries = leaf;
  }
  return null;
}

/**
 * What a quadtree cell is: a leaf (tile at its own level), an interior cell (overview tile stored one
 * zoom above, or a legacy marker), or nothing. Directory lookups only; no tile bytes are read.
 */
async function cellKind(archive: Archive, level: number, x: number, y: number): Promise<{ kind: TileKind; hasPreview: boolean }> {
  const own = await hasEntry(archive, level, x, y);
  if (own) {
    return own.length <= LEGACY_MARKER_MAX_BYTES
      ? { kind: 'interior', hasPreview: false }
      : { kind: 'leaf', hasPreview: false };
  }
  const preview = await hasEntry(archive, level + 1, x, y);
  return preview ? { kind: 'interior', hasPreview: true } : { kind: 'none', hasPreview: false };
}

function emailKey(): Buffer | null {
  const secret = String(process.env.SCOUTLY_PLACES_KEY || '').trim();
  return secret ? createHash('sha256').update(`scoutly-places-email:${secret}`).digest() : null;
}

function openEmails(id: string, sealed: string | null, key: Buffer | null): string[] {
  if (!sealed || !key) return [];
  try {
    const raw = Buffer.from(sealed, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
    decipher.setAAD(Buffer.from(id));
    decipher.setAuthTag(raw.subarray(raw.length - 16));
    const plain = Buffer.concat([decipher.update(raw.subarray(12, raw.length - 16)), decipher.final()]);
    const parsed = JSON.parse(plain.toString('utf8'));
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function rowToPlace(row: any[], key: Buffer | null): OverturePlace {
  const [id, name, lon, lat, category, taxonomy, confidence, websites, phones, socials, address, emailSealed, status] = row;
  const emails = openEmails(String(id), emailSealed || null, key);
  const websiteList: string[] = Array.isArray(websites) ? websites.map(String) : [];
  const phoneList: string[] = Array.isArray(phones) ? phones.map(String) : [];
  return {
    id: String(id),
    name: String(name || 'Estabelecimento Comercial'),
    latitude: Number(lat),
    longitude: Number(lon),
    category: String(category || taxonomy || 'Estabelecimento Comercial'),
    basicCategory: category || undefined,
    taxonomyPrimary: taxonomy || undefined,
    taxonomyHierarchy: [],
    taxonomyAlternates: [],
    confidence: typeof confidence === 'number' ? confidence : 0.8,
    operatingStatus: status === 't' ? 'temporarily_closed' : status === 'o' ? 'open' : null,
    website: websiteList[0] || null,
    websites: websiteList,
    email: emails[0] || null,
    emails,
    phone: phoneList[0] || null,
    phones: phoneList,
    socials: Array.isArray(socials) ? socials.map(String) : [],
    address: String(address || 'Endereço não identificado'),
    source: 'Overture Maps / Scoutly Places',
  };
}

export interface PlacesTilesResult {
  places: OverturePlace[];
  cached: boolean;
  durationMs: number;
  tiles: number;
  release: string | null;
}

export async function queryPlacesTiles(
  west: number,
  south: number,
  east: number,
  north: number,
  limit = 2000,
  /** Search mode: scan far more of the area (all tiles of a city) instead of just the map viewport. */
  deep = false,
): Promise<PlacesTilesResult> {
  const startedAt = Date.now();
  const archive = await getArchive();
  const safeLimit = Math.max(1, Math.min(Math.floor(limit), deep ? 30000 : 5000));
  const maxTiles = deep ? MAX_TILES_DEEP_QUERY : MAX_TILES_PER_QUERY;
  const leaves = await coveringTiles(archive, west, south, east, north, maxTiles, !deep);
  const tiles = await Promise.all(leaves.map(({ z, x, y }) => readTile(archive, z, x, y).catch(() => null)));

  const inside: any[][] = [];
  for (const rows of tiles) {
    if (!rows) continue;
    for (const row of rows) {
      const lon = row[2];
      const lat = row[3];
      if (lon >= west && lon <= east && lat >= south && lat <= north) inside.push(row);
    }
  }
  inside.sort((a, b) => (b[6] || 0) - (a[6] || 0));

  const key = emailKey();
  const places = inside.slice(0, safeLimit).map((row) => rowToPlace(row, key));
  return {
    places,
    cached: true,
    durationMs: Date.now() - startedAt,
    tiles: leaves.length,
    release: archive.release,
  };
}
