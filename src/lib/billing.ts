import type { User } from 'firebase/auth';

export type ScoutlyPlan = 'free' | 'trial' | 'go' | 'pro' | 'agency' | 'expired';

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
  subscriptionStatus: string;
  cancelAtPeriodEnd: boolean;
  periodEndsAt: string;
  paidPlanId: 'go' | 'pro' | 'agency' | null;
}

export interface ScoutlyPlanDefinition {
  id: 'go' | 'pro' | 'agency';
  name: string;
  monthlyPrice: number;
  includedSeats: number;
  monthlyAnalysisLimit: number | null;
  monthlyAiMessageLimit: number | null;
  dailyAiMessageLimit?: number | null;
  advancedFilters: boolean;
  bulkExport: boolean;
  teamWorkspace: boolean;
  additionalSeatPrice?: number;
}

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

function freeStatus(status = 'active'): BillingStatus {
  return {
    plan: 'free',
    planName: 'Free',
    trialStartedAt: '',
    trialEndsAt: '',
    daysRemaining: 0,
    isTrial: false,
    isExpired: false,
    hasAccess: true,
    monthlyPrice: 0,
    includedSeats: 1,
    subscriptionStatus: status,
    cancelAtPeriodEnd: false,
    periodEndsAt: '',
    paidPlanId: null,
  };
}

export function getBillingStatus(
  _user: User | null,
  subscription?: PersistedSubscription | null
): BillingStatus {
  const now = Date.now();
  const persistedPlan = String(subscription?.plan || 'free') as ScoutlyPlan;
  const persistedStatus = String(subscription?.status || 'active');
  const paidPlan = persistedPlan === 'go' || persistedPlan === 'pro' || persistedPlan === 'agency';

  if (paidPlan && ['active', 'trialing', 'past_due'].includes(persistedStatus)) {
    const definition = SCOUTLY_PLANS[persistedPlan];
    const periodEnd = parseTime(subscription?.current_period_end) || now;
    const remainingMs = Math.max(0, periodEnd - now);
    const daysRemaining = remainingMs > 0 ? Math.max(1, Math.ceil(remainingMs / 86400000)) : 0;
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
      subscriptionStatus: persistedStatus,
      cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
      periodEndsAt: subscription?.current_period_end || '',
      paidPlanId: persistedPlan,
    };
  }

  // Existing trial users retain the legacy entitlement until its server-side end.
  if (persistedPlan === 'trial' && persistedStatus === 'trialing') {
    const start = parseTime(subscription?.current_period_start);
    const end = parseTime(subscription?.current_period_end);
    if (start && end && end > now) {
      return {
        plan: 'trial', planName: 'Teste legado', trialStartedAt: new Date(start).toISOString(),
        trialEndsAt: new Date(end).toISOString(), daysRemaining: Math.max(1, Math.ceil((end - now) / 86400000)),
        isTrial: true, isExpired: false, hasAccess: true, monthlyPrice: null, includedSeats: 1,
        subscriptionStatus: persistedStatus, cancelAtPeriodEnd: false,
        periodEndsAt: subscription?.current_period_end || '', paidPlanId: null,
      };
    }
  }

  // Inactive paid subscriptions, old pending trials and expired trials all fall back to Free.
  return freeStatus(persistedPlan === 'free' ? persistedStatus : 'active');
}

export const SCOUTLY_PLANS = {
  go: {
    id: 'go',
    name: 'Go',
    monthlyPrice: 39.9,
    includedSeats: 1,
    monthlyAnalysisLimit: 80,
    monthlyAiMessageLimit: null,
    dailyAiMessageLimit: 10,
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
    dailyAiMessageLimit: null,
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
    dailyAiMessageLimit: null,
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
  return billing.hasAccess && (billing.plan === 'pro' || billing.plan === 'agency' || billing.plan === 'trial');
}
