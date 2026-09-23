import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'crypto';
import { processAgentQueueOnce } from '../../server/agenticService.js';

export const config = {
  maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    // This endpoint cannot create jobs or choose a target job. It only advances
    // legitimate queued runs through atomic DB claims. We process a few bounded
    // stages per invocation so background cron remains useful without long jobs.
    const startedAt = Date.now();
    const results: any[] = [];

    for (let index = 0; index < 3; index += 1) {
      if (Date.now() - startedAt > 42_000) break;
      const workerId = `vercel-${randomUUID()}`;
      const result = await processAgentQueueOnce(workerId);
      results.push(result);
      if (!result.processed) break;
    }

    return res.status(200).json({
      processed: results.some((item) => item?.processed),
      iterations: results.length,
      results,
    });
  } catch (error: any) {
    console.error('[API /api/agent/worker]', error);
    return res.status(500).json({
      error: error?.message || 'Falha ao executar worker do Scoutly Agentic.',
    });
  }
}
