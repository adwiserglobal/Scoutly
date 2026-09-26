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
    throw Object.assign(
      new Error(`Scoutly App DB HTTP ${response.status}: ${details.slice(0, 500)}`),
      { statusCode: response.status >= 500 ? 502 : response.status }
    );
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export function dbValue(value: string) {
  return encodeURIComponent(value);
}

export async function writeAudit(entry: {
  actorUid?: string | null;
  actorEmail?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await appDataRequest('internal_audit_logs', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      actor_uid: entry.actorUid || null,
      actor_email: entry.actorEmail || null,
      action: entry.action,
      target_type: entry.targetType || null,
      target_id: entry.targetId || null,
      metadata: entry.metadata || {},
    }),
  });
}
