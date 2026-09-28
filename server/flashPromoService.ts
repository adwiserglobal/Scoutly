import { appDataRequest, dbValue } from './appDataService.js';
import { getCreditStatus } from './entitlementService.js';

const FLASH_PROMO_LEDGER_QUERY = '__scoutly_credit_flash_promo_v1__';
const FLASH_PROMO_EVENT_TYPE = 'search';
const FLASH_PROMO_DURATION_MS = 12 * 60 * 60 * 1000;
const FLASH_PROMO_PRICE_CENTS = 3599;
const DEFAULT_FLASH_REFERENCE_PRICE_ID = 'price_1UK8nNK8NvQmIFt40V91vlyk';

export type FlashPromoStatus = {
  eligible: boolean;
  active: boolean;
  startsAt: string | null;
  expiresAt: string | null;
  remainingSeconds: number;
  offerPriceCents: number;
  firstMonthOnly: true;
  reason:
    | 'active'
    | 'waiting_for_first_five'
    | 'missed_first_five'
    | 'expired'
    | 'not_free'
    | 'prior_pro';
};

type SubscriptionRow = {
  plan?: string | null;
  status?: string | null;
  provider_customer_id?: string | null;
  provider_subscription_id?: string | null;
};

function httpError(message: string, statusCode: number, code: string): never {
  throw Object.assign(new Error(message), { statusCode, code });
}

function requireStripeSecret() {
  const secret = String(process.env.STRIPE_SECRET_KEY || '').trim();
  if (!secret) httpError('STRIPE_SECRET_KEY não configurada.', 503, 'STRIPE_NOT_CONFIGURED');
  return secret;
}

function flashReferencePriceId() {
  return String(
    process.env.STRIPE_PRICE_PRO_FLASH || DEFAULT_FLASH_REFERENCE_PRICE_ID
  ).trim();
}

function normalProPriceId() {
  const price = String(process.env.STRIPE_PRICE_PRO || '').trim();
  if (!price.startsWith('price_')) {
    httpError('Preço padrão do Scoutly Pro não configurado.', 503, 'PRO_PRICE_NOT_CONFIGURED');
  }
  return price;
}

async function stripeJson<T>(
  path: string,
  init: RequestInit = {},
  options: { allow404?: boolean } = {},
): Promise<T | null> {
  const secret = requireStripeSecret();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${secret}`);

  const response = await fetch(`https://api.stripe.com/v1/${path.replace(/^\//, '')}`, {
    ...init,
    headers,
    signal: init.signal || AbortSignal.timeout(12000),
  });

  if (options.allow404 && response.status === 404) return null;

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    httpError(
      data?.error?.message || `Stripe HTTP ${response.status}`,
      response.status >= 500 ? 502 : 400,
      'STRIPE_REQUEST_FAILED',
    );
  }
  return data as T;
}

async function getSubscriptionRow(userUid: string): Promise<SubscriptionRow | null> {
  const rows = await appDataRequest<SubscriptionRow[]>(
    `subscriptions?user_uid=eq.${dbValue(userUid)}` +
      '&select=plan,status,provider_customer_id,provider_subscription_id&limit=1'
  );
  return rows[0] || null;
}

function priceIdFromInvoiceLine(line: any): string {
  return String(
    line?.price?.id ||
      line?.price ||
      line?.pricing?.price_details?.price ||
      line?.plan?.id ||
      line?.plan ||
      ''
  ).trim();
}

export async function hasPurchasedProBefore(userUid: string) {
  const subscription = await getSubscriptionRow(userUid);
  const normalPrice = normalProPriceId();
  const flashPrice = flashReferencePriceId();

  // A persisted Pro subscription is already enough to disqualify the
  // first-purchase promotion, even if that subscription is now canceled.
  if (String(subscription?.plan || '').toLowerCase() === 'pro' && subscription?.provider_subscription_id) {
    return true;
  }

  const customerId = String(subscription?.provider_customer_id || '').trim();
  if (!customerId.startsWith('cus_')) return false;

  const params = new URLSearchParams({
    customer: customerId,
    status: 'paid',
    limit: '100',
  });
  const invoices = await stripeJson<any>(`invoices?${params.toString()}`);
  const rows = Array.isArray(invoices?.data) ? invoices.data : [];

  for (const invoice of rows) {
    const lines = Array.isArray(invoice?.lines?.data) ? invoice.lines.data : [];
    if (lines.some((line: any) => {
      const priceId = priceIdFromInvoiceLine(line);
      return priceId === normalPrice || priceId === flashPrice;
    })) {
      return true;
    }
  }

  return false;
}

async function getFlashLedgerRow(userUid: string) {
  const rows = await appDataRequest<Array<{ id: string; created_at: string }>>(
    `recommendation_events?user_uid=eq.${dbValue(userUid)}` +
      `&event_type=eq.${dbValue(FLASH_PROMO_EVENT_TYPE)}` +
      `&query=eq.${dbValue(FLASH_PROMO_LEDGER_QUERY)}` +
      '&select=id,created_at&order=created_at.asc,id.asc&limit=1'
  );
  return rows[0] || null;
}

async function createFlashLedgerRow(userUid: string, workspaceId: string) {
  // recommendation_events already acts as Scoutly's durable credit ledger. Using
  // a dedicated sentinel keeps the 12-hour window server-side without trusting
  // localStorage and without widening the legacy event_type DB constraint.
  await appDataRequest('recommendation_events', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      user_uid: userUid,
      workspace_id: workspaceId,
      event_type: FLASH_PROMO_EVENT_TYPE,
      query: FLASH_PROMO_LEDGER_QUERY,
      metadata: {
        scoutly_ledger: true,
        kind: 'flash_pro_first_purchase',
        offer_price_cents: FLASH_PROMO_PRICE_CENTS,
        duration_hours: 12,
      },
    }),
  });
  return getFlashLedgerRow(userUid);
}

function statusFromStart(startsAt: string): FlashPromoStatus {
  const startMs = new Date(startsAt).getTime();
  const expiresMs = startMs + FLASH_PROMO_DURATION_MS;
  const now = Date.now();
  const active = Number.isFinite(startMs) && expiresMs > now;

  return {
    eligible: active,
    active,
    startsAt,
    expiresAt: new Date(expiresMs).toISOString(),
    remainingSeconds: active ? Math.max(0, Math.ceil((expiresMs - now) / 1000)) : 0,
    offerPriceCents: FLASH_PROMO_PRICE_CENTS,
    firstMonthOnly: true,
    reason: active ? 'active' : 'expired',
  };
}

function inactiveStatus(reason: FlashPromoStatus['reason']): FlashPromoStatus {
  return {
    eligible: false,
    active: false,
    startsAt: null,
    expiresAt: null,
    remainingSeconds: 0,
    offerPriceCents: FLASH_PROMO_PRICE_CENTS,
    firstMonthOnly: true,
    reason,
  };
}

export async function getFlashPromoStatus(userUid: string, workspaceId: string) {
  const access = await getCreditStatus(userUid);
  if (!access.isFree || access.isDeveloper) return inactiveStatus('not_free');

  const existing = await getFlashLedgerRow(userUid);
  if (existing?.created_at) return statusFromStart(existing.created_at);

  // This campaign is intentionally tied to the user's first five lifetime Free
  // business opens. Users already beyond that exact milestone do not receive a
  // retroactive offer when this feature ships.
  if (access.monthlyUsed < 5) return inactiveStatus('waiting_for_first_five');
  if (access.monthlyUsed > 5) return inactiveStatus('missed_first_five');

  if (await hasPurchasedProBefore(userUid)) return inactiveStatus('prior_pro');

  const created = await createFlashLedgerRow(userUid, workspaceId);
  if (!created?.created_at) {
    httpError('Não foi possível liberar sua Flash Promo agora.', 409, 'FLASH_PROMO_START_FAILED');
  }
  return statusFromStart(created.created_at);
}

async function ensureFlashCoupon(normalPrice: any, flashPrice: any) {
  const normalAmount = Number(normalPrice?.unit_amount);
  const offerAmount = Number(flashPrice?.unit_amount);
  const currency = String(normalPrice?.currency || '').toLowerCase();

  if (!Number.isInteger(normalAmount) || normalAmount <= FLASH_PROMO_PRICE_CENTS) {
    httpError('O preço padrão do Pro não permite aplicar esta promoção.', 409, 'FLASH_PROMO_PRICE_INVALID');
  }
  if (offerAmount !== FLASH_PROMO_PRICE_CENTS) {
    httpError('O preço de referência da Flash Promo não corresponde a R$ 35,99.', 409, 'FLASH_PROMO_REFERENCE_INVALID');
  }
  if (!currency || currency !== String(flashPrice?.currency || '').toLowerCase()) {
    httpError('Os preços da Flash Promo usam moedas diferentes.', 409, 'FLASH_PROMO_CURRENCY_MISMATCH');
  }

  const amountOff = normalAmount - offerAmount;
  const safeNormalSuffix = String(normalPrice?.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(-14);
  const couponId = `scoutly_flash_${safeNormalSuffix}_${FLASH_PROMO_PRICE_CENTS}_v1`;

  const existing = await stripeJson<any>(`coupons/${encodeURIComponent(couponId)}`, {}, { allow404: true });
  if (existing?.valid !== false && existing?.id) return existing;

  const params = new URLSearchParams();
  params.set('id', couponId);
  params.set('duration', 'once');
  params.set('amount_off', String(amountOff));
  params.set('currency', currency);
  params.set('name', 'Scoutly Flash Promo — Pro primeiro mês');
  params.set('metadata[scoutly_campaign]', 'flash_promo_v1');
  params.set('metadata[target_first_month_cents]', String(FLASH_PROMO_PRICE_CENTS));

  try {
    return await stripeJson<any>('coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
  } catch (error: any) {
    // Two simultaneous tabs can race to create the deterministic coupon. If the
    // other request won, retrieve and reuse the same coupon.
    const raced = await stripeJson<any>(`coupons/${encodeURIComponent(couponId)}`, {}, { allow404: true });
    if (raced?.id) return raced;
    throw error;
  }
}

export async function createFlashPromoCheckout(options: {
  userUid: string;
  email: string | null;
  workspaceId: string;
  origin: string;
}) {
  const promo = await getFlashPromoStatus(options.userUid, options.workspaceId);
  if (!promo.active || !promo.expiresAt) {
    httpError('Sua Scoutly Flash Promo não está mais disponível.', 409, 'FLASH_PROMO_UNAVAILABLE');
  }

  if (await hasPurchasedProBefore(options.userUid)) {
    httpError('Esta promoção é válida apenas na primeira compra do Scoutly Pro.', 409, 'FLASH_PROMO_FIRST_PRO_ONLY');
  }

  const normalPriceId = normalProPriceId();
  const referencePriceId = flashReferencePriceId();
  if (!referencePriceId.startsWith('price_')) {
    httpError('Preço de referência da Flash Promo inválido.', 503, 'FLASH_PROMO_REFERENCE_NOT_CONFIGURED');
  }

  const [normalPrice, flashPrice, subscription] = await Promise.all([
    stripeJson<any>(`prices/${encodeURIComponent(normalPriceId)}`),
    stripeJson<any>(`prices/${encodeURIComponent(referencePriceId)}`),
    getSubscriptionRow(options.userUid),
  ]);

  if (normalPrice?.active === false || flashPrice?.active === false) {
    httpError('A Flash Promo está temporariamente indisponível.', 409, 'FLASH_PROMO_PRICE_INACTIVE');
  }
  if (normalPrice?.recurring?.interval !== 'month') {
    httpError('O Scoutly Pro precisa estar configurado como plano mensal.', 409, 'PRO_PRICE_INTERVAL_INVALID');
  }

  const coupon = await ensureFlashCoupon(normalPrice, flashPrice);
  if (!coupon?.id) httpError('Não foi possível preparar o desconto da Flash Promo.', 502, 'FLASH_PROMO_COUPON_FAILED');

  const params = new URLSearchParams();
  params.set('mode', 'subscription');
  params.set('line_items[0][price]', normalPriceId);
  params.set('line_items[0][quantity]', '1');
  params.set('discounts[0][coupon]', String(coupon.id));
  params.set('success_url', `${options.origin}/dashboard?billing=success&flash=1&session_id={CHECKOUT_SESSION_ID}`);
  params.set('cancel_url', `${options.origin}/dashboard?billing=cancel&flash=1`);
  params.set('client_reference_id', options.userUid);
  params.set('metadata[firebase_uid]', options.userUid);
  params.set('metadata[plan]', 'pro');
  params.set('metadata[flash_promo]', 'true');
  params.set('metadata[flash_promo_expires_at]', promo.expiresAt);
  params.set('metadata[flash_reference_price]', referencePriceId);
  params.set('subscription_data[metadata][firebase_uid]', options.userUid);
  params.set('subscription_data[metadata][plan]', 'pro');
  params.set('subscription_data[metadata][flash_promo]', 'true');
  params.set('subscription_data[metadata][flash_reference_price]', referencePriceId);

  const customerId = String(subscription?.provider_customer_id || '').trim();
  if (customerId.startsWith('cus_')) params.set('customer', customerId);
  else if (options.email) params.set('customer_email', options.email);

  // Stripe permits Checkout Session expiry between 30 minutes and 24 hours.
  // When enough campaign time remains, align the Checkout expiry with the
  // actual 12-hour server deadline as an extra guardrail.
  const expiresMs = new Date(promo.expiresAt).getTime();
  if (expiresMs - Date.now() >= 31 * 60 * 1000) {
    params.set('expires_at', String(Math.floor(expiresMs / 1000)));
  }

  const session = await stripeJson<any>('checkout/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!session?.url) httpError('A Stripe não retornou uma URL de checkout.', 502, 'FLASH_PROMO_CHECKOUT_FAILED');

  return {
    id: String(session.id || ''),
    url: String(session.url),
    expiresAt: promo.expiresAt,
    offerPriceCents: FLASH_PROMO_PRICE_CENTS,
  };
}
