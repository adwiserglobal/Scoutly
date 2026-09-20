import type { User } from 'firebase/auth';

export type ScoutlyPlan = 'trial' | 'go' | 'pro' | 'agency' | 'expired';

export interface BillingStatus {
  plan: ScoutlyPlan;
  planName: string;
  trialStartedAt: string;
  trialEndsAt: string;
  daysRemaining: number;
  isTrial: boolean;
  isExpired: boolean;
  hasAccess: boolean;
  monthlyPrice: number | null;
  includedSeats: number;
}

export interface ScoutlyPlanDefinition {
  id: 'go' | 'pro' | 'agency';
  name: string;
  monthlyPrice: number;
  includedSeats: number;
  monthlyAnalysisLimit: number | null;
  monthlyAiMessageLimit: number | null;
  advancedFilters: boolean;
  bulkExport: boolean;
  teamWorkspace: boolean;
  additionalSeatPrice?: number;
}

const TRIAL_DAYS = 7;
const TRIAL_ROLLOUT_AT = new Date('2026-09-18T00:00:00-03:00').getTime();

function parseTime(value?: string | null): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

export interface PersistedSubscription {
  plan?: ScoutlyPlan | string | null;
  status?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean | null;
}

export function getBillingStatus(
  user: User | null,
  subscription?: PersistedSubscription | null
): BillingStatus {
  const now = Date.now();

  const persistedPlan = String(subscription?.plan || '') as ScoutlyPlan;
  const persistedStatus = String(subscription?.status || '');
  const paidPlan =
    persistedPlan === 'go' || persistedPlan === 'pro' || persistedPlan === 'agency';

  if (paidPlan && ['active', 'trialing', 'past_due'].includes(persistedStatus)) {
    const definition = SCOUTLY_PLANS[persistedPlan];
    const periodEnd = parseTime(subscription?.current_period_end) || now;
    const remainingMs = Math.max(0, periodEnd - now);
    const daysRemaining =
      remainingMs > 0 ? Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000))) : 0;

    return {
      plan: persistedPlan,
      planName: definition.name,
      trialStartedAt: subscription?.current_period_start || '',
      trialEndsAt: subscription?.current_period_end || '',
      daysRemaining,
      isTrial: false,
      isExpired: false,
      hasAccess: true,
      monthlyPrice: definition.monthlyPrice,
      includedSeats: definition.includedSeats,
    };
  }

  if (
    persistedPlan === 'expired' ||
    ['canceled', 'unpaid', 'incomplete_expired'].includes(persistedStatus)
  ) {
    return {
      plan: 'expired',
      planName: 'Acesso encerrado',
      trialStartedAt: subscription?.current_period_start || '',
      trialEndsAt: subscription?.current_period_end || '',
      daysRemaining: 0,
      isTrial: false,
      isExpired: true,
      hasAccess: false,
      monthlyPrice: null,
      includedSeats: 1,
    };
  }

  if (persistedPlan === 'trial' && persistedStatus === 'trialing') {
    const serverStart = parseTime(subscription?.current_period_start);
    const serverEnd = parseTime(subscription?.current_period_end);

    if (serverStart && serverEnd) {
      const remainingMs = Math.max(0, serverEnd - now);
      const daysRemaining =
        remainingMs > 0 ? Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000))) : 0;
      const isExpired = now >= serverEnd;

      return {
        plan: isExpired ? 'expired' : 'trial',
        planName: isExpired ? 'Teste encerrado' : 'Teste Pro',
        trialStartedAt: new Date(serverStart).toISOString(),
        trialEndsAt: new Date(serverEnd).toISOString(),
        daysRemaining,
        isTrial: !isExpired,
        isExpired,
        hasAccess: !isExpired,
        monthlyPrice: null,
        includedSeats: 1,
      };
    }
  }

  const createdAt = parseTime(user?.metadata?.creationTime) || TRIAL_ROLLOUT_AT;
  const trialStartedAtMs = Math.max(createdAt, TRIAL_ROLLOUT_AT);
  const trialEndsAtMs = trialStartedAtMs + TRIAL_DAYS * 24 * 60 * 60 * 1000;
  const remainingMs = Math.max(0, trialEndsAtMs - now);
  const daysRemaining = remainingMs > 0
    ? Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)))
    : 0;
  const isExpired = now >= trialEndsAtMs;

  return {
    plan: isExpired ? 'expired' : 'trial',
    planName: isExpired ? 'Teste encerrado' : 'Teste Pro',
    trialStartedAt: new Date(trialStartedAtMs).toISOString(),
    trialEndsAt: new Date(trialEndsAtMs).toISOString(),
    daysRemaining,
    isTrial: !isExpired,
    isExpired,
    hasAccess: !isExpired,
    monthlyPrice: null,
    includedSeats: 1,
  };
}

export const SCOUTLY_PLANS = {
  go: {
    id: 'go',
    name: 'Go',
    monthlyPrice: 39.9,
    includedSeats: 1,
    monthlyAnalysisLimit: 100,
    monthlyAiMessageLimit: 50,
    advancedFilters: false,
    bulkExport: false,
    teamWorkspace: false,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 69.9,
    includedSeats: 1,
    monthlyAnalysisLimit: null,
    monthlyAiMessageLimit: null,
    advancedFilters: true,
    bulkExport: true,
    teamWorkspace: false,
  },
  agency: {
    id: 'agency',
    name: 'Agency',
    monthlyPrice: 299,
    includedSeats: 5,
    monthlyAnalysisLimit: null,
    monthlyAiMessageLimit: null,
    advancedFilters: true,
    bulkExport: true,
    teamWorkspace: true,
    additionalSeatPrice: 39.9,
  },
} satisfies Record<'go' | 'pro' | 'agency', ScoutlyPlanDefinition>;

export function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });
}

export function hasRecommendationsAccess(billing: BillingStatus) {
  return billing.plan === 'pro' || billing.plan === 'agency' || billing.plan === 'trial';
}
