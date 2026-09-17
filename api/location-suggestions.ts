import type { VercelRequest, VercelResponse } from '@vercel/node';

type GeoapifyResult = {
  name?: string;
  formatted?: string;
  address_line1?: string;
  address_line2?: string;
  street?: string;
  suburb?: string;
  district?: string;
  city?: string;
  municipality?: string;
  county?: string;
  state?: string;
  state_code?: string;
  country_code?: string;
  result_type?: string;
  lat?: number;
  lon?: number;
  bbox?: {
    lon1?: number;
    lat1?: number;
    lon2?: number;
    lat2?: number;
  };
};

const BLOCKED_RESULT_TYPES = new Set([
  'amenity',
  'building',
  'commercial',
  'catering',
  'healthcare',
  'office',
  'shop',
  'tourism',
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

function buildSuggestion(item: GeoapifyResult, index: number) {
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
    id: `${Number(item.lat).toFixed(6)}:${Number(item.lon).toFixed(6)}:${index}`,
    label: label || item.formatted || primary,
    primary,
    secondary,
    kind: item.result_type || 'local',
    lat: Number(item.lat),
    lng: Number(item.lon),
    bbox: item.bbox && [item.bbox.lon1, item.bbox.lat1, item.bbox.lon2, item.bbox.lat2].every(Number.isFinite)
      ? {
          west: Number(item.bbox.lon1),
          south: Number(item.bbox.lat1),
          east: Number(item.bbox.lon2),
          north: Number(item.bbox.lat2),
        }
      : null,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'Location autocomplete is not configured.', suggestions: [] });
  }

  const rawQuery = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const currentRegionName = typeof req.query.currentRegionName === 'string' ? req.query.currentRegionName.trim() : '';
  const fragment = extractLocationFragment(rawQuery);

  if (fragment.length < 2 || fragment.length > 120) {
    return res.status(200).json({ fragment, suggestions: [] });
  }

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
      signal: AbortSignal.timeout(4500),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.warn('[Location Suggestions] Geoapify error', response.status, body.slice(0, 120));
      return res.status(502).json({ error: 'Falha ao obter sugestões de local.', suggestions: [] });
    }

    const payload = await response.json();
    const rawResults: GeoapifyResult[] = Array.isArray(payload?.results) ? payload.results : [];
    const regionNeedle = normalize(currentRegionName);
    const fragmentNeedle = normalize(fragment);

    const suggestions = rawResults
      .filter((item) => Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lon)))
      .filter((item) => !BLOCKED_RESULT_TYPES.has(item.result_type || ''))
      .map((item, index) => {
        const suggestion = buildSuggestion(item, index);
        const searchable = normalize(`${suggestion.primary} ${suggestion.secondary} ${suggestion.label}`);
        let score = 0;
        if (normalize(suggestion.primary).startsWith(fragmentNeedle)) score += 50;
        else if (searchable.includes(fragmentNeedle)) score += 25;
        if (regionNeedle && searchable.split(' ').some((part) => part.length > 3 && regionNeedle.includes(part))) score += 8;
        if (['suburb', 'district', 'neighbourhood', 'quarter', 'city', 'town', 'village', 'street'].includes(suggestion.kind)) score += 8;
        return { suggestion, score };
      })
      .sort((a, b) => b.score - a.score)
      .map(({ suggestion }) => suggestion)
      .filter((suggestion, index, all) => all.findIndex((candidate) => normalize(candidate.label) === normalize(suggestion.label)) === index)
      .slice(0, 6);

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');
    return res.status(200).json({ fragment, suggestions });
  } catch (error: any) {
    console.warn('[Location Suggestions] Error', error?.message || error);
    return res.status(500).json({ error: 'Erro ao buscar sugestões de local.', suggestions: [] });
  }
}
