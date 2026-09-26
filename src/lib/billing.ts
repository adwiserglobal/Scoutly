import type { User } from 'firebase/auth';

export type ScoutlyPlan = 'free' | 'go' | 'pro' | 'agency';

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
  dailyAiConversationLimit: number | null;
  advancedFilters: boolean;
  bulkExport: boolean;
  teamWorkspace: boolean;
  additionalSeatPrice?: number;
}

export interface PersistedSubscription {
  plan?: ScoutlyPlan | string | null;
  status?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean | null;
}

function freeStatus(subscription?: PersistedSubscription | null): BillingStatus {
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
    subscriptionStatus: 'active',
    cancelAtPeriodEnd: false,
    periodEndsAt: '',
    paidPlanId: null,
  };
}

export function getBillingStatus(
  _user: User | null,
  subscription?: PersistedSubscription | null
): BillingStatus {
  const persistedPlan = String(subscription?.plan || 'free').toLowerCase();
  const persistedStatus = String(subscription?.status || 'active').toLowerCase();
  const paidPlan = persistedPlan === 'go' || persistedPlan === 'pro' || persistedPlan === 'agency';

  if (paidPlan && ['active', 'trialing', 'past_due'].includes(persistedStatus)) {
    const definition = SCOUTLY_PLANS[persistedPlan];
    return {
      plan: persistedPlan,
      planName: definition.name,
      trialStartedAt: '',
      trialEndsAt: '',
      daysRemaining: 0,
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

  // Any legacy trial, expired, canceled or unpaid state now falls back to the
  // permanent Free tier. The backend persists this migration as well.
  return freeStatus(subscription);
}

export const SCOUTLY_PLANS = {
  go: {
    id: 'go',
    name: 'Go',
    monthlyPrice: 39.9,
    includedSeats: 1,
    monthlyAnalysisLimit: 80,
    monthlyAiMessageLimit: null,
    dailyAiConversationLimit: 10,
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
    dailyAiConversationLimit: null,
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
    dailyAiConversationLimit: null,
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
  return billing.hasAccess && billing.plan !== 'free';
}
