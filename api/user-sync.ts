import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createVerify } from 'crypto';

const APP_DB_URL = (
  process.env.SCOUTLY_APP_SUPABASE_URL ||
  'https://fpyfphabdjutwqlwjwib.supabase.co'
).replace(/\/$/, '');

type FirebasePayload = {
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
  if (Object.keys(certCache).length && now < certCacheExpiresAt) return certCache;

  const response = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
    { signal: AbortSignal.timeout(8000) }
  );

  if (!response.ok) {
    throw new Error(`Firebase certificates HTTP ${response.status}`);
  }

  certCache = await response.json();
  const cacheControl = response.headers.get('cache-control') || '';
  const match = cacheControl.match(/max-age=(\d+)/i);
  certCacheExpiresAt = now + Math.max(300, Number(match?.[1] || 3600)) * 1000;
  return certCache;
}

async function verifyFirebaseToken(token: string) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Token Firebase inválido');

  const header = decodePart<{ alg?: string; kid?: string }>(parts[0]);
  const payload = decodePart<FirebasePayload>(parts[1]);

  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('Cabeçalho Firebase inválido');
  }

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

  if (!verifier.verify(certificate, signature)) {
    throw new Error('Assinatura Firebase inválida');
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    'gen-lang-client-0931227900';
  const now = Math.floor(Date.now() / 1000);

  if (!payload.sub || payload.sub.length > 128) throw new Error('UID Firebase inválido');
  if (!payload.exp || payload.exp <= now) throw new Error('Token Firebase expirado');
  if (!payload.iat || payload.iat > now + 300) throw new Error('Token Firebase com horário inválido');
  if (payload.auth_time && payload.auth_time > now + 300) {
    throw new Error('Autenticação Firebase com horário inválido');
  }
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

function getAppDbSecret() {
  return (
    process.env.SCOUTLY_APP_SUPABASE_SECRET_KEY ||
    process.env.SCOUTLY_APP_SUPABASE_SERVICE_ROLE_KEY ||
    ''
  );
}

async function upsertUser(user: {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoUrl: string | null;
}) {
  const secret = getAppDbSecret();
  if (!secret) {
    throw Object.assign(
      new Error('SCOUTLY_APP_SUPABASE_SECRET_KEY não configurada'),
      { statusCode: 503 }
    );
  }

  const headers: Record<string, string> = {
    apikey: secret,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=minimal',
  };

  // Legacy service_role keys are JWTs and use Bearer. New sb_secret_* keys use apikey only.
  if (secret.startsWith('eyJ')) {
    headers.Authorization = `Bearer ${secret}`;
  }

  const response = await fetch(
    `${APP_DB_URL}/rest/v1/app_users?on_conflict=firebase_uid`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        firebase_uid: user.uid,
        email: user.email,
        display_name: user.displayName,
        photo_url: user.photoUrl,
        last_seen_at: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(8000),
    }
  );

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`Scoutly App DB HTTP ${response.status}: ${details.slice(0, 300)}`);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const authorization = String(req.headers.authorization || '');
    if (!authorization.toLowerCase().startsWith('bearer ')) {
      return res.status(401).json({ error: 'Autenticação obrigatória' });
    }

    const user = await verifyFirebaseToken(authorization.slice(7).trim());
    await upsertUser(user);

    return res.status(200).json({
      success: true,
      user: {
        uid: user.uid,
        email: user.email,
      },
    });
  } catch (error: any) {
    const statusCode = Number(error?.statusCode || 500);
    console.error('[API /api/user-sync]:', error?.message || error);
    return res.status(statusCode).json({
      error:
        statusCode === 503
          ? 'Banco de usuários ainda não configurado no ambiente.'
          : statusCode === 401
            ? 'Sessão inválida ou expirada.'
            : 'Não foi possível sincronizar o usuário.',
    });
  }
}
