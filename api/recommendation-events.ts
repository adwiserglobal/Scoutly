import type { VercelRequest, VercelResponse } from '@vercel/node';
import { appDataRequest, appDbEq, ensureAppUser } from '../server/appDataService.js';
import { requireFirebaseIdentity } from '../server/firebaseTokenService.js';

const ALLOWED_EVENTS = new Set([
  'search',
  'favorite_add',
  'favorite_remove',
  'pipeline_add',
  'pipeline_remove',
  'whatsapp_click',
]);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const identity = await requireFirebaseIdentity(req as any);
    const { workspaceId } = await ensureAppUser(identity);

    if (req.method === 'GET') {
      const rows = await appDataRequest<any[]>(
        `recommendation_events?user_uid=eq.${appDbEq(identity.uid)}&select=id,event_type,business_id,category,query,location,metadata,created_at&order=created_at.desc&limit=250`
      );
      return res.status(200).json({ events: rows });
    }

    if (req.method === 'POST') {
      const {
        eventType,
        businessId,
        category,
        query,
        location,
        metadata,
      } = req.body || {};

      if (!ALLOWED_EVENTS.has(eventType)) {
        return res.status(400).json({ error: 'eventType inválido' });
      }

      await appDataRequest('recommendation_events', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          user_uid: identity.uid,
          workspace_id: workspaceId,
          event_type: eventType,
          business_id: businessId || null,
          category: category || null,
          query: query || null,
          location: location || null,
          metadata: metadata && typeof metadata === 'object' ? metadata : {},
        }),
      });

      return res.status(201).json({ success: true });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  } catch (error: any) {
    const statusCode = Number(error?.statusCode || 500);
    console.error('[API /api/recommendation-events]:', error?.message || error);
    return res.status(statusCode).json({
      error: statusCode === 401 ? 'Sessão inválida ou expirada.' : 'Erro ao registrar recomendação.',
    });
  }
}
