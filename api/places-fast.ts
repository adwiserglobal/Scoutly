import type { VercelRequest, VercelResponse } from '@vercel/node';
import { queryBrazilPlaces, hasBrazilPlacesDatabase } from '../server/brazilPlacesService.js';
import { queryOvertureViaApi } from '../server/overtureHttpService.js';
import { queryOsmPlacesInBBox } from '../server/osmPlacesService.js';
import { protectBusinessListForClient } from '../server/businessSealService.js';

const BRAZIL_INDEX_BBOX = {
  west: -47.2,
  south: -24.2,
  east: -45.65,
  north: -23.15,
};

function fullyInsideBrazilIndex(west: number, south: number, east: number, north: number) {
  return (
    west >= BRAZIL_INDEX_BBOX.west &&
    south >= BRAZIL_INDEX_BBOX.south &&
    east <= BRAZIL_INDEX_BBOX.east &&
    north <= BRAZIL_INDEX_BBOX.north
  );
}

async function queryOvertureDirect(
  west: number,
  south: number,
  east: number,
  north: number,
  limit: number,
  zoom?: number,
) {
  const { queryPlacesInBBox } = await import('../server/overtureService.js');
  return queryPlacesInBBox(west, south, east, north, limit, zoom);
}

function safeResult(result: any, source?: string) {
  const places = protectBusinessListForClient(Array.isArray(result?.places) ? result.places : []);
  return {
    ...result,
    places,
    ...(source ? { source } : {}),
    total: places.length,
  };
}

function mergePlaceSources(primary: any[], secondary: any[], limit: number) {
  const merged = new Map<string, any>();
  const locationKeys = new Map<string, string>();

  const add = (place: any, sourceName: string) => {
    const name = String(place?.name || '').trim().toLocaleLowerCase('pt-BR')
      .normalize('NFD').replace(/\\p{M}/gu, '').replace(/[^a-z0-9]+/g, ' ').trim();
    const lat = Number(place?.latitude);
    const lng = Number(place?.longitude);
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const locationKey = `${name}:${Math.round(lat * 1000)}:${Math.round(lng * 1000)}`;
    const existingId = locationKeys.get(locationKey);
    const id = String(place?.id || `${sourceName}_${locationKey}`);

    if (existingId && merged.has(existingId)) {
      const previous = merged.get(existingId);
      merged.set(existingId, {
        ...previous,
        ...place,
        id: previous.id,
        website: previous.website || place.website || null,
        websites: Array.from(new Set([...(previous.websites || []), ...(place.websites || [])].filter(Boolean))),
        phone: previous.phone || place.phone || null,
        phones: Array.from(new Set([...(previous.phones || []), ...(place.phones || [])].filter(Boolean))),
        email: previous.email || place.email || null,
        emails: Array.from(new Set([...(previous.emails || []), ...(place.emails || [])].filter(Boolean))),
        socials: Array.from(new Set([...(previous.socials || []), ...(place.socials || [])].filter(Boolean))),
        source: [previous.source, place.source].filter(Boolean).join(' + '),
      });
      return;
    }

    if (!merged.has(id)) {
      merged.set(id, { ...place, id });
      locationKeys.set(locationKey, id);
    }
  };

  for (const place of primary) add(place, 'osm');
  for (const place of secondary) add(place, 'overture');
  return Array.from(merged.values()).slice(0, limit);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const west = Number(req.query.west);
    const south = Number(req.query.south);
    const east = Number(req.query.east);
    const north = Number(req.query.north);
    const limit = req.query.limit ? Number(req.query.limit) : 2000;
    const zoom = req.query.zoom ? Number(req.query.zoom) : undefined;

    if (![west, south, east, north].every(Number.isFinite)) {
      return res.status(400).json({ error: 'Parâmetros de coordenadas inválidos.', places: [] });
    }

    const safeLimit = Math.max(1, Math.min(Math.floor(limit), 5000));
    const internalFallback = String(req.headers['x-scoutly-internal-fallback'] || '') === '1';

    if (internalFallback) {
      const overture = await queryOvertureDirect(west, south, east, north, safeLimit, zoom);
      res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=300');
      return res.status(200).json(safeResult(overture, 'overture'));
    }

    const insideBrazilIndex = fullyInsideBrazilIndex(west, south, east, north);

    if (insideBrazilIndex && hasBrazilPlacesDatabase()) {
      try {
        const result = await queryBrazilPlaces(west, south, east, north, safeLimit);
        if (result.places.length > 0) {
          res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=300');
          return res.status(200).json(safeResult(result));
        }
        console.warn('[Fast Places] Local index returned 0 places; trying OSM national fallback.');
      } catch (err: any) {
        console.warn('[Fast Places] Local index unavailable; trying OSM national fallback:', err.message);
      }
    }

    // Small municipalities frequently have partial coverage in a single
    // public dataset. Use OSM as the quick first source, then merge Overture
    // whenever OSM returns fewer than 120 named businesses.
    let osm: any = { places: [], cached: false, durationMs: 0 };
    try {
      osm = await queryOsmPlacesInBBox(
        west,
        south,
        east,
        north,
        Math.min(safeLimit, zoom && zoom >= 14 ? 1800 : 1500),
        5200,
      );
    } catch (err: any) {
      console.warn('[Fast Places] OSM fallback unavailable:', err?.message || err);
    }

    if (osm.places.length >= 120) {
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600');
      return res.status(200).json(safeResult(osm, 'openstreetmap'));
    }

    let overture: any = { places: [], cached: false, durationMs: 0 };
    try {
      overture = await queryOvertureViaApi(west, south, east, north, safeLimit, zoom, 10000);
    } catch (err: any) {
      console.warn('[Fast Places] Overture fallback unavailable:', err?.message || err);
    }

    const places = mergePlaceSources(osm.places || [], overture.places || [], safeLimit);
    const result = {
      places,
      cached: Boolean(osm.cached && overture.cached),
      durationMs: Math.max(Number(osm.durationMs || 0), Number(overture.durationMs || 0)),
    };
    const source = [
      osm.places.length ? 'openstreetmap' : null,
      overture.places?.length ? 'overture' : null,
    ].filter(Boolean).join('+') || 'none';
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600');
    return res.status(200).json(safeResult(result, source));
  } catch (err: any) {
    console.error('[API /api/places-fast Error]:', err);
    return res.status(500).json({
      error: err?.message || 'Erro ao consultar estabelecimentos.',
      places: [],
    });
  }
}
