import { auth } from '../lib/firebase';

export type FlashPromoStatus = {
  eligible: boolean;
  active: boolean;
  startsAt: string | null;
  expiresAt: string | null;
  remainingSeconds: number;
  offerPriceCents: number;
  firstMonthOnly: true;
  reason:
    | 'active'
    | 'waiting_for_first_five'
    | 'missed_first_five'
    | 'expired'
    | 'not_free'
    | 'prior_pro';
};

async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Usuário não autenticado');
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

async function readJson(response: Response) {
  return response.json().catch(() => ({}));
}

export async function fetchFlashPromoStatus(): Promise<FlashPromoStatus> {
  const response = await authenticatedFetch('/api/flash-promo', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  const data = await readJson(response);
  if (!response.ok || !data?.promo) {
    throw new Error(data?.error || 'Não foi possível carregar a Flash Promo.');
  }
  return data.promo as FlashPromoStatus;
}

export async function createFlashPromoCheckout() {
  const response = await authenticatedFetch('/api/flash-promo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'checkout' }),
  });
  const data = await readJson(response);
  if (!response.ok || !data?.url) {
    const error: any = new Error(data?.error || 'Não foi possível abrir o checkout da Flash Promo.');
    error.code = data?.code;
    error.status = response.status;
    throw error;
  }
  return {
    id: String(data.id || ''),
    url: String(data.url),
    expiresAt: String(data.expiresAt || ''),
    offerPriceCents: Number(data.offerPriceCents || 3599),
  };
}
