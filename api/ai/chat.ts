import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleScoutlyAgenticChat } from '../../server/agenticSearchService.js';
import { requireFirebaseIdentity } from '../../server/firebaseTokenService.js';
import { ensureAppUser } from '../../server/appDataService.js';
import { assertAiAllowed, consumeAiConversation } from '../../server/entitlementService.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const identity = await requireFirebaseIdentity(req as any);
    await ensureAppUser(identity);
    const { message, history, businesses, currentRegionName, conversationContext } = req.body || {};

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Mensagem é obrigatória' });
    }

    const creditState = await consumeAiConversation(identity.uid);
    assertAiAllowed(creditState);

    const response = await handleScoutlyAgenticChat({
      message: message.trim(),
      history: Array.isArray(history) ? history : [],
      businesses: Array.isArray(businesses) ? businesses : [],
      currentRegionName:
        typeof currentRegionName === 'string' && currentRegionName.trim()
          ? currentRegionName.trim()
          : 'São Paulo - SP',
      conversationContext:
        conversationContext && typeof conversationContext === 'object'
          ? conversationContext
          : null,
    });

    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json({ ...response, creditState });
  } catch (err: any) {
    console.error('[API /api/ai/chat Error]:', err);
    const status = Number(err?.statusCode || 500);
    return res.status(status).json({
      error: err?.message || 'Erro ao processar consulta do Scoutly Agentic.',
      code: err?.code || undefined,
    });
  }
}
