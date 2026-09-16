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

async function postRpc(rpcName: string, body: Record<string, unknown>, timeoutMs = 7500): Promise<any[]> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serverKey = getServerKey();
  if (!supabaseUrl || !serverKey) throw new Error('Brazil places database is not configured');

  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/${rpcName}`, {
    method: 'POST',
    headers: {
      apikey: serverKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => '');
    throw new Error(`Supabase ${rpcName} failed (${response.status}): ${responseBody.slice(0, 300)}`);
  }

  const rows = await response.json();
  return Array.isArray(rows) ? rows : [];
}

export async function queryBrazilPlaces(
  west: number,
  south: number,
  east: number,
  north: number,
  limit = 2000
): Promise<SearchResult> {
  const startedAt = Date.now();
  const safeLimit = Math.max(1, Math.min(Math.floor(limit), 5000));

  const rows = await postRpc('search_scoutly_places', {
    p_west: west,
    p_south: south,
    p_east: east,
    p_north: north,
    p_limit: safeLimit,
  }, 8000);

  return {
    places: rows.map(rowToPlace),
    cached: true,
    durationMs: Date.now() - startedAt,
    source: 'supabase',
  };
}

/**
 * High precision local search.
 *
 * 1. Exact Overture categories/taxonomies use compact btree indexes.
 * 2. Segments whose source taxonomy is inconsistent use a tiny curated
 *    `scoutly_place_segments` index (e.g. despachante).
 * 3. No table-wide LIKE scan is executed during a user request.
 */
export async function queryBrazilPlacesPrecise(
  profile: SearchProfile,
  west: number,
  south: number,
  east: number,
  north: number,
  limit = 300,
  _preferredNameTerm?: string
): Promise<PreciseSearchResult> {
  const startedAt = Date.now();
  const safeLimit = Math.max(1, Math.min(Math.floor(limit), 1000));
  const rowsById = new Map<string, any>();
  const relevanceById = new Map<string, number>();

  const hasExactRules = profile.exactCategories.length > 0 || profile.exactTaxonomies.length > 0;

  if (hasExactRules) {
    const exactRows = await postRpc('search_scoutly_places_precise', {
      p_west: west,
      p_south: south,
      p_east: east,
      p_north: north,
      p_exact_categories: profile.exactCategories,
      p_exact_taxonomies: profile.exactTaxonomies,
      p_broad_categories: [],
      p_name_terms: [],
      p_limit: safeLimit,
    });

    for (const row of exactRows) {
      const id = String(row.id);
      rowsById.set(id, row);
      relevanceById.set(id, Number(row.relevance) || 110);
    }

    const enoughExact = Math.min(40, safeLimit);
    if (rowsById.size >= enoughExact) {
      return {
        places: Array.from(rowsById.values()).slice(0, safeLimit).map(rowToPlace),
        relevanceById,
        cached: true,
        durationMs: Date.now() - startedAt,
        source: 'supabase',
      };
    }
  }

  // Curated segments are intentionally tiny. This gives name-driven concepts
  // like "despachante" the precision of manual classification with indexed speed.
  if (rowsById.size < safeLimit) {
    const segmentRows = await postRpc('search_scoutly_places_segment', {
      p_segment: profile.id,
      p_west: west,
      p_south: south,
      p_east: east,
      p_north: north,
      p_limit: safeLimit,
    });

    for (const row of segmentRows) {
      const id = String(row.id);
      if (!rowsById.has(id)) rowsById.set(id, row);
      relevanceById.set(id, Math.max(relevanceById.get(id) || 0, Number(row.relevance) || 100));
      if (rowsById.size >= safeLimit) break;
    }
  }

  const orderedRows = Array.from(rowsById.values())
    .sort((a, b) => {
      const scoreDiff = (relevanceById.get(String(b.id)) || 0) - (relevanceById.get(String(a.id)) || 0);
      if (scoreDiff !== 0) return scoreDiff;
      return (Number(b.confidence) || 0) - (Number(a.confidence) || 0);
    })
    .slice(0, safeLimit);

  return {
    places: orderedRows.map(rowToPlace),
    relevanceById,
    cached: true,
    durationMs: Date.now() - startedAt,
    source: 'supabase',
  };
}
