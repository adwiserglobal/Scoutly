import { saveRecentBusiness } from '../services/api';

const RECENTLY_VIEWED_KEY = 'scoutly_recently_viewed_businesses';
export const RECENTLY_VIEWED_EVENT = 'scoutly-recently-viewed-updated';

type RecentBusiness = {
  id: string;
  viewedAt: number;
};

function readRecentBusinesses(): RecentBusiness[] {
  if (typeof window === 'undefined') return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENTLY_VIEWED_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item) => item && typeof item.id === 'string')
      .map((item) => ({
        id: item.id,
        viewedAt: Number(item.viewedAt) || 0,
      }))
      .sort((a, b) => b.viewedAt - a.viewedAt);
  } catch {
    return [];
  }
}

export function getRecentlyViewedBusinessIds(limit = 30): string[] {
  return readRecentBusinesses()
    .slice(0, Math.max(1, limit))
    .map((item) => item.id);
}

export function hydrateRecentlyViewedBusinesses(items: any[]) {
  if (typeof window === 'undefined' || !Array.isArray(items) || items.length === 0) return;

  const next: RecentBusiness[] = items
    .filter((item) => item && typeof item.business_id === 'string')
    .map((item) => ({
      id: item.business_id,
      viewedAt: new Date(item.viewed_at || Date.now()).getTime(),
    }))
    .sort((a, b) => b.viewedAt - a.viewedAt)
    .slice(0, 30);

  window.localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(next));
  window.dispatchEvent(
    new CustomEvent(RECENTLY_VIEWED_EVENT, {
      detail: { ids: next.map((item) => item.id) },
    })
  );

  void saveRecentBusiness(businessId, business);
}

export function markBusinessRecentlyViewed(businessId: string, business?: any) {
  if (typeof window === 'undefined' || !businessId) return;

  const next: RecentBusiness[] = [
    { id: businessId, viewedAt: Date.now() },
    ...readRecentBusinesses().filter((item) => item.id !== businessId),
  ].slice(0, 30);

  window.localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(next));
  window.dispatchEvent(
    new CustomEvent(RECENTLY_VIEWED_EVENT, {
      detail: { ids: next.map((item) => item.id) },
    })
  );
}
