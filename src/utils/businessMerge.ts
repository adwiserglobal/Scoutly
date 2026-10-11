import type { Business } from '../types';

function normalizeText(value?: string | null) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function phoneDigits(value?: string | null) {
  return String(value || '').replace(/\D/g, '');
}

function websiteHost(value?: string | null) {
  try {
    const raw = String(value || '').trim();
    if (!raw) return '';
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
      .hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return '';
  }
}

function nearby(a: Business, b: Business) {
  const lat = Math.abs(Number(a.latitude) - Number(b.latitude));
  const lng = Math.abs(Number(a.longitude) - Number(b.longitude));
  return Number.isFinite(lat) && Number.isFinite(lng) && lat <= 0.0015 && lng <= 0.0018;
}

function duplicate(a: Business, b: Business) {
  const aPhone = phoneDigits(a.phone || a.phones?.[0]);
  const bPhone = phoneDigits(b.phone || b.phones?.[0]);
  if (aPhone && bPhone && aPhone === bPhone) return true;

  const aHost = websiteHost(a.website);
  const bHost = websiteHost(b.website);
  if (aHost && bHost && aHost === bHost) return true;

  const aName = normalizeText(a.name);
  const bName = normalizeText(b.name);
  return Boolean(aName && bName && aName === bName && nearby(a, b));
}

function mergeSafeGoogleFields(existing: Business, incoming: Business): Business {
  const incomingIsOmkar = (incoming.sources || [incoming.source]).some((source) => /omkar/i.test(String(source || '')));
  if (!incomingIsOmkar) return existing;

  return {
    ...existing,
    website: existing.website || incoming.website || null,
    websites: Array.from(new Set([...(existing.websites || []), ...(incoming.websites || [])].filter(Boolean))),
    phone: existing.phone || incoming.phone || null,
    phones: Array.from(new Set([...(existing.phones || []), ...(incoming.phones || [])].filter(Boolean))),
    socials: Array.from(new Set([...(existing.socials || []), ...(incoming.socials || [])].filter(Boolean))),
    sources: Array.from(new Set([...(existing.sources || [existing.source]), ...(incoming.sources || [incoming.source])].filter(Boolean))),
    confidence: Math.max(existing.confidence || 0, incoming.confidence || 0),
    googleMapsUrl: existing.googleMapsUrl || incoming.googleMapsUrl || null,
    googlePlaceId: existing.googlePlaceId || incoming.googlePlaceId || null,
    googleKgmid: existing.googleKgmid || incoming.googleKgmid || null,
    rating: incoming.rating ?? existing.rating ?? null,
    reviewCount: incoming.reviewCount ?? existing.reviewCount ?? null,
    owner: existing.owner || incoming.owner || null,
    canClaim: incoming.canClaim ?? existing.canClaim,
    isSpendingOnAds: incoming.isSpendingOnAds ?? existing.isSpendingOnAds,
    featuredImage: existing.featuredImage || incoming.featuredImage || null,
    priceRange: existing.priceRange || incoming.priceRange || null,
    googleStatus: existing.googleStatus || incoming.googleStatus || null,
    // Keep the existing id and sealed-contact token. An Omkar token belongs to
    // its own provider id and must never be transplanted onto another business.
    sealedContactToken: existing.sealedContactToken,
    contactLocked: existing.contactLocked,
    emailLocked: existing.emailLocked,
    email: existing.email,
    emails: existing.emails,
  };
}

export function mergeBusinessSources(current: Business[], incoming: Business[], max = 300): Business[] {
  const result = [...current];

  for (const business of incoming) {
    const index = result.findIndex((candidate) => duplicate(candidate, business));
    if (index >= 0) {
      result[index] = mergeSafeGoogleFields(result[index], business);
    } else {
      result.push(business);
    }
    if (result.length >= max) break;
  }

  return result.slice(0, max);
}
