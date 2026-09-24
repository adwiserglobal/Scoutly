import { Business } from '../types';
import { saveRecommendationEvent } from '../services/api';

const LEGACY_STORAGE_KEY = 'scoutly_recommendation_signals';
const STORAGE_KEY_PREFIX = 'scoutly_recommendation_signals';
export const RECOMMENDATION_SIGNAL_EVENT = 'scoutly-recommendation-signals-updated';

let activeUserScope = 'anonymous';

function storageKey() {
  return `${STORAGE_KEY_PREFIX}:${activeUserScope}`;
}

export function setRecommendationUserScope(userUid?: string | null) {
  activeUserScope = userUid ? encodeURIComponent(userUid) : 'anonymous';

  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    window.dispatchEvent(
      new CustomEvent(RECOMMENDATION_SIGNAL_EVENT, {
        detail: { scope: activeUserScope },
      })
    );
  }
}

type SearchSignal = {
  query: string;
  location: string;
  at: number;
};

type RecommendationSignals = {
  searches: SearchSignal[];
  favorites: Record<string, string>;
  pipeline: Record<string, string>;
  whatsappClicks: Record<string, number>;
  whatsappBusinesses: Record<string, true>;
};

const EMPTY_SIGNALS: RecommendationSignals = {
  searches: [],
  favorites: {},
  pipeline: {},
  whatsappClicks: {},
  whatsappBusinesses: {},
};

function normalize(value?: string | null) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanLocationLabel(value?: string | null) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .trim();
}

function queryWithoutExplicitLocation(query: string) {
  const clean = String(query || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';

  const match = clean.match(/^(.*?)(?:\s+\b(?:em|no|na|nos|nas|perto\s+de|perto\s+do|perto\s+da|regi[aã]o\s+de)\b\s+.+)$/i);
  const head = String(match?.[1] || '').trim();
  return head || clean;
}

function canonicalizeSearchSignal(signal: Partial<SearchSignal>): SearchSignal {
  const rawQuery = String(signal.query || '').replace(/\s+/g, ' ').trim();
  const location = cleanLocationLabel(signal.location);
  const query = queryWithoutExplicitLocation(rawQuery);

  return {
    query: query || rawQuery,
    location,
    at: Number(signal.at || Date.now()),
  };
}

function formatSearchSignal(signal: SearchSignal) {
  const canonical = canonicalizeSearchSignal(signal);
  if (!canonical.location) return canonical.query;
  return `${canonical.query} em ${canonical.location}`.trim();
}

function readSignals(): RecommendationSignals {
  if (typeof window === 'undefined') return EMPTY_SIGNALS;

  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey()) || '{}');
    return {
      searches: Array.isArray(parsed.searches)
        ? parsed.searches.slice(-30).map((search: SearchSignal) => canonicalizeSearchSignal(search))
        : [],
      favorites: parsed.favorites && typeof parsed.favorites === 'object' ? parsed.favorites : {},
      pipeline: parsed.pipeline && typeof parsed.pipeline === 'object' ? parsed.pipeline : {},
      whatsappClicks:
        parsed.whatsappClicks && typeof parsed.whatsappClicks === 'object'
          ? parsed.whatsappClicks
          : {},
      whatsappBusinesses:
        parsed.whatsappBusinesses && typeof parsed.whatsappBusinesses === 'object'
          ? parsed.whatsappBusinesses
          : {},
    };
  } catch {
    return EMPTY_SIGNALS;
  }
}

function writeSignals(next: RecommendationSignals) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey(), JSON.stringify(next));
  window.dispatchEvent(
    new CustomEvent(RECOMMENDATION_SIGNAL_EVENT, {
      detail: { scope: activeUserScope },
    })
  );
}

export function recordRecommendationSearch(query: string, location: string) {
  const canonical = canonicalizeSearchSignal({ query, location, at: Date.now() });
  if (!canonical.query) return;

  const current = readSignals();
  const searches = [...current.searches, canonical].slice(-30);

  writeSignals({ ...current, searches });
  void saveRecommendationEvent({
    eventType: 'search',
    query: canonical.query,
    location: canonical.location,
  });
}

export function recordRecommendationFavorite(business: Business, active: boolean) {
  const current = readSignals();
  const favorites = { ...current.favorites };

  if (active) favorites[business.id] = business.category || '';
  else delete favorites[business.id];

  writeSignals({ ...current, favorites });
  void saveRecommendationEvent({
    eventType: active ? 'favorite_add' : 'favorite_remove',
    businessId: business.id,
    category: business.category || '',
    metadata: { business },
  });
}

export function recordRecommendationPipeline(business: Business, active: boolean) {
  const current = readSignals();
  const pipeline = { ...current.pipeline };

  if (active) pipeline[business.id] = business.category || '';
  else delete pipeline[business.id];

  writeSignals({ ...current, pipeline });
  void saveRecommendationEvent({
    eventType: active ? 'pipeline_add' : 'pipeline_remove',
    businessId: business.id,
    category: business.category || '',
    metadata: { business },
  });
}

export function recordRecommendationWhatsApp(business: Business) {
  const current = readSignals();
  const key = normalize(business.category) || 'outros';

  writeSignals({
    ...current,
    whatsappClicks: {
      ...current.whatsappClicks,
      [key]: Math.min(50, Number(current.whatsappClicks[key] || 0) + 1),
    },
    whatsappBusinesses: {
      ...current.whatsappBusinesses,
      [business.id]: true,
    },
  });
  void saveRecommendationEvent({
    eventType: 'whatsapp_click',
    businessId: business.id,
    category: business.category || '',
    metadata: { business },
  });
}

export function hydrateRecommendationSignals(events: any[]) {
  const sourceEvents = Array.isArray(events) ? events : [];

  const next: RecommendationSignals = {
    searches: [],
    favorites: {},
    pipeline: {},
    whatsappClicks: {},
    whatsappBusinesses: {},
  };

  const ordered = [...sourceEvents].sort(
    (a, b) => new Date(a?.created_at || 0).getTime() - new Date(b?.created_at || 0).getTime()
  );

  for (const event of ordered) {
    const type = String(event?.event_type || '');
    const businessId = String(event?.business_id || '');
    const category = String(event?.category || '');

    if (type === 'search' && event?.query) {
      next.searches.push(canonicalizeSearchSignal({
        query: String(event.query),
        location: String(event.location || ''),
        at: new Date(event.created_at || Date.now()).getTime(),
      }));
      next.searches = next.searches.slice(-30);
    } else if (type === 'favorite_add' && businessId) {
      next.favorites[businessId] = category;
    } else if (type === 'favorite_remove' && businessId) {
      delete next.favorites[businessId];
    } else if (type === 'pipeline_add' && businessId) {
      next.pipeline[businessId] = category;
    } else if (type === 'pipeline_remove' && businessId) {
      delete next.pipeline[businessId];
    } else if (type === 'whatsapp_click' && businessId) {
      const key = normalize(category) || 'outros';
      next.whatsappClicks[key] = Math.min(50, Number(next.whatsappClicks[key] || 0) + 1);
      next.whatsappBusinesses[businessId] = true;
    }
  }

  writeSignals(next);
}

function addCategoryWeight(target: Map<string, number>, category: string, weight: number) {
  const key = normalize(category);
  if (!key) return;
  target.set(key, (target.get(key) || 0) + weight);
}

function hashDaily(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function getLocalDayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
}

const SEARCH_STOPWORDS = new Set([
  'empresa', 'empresas', 'negocio', 'negocios', 'em', 'no', 'na', 'nos', 'nas',
  'de', 'do', 'da', 'dos', 'das', 'perto', 'proximo', 'proxima', 'regiao',
  'buscar', 'busque', 'ache', 'encontre',
]);

function meaningfulTokens(value: string) {
  return normalize(value)
    .split(' ')
    .filter((token) => token.length >= 3 && !SEARCH_STOPWORDS.has(token));
}

export function getRecommendationPromptContext(
  currentRegionName: string,
  businesses: Business[] = []
): { recentSearches: string[]; suggestions: string[] } {
  const signals = readSignals();
  const region = currentRegionName?.trim() || 'esta região';
  const categoryScores = new Map<string, { label: string; score: number }>();

  const bump = (category: string, score: number) => {
    const label = String(category || '').trim();
    const key = normalize(label);
    if (!key) return;
    const current = categoryScores.get(key);
    categoryScores.set(key, {
      label: current?.label || label,
      score: (current?.score || 0) + score,
    });
  };

  Object.values(signals.favorites).forEach((category) => bump(category, 4));
  Object.values(signals.pipeline).forEach((category) => bump(category, 6));
  Object.entries(signals.whatsappClicks).forEach(([category, clicks]) =>
    bump(category, Math.min(18, Number(clicks) * 3))
  );

  if (categoryScores.size === 0) {
    const counts = new Map<string, { label: string; count: number }>();
    businesses.slice(0, 120).forEach((business) => {
      const label = String(business.category || '').trim();
      const key = normalize(label);
      if (!key) return;
      const current = counts.get(key);
      counts.set(key, { label: current?.label || label, count: (current?.count || 0) + 1 });
    });
    [...counts.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 2)
      .forEach((item) => bump(item.label, 1));
  }

  const topCategories = [...categoryScores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((item) => item.label);

  const recentSignals = [...signals.searches]
    .sort((a, b) => b.at - a.at)
    .slice(0, 5)
    .map(canonicalizeSearchSignal);

  const recentSearches = recentSignals.map(formatSearchSignal);

  const suggestions: string[] = [];
  const lastSearch = recentSignals[0];

  if (lastSearch?.query) {
    suggestions.push(`Continue minha busca por ${formatSearchSignal(lastSearch)}`);
  }

  if (topCategories[0]) {
    suggestions.push(`Encontre mais ${topCategories[0]} sem site em ${region}`);
  }

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
    suggestions.push(`Quais empresas desta área têm os melhores sinais para prospecção?`);
  }

  return {
    recentSearches,
    suggestions: [...new Set(suggestions)].slice(0, 4),
  };
}

export function getRecommendedBusinesses(businesses: Business[], limit = 12): Business[] {
  if (businesses.length === 0) return [];

  const signals = readSignals();
  const categoryWeights = new Map<string, number>();

  Object.values(signals.favorites).forEach((category) =>
    addCategoryWeight(categoryWeights, category, 4)
  );
  Object.values(signals.pipeline).forEach((category) =>
    addCategoryWeight(categoryWeights, category, 6)
  );
  Object.entries(signals.whatsappClicks).forEach(([category, clicks]) =>
    addCategoryWeight(categoryWeights, category, Math.min(18, Number(clicks) * 3))
  );

  const recentSearches = [...signals.searches]
    .sort((a, b) => b.at - a.at)
    .slice(0, 15)
    .map(canonicalizeSearchSignal);

  const dayKey = getLocalDayKey();

  return businesses
    .map((business) => {
      const category = normalize(business.category);
      const name = normalize(business.name);
      const address = normalize(business.address);
      const haystack = `${name} ${category} ${address}`;

      let score = Math.max(0, Math.min(1, Number(business.confidence || 0))) * 1.5;

      for (const [signalCategory, weight] of categoryWeights.entries()) {
        if (
          category === signalCategory ||
          category.includes(signalCategory) ||
          signalCategory.includes(category)
        ) {
          score += weight;
        }
      }

      recentSearches.forEach((search, index) => {
        const recency = Math.max(0.35, 1 - index * 0.05);
        const queryTokens = meaningfulTokens(search.query);
        const locationTokens = meaningfulTokens(search.location);

        for (const token of queryTokens) {
          if (category.includes(token)) score += 3.2 * recency;
          else if (name.includes(token)) score += 2.2 * recency;
          else if (haystack.includes(token)) score += 1.2 * recency;
        }

        for (const token of locationTokens) {
          if (address.includes(token)) score += 1.15 * recency;
        }
      });

      if (business.isFavorite) score -= 7;
      if (business.leadStatus && business.leadStatus !== 'NOVO') score -= 9;
      if (signals.whatsappBusinesses[business.id]) score -= 5;

      score += hashDaily(`${dayKey}:${business.id}`) * 0.35;

      return { business, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, limit))
    .map(({ business }) => business);
}
