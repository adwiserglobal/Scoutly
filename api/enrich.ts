import type { VercelRequest, VercelResponse } from '@vercel/node';
import { enrichBusinessWebsite } from '../server/enrichService.js';
import { auditWebsiteTracking } from '../server/trackingAuditService.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const url = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    const force = req.query.force === '1' || req.query.force === 'true';

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const [result, trackingAudit] = await Promise.all([
      enrichBusinessWebsite(url, { force }),
      auditWebsiteTracking(url).catch((error: any) => {
        console.warn('[Tracking Audit Warning]:', error?.message || error);
        return null;
      }),
    ]);

    res.setHeader('Cache-Control', force ? 'no-store' : 's-maxage=300, stale-while-revalidate=900');

    return res.status(200).json({
      ...result,
      trackingAudit,
    });
  } catch (err: any) {
    console.error('[API /api/enrich Error]:', err?.message || err);
    return res.status(500).json({
      error: 'Erro ao enriquecer dados.',
      details: err?.message || String(err),
    });
  }
}
