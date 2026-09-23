import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'crypto';
import { processAgentQueueOnce } from '../../server/agenticService.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    // This endpoint cannot create jobs or choose a target job. It only advances
    // the oldest legitimate queued run through an atomic DB claim. Repeated or
    // concurrent calls are therefore safe and cannot duplicate work.
    const workerId = `vercel-${randomUUID()}`;
    const result = await processAgentQueueOnce(workerId);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('[API /api/agent/worker]', error);
    return res.status(500).json({
      error: error?.message || 'Falha ao executar worker do Scoutly Agentic.',
    });
  }
}
