import type { FirebaseIdentity } from './firebaseTokenService.js';

const DEFAULT_APP_DB_URL = 'https://fpyfphabdjutwqlwjwib.supabase.co';

function config() {
  const url = (process.env.SCOUTLY_APP_SUPABASE_URL || DEFAULT_APP_DB_URL).replace(/\/$/, '');
  const key =
    process.env.SCOUTLY_APP_SUPABASE_SECRET_KEY ||
    process.env.SCOUTLY_APP_SUPABASE_SERVICE_ROLE_KEY ||
    '';

  if (!key) {
    throw Object.assign(new Error('SCOUTLY_APP_SUPABASE_SECRET_KEY não configurada'), {
      statusCode: 503,
    });
  }

  return { url, key };
}

function headersFor(key: string, extra?: HeadersInit) {
  const headers = new Headers(extra);
  headers.set('apikey', key);
  headers.set('Content-Type', 'application/json');

  if (key.startsWith('eyJ')) {
    headers.set('Authorization', `Bearer ${key}`);
  }

  return headers;
}

export async function appDataRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/${path.replace(/^\//, '')}`, {
    ...init,
    headers: headersFor(key, init.headers),
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

export function dbValue(value: string) {
  return encodeURIComponent(value);
}

export async function ensureAppUser(identity: FirebaseIdentity) {
  await appDataRequest('app_users?on_conflict=firebase_uid', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      firebase_uid: identity.uid,
      email: identity.email,
      display_name: identity.displayName,
      photo_url: identity.photoUrl,
      last_seen_at: new Date().toISOString(),
    }),
  });

  let workspaces = await appDataRequest<Array<{ id: string }>>(
    `workspaces?owner_uid=eq.${dbValue(identity.uid)}&select=id&limit=1`
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
        `workspaces?owner_uid=eq.${dbValue(identity.uid)}&select=id&limit=1`
      );
    }
  }

  const workspaceId = workspaces[0]?.id;
  if (!workspaceId) throw new Error('Não foi possível resolver o workspace');

  await appDataRequest('workspace_members?on_conflict=workspace_id,user_uid', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      workspace_id: workspaceId,
      user_uid: identity.uid,
      role: 'owner',
    }),
  });

  await appDataRequest('user_settings?on_conflict=user_uid', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify({ user_uid: identity.uid }),
  });

  const subscriptions = await appDataRequest<Array<{ user_uid: string }>>(
    `subscriptions?user_uid=eq.${dbValue(identity.uid)}&select=user_uid&limit=1`
  );

  if (!subscriptions.length) {
    // The 7-day clock must only start after the user explicitly accepts it
    // at the end of onboarding. This insert is conflict-safe because the
    // workspace and onboarding requests can initialize the same account at once.
    await appDataRequest('subscriptions?on_conflict=user_uid', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify({
        user_uid: identity.uid,
        plan: 'trial',
        status: 'pending',
        current_period_start: null,
        current_period_end: null,
      }),
    });
  }

  return { workspaceId };
}

export async function incrementUsage(userUid: string, counter: 'analyses' | 'ai_messages' | 'recommendation_refreshes') {
  await appDataRequest('rpc/scoutly_increment_usage', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      p_user_uid: userUid,
      p_counter: counter,
    }),
  });
}
