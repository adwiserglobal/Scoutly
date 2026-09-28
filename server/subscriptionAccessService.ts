import { appDataRequest, dbValue } from './appDataService.js';

export type SubscriptionAccess = {
  plan: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  hasAccess: boolean;
  reason: 'active' | 'free' | 'developer';
  isDeveloper: boolean;
};

const SCOUTLY_DEVELOPER_EMAILS = new Set([
  'eduardocamposmachadoalv@gmail.com',
  'digitalfistpower@gmail.com',
]);

function freeAccess(): SubscriptionAccess {
  return {
    plan: 'free',
    status: 'active',
    current_period_start: null,
    current_period_end: null,
    hasAccess: true,
    reason: 'free',
    isDeveloper: false,
  };
}

function developerAccess(): SubscriptionAccess {
  return {
    // Developer accounts intentionally inherit the complete Agency feature set,
    // while entitlementService marks their usage as unlimited server-side.
    plan: 'agency',
    status: 'active',
    current_period_start: null,
    current_period_end: null,
    hasAccess: true,
    reason: 'developer',
    isDeveloper: true,
  };
}

async function isScoutlyDeveloper(userUid: string) {
  const rows = await appDataRequest<Array<{ email?: string | null }>>(
    `app_users?firebase_uid=eq.${dbValue(userUid)}&select=email&limit=1`
  );
  const email = String(rows[0]?.email || '').trim().toLowerCase();
  return SCOUTLY_DEVELOPER_EMAILS.has(email);
}

export async function getSubscriptionAccess(userUid: string): Promise<SubscriptionAccess> {
  // This allowlist is deliberately server-side and exact-match only. Never use
  // domains, prefixes or client-provided email values for developer access.
  if (await isScoutlyDeveloper(userUid)) return developerAccess();

  const rows = await appDataRequest<any[]>(
    `subscriptions?user_uid=eq.${dbValue(userUid)}&select=plan,status,current_period_start,current_period_end&limit=1`
  );
  const subscription = rows[0] || null;
  if (!subscription) return freeAccess();

  const plan = String(subscription.plan || 'trial').toLowerCase();
  const status = String(subscription.status || 'pending').toLowerCase();
  const start = subscription.current_period_start || null;
  const end = subscription.current_period_end || null;

  if (['go', 'pro', 'agency'].includes(plan) && ['active', 'trialing', 'past_due'].includes(status)) {
    return {
      plan,
      status,
      current_period_start: start,
      current_period_end: end,
      hasAccess: true,
      reason: 'active',
      isDeveloper: false,
    };
  }

  // Trial, expired, canceled and inactive paid records are storage details only.
  // Product access now falls back to the permanent Free tier without mutating
  // the existing database enum/check constraints.
  return freeAccess();
}

export async function requireProductAccess(userUid: string): Promise<SubscriptionAccess> {
  return getSubscriptionAccess(userUid);
}

// Backward compatibility for old clients that still call the trial action.
export async function startTrialForUser(_userUid: string) {
  return {
    plan: 'free',
    status: 'active',
    current_period_start: null,
    current_period_end: null,
  };
}
