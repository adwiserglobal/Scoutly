import type { VercelRequest, VercelResponse } from '@vercel/node';
import { auditWebsiteTracking } from '../server/trackingAuditService.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const url = typeof req.query.url === 'string' ? req.query.url.trim() : '';
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const audit = await auditWebsiteTracking(url);
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
    return res.status(200).json(audit);
  } catch (error: any) {
    console.error('[API /api/tracking-audit Error]:', error);
    return res.status(500).json({
      error: error?.message || 'Erro ao auditar tracking do site.',
    });
  }
}
