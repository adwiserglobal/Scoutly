import type { VercelRequest, VercelResponse } from '@vercel/node';
import { appDataRequest, appDbEq, ensureAppUser } from '../server/appDataService.js';
import { requireFirebaseIdentity } from '../server/firebaseTokenService.js';

async function getActiveRoute(userUid: string) {
  const routes = await appDataRequest<Array<{ id: string }>>(
    `visit_routes?user_uid=eq.${appDbEq(userUid)}&is_active=eq.true&select=id&order=updated_at.desc&limit=1`
  );
  return routes[0] || null;
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
  return rows[0];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const identity = await requireFirebaseIdentity(req as any);
    const { workspaceId } = await ensureAppUser(identity);

    if (req.method === 'GET') {
      const route = await getActiveRoute(identity.uid);
      if (!route) return res.status(200).json({ exists: false, stops: [] });

      const rows = await appDataRequest<any[]>(
        `visit_route_stops?route_id=eq.${appDbEq(route.id)}&select=business_id,position,visit_status,business_snapshot,added_at&order=position.asc`
      );

      return res.status(200).json({
        exists: true,
        stops: rows.map((row) => ({
          business: row.business_snapshot,
          visitStatus: row.visit_status,
          addedAt: new Date(row.added_at).getTime(),
        })),
      });
    }

    if (req.method === 'POST') {
      const stops = Array.isArray(req.body?.stops) ? req.body.stops.slice(0, 25) : [];
      let route = await getActiveRoute(identity.uid);
      if (!route) route = await createActiveRoute(identity.uid, workspaceId);
      if (!route?.id) throw new Error('Could not create visit route');

      await appDataRequest(`visit_route_stops?route_id=eq.${appDbEq(route.id)}`, {
        method: 'DELETE',
        headers: { Prefer: 'return=minimal' },
      });

      if (stops.length > 0) {
        await appDataRequest('visit_route_stops', {
          method: 'POST',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify(
            stops.map((stop: any, position: number) => ({
              route_id: route.id,
              business_id: stop?.business?.id,
              position,
              visit_status: ['PENDENTE', 'VISITADO', 'PULADO'].includes(stop?.visitStatus)
                ? stop.visitStatus
                : 'PENDENTE',
              business_snapshot: stop.business,
              added_at: stop?.addedAt ? new Date(stop.addedAt).toISOString() : new Date().toISOString(),
            })).filter((stop: any) => Boolean(stop.business_id))
          ),
        });
      }

      await appDataRequest(`visit_routes?id=eq.${appDbEq(route.id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ updated_at: new Date().toISOString() }),
      });

      return res.status(200).json({ success: true, routeId: route.id });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  } catch (error: any) {
    const statusCode = Number(error?.statusCode || 500);
    console.error('[API /api/routes]:', error?.message || error);
    return res.status(statusCode).json({
      error: statusCode === 401 ? 'Sessão inválida ou expirada.' : 'Erro ao sincronizar rota.',
    });
  }
}
