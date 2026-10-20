import type { Business, LeadStatus } from '../types';

/**
 * Pure recommendation + learning engine (no storage, no network).
 *
 * Learning model:
 *  - every interaction (favorite, lead status, WhatsApp click) is a weighted observation of a category
 *    and of a few business traits (no website, has phone);
 *  - outcomes matter: a closed deal teaches far more than a favorite, a lost lead is a mild negative;
 *  - observations decay over time, so the profile follows what the user does now, not months ago.
 *
 * Ranking blends: learned affinity, relevance to recent searches, how good a prospect the business is
 * (no site, contactable, still operating), proximity to the map and a small daily rotation; the final list
 * is diversified so one category does not take every slot.
 */

export type InteractionKind = 'favorite' | 'lead' | 'whatsapp';

export interface Interaction {
  id: string;
  kind: InteractionKind;
  category: string;
  status?: LeadStatus;
  at: number;
  noSite?: boolean;
  phone?: boolean;
}

export interface SearchSignal {
  query: string;
  location: string;
  at: number;
}

export interface RecommendationSignals {
  searches: SearchSignal[];
  favorites: Record<string, string>;
  pipeline: Record<string, string>;
  whatsappClicks: Record<string, number>;
  whatsappBusinesses: Record<string, true>;
  interactions: Interaction[];
}

export const EMPTY_SIGNALS: RecommendationSignals = {
  searches: [],
  favorites: {},
  pipeline: {},
  whatsappClicks: {},
  whatsappBusinesses: {},
  interactions: [],
};

const DAY_MS = 86_400_000;

export function normalize(value?: string | null) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanLocationLabel(value?: string | null) {
  return String(value || '').replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ').trim();
}

function queryWithoutExplicitLocation(query: string) {
  const clean = String(query || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const match = clean.match(/^(.*?)(?:\s+\b(?:em|no|na|nos|nas|perto\s+de|perto\s+do|perto\s+da|regi[aã]o\s+de)\b\s+.+)$/i);
  const head = String(match?.[1] || '').trim();
  return head || clean;
}

export function canonicalizeSearchSignal(signal: Partial<SearchSignal>): SearchSignal {
  const rawQuery = String(signal.query || '').replace(/\s+/g, ' ').trim();
  const query = queryWithoutExplicitLocation(rawQuery);
  return { query: query || rawQuery, location: cleanLocationLabel(signal.location), at: Number(signal.at || Date.now()) };
}

export function formatSearchSignal(signal: SearchSignal) {
  const canonical = canonicalizeSearchSignal(signal);
  return canonical.location ? `${canonical.query} em ${canonical.location}`.trim() : canonical.query;
}

// ---------------------------------------------------------------------------
// Traits
// ---------------------------------------------------------------------------

export function hasWebsite(business: Business) {
  return Boolean(String(business.website || '').trim() || (business.websites || []).some((site) => String(site || '').trim()));
}

export function hasPhoneNumber(business: Business) {
  return Boolean(business.phone || business.phones?.length || business.hasProtectedPhone);
}

function isClosed(business: Business) {
  const text = normalize(`${business.operatingStatus || ''} ${business.googleStatus || ''} ${business.situacaoCadastral || ''}`);
  if (/\b(permanently|definitivamente|baixada|inapta|suspensa|closed permanently|fechado permanentemente)\b/.test(text)) return true;
  return false;
}

export function interactionTraits(business: Business) {
  return { noSite: !hasWebsite(business), phone: hasPhoneNumber(business) };
}

// ---------------------------------------------------------------------------
// Learning
// ---------------------------------------------------------------------------

const STATUS_WEIGHT: Record<string, number> = {
  NOVO: 1.5,
  CONTATADO: 4,
  EM_NEGOCIACAO: 7,
  FECHADO: 12,
  PERDIDO: -2.5,
  ARQUIVADO: 0,
};

export function interactionWeight(interaction: Interaction) {
  if (interaction.kind === 'favorite') return 3;
  if (interaction.kind === 'whatsapp') return 2.5;
  return STATUS_WEIGHT[String(interaction.status || 'NOVO')] ?? 1.5;
}

function halfLifeDays(interaction: Interaction) {
  return interaction.kind === 'lead' && interaction.status === 'FECHADO' ? 150 : 75;
}

export function decay(ageMs: number, halfLife: number) {
  const days = Math.max(0, ageMs) / DAY_MS;
  return Math.pow(0.5, days / halfLife);
}

export interface Profile {
  categories: Map<string, { label: string; score: number }>;
  /** -1..1: how strongly the user's good leads are businesses without a website. */
  noSiteAffinity: number;
  /** -1..1: how strongly the user's good leads are businesses with a phone. */
  phoneAffinity: number;
  /** Number of positive observations feeding the profile. */
  evidence: number;
}

export function buildProfile(signals: RecommendationSignals, now = Date.now()): Profile {
  const categories = new Map<string, { label: string; score: number }>();
  let wSum = 0;
  let wNoSite = 0;
  let wPhone = 0;
  let featureCount = 0;
  let evidence = 0;

  for (const interaction of signals.interactions) {
    const key = normalize(interaction.category);
    const weight = interactionWeight(interaction) * decay(now - interaction.at, halfLifeDays(interaction));
    if (key) {
      const current = categories.get(key) || { label: interaction.category, score: 0 };
      current.score += weight;
      categories.set(key, current);
    }
    if (weight > 0) {
      evidence += 1;
      if (interaction.noSite !== undefined || interaction.phone !== undefined) {
        featureCount += 1;
        wSum += weight;
        if (interaction.noSite) wNoSite += weight;
        if (interaction.phone) wPhone += weight;
      }
    }
  }

  // Bounded so one hot category cannot drown everything else, and one bad lead cannot bury a category.
  for (const entry of categories.values()) entry.score = Math.max(-6, Math.min(24, entry.score));

  const shrink = featureCount / (featureCount + 4);
  const affinity = (share: number) => Math.max(-1, Math.min(1, (share - 0.5) * 2)) * shrink;
  return {
    categories,
    noSiteAffinity: wSum > 0 ? affinity(wNoSite / wSum) : 0,
    phoneAffinity: wSum > 0 ? affinity(wPhone / wSum) : 0,
    evidence,
  };
}

/** Same category (exact) or a clear containment between meaningful names ("restaurante" / "restaurante italiano"). */
export function categoriesMatch(a: string, b: string) {
  if (!a || !b) return false;
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 4 && long.includes(short);
}

// ---------------------------------------------------------------------------
// Search relevance
// ---------------------------------------------------------------------------

const SEARCH_STOPWORDS = new Set([
  'empresa', 'empresas', 'negocio', 'negocios', 'em', 'no', 'na', 'nos', 'nas',
  'de', 'do', 'da', 'dos', 'das', 'perto', 'proximo', 'proxima', 'regiao',
  'buscar', 'busque', 'ache', 'encontre', 'sem', 'site', 'com', 'para',
]);

/** Light plural stemming: "restaurantes" ~ "restaurante", "academias" ~ "academia". */
function stem(token: string) {
  if (token.length > 5 && token.endsWith('es')) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith('s')) return token.slice(0, -1);
  return token;
}

export function meaningfulTokens(value: string) {
  return normalize(value)
    .split(' ')
    .filter((token) => token.length >= 3 && !SEARCH_STOPWORDS.has(token))
    .map(stem);
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export interface RankOptions {
  now?: number;
  center?: { lat: number; lng: number } | null;
  /** Max share of the list one category may take before it is penalised (default: soft diversity). */
  diversity?: number;
}

export interface Ranked {
  business: Business;
  score: number;
  reasons: string[];
}

function hashDaily(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function dayKey(now: number) {
  const date = new Date(now);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function businessPoint(business: Business) {
  const lat = Number(business.coordinates?.lat ?? business.latitude);
  const lng = Number(business.coordinates?.lng ?? business.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

export function scoreBusinesses(businesses: Business[], signals: RecommendationSignals, options: RankOptions = {}): Ranked[] {
  const now = options.now ?? Date.now();
  const profile = buildProfile(signals, now);
  const today = dayKey(now);

  const searches = [...signals.searches]
    .sort((a, b) => b.at - a.at)
    .slice(0, 15)
    .map(canonicalizeSearchSignal)
    .map((search) => ({
      queryTokens: meaningfulTokens(search.query),
      locationTokens: meaningfulTokens(search.location),
      recency: Math.max(0.25, decay(now - search.at, 14)),
    }));

  return businesses.map((business) => {
    const category = normalize(business.category);
    const name = normalize(business.name);
    const address = normalize(business.address);
    const haystack = `${name} ${category} ${address}`;
    const reasons: string[] = [];

    let score = Math.max(0, Math.min(1, Number(business.confidence || 0))) * 1.5;

    // 1) Learned category affinity
    let affinity = 0;
    for (const [key, entry] of profile.categories) {
      if (categoriesMatch(category, key)) affinity += entry.score;
    }
    affinity = Math.max(-6, Math.min(14, affinity));
    score += affinity;
    if (affinity >= 4) reasons.push('Parecido com o que você prospecta');
    else if (affinity <= -3) reasons.push('Segmento com pouco retorno para você');

    // 2) Relevance to recent searches (decays with age)
    let searchScore = 0;
    for (const search of searches) {
      for (const token of search.queryTokens) {
        if (category.includes(token)) searchScore += 3.2 * search.recency;
        else if (name.includes(token)) searchScore += 2.2 * search.recency;
        else if (haystack.includes(token)) searchScore += 1.2 * search.recency;
      }
      for (const token of search.locationTokens) {
        if (address.includes(token)) searchScore += 1.15 * search.recency;
      }
    }
    searchScore = Math.min(9, searchScore);
    score += searchScore;
    if (searchScore >= 3) reasons.push('Combina com suas buscas recentes');

    // 3) Prospect quality: the thing Scoutly sells is a gap, so a missing site is a good sign
    const noSite = !hasWebsite(business);
    const phone = hasPhoneNumber(business);
    if (noSite) {
      score += 1.4 * (1 + profile.noSiteAffinity * 0.6);
      reasons.push('Sem site');
      if (Number(business.reviewCount || 0) >= 20) { score += 0.8; reasons.push('Muitas avaliações, mas sem site'); }
    } else if (profile.noSiteAffinity > 0.3) {
      score -= 0.8 * profile.noSiteAffinity;
    }
    if (phone) score += 0.8 * (1 + profile.phoneAffinity * 0.6);
    if (business.emails?.length || business.email) score += 0.4;
    if (isClosed(business)) score -= 12;

    // 4) Proximity to where the user is looking
    if (options.center) {
      const point = businessPoint(business);
      if (point) {
        const km = distanceKm(options.center, point);
        score += 2.4 * Math.exp(-km / 5);
        if (km <= 3) reasons.push('Perto de você');
        else if (km > 80) score -= 3;
      }
    }

    // 5) Already worked
    if (business.isFavorite) score -= 7;
    if (business.leadStatus && business.leadStatus !== 'NOVO') score -= 9;
    if (signals.whatsappBusinesses[business.id]) score -= 5;

    // 6) Daily rotation so the list does not look frozen
    score += hashDaily(`${today}:${business.id}`) * 0.35;

    return { business, score, reasons: [...new Set(reasons)].slice(0, 2) };
  });
}

/** Greedy re-rank: each pick lowers the appeal of more of the same category. */
export function diversify(ranked: Ranked[], limit: number, penalty = 2.2): Ranked[] {
  const pool = [...ranked].sort((a, b) => b.score - a.score);
  const picked: Ranked[] = [];
  const counts = new Map<string, number>();
  const candidates = pool.slice(0, Math.max(limit * 8, 60));

  while (picked.length < limit && candidates.length) {
    let bestIndex = 0;
    let bestValue = -Infinity;
    for (let index = 0; index < candidates.length; index += 1) {
      const key = normalize(candidates[index].business.category) || 'outros';
      const value = candidates[index].score - penalty * Math.max(0, (counts.get(key) || 0) - 1);
      if (value > bestValue) { bestValue = value; bestIndex = index; }
    }
    const [chosen] = candidates.splice(bestIndex, 1);
    const key = normalize(chosen.business.category) || 'outros';
    counts.set(key, (counts.get(key) || 0) + 1);
    picked.push(chosen);
  }
  return picked;
}

export function rankRecommendations(businesses: Business[], signals: RecommendationSignals, limit = 12, options: RankOptions = {}): Ranked[] {
  if (!businesses.length) return [];
  return diversify(scoreBusinesses(businesses, signals, options), Math.max(1, limit));
}

// ---------------------------------------------------------------------------
// Prompt context for the AI assistant
// ---------------------------------------------------------------------------

export function topCategoryLabels(signals: RecommendationSignals, businesses: Business[], count = 2, now = Date.now()) {
  const profile = buildProfile(signals, now);
  const ranked = [...profile.categories.values()].filter((entry) => entry.score > 0.5).sort((a, b) => b.score - a.score);
  if (ranked.length) return ranked.slice(0, count).map((entry) => entry.label);

  const counts = new Map<string, { label: string; count: number }>();
  for (const business of businesses.slice(0, 120)) {
    const label = String(business.category || '').trim();
    const key = normalize(label);
    if (!key) continue;
    const current = counts.get(key);
    counts.set(key, { label: current?.label || label, count: (current?.count || 0) + 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, count).map((item) => item.label);
}
