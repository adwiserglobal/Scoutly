import type { VercelRequest, VercelResponse } from '@vercel/node';
import { queryBrazilPlaces, hasBrazilPlacesDatabase } from '../server/brazilPlacesService.js';
import { queryOvertureViaApi } from '../server/overtureHttpService.js';

const BRAZIL_INDEX_BBOX = {
  west: -47.2,
  south: -24.2,
  east: -45.65,
  north: -23.15,
};

function fullyInsideBrazilIndex(
  west: number,
  south: number,
  east: number,
  north: number,
) {
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
  // This same Vercel function also serves the internal /api/places alias.
  // Load DuckDB only for the internal fallback request so regular indexed-map
  // requests do not pay the native-module initialization cost.
  const { queryPlacesInBBox } = await import('../server/overtureService.js');
  return queryPlacesInBBox(west, south, east, north, limit, zoom);
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

    // /api/places is intentionally routed to this function to stay within the
    // Vercel function budget. The internal header distinguishes that request
    // from a normal /api/places-fast request and prevents recursive self-calls.
    if (internalFallback) {
      const overture = await queryOvertureDirect(west, south, east, north, safeLimit, zoom);
      res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=300');
      return res.status(200).json({
        ...overture,
        source: 'overture',
        total: overture.places.length,
      });
    }

    const insideBrazilIndex = fullyInsideBrazilIndex(west, south, east, north);

    if (insideBrazilIndex && hasBrazilPlacesDatabase()) {
      try {
        const result = await queryBrazilPlaces(west, south, east, north, safeLimit);
        if (result.places.length > 0) {
          res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=300');
          return res.status(200).json({ ...result, total: result.places.length });
        }
        console.warn('[Fast Places] Local index returned 0 places; falling back to Overture.');
      } catch (err: any) {
        console.warn('[Fast Places] Supabase unavailable, using isolated Overture fallback:', err.message);
      }
    }

    const fallback = await queryOvertureViaApi(west, south, east, north, safeLimit, zoom);
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=300');
    return res.status(200).json({
      ...fallback,
      source: 'overture',
      total: fallback.places.length,
    });
  } catch (err: any) {
    console.error('[API /api/places-fast Error]:', err);
    return res.status(500).json({
      error: err?.message || 'Erro ao consultar estabelecimentos.',
      places: [],
    });
  }
}
