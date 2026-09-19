import type { FirebaseIdentity } from './firebaseTokenService.js';

const DEFAULT_APP_DB_URL = 'https://fpyfphabdjutwqlwjwib.supabase.co';

function getConfig() {
  const url = (process.env.SCOUTLY_APP_SUPABASE_URL || DEFAULT_APP_DB_URL).replace(/\/$/, '');
  const key =
    process.env.SCOUTLY_APP_SUPABASE_SECRET_KEY ||
    process.env.SCOUTLY_APP_SUPABASE_SERVICE_ROLE_KEY ||
    '';

  if (!key) {
    throw new Error('SCOUTLY_APP_SUPABASE_SECRET_KEY is not configured');
  }

  return { url, key };
}

function buildHeaders(key: string, extra?: HeadersInit) {
  const headers = new Headers(extra);
  headers.set('apikey', key);
  headers.set('Content-Type', 'application/json');

  // Legacy service_role keys are JWTs. New sb_secret_* keys must not be sent as Bearer.
  if (key.startsWith('eyJ')) {
    headers.set('Authorization', `Bearer ${key}`);
  }

  return headers;
}

export async function appDataRequest<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const { url, key } = getConfig();
  const response = await fetch(`${url}/rest/v1/${path.replace(/^\//, '')}`, {
    ...init,
    headers: buildHeaders(key, init.headers),
    signal: init.signal || AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`Scoutly App DB HTTP ${response.status}: ${details.slice(0, 500)}`);
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

function eq(value: string) {
  return encodeURIComponent(value);
}

export async function ensureAppUser(identity: FirebaseIdentity): Promise<{ workspaceId: string }> {
  await appDataRequest('app_users?on_conflict=firebase_uid', {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      firebase_uid: identity.uid,
      email: identity.email || null,
      display_name: identity.name || null,
      photo_url: identity.picture || null,
      last_seen_at: new Date().toISOString(),
    }),
  });

  let workspaces = await appDataRequest<Array<{ id: string }>>(
    `workspaces?owner_uid=eq.${eq(identity.uid)}&select=id&limit=1`
  );

  if (!workspaces.length) {
    try {
      workspaces = await appDataRequest<Array<{ id: string }>>('workspaces?select=id', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          owner_uid: identity.uid,
          name: 'Meu workspace',
          plan: 'trial',
        }),
      });
    } catch {
      workspaces = await appDataRequest<Array<{ id: string }>>(
        `workspaces?owner_uid=eq.${eq(identity.uid)}&select=id&limit=1`
      );
    }
  }

  const workspaceId = workspaces[0]?.id;
  if (!workspaceId) throw new Error('Could not resolve user workspace');

  await appDataRequest('workspace_members?on_conflict=workspace_id,user_uid', {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      workspace_id: workspaceId,
      user_uid: identity.uid,
      role: 'owner',
    }),
  });

  return { workspaceId };
}

export function appDbEq(value: string) {
  return eq(value);
}
