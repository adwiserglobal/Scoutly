import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireFirebaseIdentity } from '../../server/firebaseTokenService.js';
import {
  cancelAgentRun,
  createAgentRun,
  getAgentRunForUser,
  listAgentRunsForUser,
} from '../../server/agenticService.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  try {
    const identity = await requireFirebaseIdentity(req as any);

    if (req.method === 'GET') {
      const runId = typeof req.query.id === 'string' ? req.query.id.trim() : '';
      if (runId) {
        const run = await getAgentRunForUser(identity.uid, runId);
        if (!run) return res.status(404).json({ error: 'Agent Run não encontrado.' });
        return res.status(200).json(run);
      }

      const runs = await listAgentRunsForUser(identity.uid);
      return res.status(200).json({ runs });
    }

    if (req.method === 'POST') {
      const objective = String(req.body?.objective || '').trim();
      const currentRegionName = String(req.body?.currentRegionName || 'São Paulo - SP').trim();
      const targetCount = req.body?.targetCount == null ? null : Number(req.body.targetCount);

      const run = await createAgentRun(identity, {
        objective,
        currentRegionName,
        targetCount: Number.isFinite(targetCount) ? targetCount : null,
      });

      return res.status(201).json(run);
    }

    if (req.method === 'PATCH') {
      const runId = String(req.body?.id || req.query.id || '').trim();
      const action = String(req.body?.action || 'cancel').trim();
      if (!runId) return res.status(400).json({ error: 'ID do Agent Run é obrigatório.' });
      if (action !== 'cancel') return res.status(400).json({ error: 'Ação inválida.' });

      const run = await cancelAgentRun(identity.uid, runId);
      if (!run) return res.status(404).json({ error: 'Agent Run ativo não encontrado.' });
      return res.status(200).json(run);
    }

    res.setHeader('Allow', ['GET', 'POST', 'PATCH']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  } catch (error: any) {
    const status = Number(error?.statusCode || 500);
    console.error('[API /api/agent/runs]', error);
    return res.status(status).json({
      error: error?.message || 'Erro ao processar Agent Run.',
    });
  }
}
