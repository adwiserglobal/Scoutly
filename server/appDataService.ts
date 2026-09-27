import type { FirebaseIdentity } from './firebaseTokenService.js';
import { protectBusinessForClient } from './businessSealService.js';

const DEFAULT_APP_DB_URL = 'https://fpyfphabdjutwqlwjwib.supabase.co';
const DEFAULT_APP_URL = 'https://www.scoutly.pro';
const SNAPSHOT_TABLES = new Set([
  'user_leads',
  'favorites',
  'recent_businesses',
  'visit_route_stops',
]);

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

function protectPersistedBusinessSnapshots(path: string, value: any) {
  const table = path.replace(/^\//, '').split('?')[0];
  if (!SNAPSHOT_TABLES.has(table)) return value;

  const protectRow = (row: any) => {
    if (!row || typeof row !== 'object' || !row.business_snapshot) return row;
    return {
      ...row,
      business_snapshot: protectBusinessForClient(row.business_snapshot),
    };
  };

  if (Array.isArray(value)) return value.map(protectRow);
  return protectRow(value);
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
  if (!text) return undefined as T;

  const parsed = JSON.parse(text);
  const method = String(init.method || 'GET').toUpperCase();
  return (method === 'GET' ? protectPersistedBusinessSnapshots(path, parsed) : parsed) as T;
}

export function dbValue(value: string) {
  return encodeURIComponent(value);
}

function firstNameForWelcome(identity: FirebaseIdentity) {
  const fromDisplayName = String(identity.displayName || '').trim().split(/\s+/)[0];
  if (fromDisplayName) return fromDisplayName;

  const fromEmail = String(identity.email || '')
    .split('@')[0]
    .replace(/[._-]+/g, ' ')
    .trim()
    .split(/\s+/)[0];

  if (!fromEmail) return 'por aqui';
  return fromEmail.charAt(0).toUpperCase() + fromEmail.slice(1);
}

async function emitWelcomeEvent(identity: FirebaseIdentity) {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  if (!apiKey || !identity.email) {
    if (!apiKey) console.warn('[Scoutly Welcome] RESEND_API_KEY não configurada; e-mail de boas-vindas não enviado.');
    return;
  }

  const appUrl = String(process.env.APP_URL || DEFAULT_APP_URL).replace(/\/$/, '');
  const response = await fetch('https://api.resend.com/events/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      event: 'user.created',
      email: identity.email,
      payload: {
        user_name: firstNameForWelcome(identity),
        cta_url: `${appUrl}/dashboard`,
      },
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`Resend Events HTTP ${response.status}: ${details.slice(0, 400)}`);
  }
}

export async function ensureAppUser(identity: FirebaseIdentity) {
  // Insert-only first: the returned row is our server-side source of truth for
  // whether this account is genuinely new. This also prevents duplicate welcome
  // events when multiple authenticated requests arrive at the same time.
  const insertedUsers = await appDataRequest<Array<{ firebase_uid: string }>>(
    'app_users?on_conflict=firebase_uid&select=firebase_uid',
    {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
      body: JSON.stringify({
        firebase_uid: identity.uid,
        email: identity.email,
        display_name: identity.displayName,
        photo_url: identity.photoUrl,
        last_seen_at: new Date().toISOString(),
      }),
    }
  );
  const isNewUser = insertedUsers.length > 0;

  if (!isNewUser) {
    await appDataRequest(`app_users?firebase_uid=eq.${dbValue(identity.uid)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        email: identity.email,
        display_name: identity.displayName,
        photo_url: identity.photoUrl,
        last_seen_at: new Date().toISOString(),
      }),
    });
  }

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
    // Keep the legacy storage values compatible with the existing database
    // constraints. Product access is normalized to the permanent Free tier by
    // subscriptionAccessService until a paid Stripe subscription is active.
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

  if (isNewUser && identity.email) {
    // Welcome email is deliberately best-effort: account creation must never
    // fail just because the lifecycle-email provider is temporarily unavailable.
    void emitWelcomeEvent(identity).catch((error) => {
      console.warn('[Scoutly Welcome] Falha ao emitir user.created:', error?.message || error);
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
