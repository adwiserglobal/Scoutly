import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireFirebaseIdentity } from '../server/firebaseTokenService.js';
import { ensureAppUser } from '../server/appDataService.js';
import { getCreditState } from '../server/entitlementService.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const identity = await requireFirebaseIdentity(req as any);
    await ensureAppUser(identity);
    const creditState = await getCreditState(identity.uid);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json({ creditState });
  } catch (error: any) {
    return res.status(Number(error?.statusCode || 500)).json({
      error: error?.message || 'Não foi possível carregar seus créditos.',
      code: error?.code || undefined,
    });
  }
}
