import type { VercelRequest, VercelResponse } from '@vercel/node';
import { enrichBusinessWebsite } from '../server/enrichService.js';
import { auditWebsiteTracking } from '../server/trackingAuditService.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('API enrich started');
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const url = req.query.url as string;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const [result, trackingAudit] = await Promise.all([
      enrichBusinessWebsite(url),
      auditWebsiteTracking(url).catch((error: any) => {
        console.warn('[Tracking Audit Warning]:', error?.message || error);
        return null;
      }),
    ]);

    return res.status(200).json({
      ...result,
      trackingAudit,
    });
  } catch (err: any) {
    console.error('[API /api/enrich Error FULL]:', err);
    return res.status(500).json({
      error: err.message || 'Erro ao enriquecer dados.',
      details: err.stack || String(err)
    });
  }
}
