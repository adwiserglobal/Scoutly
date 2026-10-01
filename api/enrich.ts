import type { VercelRequest, VercelResponse } from '@vercel/node';
import { enrichBusinessWebsite } from '../server/enrichService.js';
import { auditWebsiteTracking } from '../server/trackingAuditService.js';
import { requireFirebaseIdentity } from '../server/firebaseTokenService.js';
import { hasBusinessUnlockAccess } from '../server/entitlementService.js';
import { getSubscriptionAccess } from '../server/subscriptionAccessService.js';

function stripPaidEmail(result: any, allowEmail: boolean) {
  if (!result || typeof result !== 'object') return result;
  if (allowEmail) return result;
  const safe = { ...result };
  delete safe.email;
  delete safe.emails;
  return safe;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const identity = await requireFirebaseIdentity(req as any);
    const url = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    const businessId = typeof req.query.businessId === 'string' ? req.query.businessId.trim() : '';
    const force = req.query.force === '1' || req.query.force === 'true';

    if (!url) return res.status(400).json({ error: 'URL is required' });
    if (!businessId) return res.status(400).json({ error: 'businessId is required' });

    const [allowed, access] = await Promise.all([
      hasBusinessUnlockAccess(identity.uid, businessId),
      getSubscriptionAccess(identity.uid),
    ]);

    if (!allowed) {
      return res.status(403).json({
        error: 'Abra este negócio primeiro para analisar os sinais digitais.',
        code: 'BUSINESS_NOT_UNLOCKED',
      });
    }

    const [result, trackingAudit] = await Promise.all([
      enrichBusinessWebsite(url, { force }),
      auditWebsiteTracking(url).catch((error: any) => {
        console.warn('[Tracking Audit Warning]:', error?.message || error);
        return null;
      }),
    ]);

    const allowEmail = ['go', 'pro', 'agency'].includes(String(access.plan || '').toLowerCase());
    res.setHeader('Cache-Control', force ? 'no-store' : 'private, max-age=120');
    return res.status(200).json({
      ...stripPaidEmail(result, allowEmail),
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
