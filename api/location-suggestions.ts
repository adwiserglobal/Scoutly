import type { VercelRequest, VercelResponse } from '@vercel/node';

type Suggestion = {
  id: string;
  label: string;
  primary: string;
  secondary: string;
  kind: string;
  lat: number;
  lng: number;
  bbox?: { west: number; south: number; east: number; north: number } | null;
};

type GeoapifyResult = {
  name?: string;
  formatted?: string;
  address_line1?: string;
  street?: string;
  suburb?: string;
  district?: string;
  city?: string;
  municipality?: string;
  county?: string;
  state?: string;
  state_code?: string;
  result_type?: string;
  lat?: number;
  lon?: number;
  bbox?: { lon1?: number; lat1?: number; lon2?: number; lat2?: number };
};

type NominatimResult = {
  place_id?: number | string;
  lat?: string;
  lon?: string;
  display_name?: string;
  name?: string;
  type?: string;
  addresstype?: string;
  boundingbox?: string[];
  address?: Record<string, string>;
};

const BLOCKED_RESULT_TYPES = new Set([
  'amenity', 'building', 'commercial', 'catering', 'healthcare', 'office', 'shop', 'tourism',
]);

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractLocationFragment(input: string): string {
  const patterns = [
    /\b(?:perto\s+de|perto\s+do|perto\s+da|pr[oó]ximo\s+de|pr[oó]ximo\s+do|pr[oó]ximo\s+da)\s+(.+)$/i,
    /\b(?:na\s+regi[ãa]o\s+de|na\s+regi[ãa]o\s+do|na\s+regi[ãa]o\s+da|regi[ãa]o\s+de|regi[ãa]o\s+do|regi[ãa]o\s+da)\s+(.+)$/i,
    /\b(?:em|no|na|nos|nas)\s+(.+)$/i,
  ];
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return input.trim();
}

function uniqueParts(parts: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const part of parts) {
    const value = part?.trim();
    if (!value) continue;
    const key = normalize(value);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(value);
  }
  return output;
}

function buildGeoapifySuggestion(item: GeoapifyResult, index: number): Suggestion | null {
  const lat = Number(item.lat);
  const lng = Number(item.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (BLOCKED_RESULT_TYPES.has(item.result_type || '')) return null;

  const primary = item.name || item.address_line1 || item.street || item.suburb || item.district || item.city || item.municipality || item.county || item.state || item.formatted || 'Local';
  const locality = item.city || item.municipality || item.county;
  const state = item.state_code || item.state;
  const label = uniqueParts([primary, locality, state]).join(', ');
  const secondary = uniqueParts([
    item.suburb && normalize(item.suburb) !== normalize(primary) ? item.suburb : undefined,
    locality && normalize(locality) !== normalize(primary) ? locality : undefined,
    state,
  ]).join(', ');

  return {
    id: `geo:${lat.toFixed(6)}:${lng.toFixed(6)}:${index}`,
    label: label || item.formatted || primary,
    primary,
    secondary,
    kind: item.result_type || 'local',
    lat,
    lng,
    bbox: item.bbox && [item.bbox.lon1, item.bbox.lat1, item.bbox.lon2, item.bbox.lat2].every(Number.isFinite)
      ? { west: Number(item.bbox.lon1), south: Number(item.bbox.lat1), east: Number(item.bbox.lon2), north: Number(item.bbox.lat2) }
      : null,
  };
}

function buildNominatimSuggestion(item: NominatimResult, index: number): Suggestion | null {
  const lat = Number(item.lat);
  const lng = Number(item.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const address = item.address || {};
  const kind = item.addresstype || item.type || 'local';
  if (BLOCKED_RESULT_TYPES.has(kind)) return null;

  const city = address.city || address.town || address.municipality || address.village || address.county;
  const state = address.state_code || address.state;
  const primary = item.name || address.city || address.town || address.municipality || address.suburb || address.neighbourhood || String(item.display_name || '').split(',')[0] || 'Local';
  const label = uniqueParts([primary, city && normalize(city) !== normalize(primary) ? city : undefined, state]).join(', ');
  const secondary = uniqueParts([
    address.suburb && normalize(address.suburb) !== normalize(primary) ? address.suburb : undefined,
    city && normalize(city) !== normalize(primary) ? city : undefined,
    state,
  ]).join(', ');

  const bb = Array.isArray(item.boundingbox) ? item.boundingbox.map(Number) : [];
  return {
    id: `osm:${item.place_id || index}:${lat.toFixed(6)}:${lng.toFixed(6)}`,
    label: label || item.display_name || primary,
    primary,
    secondary,
    kind,
    lat,
    lng,
    bbox: bb.length === 4 && bb.every(Number.isFinite)
      ? { south: bb[0], north: bb[1], west: bb[2], east: bb[3] }
      : null,
  };
}

function scoreSuggestion(suggestion: Suggestion, fragment: string, currentRegionName: string): number {
  const needle = normalize(fragment);
  const regionNeedle = normalize(currentRegionName);
  const primary = normalize(suggestion.primary);
  const searchable = normalize(`${suggestion.primary} ${suggestion.secondary} ${suggestion.label}`);
  let score = 0;

  if (primary === needle) score += 100;
  else if (primary.startsWith(needle)) score += 60;
  else if (searchable.includes(needle)) score += 30;

  if (['city', 'town', 'municipality'].includes(suggestion.kind)) score += 20;
  else if (['suburb', 'district', 'neighbourhood', 'quarter', 'village', 'street', 'county'].includes(suggestion.kind)) score += 8;

  // Current map context is only a weak tie-breaker. It must never overpower an
  // explicit city typed by the user (e.g. Presidente Prudente while viewing SP).
  if (regionNeedle && searchable.split(' ').some((part) => part.length > 4 && regionNeedle.includes(part))) score += 2;
  return score;
}

async function fetchGeoapify(fragment: string): Promise<Suggestion[]> {
  const apiKey = process.env.GEOAPIFY_API_KEY?.trim();
  if (!apiKey) return [];

  try {
    const params = new URLSearchParams({
      text: fragment,
      format: 'json',
      filter: 'countrycode:br',
      lang: 'pt',
      limit: '8',
      apiKey,
    });
    const response = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?${params.toString()}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return [];
    const payload = await response.json();
    const rows: GeoapifyResult[] = Array.isArray(payload) ? payload : Array.isArray(payload?.results) ? payload.results : [];
    return rows.map(buildGeoapifySuggestion).filter((item): item is Suggestion => Boolean(item));
  } catch (error: any) {
    console.warn('[Location Suggestions] Geoapify fallback:', error?.message || error);
    return [];
  }
}

async function fetchNominatim(fragment: string): Promise<Suggestion[]> {
  try {
    const params = new URLSearchParams({
      format: 'jsonv2',
      addressdetails: '1',
      namedetails: '1',
      countrycodes: 'br',
      limit: '8',
      q: fragment,
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'User-Agent': 'Scoutly-Location-Resolver/2.0 (scoutly.pro)',
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return [];
    const rows: NominatimResult[] = await response.json();
    return (Array.isArray(rows) ? rows : [])
      .map(buildNominatimSuggestion)
      .filter((item): item is Suggestion => Boolean(item));
  } catch (error: any) {
    console.warn('[Location Suggestions] Nominatim fallback:', error?.message || error);
    return [];
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const rawQuery = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const currentRegionName = typeof req.query.currentRegionName === 'string' ? req.query.currentRegionName.trim() : '';
  const fragment = extractLocationFragment(rawQuery);

  if (fragment.length < 2 || fragment.length > 120) {
    return res.status(200).json({ fragment, suggestions: [] });
  }

  try {
    const geoapify = await fetchGeoapify(fragment);
    const nominatim = geoapify.length >= 5 ? [] : await fetchNominatim(fragment);
    const combined = [...geoapify, ...nominatim];

    const suggestions = combined
      .map((suggestion) => ({ suggestion, score: scoreSuggestion(suggestion, fragment, currentRegionName) }))
      .sort((a, b) => b.score - a.score)
      .map(({ suggestion }) => suggestion)
      .filter((suggestion, index, all) =>
        all.findIndex((candidate) =>
          normalize(candidate.label) === normalize(suggestion.label) ||
          (Math.abs(candidate.lat - suggestion.lat) < 0.0005 && Math.abs(candidate.lng - suggestion.lng) < 0.0005)
        ) === index
      )
      .slice(0, 6);

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');
    return res.status(200).json({ fragment, suggestions });
  } catch (error: any) {
    console.warn('[Location Suggestions] Error', error?.message || error);
    return res.status(500).json({ error: 'Erro ao buscar sugestões de local.', suggestions: [] });
  }
}
