import { appDataRequest, dbValue } from './appDataService.js';
import { getSubscriptionAccess } from './subscriptionAccessService.js';
import { assertFeatureEnabled } from './accountAdminService.js';

/**
 * Treasure chest: a small daily deck of recommended companies.
 * Free: 1 card per UTC day. Paid plans: up to 20 cards per UTC day.
 *
 * The client ranks the candidates (it knows the searches and the map); the server only decides how
 * many cards of the day exist and keeps them stable: once a card is in today's deck it stays there,
 * and new candidates are appended until the daily limit is reached.
 */

export const FREE_DAILY_CHEST_CARDS = 1;
export const PAID_DAILY_CHEST_CARDS = 20;
const MAX_CARD_BYTES = 6000;

export interface ChestDeck {
  plan: 'free' | 'go' | 'pro' | 'agency';
  limit: number;
  used: number;
  remaining: number;
  cards: Record<string, unknown>[];
  resetsAt: string;
}

const utcDay = (now = new Date()) => now.toISOString().slice(0, 10);

function resetsAt(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();
}

function planOf(value: unknown): ChestDeck['plan'] {
  const plan = String(value || 'free').toLowerCase();
  return plan === 'go' || plan === 'pro' || plan === 'agency' ? plan : 'free';
}

// recommendation_events accepts only a few legacy event types, so (like the credit ledger) the chest
// reuses "search" with an exact sentinel in the query column: one row per card of the day.
const LEDGER_EVENT_TYPE = 'search';
const CHEST_LEDGER_QUERY = '__scoutly_chest_card__';

async function readCards(userUid: string, day: string): Promise<Record<string, unknown>[]> {
  const start = new Date(`${day}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const rows = await appDataRequest<{ metadata: any }[]>(
    `recommendation_events?user_uid=eq.${dbValue(userUid)}&event_type=eq.${dbValue(LEDGER_EVENT_TYPE)}` +
      `&query=eq.${dbValue(CHEST_LEDGER_QUERY)}` +
      `&created_at=gte.${dbValue(start.toISOString())}&created_at=lt.${dbValue(end.toISOString())}` +
      `&select=metadata&order=created_at.asc,id.asc&limit=50`,
  );
  return rows.map((row) => row.metadata?.card).filter((card): card is Record<string, unknown> => Boolean(card && card.id));
}

function describe(plan: ChestDeck['plan'], cards: Record<string, unknown>[]): ChestDeck {
  const limit = plan === 'free' ? FREE_DAILY_CHEST_CARDS : PAID_DAILY_CHEST_CARDS;
  const kept = cards.slice(0, limit);
  return { plan, limit, used: kept.length, remaining: Math.max(0, limit - kept.length), cards: kept, resetsAt: resetsAt() };
}

/** Only the fields the card needs; contact secrets (sealed tokens, emails) never go into the deck. */
function sanitizeCard(raw: any): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || '').slice(0, 200);
  const name = String(raw.name || '').slice(0, 200);
  const lat = Number(raw.latitude ?? raw.coordinates?.lat);
  const lng = Number(raw.longitude ?? raw.coordinates?.lng);
  if (!id || !name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const text = (value: unknown, max: number) => (typeof value === 'string' && value ? value.slice(0, max) : null);
  const list = (value: unknown, max: number, size: number) =>
    Array.isArray(value) ? value.filter((item) => typeof item === 'string').slice(0, max).map((item) => item.slice(0, size)) : [];

  const card = {
    id,
    name,
    latitude: lat,
    longitude: lng,
    coordinates: { lat, lng },
    category: text(raw.category, 120) || '',
    confidence: Number.isFinite(Number(raw.confidence)) ? Number(raw.confidence) : 0,
    address: text(raw.address, 300) || '',
    website: text(raw.website, 300),
    websites: list(raw.websites, 3, 300),
    phone: text(raw.phone, 40),
    phones: list(raw.phones, 3, 40),
    socials: list(raw.socials, 6, 300),
    email: null,
    emails: [],
    source: text(raw.source, 60) || 'Overture Maps',
    operatingStatus: text(raw.operatingStatus, 40),
    municipio: text(raw.municipio, 120),
    uf: text(raw.uf, 8),
    dataInicioAtividade: text(raw.dataInicioAtividade, 20),
    leadStatus: 'NOVO',
    reason: text(raw.reason, 120),
    reasons: list(raw.reasons, 4, 60),
  };
  return JSON.stringify(card).length <= MAX_CARD_BYTES ? card : null;
}

export async function getChestDeck(userUid: string): Promise<ChestDeck> {
  const access = await getSubscriptionAccess(userUid);
  const plan = planOf(access.plan);
  return describe(plan, await readCards(userUid, utcDay()));
}

export async function openChest(userUid: string, workspaceId: string, candidates: unknown): Promise<ChestDeck> {
  await assertFeatureEnabled(userUid, 'recommendations');
  const access = await getSubscriptionAccess(userUid);
  const plan = planOf(access.plan);
  const day = utcDay();
  const existing = await readCards(userUid, day);
  const current = describe(plan, existing);
  if (current.remaining <= 0 || !Array.isArray(candidates)) return current;

  const taken = new Set(current.cards.map((card) => String(card.id)));
  const fresh: Record<string, unknown>[] = [];
  for (const raw of candidates.slice(0, 60)) {
    if (fresh.length >= current.remaining) break;
    const card = sanitizeCard(raw);
    if (!card || taken.has(String(card.id))) continue;
    taken.add(String(card.id));
    fresh.push(card);
  }
  if (!fresh.length) return current;

  // Insert one row per card; the quota is re-checked after the write so two parallel opens cannot exceed it.
  await appDataRequest('recommendation_events', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(fresh.map((card) => ({
      user_uid: userUid,
      workspace_id: workspaceId,
      event_type: LEDGER_EVENT_TYPE,
      business_id: String(card.id),
      query: CHEST_LEDGER_QUERY,
      metadata: { scoutly_ledger: true, plan, card },
    }))),
  });
  return describe(plan, await readCards(userUid, day));
}
