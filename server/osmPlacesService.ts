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

function elementToPlace(element: OverpassElement): OverturePlace | null {
  const tags = element.tags || {};
  const latitude = Number(element.lat ?? element.center?.lat);
  const longitude = Number(element.lon ?? element.center?.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const name = firstNonEmpty(tags.name, tags.brand, tags.operator);
  if (!name) return null;

  const categoryRaw = normalizeCategory(tags);
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
    taxonomyPrimary: categoryRaw,
    taxonomyHierarchy: [],
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

export async function queryOsmPlacesInBBox(
  west: number,
  south: number,
  east: number,
  north: number,
  limit = 1200,
): Promise<{ places: OverturePlace[]; cached: boolean; durationMs: number }> {
  const startedAt = Date.now();
  const safeLimit = Math.max(1, Math.min(Math.floor(limit), 2000));
  const bbox = `${south},${west},${north},${east}`;
  const query = `[out:json][timeout:12];(
    nwr["name"]["amenity"](${bbox});
    nwr["name"]["shop"](${bbox});
    nwr["name"]["office"](${bbox});
    nwr["name"]["craft"](${bbox});
    nwr["name"]["tourism"](${bbox});
    nwr["name"]["leisure"](${bbox});
    nwr["name"]["healthcare"](${bbox});
    nwr["name"]["industrial"](${bbox});
  );out center tags ${safeLimit};`;

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
        signal: AbortSignal.timeout(14000),
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

      return {
        places,
        cached: false,
        durationMs: Date.now() - startedAt,
      };
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  if (lastError) throw lastError;
  return { places: [], cached: false, durationMs: Date.now() - startedAt };
}
