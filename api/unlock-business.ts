import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireFirebaseIdentity } from '../server/firebaseTokenService.js';
import { ensureAppUser } from '../server/appDataService.js';
import {
  consumeBusinessCredit,
  mergeUnlockedBusiness,
  readUnlockToken,
} from '../server/entitlementService.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const identity = await requireFirebaseIdentity(req as any);
    await ensureAppUser(identity);

    const businessId = String(req.body?.businessId || '').trim();
    const unlockToken = String(req.body?.unlockToken || '').trim();
    const visibleBusiness = req.body?.business && typeof req.body.business === 'object'
      ? req.body.business
      : {};

    if (!businessId || !unlockToken) {
      return res.status(400).json({ error: 'Negócio inválido para desbloqueio.' });
    }

    // Token is AES-GCM authenticated, user-bound, business-bound and expiring.
    const payload = readUnlockToken(unlockToken, identity.uid, businessId);
    const creditState = await consumeBusinessCredit(identity.uid, businessId);

    if (!creditState.allowed) {
      const status = creditState.code === 'DAILY_CREDIT_LIMIT' || creditState.code === 'MONTHLY_CREDIT_LIMIT' ? 429 : 403;
      return res.status(status).json({
        error: creditState.code === 'DAILY_CREDIT_LIMIT'
          ? 'Você usou os 5 créditos disponíveis hoje. Eles renovam à meia-noite UTC, respeitando o limite de 25 por mês.'
          : 'Você atingiu seu limite mensal de créditos.',
        code: creditState.code,
        creditState,
      });
    }

    const business = mergeUnlockedBusiness(visibleBusiness, payload);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json({ business, creditState });
  } catch (error: any) {
    const status = Number(error?.statusCode || 500);
    return res.status(status).json({
      error: error?.message || 'Não foi possível desbloquear este negócio.',
      code: error?.code || undefined,
    });
  }
}
