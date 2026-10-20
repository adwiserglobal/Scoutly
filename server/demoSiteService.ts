import { randomBytes } from 'node:crypto';
import { appDataRequest, dbValue } from './appDataService.js';
import { getSubscriptionAccess } from './subscriptionAccessService.js';
import { getUserProfile } from './userProfileService.js';
import { buildFacts, fetchImages, generateCopy, styleForCategory } from './demoSite/generate.js';
import { layoutFor, renderDemoSite } from './demoSite/render.js';
import { LAYOUT_IDS, STYLE_IDS, type DemoSiteData, type LayoutId, type StyleId } from './demoSite/types.js';

type Plan = 'free' | 'go' | 'pro' | 'agency';
const MONTHLY_LIMIT: Record<Plan, number> = { free: 1, go: 10, pro: 40, agency: 150 };
const PLAN_LABEL: Record<Plan, string> = { free: 'Free', go: 'Go', pro: 'Pro', agency: 'Agência' };

interface DemoSiteRow {
  id: string;
  slug: string;
  user_uid: string;
  business_id: string;
  business_name: string;
  style: StyleId;
  data: DemoSiteData;
  views: number;
  last_viewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DemoSiteSummary {
  slug: string;
  path: string;
  style: StyleId;
  layout: LayoutId;
  businessName: string;
  views: number;
  lastViewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  hasPhotos: boolean;
  photoNote: string | null;
}

function httpError(message: string, statusCode: number, code: string): never {
  throw Object.assign(new Error(message), { statusCode, code });
}

const normalizePlan = (value: string): Plan => (value === 'go' || value === 'pro' || value === 'agency' ? value : 'free');

function slugify(value: string) {
  const base = value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 38);
  return base || 'negocio';
}

const newSlug = (name: string) => `${slugify(name)}-${randomBytes(3).toString('hex')}`;

function summary(row: DemoSiteRow): DemoSiteSummary {
  return {
    slug: row.slug,
    path: `/demo/${row.slug}`,
    style: row.style,
    layout: layoutFor(row.data),
    businessName: row.business_name,
    views: row.views || 0,
    lastViewedAt: row.last_viewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    hasPhotos: Boolean(row.data?.images?.hero),
    photoNote: row.data?.images?.note || null,
  };
}

function migrationError(error: any) {
  if (/demo_sites|PGRST205|42P01/i.test(String(error?.message || ''))) {
    return Object.assign(
      new Error('Os sites de demonstração ainda não foram ativados neste ambiente (falta aplicar a migration 015).'),
      { statusCode: 503, code: 'DEMO_MIGRATION_PENDING' },
    );
  }
  return error;
}

async function findByBusiness(userUid: string, businessId: string) {
  try {
    const rows = await appDataRequest<DemoSiteRow[]>(
      `demo_sites?user_uid=eq.${dbValue(userUid)}&business_id=eq.${dbValue(businessId)}&select=*&limit=1`,
    );
    return rows[0] || null;
  } catch (error) {
    throw migrationError(error);
  }
}

async function monthlyCount(userUid: string) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const rows = await appDataRequest<Array<{ id: string }>>(
    `demo_sites?user_uid=eq.${dbValue(userUid)}&created_at=gte.${dbValue(start)}&select=id`,
  );
  return rows.length;
}

export async function getDemoSiteForBusiness(userUid: string, businessId: string) {
  const row = await findByBusiness(userUid, businessId);
  const access = await getSubscriptionAccess(userUid);
  const plan = normalizePlan(String(access.plan || 'free'));
  let used = 0;
  try { used = await monthlyCount(userUid); } catch { /* table missing is reported by findByBusiness */ }
  return {
    site: row ? summary(row) : null,
    quota: { plan: PLAN_LABEL[plan], limit: MONTHLY_LIMIT[plan], used },
  };
}

export async function createOrRegenerateDemoSite(userUid: string, input: any) {
  const businessId = String(input?.business?.id || '').trim();
  if (!businessId) httpError('Empresa não identificada.', 400, 'DEMO_INVALID');

  const existing = await findByBusiness(userUid, businessId);
  const access = await getSubscriptionAccess(userUid);
  const plan = normalizePlan(String(access.plan || 'free'));
  if (!existing) {
    const used = await monthlyCount(userUid);
    if (used >= MONTHLY_LIMIT[plan]) {
      httpError(
        plan === 'free'
          ? 'O plano Free inclui 1 site de demonstração por mês. Faça upgrade para criar mais.'
          : `Você atingiu o limite de ${MONTHLY_LIMIT[plan]} sites de demonstração deste mês no plano ${PLAN_LABEL[plan]}.`,
        402, 'DEMO_LIMIT_REACHED',
      );
    }
  }

  const facts = buildFacts(input.business);
  const profile = await getUserProfile(userUid, false).catch(() => null);
  const brand = {
    name: profile?.brand?.name || profile?.outreach?.companyName || profile?.outreach?.senderName || '',
    contactPhone: profile?.brand?.contactPhone || '',
    contactEmail: profile?.brand?.contactEmail || '',
    contactWebsite: profile?.brand?.contactWebsite || '',
  };

  const variation = existing ? Math.min(9, Number(input?.variation || 1)) : 0;
  const requestedStyle = (STYLE_IDS as readonly string[]).includes(input?.style) ? input.style as StyleId : null;
  const copy = await generateCopy(facts, brand, { variation, style: requestedStyle });
  // A new version also changes the page structure, not just the words.
  if (existing) {
    const current = layoutFor(existing.data);
    copy.layout = LAYOUT_IDS[(LAYOUT_IDS.indexOf(current) + 1) % LAYOUT_IDS.length];
  }
  const images = await fetchImages(copy, facts, variation);
  const data: DemoSiteData = { business: facts, copy, images, brand, generatedAt: new Date().toISOString() };

  const payload = {
    user_uid: userUid,
    business_id: businessId,
    business_name: facts.name,
    style: copy.style || styleForCategory(facts.category, facts.name),
    data,
    updated_at: new Date().toISOString(),
  };

  try {
    if (existing) {
      const rows = await appDataRequest<DemoSiteRow[]>(`demo_sites?id=eq.${dbValue(existing.id)}&select=*`, {
        method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload),
      });
      return summary(rows[0]);
    }
    const rows = await appDataRequest<DemoSiteRow[]>('demo_sites?select=*', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ ...payload, slug: newSlug(facts.name) }),
    });
    return summary(rows[0]);
  } catch (error) {
    throw migrationError(error);
  }
}

export async function changeDemoSiteStyle(userUid: string, businessId: string, change: { style?: string; layout?: string; variant?: number }) {
  const row = await findByBusiness(userUid, businessId);
  if (!row) httpError('Site não encontrado.', 404, 'DEMO_NOT_FOUND');
  const style = change.style && (STYLE_IDS as readonly string[]).includes(change.style) ? change.style as StyleId : row.style;
  const layout = change.layout && (LAYOUT_IDS as readonly string[]).includes(change.layout) ? change.layout as LayoutId : layoutFor(row.data);
  if (change.style && style !== change.style) httpError('Estilo inválido.', 400, 'DEMO_INVALID');
  const variant = change.variant === 1 ? 1 : change.variant === 0 ? 0 : row.data.copy.variant;
  const data = { ...row.data, copy: { ...row.data.copy, style, layout, variant } };
  const rows = await appDataRequest<DemoSiteRow[]>(`demo_sites?id=eq.${dbValue(row.id)}&select=*`, {
    method: 'PATCH', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ style, data, updated_at: new Date().toISOString() }),
  });
  return summary(rows[0]);
}

export async function deleteDemoSite(userUid: string, businessId: string) {
  await appDataRequest(`demo_sites?user_uid=eq.${dbValue(userUid)}&business_id=eq.${dbValue(businessId)}`, {
    method: 'DELETE', headers: { Prefer: 'return=minimal' },
  });
}

/** Public: HTML for /demo/<slug>. Returns null when unknown. */
export async function renderPublicDemoSite(slug: string, options: { countView: boolean }) {
  if (!/^[a-z0-9-]{3,80}$/.test(slug)) return null;
  let row: DemoSiteRow | undefined;
  try {
    const rows = await appDataRequest<DemoSiteRow[]>(`demo_sites?slug=eq.${dbValue(slug)}&select=*&limit=1`);
    row = rows[0];
  } catch {
    return null;
  }
  if (!row) return null;
  if (options.countView) {
    // Best effort, not atomic: the number is a hint ("o lead abriu"), not an audit trail.
    void appDataRequest(`demo_sites?id=eq.${dbValue(row.id)}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ views: (row.views || 0) + 1, last_viewed_at: new Date().toISOString() }),
    }).catch(() => undefined);
  }
  return renderDemoSite(row.data, row.style, { preview: !options.countView });
}
