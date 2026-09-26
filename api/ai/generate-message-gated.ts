import type { VercelRequest, VercelResponse } from '@vercel/node';
import originalHandler from './generate-message.js';
import { requireFirebaseIdentity } from '../../server/firebaseTokenService.js';
import { ensureAppUser } from '../../server/appDataService.js';
import { assertAiAllowed, consumeAiConversation } from '../../server/entitlementService.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return originalHandler(req, res);

  try {
    const identity = await requireFirebaseIdentity(req as any);
    await ensureAppUser(identity);
    const creditState = await consumeAiConversation(identity.uid);
    assertAiAllowed(creditState);
    res.setHeader('X-Scoutly-AI-Remaining', creditState.aiDailyRemaining == null ? 'unlimited' : String(creditState.aiDailyRemaining));
    return originalHandler(req, res);
  } catch (error: any) {
    return res.status(Number(error?.statusCode || 500)).json({
      error: error?.message || 'Não foi possível usar a Scoutly AI.',
      code: error?.code || undefined,
    });
  }
}
