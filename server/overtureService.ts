import duckdb from 'duckdb';
import fs from 'fs';
import path from 'path';

export interface OverturePlace {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  category: string;
  basicCategory?: string;
  taxonomyPrimary?: string;
  taxonomyHierarchy?: string[];
  taxonomyAlternates?: string[];
  confidence: number;
  operatingStatus: string | null;
  website: string | null;
  websites: string[];
  email: string | null;
  emails: string[];
  phone: string | null;
  phones: string[];
  socials: string[];
  address: string;
  source: string;
  openStatus?: 'ABERTO_AGORA' | 'FECHADO_AGORA' | 'DESCONHECIDO';
  openStatusText?: string;
  openingHoursRaw?: string | null;
}

interface CacheEntry {
  data: OverturePlace[];
  timestamp: number;
}

// In-memory cache for exact bounding boxes (15 min TTL)
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_CACHE_SIZE = 200;

// Track in-flight queries to deduplicate concurrent requests for the same area
const inFlightQueries = new Map<string, Promise<OverturePlace[]>>();

let dbInstance: duckdb.Database | null = null;
let isInitialized = false;
let initPromise: Promise<void> | null = null;

export async function getDuckDB(): Promise<duckdb.Database> {
  if (dbInstance && isInitialized) {
    return dbInstance;
  }

  if (initPromise) {
    await initPromise;
    return dbInstance!;
  }

  let initializingDb: duckdb.Database | undefined;
  initPromise = new Promise<void>((resolve, reject) => {
    try {
      const isVercel = !!process.env.VERCEL;
      const dataDir = isVercel ? '/tmp' : path.join(process.cwd(), 'data');
      if (!fs.existsSync(dataDir)) {
        try {
          fs.mkdirSync(dataDir, { recursive: true });
        } catch (e) {}
      }
      const dbPath = path.join(dataDir, 'radar.duckdb');
      console.log(`[DuckDB] Initializing persistent database at ${dbPath}...`);
      const db = new duckdb.Database(dbPath);
      initializingDb = db;
      console.log('duckdb initialized');

      try {
        fs.mkdirSync('/tmp/duckdb_extensions', { recursive: true });
      } catch (e) {}

      db.all(
        "SET home_directory='/tmp';",
        (homeErr) => {
          if (homeErr) {
            console.error('[DuckDB] Error setting home_directory:', homeErr);
          } else {
            console.log('home_directory configured');
          }

          db.all(
            "SET extension_directory='/tmp/duckdb_extensions';",
            (extErr) => {
              if (extErr) {
                console.error('[DuckDB] Error setting extension_directory:', extErr);
              } else {
                console.log('extension_directory configured');
              }

              db.all(
                "INSTALL httpfs; LOAD httpfs;",
                (httpfsErr) => {
                  if (httpfsErr) {
                    console.error('[DuckDB] Error loading httpfs:', httpfsErr);
                    reject(httpfsErr);
                    return;
                  }
                  console.log('httpfs loaded');

                  db.all(
                    "INSTALL spatial; LOAD spatial;",
                    (spatialErr) => {
                      if (spatialErr) {
                        console.error('[DuckDB] Error loading spatial:', spatialErr);
                        reject(spatialErr);
                        return;
                      }
                      console.log('spatial loaded');

                      db.all(
                        "SET s3_region='us-west-2'; " +
                        "PRAGMA threads=16; " +
                        "SET enable_http_metadata_cache=true; " +
                        "SET enable_object_cache=true; " +
                        "SET preserve_insertion_order=false; " +
                        "SET http_keep_alive=true; " +
                        "SET http_timeout=35000; " +
                        "CREATE TABLE IF NOT EXISTS enrichment_cache (url VARCHAR PRIMARY KEY, data JSON, updated_at TIMESTAMP); " +
                        "CREATE TABLE IF NOT EXISTS user_leads (business_id VARCHAR PRIMARY KEY, status VARCHAR, notes VARCHAR, updated_at TIMESTAMP); " +
                        "CREATE TABLE IF NOT EXISTS overture_bbox_cache (" +
                        "  cache_key VARCHAR PRIMARY KEY, data JSON, updated_at TIMESTAMP" +
                        ");",
                        (tableErr) => {
                          if (tableErr) {
                            console.error('[DuckDB] Error creating tables:', tableErr);
                            reject(tableErr);
                          } else {
                            dbInstance = db;
                            isInitialized = true;
                            resolve();
                          }
                        }
                      );
                    }
                  );
                }
              );
            }
          );
        }
      );
    } catch (err) {
      console.error('[DuckDB] Fatal error creating database:', err);
      reject(err);
    }
  });

  try {
    await initPromise;
    return dbInstance!;
  } catch (err) {
    initializingDb?.close(() => {});
    initPromise = null; // A transient initialization failure must be retryable.
    throw err;
  }
}

export function normalizeOverturePlace(row: any): OverturePlace {
  const websites: string[] = Array.isArray(row.websites)
    ? row.websites.filter((w: any) => typeof w === 'string' && w.trim().length > 0)
    : typeof row.websites === 'string'
    ? [row.websites]
    : [];

  const emails: string[] = Array.isArray(row.emails)
    ? row.emails.filter((e: any) => typeof e === 'string' && e.trim().length > 0)
    : typeof row.emails === 'string'
    ? [row.emails]
    : [];

  const phones: string[] = Array.isArray(row.phones)
    ? row.phones.filter((p: any) => typeof p === 'string' && p.trim().length > 0)
    : typeof row.phones === 'string'
    ? [row.phones]
    : [];

  const socials: string[] = Array.isArray(row.socials)
    ? row.socials.filter((s: any) => typeof s === 'string' && s.trim().length > 0)
    : typeof row.socials === 'string'
    ? [row.socials]
    : [];

  let formattedAddress = 'Endereço não identificado';
  if (Array.isArray(row.addresses) && row.addresses.length > 0) {
    const a = row.addresses[0];
    const parts = [a.freeform, a.locality, a.region, a.postcode].filter(Boolean);
    if (parts.length > 0) {
      formattedAddress = parts.join(', ');
    }
  }

  const basicCategory = typeof row.basic_category === 'string' ? row.basic_category.trim().toLowerCase() : '';

  let taxonomyPrimary = '';
  let taxonomyHierarchy: string[] = [];
  let taxonomyAlternates: string[] = [];

  if (row.taxonomy) {
    if (typeof row.taxonomy.primary === 'string') {
      taxonomyPrimary = row.taxonomy.primary.trim().toLowerCase();
    }
    if (Array.isArray(row.taxonomy.hierarchy)) {
      taxonomyHierarchy = row.taxonomy.hierarchy.map((h: any) => String(h).trim().toLowerCase());
    } else if (typeof row.taxonomy.hierarchy === 'string') {
      taxonomyHierarchy = [row.taxonomy.hierarchy.trim().toLowerCase()];
    }
    if (Array.isArray(row.taxonomy.alternates)) {
      taxonomyAlternates = row.taxonomy.alternates.map((a: any) => String(a).trim().toLowerCase());
    } else if (typeof row.taxonomy.alternates === 'string') {
      taxonomyAlternates = [row.taxonomy.alternates.trim().toLowerCase()];
    }
  }

  if (!taxonomyPrimary && row.categories && typeof row.categories.primary === 'string') {
    taxonomyPrimary = row.categories.primary.trim().toLowerCase();
  }

  let resolvedCategory = basicCategory || taxonomyPrimary || (taxonomyHierarchy.length > 0 ? taxonomyHierarchy[0] : 'estabelecimento');

  // Format category to readable text (e.g. auto_repair -> Auto Repair)
  const categoryFormatted = resolvedCategory
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    id: String(row.id || Math.random().toString(36).slice(2)),
    name: typeof row.name === 'string' && row.name.trim() ? row.name.trim() : 'Estabelecimento Comercial',
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    category: categoryFormatted,
    basicCategory,
    taxonomyPrimary,
    taxonomyHierarchy,
    taxonomyAlternates,
    confidence: typeof row.confidence === 'number' ? Number(row.confidence.toFixed(2)) : 0.8,
    operatingStatus: row.operating_status || null,
    website: websites.length > 0 ? websites[0] : null,
    websites,
    email: emails.length > 0 ? emails[0] : null,
    emails,
    phone: phones.length > 0 ? phones[0] : null,
    phones,
    socials,
    address: formattedAddress,
    source: 'Overture Maps',
  };
}

export async function searchPlacesByKeyword(
  keyword: string,
  regionName: string,
  lat?: number,
  lng?: number
): Promise<OverturePlace[]> {
  const cleanKeyword = keyword.trim().toLowerCase();
  console.log(`[Targeted Place Search] Searching for "${cleanKeyword}" in "${regionName}"...`);

  // 1. First, search OSM Nominatim / Overpass for POIs matching the exact term and city
  try {
    const q = `${cleanKeyword} ${regionName}`;
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      q
    )}&countrycodes=br&limit=40&addressdetails=1`;
    
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Scoutly-Prospector/1.0',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    });

    if (res.ok) {
      const items = await res.json();
      if (Array.isArray(items) && items.length > 0) {
        const places: OverturePlace[] = items.map((item: any) => {
          const name = item.name || item.display_name.split(',')[0] || `Despachante`;
          const address = item.display_name || regionName;
          const placeLat = parseFloat(item.lat);
          const placeLng = parseFloat(item.lon);
          
          return {
            id: `osm_${item.osm_id || Math.random().toString(36).slice(2)}`,
            name: name.trim(),
            latitude: placeLat,
            longitude: placeLng,
            category: cleanKeyword.charAt(0).toUpperCase() + cleanKeyword.slice(1),
            confidence: 0.92,
            operatingStatus: 'OPERATIONAL',
            website: null,
            websites: [],
            email: null,
            emails: [],
            phone: null,
            phones: [],
            socials: [],
            address: address,
            source: 'OSM / Scoutly Radar',
          };
        });

        console.log(`[Targeted Place Search] Found ${places.length} POIs for "${cleanKeyword}" via OSM`);
        return places;
      }
    }
  } catch (err: any) {
    console.warn('[Targeted Place Search Error]:', err.message);
  }

  // 2. Fallback: Query DuckDB in bbox if lat/lng are provided
  if (lat && lng) {
    const delta = 0.08;
    const res = await queryPlacesInBBox(lng - delta, lat - delta, lng + delta, lat + delta, 200);
    return res.places;
  }

  return [];
}

export function lon2tile(lon: number, zoom: number = 13): number {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

export function lat2tile(lat: number, zoom: number = 13): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
      Math.pow(2, zoom)
  );
}

export function getTilesForBBox(
  west: number,
  south: number,
  east: number,
  north: number,
  zoom: number = 13
): string[] {
  const minTileX = lon2tile(west, zoom);
  const maxTileX = lon2tile(east, zoom);
  const minTileY = lat2tile(north, zoom);
  const maxTileY = lat2tile(south, zoom);
  const tiles: string[] = [];
  const startX = Math.min(minTileX, maxTileX);
  const endX = Math.max(minTileX, maxTileX);
  const startY = Math.min(minTileY, maxTileY);
  const endY = Math.max(minTileY, maxTileY);
  for (let x = startX; x <= endX; x++) {
    for (let y = startY; y <= endY; y++) {
      tiles.push(`${zoom}/${x}/${y}`);
    }
  }
  return tiles;
}

export async function queryPlacesInBBox(
  west: number,
  south: number,
  east: number,
  north: number,
  limit: number = 5000,
  zoom?: number
): Promise<{ places: OverturePlace[]; cached: boolean; durationMs: number }> {
  const startTime = Date.now();
  if (![west, south, east, north, limit].every(Number.isFinite) ||
      west < -180 || east > 180 || south < -90 || north > 90 ||
      west >= east || south >= north) {
    throw new Error('Parâmetros de coordenadas inválidos.');
  }
  if (east - west > 1.2 || north - south > 1.2) {
    throw new Error('Aproxime o mapa para visualizar os negócios.');
  }
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 5000);
  // Exact bounds avoid reusing data from a different street or part of a tile.
  const cacheKey = `${west}_${south}_${east}_${north}_${safeLimit}`;

  // 1. Fast in-memory RAM cache (< 1ms)
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `[Scoutly Perf] Memory Cache HIT | ${cached.data.length} places | Duration: ${Date.now() - startTime}ms`
      );
    }
    return {
      places: cached.data,
      cached: true,
      durationMs: Date.now() - startTime,
    };
  }

  // 2. In-flight query deduplication
  if (inFlightQueries.has(cacheKey)) {
    const data = await inFlightQueries.get(cacheKey)!;
    return {
      places: data,
      cached: true,
      durationMs: Date.now() - startTime,
    };
  }

  const queryPromise = (async (): Promise<OverturePlace[]> => {
    const db = await getDuckDB();
    // Persist complete responses, including empty areas. A handful of points
    // left by a neighboring query is not evidence that this area was fetched.
    const localPlaces = await new Promise<OverturePlace[] | null>((resolve) => {
      db.all(
        "SELECT data FROM overture_bbox_cache WHERE cache_key = ? AND updated_at > CURRENT_TIMESTAMP - INTERVAL '15 minutes'",
        cacheKey,
        (err, rows: any[]) => {
          if (err || !rows?.length) return resolve(null);
          try { resolve(JSON.parse(rows[0].data)); } catch { resolve(null); }
        }
      );
    });
    if (localPlaces !== null) return localPlaces;

    const s3Sql = `
      SELECT 
        id,
        names.primary AS name,
        basic_category,
        taxonomy,
        categories,
        confidence,
        operating_status,
        websites,
        socials,
        emails,
        phones,
        addresses,
        sources,
        ST_X(geometry) AS longitude,
        ST_Y(geometry) AS latitude
      FROM read_parquet('s3://overturemaps-us-west-2/release/2026-08-19.0/theme=places/type=place/*', filename=false)
      WHERE bbox.xmin >= ?
        AND bbox.xmax <= ?
        AND bbox.ymin >= ?
        AND bbox.ymax <= ?
      LIMIT ?;
    `;

    return new Promise<OverturePlace[]>((resolve, reject) => {
      db.all(s3Sql, west, east, south, north, safeLimit, (err, rows) => {
        const fetchDuration = Date.now() - startTime;
        if (err) {
          console.error(`[Overture DuckDB S3] Query failed after ${fetchDuration}ms:`, err.message);
          // Do not disguise a failed query as an empty, successfully loaded area.
          reject(new Error('Não foi possível consultar os negócios desta área. Tente novamente.'));
          return;
        }

        const normalized = (rows || []).map(normalizeOverturePlace);
        normalized.forEach((p) => {
          p.openStatus = 'DESCONHECIDO';
          p.openStatusText = 'Horário não identificado';
        });

        if (process.env.NODE_ENV !== 'production') {
          console.log(
            `[Scoutly Perf] Overture S3 Fetched | ${normalized.length} places in ${fetchDuration}ms for bbox [${west.toFixed(3)}, ${south.toFixed(3)}, ${east.toFixed(3)}, ${north.toFixed(3)}]`
          );
        }

        // One batched write instead of thousands of queued row writes.
        db.run(
          'INSERT OR REPLACE INTO overture_bbox_cache VALUES (?, ?, CURRENT_TIMESTAMP)',
          cacheKey, JSON.stringify(normalized),
          (saveErr) => {
            if (saveErr) console.warn('[DuckDB Cache Save Warning]:', saveErr.message);
          }
        );
        db.run("DELETE FROM overture_bbox_cache WHERE updated_at < CURRENT_TIMESTAMP - INTERVAL '15 minutes'", () => {});
        resolve(normalized);
      });
    });
  })();

  inFlightQueries.set(cacheKey, queryPromise);

  try {
    const results = await queryPromise;
    if (cache.size >= MAX_CACHE_SIZE) cache.delete(cache.keys().next().value!);
    cache.set(cacheKey, { data: results, timestamp: Date.now() });
    return {
      places: results,
      cached: false,
      durationMs: Date.now() - startTime,
    };
  } finally {
    inFlightQueries.delete(cacheKey);
  }
}
