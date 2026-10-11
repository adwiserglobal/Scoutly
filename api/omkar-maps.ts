import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireFirebaseIdentity } from '../server/firebaseTokenService.js';
import { getSubscriptionAccess } from '../server/subscriptionAccessService.js';
import { protectBusinessListForClient } from '../server/businessSealService.js';
import {
  createOmkarJobToken,
  getOmkarMapsTask,
  getOmkarMapsTaskResults,
  hasOmkarMapsAccess,
  normalizeOmkarPlaces,
  normalizeTaskStatus,
  startOmkarMapsTask,
  verifyOmkarJobToken,
} from '../server/omkarMapsService.js';

function allowedPlan(plan: string) {
  if (process.env.OMKAR_MAPS_ALLOW_FREE === 'true') return true;
  return ['go', 'pro', 'agency'].includes(String(plan || '').toLowerCase());
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
      const query = String(req.body?.query || '').trim();
      const regionName = String(req.body?.regionName || '').trim();
      const latitude = Number(req.body?.latitude);
      const longitude = Number(req.body?.longitude);
      const maxResults = Number(req.body?.maxResults);

      if (query.length < 2 || query.length > 180) {
        return res.status(400).json({ error: 'Consulta inválida.', code: 'INVALID_QUERY' });
      }
      if (!regionName || regionName.length > 220) {
        return res.status(400).json({ error: 'Região inválida.', code: 'INVALID_REGION' });
      }

      const task = await startOmkarMapsTask({
        query,
        regionName,
        latitude: Number.isFinite(latitude) ? latitude : null,
        longitude: Number.isFinite(longitude) ? longitude : null,
        maxResults: Number.isFinite(maxResults) ? maxResults : 120,
      });

      return res.status(202).json({
        available: true,
        status: task.status,
        jobToken: createOmkarJobToken(identity.uid, task.taskId),
      });
    }

    const jobToken = typeof req.query.jobToken === 'string' ? req.query.jobToken : '';
    if (!jobToken) return res.status(400).json({ error: 'jobToken é obrigatório.', code: 'INVALID_OMKAR_JOB' });

    const { taskId } = verifyOmkarJobToken(jobToken, identity.uid);
    const task = await getOmkarMapsTask(taskId);
    const status = normalizeTaskStatus(task?.status);

    if (status !== 'completed') {
      return res.status(200).json({
        available: true,
        status,
        businesses: [],
      });
    }

    const records = await getOmkarMapsTaskResults(taskId, 300);
    const businesses = protectBusinessListForClient(normalizeOmkarPlaces(records));

    return res.status(200).json({
      available: true,
      status: 'completed',
      businesses,
      resultCount: businesses.length,
    });
  } catch (error: any) {
    const statusCode = Number(error?.statusCode || 500);
    console.error('[API /api/omkar-maps Error]:', error?.message || error);
    return res.status(statusCode).json({
      error: error?.message || 'Falha ao consultar Google Maps externo.',
      code: error?.code || 'OMKAR_MAPS_ERROR',
      businesses: [],
    });
  }
}
