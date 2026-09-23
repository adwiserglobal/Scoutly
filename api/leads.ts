import type { VercelRequest, VercelResponse } from '@vercel/node';
import { appDataRequest, dbValue, ensureAppUser, incrementUsage } from '../server/appDataService.js';
import { requireFirebaseIdentity } from '../server/firebaseTokenService.js';
import { confirmStripeCheckoutSession, createStripeBillingPortal, refreshStripeSubscriptionForUser } from '../server/stripeBillingService.js';

const LEAD_STATUSES = new Set([
  'NOVO',
  'CONTATADO',
  'EM_NEGOCIACAO',
  'FECHADO',
  'PERDIDO',
  'ARQUIVADO',
]);

const RECOMMENDATION_EVENTS = new Set([
  'search',
  'favorite_add',
  'favorite_remove',
  'pipeline_add',
  'pipeline_remove',
  'whatsapp_click',
]);

async function getActiveRoute(userUid: string) {
  const rows = await appDataRequest<Array<{ id: string }>>(
    `visit_routes?user_uid=eq.${dbValue(userUid)}&is_active=eq.true&select=id&order=updated_at.desc&limit=1`
  );
  return rows[0] || null;
}

async function createActiveRoute(userUid: string, workspaceId: string) {
  const rows = await appDataRequest<Array<{ id: string }>>('visit_routes?select=id', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      user_uid: userUid,
      workspace_id: workspaceId,
      name: 'Rota de visitas',
      is_active: true,
    }),
  });
  return rows[0] || null;
}

async function bootstrap(userUid: string, workspaceId: string) {
  const route = await getActiveRoute(userUid);

  const [
    leadRows,
    favoriteRows,
    settingsRows,
    eventRows,
    recentRows,
    subscriptionRows,
    usageRows,
    profileRows,
    routeStops,
  ] = await Promise.all([
    appDataRequest<any[]>(
      `user_leads?user_uid=eq.${dbValue(userUid)}&select=business_id,status,notes,business_snapshot,updated_at`
    ),
    appDataRequest<any[]>(
      `favorites?user_uid=eq.${dbValue(userUid)}&select=business_id,category,business_snapshot,created_at`
    ),
    appDataRequest<any[]>(
      `user_settings?user_uid=eq.${dbValue(userUid)}&select=auto_enrich,results_batch_size,updated_at&limit=1`
    ),
    appDataRequest<any[]>(
      `recommendation_events?user_uid=eq.${dbValue(userUid)}&select=id,event_type,business_id,category,query,location,metadata,created_at&order=created_at.desc&limit=250`
    ),
    appDataRequest<any[]>(
      `recent_businesses?user_uid=eq.${dbValue(userUid)}&select=business_id,business_snapshot,viewed_at&order=viewed_at.desc&limit=30`
    ),
    appDataRequest<any[]>(
      `subscriptions?user_uid=eq.${dbValue(userUid)}&select=plan,status,current_period_start,current_period_end,cancel_at_period_end&limit=1`
    ),
    appDataRequest<any[]>(
      `usage_counters?user_uid=eq.${dbValue(userUid)}&select=period_start,period_end,analyses,ai_messages,recommendation_refreshes&order=period_start.desc&limit=1`
    ),
    appDataRequest<any[]>(
      `app_users?firebase_uid=eq.${dbValue(userUid)}&select=firebase_uid,email,display_name,photo_url,created_at,updated_at,last_seen_at&limit=1`
    ),
    route
      ? appDataRequest<any[]>(
          `visit_route_stops?route_id=eq.${dbValue(route.id)}&select=business_id,position,visit_status,business_snapshot,added_at&order=position.asc`
        )
      : Promise.resolve([]),
  ]);

  const leads: Record<string, any> = {};
  for (const row of leadRows) {
    leads[row.business_id] = {
      status: row.status,
      notes: row.notes || '',
      updatedAt: row.updated_at,
      business: row.business_snapshot || null,
    };
  }

  const favorites: Record<string, boolean> = {};
  for (const row of favoriteRows) favorites[row.business_id] = true;

  return {
    user: profileRows[0] || null,
    workspaceId,
    leads,
    favorites,
    settings: settingsRows[0] || { auto_enrich: true, results_batch_size: 30 },
    recommendationEvents: eventRows,
    recentBusinesses: recentRows,
    subscription: subscriptionRows[0] || null,
    usage: usageRows[0] || null,
    route: {
      exists: Boolean(route),
      stops: routeStops.map((row) => ({
        business: row.business_snapshot,
        visitStatus: row.visit_status,
        addedAt: new Date(row.added_at).getTime(),
      })),
    },
  };
}


type PaidPlan = 'go' | 'pro' | 'agency';
const SHAREABLE_PROMOTION_CODE = 'scoutlypro10';

function getRequestOrigin(req: VercelRequest) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').trim();
  const forwardedProto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  if (host) return `${forwardedProto}://${host}`;
  return String(process.env.APP_URL || 'https://www.scoutly.pro').replace(/\/$/, '');
}

function getRequestedPromotionCode(req: VercelRequest) {
  const explicitCode = String(req.body?.promotionCode || '').trim().toLowerCase();
  if (explicitCode === SHAREABLE_PROMOTION_CODE) return explicitCode;

  const cookieHeader = String(req.headers.cookie || '');
  for (const part of cookieHeader.split(';')) {
    const [rawKey, ...rawValueParts] = part.trim().split('=');
    if (rawKey !== 'scoutly_promo_code') continue;

    const cookieCode = decodeURIComponent(rawValueParts.join('=') || '')
      .trim()
      .toLowerCase();
    if (cookieCode === SHAREABLE_PROMOTION_CODE) return cookieCode;
  }

  const referer = String(req.headers.referer || '').trim();
  if (referer) {
    try {
      const refererCode = String(new URL(referer).searchParams.get('promo') || '')
        .trim()
        .toLowerCase();
      if (refererCode === SHAREABLE_PROMOTION_CODE) return refererCode;
    } catch {
      // Ignore malformed referrer URLs and continue without an automatic promotion.
    }
  }

  return null;
}

async function resolveStripePromotionCode(stripeSecret: string, code: string) {
  const params = new URLSearchParams({
    active: 'true',
    code,
    limit: '1',
  });

  const response = await fetch(`https://api.stripe.com/v1/promotion_codes?${params.toString()}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${stripeSecret}`,
    },
    signal: AbortSignal.timeout(12000),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || `Stripe HTTP ${response.status}`;
    throw Object.assign(new Error(message), { statusCode: 502 });
  }

  const promotionCodeId = String(data?.data?.[0]?.id || '').trim();
  return promotionCodeId.startsWith('promo_') ? promotionCodeId : null;
}

async function createStripeCheckout(
  req: VercelRequest,
  identity: { uid: string; email: string | null },
  plan: PaidPlan
) {
  const stripeSecret = String(process.env.STRIPE_SECRET_KEY || '');
  if (!stripeSecret) {
    throw Object.assign(new Error('STRIPE_SECRET_KEY não configurada'), { statusCode: 503 });
  }

  const requestedPromotionCode = getRequestedPromotionCode(req);
  const promotionCodeId = requestedPromotionCode
    ? await resolveStripePromotionCode(stripeSecret, requestedPromotionCode)
    : null;

  if (requestedPromotionCode && !promotionCodeId) {
    throw Object.assign(
      new Error('O cupom scoutlypro10 não está ativo ou não foi encontrado na Stripe.'),
      { statusCode: 409 }
    );
  }

  const priceByPlan: Record<PaidPlan, string> = {
    go: String(process.env.STRIPE_PRICE_GO || ''),
    pro: String(process.env.STRIPE_PRICE_PRO || ''),
    agency: String(process.env.STRIPE_PRICE_AGENCY || ''),
  };

  const priceId = priceByPlan[plan];
  if (!priceId || !priceId.startsWith('price_')) {
    throw Object.assign(new Error(`Preço Stripe do plano ${plan} não configurado`), {
      statusCode: 503,
    });
  }

  const existingRows = await appDataRequest<any[]>(
    `subscriptions?user_uid=eq.${dbValue(identity.uid)}&select=provider_customer_id,provider_subscription_id,plan,status&limit=1`
  );
  const existing = existingRows[0] || null;

  if (
    existing?.provider_subscription_id &&
    ['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused'].includes(String(existing.status || '')) &&
    ['go', 'pro', 'agency'].includes(String(existing.plan || ''))
  ) {
    throw Object.assign(
      new Error('Sua conta já possui uma assinatura Stripe existente. Gerencie-a pelo portal de cobrança.'),
      { statusCode: 409 }
    );
  }

  const origin = getRequestOrigin(req);
  const params = new URLSearchParams();
  params.set('mode', 'subscription');
  params.set('line_items[0][price]', priceId);
  params.set('line_items[0][quantity]', '1');
  params.set('success_url', `${origin}/?billing=success&session_id={CHECKOUT_SESSION_ID}`);
  params.set('cancel_url', `${origin}/?billing=cancel`);
  params.set('client_reference_id', identity.uid);
  params.set('metadata[firebase_uid]', identity.uid);
  params.set('metadata[plan]', plan);
  params.set('subscription_data[metadata][firebase_uid]', identity.uid);
  params.set('subscription_data[metadata][plan]', plan);

  if (promotionCodeId) {
    params.set('discounts[0][promotion_code]', promotionCodeId);
  } else {
    params.set('allow_promotion_codes', 'true');
  }

  if (existing?.provider_customer_id) {
    params.set('customer', String(existing.provider_customer_id));
  } else if (identity.email) {
    params.set('customer_email', identity.email);
  }

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
    signal: AbortSignal.timeout(12000),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.url) {
    const message = data?.error?.message || `Stripe HTTP ${response.status}`;
    throw Object.assign(new Error(message), { statusCode: 502 });
  }

  return {
    id: data.id as string,
    url: data.url as string,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const identity = await requireFirebaseIdentity(req as any);
    const { workspaceId } = await ensureAppUser(identity);

    if (req.method === 'GET') {
      return res.status(200).json(await bootstrap(identity.uid, workspaceId));
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    const action = String(req.body?.action || '');

    if (action === 'sync-user') {
      return res.status(200).json({ success: true, user: identity, workspaceId });
    }

    if (action === 'create-checkout') {
      const plan = String(req.body?.plan || '').toLowerCase();
      if (!['go', 'pro', 'agency'].includes(plan)) {
        return res.status(400).json({ error: 'Plano inválido' });
      }

      const checkout = await createStripeCheckout(req, identity, plan as PaidPlan);
      return res.status(200).json(checkout);
    }

    if (action === 'confirm-checkout') {
      const sessionId = String(req.body?.sessionId || '').trim();
      if (!sessionId.startsWith('cs_')) {
        return res.status(400).json({ error: 'Sessão de checkout inválida' });
      }

      const confirmed = await confirmStripeCheckoutSession(sessionId, identity.uid);
      return res.status(200).json({
        success: true,
        subscription: confirmed.subscription,
      });
    }

    if (action === 'create-billing-portal') {
      const origin = getRequestOrigin(req);
      const targetPlan = String(req.body?.plan || '').toLowerCase();
      const portal = await createStripeBillingPortal(
        identity.uid,
        `${origin}/?billing=portal-return`,
        ['go', 'pro', 'agency'].includes(targetPlan) ? (targetPlan as PaidPlan) : null
      );
      return res.status(200).json(portal);
    }

    if (action === 'refresh-subscription') {
      const subscription = await refreshStripeSubscriptionForUser(identity.uid);
      return res.status(200).json({ success: true, subscription });
    }

    if (action === 'update-profile') {
      const displayName = String(req.body?.displayName || '').trim().slice(0, 120);
      if (!displayName) return res.status(400).json({ error: 'Nome inválido' });

      await appDataRequest(`app_users?firebase_uid=eq.${dbValue(identity.uid)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ display_name: displayName }),
      });
      return res.status(200).json({ success: true });
    }

    if (action === 'save-lead') {
      const businessId = String(req.body?.businessId || '');
      const status = String(req.body?.status || 'NOVO');
      if (!businessId) return res.status(400).json({ error: 'businessId é obrigatório' });
      if (!LEAD_STATUSES.has(status)) return res.status(400).json({ error: 'status inválido' });

      await appDataRequest('user_leads?on_conflict=user_uid,business_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          user_uid: identity.uid,
          workspace_id: workspaceId,
          business_id: businessId,
          status,
          notes: String(req.body?.notes || '').slice(0, 10000),
          business_snapshot:
            req.body?.business && typeof req.body.business === 'object' ? req.body.business : null,
        }),
      });
      return res.status(200).json({ success: true });
    }

    if (action === 'favorite') {
      const businessId = String(req.body?.businessId || '');
      const isFavorite = Boolean(req.body?.isFavorite);
      if (!businessId) return res.status(400).json({ error: 'businessId é obrigatório' });

      if (isFavorite) {
        const business =
          req.body?.business && typeof req.body.business === 'object' ? req.body.business : null;
        await appDataRequest('favorites?on_conflict=user_uid,business_id', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({
            user_uid: identity.uid,
            workspace_id: workspaceId,
            business_id: businessId,
            category: business?.category || null,
            business_snapshot: business,
          }),
        });
      } else {
        await appDataRequest(
          `favorites?user_uid=eq.${dbValue(identity.uid)}&business_id=eq.${dbValue(businessId)}`,
          { method: 'DELETE', headers: { Prefer: 'return=minimal' } }
        );
      }
      return res.status(200).json({ success: true });
    }

    if (action === 'save-route') {
      const stops = Array.isArray(req.body?.stops) ? req.body.stops.slice(0, 25) : [];
      let route = await getActiveRoute(identity.uid);
      if (!route) route = await createActiveRoute(identity.uid, workspaceId);
      if (!route?.id) throw new Error('Não foi possível criar rota');

      await appDataRequest(`visit_route_stops?route_id=eq.${dbValue(route.id)}`, {
        method: 'DELETE',
        headers: { Prefer: 'return=minimal' },
      });

      const rows = stops
        .map((stop: any, position: number) => ({
          route_id: route.id,
          business_id: stop?.business?.id,
          position,
          visit_status: ['PENDENTE', 'VISITADO', 'PULADO'].includes(stop?.visitStatus)
            ? stop.visitStatus
            : 'PENDENTE',
          business_snapshot: stop?.business,
          added_at: stop?.addedAt
            ? new Date(stop.addedAt).toISOString()
            : new Date().toISOString(),
        }))
        .filter((stop: any) => stop.business_id && stop.business_snapshot);

      if (rows.length > 0) {
        await appDataRequest('visit_route_stops', {
          method: 'POST',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify(rows),
        });
      }

      await appDataRequest(`visit_routes?id=eq.${dbValue(route.id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ updated_at: new Date().toISOString() }),
      });
      return res.status(200).json({ success: true });
    }

    if (action === 'recommendation-event') {
      const eventType = String(req.body?.eventType || '');
      if (!RECOMMENDATION_EVENTS.has(eventType)) {
        return res.status(400).json({ error: 'eventType inválido' });
      }

      await appDataRequest('recommendation_events', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          user_uid: identity.uid,
          workspace_id: workspaceId,
          event_type: eventType,
          business_id: req.body?.businessId || null,
          category: req.body?.category || null,
          query: req.body?.query || null,
          location: req.body?.location || null,
          metadata:
            req.body?.metadata && typeof req.body.metadata === 'object'
              ? req.body.metadata
              : {},
        }),
      });
      return res.status(201).json({ success: true });
    }

    if (action === 'save-settings') {
      const autoEnrich = req.body?.autoEnrich;
      const resultsBatchSize = Number(req.body?.resultsBatchSize);
      const body: Record<string, unknown> = { user_uid: identity.uid };

      if (typeof autoEnrich === 'boolean') body.auto_enrich = autoEnrich;
      if ([30, 60, 100].includes(resultsBatchSize)) body.results_batch_size = resultsBatchSize;

      await appDataRequest('user_settings?on_conflict=user_uid', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(body),
      });
      return res.status(200).json({ success: true });
    }

    if (action === 'recent-business') {
      const businessId = String(req.body?.businessId || '');
      if (!businessId) return res.status(400).json({ error: 'businessId é obrigatório' });

      await appDataRequest('recent_businesses?on_conflict=user_uid,business_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          user_uid: identity.uid,
          business_id: businessId,
          business_snapshot:
            req.body?.business && typeof req.body.business === 'object' ? req.body.business : null,
          viewed_at: new Date().toISOString(),
        }),
      });
      return res.status(200).json({ success: true });
    }

    if (action === 'generated-message') {
      const message = String(req.body?.message || '').trim();
      if (!message) return res.status(400).json({ error: 'message é obrigatória' });

      await appDataRequest('generated_messages', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          user_uid: identity.uid,
          workspace_id: workspaceId,
          business_id: req.body?.businessId || null,
          business_name: req.body?.businessName || null,
          message: message.slice(0, 20000),
          source: req.body?.source || null,
          model: req.body?.model || null,
        }),
      });

      await incrementUsage(identity.uid, 'ai_messages');
      return res.status(201).json({ success: true });
    }

    if (action === 'usage') {
      const counter = String(req.body?.counter || '');
      if (!['analyses', 'ai_messages', 'recommendation_refreshes'].includes(counter)) {
        return res.status(400).json({ error: 'contador inválido' });
      }

      await incrementUsage(
        identity.uid,
        counter as 'analyses' | 'ai_messages' | 'recommendation_refreshes'
      );
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Ação inválida' });
  } catch (error: any) {
    const statusCode = Number(error?.statusCode || 500);
    console.error('[API /api/leads]:', error?.message || error);
    return res.status(statusCode).json({
      error:
        statusCode === 401
          ? 'Sessão inválida ou expirada.'
          : statusCode === 400 || statusCode === 403 || statusCode === 409
            ? error?.message || 'Não foi possível concluir a operação de cobrança.'
            : statusCode === 502
              ? error?.message || 'Não foi possível acessar a Stripe.'
              : statusCode === 503
                ? error?.message || 'Configuração de cobrança incompleta.'
                : 'Erro ao acessar os dados do usuário.',
    });
  }
}
