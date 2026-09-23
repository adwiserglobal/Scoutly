import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireFirebaseIdentity } from '../server/firebaseTokenService.js';
import { processAgentQueueOnce } from '../server/agenticService.js';

function isCronAuthorized(req: VercelRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authorization = String(req.headers.authorization || '');
  return authorization === `Bearer ${cronSecret}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (!['GET', 'POST'].includes(req.method || '')) {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    // Vercel Cron uses CRON_SECRET. Logged-in users can also nudge the queue while
    // watching an active run, which keeps the UI responsive without bypassing auth.
    if (!isCronAuthorized(req)) {
      await requireFirebaseIdentity(req);
    }

    const workerId = `vercel-${process.env.VERCEL_REGION || 'local'}-${Date.now()}`;
    const result = await processAgentQueueOnce(workerId);
    return res.status(200).json(result);
  } catch (error: any) {
    const status = Number(error?.statusCode || 500);
    console.error('[Agent Worker API]', error);
    return res.status(status).json({
      error: error?.message || 'Erro ao processar fila Agentic.',
    });
  }
}
