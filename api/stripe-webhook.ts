import { createHmac, timingSafeEqual } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { appDataRequest, dbValue } from '../server/appDataService.js';
import {
  normalizePaidPlan,
  retrieveStripeSubscription,
  syncStripeSubscription,
} from '../server/stripeBillingService.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

async function readRawBody(req: VercelRequest) {
  const chunks: Buffer[] = [];
  for await (const chunk of req as any) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

function getHeader(req: VercelRequest, name: string) {
  const value = req.headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] || '';
  return String(value || '');
}

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const webhookSecret = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  if (!webhookSecret) {
    return res.status(503).json({ error: 'STRIPE_WEBHOOK_SECRET não configurada' });
  }

  const rawBody = await readRawBody(req);
  const signature = getHeader(req, 'stripe-signature');

  if (!verifyStripeSignature(rawBody, signature, webhookSecret)) {
    return res.status(400).json({ error: 'Assinatura do webhook Stripe inválida' });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: 'Payload Stripe inválido' });
  }

  if (!event?.id || !event?.type) {
    return res.status(400).json({ error: 'Evento Stripe inválido' });
  }

  try {
    if (await alreadyProcessed(String(event.id))) {
      return res.status(200).json({ received: true, duplicate: true });
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

    return res.status(200).json({ received: true });
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

    return res.status(500).json({ error: 'Não foi possível processar o evento Stripe' });
  }
}
