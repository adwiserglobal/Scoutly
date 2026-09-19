import { createVerify } from 'crypto';

export interface FirebaseIdentity {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
}

type FirebaseTokenPayload = {
  aud?: string;
  iss?: string;
  sub?: string;
  exp?: number;
  iat?: number;
  auth_time?: number;
  email?: string;
  name?: string;
  picture?: string;
  user_id?: string;
};

let certCache: Record<string, string> = {};
let certCacheExpiresAt = 0;

function decodeBase64UrlJson<T>(value: string): T {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as T;
}

async function getGoogleSecureTokenCerts() {
  const now = Date.now();
  if (Object.keys(certCache).length > 0 && now < certCacheExpiresAt) {
    return certCache;
  }

  const response = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
    { signal: AbortSignal.timeout(8000) }
  );

  if (!response.ok) {
    throw new Error(`Firebase certificate fetch failed with HTTP ${response.status}`);
  }

  certCache = await response.json();
  const cacheControl = response.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSeconds = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;
  certCacheExpiresAt = now + Math.max(300, maxAgeSeconds) * 1000;

  return certCache;
}

export async function verifyFirebaseIdToken(rawToken: string): Promise<FirebaseIdentity> {
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    'gen-lang-client-0931227900';

  const parts = rawToken.split('.');
  if (parts.length !== 3) throw new Error('Invalid Firebase token format');

  const header = decodeBase64UrlJson<{ alg?: string; kid?: string }>(parts[0]);
  const payload = decodeBase64UrlJson<FirebaseTokenPayload>(parts[1]);

  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('Invalid Firebase token header');
  }

  const certs = await getGoogleSecureTokenCerts();
  const certificate = certs[header.kid];
  if (!certificate) throw new Error('Unknown Firebase signing key');

  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${parts[0]}.${parts[1]}`);
  verifier.end();

  const signature = Buffer.from(
    parts[2].replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(parts[2].length / 4) * 4, '='),
    'base64'
  );

  if (!verifier.verify(certificate, signature)) {
    throw new Error('Invalid Firebase token signature');
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp <= nowSeconds) throw new Error('Firebase token expired');
  if (!payload.iat || payload.iat > nowSeconds + 300) throw new Error('Invalid Firebase token issue time');
  if (payload.auth_time && payload.auth_time > nowSeconds + 300) {
    throw new Error('Invalid Firebase authentication time');
  }
  if (payload.aud !== projectId) throw new Error('Invalid Firebase token audience');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error('Invalid Firebase token issuer');
  }

  const uid = payload.sub || payload.user_id;
  if (!uid || uid.length > 128) throw new Error('Invalid Firebase user id');

  return {
    uid,
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
  };
}

export async function requireFirebaseIdentity(req: { headers: Record<string, any> }) {
  const authHeader = String(req.headers.authorization || '');
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    throw Object.assign(new Error('Authentication required'), { statusCode: 401 });
  }

  try {
    return await verifyFirebaseIdToken(authHeader.slice(7).trim());
  } catch (error: any) {
    throw Object.assign(new Error(error?.message || 'Invalid authentication token'), {
      statusCode: 401,
    });
  }
}
