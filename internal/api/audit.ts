import type { VercelRequest, VercelResponse } from '@vercel/node';
import { appDataRequest } from '../server/appData.js';
import { requireInternalStaff } from '../server/staffAuth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await requireInternalStaff(req as any);

    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const audit = await appDataRequest<any[]>(
      'internal_audit_logs?select=*&order=created_at.desc&limit=250'
    );

    return res.status(200).json({ audit });
  } catch (error: any) {
    const status = Number(error?.statusCode || 500);
    return res.status(status).json({ error: error?.message || 'Erro ao carregar auditoria.' });
  }
}
