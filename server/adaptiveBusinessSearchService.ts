import { searchBusinesses, type BusinessSearchResult } from './businessSearchService.js';
import {
  extractBusinessPhraseFromQuery,
  extractExplicitLocationPhrase,
  resolveSearchGeography,
} from './geographyService.js';

const MIN_RESULTS_BEFORE_CITY_EXPANSION = 40;
const MAX_RESULTS = 300;

/**
 * Search policy used by both the search bar and Scoutly AI.
 *
 * A plain segment query (for example "despachante") should not become trapped
 * inside a small neighbourhood bbox just because the map is currently centered
 * on that neighbourhood. We first respect the current area for relevance. If the
 * result set is sparse and the user did NOT explicitly name a location, we widen
 * the search to the containing city and merge the results.
 *
 * Explicit geographic queries such as "despachantes em Pinheiros" are never
 * widened outside the requested location.
 */
export async function searchBusinessesAdaptive(
  query: string,
  currentRegionName = 'São Paulo - SP'
): Promise<BusinessSearchResult> {
  const initial = await searchBusinesses(query, currentRegionName);
  const explicitLocation = extractExplicitLocationPhrase(query);

  if (explicitLocation || initial.businesses.length >= MIN_RESULTS_BEFORE_CITY_EXPANSION) {
    return initial;
  }

  let geography;
  try {
    geography = await resolveSearchGeography(query, currentRegionName);
  } catch (error) {
    console.warn('[Adaptive Search] Could not resolve current geography:', error);
    return initial;
  }

  // City-level searches are already broad enough. Expansion is useful only when
  // the current context resolved to a bairro/neighbourhood.
  if (!geography.bairro || !geography.cidade) {
    return initial;
  }

  const businessPhrase = extractBusinessPhraseFromQuery(query).trim();
  if (!businessPhrase) return initial;

  try {
    const cityQuery = `${businessPhrase} em ${geography.cidade}, ${geography.uf}`;
    const expanded = await searchBusinesses(cityQuery, `${geography.cidade} - ${geography.uf}`);

    if (expanded.businesses.length === 0) return initial;

    // Keep the closest/current-area matches first, then fill the remainder from
    // the city-wide result set. This preserves local relevance without sacrificing
    // recall for sparse niches such as despachantes.
    const merged = new Map<string, (typeof initial.businesses)[number]>();
    for (const business of initial.businesses) merged.set(business.id, business);
    for (const business of expanded.businesses) {
      if (!merged.has(business.id)) merged.set(business.id, business);
      if (merged.size >= MAX_RESULTS) break;
    }

    const businesses = Array.from(merged.values()).slice(0, MAX_RESULTS);

    console.log(
      `[Adaptive Search] Expanded "${businessPhrase}" from ${geography.rawName} ` +
      `(${initial.businesses.length}) to ${expanded.region.name} (${businesses.length}).`
    );

    return {
      ...expanded,
      query,
      businessType: initial.businessType || expanded.businessType,
      precisionMode: Boolean(initial.precisionMode || expanded.precisionMode),
      businesses,
    };
  } catch (error) {
    console.warn('[Adaptive Search] City expansion failed:', error);
    return initial;
  }
}
