import type { VercelRequest, VercelResponse } from '@vercel/node';
import { appDataRequest, dbValue } from '../server/appData.js';
import { requireInternalStaff } from '../server/staffAuth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await requireInternalStaff(req as any);

    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const uid = String(req.query?.uid || '').trim();
    if (uid) {
      const [profile, subscriptions, usage, leads, favorites, recentEvents] = await Promise.all([
        appDataRequest<any[]>(`app_users?firebase_uid=eq.${dbValue(uid)}&select=*&limit=1`),
        appDataRequest<any[]>(`subscriptions?user_uid=eq.${dbValue(uid)}&select=*&limit=1`),
        appDataRequest<any[]>(`usage_counters?user_uid=eq.${dbValue(uid)}&select=*&order=period_start.desc&limit=1`),
        appDataRequest<any[]>(`user_leads?user_uid=eq.${dbValue(uid)}&select=business_id,status,notes,updated_at&order=updated_at.desc&limit=100`),
        appDataRequest<any[]>(`favorites?user_uid=eq.${dbValue(uid)}&select=business_id,category,created_at&order=created_at.desc&limit=100`),
        appDataRequest<any[]>(`recommendation_events?user_uid=eq.${dbValue(uid)}&select=event_type,business_id,category,query,location,created_at&order=created_at.desc&limit=50`),
      ]);

      return res.status(200).json({
        user: profile[0] || null,
        subscription: subscriptions[0] || null,
        usage: usage[0] || null,
        leads,
        favorites,
        recentEvents,
      });
    }

    const query = String(req.query?.q || '').trim().toLowerCase();
    const rows = await appDataRequest<any[]>(
      'app_users?select=firebase_uid,email,display_name,photo_url,created_at,last_seen_at&order=last_seen_at.desc.nullslast&limit=300'
    );

    const users = query
      ? rows.filter((user) =>
          [user.email, user.display_name, user.firebase_uid]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(query))
        ).slice(0, 50)
      : rows.slice(0, 100);

    return res.status(200).json({ users });
  } catch (error: any) {
    const status = Number(error?.statusCode || 500);
    console.error('[Internal users]', error?.message || error);
    return res.status(status).json({ error: error?.message || 'Erro ao carregar usuários.' });
  }
}
