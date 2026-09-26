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

    try {
      const osm = await queryOsmPlacesInBBox(
        west,
        south,
        east,
        north,
        Math.min(safeLimit, zoom && zoom >= 14 ? 1800 : 1000),
      );
      if (osm.places.length > 0) {
        res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600');
        return res.status(200).json(safeResult(osm, 'openstreetmap'));
      }
      console.warn('[Fast Places] OSM returned 0 places; using heavy Overture fallback.');
    } catch (err: any) {
      console.warn('[Fast Places] OSM fallback unavailable; using heavy Overture fallback:', err?.message || err);
    }

    const fallback = await queryOvertureViaApi(west, south, east, north, safeLimit, zoom);
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=300');
    return res.status(200).json(safeResult(fallback, 'overture'));
  } catch (err: any) {
    console.error('[API /api/places-fast Error]:', err);
    return res.status(500).json({
      error: err?.message || 'Erro ao consultar estabelecimentos.',
      places: [],
    });
  }
}
