import { saveRecentBusiness } from '../services/api';

const LEGACY_RECENTLY_VIEWED_KEY = 'scoutly_recently_viewed_businesses';
const RECENTLY_VIEWED_KEY_PREFIX = 'scoutly_recently_viewed_businesses';
export const RECENTLY_VIEWED_EVENT = 'scoutly-recently-viewed-updated';

let activeUserScope = 'anonymous';

function storageKey() {
  return `${RECENTLY_VIEWED_KEY_PREFIX}:${activeUserScope}`;
}

export function setRecentBusinessesUserScope(userUid?: string | null) {
  activeUserScope = userUid ? encodeURIComponent(userUid) : 'anonymous';

  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(LEGACY_RECENTLY_VIEWED_KEY);
    window.dispatchEvent(
      new CustomEvent(RECENTLY_VIEWED_EVENT, {
        detail: { ids: [], scope: activeUserScope },
      })
    );
  }
}

type RecentBusiness = {
  id: string;
  viewedAt: number;
};

function readRecentBusinesses(): RecentBusiness[] {
  if (typeof window === 'undefined') return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey()) || '[]');
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
  if (typeof window === 'undefined') return;

  const sourceItems = Array.isArray(items) ? items : [];
  const next: RecentBusiness[] = sourceItems
    .filter((item) => item && typeof item.business_id === 'string')
    .map((item) => ({
      id: item.business_id,
      viewedAt: new Date(item.viewed_at || Date.now()).getTime(),
    }))
    .sort((a, b) => b.viewedAt - a.viewedAt)
    .slice(0, 30);

  window.localStorage.setItem(storageKey(), JSON.stringify(next));
  window.dispatchEvent(
    new CustomEvent(RECENTLY_VIEWED_EVENT, {
      detail: { ids: next.map((item) => item.id) },
    })
  );
}

export function markBusinessRecentlyViewed(businessId: string, business?: any) {
  if (typeof window === 'undefined' || !businessId) return;

  const next: RecentBusiness[] = [
    { id: businessId, viewedAt: Date.now() },
    ...readRecentBusinesses().filter((item) => item.id !== businessId),
  ].slice(0, 30);

  window.localStorage.setItem(storageKey(), JSON.stringify(next));
  window.dispatchEvent(
    new CustomEvent(RECENTLY_VIEWED_EVENT, {
      detail: { ids: next.map((item) => item.id) },
    })
  );

  void saveRecentBusiness(businessId, business);
}
