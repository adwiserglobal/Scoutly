import { appDataRequest, dbValue } from './appDataService.js';
import { getSubscriptionAccess } from './subscriptionAccessService.js';

export type ProductPlan = 'free' | 'go' | 'pro' | 'agency';

export type CreditStatus = {
  plan: ProductPlan;
  isFree: boolean;
  isUnlimited: boolean;
  remaining: number | null;
  dailyRemaining: number | null;
  dailyLimit: number | null;
  monthlyRemaining: number | null;
  monthlyLimit: number | null;
  monthlyUsed: number;
  dailyUsed: number;
  resetsAt: string | null;
  monthlyResetsAt: string | null;
  aiDailyLimit: number | null;
  aiDailyUsed: number;
  aiDailyRemaining: number | null;
  recommendationsAllowed: boolean;
  aiAllowed: boolean;
};

// recommendation_events has a legacy CHECK constraint that only accepts the
// original recommendation event types. Reuse the existing "search" type as a
// durable ledger transport and isolate credit rows with an exact sentinel in
// the query column. This keeps production compatible without requiring a DB
// migration before credit enforcement can work.
const LEDGER_EVENT_TYPE = 'search';
const BUSINESS_UNLOCK_LEDGER_QUERY = '__scoutly_credit_business_unlock__';
const AI_CONVERSATION_LEDGER_QUERY = '__scoutly_credit_ai_conversation__';

function httpError(message: string, statusCode: number, code: string): never {
  throw Object.assign(new Error(message), { statusCode, code });
}

function normalizePlan(value: string): ProductPlan {
  if (value === 'go' || value === 'pro' || value === 'agency') return value;
  return 'free';
}

function utcDayWindow(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

function utcMonthWindow(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

function validPeriod(startValue?: string | null, endValue?: string | null) {
  const start = startValue ? new Date(startValue) : null;
  const end = endValue ? new Date(endValue) : null;
  if (!start || !end || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return null;
  if (end.getTime() <= start.getTime()) return null;
  return { start, end };
}

async function listLedgerEvents(
  userUid: string,
  ledgerQuery: string,
  start: Date,
  end: Date,
  limit = 250,
): Promise<Array<{ id: string; created_at: string }>> {
  return appDataRequest<Array<{ id: string; created_at: string }>>(
    `recommendation_events?user_uid=eq.${dbValue(userUid)}` +
      `&event_type=eq.${dbValue(LEDGER_EVENT_TYPE)}` +
      `&query=eq.${dbValue(ledgerQuery)}` +
      `&created_at=gte.${dbValue(start.toISOString())}` +
      `&created_at=lt.${dbValue(end.toISOString())}` +
      `&select=id,created_at&order=created_at.asc,id.asc&limit=${Math.max(1, Math.min(limit, 500))}`
  );
}

async function countLedgerEvents(userUid: string, ledgerQuery: string, start: Date, end: Date) {
  const rows = await listLedgerEvents(userUid, ledgerQuery, start, end, 250);
  return rows.length;
}

async function deleteLedgerEvent(userUid: string, eventId: string) {
  await appDataRequest(
    `recommendation_events?user_uid=eq.${dbValue(userUid)}&id=eq.${dbValue(eventId)}`,
    { method: 'DELETE', headers: { Prefer: 'return=minimal' } }
  ).catch(() => undefined);
}

async function reserveLimitedEvent(options: {
  userUid: string;
  workspaceId: string;
  ledgerQuery: string;
  businessId?: string | null;
  metadata?: Record<string, unknown>;
  windows: Array<{ start: Date; end: Date; limit: number; code: string; message: string }>;
}) {
  for (const window of options.windows) {
    const count = await countLedgerEvents(
      options.userUid,
      options.ledgerQuery,
      window.start,
      window.end,
    );
    if (count >= window.limit) {
      httpError(window.message, 402, window.code);
    }
  }

  const insertedRows = await appDataRequest<Array<{ id: string; created_at: string }>>(
    'recommendation_events?select=id,created_at',
    {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        user_uid: options.userUid,
        workspace_id: options.workspaceId,
        event_type: LEDGER_EVENT_TYPE,
        business_id: options.businessId || null,
        query: options.ledgerQuery,
        metadata: {
          ...(options.metadata || {}),
          scoutly_ledger: true,
        },
      }),
    }
  );

  const inserted = insertedRows[0];
  if (!inserted?.id) {
    httpError('Não foi possível reservar seu crédito.', 409, 'CREDIT_RESERVATION_FAILED');
  }

  // Post-insert verification closes the common multi-tab race: every request
  // must be among the first N deterministic ledger rows in each active window.
  for (const window of options.windows) {
    const rows = await listLedgerEvents(
      options.userUid,
      options.ledgerQuery,
      window.start,
      window.end,
      Math.min(window.limit + 25, 250),
    );
    const allowedIds = new Set(rows.slice(0, window.limit).map((row) => row.id));
    if (!allowedIds.has(inserted.id)) {
      await deleteLedgerEvent(options.userUid, inserted.id);
      httpError(window.message, 402, window.code);
    }
  }

  return inserted;
}

export async function getCreditStatus(userUid: string): Promise<CreditStatus> {
  const access = await getSubscriptionAccess(userUid);
  const plan = normalizePlan(access.plan);
  const now = new Date();
  const day = utcDayWindow(now);
  const calendarMonth = utcMonthWindow(now);
  const billingPeriod = validPeriod(access.current_period_start, access.current_period_end);

  if (plan === 'pro' || plan === 'agency') {
    return {
      plan,
      isFree: false,
      isUnlimited: true,
      remaining: null,
      dailyRemaining: null,
      dailyLimit: null,
      monthlyRemaining: null,
      monthlyLimit: null,
      monthlyUsed: 0,
      dailyUsed: 0,
      resetsAt: null,
      monthlyResetsAt: null,
      aiDailyLimit: null,
      aiDailyUsed: 0,
      aiDailyRemaining: null,
      recommendationsAllowed: true,
      aiAllowed: true,
    };
  }

  if (plan === 'go') {
    const month = billingPeriod || calendarMonth;
    const [monthlyUsed, aiDailyUsed] = await Promise.all([
      countLedgerEvents(userUid, BUSINESS_UNLOCK_LEDGER_QUERY, month.start, month.end),
      countLedgerEvents(userUid, AI_CONVERSATION_LEDGER_QUERY, day.start, day.end),
    ]);
    return {
      plan,
      isFree: false,
      isUnlimited: false,
      remaining: Math.max(0, 80 - monthlyUsed),
      dailyRemaining: null,
      dailyLimit: null,
      monthlyRemaining: Math.max(0, 80 - monthlyUsed),
      monthlyLimit: 80,
      monthlyUsed,
      dailyUsed: 0,
      resetsAt: null,
      monthlyResetsAt: month.end.toISOString(),
      aiDailyLimit: 10,
      aiDailyUsed,
      aiDailyRemaining: Math.max(0, 10 - aiDailyUsed),
      recommendationsAllowed: true,
      aiAllowed: true,
    };
  }

  const [dailyUsed, monthlyUsed] = await Promise.all([
    countLedgerEvents(userUid, BUSINESS_UNLOCK_LEDGER_QUERY, day.start, day.end),
    countLedgerEvents(userUid, BUSINESS_UNLOCK_LEDGER_QUERY, calendarMonth.start, calendarMonth.end),
  ]);
  const dailyRemaining = Math.max(0, 5 - dailyUsed);
  const monthlyRemaining = Math.max(0, 25 - monthlyUsed);

  return {
    plan: 'free',
    isFree: true,
    isUnlimited: false,
    remaining: Math.min(dailyRemaining, monthlyRemaining),
    dailyRemaining,
    dailyLimit: 5,
    monthlyRemaining,
    monthlyLimit: 25,
    monthlyUsed,
    dailyUsed,
    resetsAt: day.end.toISOString(),
    monthlyResetsAt: calendarMonth.end.toISOString(),
    aiDailyLimit: 0,
    aiDailyUsed: 0,
    aiDailyRemaining: 0,
    recommendationsAllowed: false,
    aiAllowed: false,
  };
}

export async function consumeBusinessCredit(
  userUid: string,
  workspaceId: string,
  businessId: string,
) {
  const access = await getSubscriptionAccess(userUid);
  const plan = normalizePlan(access.plan);

  if (plan === 'pro' || plan === 'agency') {
    return getCreditStatus(userUid);
  }

  const now = new Date();
  const day = utcDayWindow(now);
  const month = plan === 'go'
    ? validPeriod(access.current_period_start, access.current_period_end) || utcMonthWindow(now)
    : utcMonthWindow(now);

  if (plan === 'go') {
    await reserveLimitedEvent({
      userUid,
      workspaceId,
      ledgerQuery: BUSINESS_UNLOCK_LEDGER_QUERY,
      businessId,
      metadata: { plan: 'go', source: 'business_open' },
      windows: [{
        start: month.start,
        end: month.end,
        limit: 80,
        code: 'MONTHLY_CREDIT_LIMIT',
        message: 'Você usou os 80 créditos do seu ciclo atual. Faça upgrade para continuar prospectando.',
      }],
    });
    return getCreditStatus(userUid);
  }

  await reserveLimitedEvent({
    userUid,
    workspaceId,
    ledgerQuery: BUSINESS_UNLOCK_LEDGER_QUERY,
    businessId,
    metadata: { plan: 'free', source: 'business_open' },
    windows: [
      {
        start: day.start,
        end: day.end,
        limit: 5,
        code: 'DAILY_CREDIT_LIMIT',
        message: 'Seus 5 créditos gratuitos de hoje acabaram.',
      },
      {
        start: month.start,
        end: month.end,
        limit: 25,
        code: 'MONTHLY_CREDIT_LIMIT',
        message: 'Você atingiu o limite de 25 créditos gratuitos deste mês.',
      },
    ],
  });

  return getCreditStatus(userUid);
}

export async function consumeAiConversation(userUid: string, workspaceId: string) {
  const access = await getSubscriptionAccess(userUid);
  const plan = normalizePlan(access.plan);

  if (plan === 'free') {
    httpError('A Scoutly AI é um recurso dos planos pagos.', 402, 'AI_REQUIRES_PAID_PLAN');
  }

  if (plan === 'pro' || plan === 'agency') {
    return getCreditStatus(userUid);
  }

  const day = utcDayWindow(new Date());
  await reserveLimitedEvent({
    userUid,
    workspaceId,
    ledgerQuery: AI_CONVERSATION_LEDGER_QUERY,
    metadata: { plan: 'go', source: 'scoutly_ai' },
    windows: [{
      start: day.start,
      end: day.end,
      limit: 10,
      code: 'DAILY_AI_LIMIT',
      message: 'Você atingiu o limite de 10 conversas com a Scoutly AI hoje. O limite renova à meia-noite UTC.',
    }],
  });
  return getCreditStatus(userUid);
}

export async function requireRecommendationsAccess(userUid: string) {
  const status = await getCreditStatus(userUid);
  if (!status.recommendationsAllowed) {
    httpError('Recomendações inteligentes são um recurso dos planos pagos.', 402, 'RECOMMENDATIONS_REQUIRE_PAID_PLAN');
  }
  return status;
}
