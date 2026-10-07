import type { BusinessSummary } from './aiService.js';

type RankFabrikPlace = {
  id?: string;
  placeId?: string;
  place_id?: string;
  name?: string;
  title?: string;
  category?: string;
  type?: string;
  address?: string;
  latitude?: number | string;
  longitude?: number | string;
  lat?: number | string;
  lng?: number | string;
  lon?: number | string;
  phone?: string | null;
  website?: string | null;
  email?: string | null;
  emails?: string[];
  rating?: number | string | null;
  reviewsCount?: number | null;
};

type RankFabrikResponse = {
  count?: number;
  places?: RankFabrikPlace[];
  etablissements?: RankFabrikPlace[];
  results?: RankFabrikPlace[];
  completude?: Record<string, number>;
  completeness?: Record<string, number>;
  mesures?: Record<string, unknown>;
  truncated?: boolean;
};

function envKey() {
  return String(process.env.RANKFABRIK_PLACES_KEY || process.env.RANKFABRIK_API_KEY || '').trim();
}

export function hasRankFabrikPlacesAccess() {
  return Boolean(envKey());
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clean(value: unknown, max = 300) {
  return String(value || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
}

function stableId(place: RankFabrikPlace) {
  const raw = clean(
    place.id ||
    place.placeId ||
    place.place_id ||
    [place.name || place.title, place.latitude || place.lat, place.longitude || place.lng || place.lon].join('|'),
    500
  ).toLowerCase();

  let hash = 2166136261;
  for (let index = 0; index < raw.length; index += 1) {
    hash ^= raw.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `rankfabrik_${(hash >>> 0).toString(36)}`;
}

function responsePlaces(data: RankFabrikResponse): RankFabrikPlace[] {
  if (Array.isArray(data?.places)) return data.places;
  if (Array.isArray(data?.etablissements)) return data.etablissements;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function toBusiness(place: RankFabrikPlace, fallbackLat: number, fallbackLng: number): BusinessSummary | null {
  const name = clean(place.name || place.title, 180);
  if (!name) return null;

  const lat = number(place.latitude ?? place.lat) ?? fallbackLat;
  const lng = number(place.longitude ?? place.lng ?? place.lon) ?? fallbackLng;
  const phone = clean(place.phone, 60) || null;
  const website = clean(place.website, 400) || null;
  const emails = Array.from(new Set(
    [
      ...(Array.isArray(place.emails) ? place.emails : []),
      place.email || '',
    ].map((value) => clean(value, 240).toLowerCase()).filter((value) => value.includes('@'))
  ));

  const rating = number(place.rating);
  return {
    id: stableId(place),
    name,
    category: clean(place.category || place.type, 120) || 'Empresa Local',
    basicCategory: 'business_service',
    address: clean(place.address, 300),
    lat,
    lng,
    coordinates: { lat, lng },
    website,
    phone,
    phones: phone ? [phone] : [],
    emails,
    socials: [],
    leadStatus: 'NOVO',
    confidence: 0.9,
    notes: [
      'Encontrado via RankFabrik Places',
      rating !== null ? `nota ${rating}` : null,
    ].filter(Boolean).join(' · '),
    sources: ['rankfabrik'],
    hasCoordinates: Number.isFinite(lat) && Number.isFinite(lng),
  };
}

export async function fetchBusinessesFromRankFabrik(
  term: string,
  latitude: number,
  longitude: number,
  limit = 20,
): Promise<{ businesses: BusinessSummary[]; completeness: Record<string, number>; remainingUnits: string | null }> {
  const key = envKey();
  if (!key) return { businesses: [], completeness: {}, remainingUnits: null };

  const base = String(process.env.RANKFABRIK_PLACES_URL || 'https://places.rankfabrik.com').replace(/\/+$/, '');
  const url = new URL(`${base}/rechercher`);
  url.searchParams.set('terme', clean(term, 180));
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set('combien', String(Math.max(1, Math.min(20, Math.trunc(limit || 20)))));

  try {
    const response = await fetch(url, {
      headers: {
        'X-Cle-API': key,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(6500),
    });

    if (response.status === 429) {
      console.warn('[RankFabrik] Monthly Places quota exhausted.');
      return { businesses: [], completeness: {}, remainingUnits: '0' };
    }
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.warn(`[RankFabrik] Places HTTP ${response.status}: ${body.slice(0, 220)}`);
      return { businesses: [], completeness: {}, remainingUnits: response.headers.get('x-unites-restantes') };
    }

    const data = await response.json() as RankFabrikResponse;
    const businesses = responsePlaces(data)
      .map((place) => toBusiness(place, latitude, longitude))
      .filter((business): business is BusinessSummary => Boolean(business));

    return {
      businesses,
      completeness: data.completude || data.completeness || {},
      remainingUnits: response.headers.get('x-unites-restantes'),
    };
  } catch (error: any) {
    console.warn('[RankFabrik] Places request failed:', error?.message || error);
    return { businesses: [], completeness: {}, remainingUnits: null };
  }
}
