import { Business } from '../types';
import { meaningfulTokens, normalize } from './recommendationEngine';
import { getRecentSearchQueries, getRecommendedBusinesses, getRecommendationReasons } from './recommendations';
import { translateCategory } from './categoryTranslator';

export const CHEST_MAX_CARDS = 20;

export type ChestCandidate = Business & { reason?: string | null; reasons?: string[] };

function haystack(business: Business) {
  return normalize(`${business.category} ${translateCategory(business.category)} ${business.name}`);
}

/**
 * Candidates for the chest. What the user searched decides first: with a recent segment search
 * ("despachante", "sorveteria") only companies that match it are offered. The usual engine
 * (interactions, region, missing website, contact signals, daily rotation) orders them. Without a
 * search, or when nothing on the map matches, it is the engine ranking alone.
 */
export function buildChestCandidates(
  businesses: Business[],
  center?: { lat: number; lng: number } | null,
): { candidates: ChestCandidate[]; query: string | null } {
  const ranked = getRecommendedBusinesses(businesses, 80, { center });
  const queries = getRecentSearchQueries();

  const matched: Array<{ business: Business; query: string }> = [];
  for (const query of queries) {
    const tokens = meaningfulTokens(query);
    if (!tokens.length) continue;
    for (const business of ranked) {
      if (matched.some((item) => item.business.id === business.id)) continue;
      const text = haystack(business);
      if (tokens.every((token) => text.includes(token))) matched.push({ business, query });
    }
    // The newest query that matches anything wins; older ones only fill in when it is thin.
    if (matched.length >= CHEST_MAX_CARDS) break;
  }

  const pick = matched.length
    ? matched.map((item) => ({ business: item.business, query: item.query as string | null }))
    : ranked.map((business) => ({ business, query: null as string | null }));

  const candidates = pick.slice(0, CHEST_MAX_CARDS).map(({ business, query }) => {
    const reasons = getRecommendationReasons(business.id).filter((reason) => reason !== 'Sem site');
    const withQuery = query ? [`Combina com sua busca: ${query}`, ...reasons] : reasons;
    return { ...business, reason: withQuery[0] || null, reasons: withQuery.slice(0, 4) };
  });

  return { candidates, query: matched.length ? matched[0].query : null };
}
