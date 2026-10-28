import { appDataRequest, dbValue } from './appDataService.js';
import { getSubscriptionAccess } from './subscriptionAccessService.js';
import { assertFeatureEnabled } from './accountAdminService.js';
import { searchBusinessesInBounds } from './businessSearchService.js';

/**
 * New-company alerts. A user saves a search (segment + area); once a day the cron re-runs it and
 * emails the companies that were not in the results before. The first run only records a baseline,
 * so the first email never lists companies that already existed when the alert was created.
 * Emails carry no phone numbers or e-mails (those stay behind the credit gate in the app).
 */

const LIMITS: Record<string, number> = { free: 1, go: 3, pro: 10, agency: 10 };
const MAX_SEEN = 3000;
const MAX_AREA_DEGREES = 0.6;
const MAX_NEW_IN_EMAIL = 12;
const RECHECK_AFTER_MS = 20 * 60 * 60 * 1000;
const CRON_BUDGET_MS = 50_000;

export interface SearchAlert {
  id: string;
  query: string;
  regionName: string | null;
  enabled: boolean;
  createdAt: string;
  lastCheckedAt: string | null;
  lastNotifiedAt: string | null;
  totalFound: number;
}

interface AlertRow {
  id: string;
  user_uid: string;
  query: string;
  region_name: string | null;
  west: number; south: number; east: number; north: number;
  enabled: boolean;
  seen_ids: string[];
  baseline_done: boolean;
  last_checked_at: string | null;
  last_notified_at: string | null;
  total_found: number;
  created_at: string;
}

function httpError(message: string, statusCode: number, code: string): never {
  throw Object.assign(new Error(message), { statusCode, code });
}

function migrationError(error: any) {
  if (/search_alerts|PGRST205|42P01/i.test(String(error?.message || ''))) {
    return Object.assign(new Error('Os alertas ainda não foram ativados neste ambiente (falta aplicar a migration 022).'), { statusCode: 503, code: 'ALERTS_MIGRATION_PENDING' });
  }
  return error;
}

const toAlert = (row: AlertRow): SearchAlert => ({
  id: row.id,
  query: row.query,
  regionName: row.region_name,
  enabled: row.enabled,
  createdAt: row.created_at,
  lastCheckedAt: row.last_checked_at,
  lastNotifiedAt: row.last_notified_at,
  totalFound: row.total_found,
});

export async function listAlerts(userUid: string): Promise<{ alerts: SearchAlert[]; limit: number }> {
  const access = await getSubscriptionAccess(userUid);
  try {
    const rows = await appDataRequest<AlertRow[]>(
      `search_alerts?user_uid=eq.${dbValue(userUid)}&select=id,user_uid,query,region_name,west,south,east,north,enabled,last_checked_at,last_notified_at,total_found,created_at&order=created_at.desc&limit=50`,
    );
    return { alerts: rows.map(toAlert), limit: LIMITS[access.plan] ?? LIMITS.free };
  } catch (error) {
    throw migrationError(error);
  }
}

async function runSearch(row: Pick<AlertRow, 'query' | 'region_name' | 'west' | 'south' | 'east' | 'north'>) {
  const result = await searchBusinessesInBounds(
    row.query,
    { west: row.west, south: row.south, east: row.east, north: row.north },
    row.region_name || 'Área atual',
  );
  return Array.isArray(result?.businesses) ? result.businesses : [];
}

export async function createAlert(userUid: string, input: any): Promise<SearchAlert> {
  await assertFeatureEnabled(userUid, 'recommendations');
  const query = String(input?.query || '').trim().slice(0, 120);
  const bbox = input?.bbox || {};
  const west = Number(bbox.west), south = Number(bbox.south), east = Number(bbox.east), north = Number(bbox.north);
  if (!query) httpError('Faça uma busca antes de criar o alerta.', 400, 'ALERT_NO_QUERY');
  if (![west, south, east, north].every(Number.isFinite) || west >= east || south >= north) {
    httpError('Não foi possível identificar a área da busca.', 400, 'ALERT_NO_AREA');
  }
  // A very wide area would make every daily check slow and noisy: cap it around its center.
  const cx = (west + east) / 2, cy = (south + north) / 2;
  const halfW = Math.min((east - west) / 2, MAX_AREA_DEGREES / 2);
  const halfH = Math.min((north - south) / 2, MAX_AREA_DEGREES / 2);
  const row = {
    query,
    region_name: String(input?.regionName || '').trim().slice(0, 120) || null,
    west: cx - halfW, east: cx + halfW, south: cy - halfH, north: cy + halfH,
  };

  const { alerts, limit } = await listAlerts(userUid);
  if (alerts.some((alert) => alert.query.toLowerCase() === query.toLowerCase() && alert.regionName === row.region_name)) {
    httpError('Você já tem um alerta para esta busca.', 409, 'ALERT_DUPLICATE');
  }
  if (alerts.length >= limit) {
    httpError(`Seu plano permite ${limit} ${limit === 1 ? 'alerta' : 'alertas'}. Remova um ou faça upgrade para criar mais.`, 402, 'ALERT_LIMIT');
  }

  // Baseline now, so the first email only lists companies that appear after the alert exists.
  let seen: string[] = [];
  let baselineDone = false;
  try {
    seen = (await runSearch(row)).map((business) => String(business.id)).slice(0, MAX_SEEN);
    baselineDone = true;
  } catch (error: any) {
    console.warn('[Alerts] baseline failed, the first cron run will set it:', error?.message || error);
  }

  try {
    const created = await appDataRequest<AlertRow[]>('search_alerts', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        user_uid: userUid, ...row, seen_ids: seen, baseline_done: baselineDone,
        last_checked_at: baselineDone ? new Date().toISOString() : null, total_found: seen.length,
      }),
    });
    return toAlert(created[0]);
  } catch (error) {
    throw migrationError(error);
  }
}

export async function updateAlert(userUid: string, id: string, patch: { enabled?: boolean }) {
  try {
    await appDataRequest(`search_alerts?id=eq.${dbValue(id)}&user_uid=eq.${dbValue(userUid)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ enabled: patch.enabled !== false }),
    });
  } catch (error) {
    throw migrationError(error);
  }
  return listAlerts(userUid);
}

export async function deleteAlert(userUid: string, id: string) {
  try {
    await appDataRequest(`search_alerts?id=eq.${dbValue(id)}&user_uid=eq.${dbValue(userUid)}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    });
  } catch (error) {
    throw migrationError(error);
  }
  return listAlerts(userUid);
}

// ---------------------------------------------------------------------------
// Daily run + email
// ---------------------------------------------------------------------------

interface FoundCompany { name: string; category: string; address: string; website: boolean; monthsOpen: number | null }

const esc = (value: string) => value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char] as string));

function monthsOpen(start?: string | null) {
  if (!start) return null;
  const date = new Date(start);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  return Math.max(0, (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth()));
}

function appUrl() {
  return String(process.env.APP_URL || 'https://scoutly.pro').replace(/\/$/, '');
}

async function sendAlertEmail(to: string, groups: Array<{ query: string; region: string | null; companies: FoundCompany[]; total: number }>) {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) {
    console.warn('[Alerts] RESEND_API_KEY não configurada; e-mail de alerta não enviado.');
    return false;
  }
  const from = String(process.env.RESEND_FROM_EMAIL || 'Scoutly <equipe@scoutly.pro>').trim();
  const total = groups.reduce((sum, group) => sum + group.total, 0);
  const sections = groups.map((group) => `
<h3 style="margin:26px 0 4px;font-size:16px;color:#14161a">${esc(group.query)}${group.region ? ` <span style="font-weight:500;color:#8a909c">· ${esc(group.region)}</span>` : ''}</h3>
<p style="margin:0 0 10px;font-size:12px;color:#8a909c">${group.total} ${group.total === 1 ? 'empresa nova' : 'empresas novas'}</p>
${group.companies.map((company) => `<div style="padding:12px 14px;margin:0 0 8px;border:1px solid #eceef2;border-radius:12px">
<div style="font-weight:700;font-size:14px;color:#14161a">${esc(company.name)}</div>
<div style="margin-top:2px;font-size:12px;color:#ff5a12;font-weight:600">${esc(company.category)}</div>
<div style="margin-top:4px;font-size:12px;color:#6b7280">${esc(company.address)}</div>
<div style="margin-top:6px;font-size:11px">${company.monthsOpen !== null && company.monthsOpen <= 6 ? '<span style="background:#f1ebff;color:#6d3fd1;padding:2px 8px;border-radius:99px;margin-right:4px">Aberta recentemente</span>' : ''}${company.website ? '' : '<span style="background:#e6f2ff;color:#1768b8;padding:2px 8px;border-radius:99px">Sem site</span>'}</div>
</div>`).join('')}
${group.total > group.companies.length ? `<p style="font-size:12px;color:#6b7280;margin:4px 0 0">+ ${group.total - group.companies.length} no Scoutly.</p>` : ''}`).join('');
  const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:28px;color:#14161a">
<h2 style="margin:0 0 6px;font-size:22px">${total} ${total === 1 ? 'empresa nova' : 'empresas novas'} nas suas buscas</h2>
<p style="margin:0;line-height:1.6;color:#4b5260;font-size:14px">Apareceram desde o último aviso. Contatos e detalhes completos estão no Scoutly.</p>
${sections}
<a href="${appUrl()}/dashboard" style="display:inline-block;margin-top:20px;background:#ff5a12;color:#fff;text-decoration:none;font-weight:700;padding:13px 24px;border-radius:12px">Ver no Scoutly</a>
<p style="margin:24px 0 0;font-size:12px;color:#8a909c">Você recebe este e-mail porque ativou alertas no Scoutly. Para pausar ou remover, abra a busca no app e clique no sino.</p></div>`;
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject: `${total} ${total === 1 ? 'empresa nova' : 'empresas novas'} para prospectar`, html }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) console.warn('[Alerts] Resend rejected the email:', response.status);
    return response.ok;
  } catch (error: any) {
    console.warn('[Alerts] email failed:', error?.message || error);
    return false;
  }
}

/** Run by the daily cron. Returns a small summary for the logs. */
export async function runAlertsCron() {
  const started = Date.now();
  const cutoff = new Date(Date.now() - RECHECK_AFTER_MS).toISOString();
  let due: AlertRow[];
  try {
    due = await appDataRequest<AlertRow[]>(
      `search_alerts?enabled=eq.true&or=(last_checked_at.is.null,last_checked_at.lt.${dbValue(cutoff)})&select=*&order=last_checked_at.asc.nullsfirst&limit=60`,
    );
  } catch (error) {
    throw migrationError(error);
  }

  const byUser = new Map<string, Array<{ query: string; region: string | null; companies: FoundCompany[]; total: number; alertId: string }>>();
  let checked = 0;
  const queue = [...due];

  const worker = async () => {
    while (queue.length && Date.now() - started < CRON_BUDGET_MS) {
      const row = queue.shift()!;
      try {
        const businesses = await runSearch(row);
        const seen = new Set(row.seen_ids || []);
        const fresh = businesses.filter((business) => !seen.has(String(business.id)));
        const merged = [...fresh.map((business) => String(business.id)), ...(row.seen_ids || [])].slice(0, MAX_SEEN);
        const patch: Record<string, unknown> = {
          seen_ids: merged, baseline_done: true, last_checked_at: new Date().toISOString(), total_found: merged.length,
        };
        if (row.baseline_done && fresh.length) {
          const ranked = fresh
            .map((business: any) => ({ business, months: monthsOpen(business.dataInicioAtividade) }))
            .sort((a, b) => (a.months ?? 999) - (b.months ?? 999));
          const list = byUser.get(row.user_uid) || [];
          list.push({
            query: row.query, region: row.region_name, alertId: row.id, total: fresh.length,
            companies: ranked.slice(0, MAX_NEW_IN_EMAIL).map(({ business, months }: any) => ({
              name: String(business.name || '').slice(0, 120),
              category: String(business.category || 'Empresa').slice(0, 80),
              address: String(business.address || '').slice(0, 160),
              website: Boolean(business.website),
              monthsOpen: months,
            })),
          });
          byUser.set(row.user_uid, list);
        }
        await appDataRequest(`search_alerts?id=eq.${dbValue(row.id)}`, {
          method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch),
        });
        checked += 1;
      } catch (error: any) {
        console.warn('[Alerts] check failed for', row.id, error?.message || error);
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]);

  let emailed = 0;
  for (const [userUid, groups] of byUser) {
    try {
      const users = await appDataRequest<Array<{ email?: string | null }>>(`app_users?firebase_uid=eq.${dbValue(userUid)}&select=email&limit=1`);
      const email = String(users[0]?.email || '').trim();
      if (!email) continue;
      if (await sendAlertEmail(email, groups)) {
        emailed += 1;
        const now = new Date().toISOString();
        await Promise.all(groups.map((group) => appDataRequest(`search_alerts?id=eq.${dbValue(group.alertId)}`, {
          method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ last_notified_at: now }),
        }).catch(() => undefined)));
      }
    } catch (error: any) {
      console.warn('[Alerts] notify failed for', userUid, error?.message || error);
    }
  }

  return { due: due.length, checked, emailed };
}
