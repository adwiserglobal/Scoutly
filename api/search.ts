import type { VercelRequest, VercelResponse } from '@vercel/node';
import { searchBusinesses } from '../server/businessSearchService.js';
import { findSparseSearchFallback } from '../server/sparseSearchFallback.js';

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
    const result = await searchBusinesses(query, currentRegionName);

    // Niche Brazilian segments can be poorly represented in the source taxonomy.
    // When the primary search is sparse, recover exact name matches from the
    // Scoutly index (and, when configured, Google Places) instead of returning 0.
    if (result.businesses.length < 12) {
      try {
        const fallback = await findSparseSearchFallback({
          query,
          businessType: result.businessType,
          region: result.region,
          existingIds: result.businesses.map((business) => business.id),
          limit: 40,
        });

        if (fallback.length > 0) {
          const merged = new Map(result.businesses.map((business) => [business.id, business]));
          for (const business of fallback) {
            if (!merged.has(business.id)) merged.set(business.id, business);
          }
          result.businesses = Array.from(merged.values()).slice(0, 300);
        }
      } catch (fallbackError: any) {
        console.warn('[API /api/search] Sparse fallback failed:', fallbackError?.message || fallbackError);
      }
    }

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json(result);
  } catch (err: any) {
    console.error('[API /api/search Error]:', err);
    return res.status(500).json({
      error: err?.message || 'Erro ao buscar empresas.',
      businesses: [],
    });
  }
}
