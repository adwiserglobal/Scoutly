import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleScoutlyAgenticChat } from '../../server/agenticSearchService.js';
import { requireFirebaseIdentity } from '../../server/firebaseTokenService.js';
import { ensureAppUser } from '../../server/appDataService.js';
import { consumeAiConversation } from '../../server/entitlementService.js';
import { translateReplyToEnglish, translateRequestToPortuguese } from '../../server/translateReply.js';
import { researchFocusedLead, similarSearchQuery, wantsSimilarBusinesses } from '../../server/leadResearchService.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { message, history, businesses, currentRegionName, conversationContext, focusedLead, responseLanguage } = req.body || {};
    const wantsEnglish = responseLanguage === 'en';
    const localize = async <T extends { text?: string }>(payload: T): Promise<T> =>
      wantsEnglish && typeof payload.text === 'string' ? { ...payload, text: await translateReplyToEnglish(payload.text) } : payload;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Mensagem é obrigatória' });
    }

    const identity = await requireFirebaseIdentity(req as any);
    const userMessage: string = wantsEnglish ? await translateRequestToPortuguese(message) : message;
    const { workspaceId } = await ensureAppUser(identity);
    const access = await consumeAiConversation(identity.uid, workspaceId);

    const hasFocusedLead = focusedLead && typeof focusedLead === 'object' && focusedLead.id && focusedLead.name;
    const similarRequest = hasFocusedLead && wantsSimilarBusinesses(userMessage);

    if (hasFocusedLead && !similarRequest) {
      // Questions about the focused lead itself (owner, profiles, approach) are researched
      // for that lead; searches for other businesses fall through to the regular Agentic.
      const research = await researchFocusedLead(focusedLead, userMessage.trim());
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ ...(await localize(research)), access });
    }

    const searchMessage = similarRequest ? similarSearchQuery(focusedLead, userMessage) : userMessage.trim();
    const response = await handleScoutlyAgenticChat({
      message: searchMessage,
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

    if (similarRequest && Array.isArray(response.matchedBusinessIds)) {
      response.matchedBusinessIds = response.matchedBusinessIds.filter((id: string) => id !== focusedLead.id);
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ...(await localize(response)), access });
  } catch (err: any) {
    const statusCode = Number(err?.statusCode || 500);
    console.error('[API /api/ai/chat Error]:', err?.message || err);
    return res.status(statusCode).json({
      error: err?.message || 'Erro ao processar consulta do Scoutly Agentic.',
      code: err?.code || undefined,
    });
  }
}
