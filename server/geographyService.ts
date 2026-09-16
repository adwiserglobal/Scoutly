import { normalizeSearchText } from './searchProfiles.js';

export interface ResolvedSearchGeography {
  bairro: string;
  cidade: string;
  uf: string;
  pais: string;
  query: string;
  rawName: string;
  center: { lat: number; lng: number };
  bbox: { west: number; south: number; east: number; north: number };
}

type RegionContext = {
  bairro?: string;
  cidade: string;
  uf: string;
};

type NominatimResult = {
  lat: string;
  lon: string;
  display_name: string;
  boundingbox?: [string, string, string, string];
  type?: string;
  addresstype?: string;
  address?: Record<string, string>;
};

const FALLBACK: ResolvedSearchGeography = {
  bairro: '',
  cidade: 'São Paulo',
  uf: 'SP',
  pais: 'Brasil',
  query: 'São Paulo, SP, Brasil',
  rawName: 'São Paulo - SP',
  center: { lat: -23.5505, lng: -46.6333 },
  bbox: { west: -46.8260, south: -24.0080, east: -46.3650, north: -23.3560 },
};

const CITY_UF: Record<string, string> = {
  'sao paulo': 'SP',
  'rio de janeiro': 'RJ',
  'belo horizonte': 'MG',
  'curitiba': 'PR',
  'porto alegre': 'RS',
  'florianopolis': 'SC',
  'brasilia': 'DF',
  'salvador': 'BA',
  'recife': 'PE',
  'fortaleza': 'CE',
  'goiania': 'GO',
  'campinas': 'SP',
};

const UF_CODES = new Set([
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
]);

const memoryCache = new Map<string, ResolvedSearchGeography>();

function normalize(value: string): string {
  return normalizeSearchText(value || '').replace(/\s+/g, ' ').trim();
}

function titleCase(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((part) => part.length <= 2 ? part.toLowerCase() : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export function extractExplicitLocationPhrase(query: string): string | null {
  const text = query.trim();
  const patterns = [
    /\b(?:perto\s+de|perto\s+do|perto\s+da|pr[oó]ximo\s+de|pr[oó]ximo\s+do|pr[oó]ximo\s+da)\s+(.+)$/i,
    /\b(?:na\s+regi[ãa]o\s+de|na\s+regi[ãa]o\s+do|na\s+regi[ãa]o\s+da|regi[ãa]o\s+de|regi[ãa]o\s+do|regi[ãa]o\s+da)\s+(.+)$/i,
    /\b(?:em|no|na|nos|nas)\s+(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim().replace(/[.!?;]+$/, '').trim();
    }
  }
  return null;
}

export function extractBusinessPhraseFromQuery(query: string): string {
  const location = extractExplicitLocationPhrase(query);
  if (!location) return query.trim();
  const index = normalize(query).lastIndexOf(normalize(location));
  if (index <= 0) {
    return query
      .replace(/\b(?:perto\s+de|perto\s+do|perto\s+da|pr[oó]ximo\s+de|pr[oó]ximo\s+do|pr[oó]ximo\s+da|na\s+regi[ãa]o\s+d[eoao]?|regi[ãa]o\s+d[eoao]?|em|no|na|nos|nas)\s+.+$/i, '')
      .trim();
  }
  return query
    .replace(/\b(?:perto\s+de|perto\s+do|perto\s+da|pr[oó]ximo\s+de|pr[oó]ximo\s+do|pr[oó]ximo\s+da|na\s+regi[ãa]o\s+d[eoao]?|regi[ãa]o\s+d[eoao]?|em|no|na|nos|nas)\s+.+$/i, '')
    .trim();
}

function parseRegionContext(currentRegionName: string): RegionContext {
  const value = (currentRegionName || '').trim();
  if (!value) return { cidade: 'São Paulo', uf: 'SP' };

  const commaState = value.match(/^(.+?),\s*(.+?)\s*-\s*([A-Z]{2})$/i);
  if (commaState) {
    return {
      bairro: commaState[1].trim(),
      cidade: commaState[2].trim(),
      uf: commaState[3].toUpperCase(),
    };
  }

  const cityState = value.match(/^(.+?)\s*-\s*([A-Z]{2})$/i);
  if (cityState && UF_CODES.has(cityState[2].toUpperCase())) {
    return { cidade: cityState[1].trim(), uf: cityState[2].toUpperCase() };
  }

  const cityArea = value.match(/^(.+?)\s*-\s*(.+)$/);
  if (cityArea) {
    const city = cityArea[1].trim();
    return {
      bairro: cityArea[2].trim(),
      cidade: city,
      uf: CITY_UF[normalize(city)] || 'SP',
    };
  }

  const normalized = normalize(value);
  return {
    cidade: value,
    uf: CITY_UF[normalized] || 'SP',
  };
}

function normalizeAliases(raw: string, context: RegionContext): { raw: string; query: string; bairro?: string; cidade?: string; uf?: string } {
  const n = normalize(raw);

  if (n === 'sp' || n === 'sao paulo' || n === 'cidade de sao paulo') {
    return { raw: 'São Paulo', query: 'São Paulo, SP, Brasil', cidade: 'São Paulo', uf: 'SP' };
  }
  if (n === 'rj' || n === 'rio de janeiro' || n === 'cidade do rio de janeiro') {
    return { raw: 'Rio de Janeiro', query: 'Rio de Janeiro, RJ, Brasil', cidade: 'Rio de Janeiro', uf: 'RJ' };
  }

  if (/^centro(?:\s+de)?\s+(?:sp|sao paulo)(?:\s+sp)?$/.test(n)) {
    return {
      raw: 'Centro de São Paulo',
      query: 'Centro, São Paulo, SP, Brasil',
      bairro: 'Centro',
      cidade: 'São Paulo',
      uf: 'SP',
    };
  }

  if (n === 'centro' && normalize(context.cidade) === 'sao paulo') {
    return {
      raw: 'Centro de São Paulo',
      query: 'Centro, São Paulo, SP, Brasil',
      bairro: 'Centro',
      cidade: 'São Paulo',
      uf: 'SP',
    };
  }

  const explicitUf = raw.match(/^(.*?)(?:,|\s+-\s+|\s+)([A-Za-z]{2})$/);
  if (explicitUf && UF_CODES.has(explicitUf[2].toUpperCase())) {
    const name = explicitUf[1].trim();
    const uf = explicitUf[2].toUpperCase();
    return { raw, query: `${name}, ${uf}, Brasil`, cidade: name, uf };
  }

  if (raw.includes(',')) {
    return { raw, query: `${raw}, Brasil` };
  }

  return {
    raw,
    query: `${raw}, ${context.cidade}, ${context.uf}, Brasil`,
    bairro: raw,
    cidade: context.cidade,
    uf: context.uf,
  };
}

function bboxFromResult(result: NominatimResult): { west: number; south: number; east: number; north: number } {
  const lat = Number(result.lat);
  const lng = Number(result.lon);
  const bb = result.boundingbox;
  if (Array.isArray(bb) && bb.length === 4) {
    let south = Number(bb[0]);
    let north = Number(bb[1]);
    let west = Number(bb[2]);
    let east = Number(bb[3]);

    if ([south, north, west, east].every(Number.isFinite)) {
      const minLatSpan = 0.010;
      const minLngSpan = 0.012;
      if (north - south < minLatSpan) {
        const mid = (north + south) / 2;
        south = mid - minLatSpan / 2;
        north = mid + minLatSpan / 2;
      }
      if (east - west < minLngSpan) {
        const mid = (east + west) / 2;
        west = mid - minLngSpan / 2;
        east = mid + minLngSpan / 2;
      }
      return { west, south, east, north };
    }
  }

  return {
    west: lng - 0.015,
    south: lat - 0.015,
    east: lng + 0.015,
    north: lat + 0.015,
  };
}

function getAddressPart(address: Record<string, string> | undefined, keys: string[]): string {
  if (!address) return '';
  for (const key of keys) {
    if (address[key]) return address[key];
  }
  return '';
}

function scoreNominatimResult(result: NominatimResult, rawLocation: string, context: RegionContext): number {
  const target = normalize(rawLocation);
  const display = normalize(result.display_name || '');
  const city = normalize(getAddressPart(result.address, ['city', 'town', 'municipality', 'village']));
  const stateCode = (result.address?.['ISO3166-2-lvl4'] || '').split('-').pop()?.toUpperCase() || '';

  let score = 0;
  if (display.startsWith(target)) score += 40;
  else if (display.includes(target)) score += 25;
  if (city && city === normalize(context.cidade)) score += 12;
  if (stateCode && stateCode === context.uf) score += 10;
  if (['suburb', 'neighbourhood', 'quarter', 'city_district'].includes(result.addresstype || '')) score += 8;
  if (['city', 'town', 'municipality'].includes(result.addresstype || '')) score += 6;
  return score;
}

async function geocode(query: string, rawLocation: string, context: RegionContext): Promise<NominatimResult | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=br&limit=5&q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Scoutly-Local-Search/1.0',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    return data
      .filter((item: NominatimResult) => Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lon)))
      .sort((a: NominatimResult, b: NominatimResult) => scoreNominatimResult(b, rawLocation, context) - scoreNominatimResult(a, rawLocation, context))[0] || null;
  } catch {
    return null;
  }
}

function resultToGeography(result: NominatimResult, fallback: ReturnType<typeof normalizeAliases>): ResolvedSearchGeography {
  const address = result.address || {};
  const bairro = getAddressPart(address, ['suburb', 'neighbourhood', 'quarter', 'city_district']) || fallback.bairro || '';
  const cidade = getAddressPart(address, ['city', 'town', 'municipality', 'village']) || fallback.cidade || 'São Paulo';
  const isoState = (address['ISO3166-2-lvl4'] || '').split('-').pop()?.toUpperCase();
  const uf = isoState && UF_CODES.has(isoState) ? isoState : (fallback.uf || CITY_UF[normalize(cidade)] || 'SP');
  const center = { lat: Number(result.lat), lng: Number(result.lon) };

  return {
    bairro,
    cidade,
    uf,
    pais: 'Brasil',
    query: `${bairro ? `${bairro}, ` : ''}${cidade}, ${uf}, Brasil`,
    rawName: bairro ? `${bairro}, ${cidade} - ${uf}` : `${cidade} - ${uf}`,
    center,
    bbox: bboxFromResult(result),
  };
}

export async function resolveSearchGeography(query: string, currentRegionName = 'São Paulo - SP'): Promise<ResolvedSearchGeography> {
  const context = parseRegionContext(currentRegionName);
  const explicitLocation = extractExplicitLocationPhrase(query);
  const rawLocation = (explicitLocation || currentRegionName || 'São Paulo - SP').trim();
  const cacheKey = `${normalize(rawLocation)}|${normalize(context.cidade)}|${context.uf}`;
  const cached = memoryCache.get(cacheKey);
  if (cached) return cached;

  const alias = normalizeAliases(rawLocation, context);

  // Special case for Centro de São Paulo. Nominatim's administrative "Centro"
  // can be much smaller than what users mean in lead prospecting, so use the
  // practical central search window.
  if (normalize(alias.raw) === 'centro de sao paulo') {
    const result: ResolvedSearchGeography = {
      bairro: 'Centro',
      cidade: 'São Paulo',
      uf: 'SP',
      pais: 'Brasil',
      query: 'Centro, São Paulo, SP, Brasil',
      rawName: 'Centro, São Paulo - SP',
      center: { lat: -23.5489, lng: -46.6388 },
      bbox: { west: -46.6638, south: -23.5739, east: -46.6138, north: -23.5239 },
    };
    memoryCache.set(cacheKey, result);
    return result;
  }

  const queries = [alias.query];
  // For a plain location term, also try it at state level. This lets names such
  // as "Santo André", "Osasco" and "Campinas" resolve as municipalities even
  // while the current map is centered on São Paulo city.
  if (explicitLocation && !/[,-]\s*[A-Za-z]{2}\b/.test(rawLocation)) {
    queries.push(`${rawLocation}, ${context.uf}, Brasil`);
  }

  let best: NominatimResult | null = null;
  let bestScore = -Infinity;
  for (const geocodeQuery of Array.from(new Set(queries))) {
    const candidate = await geocode(geocodeQuery, rawLocation, context);
    if (!candidate) continue;
    const score = scoreNominatimResult(candidate, rawLocation, context);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  if (best) {
    const resolved = resultToGeography(best, alias);
    memoryCache.set(cacheKey, resolved);
    if (memoryCache.size > 500) memoryCache.delete(memoryCache.keys().next().value);
    return resolved;
  }

  // If geocoding fails, keep the current region rather than silently widening
  // the search to all of São Paulo.
  if (normalize(currentRegionName) !== normalize(rawLocation)) {
    const contextual = await resolveSearchGeography(currentRegionName, currentRegionName);
    return contextual;
  }

  return FALLBACK;
}
