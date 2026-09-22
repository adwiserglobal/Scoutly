import type { VercelRequest, VercelResponse } from '@vercel/node';
import { appDataRequest } from '../server/appData.js';
import { requireInternalStaff } from '../server/staffAuth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { identity, staff } = await requireInternalStaff(req as any);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [tickets, recentUsers, activeUsers, paidSubscriptions, audit] = await Promise.all([
      appDataRequest<any[]>(
        'support_tickets?select=id,user_uid,requester_email,requester_name,subject,category,priority,status,assigned_to,created_at,updated_at&order=updated_at.desc&limit=50'
      ),
      appDataRequest<any[]>(
        'app_users?select=firebase_uid,email,display_name,photo_url,created_at,last_seen_at&order=last_seen_at.desc.nullslast&limit=25'
      ),
      appDataRequest<any[]>(
        `app_users?last_seen_at=gte.${encodeURIComponent(thirtyDaysAgo)}&select=firebase_uid&limit=1000`
      ),
      appDataRequest<any[]>(
        'subscriptions?plan=in.(go,pro,agency)&status=in.(active,trialing,past_due)&select=user_uid,plan,status,current_period_end&limit=1000'
      ),
      appDataRequest<any[]>(
        'internal_audit_logs?select=id,actor_email,action,target_type,target_id,metadata,created_at&order=created_at.desc&limit=12'
      ),
    ]);

    const openTickets = tickets.filter((ticket) =>
      ['OPEN', 'IN_PROGRESS', 'WAITING_INTERNAL'].includes(ticket.status)
    );
    const urgentTickets = openTickets.filter((ticket) => ticket.priority === 'URGENT');

    return res.status(200).json({
      staff,
      identity,
      stats: {
        openTickets: openTickets.length,
        urgentTickets: urgentTickets.length,
        activeUsers30d: activeUsers.length,
        paidSubscriptions: paidSubscriptions.length,
      },
      tickets,
      recentUsers,
      audit,
    });
  } catch (error: any) {
    const status = Number(error?.statusCode || 500);
    console.error('[Internal bootstrap]', error?.message || error);
    return res.status(status).json({ error: error?.message || 'Erro ao carregar o painel interno.' });
  }
}
