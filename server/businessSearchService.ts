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

export interface BusinessSearchResult {
  query: string;
  businessType: string;
  region: {
    name: string;
    center: { lat: number; lng: number };
    bbox: { west: number; south: number; east: number; north: number };
  };
  businesses: BusinessSummary[];
}

const SEARCH_SYNONYMS: Record<string, string[]> = {
  despachante: ['despachante', 'documentalista', 'emplacamento', 'licenciamento', 'detran'],
  'agência de marketing': ['marketing', 'publicidade', 'propaganda', 'agencia', 'agência'],
  marketing: ['marketing', 'publicidade', 'propaganda', 'agencia', 'agência'],
  contabilidade: ['contabilidade', 'contador', 'contabil', 'contábil', 'accountant'],
  imobiliaria: ['imobiliaria', 'imobiliária', 'imoveis', 'imóveis', 'real estate'],
  imobiliária: ['imobiliaria', 'imobiliária', 'imoveis', 'imóveis', 'real estate'],
  advocacia: ['advocacia', 'advogado', 'advogados', 'law firm', 'attorney'],
  floricultura: ['floricultura', 'flores', 'florist'],
  dentista: ['dentista', 'odontologia', 'odonto', 'dental'],
  restaurante: ['restaurante', 'restaurant', 'pizzaria', 'lanchonete', 'bistro'],
  academia: ['academia', 'fitness', 'gym', 'crossfit', 'pilates'],
  padaria: ['padaria', 'panificadora', 'bakery', 'confeitaria'],
  farmácia: ['farmacia', 'farmácia', 'drogaria', 'pharmacy', 'drugstore'],
  'clínica médica': ['clinica', 'clínica', 'consultorio', 'consultório', 'medical clinic'],
  mecânica: ['mecanica', 'mecânica', 'oficina', 'auto repair', 'automotivo'],
};

const CITY_ALIASES: Record<string, { cidade: string; uf: string; center: { lat: number; lng: number }; bbox: { west: number; south: number; east: number; north: number } }> = {
  sp: {
    cidade: 'São Paulo',
    uf: 'SP',
    center: { lat: -23.5505, lng: -46.6333 },
    bbox: { west: -46.8260, south: -24.0080, east: -46.3650, north: -23.3560 },
  },
  'sao paulo': {
    cidade: 'São Paulo',
    uf: 'SP',
    center: { lat: -23.5505, lng: -46.6333 },
    bbox: { west: -46.8260, south: -24.0080, east: -46.3650, north: -23.3560 },
  },
  'são paulo': {
    cidade: 'São Paulo',
    uf: 'SP',
    center: { lat: -23.5505, lng: -46.6333 },
    bbox: { west: -46.8260, south: -24.0080, east: -46.3650, north: -23.3560 },
  },
};

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractBusinessPhrase(query: string): string {
  const normalized = query.trim();
  const match = normalized.match(/^(.+?)\s+(?:em|no|na|perto de|perto do|perto da)\s+.+$/i);
  if (match?.[1]) return match[1].trim();
  return normalized;
}

function getSearchTerms(query: string, businessType: string, keywords: string[]): string[] {
  const phrase = extractBusinessPhrase(query);
  const base = [phrase, businessType, ...keywords];
  const synonymKey = Object.keys(SEARCH_SYNONYMS).find((key) => {
    const nKey = normalizeText(key);
    const nType = normalizeText(businessType);
    const nPhrase = normalizeText(phrase);
    return nType.includes(nKey) || nKey.includes(nType) || nPhrase.includes(nKey);
  });
  if (synonymKey) base.push(...SEARCH_SYNONYMS[synonymKey]);

  const stop = new Set(['empresa', 'empresas', 'negocio', 'negocios', 'servico', 'servicos', 'buscar', 'busque', 'ache', 'encontre']);
  const terms = base
    .flatMap((term) => [term, ...term.split(/\s+/)])
    .map(normalizeText)
    .filter((term) => term.length >= 3 && !stop.has(term));

  return Array.from(new Set(terms)).slice(0, 14);
}

function normalizeLocationAlias(query: string, parsed: InterpretedLocation): InterpretedLocation {
  const locationMatch = query.match(/\b(?:em|no|na|perto de|perto do|perto da)\s+(.+)$/i);
  const rawLocation = normalizeText(locationMatch?.[1] || parsed.rawName || '');
  const alias = CITY_ALIASES[rawLocation];
  if (!alias) return parsed;

  return {
    bairro: '',
    cidade: alias.cidade,
    uf: alias.uf,
    pais: 'Brasil',
    query: `${alias.cidade}, ${alias.uf}, Brasil`,
    rawName: `${alias.cidade} - ${alias.uf}`,
    center: alias.center,
    bbox: alias.bbox,
  };
}

function placeToSummary(p: OverturePlace): BusinessSummary {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    basicCategory: p.basicCategory,
    taxonomyPrimary: p.taxonomyPrimary,
    taxonomyHierarchy: p.taxonomyHierarchy,
    taxonomyAlternates: p.taxonomyAlternates,
    address: p.address,
    lat: p.latitude,
    lng: p.longitude,
    coordinates: { lat: p.latitude, lng: p.longitude },
    website: p.website,
    phone: p.phone || p.phones?.[0] || null,
    phones: p.phones || [],
    emails: p.emails || [],
    socials: p.socials || [],
    confidence: p.confidence,
    leadStatus: 'NOVO',
    notes: '',
    sources: ['overture'],
    hasCoordinates: true,
  };
}

function scorePlace(p: OverturePlace, terms: string[]): number {
  const name = normalizeText(p.name || '');
  const category = normalizeText([
    p.category,
    p.basicCategory,
    p.taxonomyPrimary,
    ...(p.taxonomyHierarchy || []),
    ...(p.taxonomyAlternates || []),
  ].filter(Boolean).join(' '));

  let score = 0;
  for (const term of terms) {
    if (!term) continue;
    if (name === term) score += 12;
    else if (name.includes(term)) score += term.includes(' ') ? 9 : 5;
    if (category.includes(term)) score += term.includes(' ') ? 6 : 3;
  }
  return score;
}

async function searchOvertureByTerms(
  terms: string[],
  bbox: { west: number; south: number; east: number; north: number },
  limit = 250
): Promise<OverturePlace[]> {
  const db = await getDuckDB();
  const usefulTerms = terms.filter((t) => t.length >= 3).slice(0, 8);
  if (usefulTerms.length === 0) return [];

  const localConditions = usefulTerms.map(() => `(
    lower(coalesce(name, '')) LIKE ? OR
    lower(coalesce(category, '')) LIKE ? OR
    lower(coalesce(basic_category, '')) LIKE ? OR
    lower(coalesce(taxonomy_primary, '')) LIKE ?
  )`).join(' OR ');
  const localParams = usefulTerms.flatMap((term) => {
    const pattern = `%${term}%`;
    return [pattern, pattern, pattern, pattern];
  });

  const localRows = await new Promise<any[]>((resolve) => {
    const sql = `
      SELECT id, name, latitude, longitude, category, basic_category, taxonomy_primary,
             confidence, operating_status, website, websites, email, emails, phone, phones,
             socials, address, source
      FROM overture_places_cache
      WHERE latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?
        AND (${localConditions})
      LIMIT ?;
    `;
    db.all(sql, bbox.south, bbox.north, bbox.west, bbox.east, ...localParams, limit, (err, rows: any[]) => {
      if (err || !rows) return resolve([]);
      resolve(rows);
    });
  });

  const localPlaces: OverturePlace[] = localRows.map((r) => ({
    id: String(r.id),
    name: r.name || 'Estabelecimento Comercial',
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
    category: r.category || 'Estabelecimento Comercial',
    basicCategory: r.basic_category || undefined,
    taxonomyPrimary: r.taxonomy_primary || undefined,
    confidence: typeof r.confidence === 'number' ? r.confidence : 0.85,
    operatingStatus: r.operating_status || null,
    website: r.website || null,
    websites: [],
    email: r.email || null,
    emails: [],
    phone: r.phone || null,
    phones: [],
    socials: [],
    address: r.address || 'Endereço não identificado',
    source: r.source || 'Overture Maps',
  }));

  if (localPlaces.length >= Math.min(25, limit)) return localPlaces;

  const remoteConditions = usefulTerms.map(() => `(
    lower(coalesce(names.primary, '')) LIKE ? OR
    lower(coalesce(basic_category, '')) LIKE ? OR
    lower(coalesce(categories.primary, '')) LIKE ? OR
    lower(coalesce(taxonomy.primary, '')) LIKE ?
  )`).join(' OR ');
  const remoteParams = usefulTerms.flatMap((term) => {
    const pattern = `%${term}%`;
    return [pattern, pattern, pattern, pattern];
  });

  try {
    const remoteRows = await new Promise<any[]>((resolve, reject) => {
      const sql = `
        SELECT id, names.primary AS name, basic_category, taxonomy, categories, confidence,
               operating_status, websites, socials, emails, phones, addresses, sources,
               ST_X(geometry) AS longitude, ST_Y(geometry) AS latitude
        FROM read_parquet('s3://overturemaps-us-west-2/release/2026-08-19.0/theme=places/type=place/*', filename=false)
        WHERE bbox.xmin >= ? AND bbox.xmax <= ? AND bbox.ymin >= ? AND bbox.ymax <= ?
          AND (${remoteConditions})
        LIMIT ?;
      `;
      db.all(sql, bbox.west, bbox.east, bbox.south, bbox.north, ...remoteParams, limit, (err, rows: any[]) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });

    const remotePlaces = remoteRows.map(normalizeOverturePlace);
    const combined = new Map<string, OverturePlace>();
    for (const p of localPlaces) combined.set(p.id, p);
    for (const p of remotePlaces) combined.set(p.id, p);
    return Array.from(combined.values()).slice(0, limit);
  } catch (err: any) {
    console.warn('[Business Search] Targeted Overture query failed, using bbox fallback:', err.message);
    const fallback = await queryPlacesInBBox(bbox.west, bbox.south, bbox.east, bbox.north, 1200);
    return fallback.places
      .map((p) => ({ p, score: scorePlace(p, usefulTerms) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((item) => item.p);
  }
}

function resolveCnaes(businessType: string, keywords: string[]): string[] {
  if (/despachante|documentalista|emplacamento|licenciamento/i.test(businessType + ' ' + keywords.join(' '))) {
    return ['8299799'];
  }
  return getCNAEsForBusinessType(businessType, keywords);
}

export async function searchBusinesses(query: string, currentRegionName = 'São Paulo - SP'): Promise<BusinessSearchResult> {
  const intent = interpretSearchIntent(query, currentRegionName);
  const parsedLocation = normalizeLocationAlias(query, parseSearchLocation(query));
  const resolvedArea = await resolveGeographicArea(parsedLocation);
  const terms = getSearchTerms(query, intent.businessType, intent.keywords);
  const results = new Map<string, BusinessSummary>();

  try {
    const overture = await searchOvertureByTerms(terms, resolvedArea.bbox, 250);
    overture
      .map((p) => ({ p, score: scorePlace(p, terms) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || (b.p.confidence || 0) - (a.p.confidence || 0))
      .forEach(({ p }) => results.set(p.id, placeToSummary(p)));
  } catch (err: any) {
    console.warn('[Business Search] Overture error:', err.message);
  }

  try {
    const cnaes = resolveCnaes(intent.businessType, intent.keywords);
    const companies = await fetchCompaniesFromMinhaReceita(cnaes, resolvedArea.query);
    for (const company of companies.filter(isCompanyActive).filter((c) => isCNPJInRequestedRegion(c, resolvedArea))) {
      const existing = Array.from(results.values());
      const { business, matchedOvertureId } = processMinhaReceitaBusiness(company, existing, intent.businessType);
      if (matchedOvertureId && results.has(matchedOvertureId)) {
        results.set(matchedOvertureId, { ...results.get(matchedOvertureId)!, ...business, id: matchedOvertureId });
      } else if (business.id && !results.has(business.id)) {
        results.set(business.id, business);
      }
    }
  } catch (err: any) {
    console.warn('[Business Search] CNPJ error:', err.message);
  }

  try {
    const serper = await fetchBusinessesFromSerper(`${extractBusinessPhrase(query)} em ${resolvedArea.cidade}`, resolvedArea.center.lat, resolvedArea.center.lng);
    for (const business of serper) {
      if (!results.has(business.id)) results.set(business.id, business);
    }
  } catch (err: any) {
    console.warn('[Business Search] Serper error:', err.message);
  }

  const businesses = Array.from(results.values())
    .filter((b) => b.hasCoordinates !== false && Number.isFinite(b.lat) && Number.isFinite(b.lng))
    .slice(0, 300);

  return {
    query,
    businessType: intent.businessType,
    region: {
      name: `${resolvedArea.bairro ? resolvedArea.bairro + ', ' : ''}${resolvedArea.cidade} - ${resolvedArea.uf}`,
      center: resolvedArea.center,
      bbox: resolvedArea.bbox,
    },
    businesses,
  };
}
