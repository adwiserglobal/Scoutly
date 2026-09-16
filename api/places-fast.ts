import type { VercelRequest, VercelResponse } from '@vercel/node';
import { queryBrazilPlaces, hasBrazilPlacesDatabase } from '../server/brazilPlacesService.js';
import { queryPlacesInBBox } from '../server/overtureService.js';

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

    if (hasBrazilPlacesDatabase()) {
      try {
        const result = await queryBrazilPlaces(west, south, east, north, limit);
        res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=300');
        return res.status(200).json({ ...result, total: result.places.length });
      } catch (err: any) {
        console.warn('[Fast Places] Supabase unavailable, falling back to Overture:', err.message);
      }
    }

    const fallback = await queryPlacesInBBox(west, south, east, north, limit, zoom);
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
