import { Business, PageSpeedData } from '../types';
import { translateCategory } from '../utils/categories';
import { auth } from '../lib/firebase';

async function readJsonResponse<T = any>(response: Response, fallbackMessage: string): Promise<T> {
  const raw = await response.text();
  if (!raw.trim()) throw new Error(fallbackMessage);
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
  if (zoom !== undefined) params.set('zoom', zoom.toString());

  const res = await fetch(`/api/places-fast?${params.toString()}`, {
    method: 'GET',
    signal,
    headers: { Accept: 'application/json' },
  });
  const data = await readJsonResponse<any>(res, 'Não foi possível atualizar os estabelecimentos desta área.');
  if (!res.ok) throw new Error(data?.error || 'Erro ao carregar dados do Overture Maps.');

  const places = (data.places || []).map((p: any) => ({
    ...p,
    category: translateCategory(p.category),
    coordinates: { lat: p.latitude, lng: p.longitude },
    leadStatus: 'NOVO' as const,
  }));

  return { places, cached: !!data.cached, durationMs: data.durationMs || 0 };
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

export interface CreditAccessStatus {
  plan: 'free' | 'go' | 'pro' | 'agency';
  isFree: boolean;
  isUnlimited: boolean;
  remaining: number | null;
  dailyRemaining: number | null;
  dailyLimit: number | null;
  monthlyRemaining: number | null;
  monthlyLimit: number | null;
  monthlyUsed: number;
  dailyUsed: number;
  resetsAt: string | null;
  monthlyResetsAt: string | null;
  aiDailyLimit: number | null;
  aiDailyUsed: number;
  aiDailyRemaining: number | null;
  recommendationsAllowed: boolean;
  aiAllowed: boolean;
}

export interface UserUserData {
  leads: Record<string, { status: any; notes: string; business?: Business | null }>;
  favorites: Record<string, boolean>;
  favoriteBusinesses?: Business[];
  settings?: { auto_enrich?: boolean; results_batch_size?: number };
  recommendationEvents?: any[];
  recentBusinesses?: any[];
  route?: { exists: boolean; stops: any[] };
  subscription?: any;
  usage?: any;
  access?: CreditAccessStatus;
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

export async function fetchAccessStatus(): Promise<CreditAccessStatus> {
  const res = await authenticatedFetch('/api/leads?view=access', { headers: { Accept: 'application/json' } });
  const data = await readJsonResponse<any>(res, 'Não foi possível carregar seus créditos.');
  if (!res.ok || !data?.access) throw new Error(data?.error || 'Não foi possível carregar seus créditos.');
  return data.access as CreditAccessStatus;
}

export async function unlockBusinessContact(business: any): Promise<{ business: any; access: CreditAccessStatus }> {
  const res = await appDataAction('unlock-business', {
    businessId: business?.id,
    sealedContactToken: business?.sealedContactToken,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error: any = new Error(data?.error || 'Não foi possível liberar os dados deste negócio.');
    error.code = data?.code;
    error.status = res.status;
    error.access = data?.access || null;
    throw error;
  }
  return { business: data.business, access: data.access };
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
      const res = await appDataAction('save-lead', { businessId, status: status || 'NOVO', notes: notes || '', business });
      if (!res.ok) return false;
    }
    if (isFavorite !== undefined) {
      const res = await appDataAction('favorite', { businessId, isFavorite, business });
      if (!res.ok) return false;
    }
    return true;
  } catch (err) {
    console.warn('[API] Error saving user lead:', err);
    return false;
  }
}

export async function searchBusinessesByQuery(query: string, currentRegionName: string) {
  const params = new URLSearchParams({ q: query, currentRegionName });
  const res = await fetch(`/api/search?${params.toString()}`, { headers: { Accept: 'application/json' } });
  const data = await readJsonResponse<any>(res, 'Não foi possível concluir a busca.');
  if (!res.ok) throw new Error(data?.error || 'Não foi possível concluir a busca.');

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
      }).filter((item: any) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
    : [];
  return { ...data, businesses };
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
  const coordinate = (business: Pick<Business, 'latitude' | 'longitude'>) => `${business.latitude},${business.longitude}`;
  const destination = coordinate(businesses[businesses.length - 1]);
  const waypoints = businesses.slice(0, -1).map(coordinate).join('|');
  const params = new URLSearchParams({ api: '1', destination, travelmode: 'driving' });
  if (waypoints) params.set('waypoints', waypoints);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function getWhatsAppLink(phoneOrUrl?: string | null): string | null {
  if (!phoneOrUrl) return null;
  const trimmed = phoneOrUrl.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    if (trimmed.includes('wa.me') || trimmed.includes('whatsapp.com')) return trimmed;
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 10) return null;
  return `https://wa.me/${digits}`;
}

export async function saveVisitRoute(stops: Array<{ business: Business; visitStatus: string; addedAt: number }>) {
  const res = await appDataAction('save-route', { stops });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || 'Não foi possível salvar a rota.');
  }
  return true;
}

export async function recordRecommendationEvent(payload: {
  eventType: string;
  businessId?: string | null;
  category?: string | null;
  query?: string | null;
  location?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    const res = await appDataAction('recommendation-event', payload as Record<string, unknown>);
    return res.ok;
  } catch {
    return false;
  }
}

export async function saveUserSettings(settings: { autoEnrich?: boolean; resultsBatchSize?: number }) {
  const res = await appDataAction('save-settings', settings);
  return res.ok;
}

export async function saveRecentBusiness(business: Business) {
  const res = await appDataAction('recent-business', { businessId: business.id, business });
  return res.ok;
}

export async function saveGeneratedMessage(data: { businessId?: string; businessName?: string; message: string; source?: string; model?: string }) {
  const res = await appDataAction('generated-message', data);
  return res.ok;
}

export async function recordUsage(counter: 'analyses' | 'ai_messages' | 'recommendation_refreshes') {
  try {
    const res = await appDataAction('usage', { counter });
    return res.ok;
  } catch {
    return false;
  }
}

export async function createCheckoutSession(plan: 'go' | 'pro' | 'agency') {
  const res = await appDataAction('create-checkout', { plan });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.url) throw new Error(data?.error || 'Não foi possível abrir o checkout.');
  return data as { id: string; url: string };
}

export async function confirmCheckoutSession(sessionId: string) {
  const res = await appDataAction('confirm-checkout', { sessionId });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Não foi possível confirmar a assinatura.');
  return data.subscription;
}

export async function createBillingPortalSession(plan?: 'go' | 'pro' | 'agency') {
  const res = await appDataAction('create-billing-portal', { plan });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.url) throw new Error(data?.error || 'Não foi possível abrir o portal de cobrança.');
  return data as { url: string };
}

export async function refreshSubscriptionFromStripe() {
  const res = await appDataAction('refresh-subscription');
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Não foi possível atualizar a assinatura.');
  return data.subscription;
}

export async function updateProfile(displayName: string) {
  const res = await appDataAction('update-profile', { displayName });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Não foi possível atualizar seu perfil.');
  return true;
}

export async function generateMessage(
  business: any,
  options: { variationIndex?: number; previousMessage?: string } = {}
): Promise<{ message: string; subject?: string; source: 'gemini' | 'openrouter' | 'template'; model?: string }> {
  const res = await authenticatedFetch('/api/ai/generate-message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      business,
      variationIndex: options.variationIndex || 0,
      previousMessage: options.previousMessage || '',
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.message) throw new Error(data?.error || 'Não foi possível gerar a abordagem.');
  void saveGeneratedMessage({
    businessId: business?.id,
    businessName: business?.name,
    message: data.message,
    source: data.source,
    model: data.model,
  });
  void recordUsage('ai_messages');
  return data;
}

export async function getPageSpeed(url: string): Promise<PageSpeedData> {
  const res = await fetch(`/api/pagespeed?url=${encodeURIComponent(url)}`);
  const data = await readJsonResponse<any>(res, 'Não foi possível medir a performance do site.');
  if (!res.ok) throw new Error(data?.error || 'Erro ao medir PageSpeed.');
  return data as PageSpeedData;
}

export function getTrustIcon(confidence: number) {
  if (confidence >= 0.8) return '/high_trust.png';
  if (confidence >= 0.5) return '/medium_trust.png';
  return '/low_trust.png';
}
