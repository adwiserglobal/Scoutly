import { Business, LeadStatus } from '../types';
import { saveRecommendationEvent } from '../services/api';
import {
  EMPTY_SIGNALS,
  canonicalizeSearchSignal,
  formatSearchSignal,
  interactionTraits,
  normalize,
  rankRecommendations,
  topCategoryLabels,
  type Interaction,
  type RankOptions,
  type RecommendationSignals,
} from './recommendationEngine';

const LEGACY_STORAGE_KEY = 'scoutly_recommendation_signals';
const STORAGE_KEY_PREFIX = 'scoutly_recommendation_signals';
const MAX_INTERACTIONS = 300;
export const RECOMMENDATION_SIGNAL_EVENT = 'scoutly-recommendation-signals-updated';

let activeUserScope = 'anonymous';
const reasonsByBusiness = new Map<string, string[]>();

function storageKey() {
  return `${STORAGE_KEY_PREFIX}:${activeUserScope}`;
}

export function setRecommendationUserScope(userUid?: string | null) {
  activeUserScope = userUid ? encodeURIComponent(userUid) : 'anonymous';

  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(RECOMMENDATION_SIGNAL_EVENT, { detail: { scope: activeUserScope } }));
  }
}

function readSignals(): RecommendationSignals {
  if (typeof window === 'undefined') return EMPTY_SIGNALS;

  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey()) || '{}');
    const object = (value: unknown) => (value && typeof value === 'object' ? (value as Record<string, any>) : {});
    return {
      searches: Array.isArray(parsed.searches) ? parsed.searches.slice(-30).map((search: any) => canonicalizeSearchSignal(search)) : [],
      favorites: object(parsed.favorites),
      pipeline: object(parsed.pipeline),
      whatsappClicks: object(parsed.whatsappClicks),
      whatsappBusinesses: object(parsed.whatsappBusinesses),
      interactions: Array.isArray(parsed.interactions)
        ? parsed.interactions.filter((item: any) => item && typeof item.id === 'string' && Number.isFinite(Number(item.at))).slice(-MAX_INTERACTIONS)
        : [],
    };
  } catch {
    return EMPTY_SIGNALS;
  }
}

function writeSignals(next: RecommendationSignals) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(), JSON.stringify({ ...next, interactions: next.interactions.slice(-MAX_INTERACTIONS) }));
  } catch { /* storage full or blocked: signals stay server-side */ }
  window.dispatchEvent(new CustomEvent(RECOMMENDATION_SIGNAL_EVENT, { detail: { scope: activeUserScope } }));
}

/** Replaces the state-like interaction (favorite / lead) of a business, or removes it. */
function withInteraction(list: Interaction[], next: Interaction | null, kind: Interaction['kind'], id: string) {
  const rest = list.filter((item) => !(item.kind === kind && item.id === id));
  return next ? [...rest, next] : rest;
}

export function recordRecommendationSearch(query: string, location: string) {
  const canonical = canonicalizeSearchSignal({ query, location, at: Date.now() });
  if (!canonical.query) return;

  const current = readSignals();
  writeSignals({ ...current, searches: [...current.searches, canonical].slice(-30) });
  void saveRecommendationEvent({ eventType: 'search', query: canonical.query, location: canonical.location });
}

export function recordRecommendationFavorite(business: Business, active: boolean) {
  const current = readSignals();
  const favorites = { ...current.favorites };
  if (active) favorites[business.id] = business.category || '';
  else delete favorites[business.id];

  const interactions = withInteraction(
    current.interactions,
    active ? { id: business.id, kind: 'favorite', category: business.category || '', at: Date.now(), ...interactionTraits(business) } : null,
    'favorite',
    business.id
  );
  writeSignals({ ...current, favorites, interactions });
  void saveRecommendationEvent({
    eventType: active ? 'favorite_add' : 'favorite_remove',
    businessId: business.id,
    category: business.category || '',
    metadata: { business },
  });
}

export function recordRecommendationPipeline(business: Business, active: boolean, status?: LeadStatus) {
  const current = readSignals();
  const pipeline = { ...current.pipeline };
  if (active) pipeline[business.id] = business.category || '';
  else delete pipeline[business.id];

  const interactions = withInteraction(
    current.interactions,
    status && status !== 'ARQUIVADO'
      ? { id: business.id, kind: 'lead', category: business.category || '', status, at: Date.now(), ...interactionTraits(business) }
      : null,
    'lead',
    business.id
  );
  writeSignals({ ...current, pipeline, interactions });
  void saveRecommendationEvent({
    eventType: active ? 'pipeline_add' : 'pipeline_remove',
    businessId: business.id,
    category: business.category || '',
    metadata: { business, status: status || null },
  });
}

export function recordRecommendationWhatsApp(business: Business) {
  const current = readSignals();
  const key = normalize(business.category) || 'outros';
  const interactions = [
    ...current.interactions,
    { id: business.id, kind: 'whatsapp' as const, category: business.category || '', at: Date.now(), ...interactionTraits(business) },
  ];

  writeSignals({
    ...current,
    whatsappClicks: { ...current.whatsappClicks, [key]: Math.min(50, Number(current.whatsappClicks[key] || 0) + 1) },
    whatsappBusinesses: { ...current.whatsappBusinesses, [business.id]: true },
    interactions,
  });
  void saveRecommendationEvent({
    eventType: 'whatsapp_click',
    businessId: business.id,
    category: business.category || '',
    metadata: { business },
  });
}

export interface RecommendationState {
  leads?: Record<string, { status?: string; updatedAt?: string; business?: Business | null }>;
  favorites?: Record<string, boolean>;
  favoriteBusinesses?: Array<Business | null | undefined>;
  favoriteTimes?: Record<string, string>;
}

/**
 * Rebuilds the local signals. Searches and WhatsApp clicks come from the event log; favorites and leads come
 * from the authoritative tables (the log is capped, so replaying add/remove events would drift for heavy users).
 */
export function hydrateRecommendationSignals(events: any[], state?: RecommendationState) {
  const sourceEvents = Array.isArray(events) ? events : [];
  const next: RecommendationSignals = { searches: [], favorites: {}, pipeline: {}, whatsappClicks: {}, whatsappBusinesses: {}, interactions: [] };
  const ordered = [...sourceEvents].sort((a, b) => new Date(a?.created_at || 0).getTime() - new Date(b?.created_at || 0).getTime());
  const legacyFavorites: Record<string, { category: string; at: number }> = {};
  const legacyPipeline: Record<string, { category: string; at: number; status?: string }> = {};
  const snapshotById = new Map<string, Business>();

  for (const business of state?.favoriteBusinesses || []) if (business?.id) snapshotById.set(business.id, business);
  for (const [id, lead] of Object.entries(state?.leads || {})) if (lead?.business) snapshotById.set(id, lead.business);

  for (const event of ordered) {
    const type = String(event?.event_type || '');
    const businessId = String(event?.business_id || '');
    const category = String(event?.category || '');
    const at = new Date(event?.created_at || Date.now()).getTime();
    const business: Business | undefined = event?.metadata?.business;
    if (business?.id && !snapshotById.has(business.id)) snapshotById.set(business.id, business);

    if (type === 'search' && event?.query) {
      next.searches.push(canonicalizeSearchSignal({ query: String(event.query), location: String(event.location || ''), at }));
      next.searches = next.searches.slice(-30);
    } else if (type === 'favorite_add' && businessId) {
      legacyFavorites[businessId] = { category, at };
    } else if (type === 'favorite_remove' && businessId) {
      delete legacyFavorites[businessId];
    } else if (type === 'pipeline_add' && businessId) {
      legacyPipeline[businessId] = { category, at, status: event?.metadata?.status || undefined };
    } else if (type === 'pipeline_remove' && businessId) {
      delete legacyPipeline[businessId];
    } else if (type === 'whatsapp_click' && businessId) {
      const key = normalize(category) || 'outros';
      next.whatsappClicks[key] = Math.min(50, Number(next.whatsappClicks[key] || 0) + 1);
      next.whatsappBusinesses[businessId] = true;
      next.interactions.push({ id: businessId, kind: 'whatsapp', category, at, ...(business ? interactionTraits(business) : {}) });
    }
  }

  const categoryOf = (id: string, fallback = '') => snapshotById.get(id)?.category || fallback;
  const traitsOf = (id: string) => (snapshotById.get(id) ? interactionTraits(snapshotById.get(id)!) : {});

  if (state?.favorites) {
    for (const id of Object.keys(state.favorites)) {
      const category = categoryOf(id, legacyFavorites[id]?.category);
      next.favorites[id] = category;
      const at = new Date(state.favoriteTimes?.[id] || legacyFavorites[id]?.at || Date.now()).getTime();
      next.interactions.push({ id, kind: 'favorite', category, at, ...traitsOf(id) });
    }
  } else {
    for (const [id, item] of Object.entries(legacyFavorites)) {
      next.favorites[id] = item.category;
      next.interactions.push({ id, kind: 'favorite', category: item.category, at: item.at, ...traitsOf(id) });
    }
  }

  if (state?.leads) {
    for (const [id, lead] of Object.entries(state.leads)) {
      const status = String(lead?.status || 'NOVO') as LeadStatus;
      if (status === 'ARQUIVADO') continue;
      const category = categoryOf(id, legacyPipeline[id]?.category);
      next.pipeline[id] = category;
      next.interactions.push({ id, kind: 'lead', category, status, at: new Date(lead?.updatedAt || Date.now()).getTime(), ...traitsOf(id) });
    }
  } else {
    for (const [id, item] of Object.entries(legacyPipeline)) {
      next.pipeline[id] = item.category;
      next.interactions.push({ id, kind: 'lead', category: item.category, status: (item.status as LeadStatus) || 'CONTATADO', at: item.at, ...traitsOf(id) });
    }
  }

  next.interactions = next.interactions.sort((a, b) => a.at - b.at).slice(-MAX_INTERACTIONS);
  writeSignals(next);
}

export function getRecommendationPromptContext(
  currentRegionName: string,
  businesses: Business[] = []
): { recentSearches: string[]; suggestions: string[] } {
  const signals = readSignals();
  const region = currentRegionName?.trim() || 'esta região';
  const topCategories = topCategoryLabels(signals, businesses, 2);

  const recentSignals = [...signals.searches].sort((a, b) => b.at - a.at).slice(0, 5).map(canonicalizeSearchSignal);
  const recentSearches = recentSignals.map(formatSearchSignal);

  const suggestions: string[] = [];
  const lastSearch = recentSignals[0];
  const won = signals.interactions.filter((item) => item.kind === 'lead' && item.status === 'FECHADO');

  if (lastSearch?.query) suggestions.push(`Continue minha busca por ${formatSearchSignal(lastSearch)}`);
  if (won.length && won[won.length - 1].category) {
    suggestions.push(`Encontre mais ${won[won.length - 1].category} parecidos com os clientes que eu já fechei em ${region}`);
  }
  if (topCategories[0]) suggestions.push(`Encontre mais ${topCategories[0]} sem site em ${region}`);

  if (Object.keys(signals.pipeline).length > 0) {
    suggestions.push(`Quais oportunidades em ${region} combinam com o meu pipeline atual?`);
  } else if (topCategories[1]) {
    suggestions.push(`Mostre ${topCategories[1]} com maior potencial em ${region}`);
  }

  if (Object.keys(signals.favorites).length > 0) {
    suggestions.push(`Encontre empresas parecidas com os meus favoritos em ${region}`);
  } else if (Object.keys(signals.whatsappBusinesses).length > 0) {
    suggestions.push(`Mostre prospects com WhatsApp e alto potencial em ${region}`);
  } else {
    suggestions.push('Quais empresas desta área têm os melhores sinais para prospecção?');
  }

  return { recentSearches, suggestions: [...new Set(suggestions)].slice(0, 4) };
}

export function getRecommendedBusinesses(businesses: Business[], limit = 12, options: RankOptions = {}): Business[] {
  const ranked = rankRecommendations(businesses, readSignals(), limit, options);
  for (const item of ranked) reasonsByBusiness.set(item.business.id, item.reasons);
  return ranked.map((item) => item.business);
}

/** Short explanations ("Sem site", "Perto de você") for the last ranking that included this business. */
export function getRecommendationReasons(businessId: string): string[] {
  return reasonsByBusiness.get(businessId) || [];
}

const CHEST_QUERY_WINDOW_MS = 6 * 60 * 60 * 1000;

/** Searches from the last few hours, newest first: what the user is looking for right now. */
export function getRecentSearchQueries(max = 3): string[] {
  const cutoff = Date.now() - CHEST_QUERY_WINDOW_MS;
  const seen = new Set<string>();
  const queries: string[] = [];
  for (const search of [...readSignals().searches].reverse()) {
    if (search.at < cutoff) break;
    const key = normalize(search.query);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    queries.push(search.query);
    if (queries.length >= max) break;
  }
  return queries;
}
