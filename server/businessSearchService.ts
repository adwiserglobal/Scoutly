import { getDuckDB, normalizeOverturePlace, queryPlacesInBBox, OverturePlace } from './overtureService.js';
import { parseSearchLocation, interpretSearchIntent, InterpretedLocation } from './searchInterpreter.js';
import { resolveGeographicArea, BusinessSummary } from './aiService.js';
import {
  fetchCompaniesFromMinhaReceita,
  processMinhaReceitaBusiness,
  isCompanyActive,
  isCNPJInRequestedRegion,
  getCNAEsForBusinessType,
} from './cnpjService.js';
import { fetchBusinessesFromSerper } from './serperService.js';
import { hasBrazilPlacesDatabase, queryBrazilPlacesPrecise } from './brazilPlacesService.js';
import { resolveSearchProfile, scoreAgainstProfile, normalizeSearchText, SearchProfile } from './searchProfiles.js';

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

const SAO_PAULO_CITY = {
  cidade: 'São Paulo',
  uf: 'SP',
  center: { lat: -23.5505, lng: -46.6333 },
  bbox: { west: -46.8260, south: -24.0080, east: -46.3650, north: -23.3560 },
};

function normalizeText(value: string): string {
  return normalizeSearchText(value).replace(/\s+/g, ' ').trim();
}

function extractBusinessPhrase(query: string): string {
  const match = query.trim().match(/^(.+?)\s+(?:em|no|na|perto de|perto do|perto da)\s+.+$/i);
  return match?.[1]?.trim() || query.trim();
}

function hasExplicitLocation(query: string): boolean {
  return /\b(?:em|no|na|perto de|perto do|perto da)\s+.+$/i.test(query.trim());
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

  const phrase = extractBusinessPhrase(query);
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

function normalizeLocationAlias(query: string, parsed: InterpretedLocation): InterpretedLocation {
  const locationMatch = query.match(/\b(?:em|no|na|perto de|perto do|perto da)\s+(.+)$/i);
  const rawLocation = normalizeText(locationMatch?.[1] || parsed.rawName || '');

  if (rawLocation === 'sp' || rawLocation === 'sao paulo' || rawLocation === 'sao paulo sp') {
    return {
      bairro: '',
      cidade: SAO_PAULO_CITY.cidade,
      uf: SAO_PAULO_CITY.uf,
      pais: 'Brasil',
      query: 'São Paulo, SP, Brasil',
      rawName: 'São Paulo - SP',
      center: SAO_PAULO_CITY.center,
      bbox: SAO_PAULO_CITY.bbox,
    };
  }

  return parsed;
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

async function searchOvertureByTerms(
  terms: string[],
  bbox: { west: number; south: number; east: number; north: number },
  limit = 250
): Promise<OverturePlace[]> {
  const usefulTerms = terms.filter((term) => term.length >= 3).slice(0, 8);
  if (!usefulTerms.length) return [];

  try {
    const db = await getDuckDB();
    const conditions = usefulTerms.map(() => `(
      lower(coalesce(names.primary, '')) LIKE ? OR
      lower(coalesce(basic_category, '')) LIKE ? OR
      lower(coalesce(categories.primary, '')) LIKE ? OR
      lower(coalesce(taxonomy.primary, '')) LIKE ?
    )`).join(' OR ');
    const termParams = usefulTerms.flatMap((term) => {
      const pattern = `%${term}%`;
      return [pattern, pattern, pattern, pattern];
    });

    const rows = await new Promise<any[]>((resolve, reject) => {
      const sql = `
        SELECT id, names.primary AS name, basic_category, taxonomy, categories, confidence,
               operating_status, websites, socials, emails, phones, addresses, sources,
               ST_X(geometry) AS longitude, ST_Y(geometry) AS latitude
        FROM read_parquet('s3://overturemaps-us-west-2/release/2026-08-19.0/theme=places/type=place/*', filename=false)
        WHERE bbox.xmin >= ? AND bbox.xmax <= ? AND bbox.ymin >= ? AND bbox.ymax <= ?
          AND (${conditions})
        LIMIT ?;
      `;
      db.all(sql, bbox.west, bbox.east, bbox.south, bbox.north, ...termParams, limit, (err, result: any[]) => {
        if (err) return reject(err);
        resolve(result || []);
      });
    });

    return rows.map(normalizeOverturePlace);
  } catch (err: any) {
    console.warn('[Business Search] Targeted Overture query failed, using bbox fallback:', err.message);
    const fallback = await queryPlacesInBBox(bbox.west, bbox.south, bbox.east, bbox.north, 1200);
    return fallback.places
      .map((place) => ({ place, score: scorePlace(place, usefulTerms) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ place }) => place);
  }
}

function resolveCnaes(businessType: string, keywords: string[]): string[] {
  const text = normalizeText(`${businessType} ${keywords.join(' ')}`);
  if (/despachante|documentalista/.test(text)) return ['8299799'];
  return getCNAEsForBusinessType(businessType, keywords);
}

export async function searchBusinesses(query: string, currentRegionName = 'São Paulo - SP'): Promise<BusinessSearchResult> {
  const intent = interpretSearchIntent(query, currentRegionName);
  const profile = resolveSearchProfile(extractBusinessPhrase(query), intent.businessType, ...(intent.keywords || []));

  // If the user did not type a location, search the region currently open on the map.
  const locationSource = hasExplicitLocation(query) ? query : currentRegionName;
  const parsedLocation = normalizeLocationAlias(locationSource, parseSearchLocation(locationSource));
  const resolvedArea = await resolveGeographicArea(parsedLocation);
  const terms = getSearchTerms(query, intent.businessType, intent.keywords || [], profile);

  const results = new Map<string, BusinessSummary>();
  const relevance = new Map<string, number>();

  // Primary path in Grande SP: exact Scoutly taxonomy/category index.
  if (profile && hasBrazilPlacesDatabase()) {
    try {
      const precise = await queryBrazilPlacesPrecise(
        profile,
        resolvedArea.bbox.west,
        resolvedArea.bbox.south,
        resolvedArea.bbox.east,
        resolvedArea.bbox.north,
        300
      );
      for (const place of precise.places) {
        const summary = placeToSummary(place);
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
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score || (b.place.confidence || 0) - (a.place.confidence || 0))
        .forEach(({ place, score }) => {
          if (!results.has(place.id)) results.set(place.id, placeToSummary(place));
          relevance.set(place.id, Math.max(relevance.get(place.id) || 0, score));
        });
    } catch (err: any) {
      console.warn('[Business Search] Overture error:', err.message);
    }
  }

  // External enrichment is only used when the precise local index is sparse.
  if (results.size < 12) {
    try {
      const cnaes = resolveCnaes(profile?.label || intent.businessType, intent.keywords || []);
      const companies = await fetchCompaniesFromMinhaReceita(cnaes, resolvedArea.query);
      for (const company of companies.filter(isCompanyActive).filter((item) => isCNPJInRequestedRegion(item, resolvedArea))) {
        const { business, matchedOvertureId } = processMinhaReceitaBusiness(company, Array.from(results.values()), profile?.label || intent.businessType);
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
        `${extractBusinessPhrase(query)} em ${resolvedArea.cidade}`,
        resolvedArea.center.lat,
        resolvedArea.center.lng
      );
      for (const business of serper) {
        const score = profile ? scoreSummary(business, profile) : 1;
        if (profile && score <= 0) continue;
        if (!results.has(business.id)) results.set(business.id, business);
        relevance.set(business.id, Math.max(relevance.get(business.id) || 0, score));
      }
    } catch (err: any) {
      console.warn('[Business Search] Serper error:', err.message);
    }
  }

  const businesses = Array.from(results.values())
    .filter((business) => business.hasCoordinates !== false && Number.isFinite(business.lat) && Number.isFinite(business.lng))
    .filter((business) => !profile || scoreSummary(business, profile) > 0)
    .sort((a, b) => {
      const scoreDiff = (relevance.get(b.id) || scoreSummary(b, profile!)) - (relevance.get(a.id) || scoreSummary(a, profile!));
      if (scoreDiff !== 0) return scoreDiff;
      return (b.confidence || 0) - (a.confidence || 0);
    })
    .slice(0, 300);

  return {
    query,
    businessType: profile?.label || intent.businessType,
    precisionMode: Boolean(profile),
    region: {
      name: `${resolvedArea.bairro ? resolvedArea.bairro + ', ' : ''}${resolvedArea.cidade} - ${resolvedArea.uf}`,
      center: resolvedArea.center,
      bbox: resolvedArea.bbox,
    },
    businesses,
  };
}
