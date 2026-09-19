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

export function getBillingStatus(user: User | null): BillingStatus {
  const now = Date.now();
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

export const SCOUTLY_PLANS: Record<'go' | 'pro' | 'agency', ScoutlyPlanDefinition> = {
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
};

export function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });
}
