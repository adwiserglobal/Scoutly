import { searchBusinessesAdaptive } from './adaptiveBusinessSearchService.js';
import type { BusinessSearchResult } from './businessSearchService.js';
import { findSparseSearchFallback } from './sparseSearchFallback.js';

export async function runScoutlyBusinessSearch(
  query: string,
  currentRegionName = 'São Paulo - SP'
): Promise<BusinessSearchResult> {
  const cleanQuery = String(query || '').trim();
  if (!cleanQuery) throw new Error('Consulta de busca vazia.');

  const result = await searchBusinessesAdaptive(cleanQuery, currentRegionName);
  let businesses = Array.isArray(result.businesses) ? [...result.businesses] : [];

  if (businesses.length < 12) {
    try {
      const fallback = await findSparseSearchFallback({
        query: cleanQuery,
        businessType: result.businessType,
        region: result.region,
        existingIds: businesses.map((business) => business.id),
        limit: 40,
      });

      if (fallback.length > 0) {
        const merged = new Map(businesses.map((business) => [business.id, business]));
        for (const business of fallback) {
          if (!merged.has(business.id)) merged.set(business.id, business);
        }
        businesses = Array.from(merged.values()).slice(0, 300);
      }
    } catch (error: any) {
      console.warn('[Scoutly Search] Sparse fallback failed:', error?.message || error);
    }
  }

  return {
    ...result,
    query: cleanQuery,
    businesses,
  };
}
