import { appDataRequest, dbValue } from './appDataService.js';

export const FEEDBACK_ISSUES = ['whatsapp', 'site', 'redes_sociais', 'outros'] as const;
export type FeedbackIssue = (typeof FEEDBACK_ISSUES)[number];

function text(value: unknown, max: number): string {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim()
    .slice(0, max);
}

/** Masked (credit-locked) values contain bullets and carry no information for the reviewer. */
function visible(value: unknown, max: number): string {
  const v = text(value, max);
  return v.includes('•') ? '' : v;
}

function list(value: unknown, itemMax: number, limit: number): string[] {
  return (Array.isArray(value) ? value : [])
    .map((item) => visible(item, itemMax))
    .filter(Boolean)
    .slice(0, limit);
}

/**
 * Builds what the reviewer needs to locate the business and see what the user was looking at.
 * Never stores e-mail addresses (they are credit-gated).
 */
export function buildFeedbackSnapshot(business: any, displayed: any) {
  const b = business && typeof business === 'object' ? business : {};
  const d = displayed && typeof displayed === 'object' ? displayed : {};
  return {
    name: text(b.name, 160),
    category: text(b.category, 120),
    address: text(b.address, 240),
    source: text(b.source, 80),
    confidence: Number.isFinite(Number(b.confidence)) ? Number(b.confidence) : null,
    googleMapsUrl: text(b.googleMapsUrl, 300) || null,
    googlePlaceId: text(b.googlePlaceId, 120) || null,
    latitude: Number.isFinite(Number(b.latitude)) ? Number(b.latitude) : null,
    longitude: Number.isFinite(Number(b.longitude)) ? Number(b.longitude) : null,
    shown: {
      website: visible(d.website, 300) || null,
      phone: visible(d.phone, 40) || null,
      whatsapp: visible(d.whatsapp, 40) || null,
      socials: list(d.socials, 300, 8),
    },
  };
}

export async function saveBusinessFeedback(input: {
  userUid: string;
  userEmail: string | null;
  businessId: unknown;
  business: unknown;
  displayed: unknown;
  rating: unknown;
  issues: unknown;
}) {
  const businessId = text(input.businessId, 200);
  if (!businessId) throw Object.assign(new Error('businessId é obrigatório'), { statusCode: 400 });
  if (input.rating !== 'up' && input.rating !== 'down') {
    throw Object.assign(new Error('Avaliação inválida'), { statusCode: 400 });
  }

  const issues =
    input.rating === 'down'
      ? Array.from(
          new Set(
            (Array.isArray(input.issues) ? input.issues : []).filter((item): item is FeedbackIssue =>
              (FEEDBACK_ISSUES as readonly string[]).includes(String(item))
            )
          )
        )
      : [];
  if (input.rating === 'down' && issues.length === 0) {
    throw Object.assign(new Error('Escolha o que podemos melhorar'), { statusCode: 400 });
  }

  const snapshot = buildFeedbackSnapshot(input.business, input.displayed);
  const now = new Date().toISOString();

  await appDataRequest('business_feedback?on_conflict=user_uid,business_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      user_uid: input.userUid,
      user_email: input.userEmail,
      business_id: businessId,
      business_name: snapshot.name || text((input.business as any)?.name, 160),
      business_snapshot: snapshot,
      rating: input.rating,
      issues,
      updated_at: now,
    }),
  });
}

export async function listBusinessFeedback(filter: { rating?: string; limit?: number }) {
  const rating = filter.rating === 'up' || filter.rating === 'down' ? `&rating=eq.${dbValue(filter.rating)}` : '';
  const limit = Math.max(1, Math.min(Number(filter.limit) || 300, 500));
  const rows = await appDataRequest<any[]>(
    `business_feedback?select=id,user_uid,user_email,business_id,business_name,business_snapshot,rating,issues,created_at,updated_at&order=updated_at.desc&limit=${limit}${rating}`
  );
  return rows;
}
