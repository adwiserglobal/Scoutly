import { appDataRequest, dbValue } from './appDataService.js';

export type PaidPlan = 'go' | 'pro' | 'agency';

function requireStripeSecret() {
  const secret = String(process.env.STRIPE_SECRET_KEY || '').trim();
  if (!secret) {
    throw Object.assign(new Error('STRIPE_SECRET_KEY não configurada'), { statusCode: 503 });
  }
  return secret;
}

export function getStripePriceByPlan(): Record<PaidPlan, string> {
  return {
    go: String(process.env.STRIPE_PRICE_GO || '').trim(),
    pro: String(process.env.STRIPE_PRICE_PRO || '').trim(),
    agency: String(process.env.STRIPE_PRICE_AGENCY || '').trim(),
  };
}

export function normalizePaidPlan(value: unknown): PaidPlan | null {
  const plan = String(value || '').toLowerCase();
  return plan === 'go' || plan === 'pro' || plan === 'agency' ? plan : null;
}

export function planFromStripePrice(priceId: unknown): PaidPlan | null {
  const id = String(priceId || '');
  if (!id) return null;

  const prices = getStripePriceByPlan();
  if (id === prices.go) return 'go';
  if (id === prices.pro) return 'pro';
  if (id === prices.agency) return 'agency';
  return null;
}

function asStripeId(value: any): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value?.id === 'string') return value.id;
  return null;
}

function unixToIso(value: unknown): string | null {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
}

async function stripeRequest<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const secret = requireStripeSecret();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${secret}`);

  const response = await fetch(`https://api.stripe.com/v1/${path.replace(/^\//, '')}`, {
    ...init,
    headers,
    signal: init.signal || AbortSignal.timeout(12000),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || `Stripe HTTP ${response.status}`;
    throw Object.assign(new Error(message), { statusCode: response.status >= 500 ? 502 : 400 });
  }

  return data as T;
}

export async function retrieveStripeCheckoutSession(sessionId: string) {
  return stripeRequest<any>(`checkout/sessions/${encodeURIComponent(sessionId)}`);
}

export async function retrieveStripeSubscription(subscriptionId: string) {
  return stripeRequest<any>(`subscriptions/${encodeURIComponent(subscriptionId)}`);
}

async function findExistingSubscription(userUid?: string | null, subscriptionId?: string | null, customerId?: string | null) {
  if (userUid) {
    const rows = await appDataRequest<any[]>(
      `subscriptions?user_uid=eq.${dbValue(userUid)}&select=user_uid,plan,status,provider_customer_id,provider_subscription_id,last_provider_event_at,last_provider_event_id&limit=1`
    );
    if (rows[0]) return rows[0];
  }

  if (subscriptionId) {
    const rows = await appDataRequest<any[]>(
      `subscriptions?provider_subscription_id=eq.${dbValue(subscriptionId)}&select=user_uid,plan,status,provider_customer_id,provider_subscription_id,last_provider_event_at,last_provider_event_id&limit=1`
    );
    if (rows[0]) return rows[0];
  }

  if (customerId) {
    const rows = await appDataRequest<any[]>(
      `subscriptions?provider_customer_id=eq.${dbValue(customerId)}&select=user_uid,plan,status,provider_customer_id,provider_subscription_id,last_provider_event_at,last_provider_event_id&limit=1`
    );
    if (rows[0]) return rows[0];
  }

  return null;
}

export async function syncStripeSubscription(
  stripeSubscription: any,
  hints: {
    userUid?: string | null;
    plan?: PaidPlan | null;
    providerEventAt?: string | null;
    providerEventId?: string | null;
  } = {}
) {
  const subscriptionId = asStripeId(stripeSubscription?.id);
  const customerId = asStripeId(stripeSubscription?.customer);
  const metadata = stripeSubscription?.metadata || {};
  let userUid = String(metadata?.firebase_uid || hints.userUid || '').trim() || null;

  let existing = await findExistingSubscription(userUid, subscriptionId, customerId);
  if (!userUid) userUid = String(existing?.user_uid || '').trim() || null;
  if (!userUid) {
    throw Object.assign(new Error('Não foi possível associar a assinatura Stripe a um usuário Scoutly.'), {
      statusCode: 422,
    });
  }

  const subscriptionItems = Array.isArray(stripeSubscription?.items?.data)
    ? stripeSubscription.items.data
    : [];
  const firstItem = subscriptionItems[0] || null;
  const planFromCurrentPrice =
    subscriptionItems
      .map((item: any) => planFromStripePrice(asStripeId(item?.price) || asStripeId(item?.plan)))
      .find(Boolean) || null;

  // The current Stripe price is the source of truth after an upgrade/downgrade.
  // Subscription metadata is only a fallback because Stripe Portal price changes
  // do not automatically rewrite metadata.plan.
  const plan =
    planFromCurrentPrice ||
    normalizePaidPlan(metadata?.plan) ||
    normalizePaidPlan(hints.plan) ||
    normalizePaidPlan(existing?.plan);

  if (!plan) {
    throw Object.assign(new Error('Plano da assinatura Stripe não reconhecido.'), { statusCode: 422 });
  }

  const status = String(stripeSubscription?.status || 'active');
  const periodStart =
    unixToIso(stripeSubscription?.current_period_start) ||
    unixToIso(firstItem?.current_period_start);
  const periodEnd =
    unixToIso(stripeSubscription?.current_period_end) ||
    unixToIso(firstItem?.current_period_end);

  const incomingEventAt = parseTime(hints.providerEventAt);
  const existingEventAt = parseTime(existing?.last_provider_event_at);

  if (
    incomingEventAt &&
    existingEventAt &&
    incomingEventAt <= existingEventAt &&
    String(existing?.provider_subscription_id || '') !== String(subscriptionId || '')
  ) {
    return {
      user_uid: userUid,
      provider: 'stripe',
      provider_customer_id: existing?.provider_customer_id || customerId,
      provider_subscription_id: existing?.provider_subscription_id || subscriptionId,
      plan: normalizePaidPlan(existing?.plan) || plan,
      status: String(existing?.status || status),
      current_period_start: null,
      current_period_end: null,
      cancel_at_period_end: false,
      last_provider_event_at: existing?.last_provider_event_at || null,
      last_provider_event_id: existing?.last_provider_event_id || null,
      ignored_stale_event: true,
    };
  }

  const row = {
    user_uid: userUid,
    provider: 'stripe',
    provider_customer_id: customerId,
    provider_subscription_id: subscriptionId,
    plan,
    status,
    current_period_start: periodStart,
    current_period_end: periodEnd,
    cancel_at_period_end: Boolean(stripeSubscription?.cancel_at_period_end),
    last_provider_event_at: hints.providerEventAt || null,
    last_provider_event_id: hints.providerEventId || null,
    updated_at: new Date().toISOString(),
  };

  await appDataRequest('subscriptions?on_conflict=user_uid', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row),
  });

  const hasPaidAccess = ['active', 'trialing', 'past_due'].includes(status);
  await appDataRequest(`workspaces?owner_uid=eq.${dbValue(userUid)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      plan: hasPaidAccess ? plan : 'expired',
      updated_at: new Date().toISOString(),
    }),
  }).catch(() => undefined);

  return row;
}

export async function confirmStripeCheckoutSession(sessionId: string, expectedUserUid: string) {
  const session = await retrieveStripeCheckoutSession(sessionId);
  const sessionUserUid = String(
    session?.client_reference_id || session?.metadata?.firebase_uid || ''
  ).trim();

  if (!sessionUserUid || sessionUserUid !== expectedUserUid) {
    throw Object.assign(new Error('Esta sessão de pagamento não pertence ao usuário autenticado.'), {
      statusCode: 403,
    });
  }

  if (String(session?.status || '') !== 'complete') {
    throw Object.assign(new Error('O checkout da Stripe ainda não foi concluído.'), { statusCode: 409 });
  }

  const paymentStatus = String(session?.payment_status || '');
  if (paymentStatus && !['paid', 'no_payment_required'].includes(paymentStatus)) {
    throw Object.assign(new Error('O pagamento ainda não foi confirmado pela Stripe.'), { statusCode: 409 });
  }

  const subscriptionId = asStripeId(session?.subscription);
  if (!subscriptionId) {
    throw Object.assign(new Error('Assinatura Stripe não encontrada na sessão de checkout.'), {
      statusCode: 409,
    });
  }

  const stripeSubscription = await retrieveStripeSubscription(subscriptionId);
  const row = await syncStripeSubscription(stripeSubscription, {
    userUid: expectedUserUid,
    plan: normalizePaidPlan(session?.metadata?.plan),
    providerEventAt: new Date().toISOString(),
    providerEventId: `checkout-confirm:${sessionId}`,
  });

  return { session, subscription: row };
}

export async function refreshStripeSubscriptionForUser(userUid: string) {
  const rows = await appDataRequest<any[]>(
    `subscriptions?user_uid=eq.${dbValue(userUid)}&select=provider_subscription_id,plan,status&limit=1`
  );
  const existing = rows[0] || null;
  const subscriptionId = String(existing?.provider_subscription_id || '').trim();

  if (!subscriptionId.startsWith('sub_')) {
    throw Object.assign(new Error('Assinatura Stripe ainda não associada a esta conta.'), {
      statusCode: 409,
    });
  }

  const stripeSubscription = await retrieveStripeSubscription(subscriptionId);
  return syncStripeSubscription(stripeSubscription, {
    userUid,
    plan: normalizePaidPlan(existing?.plan),
    providerEventAt: new Date().toISOString(),
    providerEventId: `manual-refresh:${subscriptionId}`,
  });
}

export async function createStripeBillingPortal(
  userUid: string,
  returnUrl: string,
  targetPlan?: PaidPlan | null
) {
  const rows = await appDataRequest<any[]>(
    `subscriptions?user_uid=eq.${dbValue(userUid)}&select=provider_customer_id,provider_subscription_id,plan,status&limit=1`
  );
  const subscription = rows[0] || null;
  const customerId = String(subscription?.provider_customer_id || '').trim();
  const subscriptionId = String(subscription?.provider_subscription_id || '').trim();

  if (!customerId) {
    throw Object.assign(new Error('Cliente Stripe ainda não associado a esta conta.'), {
      statusCode: 409,
    });
  }

  const buildBaseParams = () => {
    const params = new URLSearchParams();
    params.set('customer', customerId);
    params.set('return_url', returnUrl);

    const portalConfiguration = String(process.env.STRIPE_PORTAL_CONFIGURATION_ID || '').trim();
    if (portalConfiguration.startsWith('bpc_')) {
      params.set('configuration', portalConfiguration);
    }

    return params;
  };

  let params = buildBaseParams();

  if (targetPlan && subscriptionId.startsWith('sub_')) {
    const targetPrice = getStripePriceByPlan()[targetPlan];

    if (targetPrice?.startsWith('price_')) {
      const stripeSubscription = await retrieveStripeSubscription(subscriptionId);
      const firstItem = Array.isArray(stripeSubscription?.items?.data)
        ? stripeSubscription.items.data[0]
        : null;
      const itemId = String(firstItem?.id || '').trim();

      if (itemId.startsWith('si_')) {
        params.set('flow_data[type]', 'subscription_update_confirm');
        params.set(
          'flow_data[after_completion][type]',
          'redirect'
        );
        params.set(
          'flow_data[after_completion][redirect][return_url]',
          returnUrl
        );
        params.set(
          'flow_data[subscription_update_confirm][subscription]',
          subscriptionId
        );
        params.set(
          'flow_data[subscription_update_confirm][items][0][id]',
          itemId
        );
        params.set(
          'flow_data[subscription_update_confirm][items][0][price]',
          targetPrice
        );
        params.set(
          'flow_data[subscription_update_confirm][items][0][quantity]',
          '1'
        );
      }
    }
  }

  const createPortal = (body: URLSearchParams) =>
    stripeRequest<any>('billing_portal/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

  let portal: any;
  try {
    portal = await createPortal(params);
  } catch (error) {
    // A direct plan-change flow requires the target price to be enabled in the
    // Stripe Portal configuration. Fall back to the portal homepage so billing
    // remains manageable even when the configuration is not ready yet.
    if (!targetPlan) throw error;
    params = buildBaseParams();
    portal = await createPortal(params);
  }

  if (!portal?.url) {
    throw Object.assign(new Error('A Stripe não retornou uma URL do portal de cobrança.'), {
      statusCode: 502,
    });
  }

  return {
    id: String(portal.id || ''),
    url: String(portal.url),
  };
}
