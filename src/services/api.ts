import { Business, PageSpeedData } from '../types';
import { translateCategory } from '../utils/categories';
import { auth } from '../lib/firebase';

export async function fetchPlacesFromOverture(
  west: number,
  south: number,
  east: number,
  north: number,
  limit: number = 5000,
  signal?: AbortSignal,
  zoom?: number
): Promise<{ places: Business[]; cached: boolean; durationMs: number }> {
  const params = new URLSearchParams({
    west: west.toFixed(6),
    south: south.toFixed(6),
    east: east.toFixed(6),
    north: north.toFixed(6),
    limit: limit.toString(),
  });
  if (zoom !== undefined) {
    params.set('zoom', zoom.toString());
  }

  const res = await fetch(`/api/places-fast?${params.toString()}`, {
    method: 'GET',
    signal,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Erro ao carregar dados do Overture Maps.');
  }

  const data = await res.json();
  const places = (data.places || []).map((p: any) => ({
    ...p,
    category: translateCategory(p.category),
    coordinates: {
      lat: p.latitude,
      lng: p.longitude,
    },
    leadStatus: 'NOVO' as const,
  }));

  return {
    places,
    cached: !!data.cached,
    durationMs: data.durationMs || 0,
  };
}

export async function enrichBusinessData(url: string, force = false) {
  const params = new URLSearchParams({ url });
  if (force) params.set('force', '1');
  const res = await fetch(`/api/enrich?${params.toString()}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Erro ao enriquecer dados.');
  }
  return res.json();
}

export async function fetchTrackingAudit(url: string) {
  const res = await fetch(`/api/tracking-audit?url=${encodeURIComponent(url)}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Erro ao auditar tracking do site.');
  }
  return res.json();
}

export async function checkBusinessSocials(url: string): Promise<{
  hasSocial: boolean;
  socials: string[];
  siteStatus: 'verified' | 'unreachable' | 'unknown';
  checkedAt?: string;
}> {
  const res = await fetch(`/api/social-check?url=${encodeURIComponent(url)}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Erro ao verificar redes sociais.');
  }
  return res.json();
}

async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Usuário não autenticado');

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);

  return fetch(input, { ...init, headers });
}

export interface UserUserData {
  leads: Record<string, { status: any; notes: string }>;
  favorites: Record<string, boolean>;
}

export async function fetchUserLeads(): Promise<UserUserData> {
  try {
    const res = await authenticatedFetch('/api/leads');
    if (!res.ok) return { leads: {}, favorites: {} };
    const data = await res.json();
    return {
      leads: data.leads || {},
      favorites: data.favorites || {},
    };
  } catch (err) {
    console.warn('[API] Error fetching saved user leads:', err);
    return { leads: {}, favorites: {} };
  }
}

export async function saveUserLead(
  businessId: string,
  status?: string,
  notes?: string,
  isFavorite?: boolean,
  business?: Business
) {
  try {
    const body: Record<string, any> = { businessId };
    if (status !== undefined) body.status = status;
    if (notes !== undefined) body.notes = notes;
    if (isFavorite !== undefined) body.isFavorite = isFavorite;
    if (business) body.business = business;

    const res = await authenticatedFetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch (err) {
    console.warn('[API] Error saving user lead:', err);
    return false;
  }
}

export function getGoogleBusinessLink(
  business: Pick<Business, 'name' | 'address' | 'latitude' | 'longitude'>
): string {
  const name = String(business.name || '').trim();
  const address = String(business.address || '').trim();
  const query = [name, address].filter(Boolean).join(' ');
  const fallback = `${business.latitude},${business.longitude}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query || fallback)}`;
}

export function getGoogleRouteLink(
  businesses: Array<Pick<Business, 'name' | 'address' | 'latitude' | 'longitude'>>
): string | null {
  if (businesses.length === 0) return null;
  if (businesses.length === 1) return getGoogleBusinessLink(businesses[0]);

  const coordinate = (business: Pick<Business, 'latitude' | 'longitude'>) =>
    `${business.latitude},${business.longitude}`;

  const destination = coordinate(businesses[businesses.length - 1]);
  const waypoints = businesses.slice(0, -1).map(coordinate).join('|');

  const params = new URLSearchParams({
    api: '1',
    destination,
    travelmode: 'driving',
  });

  if (waypoints) params.set('waypoints', waypoints);

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function getWhatsAppLink(phoneOrUrl?: string | null): string | null {
  if (!phoneOrUrl) return null;
  
  const trimmed = phoneOrUrl.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    if (trimmed.includes('wa.me') || trimmed.includes('whatsapp.com')) {
      return trimmed;
    }
  }

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 8) return null;

  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) {
    return `https://wa.me/55${digits}`;
  }

  if (digits.length >= 10) {
    return `https://wa.me/${digits}`;
  }

  return `https://wa.me/55${digits}`;
}

export function getTrustIcon(confidence?: number): string {
  const val = typeof confidence === 'number' ? confidence : 0.8;
  if (val >= 0.85) return '/high_trust.png';
  if (val >= 0.70) return '/medium_trust.png';
  return '/low_trust.png';
}

export interface AIChatPayload {
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  businesses: Business[];
  currentRegionName?: string;
  searchMode?: 'default' | 'deep';
}

export interface AIChatResult {
  text: string;
  matchedBusinessIds: string[];
  modelUsed?: string;
  newRegion?: {
    name: string;
    center: { lat: number; lng: number };
    businesses?: Business[];
  };
}

export async function sendAIChatMessage(payload: AIChatPayload): Promise<AIChatResult> {
  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: payload.message,
      history: payload.history || [],
      businesses: payload.businesses.slice(0, 80).map((b) => ({
        id: b.id,
        name: b.name,
        category: b.category,
        address: b.address,
        lat: b.coordinates.lat,
        lng: b.coordinates.lng,
        website: b.website,
        phone: b.phone,
        phones: b.phones,
        socials: b.socials,
        leadStatus: b.leadStatus,
        confidence: b.confidence,
      })),
      currentRegionName: payload.currentRegionName,
      searchMode: payload.searchMode || 'default',
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Erro ao comunicar com a IA');
  }

  return res.json();
}

export async function fetchContextualSuggestions(
  recentSearches: string[],
  currentRegionName?: string
): Promise<string[]> {
  try {
    const res = await fetch('/api/ai/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recentSearches, currentRegionName }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.suggestions || [];
  } catch (err) {
    console.warn('[API] Error fetching contextual suggestions:', err);
    return [];
  }
}

export async function fetchPageSpeed(url: string): Promise<PageSpeedData> {
  const res = await fetch(`/api/pagespeed?url=${encodeURIComponent(url)}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Erro ao carregar métricas do PageSpeed.');
  }
  return res.json();
}

export interface GenerateMessageResult {
  message: string;
  source: 'gemini' | 'openrouter' | 'template';
  model?: string;
  variationIndex?: number;
}

export async function generateMessage(
  business: any,
  options?: { variationIndex?: number; previousMessage?: string }
): Promise<GenerateMessageResult> {
  try {
    const res = await fetch('/api/ai/generate-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business,
        variationIndex: options?.variationIndex || 0,
        previousMessage: options?.previousMessage || '',
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Falha ao gerar mensagem com a API');
    }
    const data = await res.json();
    return {
      message: data.message || '',
      source: data.source || 'template',
      model: data.model,
      variationIndex: data.variationIndex,
    };
  } catch (error) {
    console.error('Failed to generate message:', error);
    throw error;
  }
}

export interface RecommendationEventInput {
  eventType:
    | 'search'
    | 'favorite_add'
    | 'favorite_remove'
    | 'pipeline_add'
    | 'pipeline_remove'
    | 'whatsapp_click';
  businessId?: string;
  category?: string;
  query?: string;
  location?: string;
  metadata?: Record<string, unknown>;
}

export async function saveRecommendationEvent(event: RecommendationEventInput) {
  try {
    const res = await authenticatedFetch('/api/recommendation-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
    return res.ok;
  } catch (error) {
    console.warn('[API] Error saving recommendation event:', error);
    return false;
  }
}

export async function fetchRecommendationEvents(): Promise<any[]> {
  try {
    const res = await authenticatedFetch('/api/recommendation-events');
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.events) ? data.events : [];
  } catch (error) {
    console.warn('[API] Error loading recommendation events:', error);
    return [];
  }
}

export async function fetchVisitRoute(): Promise<{ exists: boolean; stops: any[] }> {
  try {
    const res = await authenticatedFetch('/api/routes');
    if (!res.ok) return { exists: false, stops: [] };
    const data = await res.json();
    return {
      exists: Boolean(data.exists),
      stops: Array.isArray(data.stops) ? data.stops : [],
    };
  } catch (error) {
    console.warn('[API] Error loading visit route:', error);
    return { exists: false, stops: [] };
  }
}

export async function saveVisitRoute(stops: any[]) {
  try {
    const res = await authenticatedFetch('/api/routes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stops }),
    });
    return res.ok;
  } catch (error) {
    console.warn('[API] Error saving visit route:', error);
    return false;
  }
}
