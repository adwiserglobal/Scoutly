import duckdb from 'duckdb';
import fs from 'fs';
import path from 'path';
import {
  fetchOsmOpeningHoursInBBox,
  matchOverturePlacesWithOsmHours,
} from './osmOpeningHoursService.js';

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

// In-memory cache for rounded bounding boxes (15 min TTL)
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

  initPromise = new Promise<void>((resolve, reject) => {
    try {
      const dataDir = path.join(process.cwd(), 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const dbPath = path.join(dataDir, 'radar.duckdb');
      console.log(`[DuckDB] Initializing persistent database at ${dbPath}...`);
      const db = new duckdb.Database(dbPath);
      
      db.all(
        "INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial; SET s3_region='us-west-2'; SET enable_http_metadata_cache=true; SET enable_object_cache=true; PRAGMA threads=4; PRAGMA enable_progress_bar=false; CREATE TABLE IF NOT EXISTS enrichment_cache (url VARCHAR PRIMARY KEY, data JSON, updated_at TIMESTAMP); CREATE TABLE IF NOT EXISTS user_leads (business_id VARCHAR PRIMARY KEY, status VARCHAR, notes VARCHAR, updated_at TIMESTAMP);",
        (err) => {
          if (err) {
            console.error('[DuckDB] Error loading extensions or creating cache table:', err);
            reject(err);
          } else {
            console.log('[DuckDB] Extensions (httpfs, spatial) loaded successfully and tables (user_leads, enrichment_cache) created.');
            dbInstance = db;
            isInitialized = true;
            resolve();
          }
        }
      );
    } catch (err) {
      console.error('[DuckDB] Fatal error creating database:', err);
      reject(err);
    }
  });

  await initPromise;
  return dbInstance!;
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
    return queryPlacesInBBox(lng - delta, lat - delta, lng + delta, lat + delta, 200);
  }

  return [];
}

export async function queryPlacesInBBox(
  west: number,
  south: number,
  east: number,
  north: number,
  limit: number = 5000
): Promise<OverturePlace[]> {
  const roundedWest = Number(west.toFixed(3));
  const roundedSouth = Number(south.toFixed(3));
  const roundedEast = Number(east.toFixed(3));
  const roundedNorth = Number(north.toFixed(3));
  const safeLimit = Math.min(Math.max(limit, 1), 5000);

  const cacheKey = `${roundedWest}_${roundedSouth}_${roundedEast}_${roundedNorth}_${safeLimit}`;

  // Check in-memory cache
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log(`[Overture Cache] HIT for bbox [${roundedWest}, ${roundedSouth}, ${roundedEast}, ${roundedNorth}] (${cached.data.length} places)`);
    return cached.data;
  }

  // Check in-flight query deduplication
  if (inFlightQueries.has(cacheKey)) {
    console.log(`[Overture Deduplication] Reusing active query for bbox ${cacheKey}`);
    return inFlightQueries.get(cacheKey)!;
  }

  const queryPromise = (async () => {
    const startTime = Date.now();
    const db = await getDuckDB();

    const sql = `
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
      db.all(sql, west, east, south, north, safeLimit, (err, rows) => {
        const duration = Date.now() - startTime;
        if (err) {
          console.error(`[Overture DuckDB] Query failed after ${duration}ms:`, err.message);
          reject(err);
          return;
        }

        const normalized = (rows || []).map(normalizeOverturePlace);
        console.log(
          `[Overture DuckDB] Query took ${duration}ms, returned ${normalized.length} places for bbox [${west.toFixed(4)}, ${south.toFixed(4)}, ${east.toFixed(4)}, ${north.toFixed(4)}]`
        );

        // Populate default open status first
        normalized.forEach((p) => {
          p.openStatus = 'DESCONHECIDO';
          p.openStatusText = 'Horário não identificado';
        });

        // Attempt fast OSM match within 1.5s max
        const osmPromise = fetchOsmOpeningHoursInBBox(west, south, east, north)
          .then((osmNodes) => {
            if (osmNodes && osmNodes.length > 0) {
              const matches = matchOverturePlacesWithOsmHours(normalized, osmNodes);
              matches.forEach((matched, placeId) => {
                const p = normalized.find((item) => item.id === placeId);
                if (p) {
                  p.openStatus = matched.openStatus;
                  p.openStatusText = matched.openStatusText;
                  p.openingHoursRaw = matched.openingHoursRaw;
                }
              });
              console.log(`[OSM Hours Matching] Matched ${matches.size} places with OSM opening_hours`);
            }
          })
          .catch((osmErr) => {
            console.warn('[OSM Hours Warning]:', osmErr?.message || osmErr);
          });

        const timeoutPromise = new Promise<void>((r) => setTimeout(r, 1500));

        Promise.race([osmPromise, timeoutPromise]).finally(() => {
          // Store in cache
          if (cache.size >= MAX_CACHE_SIZE) {
            const oldestKey = cache.keys().next().value;
            if (oldestKey) cache.delete(oldestKey);
          }
          cache.set(cacheKey, { data: normalized, timestamp: Date.now() });

          resolve(normalized);
        });
      });
    });
  })();

  inFlightQueries.set(cacheKey, queryPromise);

  try {
    const results = await queryPromise;
    return results;
  } finally {
    inFlightQueries.delete(cacheKey);
  }
}
