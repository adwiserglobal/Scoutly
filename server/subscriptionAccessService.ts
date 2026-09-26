import { appDataRequest, dbValue } from './appDataService.js';

export type SubscriptionAccess = {
  plan: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  hasAccess: boolean;
  reason: 'active' | 'free' | 'subscription_required';
};

export async function getSubscriptionAccess(userUid: string): Promise<SubscriptionAccess> {
  const rows = await appDataRequest<any[]>(
    `subscriptions?user_uid=eq.${dbValue(userUid)}&select=plan,status,current_period_start,current_period_end&limit=1`
  );
  const subscription = rows[0] || null;

  if (!subscription) {
    return {
      plan: 'free', status: 'active', current_period_start: null, current_period_end: null,
      hasAccess: true, reason: 'free',
    };
  }

  const plan = String(subscription.plan || 'free').toLowerCase();
  const status = String(subscription.status || 'active').toLowerCase();
  const start = subscription.current_period_start || null;
  const end = subscription.current_period_end || null;

  if (['go', 'pro', 'agency'].includes(plan) && ['active', 'trialing', 'past_due'].includes(status)) {
    return { plan, status, current_period_start: start, current_period_end: end, hasAccess: true, reason: 'active' };
  }

  // Existing trial users keep the legacy entitlement until its persisted server end.
  if (plan === 'trial' && status === 'trialing' && end && new Date(end).getTime() > Date.now()) {
    return { plan, status, current_period_start: start, current_period_end: end, hasAccess: true, reason: 'active' };
  }

  // Pending/expired/cancelled subscriptions now fall back to the permanent Free tier.
  return {
    plan: 'free', status: 'active', current_period_start: null, current_period_end: null,
    hasAccess: true, reason: 'free',
  };
}

export async function requireProductAccess(userUid: string): Promise<SubscriptionAccess> {
  return getSubscriptionAccess(userUid);
}

// Kept only for backward compatibility with an already-open legacy onboarding tab.
// New accounts never need to start a trial; they are activated on Free after onboarding.
export async function startTrialForUser(userUid: string) {
  const access = await getSubscriptionAccess(userUid);
  return {
    plan: access.plan,
    status: access.status,
    current_period_start: access.current_period_start,
    current_period_end: access.current_period_end,
  };
}
