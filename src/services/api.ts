import { Business, PageSpeedData } from '../types';
import { translateCategory } from '../utils/categories';
import { auth } from '../lib/firebase';

async function readJsonResponse<T = any>(response: Response, fallbackMessage: string): Promise<T> {
  const raw = await response.text();
  if (!raw.trim()) {
    throw new Error(fallbackMessage);
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    const looksLikeHtml = /<\s*!doctype|<\s*html/i.test(raw);
    if (looksLikeHtml) {
      throw new Error('O serviço de dados respondeu de forma inválida. Mantivemos os dados já carregados e tentaremos atualizar novamente.');
    }
    throw new Error(fallbackMessage);
  }
}

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
    headers: { Accept: 'application/json' },
  });

  const data = await readJsonResponse<any>(
    res,
    'Não foi possível atualizar os estabelecimentos desta área.'
  );

  if (!res.ok) {
    throw new Error(data?.error || 'Erro ao carregar dados do Overture Maps.');
  }
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
  const data = await res.json();
  void recordUsage('analyses');
  return data;
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

async function appDataAction(action: string, payload: Record<string, unknown> = {}) {
  return authenticatedFetch('/api/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  });
}

export interface UserUserData {
  leads: Record<string, { status: any; notes: string; business?: Business | null }>;
  favorites: Record<string, boolean>;
  favoriteBusinesses?: Business[];
  settings?: {
    auto_enrich?: boolean;
    results_batch_size?: number;
  };
  recommendationEvents?: any[];
  recentBusinesses?: any[];
  route?: {
    exists: boolean;
    stops: any[];
  };
  subscription?: any;
  usage?: any;
  user?: any;
  workspaceId?: string;
}

export async function fetchUserLeads(): Promise<UserUserData> {
  try {
    const res = await authenticatedFetch('/api/leads');
    if (!res.ok) return { leads: {}, favorites: {} };
    return await readJsonResponse<UserUserData>(res, 'Não foi possível carregar os dados salvos da conta.');
  } catch (err) {
    console.warn('[API] Error fetching saved user data:', err);
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
    if (status !== undefined || notes !== undefined) {
      const res = await appDataAction('save-lead', {
        businessId,
        status: status || 'NOVO',
        notes: notes || '',
        business,
      });
      if (!res.ok) return false;
    }

    if (isFavorite !== undefined) {
      const res = await appDataAction('favorite', {
        businessId,
        isFavorite,
        business,
      });
      if (!res.ok) return false;
    }

    return true;
  } catch (err) {
    console.warn('[API] Error saving user lead:', err);
    return false;
  }
}

export async function searchBusinessesByQuery(query: string, currentRegionName: string) {
  const params = new URLSearchParams({
    q: query,
    currentRegionName,
  });

  const res = await fetch(`/api/search?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  });

  const data = await readJsonResponse<any>(res, 'Não foi possível concluir a busca.');

  if (!res.ok) {
    throw new Error(data?.error || 'Não foi possível concluir a busca.');
  }

  const businesses = Array.isArray(data?.businesses)
    ? data.businesses.map((item: any) => {
        const lat = Number(item.latitude ?? item.lat ?? item.coordinates?.lat);
        const lng = Number(item.longitude ?? item.lng ?? item.coordinates?.lng);

        return {
          ...item,
          latitude: lat,
          longitude: lng,
          coordinates: { lat, lng },
          websites: Array.isArray(item.websites) ? item.websites : item.website ? [item.website] : [],
          email: item.email || item.emails?.[0] || null,
          emails: Array.isArray(item.emails) ? item.emails : item.email ? [item.email] : [],
          phone: item.phone || item.phones?.[0] || null,
          phones: Array.isArray(item.phones) ? item.phones : item.phone ? [item.phone] : [],
          socials: Array.isArray(item.socials) ? item.socials : [],
          operatingStatus: item.operatingStatus || null,
          source: item.source || item.sources?.[0] || 'Scoutly Search',
          leadStatus: item.leadStatus || 'NOVO',
          confidence: typeof item.confidence === 'number' ? item.confidence : 0.8,
          address: item.address || '',
          category: item.category || item.basicCategory || item.taxonomyPrimary || 'Serviços Gerais',
          website: item.website || null,
        };
      })
      .filter((item: any) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
    : [];

  return {
    ...data,
    businesses,
  };
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
  searchSummary?: {
    requestedCount: number;
    availableCount: number;
    matchingCount: number;
    shownCount: number;
    businessType: string;
    regionName: string;
    appliedFilters: string[];
    usedCurrentContext?: boolean;
  };
  suggestedAction?: {
    type: 'add_to_pipeline';
    businessIds: string[];
  };
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

  const data = await readJsonResponse<any>(res, 'A Scoutly AI recebeu uma resposta inválida do servidor.');

  if (!res.ok) {
    throw new Error(data?.error || 'Erro ao comunicar com a IA');
  }

  return data;
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
    const data = await readJsonResponse<any>(res, 'Não foi possível carregar sugestões contextuais.');
    return Array.isArray(data?.suggestions) ? data.suggestions : [];
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
    const result = {
      message: data.message || '',
      source: data.source || 'template',
      model: data.model,
      variationIndex: data.variationIndex,
    };

    if (result.message) {
      void saveGeneratedMessage({
        businessId: business?.id,
        businessName: business?.name,
        message: result.message,
        source: result.source,
        model: result.model,
      });
    }

    return result;
  } catch (error) {
    console.error('Failed to generate message:', error);
    throw error;
  }
}

export async function saveVisitRoute(stops: any[]) {
  try {
    const res = await appDataAction('save-route', { stops });
    return res.ok;
  } catch (error) {
    console.warn('[API] Error saving visit route:', error);
    return false;
  }
}

export async function saveRecommendationEvent(event: {
  eventType: 'search' | 'favorite_add' | 'favorite_remove' | 'pipeline_add' | 'pipeline_remove' | 'whatsapp_click';
  businessId?: string;
  category?: string;
  query?: string;
  location?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const res = await appDataAction('recommendation-event', event);
    return res.ok;
  } catch (error) {
    console.warn('[API] Error saving recommendation event:', error);
    return false;
  }
}

export async function saveUserSettings(settings: {
  autoEnrich?: boolean;
  resultsBatchSize?: number;
}) {
  try {
    const res = await appDataAction('save-settings', settings);
    return res.ok;
  } catch (error) {
    console.warn('[API] Error saving user settings:', error);
    return false;
  }
}

export async function saveUserProfile(displayName: string) {
  try {
    const res = await appDataAction('update-profile', { displayName });
    return res.ok;
  } catch (error) {
    console.warn('[API] Error saving user profile:', error);
    return false;
  }
}

export async function saveRecentBusiness(businessId: string, business?: Business) {
  try {
    const res = await appDataAction('recent-business', { businessId, business });
    return res.ok;
  } catch (error) {
    console.warn('[API] Error saving recent business:', error);
    return false;
  }
}

export async function recordUsage(counter: 'analyses' | 'ai_messages' | 'recommendation_refreshes') {
  try {
    const res = await appDataAction('usage', { counter });
    return res.ok;
  } catch {
    return false;
  }
}

export async function saveGeneratedMessage(data: {
  businessId?: string;
  businessName?: string;
  message: string;
  source?: string;
  model?: string;
}) {
  try {
    const res = await appDataAction('generated-message', data);
    return res.ok;
  } catch (error) {
    console.warn('[API] Error saving generated message:', error);
    return false;
  }
}

export async function createCheckoutSession(plan: 'go' | 'pro' | 'agency') {
  const res = await appDataAction('create-checkout', { plan });
  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data?.url) {
    throw new Error(data?.error || 'Não foi possível abrir o checkout.');
  }

  return {
    id: String(data.id || ''),
    url: String(data.url),
  };
}

export async function confirmCheckoutSession(sessionId: string) {
  const res = await appDataAction('confirm-checkout', { sessionId });
  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data?.subscription) {
    throw new Error(data?.error || 'Não foi possível confirmar sua assinatura.');
  }

  return data.subscription;
}

export async function createBillingPortalSession(plan?: 'go' | 'pro' | 'agency') {
  const res = await appDataAction('create-billing-portal', plan ? { plan } : {});
  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data?.url) {
    throw new Error(data?.error || 'Não foi possível abrir o portal de cobrança.');
  }

  return {
    id: String(data.id || ''),
    url: String(data.url),
  };
}

export async function refreshSubscriptionFromStripe() {
  const res = await appDataAction('refresh-subscription');
  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data?.subscription) {
    throw new Error(data?.error || 'Não foi possível sincronizar sua assinatura.');
  }

  return data.subscription;
}
