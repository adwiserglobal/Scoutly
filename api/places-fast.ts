import type { VercelRequest, VercelResponse } from '@vercel/node';
import { queryBrazilPlaces, hasBrazilPlacesDatabase } from '../server/brazilPlacesService.js';
import { queryOvertureViaApi } from '../server/overtureHttpService.js';
import { queryOsmPlacesInBBox } from '../server/osmPlacesService.js';
import { requireFirebaseIdentity } from '../server/firebaseTokenService.js';
import { ensureAppUser } from '../server/appDataService.js';
import { protectBusinessResults } from '../server/entitlementService.js';

const BRAZIL_INDEX_BBOX = {
  west: -47.2,
  south: -24.2,
  east: -45.65,
  north: -23.15,
};

function fullyInsideBrazilIndex(west: number, south: number, east: number, north: number) {
  return west >= BRAZIL_INDEX_BBOX.west && south >= BRAZIL_INDEX_BBOX.south &&
    east <= BRAZIL_INDEX_BBOX.east && north <= BRAZIL_INDEX_BBOX.north;
}

async function queryOvertureDirect(west: number, south: number, east: number, north: number, limit: number, zoom?: number) {
  const { queryPlacesInBBox } = await import('../server/overtureService.js');
  return queryPlacesInBBox(west, south, east, north, limit, zoom);
}

async function protectedResponse(res: VercelResponse, userUid: string, result: any, source?: string) {
  const protectedResult = await protectBusinessResults(userUid, Array.isArray(result?.places) ? result.places : []);
  res.setHeader('Cache-Control', 'private, no-store');
  return res.status(200).json({
    ...result,
    places: protectedResult.businesses,
    total: protectedResult.businesses.length,
    source: source || result?.source,
    creditState: protectedResult.creditState,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const identity = await requireFirebaseIdentity(req as any);
    await ensureAppUser(identity);

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
    const insideBrazilIndex = fullyInsideBrazilIndex(west, south, east, north);

    if (insideBrazilIndex && hasBrazilPlacesDatabase()) {
      try {
        const result = await queryBrazilPlaces(west, south, east, north, safeLimit);
        if (result.places.length > 0) return protectedResponse(res, identity.uid, result);
        console.warn('[Fast Places] Local index returned 0 places; trying OSM national fallback.');
      } catch (err: any) {
        console.warn('[Fast Places] Local index unavailable; trying OSM national fallback:', err.message);
      }
    }

    try {
      const osm = await queryOsmPlacesInBBox(
        west, south, east, north,
        Math.min(safeLimit, zoom && zoom >= 14 ? 1800 : 1000),
      );
      if (osm.places.length > 0) return protectedResponse(res, identity.uid, osm, 'openstreetmap');
      console.warn('[Fast Places] OSM returned 0 places; using heavy Overture fallback.');
    } catch (err: any) {
      console.warn('[Fast Places] OSM fallback unavailable; using heavy Overture fallback:', err?.message || err);
    }

    let fallback;
    try {
      fallback = await queryOvertureViaApi(west, south, east, north, safeLimit, zoom);
    } catch {
      fallback = await queryOvertureDirect(west, south, east, north, safeLimit, zoom);
    }
    return protectedResponse(res, identity.uid, fallback, 'overture');
  } catch (err: any) {
    console.error('[API /api/places-fast Error]:', err);
    const status = Number(err?.statusCode || 500);
    return res.status(status).json({
      error: err?.message || 'Erro ao consultar estabelecimentos.',
      code: err?.code || undefined,
      places: [],
    });
  }
}
