import { appDataRequest, dbValue } from './appDataService.js';

export type SubscriptionAccess = {
  plan: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  hasAccess: boolean;
  reason: 'active' | 'free';
};

function freeAccess(): SubscriptionAccess {
  return {
    plan: 'free',
    status: 'active',
    current_period_start: null,
    current_period_end: null,
    hasAccess: true,
    reason: 'free',
  };
}

async function persistFreeFallback(userUid: string) {
  await appDataRequest(`subscriptions?user_uid=eq.${dbValue(userUid)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      plan: 'free',
      status: 'active',
      current_period_start: null,
      current_period_end: null,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    }),
  }).catch(() => undefined);
}

export async function getSubscriptionAccess(userUid: string): Promise<SubscriptionAccess> {
  const rows = await appDataRequest<any[]>(
    `subscriptions?user_uid=eq.${dbValue(userUid)}&select=plan,status,current_period_start,current_period_end&limit=1`
  );
  const subscription = rows[0] || null;

  if (!subscription) return freeAccess();

  const plan = String(subscription.plan || 'free').toLowerCase();
  const status = String(subscription.status || 'active').toLowerCase();
  const start = subscription.current_period_start || null;
  const end = subscription.current_period_end || null;

  if (['go', 'pro', 'agency'].includes(plan)) {
    const paidActive = ['active', 'trialing', 'past_due'].includes(status);
    if (paidActive) {
      return {
        plan,
        status,
        current_period_start: start,
        current_period_end: end,
        hasAccess: true,
        reason: 'active',
      };
    }

    // A canceled/expired paid subscription falls back to Free instead of
    // locking the user out of the product.
    await persistFreeFallback(userUid);
    return freeAccess();
  }

  if (plan === 'free' && status === 'active') return freeAccess();

  // Legacy trial / expired states are migrated lazily the next time the user
  // opens Scoutly. This removes the old 7-day wall without requiring a client reset.
  await persistFreeFallback(userUid);
  return freeAccess();
}

export async function requireProductAccess(userUid: string): Promise<SubscriptionAccess> {
  return getSubscriptionAccess(userUid);
}

// Kept only for backward compatibility with old clients. Starting a trial now
// simply moves the legacy account to the permanent Free plan.
export async function startTrialForUser(userUid: string) {
  await persistFreeFallback(userUid);
  return {
    plan: 'free',
    status: 'active',
    current_period_start: null,
    current_period_end: null,
  };
}
