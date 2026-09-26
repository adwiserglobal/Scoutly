import { auth } from './firebase';

let installed = false;

export function installAuthenticatedFetchPatch() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const nativeFetch = window.fetch.bind(window);
  window.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

    const needsFirebaseToken =
      url.startsWith('/api/ai/generate-message') ||
      url.startsWith('/api/ai/chat') ||
      url.startsWith('/api/ai/suggestions');

    if (!needsFirebaseToken) return nativeFetch(input, init);

    const token = await auth.currentUser?.getIdToken();
    if (!token) return nativeFetch(input, init);

    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);

    return nativeFetch(input, { ...init, headers });
  }) as typeof window.fetch;
}
