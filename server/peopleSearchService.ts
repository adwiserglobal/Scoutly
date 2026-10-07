type SearchCandidate = {
  token: string;
  name?: string;
  title?: string;
  company?: string;
  location?: string;
  linkedinUrl?: string;
  raw?: any;
};

export type PeopleSearchReveal = {
  name: string | null;
  title: string | null;
  company: string | null;
  location: string | null;
  linkedinUrl: string | null;
  email: string | null;
  emailStatus: string | null;
  emailConfidence: string | number | null;
  source: 'peoplesearch';
};

function apiKey() {
  return String(process.env.PEOPLESEARCH_API_KEY || '').trim();
}

export function hasPeopleSearchAccess() {
  return Boolean(apiKey());
}

function clean(value: unknown, max = 260) {
  return String(value || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
}

function firstArray(data: any): any[] {
  for (const candidate of [data?.results, data?.people, data?.matches, data?.data, data?.items]) {
    if (Array.isArray(candidate)) return candidate;
    if (candidate && Array.isArray(candidate.results)) return candidate.results;
    if (candidate && Array.isArray(candidate.people)) return candidate.people;
    if (candidate && Array.isArray(candidate.items)) return candidate.items;
  }
  return [];
}

function readToken(value: any): string {
  return clean(value?.token || value?.revealToken || value?.reveal_token || value?.id, 600);
}

function readLinkedIn(value: any): string | null {
  const candidate =
    value?.linkedinUrl ||
    value?.linkedin_url ||
    value?.linkedin ||
    value?.profileUrl ||
    value?.profile_url ||
    value?.socials?.linkedin ||
    null;
  const text = clean(candidate, 500);
  return /linkedin\.com\/in\//i.test(text) ? text : null;
}

function normalizeCandidate(value: any): SearchCandidate | null {
  const token = readToken(value);
  if (!token) return null;
  return {
    token,
    name: clean(value?.name || value?.fullName || value?.full_name, 160) || undefined,
    title: clean(value?.title || value?.headline || value?.currentTitle || value?.current_title, 180) || undefined,
    company: clean(value?.company || value?.companyName || value?.company_name || value?.currentCompany, 180) || undefined,
    location: clean(value?.location || value?.city || value?.country, 180) || undefined,
    linkedinUrl: readLinkedIn(value) || undefined,
    raw: value,
  };
}

function revealPayload(data: any): any {
  return data?.profile || data?.person || data?.result || data?.data || data;
}

function normalizeReveal(data: any): PeopleSearchReveal {
  const value = revealPayload(data);
  return {
    name: clean(value?.name || value?.fullName || value?.full_name, 180) || null,
    title: clean(value?.title || value?.headline || value?.currentTitle || value?.current_title, 220) || null,
    company: clean(value?.company || value?.companyName || value?.company_name || value?.currentCompany, 180) || null,
    location: clean(value?.location || value?.city || value?.country, 180) || null,
    linkedinUrl: readLinkedIn(value),
    email: clean(value?.email || value?.workEmail || value?.work_email, 260).toLowerCase() || null,
    emailStatus: clean(value?.emailStatus || value?.email_status || data?.emailStatus || data?.email_status, 80) || null,
    emailConfidence:
      value?.emailConfidence ??
      value?.email_confidence ??
      data?.emailConfidence ??
      data?.email_confidence ??
      null,
    source: 'peoplesearch',
  };
}

async function post(path: string, body: Record<string, unknown>) {
  const key = apiKey();
  if (!key) throw Object.assign(new Error('PeopleSearch não configurado.'), { code: 'PEOPLESEARCH_NOT_CONFIGURED' });

  const response = await fetch(`https://peoplesearch.im/api/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(9000),
  });

  const raw = await response.text();
  let data: any = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = {};
  }

  if (response.status === 402) {
    throw Object.assign(new Error('Créditos do PeopleSearch esgotados.'), { code: 'PEOPLESEARCH_NO_CREDITS', statusCode: 402 });
  }
  if (!response.ok) {
    throw Object.assign(
      new Error(clean(data?.error || data?.message || `PeopleSearch HTTP ${response.status}`, 260)),
      { code: 'PEOPLESEARCH_ERROR', statusCode: response.status },
    );
  }
  return data;
}

export async function searchDecisionMakers(
  companyName: string,
  location?: string | null,
  domain?: string | null,
  limit = 5,
): Promise<SearchCandidate[]> {
  const query = [
    'Founder owner CEO managing director decision maker at',
    companyName,
    domain ? `company domain ${domain}` : '',
    location || '',
  ].filter(Boolean).join(' ');

  const data = await post('/search', {
    query: query.slice(0, 420),
    limit: Math.max(1, Math.min(8, Math.trunc(limit || 5))),
  });

  return firstArray(data)
    .map(normalizeCandidate)
    .filter((candidate): candidate is SearchCandidate => Boolean(candidate))
    .slice(0, limit);
}

export async function revealDecisionMaker(
  token: string,
  withEmail = false,
): Promise<PeopleSearchReveal> {
  let data = await post('/reveal', { token, withEmail });
  let normalized = normalizeReveal(data);

  // PeopleSearch documents emailStatus=searching as a free, idempotent re-poll.
  if (withEmail && normalized.emailStatus?.toLowerCase() === 'searching') {
    for (let attempt = 0; attempt < 2 && !normalized.email; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 700 + attempt * 650));
      data = await post('/reveal', { token, withEmail: true });
      normalized = normalizeReveal(data);
      if (normalized.emailStatus?.toLowerCase() !== 'searching') break;
    }
  }

  return normalized;
}
