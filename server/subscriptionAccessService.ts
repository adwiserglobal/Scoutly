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

// Product-level developer grants are intentionally independent from Scoutly
// Internal staff access. Exact-match only; never grant by domain or client input.
const SCOUTLY_AGENCY_DEVELOPER_EMAILS = new Set([
  'eduardocamposmachadoalv@gmail.com',
  'digitalfistpower@gmail.com',
]);

const SCOUTLY_PRO_DEVELOPER_EMAILS = new Set([
  'rossivictor638@gmail.com',
]);

// Explicit Agency entitlement grants. These accounts get unlimited Agency
// usage but are not marked as internal developer accounts.
const SCOUTLY_AGENCY_UNLIMITED_EMAILS = new Set([
  'thamyflores@gmail.com',
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

function developerAccess(plan: 'pro' | 'agency'): SubscriptionAccess {
  return {
    // Developer accounts have unlimited usage through entitlementService, while
    // the plan value controls which product feature set is exposed.
    plan,
    status: 'active',
    current_period_start: null,
    current_period_end: null,
    hasAccess: true,
    reason: 'developer',
    isDeveloper: true,
  };
}

async function getScoutlyAccountEmail(userUid: string): Promise<string> {
  const rows = await appDataRequest<Array<{ email?: string | null }>>(
    `app_users?firebase_uid=eq.${dbValue(userUid)}&select=email&limit=1`
  );
  return String(rows[0]?.email || '').trim().toLowerCase();
}

function getDeveloperPlanForEmail(email: string): 'pro' | 'agency' | null {
  if (SCOUTLY_AGENCY_DEVELOPER_EMAILS.has(email)) return 'agency';
  if (SCOUTLY_PRO_DEVELOPER_EMAILS.has(email)) return 'pro';
  return null;
}

export async function getSubscriptionAccess(userUid: string): Promise<SubscriptionAccess> {
  // Email-based grants use an exact server-side match against the email saved
  // from the verified Firebase ID token. No client-provided email is trusted.
  const email = await getScoutlyAccountEmail(userUid);

  if (SCOUTLY_AGENCY_UNLIMITED_EMAILS.has(email)) {
    return {
      plan: 'agency',
      status: 'active',
      current_period_start: null,
      current_period_end: null,
      hasAccess: true,
      reason: 'active',
      isDeveloper: false,
    };
  }

  const developerPlan = getDeveloperPlanForEmail(email);
  if (developerPlan) return developerAccess(developerPlan);

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
