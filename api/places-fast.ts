import type { VercelRequest, VercelResponse } from '@vercel/node';
import { queryBrazilPlaces, hasBrazilPlacesDatabase } from '../server/brazilPlacesService.js';

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

async function queryOvertureFallback(
  req: VercelRequest,
  params: {
    west: number;
    south: number;
    east: number;
    north: number;
    limit: number;
  },
) {
  const forwardedHost = req.headers['x-forwarded-host'];
  const host = Array.isArray(forwardedHost)
    ? forwardedHost[0]
    : forwardedHost || req.headers.host;

  if (!host) throw new Error('Request host unavailable for fallback');

  const protocol = process.env.VERCEL ? 'https' : 'http';
  const url = new URL('/api/places', `${protocol}://${host}`);

  url.searchParams.set('west', String(params.west));
  url.searchParams.set('south', String(params.south));
  url.searchParams.set('east', String(params.east));
  url.searchParams.set('north', String(params.north));
  url.searchParams.set('limit', String(params.limit));

  const response = await fetch(url, {
    headers: {
      'x-scoutly-internal-fallback': '1',
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    throw new Error(`Overture fallback failed with HTTP ${response.status}`);
  }

  const data = await response.json();
  return {
    places: Array.isArray(data?.places) ? data.places : [],
    cached: Boolean(data?.cached),
    durationMs: Number(data?.durationMs || 0),
    source: 'overture' as const,
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

    if (![west, south, east, north].every(Number.isFinite)) {
      return res.status(400).json({ error: 'Parâmetros de coordenadas inválidos.', places: [] });
    }

    const safeLimit = Math.max(1, Math.min(Math.floor(limit), 5000));
    const insideBrazilIndex = fullyInsideBrazilIndex(west, south, east, north);

    if (insideBrazilIndex && hasBrazilPlacesDatabase()) {
      try {
        const result = await queryBrazilPlaces(west, south, east, north, safeLimit);
        res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=300');
        return res.status(200).json({ ...result, total: result.places.length });
      } catch (err: any) {
        console.warn('[Fast Places] Supabase unavailable, using isolated Overture fallback:', err.message);
      }
    }

    const fallback = await queryOvertureFallback(req, {
      west,
      south,
      east,
      north,
      limit: safeLimit,
    });

    return res.status(200).json({
      ...fallback,
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
