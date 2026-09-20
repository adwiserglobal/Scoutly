import type { VercelRequest, VercelResponse } from '@vercel/node';
import { appDataRequest, dbValue, ensureAppUser, incrementUsage } from '../server/appDataService.js';
import { requireFirebaseIdentity } from '../server/firebaseTokenService.js';

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
          : statusCode === 503
            ? 'Banco de usuários não configurado.'
            : 'Erro ao acessar os dados do usuário.',
    });
  }
}
