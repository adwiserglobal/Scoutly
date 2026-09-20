import { createHmac, timingSafeEqual } from 'node:crypto';
import { appDataRequest, dbValue } from '../server/appDataService.js';
import {
  normalizePaidPlan,
  retrieveStripeSubscription,
  syncStripeSubscription,
} from '../server/stripeBillingService.js';

function verifyStripeSignature(rawBody: string, signatureHeader: string, secret: string) {
  const parts = signatureHeader.split(',').map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith('t='))?.slice(2) || '';
  const signatures = parts
    .filter((part) => part.startsWith('v1='))
    .map((part) => part.slice(3))
    .filter(Boolean);

  if (!timestamp || signatures.length === 0) return false;

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;

  const age = Math.abs(Date.now() / 1000 - timestampSeconds);
  if (age > 300) return false;

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`, 'utf8')
    .digest('hex');

  const expectedBuffer = Buffer.from(expected, 'utf8');

  return signatures.some((signature) => {
    const candidate = Buffer.from(signature, 'utf8');
    return candidate.length === expectedBuffer.length && timingSafeEqual(candidate, expectedBuffer);
  });
}

function stripeId(value: any): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return typeof value?.id === 'string' ? value.id : null;
}

function invoiceSubscriptionId(invoice: any): string | null {
  return (
    stripeId(invoice?.subscription) ||
    stripeId(invoice?.parent?.subscription_details?.subscription) ||
    null
  );
}

async function alreadyProcessed(eventId: string) {
  const rows = await appDataRequest<any[]>(
    `stripe_events?event_id=eq.${dbValue(eventId)}&select=event_id,status&limit=1`
  );
  return rows[0]?.status === 'processed';
}

async function saveEvent(event: any, data: {
  userUid?: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
  status: 'processed' | 'failed';
  errorMessage?: string | null;
}) {
  await appDataRequest('stripe_events?on_conflict=event_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      event_id: String(event?.id || ''),
      event_type: String(event?.type || 'unknown'),
      user_uid: data.userUid || null,
      stripe_customer_id: data.customerId || null,
      stripe_subscription_id: data.subscriptionId || null,
      status: data.status,
      error_message: data.errorMessage || null,
      processed_at: new Date().toISOString(),
    }),
  });
}

export async function POST(request: Request) {
  const webhookSecret = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  if (!webhookSecret) {
    return Response.json({ error: 'STRIPE_WEBHOOK_SECRET não configurada' }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature') || '';

  if (!verifyStripeSignature(rawBody, signature, webhookSecret)) {
    return Response.json({ error: 'Assinatura do webhook Stripe inválida' }, { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: 'Payload Stripe inválido' }, { status: 400 });
  }

  if (!event?.id || !event?.type) {
    return Response.json({ error: 'Evento Stripe inválido' }, { status: 400 });
  }

  try {
    if (await alreadyProcessed(String(event.id))) {
      return Response.json({ received: true, duplicate: true });
    }

    const object = event?.data?.object || {};
    let synced: any = null;
    let customerId = stripeId(object?.customer);
    let subscriptionId: string | null = null;

    if (event.type === 'checkout.session.completed') {
      subscriptionId = stripeId(object?.subscription);
      if (subscriptionId) {
        const subscription = await retrieveStripeSubscription(subscriptionId);
        synced = await syncStripeSubscription(subscription, {
          userUid: String(object?.client_reference_id || object?.metadata?.firebase_uid || '') || null,
          plan: normalizePaidPlan(object?.metadata?.plan),
        });
        customerId = stripeId(subscription?.customer) || customerId;
      }
    } else if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      subscriptionId = stripeId(object?.id);
      synced = await syncStripeSubscription(object);
      customerId = stripeId(object?.customer) || customerId;
    } else if (
      event.type === 'invoice.paid' ||
      event.type === 'invoice.payment_failed' ||
      event.type === 'invoice.payment_action_required'
    ) {
      subscriptionId = invoiceSubscriptionId(object);
      if (subscriptionId) {
        const subscription = await retrieveStripeSubscription(subscriptionId);
        synced = await syncStripeSubscription(subscription);
        customerId = stripeId(subscription?.customer) || customerId;
      }
    }

    await saveEvent(event, {
      userUid: synced?.user_uid || null,
      customerId: synced?.provider_customer_id || customerId,
      subscriptionId: synced?.provider_subscription_id || subscriptionId,
      status: 'processed',
    });

    return Response.json({ received: true });
  } catch (error: any) {
    console.error('[Stripe webhook]', event?.type, error?.message || error);

    try {
      await saveEvent(event, {
        customerId: stripeId(event?.data?.object?.customer),
        subscriptionId:
          stripeId(event?.data?.object?.subscription) ||
          stripeId(event?.data?.object?.id),
        status: 'failed',
        errorMessage: String(error?.message || error).slice(0, 500),
      });
    } catch (logError) {
      console.error('[Stripe webhook] Could not persist failed event:', logError);
    }

    return Response.json(
      { error: 'Não foi possível processar o evento Stripe' },
      { status: 500 }
    );
  }
}
