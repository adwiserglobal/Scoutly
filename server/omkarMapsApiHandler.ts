import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireFirebaseIdentity } from './firebaseTokenService.js';
import { getSubscriptionAccess } from './subscriptionAccessService.js';
import { protectBusinessListForClient } from './businessSealService.js';
import {
  createOmkarJobToken,
  getOmkarMapsTask,
  getOmkarMapsTaskResults,
  hasOmkarMapsAccess,
  normalizeOmkarPlaces,
  normalizeTaskStatus,
  startOmkarMapsTask,
  verifyBusinessAgainstOmkar,
  verifyOmkarJobToken,
} from './omkarMapsService.js';

function allowedPlan(plan: string) {
  if (process.env.OMKAR_MAPS_ALLOW_FREE === 'true') return true;
  return ['go', 'pro', 'agency'].includes(String(plan || '').toLowerCase());
}

export async function handleOmkarMapsRequest(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (!['GET', 'POST'].includes(String(req.method || ''))) {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const identity = await requireFirebaseIdentity(req as any);
    const access = await getSubscriptionAccess(identity.uid);

    if (!hasOmkarMapsAccess()) {
      return res.status(200).json({
        available: false,
        reason: 'not_configured',
        status: 'unavailable',
      });
    }

    if (!allowedPlan(access.plan)) {
      return res.status(200).json({
        available: false,
        reason: 'paid_feature',
        status: 'unavailable',
      });
    }

    if (req.method === 'POST') {
      const mode = String(req.body?.mode || 'search').toLowerCase();
      const business = req.body?.business && typeof req.body.business === 'object' ? req.body.business : null;
      const query = mode === 'verify'
        ? String(business?.name || '').trim()
        : String(req.body?.query || '').trim();
      const regionName = mode === 'verify'
        ? String(business?.address || req.body?.regionName || '').trim()
        : String(req.body?.regionName || '').trim();
      const latitude = Number(mode === 'verify' ? business?.latitude : req.body?.latitude);
      const longitude = Number(mode === 'verify' ? business?.longitude : req.body?.longitude);
      const maxResults = Number(mode === 'verify' ? 25 : req.body?.maxResults);

      if (query.length < 2 || query.length > 180) {
        return res.status(400).json({ error: 'Consulta inválida.', code: 'INVALID_QUERY' });
      }
      if (!regionName || regionName.length > 320) {
        return res.status(400).json({ error: 'Região inválida.', code: 'INVALID_REGION' });
      }

      const verificationSeed = mode === 'verify'
        ? {
            businessId: String(business?.id || '').trim() || undefined,
            name: query,
            address: String(business?.address || '').trim() || null,
            phone: String(business?.phone || business?.phones?.[0] || '').trim() || null,
            website: String(business?.website || '').trim() || null,
            latitude: Number.isFinite(latitude) ? latitude : null,
            longitude: Number.isFinite(longitude) ? longitude : null,
          }
        : null;

      const task = await startOmkarMapsTask({
        query,
        regionName,
        latitude: Number.isFinite(latitude) ? latitude : null,
        longitude: Number.isFinite(longitude) ? longitude : null,
        maxResults: Number.isFinite(maxResults) ? maxResults : 120,
      });

      return res.status(202).json({
        available: true,
        mode,
        status: task.status,
        jobToken: createOmkarJobToken(identity.uid, task.taskId, verificationSeed),
      });
    }

    const jobToken = typeof req.query.jobToken === 'string' ? req.query.jobToken : '';
    if (!jobToken) {
      return res.status(400).json({ error: 'jobToken é obrigatório.', code: 'INVALID_OMKAR_JOB' });
    }

    const { taskId, verificationSeed } = verifyOmkarJobToken(jobToken, identity.uid);
    const task = await getOmkarMapsTask(taskId);
    const status = normalizeTaskStatus(task?.status);

    if (status !== 'completed') {
      return res.status(200).json({
        available: true,
        status,
        businesses: [],
      });
    }

    const records = await getOmkarMapsTaskResults(taskId, verificationSeed ? 80 : 300);
    const normalized = normalizeOmkarPlaces(records);

    if (verificationSeed) {
      const verification = verifyBusinessAgainstOmkar(verificationSeed, normalized);
      const protectedBusiness = verification.business
        ? protectBusinessListForClient([verification.business])[0]
        : null;

      return res.status(200).json({
        available: true,
        mode: 'verify',
        status: 'completed',
        verification: {
          ...verification,
          business: protectedBusiness,
        },
        businesses: protectedBusiness ? [protectedBusiness] : [],
        resultCount: protectedBusiness ? 1 : 0,
      });
    }

    const businesses = protectBusinessListForClient(normalized);
    return res.status(200).json({
      available: true,
      mode: 'search',
      status: 'completed',
      businesses,
      resultCount: businesses.length,
    });
  } catch (error: any) {
    const statusCode = Number(error?.statusCode || 500);
    console.error('[Scoutly Omkar Maps Error]:', error?.message || error);
    return res.status(statusCode).json({
      error: error?.message || 'Falha ao consultar Google Maps externo.',
      code: error?.code || 'OMKAR_MAPS_ERROR',
      businesses: [],
    });
  }
}
