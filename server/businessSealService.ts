import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const TOKEN_VERSION = 'v1';
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const MASKED_EMAIL = '••••@••••••.com';

function dataKey() {
  const secret = String(
    process.env.SCOUTLY_DATA_SEAL_SECRET ||
    process.env.SCOUTLY_APP_SUPABASE_SECRET_KEY ||
    process.env.SCOUTLY_APP_SUPABASE_SERVICE_ROLE_KEY ||
    ''
  );
  if (!secret) {
    throw Object.assign(new Error('Chave de proteção dos dados da Scoutly não configurada.'), {
      statusCode: 503,
      code: 'DATA_SEAL_SECRET_MISSING',
    });
  }
  return createHash('sha256').update(`scoutly-contact-seal:${secret}`).digest();
}

function b64url(value: Buffer) {
  return value.toString('base64url');
}

function fromB64url(value: string) {
  return Buffer.from(value, 'base64url');
}

function isMasked(value: unknown) {
  return String(value || '').includes('•');
}

export function sealBusinessContacts(business: any) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', dataKey(), iv);
  const payload = Buffer.from(JSON.stringify({
    v: 1,
    exp: Date.now() + TOKEN_TTL_MS,
    businessId: String(business?.id || ''),
    contacts: {
      phone: business?.phone || null,
      phones: Array.isArray(business?.phones) ? business.phones : [],
      email: business?.email || null,
      emails: Array.isArray(business?.emails) ? business.emails : [],
    },
  }), 'utf8');
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [TOKEN_VERSION, b64url(iv), b64url(tag), b64url(encrypted)].join('.');
}

export function unsealBusinessContacts(token: string, expectedBusinessId?: string) {
  const parts = String(token || '').split('.');
  if (parts.length !== 4 || parts[0] !== TOKEN_VERSION) {
    throw Object.assign(new Error('Dados protegidos inválidos.'), {
      statusCode: 400,
      code: 'INVALID_BUSINESS_TOKEN',
    });
  }

  try {
    const iv = fromB64url(parts[1]);
    const tag = fromB64url(parts[2]);
    const encrypted = fromB64url(parts[3]);
    const decipher = createDecipheriv('aes-256-gcm', dataKey(), iv);
    decipher.setAuthTag(tag);
    const decoded = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    const payload = JSON.parse(decoded);

    if (!payload?.businessId || Number(payload?.exp || 0) < Date.now()) throw new Error('expired');
    if (expectedBusinessId && String(payload.businessId) !== String(expectedBusinessId)) throw new Error('business mismatch');

    return {
      businessId: String(payload.businessId),
      phone: payload?.contacts?.phone || null,
      phones: Array.isArray(payload?.contacts?.phones) ? payload.contacts.phones : [],
      email: payload?.contacts?.email || null,
      emails: Array.isArray(payload?.contacts?.emails) ? payload.contacts.emails : [],
    };
  } catch (error: any) {
    if (error?.statusCode) throw error;
    throw Object.assign(new Error('Os dados protegidos expiraram. Atualize a busca e tente novamente.'), {
      statusCode: 400,
      code: 'INVALID_BUSINESS_TOKEN',
    });
  }
}

export function protectBusinessForClient(business: any) {
  if (!business || typeof business !== 'object') return business;

  const rawPhones = Array.isArray(business.phones) ? business.phones.filter(Boolean) : [];
  const rawEmails = Array.isArray(business.emails) ? business.emails.filter(Boolean) : [];
  const visiblePhones = rawPhones.filter((phone: unknown) => !isMasked(phone));
  const visiblePhone = business.phone && !isMasked(business.phone)
    ? business.phone
    : visiblePhones[0] || null;
  const hasEmail = Boolean(business.hasProtectedEmail || business.email || rawEmails.length > 0);
  const existingToken = typeof business.sealedContactToken === 'string'
    ? business.sealedContactToken.trim()
    : '';

  // Previously persisted snapshots may already contain a valid opaque token.
  // Preserve it, but never preserve a masked phone placeholder as if it were a
  // real phone. Email remains server-sealed and is never sent in plaintext.
  if (business.contactLocked && existingToken) {
    return {
      ...business,
      phone: visiblePhone,
      phones: visiblePhones,
      email: hasEmail ? MASKED_EMAIL : null,
      emails: hasEmail ? [MASKED_EMAIL] : [],
      contactLocked: true,
      emailLocked: hasEmail,
      hasProtectedPhone: false,
      hasProtectedEmail: hasEmail,
      sealedContactToken: existingToken,
    };
  }

  return {
    ...business,
    // Phone and other non-email business data are visible after the prospecting
    // credit gate. Only email remains a paid field.
    phone: visiblePhone,
    phones: visiblePhones,
    email: hasEmail ? MASKED_EMAIL : null,
    emails: hasEmail ? [MASKED_EMAIL] : [],
    contactLocked: true,
    emailLocked: hasEmail,
    hasProtectedPhone: false,
    hasProtectedEmail: hasEmail,
    sealedContactToken: sealBusinessContacts(business),
  };
}

export function protectBusinessListForClient<T = any>(businesses: T[]): T[] {
  return (Array.isArray(businesses) ? businesses : []).map((business: any) => protectBusinessForClient(business));
}
