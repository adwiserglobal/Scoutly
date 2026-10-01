const KEY = 'scoutly_unlocked_businesses_v1';

function readUnlocked(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.sessionStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

export function isBusinessUnlockedInSession(businessId?: string | null): boolean {
  const id = String(businessId || '').trim();
  if (!id) return false;
  return readUnlocked().has(id);
}

export function markBusinessUnlockedInSession(businessId?: string | null) {
  const id = String(businessId || '').trim();
  if (!id || typeof window === 'undefined') return;
  const unlocked = readUnlocked();
  unlocked.add(id);
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(Array.from(unlocked).slice(-500)));
  } catch {
    // Session storage is best effort only.
  }
}
