import { auth } from './firebase';

const PROTECTED_PREFIXES = [
  '/api/places-fast',
  '/api/search',
  '/api/ai/chat',
  '/api/ai/generate-message',
  '/api/ai/suggestions',
  '/api/credits',
  '/api/unlock-business',
];

let installed = false;

export function installApiAuthBridge() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const raw = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

    let pathname = '';
    try {
      pathname = new URL(raw, window.location.origin).pathname;
    } catch {
      pathname = raw;
    }

    const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}?`));
    if (!isProtected) return nativeFetch(input, init);

    const user = auth.currentUser;
    if (!user) return nativeFetch(input, init);

    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    if (!headers.has('Authorization')) {
      const token = await user.getIdToken();
      headers.set('Authorization', `Bearer ${token}`);
    }

    return nativeFetch(input, { ...init, headers });
  };
}
