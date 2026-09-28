import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureAppUser } from '../server/appDataService.js';
import { requireFirebaseIdentity } from '../server/firebaseTokenService.js';
import {
  createFlashPromoCheckout,
  getFlashPromoStatus,
} from '../server/flashPromoService.js';

function requestOrigin(req: VercelRequest) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').trim();
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  if (host) return `${proto}://${host}`;
  return String(process.env.APP_URL || 'https://www.scoutly.pro').replace(/\/$/, '');
}

function safeError(error: any) {
  const statusCode = Number(error?.statusCode) || 500;
  const code = String(error?.code || '');
  const publicCodes = new Set([
    'FLASH_PROMO_UNAVAILABLE',
    'FLASH_PROMO_FIRST_PRO_ONLY',
    'FLASH_PROMO_PRICE_INVALID',
    'FLASH_PROMO_REFERENCE_INVALID',
    'FLASH_PROMO_CURRENCY_MISMATCH',
    'FLASH_PROMO_PRICE_INACTIVE',
    'PRO_PRICE_INTERVAL_INVALID',
    'FLASH_PROMO_START_FAILED',
  ]);

  if (publicCodes.has(code)) {
    return {
      statusCode: Math.min(499, Math.max(400, statusCode)),
      body: { error: String(error?.message || 'Esta promoção não está disponível.'), code },
    };
  }

  if (statusCode === 401) {
    return { statusCode: 401, body: { error: 'Sua sessão expirou. Entre novamente.' } };
  }

  console.error('[Scoutly Flash Promo]', error?.message || error);
  return {
    statusCode: statusCode >= 500 ? 500 : statusCode,
    body: { error: 'Não foi possível carregar a Flash Promo agora. Tente novamente em instantes.' },
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const identity = await requireFirebaseIdentity(req as any);
    const { workspaceId } = await ensureAppUser(identity);

    if (req.method === 'GET') {
      const promo = await getFlashPromoStatus(identity.uid, workspaceId);
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      return res.status(200).json({ promo });
    }

    if (req.method === 'POST') {
      const action = String(req.body?.action || 'checkout').trim().toLowerCase();
      if (action !== 'checkout') return res.status(400).json({ error: 'Ação inválida.' });

      const checkout = await createFlashPromoCheckout({
        userUid: identity.uid,
        email: identity.email,
        workspaceId,
        origin: requestOrigin(req),
      });
      return res.status(200).json(checkout);
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  } catch (error: any) {
    const result = safeError(error);
    return res.status(result.statusCode).json(result.body);
  }
}
