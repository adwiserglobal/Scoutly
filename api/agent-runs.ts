import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireFirebaseIdentity } from '../server/firebaseTokenService.js';
import {
  cancelAgentRun,
  createAgentRun,
  getAgentRunForUser,
  listAgentRunsForUser,
} from '../server/agenticService.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  try {
    const identity = await requireFirebaseIdentity(req);

    if (req.method === 'GET') {
      const runId = typeof req.query.id === 'string' ? req.query.id : '';
      if (runId) {
        const run = await getAgentRunForUser(identity.uid, runId);
        if (!run) return res.status(404).json({ error: 'Agent Run não encontrado.' });
        return res.status(200).json({ run });
      }

      const runs = await listAgentRunsForUser(identity.uid);
      return res.status(200).json({ runs });
    }

    if (req.method === 'POST') {
      const action = String(req.body?.action || 'create');

      if (action === 'cancel') {
        const runId = String(req.body?.runId || '');
        if (!runId) return res.status(400).json({ error: 'runId é obrigatório.' });
        const run = await cancelAgentRun(identity.uid, runId);
        if (!run) return res.status(404).json({ error: 'Agent Run ativo não encontrado.' });
        return res.status(200).json({ run });
      }

      if (action !== 'create') {
        return res.status(400).json({ error: 'Ação inválida.' });
      }

      const run = await createAgentRun(identity, {
        objective: String(req.body?.objective || ''),
        currentRegionName: req.body?.currentRegionName,
        targetCount: req.body?.targetCount == null ? null : Number(req.body.targetCount),
      });

      return res.status(201).json({ run });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  } catch (error: any) {
    const status = Number(error?.statusCode || 500);
    console.error('[Agent Runs API]', error);
    return res.status(status).json({
      error: error?.message || 'Erro ao processar Agent Run.',
    });
  }
}
