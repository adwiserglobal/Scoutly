import { auth } from '../lib/firebase';
import type { Business } from '../types';

export type CreditState = {
  plan: string;
  dailyLimit: number | null;
  dailyUsed: number;
  dailyRemaining: number | null;
  monthlyLimit: number | null;
  monthlyUsed: number;
  monthlyRemaining: number | null;
  aiDailyLimit: number | null;
  aiDailyUsed: number;
  aiDailyRemaining: number | null;
  dailyResetAt: string;
  monthlyResetAt: string;
  recommendationsAccess: boolean;
  aiAccess: boolean;
  code?: string;
};

async function authHeaders(extra?: HeadersInit) {
  const user = auth.currentUser;
  if (!user) throw new Error('Usuário não autenticado.');
  const token = await user.getIdToken();
  const headers = new Headers(extra);
  headers.set('Authorization', `Bearer ${token}`);
  return headers;
}

async function readResponse(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error || 'Não foi possível concluir a operação.');
    (error as any).status = response.status;
    (error as any).code = data?.code;
    (error as any).creditState = data?.creditState;
    throw error;
  }
  return data;
}

export async function fetchCreditState(): Promise<CreditState> {
  const response = await fetch('/api/credits', {
    headers: await authHeaders({ Accept: 'application/json' }),
  });
  const data = await readResponse(response);
  return data.creditState;
}

export async function unlockBusiness(business: Business): Promise<{ business: Business; creditState: CreditState }> {
  if (!business.isLocked) {
    const creditState = await fetchCreditState();
    return { business, creditState };
  }

  if (!business.unlockToken) throw new Error('Atualize os resultados para desbloquear este negócio.');

  const response = await fetch('/api/unlock-business', {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
    body: JSON.stringify({
      businessId: business.id,
      unlockToken: business.unlockToken,
      business: {
        id: business.id,
        name: business.name,
        latitude: business.latitude,
        longitude: business.longitude,
        coordinates: business.coordinates,
        category: business.category,
        confidence: business.confidence,
        operatingStatus: business.operatingStatus,
        address: business.address,
        source: business.source,
        sources: business.sources,
        leadStatus: business.leadStatus,
        isFavorite: business.isFavorite,
        notes: business.notes,
        openStatus: business.openStatus,
        openStatusText: business.openStatusText,
      },
    }),
  });

  const data = await readResponse(response);
  window.dispatchEvent(new CustomEvent('scoutly-entitlements-changed', { detail: data.creditState }));
  return data;
}

export function openPlansForLockedFeature(source = 'locked_feature') {
  window.dispatchEvent(new CustomEvent('scoutly-open-plans', { detail: { source } }));
}
