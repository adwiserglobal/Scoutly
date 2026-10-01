import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runScoutlyBusinessSearch } from '../server/searchFacade.js';
import { searchBusinessesInBounds } from '../server/businessSearchService.js';
import { protectBusinessListForClient } from '../server/businessSealService.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const currentRegionName = typeof req.query.currentRegionName === 'string'
    ? req.query.currentRegionName
    : 'São Paulo - SP';

  if (!query) {
    return res.status(400).json({ error: 'Parâmetro q é obrigatório.', businesses: [] });
  }

  try {
    const west = Number(req.query.west);
    const south = Number(req.query.south);
    const east = Number(req.query.east);
    const north = Number(req.query.north);
    const hasViewport =
      [west, south, east, north].every(Number.isFinite) &&
      west < east &&
      south < north;

    const result = hasViewport
      ? await searchBusinessesInBounds(query, { west, south, east, north }, currentRegionName)
      : await runScoutlyBusinessSearch(query, currentRegionName);

    const businesses = protectBusinessListForClient(Array.isArray(result?.businesses) ? result.businesses : []);
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
    return res.status(200).json({ ...result, businesses });
  } catch (err: any) {
    console.error('[API /api/search Error]:', err);
    return res.status(500).json({
      error: err?.message || 'Erro ao buscar empresas.',
      businesses: [],
    });
  }
}
