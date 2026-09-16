import type { OverturePlace } from './overtureService.js';
import type { SearchProfile } from './searchProfiles.js';
import { scoreAgainstProfile } from './searchProfiles.js';

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

async function callPreciseRpc(
  west: number,
  south: number,
  east: number,
  north: number,
  exactCategories: string[],
  exactTaxonomies: string[],
  limit: number
): Promise<any[]> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serverKey = getServerKey();
  if (!supabaseUrl || !serverKey) throw new Error('Brazil places database is not configured');

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
      p_exact_categories: exactCategories,
      p_exact_taxonomies: exactTaxonomies,
      p_broad_categories: [],
      p_name_terms: [],
      p_limit: limit,
    }),
    signal: AbortSignal.timeout(7500),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Supabase precise search failed (${response.status}): ${body.slice(0, 300)}`);
  }

  const rows = await response.json();
  return Array.isArray(rows) ? rows : [];
}

async function callNameFallbackRpc(
  west: number,
  south: number,
  east: number,
  north: number,
  nameTerm: string,
  limit: number
): Promise<any[]> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serverKey = getServerKey();
  if (!supabaseUrl || !serverKey) throw new Error('Brazil places database is not configured');

  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/search_scoutly_places_name_precise`, {
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
      p_name_term: nameTerm,
      p_limit: limit,
    }),
    signal: AbortSignal.timeout(7500),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Supabase name fallback failed (${response.status}): ${body.slice(0, 300)}`);
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

/**
 * High precision local search.
 *
 * Pass 1 is category/taxonomy-only so Postgres can use the existing compact
 * btree indexes. A name-only fallback is used only when exact taxonomy is
 * sparse or unavailable, such as "despachante" in the Overture dataset.
 */
export async function queryBrazilPlacesPrecise(
  profile: SearchProfile,
  west: number,
  south: number,
  east: number,
  north: number,
  limit = 300,
  preferredNameTerm?: string
): Promise<PreciseSearchResult> {
  const startedAt = Date.now();
  const safeLimit = Math.max(1, Math.min(Math.floor(limit), 1000));
  const rowsById = new Map<string, any>();
  const relevanceById = new Map<string, number>();

  const hasExactRules = profile.exactCategories.length > 0 || profile.exactTaxonomies.length > 0;

  if (hasExactRules) {
    const exactRows = await callPreciseRpc(
      west,
      south,
      east,
      north,
      profile.exactCategories,
      profile.exactTaxonomies,
      safeLimit
    );

    for (const row of exactRows) {
      const id = String(row.id);
      rowsById.set(id, row);
      relevanceById.set(id, Number(row.relevance) || 110);
    }

    // Common categories such as banks, hospitals, pharmacies and dentists are
    // reliable enough to stop here. This avoids a table-wide text scan.
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

  // Use one strong canonical term for the slow path. Multiple LIKE terms made
  // Postgres repeat work across the full table. The canonical term is usually
  // the broadest reliable synonym, e.g. "despachante".
  const canonicalTerm = profile.nameTerms[0]?.trim() || preferredNameTerm?.trim() || '';

  if (canonicalTerm.length >= 3 && rowsById.size < safeLimit) {
    const fallbackRows = await callNameFallbackRpc(
      west,
      south,
      east,
      north,
      canonicalTerm,
      Math.min(750, safeLimit + 200)
    );

    for (const row of fallbackRows) {
      const place = rowToPlace(row);
      // Apply category guard in Node after the lean name query. That keeps the
      // SQL path simple while preserving high precision.
      const score = scoreAgainstProfile(place, profile);
      if (score <= 0) continue;
      const id = String(row.id);
      if (!rowsById.has(id)) rowsById.set(id, row);
      relevanceById.set(id, Math.max(relevanceById.get(id) || 0, score));
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
