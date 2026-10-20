import { appDataRequest, dbValue } from './appDataService.js';
import { getSubscriptionAccess } from './subscriptionAccessService.js';

/**
 * Flight mode usage. Free: 5 minutes per UTC day. Paid plans: unlimited.
 *
 * The client sends a heartbeat every ~15 s while the plane is actually flying (it stops while a
 * business card is open). The server never trusts the reported time: each heartbeat adds at most
 * the wall-clock time elapsed since the previous one (capped), so the limit cannot be stretched by
 * sending slow or fake values. A client that never sends heartbeats is not enforced; this is a
 * product limit for a casual feature, not a security boundary.
 */

export const FREE_DAILY_FLIGHT_SECONDS = 300;
const TICK_CAP_SECONDS = 30;
const SESSION_GAP_SECONDS = 40; // after this much silence a heartbeat counts as the start of a new burst
const FIRST_TICK_SECONDS = 15;

export interface FlightStatus {
  plan: 'free' | 'go' | 'pro' | 'agency';
  unlimited: boolean;
  limitSeconds: number | null;
  usedSeconds: number;
  remainingSeconds: number | null;
}

interface UsageRow { seconds: number; last_tick: string | null }

const utcDay = (now = new Date()) => now.toISOString().slice(0, 10);

function planOf(value: unknown): FlightStatus['plan'] {
  const plan = String(value || 'free').toLowerCase();
  return plan === 'go' || plan === 'pro' || plan === 'agency' ? plan : 'free';
}

function migrationError(error: any) {
  if (/flight_usage|PGRST205|42P01/i.test(String(error?.message || ''))) {
    return Object.assign(new Error('O modo voo ainda não foi ativado neste ambiente (falta aplicar a migration 017).'), { statusCode: 503, code: 'FLIGHT_MIGRATION_PENDING' });
  }
  return error;
}

async function readUsage(userUid: string, day: string): Promise<UsageRow | null> {
  try {
    const rows = await appDataRequest<UsageRow[]>(
      `flight_usage?user_uid=eq.${dbValue(userUid)}&day=eq.${day}&select=seconds,last_tick&limit=1`,
    );
    return rows[0] || null;
  } catch (error) {
    throw migrationError(error);
  }
}

async function writeUsage(userUid: string, day: string, seconds: number, now: Date) {
  try {
    await appDataRequest('flight_usage?on_conflict=user_uid,day', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_uid: userUid, day, seconds, last_tick: now.toISOString(), updated_at: now.toISOString() }),
    });
  } catch (error) {
    throw migrationError(error);
  }
}

function describe(plan: FlightStatus['plan'], used: number): FlightStatus {
  if (plan !== 'free') return { plan, unlimited: true, limitSeconds: null, usedSeconds: used, remainingSeconds: null };
  return {
    plan, unlimited: false, limitSeconds: FREE_DAILY_FLIGHT_SECONDS, usedSeconds: Math.min(used, FREE_DAILY_FLIGHT_SECONDS),
    remainingSeconds: Math.max(0, FREE_DAILY_FLIGHT_SECONDS - used),
  };
}

export async function getFlightStatus(userUid: string): Promise<FlightStatus> {
  const access = await getSubscriptionAccess(userUid);
  const plan = planOf(access.plan);
  if (plan !== 'free') return describe(plan, 0);
  const usage = await readUsage(userUid, utcDay());
  return describe(plan, usage?.seconds || 0);
}

export async function startFlight(userUid: string): Promise<FlightStatus> {
  const status = await getFlightStatus(userUid);
  if (!status.unlimited && (status.remainingSeconds ?? 0) <= 0) {
    throw Object.assign(
      new Error('Seu tempo de voo grátis de hoje acabou (5 minutos por dia). Assine um plano para voar sem limite.'),
      { statusCode: 402, code: 'FLIGHT_LIMIT_REACHED' },
    );
  }
  if (!status.unlimited) {
    const now = new Date();
    const day = utcDay(now);
    const usage = await readUsage(userUid, day);
    // Opening a flight does not consume time by itself; it only sets the heartbeat reference.
    await writeUsage(userUid, day, usage?.seconds || 0, now);
  }
  return status;
}

export async function tickFlight(userUid: string): Promise<FlightStatus> {
  const access = await getSubscriptionAccess(userUid);
  const plan = planOf(access.plan);
  if (plan !== 'free') return describe(plan, 0);

  const now = new Date();
  const day = utcDay(now);
  const usage = await readUsage(userUid, day);
  const used = usage?.seconds || 0;
  const sinceLast = usage?.last_tick ? (now.getTime() - new Date(usage.last_tick).getTime()) / 1000 : Infinity;
  const delta = sinceLast <= SESSION_GAP_SECONDS ? Math.min(TICK_CAP_SECONDS, Math.max(0, sinceLast)) : FIRST_TICK_SECONDS;
  const next = Math.min(FREE_DAILY_FLIGHT_SECONDS + TICK_CAP_SECONDS, used + Math.round(delta));
  await writeUsage(userUid, day, next, now);
  return describe(plan, next);
}
