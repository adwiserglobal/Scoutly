import { createHmac, timingSafeEqual } from 'node:crypto';
import type { BusinessSummary } from './aiService.js';

export type OmkarTaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'aborted' | 'unknown';

type OmkarTask = {
  id?: number;
  status?: string;
  result?: unknown;
  result_count?: number;
  [key: string]: unknown;
};

function clean(value: unknown, max = 500): string {
  return String(value ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
}

function apiBaseUrl(): string {
  return String(process.env.OMKAR_MAPS_API_URL || '').trim().replace(/\/+$/, '');
}

function apiBasePath(): string {
  const value = String(process.env.OMKAR_MAPS_API_BASE_PATH || '').trim();
  if (!value) return '';
  return `/${value.replace(/^\/+|\/+$/g, '')}`;
}

function apiUrl(path: string): string {
  return `${apiBaseUrl()}${apiBasePath()}/${path.replace(/^\/+/, '')}`;
}

function requestHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  const token = String(process.env.OMKAR_MAPS_BRIDGE_TOKEN || '').trim();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export function hasOmkarMapsAccess(): boolean {
  return Boolean(apiBaseUrl());
}

function interpolateTemplate(value: any, variables: Record<string, string | number>): any {
  if (Array.isArray(value)) return value.map((item) => interpolateTemplate(item, variables));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, interpolateTemplate(item, variables)]));
  }
  if (typeof value !== 'string') return value;

  const exact = value.match(/^\{\{([a-zA-Z0-9_]+)\}\}$/);
  if (exact && Object.prototype.hasOwnProperty.call(variables, exact[1])) return variables[exact[1]];

  return value.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(variables, key) ? String(variables[key]) : ''
  );
}

function buildTaskData(input: {
  query: string;
  regionName: string;
  latitude?: number | null;
  longitude?: number | null;
  maxResults?: number;
}) {
  const maxResults = Math.max(20, Math.min(300, Math.trunc(input.maxResults || 120)));
  const variables = {
    query: input.query,
    region: input.regionName,
    search: [input.query, input.regionName].filter(Boolean).join(' em '),
    lat: Number.isFinite(input.latitude) ? Number(input.latitude) : '',
    lng: Number.isFinite(input.longitude) ? Number(input.longitude) : '',
    maxResults,
  };

  const template = String(process.env.OMKAR_MAPS_INPUT_TEMPLATE_JSON || '').trim();
  if (template) {
    try {
      return interpolateTemplate(JSON.parse(template), variables);
    } catch (error: any) {
      console.warn('[Omkar Maps] Invalid OMKAR_MAPS_INPUT_TEMPLATE_JSON:', error?.message || error);
    }
  }

  // Defaults mirror the Google Maps Extractor UI terminology. If a future app
  // version changes its input ids, paste the JSON shown by the app's
  // "API Integration" page into OMKAR_MAPS_INPUT_TEMPLATE_JSON.
  return {
    queries: [variables.search],
    search_strategy: 'fastest',
    max_results: maxResults,
    convert_to_english: false,
  };
}

async function readJson(response: Response): Promise<any> {
  const raw = await response.text();
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Omkar Maps returned non-JSON data (HTTP ${response.status}).`);
  }
}

export async function startOmkarMapsTask(input: {
  query: string;
  regionName: string;
  latitude?: number | null;
  longitude?: number | null;
  maxResults?: number;
}): Promise<{ taskId: number; status: OmkarTaskStatus }> {
  if (!hasOmkarMapsAccess()) {
    throw Object.assign(new Error('Omkar Maps worker is not configured.'), { code: 'OMKAR_NOT_CONFIGURED', statusCode: 503 });
  }

  const scraperName = clean(process.env.OMKAR_MAPS_SCRAPER_NAME, 180) || undefined;
  const response = await fetch(apiUrl('tasks/create-task-async'), {
    method: 'POST',
    headers: requestHeaders(),
    body: JSON.stringify({
      data: buildTaskData(input),
      scraper_name: scraperName,
      enable_cache: true,
    }),
    signal: AbortSignal.timeout(7000),
  });

  const data = await readJson(response);
  if (!response.ok) {
    throw Object.assign(
      new Error(clean(data?.message || data?.error || `Omkar Maps HTTP ${response.status}`, 320)),
      { code: 'OMKAR_START_FAILED', statusCode: response.status },
    );
  }

  const task = Array.isArray(data) ? data[0] : data;
  const taskId = Number(task?.id);
  if (!Number.isInteger(taskId) || taskId <= 0) {
    throw Object.assign(new Error('Omkar Maps did not return a valid task id.'), { code: 'OMKAR_INVALID_TASK', statusCode: 502 });
  }

  return { taskId, status: normalizeTaskStatus(task?.status) };
}

export async function getOmkarMapsTask(taskId: number): Promise<OmkarTask> {
  const response = await fetch(apiUrl(`tasks/${taskId}`), {
    headers: requestHeaders(),
    signal: AbortSignal.timeout(5000),
  });
  const data = await readJson(response);
  if (!response.ok) {
    throw Object.assign(
      new Error(clean(data?.message || data?.error || `Omkar Maps task HTTP ${response.status}`, 320)),
      { code: 'OMKAR_TASK_FAILED', statusCode: response.status },
    );
  }
  return data as OmkarTask;
}

export async function getOmkarMapsTaskResults(taskId: number, perPage = 300): Promise<any[]> {
  const response = await fetch(apiUrl(`tasks/${taskId}/results`), {
    method: 'POST',
    headers: requestHeaders(),
    body: JSON.stringify({ page: 1, per_page: Math.max(20, Math.min(500, perPage)) }),
    signal: AbortSignal.timeout(9000),
  });
  const data = await readJson(response);
  if (!response.ok) {
    throw Object.assign(
      new Error(clean(data?.message || data?.error || `Omkar Maps result HTTP ${response.status}`, 320)),
      { code: 'OMKAR_RESULTS_FAILED', statusCode: response.status },
    );
  }

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

export function normalizeTaskStatus(value: unknown): OmkarTaskStatus {
  const status = clean(value, 40).toLowerCase();
  if (status === 'pending') return 'pending';
  if (status === 'in_progress' || status === 'in-progress' || status === 'running') return 'in_progress';
  if (status === 'completed' || status === 'complete' || status === 'success') return 'completed';
  if (status === 'failed' || status === 'error') return 'failed';
  if (status === 'aborted' || status === 'cancelled' || status === 'canceled') return 'aborted';
  return 'unknown';
}

function pick(record: any, ...keys: string[]) {
  for (const key of keys) {
    if (record?.[key] !== undefined && record?.[key] !== null && record?.[key] !== '') return record[key];
  }
  return null;
}

function number(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCoordinates(record: any): { lat: number | null; lng: number | null } {
  const coordinates = pick(record, 'COORDINATES', 'coordinates', 'Coordinates');
  if (Array.isArray(coordinates) && coordinates.length >= 2) {
    const first = number(coordinates[0]);
    const second = number(coordinates[1]);
    if (first !== null && second !== null) return { lat: first, lng: second };
  }
  if (coordinates && typeof coordinates === 'object') {
    const lat = number(pick(coordinates, 'lat', 'latitude', 'LATITUDE', 'y'));
    const lng = number(pick(coordinates, 'lng', 'lon', 'longitude', 'LONGITUDE', 'x'));
    if (lat !== null && lng !== null) return { lat, lng };
  }
  if (typeof coordinates === 'string') {
    const matches = coordinates.match(/-?\d+(?:\.\d+)?/g) || [];
    if (matches.length >= 2) return { lat: number(matches[0]), lng: number(matches[1]) };
  }
  return {
    lat: number(pick(record, 'LATITUDE', 'latitude', 'lat')),
    lng: number(pick(record, 'LONGITUDE', 'longitude', 'lng', 'lon')),
  };
}

function arrayOfStrings(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => clean(item, 600)).filter(Boolean);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map((item) => clean(item, 600)).filter(Boolean);
      } catch {
        // fall through
      }
    }
    return trimmed.split(/[;,\n]/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function safeUrl(value: unknown): string | null {
  const raw = clean(value, 800);
  if (!raw) return null;
  try {
    const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function normalizePhone(value: unknown): string | null {
  const raw = clean(value, 80);
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15 ? raw : null;
}

function socialUrls(record: any): string[] {
  const urls = [
    pick(record, 'LINKEDIN', 'linkedin'),
    pick(record, 'TWITTER', 'twitter'),
    pick(record, 'FACEBOOK', 'facebook'),
    pick(record, 'YOUTUBE', 'youtube'),
    pick(record, 'INSTAGRAM', 'instagram'),
    pick(record, 'PINTEREST', 'pinterest'),
    pick(record, 'GITHUB', 'github'),
    pick(record, 'SNAPCHAT', 'snapchat'),
    pick(record, 'TIKTOK', 'tiktok'),
    pick(record, 'WHATSAPP', 'whatsapp'),
  ].flatMap(arrayOfStrings);

  return Array.from(new Set(urls.map(safeUrl).filter((url): url is string => Boolean(url))));
}

function stableId(record: any, name: string, lat: number, lng: number) {
  const providerId = clean(pick(record, 'KGMID', 'kgmid', 'PLACE_ID', 'place_id', 'CID', 'cid'), 240);
  if (providerId) return `omkar_${providerId.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 180)}`;

  const raw = `${name}|${lat.toFixed(6)}|${lng.toFixed(6)}`.toLowerCase();
  let hash = 2166136261;
  for (let index = 0; index < raw.length; index += 1) {
    hash ^= raw.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `omkar_${(hash >>> 0).toString(36)}`;
}

function normalizeComparableText(value?: string | null): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function phoneDigits(value?: string | null): string {
  return String(value || '').replace(/\D/g, '');
}

function host(value?: string | null): string {
  try {
    const raw = String(value || '').trim();
    if (!raw) return '';
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
      .hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return '';
  }
}

function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const earth = 6371000;
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function tokenOverlapScore(a: string, b: string): number {
  const aa = new Set(normalizeComparableText(a).split(' ').filter((part) => part.length >= 2));
  const bb = new Set(normalizeComparableText(b).split(' ').filter((part) => part.length >= 2));
  if (!aa.size || !bb.size) return 0;
  let intersection = 0;
  for (const token of aa) if (bb.has(token)) intersection += 1;
  return intersection / Math.max(aa.size, bb.size);
}

export type OmkarVerificationSeed = {
  businessId?: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type OmkarVerificationResult = {
  matched: boolean;
  confidence: number;
  label: 'confirmed' | 'probable' | 'ambiguous' | 'not_found';
  matchedFields: string[];
  distanceMeters: number | null;
  business: BusinessSummary | null;
};

export function verifyBusinessAgainstOmkar(
  seed: OmkarVerificationSeed,
  candidates: BusinessSummary[],
): OmkarVerificationResult {
  let best: { business: BusinessSummary; score: number; matchedFields: string[]; distanceMeters: number | null } | null = null;

  const seedName = normalizeComparableText(seed.name);
  const seedPhone = phoneDigits(seed.phone);
  const seedHost = host(seed.website);

  for (const business of candidates) {
    const matchedFields: string[] = [];
    let score = 0;

    const exactName = seedName && normalizeComparableText(business.name) === seedName;
    const fuzzyName = tokenOverlapScore(seed.name, business.name);
    if (exactName) {
      score += 0.42;
      matchedFields.push('name');
    } else if (fuzzyName >= 0.8) {
      score += 0.30;
      matchedFields.push('name');
    } else if (fuzzyName >= 0.55) {
      score += 0.18;
    }

    const candidatePhone = phoneDigits(business.phone || business.phones?.[0]);
    if (seedPhone && candidatePhone && seedPhone === candidatePhone) {
      score += 0.30;
      matchedFields.push('phone');
    }

    const candidateHost = host(business.website);
    if (seedHost && candidateHost && seedHost === candidateHost) {
      score += 0.30;
      matchedFields.push('website');
    }

    let distanceMeters: number | null = null;
    if (
      Number.isFinite(Number(seed.latitude)) &&
      Number.isFinite(Number(seed.longitude)) &&
      Number.isFinite(Number(business.lat)) &&
      Number.isFinite(Number(business.lng))
    ) {
      distanceMeters = haversineMeters(
        Number(seed.latitude),
        Number(seed.longitude),
        Number(business.lat),
        Number(business.lng),
      );
      if (distanceMeters <= 80) {
        score += 0.22;
        matchedFields.push('location');
      } else if (distanceMeters <= 250) {
        score += 0.14;
        matchedFields.push('location');
      } else if (distanceMeters <= 800) {
        score += 0.06;
      }
    }

    if (seed.address && business.address) {
      const addressOverlap = tokenOverlapScore(seed.address, business.address);
      if (addressOverlap >= 0.65) {
        score += 0.12;
        matchedFields.push('address');
      } else if (addressOverlap >= 0.4) {
        score += 0.05;
      }
    }

    score = Math.min(1, score);
    if (!best || score > best.score) best = { business, score, matchedFields, distanceMeters };
  }

  if (!best || best.score < 0.38) {
    return {
      matched: false,
      confidence: best?.score || 0,
      label: best ? 'ambiguous' : 'not_found',
      matchedFields: best?.matchedFields || [],
      distanceMeters: best?.distanceMeters ?? null,
      business: null,
    };
  }

  const label: OmkarVerificationResult['label'] =
    best.score >= 0.72 && best.matchedFields.length >= 2
      ? 'confirmed'
      : best.score >= 0.52
        ? 'probable'
        : 'ambiguous';

  return {
    matched: label === 'confirmed' || label === 'probable',
    confidence: Number(best.score.toFixed(2)),
    label,
    matchedFields: best.matchedFields,
    distanceMeters: best.distanceMeters !== null ? Math.round(best.distanceMeters) : null,
    business: label === 'ambiguous' ? null : best.business,
  };
}

export function normalizeOmkarPlaces(records: any[]): BusinessSummary[] {
  const businesses: BusinessSummary[] = [];

  for (const record of Array.isArray(records) ? records : []) {
    const name = clean(pick(record, 'NAME', 'name', 'Name'), 180);
    const { lat, lng } = parseCoordinates(record);
    if (!name || lat === null || lng === null || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const phone = normalizePhone(pick(record, 'PHONE_INTERNATIONAL', 'phone_international', 'PHONE', 'phone'));
    const website = safeUrl(pick(record, 'WEBSITE', 'website'));
    const emails = Array.from(new Set([
      ...arrayOfStrings(pick(record, 'EMAILS', 'emails')),
      ...arrayOfStrings(pick(record, 'EMAIL', 'email')),
    ].map((email) => email.toLowerCase()).filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))));

    const rating = number(pick(record, 'RATING', 'rating', 'Average Rating', 'average_rating'));
    const reviewCount = number(pick(record, 'REVIEWS', 'reviews', 'REVIEW_COUNT', 'review_count', 'Review Count'));
    const googleMapsUrl = safeUrl(pick(record, 'LINK', 'link', 'GOOGLE_MAPS_URL', 'google_maps_url', 'Google Maps URL'));
    const category = clean(pick(record, 'MAIN_CATEGORY', 'main_category', 'category', 'CATEGORY'), 140) || 'Empresa Local';
    const address = clean(pick(record, 'ADDRESS', 'address', 'DETAILED_ADDRESS', 'detailed_address'), 320);
    const socials = socialUrls(record);

    businesses.push({
      id: stableId(record, name, lat, lng),
      name,
      category,
      basicCategory: 'business_service',
      address,
      lat,
      lng,
      coordinates: { lat, lng },
      website,
      phone,
      phones: phone ? [phone] : [],
      emails,
      socials,
      leadStatus: 'NOVO',
      confidence: 0.96,
      notes: [
        'Google Maps via Omkar Maps Extractor',
        rating !== null ? `nota ${rating}` : null,
        reviewCount !== null ? `${reviewCount} avaliações` : null,
      ].filter(Boolean).join(' · '),
      sources: ['omkar_google_maps'],
      hasCoordinates: true,
      googleMapsUrl,
      googlePlaceId: clean(pick(record, 'PLACE_ID', 'place_id'), 240) || null,
      googleKgmid: clean(pick(record, 'KGMID', 'kgmid'), 240) || null,
      rating,
      reviewCount,
      owner: clean(pick(record, 'OWNER', 'owner'), 240) || null,
      canClaim: Boolean(pick(record, 'CAN_CLAIM', 'can_claim')),
      isSpendingOnAds: Boolean(pick(record, 'IS_SPENDING_ON_ADS', 'is_spending_on_ads')),
      featuredImage: safeUrl(pick(record, 'FEATURED_IMAGE', 'featured_image')),
      priceRange: clean(pick(record, 'PRICE_RANGE', 'price_range'), 100) || null,
      googleStatus: clean(pick(record, 'STATUS', 'status'), 120) || null,
    });
  }

  return businesses;
}

function signingSecret(): Buffer {
  const raw = String(
    process.env.SCOUTLY_DATA_SEAL_SECRET ||
    process.env.SCOUTLY_APP_SUPABASE_SECRET_KEY ||
    process.env.SCOUTLY_APP_SUPABASE_SERVICE_ROLE_KEY ||
    '',
  );
  if (!raw) throw Object.assign(new Error('Scoutly signing secret is not configured.'), { statusCode: 503, code: 'DATA_SEAL_SECRET_MISSING' });
  return Buffer.from(raw);
}

export function createOmkarJobToken(
  uid: string,
  taskId: number,
  verificationSeed?: OmkarVerificationSeed | null,
): string {
  const payload = Buffer.from(JSON.stringify({
    uid,
    taskId,
    verificationSeed: verificationSeed || null,
    exp: Date.now() + 20 * 60 * 1000,
  })).toString('base64url');
  const signature = createHmac('sha256', signingSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyOmkarJobToken(
  token: string,
  uid: string,
): { taskId: number; verificationSeed: OmkarVerificationSeed | null } {
  const [payload, signature] = String(token || '').split('.');
  if (!payload || !signature) throw Object.assign(new Error('Invalid Omkar job token.'), { statusCode: 400, code: 'INVALID_OMKAR_JOB' });

  const expected = createHmac('sha256', signingSecret()).update(payload).digest('base64url');
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    throw Object.assign(new Error('Invalid Omkar job signature.'), { statusCode: 400, code: 'INVALID_OMKAR_JOB' });
  }

  let decoded: any;
  try {
    decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    throw Object.assign(new Error('Invalid Omkar job payload.'), { statusCode: 400, code: 'INVALID_OMKAR_JOB' });
  }

  if (decoded?.uid !== uid || Number(decoded?.exp || 0) < Date.now()) {
    throw Object.assign(new Error('Omkar job token expired or does not belong to this user.'), { statusCode: 403, code: 'INVALID_OMKAR_JOB' });
  }

  const taskId = Number(decoded?.taskId);
  if (!Number.isInteger(taskId) || taskId <= 0) {
    throw Object.assign(new Error('Invalid Omkar task id.'), { statusCode: 400, code: 'INVALID_OMKAR_JOB' });
  }
  const rawSeed = decoded?.verificationSeed;
  const verificationSeed: OmkarVerificationSeed | null =
    rawSeed && typeof rawSeed === 'object' && clean(rawSeed.name, 180)
      ? {
          businessId: clean(rawSeed.businessId, 220) || undefined,
          name: clean(rawSeed.name, 180),
          address: clean(rawSeed.address, 320) || null,
          phone: clean(rawSeed.phone, 80) || null,
          website: clean(rawSeed.website, 500) || null,
          latitude: Number.isFinite(Number(rawSeed.latitude)) ? Number(rawSeed.latitude) : null,
          longitude: Number.isFinite(Number(rawSeed.longitude)) ? Number(rawSeed.longitude) : null,
        }
      : null;

  return { taskId, verificationSeed };
}
