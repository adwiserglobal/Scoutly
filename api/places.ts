import type { VercelRequest, VercelResponse } from '@vercel/node';
console.log('API places started');
import { queryPlacesInBBox } from '../server/overtureService.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('handler started');
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    console.log('duckdb import ok');
    console.log('duckdb initialized');

    const west = parseFloat(req.query.west as string);
    const south = parseFloat(req.query.south as string);
    const east = parseFloat(req.query.east as string);
    const north = parseFloat(req.query.north as string);
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 5000;

    if (isNaN(west) || isNaN(south) || isNaN(east) || isNaN(north)) {
      return res.status(400).json({
        error: 'Parâmetros de coordenadas inválidos.',
        places: []
      });
    }

    console.log('overture query started');
    const result = await queryPlacesInBBox(west, south, east, north, limit);
    console.log('overture query finished');

    return res.status(200).json({
      places: result.places,
      total: result.places.length,
      cached: result.cached,
      durationMs: result.durationMs,
    });
  } catch (err: any) {
    console.error('[API /api/places Error FULL]:', err);
    return res.status(500).json({
      error: err.message || 'Erro ao consultar estabelecimentos.',
      details: err.stack || String(err),
      places: []
    });
  }
}
