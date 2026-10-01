import type { OverturePlace } from './overtureService.js';
import { queryOvertureViaApi } from './overtureHttpService.js';
import { interpretSearchIntent } from './searchInterpreter.js';
import type { BusinessSummary } from './aiService.js';
import {
  fetchCompaniesFromMinhaReceita,
  processMinhaReceitaBusiness,
  isCompanyActive,
  isCNPJInRequestedRegion,
  getCNAEsForBusinessType,
} from './cnpjService.js';
import { fetchBusinessesFromSerper } from './serperService.js';
import { hasBrazilPlacesDatabase, queryBrazilPlacesByName, queryBrazilPlacesPrecise } from './brazilPlacesService.js';
import { resolveSearchProfile, scoreAgainstProfile, normalizeSearchText, SearchProfile } from './searchProfiles.js';
import { resolveSearchGeography, extractBusinessPhraseFromQuery } from './geographyService.js';

export interface BusinessSearchResult {
  query: string;
  businessType: string;
  region: {
    name: string;
    center: { lat: number; lng: number };
    bbox: { west: number; south: number; east: number; north: number };
  };
  businesses: BusinessSummary[];
  precisionMode?: boolean;
}

const SEARCH_SYNONYMS: Record<string, string[]> = {
  despachante: ['despachante', 'despachantes', 'documentalista'],
  'agência de marketing': ['marketing', 'publicidade', 'propaganda', 'agencia', 'agência'],
  contabilidade: ['contabilidade', 'contador', 'contabil', 'contábil'],
  imobiliária: ['imobiliaria', 'imobiliária', 'imoveis', 'imóveis'],
  advocacia: ['advocacia', 'advogado', 'advogados'],
  floricultura: ['floricultura', 'flores', 'florist'],
  dentista: ['dentista', 'odontologia', 'odonto', 'dental'],
  restaurante: ['restaurante', 'restaurant'],
  academia: ['academia', 'fitness', 'gym'],
  padaria: ['padaria', 'panificadora', 'bakery'],
  farmácia: ['farmacia', 'farmácia', 'drogaria', 'pharmacy', 'drugstore'],
  'clínica médica': ['clinica', 'clínica', 'consultorio', 'consultório', 'medical clinic'],
  mecânica: ['mecanica', 'mecânica', 'oficina', 'auto repair', 'automotivo'],
};

function normalizeText(value: string): string {
  return normalizeSearchText(value).replace(/\s+/g, ' ').trim();
}

function getSearchTerms(query: string, businessType: string, keywords: string[], profile?: SearchProfile | null): string[] {
  if (profile) {
    return Array.from(new Set([
      ...profile.aliases,
      ...profile.nameTerms,
      businessType,
      ...keywords,
    ].map(normalizeText).filter((value) => value.length >= 3))).slice(0, 12);
  }

  const phrase = extractBusinessPhraseFromQuery(query);
  const normalizedType = normalizeText(businessType);
  const synonymKey = Object.keys(SEARCH_SYNONYMS).find((key) => {
    const normalizedKey = normalizeText(key);
    return normalizedType.includes(normalizedKey) || normalizedKey.includes(normalizedType) || normalizeText(phrase).includes(normalizedKey);
  });

  const values = [phrase, businessType, ...keywords, ...(synonymKey ? SEARCH_SYNONYMS[synonymKey] : [])];
  const stopWords = new Set(['empresa', 'empresas', 'negocio', 'negocios', 'servico', 'servicos', 'buscar', 'busque', 'ache', 'encontre']);

  return Array.from(new Set(
    values
      .flatMap((value) => [value, ...value.split(/\s+/)])
      .map(normalizeText)
      .filter((value) => value.length >= 3 && !stopWords.has(value))
  )).slice(0, 12);
}

function placeToSummary(place: OverturePlace): BusinessSummary {
  return {
    id: place.id,
    name: place.name,
    category: place.category,
    basicCategory: place.basicCategory,
    taxonomyPrimary: place.taxonomyPrimary,
    taxonomyHierarchy: place.taxonomyHierarchy,
    taxonomyAlternates: place.taxonomyAlternates,
    address: place.address,
    lat: place.latitude,
    lng: place.longitude,
    coordinates: { lat: place.latitude, lng: place.longitude },
    website: place.website,
    phone: place.phone || place.phones?.[0] || null,
    phones: place.phones || [],
    emails: place.emails || [],
    socials: place.socials || [],
    confidence: place.confidence,
    leadStatus: 'NOVO',
    notes: '',
    sources: ['overture'],
    hasCoordinates: true,
  };
}

function scorePlace(place: OverturePlace, terms: string[]): number {
  const name = normalizeText(place.name || '');
  const categories = normalizeText([
    place.category,
    place.basicCategory,
    place.taxonomyPrimary,
    ...(place.taxonomyHierarchy || []),
    ...(place.taxonomyAlternates || []),
  ].filter(Boolean).join(' '));

  let score = 0;
  for (const term of terms) {
    if (name === term) score += 12;
    else if (name.includes(term)) score += term.includes(' ') ? 9 : 5;
    if (categories.includes(term)) score += term.includes(' ') ? 6 : 3;
  }
  return score;
}

function scoreSummary(business: BusinessSummary, profile: SearchProfile): number {
  return scoreAgainstProfile({
    name: business.name,
    category: business.category,
    basicCategory: business.basicCategory,
    taxonomyPrimary: business.taxonomyPrimary,
  }, profile);
}

function isWithinBounds(
  business: BusinessSummary,
  bbox: { west: number; south: number; east: number; north: number }
): boolean {
  if (!Number.isFinite(business.lat) || !Number.isFinite(business.lng)) return false;
  return business.lat >= bbox.south && business.lat <= bbox.north && business.lng >= bbox.west && business.lng <= bbox.east;
}

function distanceScore(
  business: BusinessSummary,
  center: { lat: number; lng: number }
): number {
  const latDelta = business.lat - center.lat;
  const lngDelta = (business.lng - center.lng) * Math.cos((center.lat * Math.PI) / 180);
  return Math.sqrt(latDelta * latDelta + lngDelta * lngDelta);
}

async function searchOvertureByTerms(
  terms: string[],
  bbox: { west: number; south: number; east: number; north: number },
  limit = 250
): Promise<OverturePlace[]> {
  const usefulTerms = terms.filter((term) => term.length >= 3).slice(0, 8);
  if (!usefulTerms.length) return [];

  try {
    // Keep the DuckDB/Overture native module in one isolated serverless function.
    // Search receives a broad bbox result and performs the same relevance scoring here.
    const fallback = await queryOvertureViaApi(
      bbox.west,
      bbox.south,
      bbox.east,
      bbox.north,
      Math.min(5000, Math.max(limit * 12, 1200))
    );

    return fallback.places
      .map((place) => ({ place, score: scorePlace(place, usefulTerms) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || (b.place.confidence || 0) - (a.place.confidence || 0))
      .slice(0, limit)
      .map(({ place }) => place);
  } catch (err: any) {
    console.warn('[Business Search] Isolated Overture fallback failed:', err.message);
    return [];
  }
}

function resolveCnaes(businessType: string, keywords: string[]): string[] {
  const text = normalizeText(`${businessType} ${keywords.join(' ')}`);
  if (/despachante|documentalista/.test(text)) return ['8299799'];
  return getCNAEsForBusinessType(businessType, keywords);
}

export async function searchBusinessesByNameInBounds(
  query: string,
  bbox: { west: number; south: number; east: number; north: number },
  currentRegionName = 'Área atual'
): Promise<BusinessSearchResult & { searchMode: 'name' }> {
  const cleanQuery = String(query || '').trim();
  if (!cleanQuery) throw new Error('Consulta de busca vazia.');

  const phrase = extractBusinessPhraseFromQuery(cleanQuery).trim() || cleanQuery;
  const profile = resolveSearchProfile(phrase, cleanQuery);
  const center = {
    lat: (bbox.south + bbox.north) / 2,
    lng: (bbox.west + bbox.east) / 2,
  };

  const normalizedPhrase = normalizeText(phrase);
  const lookupTerms = Array.from(new Map(
    [
      phrase,
      ...(profile ? [profile.label] : []),
    ]
      .map((term) => String(term || '').trim())
      .filter((term) => term.length >= 2)
      .map((term) => [term.toLocaleLowerCase('pt-BR'), term])
  ).values());

  const results = new Map<string, BusinessSummary>();
  const relevance = new Map<string, number>();

  if (hasBrazilPlacesDatabase()) {
    const lookups = await Promise.all(
      lookupTerms.map((term) =>
        queryBrazilPlacesByName(
          term,
          bbox.west,
          bbox.south,
          bbox.east,
          bbox.north,
          300
        ).catch(() => null)
      )
    );

    for (let index = 0; index < lookups.length; index += 1) {
      const lookup = lookups[index];
      if (!lookup) continue;
      const term = lookupTerms[index];
      const normalizedTerm = normalizeText(term);

      for (const place of lookup.places) {
        const summary = placeToSummary(place);
        if (!isWithinBounds(summary, bbox)) continue;

        const normalizedName = normalizeText(place.name || '');
        if (!normalizedName.includes(normalizedTerm)) continue;

        let score = lookup.relevanceById.get(place.id) || 90;
        if (normalizedName === normalizedPhrase) score += 220;
        else if (normalizedName.startsWith(`${normalizedPhrase} `) || normalizedName.startsWith(normalizedPhrase)) score += 180;
        else if (normalizedName.includes(normalizedPhrase)) score += 150;
        else if (normalizedName.startsWith(`${normalizedTerm} `) || normalizedName.startsWith(normalizedTerm)) score += 110;
        else score += 70;

        const previous = relevance.get(place.id) || 0;
        if (!results.has(place.id) || score > previous) {
          results.set(place.id, summary);
          relevance.set(place.id, score);
        }
      }
    }
  }

  // Only if the local index is unavailable do we fall back to Overture name scoring.
  if (results.size === 0) {
    try {
      const overture = await searchOvertureByTerms([normalizedPhrase], bbox, 300);
      for (const place of overture) {
        const normalizedName = normalizeText(place.name || '');
        if (!normalizedName.includes(normalizedPhrase)) continue;
        let score = 90;
        if (normalizedName === normalizedPhrase) score += 220;
        else if (normalizedName.startsWith(normalizedPhrase)) score += 180;
        else score += 150;
        results.set(place.id, placeToSummary(place));
        relevance.set(place.id, score);
      }
    } catch (error: any) {
      console.warn('[Name Search] Overture fallback failed:', error?.message || error);
    }
  }

  const businesses = Array.from(results.values())
    .sort((a, b) => {
      const scoreDiff = (relevance.get(b.id) || 0) - (relevance.get(a.id) || 0);
      if (scoreDiff !== 0) return scoreDiff;
      const confidenceDiff = (b.confidence || 0) - (a.confidence || 0);
      if (confidenceDiff !== 0) return confidenceDiff;
      return distanceScore(a, center) - distanceScore(b, center);
    })
    .slice(0, 300);

  return {
    query: cleanQuery,
    businessType: profile?.label || phrase,
    precisionMode: Boolean(profile),
    searchMode: 'name',
    region: {
      name: currentRegionName,
      center,
      bbox,
    },
    businesses,
  };
}

export async function searchBusinessesInBounds(
  query: string,
  bbox: { west: number; south: number; east: number; north: number },
  currentRegionName = 'Área atual'
): Promise<BusinessSearchResult & { searchMode: 'viewport' }> {
  const cleanQuery = String(query || '').trim();
  if (!cleanQuery) throw new Error('Consulta de busca vazia.');

  const phrase = extractBusinessPhraseFromQuery(cleanQuery).trim() || cleanQuery;
  const profile = resolveSearchProfile(phrase, cleanQuery);
  const center = {
    lat: (bbox.south + bbox.north) / 2,
    lng: (bbox.west + bbox.east) / 2,
  };

  const results = new Map<string, BusinessSummary>();
  const relevance = new Map<string, number>();

  const addPlace = (place: OverturePlace, score: number) => {
    const summary = placeToSummary(place);
    if (!isWithinBounds(summary, bbox)) return;
    const existingScore = relevance.get(place.id) || 0;
    if (!results.has(place.id) || score > existingScore) {
      results.set(place.id, summary);
      relevance.set(place.id, score);
    }
  };

  if (hasBrazilPlacesDatabase()) {
    if (profile) {
      try {
        const precise = await queryBrazilPlacesPrecise(
          profile,
          bbox.west,
          bbox.south,
          bbox.east,
          bbox.north,
          300,
          phrase
        );
        for (const place of precise.places) {
          addPlace(place, precise.relevanceById.get(place.id) || scoreAgainstProfile(place, profile));
        }
      } catch (error: any) {
        console.warn('[Viewport Search] Segment lookup failed:', error?.message || error);
      }
    }

    try {
      const nameTerms = Array.from(new Set(
        (profile
          ? [phrase, profile.label, ...profile.aliases, ...profile.nameTerms]
          : [phrase]
        )
          .map(normalizeText)
          .filter((term) => term.length >= 3)
      )).slice(0, 6);

      const nameLookups = await Promise.all(
        nameTerms.map((term) =>
          queryBrazilPlacesByName(
            term,
            bbox.west,
            bbox.south,
            bbox.east,
            bbox.north,
            profile ? 140 : 220
          ).catch(() => null)
        )
      );

      for (let index = 0; index < nameLookups.length; index += 1) {
        const byName = nameLookups[index];
        if (!byName) continue;

        const normalizedTerm = nameTerms[index];
        for (const place of byName.places) {
          const normalizedName = normalizeText(place.name || '');
          let score = byName.relevanceById.get(place.id) || 90;

          // Generic segment behavior: exact/prefix name matches always rise first.
          // "despachante" -> "Despachante Beltrão", "Despachante São José", etc.
          if (normalizedName === normalizedTerm) score += 90;
          else if (normalizedName.startsWith(`${normalizedTerm} `) || normalizedName.startsWith(normalizedTerm)) score += 70;
          else if (normalizedName.includes(` ${normalizedTerm} `) || normalizedName.includes(normalizedTerm)) score += 30;

          if (profile) {
            const profileScore = scoreAgainstProfile(place, profile);
            score += Math.max(0, profileScore);
          }

          addPlace(place, score);
        }
      }
    } catch (error: any) {
      console.warn('[Viewport Search] Name lookup failed:', error?.message || error);
    }
  }

  // Overture is a network fallback only when the indexed result is sparse.
  if (results.size < 12) {
    const terms = getSearchTerms(cleanQuery, profile?.label || phrase, [], profile);
    try {
      const overture = await searchOvertureByTerms(terms, bbox, 220);
      for (const place of overture) {
        const score = profile ? scoreAgainstProfile(place, profile) : scorePlace(place, terms);
        if (score > 0) addPlace(place, score);
      }
    } catch (error: any) {
      console.warn('[Viewport Search] Overture fallback failed:', error?.message || error);
    }
  }

  const businesses = Array.from(results.values())
    .sort((a, b) => {
      const scoreDiff = (relevance.get(b.id) || 0) - (relevance.get(a.id) || 0);
      if (scoreDiff !== 0) return scoreDiff;
      const confidenceDiff = (b.confidence || 0) - (a.confidence || 0);
      if (confidenceDiff !== 0) return confidenceDiff;
      return distanceScore(a, center) - distanceScore(b, center);
    })
    .slice(0, 300);

  return {
    query: cleanQuery,
    businessType: profile?.label || phrase,
    precisionMode: Boolean(profile),
    searchMode: 'viewport',
    region: {
      name: currentRegionName,
      center,
      bbox,
    },
    businesses,
  };
}

export async function searchBusinesses(query: string, currentRegionName = 'São Paulo - SP'): Promise<BusinessSearchResult> {
  const intent = interpretSearchIntent(query, currentRegionName);
  const phrase = extractBusinessPhraseFromQuery(query);
  const profile = resolveSearchProfile(phrase, intent.businessType, ...(intent.keywords || []));
  const resolvedArea = await resolveSearchGeography(query, currentRegionName);
  const terms = getSearchTerms(query, intent.businessType, intent.keywords || [], profile);

  const results = new Map<string, BusinessSummary>();
  const relevance = new Map<string, number>();

  // Primary path: search only inside the geographic bbox resolved from the user's
  // query. Category precision and geographic precision are intentionally separate.
  if (profile && hasBrazilPlacesDatabase()) {
    try {
      const precise = await queryBrazilPlacesPrecise(
        profile,
        resolvedArea.bbox.west,
        resolvedArea.bbox.south,
        resolvedArea.bbox.east,
        resolvedArea.bbox.north,
        300,
        phrase
      );
      for (const place of precise.places) {
        const summary = placeToSummary(place);
        if (!isWithinBounds(summary, resolvedArea.bbox)) continue;
        results.set(place.id, summary);
        relevance.set(place.id, precise.relevanceById.get(place.id) || scoreSummary(summary, profile));
      }
    } catch (err: any) {
      console.warn('[Business Search] Precise Supabase search failed:', err.message);
    }
  }

  // Unknown segments, areas outside the local index, or sparse precise results use Overture fallback.
  if (!profile || results.size < 12) {
    try {
      const overture = await searchOvertureByTerms(terms, resolvedArea.bbox, 300);
      overture
        .map((place) => ({
          place,
          score: profile ? scoreAgainstProfile(place, profile) : scorePlace(place, terms),
        }))
        .filter(({ place, score }) => score > 0 && isWithinBounds(placeToSummary(place), resolvedArea.bbox))
        .sort((a, b) => b.score - a.score || (b.place.confidence || 0) - (a.place.confidence || 0))
        .forEach(({ place, score }) => {
          if (!results.has(place.id)) results.set(place.id, placeToSummary(place));
          relevance.set(place.id, Math.max(relevance.get(place.id) || 0, score));
        });
    } catch (err: any) {
      console.warn('[Business Search] Overture error:', err.message);
    }
  }

  // External enrichment is only used when the geographically precise result set is sparse.
  if (results.size < 12) {
    try {
      const cnaes = resolveCnaes(profile?.label || intent.businessType, intent.keywords || []);
      const companies = await fetchCompaniesFromMinhaReceita(cnaes, resolvedArea.query);
      for (const company of companies.filter(isCompanyActive).filter((item) => isCNPJInRequestedRegion(item, resolvedArea))) {
        const { business, matchedOvertureId } = processMinhaReceitaBusiness(company, Array.from(results.values()), profile?.label || intent.businessType);
        if (!isWithinBounds(business, resolvedArea.bbox)) continue;
        const score = profile ? scoreSummary(business, profile) : 1;
        if (profile && score <= 0) continue;

        if (matchedOvertureId && results.has(matchedOvertureId)) {
          results.set(matchedOvertureId, { ...results.get(matchedOvertureId)!, ...business, id: matchedOvertureId });
          relevance.set(matchedOvertureId, Math.max(relevance.get(matchedOvertureId) || 0, score));
        } else if (business.id && !results.has(business.id)) {
          results.set(business.id, business);
          relevance.set(business.id, score);
        }
      }
    } catch (err: any) {
      console.warn('[Business Search] CNPJ error:', err.message);
    }

    try {
      const serper = await fetchBusinessesFromSerper(
        `${phrase} em ${resolvedArea.rawName}`,
        resolvedArea.center.lat,
        resolvedArea.center.lng
      );
      for (const business of serper) {
        if (!isWithinBounds(business, resolvedArea.bbox)) continue;
        const score = profile ? scoreSummary(business, profile) : 1;
        if (profile && score <= 0) continue;
        if (!results.has(business.id)) results.set(business.id, business);
        relevance.set(business.id, Math.max(relevance.get(business.id) || 0, score));
      }
    } catch (err: any) {
      console.warn('[Business Search] Serper error:', err.message);
    }
  }

  const getResultScore = (business: BusinessSummary): number => {
    const stored = relevance.get(business.id);
    if (stored !== undefined) return stored;
    return profile ? scoreSummary(business, profile) : 0;
  };

  const businesses = Array.from(results.values())
    .filter((business) => business.hasCoordinates !== false && isWithinBounds(business, resolvedArea.bbox))
    .filter((business) => !profile || scoreSummary(business, profile) > 0)
    .sort((a, b) => {
      const scoreDiff = getResultScore(b) - getResultScore(a);
      if (scoreDiff !== 0) return scoreDiff;
      const confidenceDiff = (b.confidence || 0) - (a.confidence || 0);
      if (confidenceDiff !== 0) return confidenceDiff;
      return distanceScore(a, resolvedArea.center) - distanceScore(b, resolvedArea.center);
    })
    .slice(0, 300);

  return {
    query,
    businessType: profile?.label || intent.businessType,
    precisionMode: Boolean(profile),
    region: {
      name: resolvedArea.rawName,
      center: resolvedArea.center,
      bbox: resolvedArea.bbox,
    },
    businesses,
  };
}
