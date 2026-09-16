import type { OverturePlace } from './overtureService.js';
import type { SearchProfile } from './searchProfiles.js';

interface SearchResult {
  places: OverturePlace[];
  cached: boolean;
  durationMs: number;
  source: 'supabase' | 'overture';
}

export interface PreciseSearchResult extends SearchResult {
  relevanceById: Map<string, number>;
}

function jsonArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function getServerKey(): string | undefined {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function rowToPlace(row: any): OverturePlace {
  return {
    id: String(row.id),
    name: row.name || 'Estabelecimento Comercial',
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    category: row.category || row.basic_category || row.taxonomy_primary || 'Estabelecimento Comercial',
    basicCategory: row.basic_category || undefined,
    taxonomyPrimary: row.taxonomy_primary || undefined,
    taxonomyHierarchy: [],
    taxonomyAlternates: [],
    confidence: typeof row.confidence === 'number' ? row.confidence : 0.8,
    operatingStatus: row.operating_status || null,
    website: row.website || null,
    websites: jsonArray(row.websites),
    email: row.email || null,
    emails: jsonArray(row.emails),
    phone: row.phone || null,
    phones: jsonArray(row.phones),
    socials: jsonArray(row.socials),
    address: row.address || 'Endereço não identificado',
    source: row.source || 'Overture Maps / Scoutly Brazil Index',
  };
}

export function hasBrazilPlacesDatabase(): boolean {
  return Boolean(process.env.SUPABASE_URL && getServerKey());
}

export async function queryBrazilPlaces(
  west: number,
  south: number,
  east: number,
  north: number,
  limit = 2000
): Promise<SearchResult> {
  const startedAt = Date.now();
  const supabaseUrl = process.env.SUPABASE_URL;
  const serverKey = getServerKey();

  if (!supabaseUrl || !serverKey) {
    throw new Error('Brazil places database is not configured');
  }

  const safeLimit = Math.max(1, Math.min(Math.floor(limit), 5000));
  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/search_scoutly_places`, {
    method: 'POST',
    headers: {
      apikey: serverKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_west: west,
      p_south: south,
      p_east: east,
      p_north: north,
      p_limit: safeLimit,
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Supabase places query failed (${response.status}): ${body.slice(0, 300)}`);
  }

  const rows = await response.json();
  const places: OverturePlace[] = (Array.isArray(rows) ? rows : []).map(rowToPlace);

  return {
    places,
    cached: true,
    durationMs: Date.now() - startedAt,
    source: 'supabase',
  };
}

export async function queryBrazilPlacesPrecise(
  profile: SearchProfile,
  west: number,
  south: number,
  east: number,
  north: number,
  limit = 300
): Promise<PreciseSearchResult> {
  const startedAt = Date.now();
  const supabaseUrl = process.env.SUPABASE_URL;
  const serverKey = getServerKey();

  if (!supabaseUrl || !serverKey) {
    throw new Error('Brazil places database is not configured');
  }

  const safeLimit = Math.max(1, Math.min(Math.floor(limit), 1000));
  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/search_scoutly_places_precise`, {
    method: 'POST',
    headers: {
      apikey: serverKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_west: west,
      p_south: south,
      p_east: east,
      p_north: north,
      p_exact_categories: profile.exactCategories,
      p_exact_taxonomies: profile.exactTaxonomies,
      p_broad_categories: profile.broadCategories,
      p_name_terms: profile.nameTerms,
      p_limit: safeLimit,
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Supabase precise search failed (${response.status}): ${body.slice(0, 300)}`);
  }

  const rows = await response.json();
  const list = Array.isArray(rows) ? rows : [];
  const relevanceById = new Map<string, number>();
  const places = list.map((row: any) => {
    const id = String(row.id);
    relevanceById.set(id, Number(row.relevance) || 0);
    return rowToPlace(row);
  });

  return {
    places,
    relevanceById,
    cached: true,
    durationMs: Date.now() - startedAt,
    source: 'supabase',
  };
}
