import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'crypto';
import { appDataRequest, dbValue } from './appDataService.js';

export type CreditState = {
  plan: 'free' | 'go' | 'pro' | 'agency' | 'trial' | string;
  dailyLimit: number | null;
  dailyUsed: number;
  dailyRemaining: number | null;
  monthlyLimit: number | null;
  monthlyUsed: number;
  monthlyRemaining: number | null;
  aiDailyLimit: number | null;
  aiDailyUsed: number;
  aiDailyRemaining: number | null;
  dailyResetAt: string;
  monthlyResetAt: string;
  recommendationsAccess: boolean;
  aiAccess: boolean;
  allowed?: boolean;
  charged?: boolean;
  alreadyUnlocked?: boolean;
  code?: string;
};

type UnlockPayload = {
  uid: string;
  businessId: string;
  protected: Record<string, unknown>;
  exp: number;
};

const PROTECTED_KEYS = [
  'website','websites','email','emails','phone','phones','socials','cnpj','razaoSocial','nomeFantasia',
  'cnaePrincipal','cnaesSecundarios','logradouro','numero','bairro','cep','municipio','uf','porte',
  'dataInicioAtividade','situacaoCadastral','pageSpeed','openingHoursRaw'
] as const;

function secretKey() {
  const raw = String(
    process.env.SCOUTLY_ACCESS_TOKEN_SECRET ||
    process.env.SCOUTLY_APP_SUPABASE_SECRET_KEY ||
    process.env.SCOUTLY_APP_SUPABASE_SERVICE_ROLE_KEY ||
    ''
  );
  if (!raw) throw Object.assign(new Error('Chave de proteção de dados não configurada.'), { statusCode: 503 });
  return createHash('sha256').update(raw).digest();
}

function encodeJson(value: unknown) {
  return Buffer.from(JSON.stringify(value), 'utf8');
}

export function createUnlockToken(userUid: string, business: any): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', secretKey(), iv);
  const protectedData: Record<string, unknown> = {};
  for (const key of PROTECTED_KEYS) protectedData[key] = business?.[key] ?? null;

  const payload: UnlockPayload = {
    uid: userUid,
    businessId: String(business?.id || ''),
    protected: protectedData,
    exp: Date.now() + 12 * 60 * 60 * 1000,
  };
  const encrypted = Buffer.concat([cipher.update(encodeJson(payload)), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString('base64url')).join('.');
}

export function readUnlockToken(token: string, userUid: string, businessId: string): UnlockPayload {
  try {
    const [ivRaw, tagRaw, encryptedRaw] = String(token || '').split('.');
    if (!ivRaw || !tagRaw || !encryptedRaw) throw new Error('bad token');
    const iv = Buffer.from(ivRaw, 'base64url');
    const tag = Buffer.from(tagRaw, 'base64url');
    const encrypted = Buffer.from(encryptedRaw, 'base64url');
    if (iv.length !== 12 || tag.length !== 16) throw new Error('bad token');

    const decipher = createDecipheriv('aes-256-gcm', secretKey(), iv);
    decipher.setAuthTag(tag);
    const raw = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    const payload = JSON.parse(raw) as UnlockPayload;
    const tokenUid = Buffer.from(String(payload.uid || ''));
    const expectedUid = Buffer.from(String(userUid || ''));
    const sameUid = tokenUid.length === expectedUid.length && timingSafeEqual(tokenUid, expectedUid);
    if (!sameUid || payload.businessId !== businessId || payload.exp < Date.now()) throw new Error('bad token');
    return payload;
  } catch {
    throw Object.assign(new Error('Este acesso ao negócio expirou. Atualize os resultados e tente novamente.'), {
      statusCode: 401,
      code: 'INVALID_UNLOCK_TOKEN',
    });
  }
}

export async function ensureFreePlanForNewUser(userUid: string) {
  const rows = await appDataRequest<any[]>(
    `subscriptions?user_uid=eq.${dbValue(userUid)}&select=plan,status,provider_subscription_id&limit=1`
  );
  const current = rows[0] || null;

  if (!current) {
    await appDataRequest('subscriptions?on_conflict=user_uid', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        user_uid: userUid,
        plan: 'free',
        status: 'active',
        current_period_start: null,
        current_period_end: null,
        cancel_at_period_end: false,
      }),
    });
    return;
  }

  const plan = String(current.plan || '').toLowerCase();
  const status = String(current.status || '').toLowerCase();
  if (plan === 'trial' && status === 'pending' && !current.provider_subscription_id) {
    await appDataRequest(`subscriptions?user_uid=eq.${dbValue(userUid)}&plan=eq.trial&status=eq.pending`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        plan: 'free',
        status: 'active',
        current_period_start: null,
        current_period_end: null,
        cancel_at_period_end: false,
        updated_at: new Date().toISOString(),
      }),
    });
  }
}

async function rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
  return appDataRequest<T>(`rpc/${name}`, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
}

export async function getCreditState(userUid: string): Promise<CreditState> {
  return rpc<CreditState>('scoutly_credit_status', { p_user_uid: userUid });
}

export async function consumeBusinessCredit(userUid: string, businessId: string): Promise<CreditState> {
  return rpc<CreditState>('scoutly_consume_business_credit', {
    p_user_uid: userUid,
    p_business_id: businessId,
  });
}

export async function consumeAiConversation(userUid: string): Promise<CreditState> {
  return rpc<CreditState>('scoutly_consume_ai_conversation', { p_user_uid: userUid });
}

export async function getUnlockedBusinessIds(userUid: string): Promise<Set<string>> {
  const rows = await appDataRequest<Array<{ resource_id: string }>>(
    `scoutly_usage_events?user_uid=eq.${dbValue(userUid)}&feature=eq.business_unlock&select=resource_id&limit=5000`
  );
  return new Set(rows.map((row) => String(row.resource_id || '')).filter(Boolean));
}

function redactBusiness(business: any, token: string) {
  const redacted: any = { ...business };
  for (const key of PROTECTED_KEYS) {
    if (key === 'website' || key === 'email' || key === 'phone' || key === 'cnpj') redacted[key] = null;
    else if (key === 'websites' || key === 'emails' || key === 'phones' || key === 'socials' || key === 'cnaesSecundarios') redacted[key] = [];
    else delete redacted[key];
  }
  redacted.isLocked = true;
  redacted.unlockToken = token;
  redacted.hasProtectedWebsite = Boolean(business?.website || business?.websites?.length);
  redacted.hasProtectedEmail = Boolean(business?.email || business?.emails?.length);
  redacted.hasProtectedPhone = Boolean(business?.phone || business?.phones?.length);
  redacted.hasProtectedSocials = Boolean(business?.socials?.length);
  return redacted;
}

export async function protectBusinessResults(userUid: string, businesses: any[]) {
  const state = await getCreditState(userUid);
  if (['pro', 'agency', 'trial'].includes(String(state.plan))) {
    return { businesses: businesses.map((business) => ({ ...business, isLocked: false })), creditState: state };
  }

  const unlocked = await getUnlockedBusinessIds(userUid);
  return {
    businesses: businesses.map((business) => {
      const id = String(business?.id || '');
      if (unlocked.has(id)) return { ...business, isLocked: false, previouslyUnlocked: true };
      return redactBusiness(business, createUnlockToken(userUid, business));
    }),
    creditState: state,
  };
}

export function mergeUnlockedBusiness(visibleBusiness: any, payload: UnlockPayload) {
  return {
    ...(visibleBusiness && typeof visibleBusiness === 'object' ? visibleBusiness : {}),
    ...payload.protected,
    id: payload.businessId,
    isLocked: false,
    unlockToken: undefined,
  };
}

export function assertRecommendationAccess(state: CreditState) {
  if (!state.recommendationsAccess) {
    throw Object.assign(new Error('Recomendações inteligentes estão disponíveis no plano Pro.'), {
      statusCode: 403,
      code: 'RECOMMENDATIONS_UPGRADE_REQUIRED',
    });
  }
}

export function assertAiAllowed(state: CreditState) {
  if (!state.allowed) {
    const isLimit = state.code === 'AI_DAILY_LIMIT';
    throw Object.assign(new Error(isLimit ? 'Você atingiu as 10 conversas de IA de hoje.' : 'A Scoutly AI não está disponível no plano Free.'), {
      statusCode: isLimit ? 429 : 403,
      code: state.code || 'AI_UPGRADE_REQUIRED',
    });
  }
}
