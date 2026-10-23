import type { OverturePlace } from './overtureService.js';

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string | undefined>;
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

function firstNonEmpty(...values: Array<string | undefined | null>) {
  return values.find((value) => typeof value === 'string' && value.trim().length > 0)?.trim() || '';
}

function normalizeCategory(tags: Record<string, string | undefined>) {
  return firstNonEmpty(
    tags.amenity,
    tags.shop,
    tags.office,
    tags.craft,
    tags.tourism,
    tags.leisure,
    tags.healthcare,
    tags.industrial,
  ) || 'local_business';
}

function formatAddress(tags: Record<string, string | undefined>) {
  const street = firstNonEmpty(tags['addr:street'], tags['addr:place']);
  const number = firstNonEmpty(tags['addr:housenumber']);
  const district = firstNonEmpty(tags['addr:suburb'], tags['addr:neighbourhood']);
  const city = firstNonEmpty(tags['addr:city'], tags['addr:municipality']);
  const state = firstNonEmpty(tags['addr:state']);
  const postcode = firstNonEmpty(tags['addr:postcode']);
  const line1 = [street, number].filter(Boolean).join(', ');
  return [line1, district, city, state, postcode].filter(Boolean).join(' - ') || 'Endereço não identificado';
}

function splitContact(value?: string) {
  if (!value) return [];
  return value
    .split(/[;,]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

const OSM_TAXONOMY_MAP: Record<string, string> = {
  'amenity:restaurant': 'restaurant',
  'amenity:fast_food': 'fast_food_restaurant',
  'amenity:bank': 'bank',
  'amenity:pharmacy': 'pharmacy',
  'amenity:school': 'school',
  'amenity:parking': 'parking',
  'amenity:clinic': 'medical_clinic',
  'amenity:doctors': 'medical_service',
  'amenity:hospital': 'hospital',
  'amenity:dentist': 'dental_clinic',
  'amenity:fitness_centre': 'gym',
  'shop:supermarket': 'supermarket',
  'shop:hairdresser': 'hair_salon',
  'shop:car_repair': 'auto_repair',
  'shop:car_parts': 'auto_parts_store',
  'shop:tyres': 'tire_shop',
  'shop:optician': 'eyewear_store',
  'shop:pet': 'pet_store',
  'office:lawyer': 'attorney_or_law_firm',
  'office:accountant': 'accountant',
  'office:estate_agent': 'real_estate_agency',
  'office:advertising_agency': 'marketing_agency',
  'craft:mechanic': 'mechanic',
  'healthcare:dentist': 'dental_clinic',
  'healthcare:doctor': 'medical_clinic',
  'healthcare:physiotherapist': 'physiotherapy',
  'healthcare:veterinary': 'veterinarian',
  'tourism:hotel': 'hotel',
  'tourism:guest_house': 'inn',
  'leisure:fitness_centre': 'gym',
};

function inferTaxonomy(tags: Record<string, string | undefined>, categoryRaw: string): string {
  for (const key of ['amenity', 'shop', 'office', 'craft', 'healthcare', 'tourism', 'leisure', 'industrial']) {
    const value = String(tags[key] || '').trim().toLowerCase();
    if (!value) continue;
    const mapped = OSM_TAXONOMY_MAP[`${key}:${value}`];
    if (mapped) return mapped;
  }
  return categoryRaw;
}

function elementToPlace(element: OverpassElement): OverturePlace | null {
  const tags = element.tags || {};
  const latitude = Number(element.lat ?? element.center?.lat);
  const longitude = Number(element.lon ?? element.center?.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const name = firstNonEmpty(tags.name, tags.brand, tags.operator);
  if (!name) return null;

  const categoryRaw = normalizeCategory(tags);
  const taxonomyPrimary = inferTaxonomy(tags, categoryRaw);
  const category = categoryRaw
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

  const websites = splitContact(firstNonEmpty(tags.website, tags['contact:website']));
  const phones = splitContact(firstNonEmpty(tags.phone, tags['contact:phone'], tags.mobile, tags['contact:mobile']));
  const emails = splitContact(firstNonEmpty(tags.email, tags['contact:email']));
  const socials = [
    tags['contact:instagram'],
    tags['contact:facebook'],
    tags['contact:linkedin'],
  ].filter((value): value is string => Boolean(value && value.trim()));

  return {
    id: `osm_${element.type}_${element.id}`,
    name,
    latitude,
    longitude,
    category,
    basicCategory: categoryRaw,
    taxonomyPrimary,
    taxonomyHierarchy: Array.from(new Set([taxonomyPrimary, categoryRaw])),
    taxonomyAlternates: [],
    confidence: 0.78,
    operatingStatus: null,
    website: websites[0] || null,
    websites,
    email: emails[0] || null,
    emails,
    phone: phones[0] || null,
    phones,
    socials,
    address: formatAddress(tags),
    source: 'OpenStreetMap',
    openStatus: 'DESCONHECIDO',
    openStatusText: 'Horário não identificado',
    openingHoursRaw: tags.opening_hours || null,
  };
}

type OsmCacheEntry = {
  places: OverturePlace[];
  savedAt: number;
};

const OSM_CACHE_TTL_MS = 5 * 60 * 1000;
const OSM_EMPTY_CACHE_TTL_MS = 45 * 1000;
const OSM_CACHE_MAX_ENTRIES = 80;
const osmCache = new Map<string, OsmCacheEntry>();
const osmInflight = new Map<string, Promise<OverturePlace[]>>();

function roundedBbox(west: number, south: number, east: number, north: number) {
  // Query a slightly rounded outward box so adjacent searches can reuse data
  // without returning points outside the user's exact viewport.
  return {
    west: Math.floor(west * 1000) / 1000,
    south: Math.floor(south * 1000) / 1000,
    east: Math.ceil(east * 1000) / 1000,
    north: Math.ceil(north * 1000) / 1000,
  };
}

function filterToBbox(places: OverturePlace[], west: number, south: number, east: number, north: number) {
  return places.filter((place) =>
    Number.isFinite(place.latitude) &&
    Number.isFinite(place.longitude) &&
    place.latitude >= south && place.latitude <= north &&
    place.longitude >= west && place.longitude <= east
  );
}

async function fetchOsmBox(
  west: number,
  south: number,
  east: number,
  north: number,
  safeLimit: number,
  timeoutMs: number,
): Promise<OverturePlace[]> {
  const bbox = `${south},${west},${north},${east}`;
  const query = `[out:json][timeout:8];(
    nwr["name"]["amenity"](${bbox});
    nwr["name"]["shop"](${bbox});
    nwr["name"]["office"](${bbox});
    nwr["name"]["craft"](${bbox});
    nwr["name"]["tourism"](${bbox});
    nwr["name"]["leisure"](${bbox});
    nwr["name"]["healthcare"](${bbox});
    nwr["name"]["industrial"](${bbox});
  );out center ${safeLimit};`;

  let lastError: Error | null = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'User-Agent': 'Scoutly-Local-Prospecting/2.0',
        },
        body: new URLSearchParams({ data: query }).toString(),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        lastError = new Error(`Overpass HTTP ${response.status}`);
        continue;
      }

      const payload = await response.json();
      const elements: OverpassElement[] = Array.isArray(payload?.elements) ? payload.elements : [];
      const places: OverturePlace[] = [];
      const seen = new Set<string>();

      for (const element of elements) {
        const place = elementToPlace(element);
        if (!place || seen.has(place.id)) continue;
        seen.add(place.id);
        places.push(place);
        if (places.length >= safeLimit) break;
      }
      return places;
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  if (lastError) throw lastError;
  return [];
}

export async function queryOsmPlacesInBBox(
  west: number,
  south: number,
  east: number,
  north: number,
  limit = 1200,
  timeoutMs = 9000,
): Promise<{ places: OverturePlace[]; cached: boolean; durationMs: number }> {
  const startedAt = Date.now();
  const safeLimit = Math.max(1, Math.min(Math.floor(limit), 2000));
  const box = roundedBbox(west, south, east, north);
  const key = [box.west, box.south, box.east, box.north, safeLimit].join(':');

  const filterCached = (places: OverturePlace[]) =>
    filterToBbox(places, west, south, east, north).slice(0, safeLimit);

  const entry = osmCache.get(key);
  if (entry && Date.now() - entry.savedAt < (entry.places.length ? OSM_CACHE_TTL_MS : OSM_EMPTY_CACHE_TTL_MS)) {
    return {
      places: filterCached(entry.places),
      cached: true,
      durationMs: Date.now() - startedAt,
    };
  }

  let pending = osmInflight.get(key);
  if (!pending) {
    pending = fetchOsmBox(box.west, box.south, box.east, box.north, safeLimit, timeoutMs);
    osmInflight.set(key, pending);
  }

  try {
    const places = await pending;
    osmCache.set(key, { places, savedAt: Date.now() });
    while (osmCache.size > OSM_CACHE_MAX_ENTRIES) {
      osmCache.delete(osmCache.keys().next().value as string);
    }
    return {
      places: filterCached(places),
      cached: false,
      durationMs: Date.now() - startedAt,
    };
  } catch (error: any) {
    if (error instanceof Error) throw error;
    throw new Error(String(error));
  } finally {
    if (osmInflight.get(key) === pending) osmInflight.delete(key);
  }
}
