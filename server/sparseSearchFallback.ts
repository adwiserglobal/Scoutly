import type { BusinessSummary } from './aiService.js';
import { normalizeSearchText, resolveSearchProfile, type SearchProfile } from './searchProfiles.js';
import { fetchBusinessesFromSerper } from './serperService.js';

interface SearchRegion {
  name: string;
  center: { lat: number; lng: number };
  bbox: { west: number; south: number; east: number; north: number };
}

function getServerKey(): string | undefined {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function withinBounds(
  business: Pick<BusinessSummary, 'lat' | 'lng'>,
  bbox: SearchRegion['bbox']
): boolean {
  return (
    Number.isFinite(business.lat) &&
    Number.isFinite(business.lng) &&
    business.lat >= bbox.south &&
    business.lat <= bbox.north &&
    business.lng >= bbox.west &&
    business.lng <= bbox.east
  );
}

function rowToBusiness(row: any): BusinessSummary {
  const lat = Number(row.latitude);
  const lng = Number(row.longitude);
  const phone = row.phone || null;
  const phones = Array.isArray(row.phones) ? row.phones.map(String).filter(Boolean) : phone ? [phone] : [];
  const emails = Array.isArray(row.emails) ? row.emails.map(String).filter(Boolean) : row.email ? [String(row.email)] : [];
  const socials = Array.isArray(row.socials) ? row.socials.map(String).filter(Boolean) : [];

  return {
    id: String(row.id),
    name: row.name || 'Estabelecimento Comercial',
    category: row.category || row.basic_category || row.taxonomy_primary || 'Empresa Local',
    basicCategory: row.basic_category || undefined,
    taxonomyPrimary: row.taxonomy_primary || undefined,
    address: row.address || 'Endereço não identificado',
    lat,
    lng,
    coordinates: { lat, lng },
    website: row.website || null,
    phone,
    phones,
    emails,
    socials,
    confidence: typeof row.confidence === 'number' ? row.confidence : 0.8,
    leadStatus: 'NOVO',
    notes: '',
    sources: ['scoutly-index'],
    hasCoordinates: true,
  };
}

function distinctiveTerms(profile: SearchProfile): string[] {
  if (profile.id === 'despachante') {
    return ['despachante', 'documentalista', 'despachante veicular', 'documentacao veicular'];
  }

  const generic = new Set(['empresa', 'servico', 'servicos', 'loja', 'negocio']);
  return Array.from(
    new Set(
      [...profile.aliases, ...profile.nameTerms]
        .map(normalizeSearchText)
        .filter((term) => term.length >= 4 && !generic.has(term))
    )
  ).slice(0, 4);
}

function strongNameMatch(business: BusinessSummary, profile: SearchProfile): boolean {
  const name = normalizeSearchText(business.name || '');
  const category = normalizeSearchText(`${business.category || ''} ${business.basicCategory || ''} ${business.taxonomyPrimary || ''}`);
  const terms = distinctiveTerms(profile);

  return terms.some((term) => name.includes(term) || category.includes(term));
}

async function searchSupabaseByName(
  term: string,
  region: SearchRegion,
  limit: number
): Promise<BusinessSummary[]> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serverKey = getServerKey();
  if (!supabaseUrl || !serverKey) return [];

  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/search_scoutly_places_name_precise`, {
    method: 'POST',
    headers: {
      apikey: serverKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_west: region.bbox.west,
      p_south: region.bbox.south,
      p_east: region.bbox.east,
      p_north: region.bbox.north,
      p_name_term: term,
      p_limit: Math.max(1, Math.min(limit, 100)),
    }),
    signal: AbortSignal.timeout(4500),
  });

  if (!response.ok) return [];
  const rows = await response.json();
  if (!Array.isArray(rows)) return [];

  return rows
    .map(rowToBusiness)
    .filter((business) => withinBounds(business, region.bbox));
}

export async function findSparseSearchFallback(params: {
  query: string;
  businessType: string;
  region: SearchRegion;
  existingIds?: Iterable<string>;
  limit?: number;
}): Promise<BusinessSummary[]> {
  const { query, businessType, region } = params;
  const profile = resolveSearchProfile(query, businessType);
  if (!profile) return [];

  const limit = Math.max(1, Math.min(params.limit || 40, 80));
  const seen = new Set<string>(params.existingIds || []);
  const found: BusinessSummary[] = [];

  for (const term of distinctiveTerms(profile)) {
    try {
      const localMatches = await searchSupabaseByName(term, region, limit);
      for (const business of localMatches) {
        if (seen.has(business.id) || !strongNameMatch(business, profile)) continue;
        seen.add(business.id);
        found.push(business);
        if (found.length >= limit) return found;
      }
      if (found.length >= 12) break;
    } catch (err: any) {
      console.warn(`[Sparse Search] Supabase name fallback failed for "${term}":`, err?.message || err);
    }
  }

  // Google Places is the last sparse-result fallback. The standard search already
  // tries Serper, but strict taxonomy scoring can reject niche Brazilian segments
  // such as despachantes even when the business name is an exact match.
  if (found.length < 8) {
    try {
      const serper = await fetchBusinessesFromSerper(
        `${profile.label} em ${region.name}`,
        region.center.lat,
        region.center.lng
      );

      for (const business of serper) {
        if (seen.has(business.id)) continue;
        if (business.hasCoordinates === false || !withinBounds(business, region.bbox)) continue;
        if (!strongNameMatch(business, profile)) continue;
        seen.add(business.id);
        found.push(business);
        if (found.length >= limit) break;
      }
    } catch (err: any) {
      console.warn('[Sparse Search] Serper fallback failed:', err?.message || err);
    }
  }

  return found;
}
