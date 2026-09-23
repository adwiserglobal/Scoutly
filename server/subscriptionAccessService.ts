import { appDataRequest, dbValue } from './appDataService.js';

export type SubscriptionAccess = {
  plan: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  hasAccess: boolean;
  reason: 'active' | 'trial_pending' | 'trial_expired' | 'subscription_required';
};

function httpError(message: string, statusCode: number, code: string): never {
  throw Object.assign(new Error(message), { statusCode, code });
}

export async function getSubscriptionAccess(userUid: string): Promise<SubscriptionAccess> {
  const rows = await appDataRequest<any[]>(
    `subscriptions?user_uid=eq.${dbValue(userUid)}&select=plan,status,current_period_start,current_period_end&limit=1`
  );
  const subscription = rows[0] || null;

  if (!subscription) {
    return {
      plan: 'trial',
      status: 'pending',
      current_period_start: null,
      current_period_end: null,
      hasAccess: false,
      reason: 'trial_pending',
    };
  }

  const plan = String(subscription.plan || 'trial');
  const status = String(subscription.status || 'pending');
  const start = subscription.current_period_start || null;
  const end = subscription.current_period_end || null;

  if (['go', 'pro', 'agency'].includes(plan)) {
    const paidActive = ['active', 'trialing', 'past_due'].includes(status);
    return {
      plan,
      status,
      current_period_start: start,
      current_period_end: end,
      hasAccess: paidActive,
      reason: paidActive ? 'active' : 'subscription_required',
    };
  }

  if (plan === 'trial' && status === 'pending') {
    return {
      plan,
      status,
      current_period_start: start,
      current_period_end: end,
      hasAccess: false,
      reason: 'trial_pending',
    };
  }

  if (plan === 'trial' && status === 'trialing') {
    const endAt = end ? new Date(end).getTime() : 0;
    if (endAt > Date.now()) {
      return {
        plan,
        status,
        current_period_start: start,
        current_period_end: end,
        hasAccess: true,
        reason: 'active',
      };
    }

    // Persist expiry so every subsequent request sees the same entitlement state.
    await appDataRequest(`subscriptions?user_uid=eq.${dbValue(userUid)}&plan=eq.trial&status=eq.trialing`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        plan: 'expired',
        status: 'expired',
        updated_at: new Date().toISOString(),
      }),
    }).catch(() => undefined);

    return {
      plan: 'expired',
      status: 'expired',
      current_period_start: start,
      current_period_end: end,
      hasAccess: false,
      reason: 'trial_expired',
    };
  }

  return {
    plan,
    status,
    current_period_start: start,
    current_period_end: end,
    hasAccess: false,
    reason: plan === 'expired' ? 'trial_expired' : 'subscription_required',
  };
}

export async function requireProductAccess(userUid: string): Promise<SubscriptionAccess> {
  const access = await getSubscriptionAccess(userUid);
  if (access.hasAccess) return access;

  if (access.reason === 'trial_pending') {
    httpError('Inicie seu período de teste de 7 dias para usar a Scoutly.', 402, 'TRIAL_NOT_STARTED');
  }

  if (access.reason === 'trial_expired') {
    httpError('Seu período de teste terminou. Escolha um plano para continuar usando a Scoutly.', 402, 'TRIAL_EXPIRED');
  }

  httpError('É necessário um plano ativo para continuar usando a Scoutly.', 402, 'SUBSCRIPTION_REQUIRED');
}

export async function startTrialForUser(userUid: string) {
  const rows = await appDataRequest<any[]>(
    `subscriptions?user_uid=eq.${dbValue(userUid)}&select=plan,status,current_period_start,current_period_end,provider_subscription_id&limit=1`
  );
  const current = rows[0] || null;

  if (!current) {
    httpError('Não foi possível localizar sua assinatura.', 409, 'SUBSCRIPTION_NOT_FOUND');
  }

  const plan = String(current.plan || 'trial');
  const status = String(current.status || 'pending');

  if (['go', 'pro', 'agency'].includes(plan) && ['active', 'trialing', 'past_due'].includes(status)) {
    return current;
  }

  if (plan === 'trial' && status === 'trialing' && current.current_period_end) {
    const end = new Date(current.current_period_end).getTime();
    if (end > Date.now()) return current;
    httpError('Seu período de teste já foi utilizado.', 409, 'TRIAL_ALREADY_USED');
  }

  if (plan !== 'trial' || status !== 'pending') {
    httpError('Seu período de teste não pode ser iniciado novamente.', 409, 'TRIAL_ALREADY_USED');
  }

  const startedAt = new Date();
  const endsAt = new Date(startedAt.getTime() + 7 * 24 * 60 * 60 * 1000);

  const updated = await appDataRequest<any[]>(
    `subscriptions?user_uid=eq.${dbValue(userUid)}&plan=eq.trial&status=eq.pending&select=plan,status,current_period_start,current_period_end`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        status: 'trialing',
        current_period_start: startedAt.toISOString(),
        current_period_end: endsAt.toISOString(),
        cancel_at_period_end: false,
        updated_at: startedAt.toISOString(),
      }),
    }
  );

  if (!updated[0]) {
    // Handles a double click/racing tab safely without granting a second trial.
    const afterRace = await appDataRequest<any[]>(
      `subscriptions?user_uid=eq.${dbValue(userUid)}&select=plan,status,current_period_start,current_period_end&limit=1`
    );
    const raced = afterRace[0];
    if (raced?.plan === 'trial' && raced?.status === 'trialing') return raced;
    httpError('Não foi possível iniciar o período de teste.', 409, 'TRIAL_START_CONFLICT');
  }

  return updated[0];
}
