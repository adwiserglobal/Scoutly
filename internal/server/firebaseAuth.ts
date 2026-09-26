import { createVerify } from 'crypto';

export interface FirebaseIdentity {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoUrl: string | null;
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
};

let certCache: Record<string, string> = {};
let certCacheExpiresAt = 0;

function decodePart<T>(value: string): T {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as T;
}

async function getFirebaseCerts() {
  const now = Date.now();
  if (Object.keys(certCache).length > 0 && now < certCacheExpiresAt) return certCache;

  const response = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
    { signal: AbortSignal.timeout(8000) }
  );

  if (!response.ok) throw new Error(`Firebase certificates HTTP ${response.status}`);

  certCache = await response.json();
  const cacheControl = response.headers.get('cache-control') || '';
  const match = cacheControl.match(/max-age=(\d+)/i);
  certCacheExpiresAt = now + Math.max(300, Number(match?.[1] || 3600)) * 1000;
  return certCache;
}

export async function verifyFirebaseToken(token: string): Promise<FirebaseIdentity> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Token Firebase inválido');

  const header = decodePart<{ alg?: string; kid?: string }>(parts[0]);
  const payload = decodePart<FirebaseTokenPayload>(parts[1]);

  if (header.alg !== 'RS256' || !header.kid) throw new Error('Cabeçalho Firebase inválido');

  const certificates = await getFirebaseCerts();
  const certificate = certificates[header.kid];
  if (!certificate) throw new Error('Chave Firebase não reconhecida');

  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${parts[0]}.${parts[1]}`);
  verifier.end();

  const signaturePart = parts[2].replace(/-/g, '+').replace(/_/g, '/');
  const signature = Buffer.from(
    signaturePart.padEnd(Math.ceil(signaturePart.length / 4) * 4, '='),
    'base64'
  );

  if (!verifier.verify(certificate, signature)) throw new Error('Assinatura Firebase inválida');

  const projectId = process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0931227900';
  const now = Math.floor(Date.now() / 1000);

  if (!payload.sub || payload.sub.length > 128) throw new Error('UID Firebase inválido');
  if (!payload.exp || payload.exp <= now) throw new Error('Token Firebase expirado');
  if (!payload.iat || payload.iat > now + 300) throw new Error('Token Firebase com horário inválido');
  if (payload.aud !== projectId) throw new Error('Projeto Firebase inválido');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error('Emissor Firebase inválido');
  }

  return {
    uid: payload.sub,
    email: payload.email || null,
    displayName: payload.name || null,
    photoUrl: payload.picture || null,
  };
}

export async function requireFirebaseIdentity(req: { headers: any }) {
  const authorization = String(req.headers?.authorization || '');
  if (!authorization.toLowerCase().startsWith('bearer ')) {
    throw Object.assign(new Error('Autenticação obrigatória'), { statusCode: 401 });
  }

  try {
    return await verifyFirebaseToken(authorization.slice(7).trim());
  } catch (error: any) {
    throw Object.assign(new Error(error?.message || 'Sessão inválida'), { statusCode: 401 });
  }
}
