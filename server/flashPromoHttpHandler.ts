import type { VercelRequest, VercelResponse } from '@vercel/node';
import { appDataRequest, dbValue, ensureAppUser } from './appDataService.js';
import { getCreditStatus } from './entitlementService.js';
import { requireFirebaseIdentity } from './firebaseTokenService.js';
import {
  createFlashPromoCheckout,
  getFlashPromoStatus,
  hasPurchasedProBefore,
} from './flashPromoService.js';

const FLASH_PROMO_LEDGER_QUERY = '__scoutly_credit_flash_promo_v1__';
const BUSINESS_UNLOCK_LEDGER_QUERY = '__scoutly_credit_business_unlock__';
const LEDGER_EVENT_TYPE = 'search';
const OFFER_PRICE_CENTS = 3599;

function requestOrigin(req: VercelRequest) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').trim();
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  if (host) return `${proto}://${host}`;
  return String(process.env.APP_URL || 'https://www.scoutly.pro').replace(/\/$/, '');
}

function inactivePromo(reason: 'waiting_for_first_five' | 'missed_first_five' | 'not_free' | 'prior_pro') {
  return {
    eligible: false,
    active: false,
    startsAt: null,
    expiresAt: null,
    remainingSeconds: 0,
    offerPriceCents: OFFER_PRICE_CENTS,
    firstMonthOnly: true as const,
    reason,
  };
}

async function existingFlashWindow(userUid: string) {
  const rows = await appDataRequest<Array<{ id: string; created_at: string }>>(
    `recommendation_events?user_uid=eq.${dbValue(userUid)}` +
      `&event_type=eq.${dbValue(LEDGER_EVENT_TYPE)}` +
      `&query=eq.${dbValue(FLASH_PROMO_LEDGER_QUERY)}` +
      '&select=id,created_at&order=created_at.asc,id.asc&limit=1'
  );
  return rows[0] || null;
}

async function lifetimeBusinessUnlockCount(userUid: string) {
  const rows = await appDataRequest<Array<{ id: string }>>(
    `recommendation_events?user_uid=eq.${dbValue(userUid)}` +
      `&event_type=eq.${dbValue(LEDGER_EVENT_TYPE)}` +
      `&query=eq.${dbValue(BUSINESS_UNLOCK_LEDGER_QUERY)}` +
      '&select=id&order=created_at.asc,id.asc&limit=6'
  );
  return rows.length;
}

async function prepareFlashWindow(userUid: string, workspaceId: string) {
  const existing = await existingFlashWindow(userUid);
  if (existing) return { ready: true as const, reason: null };

  const access = await getCreditStatus(userUid);
  if (!access.isFree || access.isDeveloper) {
    return { ready: false as const, reason: 'not_free' as const };
  }

  const lifetimeUnlocks = await lifetimeBusinessUnlockCount(userUid);
  if (lifetimeUnlocks < 5) {
    return { ready: false as const, reason: 'waiting_for_first_five' as const };
  }
  if (lifetimeUnlocks > 5) {
    return { ready: false as const, reason: 'missed_first_five' as const };
  }

  if (await hasPurchasedProBefore(userUid)) {
    return { ready: false as const, reason: 'prior_pro' as const };
  }

  await appDataRequest('recommendation_events', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      user_uid: userUid,
      workspace_id: workspaceId,
      event_type: LEDGER_EVENT_TYPE,
      query: FLASH_PROMO_LEDGER_QUERY,
      metadata: {
        scoutly_ledger: true,
        kind: 'flash_pro_first_purchase',
        trigger: 'fifth_lifetime_free_credit',
        offer_price_cents: OFFER_PRICE_CENTS,
        duration_hours: 12,
      },
    }),
  });

  return { ready: true as const, reason: null };
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

export async function handleFlashPromoRequest(req: VercelRequest, res: VercelResponse) {
  try {
    const identity = await requireFirebaseIdentity(req as any);
    const { workspaceId } = await ensureAppUser(identity);

    if (req.method === 'GET') {
      const prepared = await prepareFlashWindow(identity.uid, workspaceId);
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      if (!prepared.ready) return res.status(200).json({ promo: inactivePromo(prepared.reason) });

      const promo = await getFlashPromoStatus(identity.uid, workspaceId);
      return res.status(200).json({ promo });
    }

    if (req.method === 'POST') {
      const action = String(req.body?.action || 'checkout').trim().toLowerCase();
      if (action !== 'checkout') return res.status(400).json({ error: 'Ação inválida.' });

      const prepared = await prepareFlashWindow(identity.uid, workspaceId);
      if (!prepared.ready) {
        return res.status(409).json({
          error: 'Esta Scoutly Flash Promo não está disponível para esta conta.',
          code: 'FLASH_PROMO_UNAVAILABLE',
        });
      }

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
