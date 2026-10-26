import { appDataRequest, dbValue } from './appDataService.js';
import { getDeveloperPlanByEmail, getSubscriptionAccess } from './subscriptionAccessService.js';

/**
 * Account management used by Scoutly Internal: manual plan grants and per-account feature switches.
 *
 * Manual grants are ordinary rows in `subscriptions` with provider = 'manual', so the whole product
 * (credits, AI, recommendations...) keeps reading a single source of truth. A grant may carry an end
 * date; subscriptionAccessService falls back to Free once a manual grant has expired.
 */

export const MANAGED_FEATURES = {
  ai: 'Scoutly AI e Agentic',
  recommendations: 'Recomendações e empresas novas',
  email_unlock: 'Liberar e-mail dos negócios',
  demo_sites: 'Sites de demonstração',
  flight: 'Modo voo',
} as const;

export type ManagedFeature = keyof typeof MANAGED_FEATURES;
export const MANAGED_FEATURE_KEYS = Object.keys(MANAGED_FEATURES) as ManagedFeature[];

const MANUAL_PLANS = new Set(['free', 'go', 'pro', 'agency']);
const ACTIVE_STATUSES = new Set(['active', 'trialing', 'past_due']);

function httpError(message: string, statusCode: number, code?: string): never {
  throw Object.assign(new Error(message), { statusCode, ...(code ? { code } : {}) });
}

// --- feature switches -------------------------------------------------------

const overrideCache = new Map<string, { at: number; disabled: Set<string> }>();
const OVERRIDE_TTL_MS = 20_000;

export async function getDisabledFeatures(userUid: string): Promise<Set<string>> {
  const cached = overrideCache.get(userUid);
  if (cached && Date.now() - cached.at < OVERRIDE_TTL_MS) return cached.disabled;
  let disabled = new Set<string>();
  try {
    const rows = await appDataRequest<Array<{ disabled_features?: string[] | null }>>(
      `account_overrides?user_uid=eq.${dbValue(userUid)}&select=disabled_features&limit=1`
    );
    disabled = new Set((rows[0]?.disabled_features || []).filter((key) => key in MANAGED_FEATURES));
  } catch {
    // Table not migrated yet: nothing is disabled.
  }
  overrideCache.set(userUid, { at: Date.now(), disabled });
  return disabled;
}

export async function assertFeatureEnabled(userUid: string, feature: ManagedFeature) {
  const disabled = await getDisabledFeatures(userUid);
  if (disabled.has(feature)) {
    httpError(
      'Este recurso foi desativado para a sua conta. Fale com o suporte da Scoutly para saber mais.',
      403,
      'FEATURE_DISABLED_BY_ADMIN',
    );
  }
}

export async function setDisabledFeatures(userUid: string, features: unknown, staffUid: string, note?: string) {
  const list = Array.from(new Set(
    (Array.isArray(features) ? features : []).map(String).filter((key) => key in MANAGED_FEATURES)
  ));
  await appDataRequest('account_overrides?on_conflict=user_uid', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      user_uid: userUid,
      disabled_features: list,
      note: note ? String(note).slice(0, 500) : null,
      updated_by: staffUid,
      updated_at: new Date().toISOString(),
    }),
  });
  overrideCache.delete(userUid);
  return list;
}

// --- subscription view and manual grants -----------------------------------

export async function getManagedAccount(userUid: string) {
  if (!userUid) httpError('Usuário inválido.', 400);
  const [users, subscriptions, overrides, access, disabled] = await Promise.all([
    appDataRequest<any[]>(`app_users?firebase_uid=eq.${dbValue(userUid)}&select=firebase_uid,email,display_name&limit=1`),
    appDataRequest<any[]>(`subscriptions?user_uid=eq.${dbValue(userUid)}&select=*&limit=1`),
    appDataRequest<any[]>(`account_overrides?user_uid=eq.${dbValue(userUid)}&select=note,updated_by,updated_at&limit=1`).catch(() => []),
    getSubscriptionAccess(userUid),
    getDisabledFeatures(userUid),
  ]);
  const user = users[0];
  if (!user) httpError('Usuário não encontrado.', 404);
  const subscription = subscriptions[0] || null;
  const developerPlan = getDeveloperPlanByEmail(user.email);
  const stripeManaged = Boolean(
    subscription?.provider_subscription_id &&
    subscription.provider !== 'manual' &&
    ACTIVE_STATUSES.has(String(subscription.status || '').toLowerCase())
  );

  return {
    user,
    subscription,
    effective: {
      plan: access.plan,
      status: access.status,
      reason: access.reason,
      isDeveloper: access.isDeveloper,
      viaTeam: Boolean(access.viaTeam),
      periodEnd: access.current_period_end,
    },
    origin: developerPlan ? 'developer' : stripeManaged ? 'stripe' : subscription?.provider === 'manual' ? 'manual' : 'none',
    developerPlan,
    stripeManaged,
    features: MANAGED_FEATURE_KEYS.map((key) => ({ key, label: MANAGED_FEATURES[key], enabled: !disabled.has(key) })),
    overrideNote: overrides[0]?.note || null,
  };
}

export async function setManagedPlan(
  userUid: string,
  input: { plan: unknown; days?: unknown; until?: unknown },
) {
  const plan = String(input.plan || '').toLowerCase();
  if (!MANUAL_PLANS.has(plan)) httpError('Plano inválido.', 400);

  const current = await getManagedAccount(userUid);
  if (current.developerPlan) {
    httpError('Esta conta tem acesso Developer definido no código; o plano não pode ser alterado por aqui.', 409, 'DEVELOPER_ACCOUNT');
  }
  if (current.stripeManaged) {
    httpError('Esta conta tem uma assinatura ativa no Stripe. Altere ou cancele pelo Stripe para não gerar cobrança duplicada.', 409, 'STRIPE_SUBSCRIPTION_ACTIVE');
  }

  const now = new Date();
  let periodEnd: string | null = null;
  if (plan !== 'free') {
    const until = input.until ? new Date(String(input.until)) : null;
    const days = Number(input.days);
    if (until && Number.isFinite(until.getTime())) {
      if (until.getTime() <= now.getTime()) httpError('A data de término precisa ser futura.', 400);
      periodEnd = until.toISOString();
    } else if (Number.isFinite(days) && days > 0) {
      periodEnd = new Date(now.getTime() + Math.min(days, 3650) * 86_400_000).toISOString();
    }
  }

  const row = plan === 'free'
    ? { user_uid: userUid, provider: 'manual', plan: 'expired', status: 'canceled', current_period_start: null, current_period_end: null, cancel_at_period_end: false }
    : { user_uid: userUid, provider: 'manual', plan, status: 'active', current_period_start: now.toISOString(), current_period_end: periodEnd, cancel_at_period_end: false };

  await appDataRequest('subscriptions?on_conflict=user_uid', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ ...row, updated_at: now.toISOString() }),
  });
  return { plan, periodEnd, previousPlan: current.effective.plan };
}
