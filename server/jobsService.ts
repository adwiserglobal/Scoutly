import * as cheerio from 'cheerio';
import { safeFetch, walkJsonLd } from './enrichService.js';

/**
 * "Contratando": hiring signals for a business.
 *
 *  1. The company's own website: schema.org JobPosting data, a careers page and links to public
 *     applicant-tracking boards (Greenhouse, Lever, Ashby, Workable, Recruitee) whose official public
 *     APIs list the open positions.
 *  2. Optionally the Jooble aggregator (JOOBLE_API_KEY), matched to the company by name.
 *
 * Statuses are honest: 'hiring' only when real postings were found; 'careers' when the company has a
 * careers page but no postings could be read; 'none' otherwise.
 */

export interface JobPostingItem {
  title: string;
  location: string | null;
  url: string | null;
  postedAt: string | null;
  department: string | null;
  source: string;
}

export interface JobsResult {
  status: 'hiring' | 'careers' | 'none' | 'unreachable';
  careersUrl: string | null;
  jobs: JobPostingItem[];
  sources: string[];
  checkedAt: string;
}

const MAX_JOBS = 25;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; data: JobsResult }>();

const CAREER_TEXT = /\b(trabalhe\s+(?:conosco|com\s+a?\s*gente|na)|carreiras?|vagas?(?:\s+abertas?)?|oportunidades?|careers?|jobs?|join\s+(?:us|our\s+team)|work\s+with\s+us|we(?:'|’)?re\s+hiring|hiring|recrutamento|talentos?)\b/i;
const CAREER_PATH = /(trabalhe|carreira|vagas?|careers?|jobs?|join-us|work-with-us|hiring|recrutamento|talentos?|oportunidades)/i;
const DEFAULT_CAREER_PATHS = ['/trabalhe-conosco', '/carreiras', '/vagas', '/careers', '/jobs'];

const clean = (value: unknown, max = 200) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

function normalizeName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(ltda|me|epp|eireli|s\/?a|sa|inc|llc|ltd|corp|co|company|cia|comercio|servicos|e)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function sameCompany(a: string, b: string) {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (!x || !y) return false;
  if (x === y || x.includes(y) || y.includes(x)) return Math.min(x.length, y.length) >= 4;
  const xs = new Set(x.split(' ').filter((token) => token.length > 2));
  const ys = y.split(' ').filter((token) => token.length > 2);
  if (!xs.size || !ys.length) return false;
  const shared = ys.filter((token) => xs.has(token)).length;
  return shared / Math.max(xs.size, ys.length) >= 0.7;
}

function dedupe(jobs: JobPostingItem[]) {
  const seen = new Set<string>();
  return jobs.filter((job) => {
    const key = `${job.title.toLowerCase()}|${job.url || job.location || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// --- website signals --------------------------------------------------------

function jobsFromJsonLd($: cheerio.CheerioAPI, pageUrl: string): JobPostingItem[] {
  const jobs: JobPostingItem[] = [];
  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      const data = JSON.parse($(element).contents().text() || 'null');
      walkJsonLd(data, (item: any) => {
        const type = Array.isArray(item?.['@type']) ? item['@type'] : [item?.['@type']];
        if (!type.includes('JobPosting') || !item.title) return;
        const place = Array.isArray(item.jobLocation) ? item.jobLocation[0] : item.jobLocation;
        const address = place?.address || {};
        const location = [address.addressLocality, address.addressRegion, address.addressCountry?.name || address.addressCountry]
          .filter((part: unknown) => typeof part === 'string' && part)
          .join(', ');
        jobs.push({
          title: clean(item.title),
          location: location || (item.jobLocationType === 'TELECOMMUTE' ? 'Remoto' : null),
          url: clean(item.url || item.sameAs || pageUrl, 500) || pageUrl,
          postedAt: item.datePosted ? clean(item.datePosted, 40) : null,
          department: null,
          source: 'site',
        });
      });
    } catch {
      /* malformed JSON-LD */
    }
  });
  return jobs;
}

interface BoardRef {
  kind: 'greenhouse' | 'lever' | 'ashby' | 'workable' | 'recruitee';
  slug: string;
  url: string;
}

function boardFromUrl(href: string): BoardRef | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const first = url.pathname.split('/').filter(Boolean)[0] || '';
  if ((host === 'boards.greenhouse.io' || host === 'job-boards.greenhouse.io') && first) return { kind: 'greenhouse', slug: first, url: href };
  if (host === 'jobs.lever.co' && first) return { kind: 'lever', slug: first, url: href };
  if (host === 'jobs.ashbyhq.com' && first) return { kind: 'ashby', slug: first, url: href };
  if (host === 'apply.workable.com' && first) return { kind: 'workable', slug: first, url: href };
  const recruitee = host.match(/^([a-z0-9-]+)\.recruitee\.com$/);
  if (recruitee && recruitee[1] !== 'www') return { kind: 'recruitee', slug: recruitee[1], url: href };
  return null;
}

async function getJson(url: string, init: RequestInit = {}): Promise<any> {
  const response = await fetch(url, {
    ...init,
    headers: { Accept: 'application/json', 'User-Agent': 'ScoutlyJobs/1.0', ...(init.headers || {}) },
    signal: AbortSignal.timeout(3500),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function jobsFromBoard(board: BoardRef): Promise<JobPostingItem[]> {
  const slug = encodeURIComponent(board.slug);
  const item = (title: unknown, location: unknown, url: unknown, postedAt: unknown, department: unknown): JobPostingItem => ({
    title: clean(title),
    location: clean(location, 120) || null,
    url: clean(url, 500) || board.url,
    postedAt: postedAt ? clean(postedAt, 40) : null,
    department: clean(department, 80) || null,
    source: board.kind,
  });

  if (board.kind === 'greenhouse') {
    const data = await getJson(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`);
    return (data?.jobs || []).map((job: any) => item(job.title, job.location?.name, job.absolute_url, job.updated_at, null));
  }
  if (board.kind === 'lever') {
    const data = await getJson(`https://api.lever.co/v0/postings/${slug}?mode=json`);
    return (Array.isArray(data) ? data : []).map((job: any) =>
      item(job.text, job.categories?.location, job.hostedUrl, job.createdAt ? new Date(job.createdAt).toISOString() : null, job.categories?.team));
  }
  if (board.kind === 'ashby') {
    const data = await getJson(`https://api.ashbyhq.com/posting-api/job-board/${slug}`);
    return (data?.jobs || []).map((job: any) => item(job.title, job.location, job.jobUrl, job.publishedAt, job.department));
  }
  if (board.kind === 'workable') {
    const data = await getJson(`https://apply.workable.com/api/v1/widget/accounts/${slug}`);
    return (data?.jobs || []).map((job: any) =>
      item(job.title, [job.city, job.state, job.country].filter(Boolean).join(', '), job.url || job.shortlink, job.published_on, job.department));
  }
  const data = await getJson(`https://${slug}.recruitee.com/api/offers/`);
  return (data?.offers || []).map((job: any) => item(job.title, job.location, job.careers_url, job.created_at, job.department));
}

async function readWebsite(website: string) {
  const jobs: JobPostingItem[] = [];
  let careersUrl: string | null = null;
  const boards = new Map<string, BoardRef>();
  let reachable = false;

  const scan = ($: cheerio.CheerioAPI, pageUrl: string, host: string) => {
    jobs.push(...jobsFromJsonLd($, pageUrl));
    $('a[href]').each((_, element) => {
      const href = $(element).attr('href')?.trim();
      if (!href || href.startsWith('#') || /^(mailto|tel|javascript):/i.test(href)) return;
      let target: URL;
      try {
        target = new URL(href, pageUrl);
      } catch {
        return;
      }
      const board = boardFromUrl(target.toString());
      if (board) {
        boards.set(`${board.kind}:${board.slug}`, board);
        careersUrl = careersUrl || board.url;
        return;
      }
      const text = $(element).text().replace(/\s+/g, ' ').trim();
      const sameHost = target.hostname.replace(/^www\./, '') === host;
      const careerHost = /(^|\.)gupy\.io$|(^|\.)vagas\.com\.br$|(^|\.)solides\.jobs$|(^|\.)kenoby\.com$|(^|\.)inhire\.app$/i.test(target.hostname);
      if (!careersUrl && ((sameHost && (CAREER_PATH.test(target.pathname) || (text.length < 40 && CAREER_TEXT.test(text)))) || careerHost)) {
        careersUrl = target.toString();
      }
    });
  };

  let home;
  try {
    home = await safeFetch(/^https?:\/\//i.test(website) ? website : `https://${website}`, 0, 4500);
  } catch {
    return { jobs, careersUrl, boards, reachable };
  }
  reachable = true;
  const host = new URL(home.finalUrl).hostname.replace(/^www\./, '');
  scan(cheerio.load(home.content), home.finalUrl, host);

  // The careers page itself usually holds the structured postings or the ATS link.
  const candidates = new Set<string>();
  if (careersUrl && !boardFromUrl(careersUrl)) candidates.add(careersUrl);
  if (!careersUrl && jobs.length === 0) {
    for (const path of DEFAULT_CAREER_PATHS.slice(0, 3)) candidates.add(new URL(path, home.finalUrl).toString());
  }
  for (const candidate of Array.from(candidates).slice(0, 2)) {
    try {
      const page = await safeFetch(candidate, 0, 3000);
      const $ = cheerio.load(page.content);
      const before = jobs.length;
      const hadCareers = Boolean(careersUrl);
      scan($, page.finalUrl, host);
      // A default path that answers with a real page counts as a careers page only if it reads like one.
      if (!hadCareers && !careersUrl && (jobs.length > before || CAREER_TEXT.test($('title').text() + ' ' + $('h1').first().text()))) {
        careersUrl = page.finalUrl;
      }
    } catch {
      /* page missing or blocked */
    }
  }
  return { jobs, careersUrl, boards, reachable };
}

// --- Jooble -----------------------------------------------------------------

async function jobsFromJooble(name: string, location: string): Promise<JobPostingItem[]> {
  const key = String(process.env.JOOBLE_API_KEY || '').trim();
  if (!key || !name) return [];
  try {
    const response = await fetch(`https://jooble.org/api/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: name, location: location || '', page: '1', companysearch: 'true' }),
      signal: AbortSignal.timeout(4500),
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (Array.isArray(data?.jobs) ? data.jobs : [])
      .filter((job: any) => sameCompany(String(job?.company || ''), name))
      .map((job: any): JobPostingItem => ({
        title: clean(job.title),
        location: clean(job.location, 120) || null,
        url: clean(job.link, 600) || null,
        postedAt: job.updated ? clean(job.updated, 40) : null,
        department: null,
        source: 'jooble',
      }))
      .filter((job: JobPostingItem) => job.title);
  } catch (error: any) {
    console.warn('[Jobs] Jooble lookup failed:', error?.message || error);
    return [];
  }
}

// --- public API ---------------------------------------------------------------

export function hasJoobleKey() {
  return Boolean(String(process.env.JOOBLE_API_KEY || '').trim());
}

export async function findJobsForBusiness(input: {
  name: string;
  website?: string | null;
  location?: string | null;
  /** Also ask the Jooble aggregator (uses the daily quota). */
  aggregator?: boolean;
}): Promise<JobsResult> {
  const name = clean(input.name, 160);
  const website = clean(input.website, 400);
  const location = clean(input.location, 120);
  const useAggregator = Boolean(input.aggregator) && hasJoobleKey();
  const cacheKey = `${website.toLowerCase()}|${name.toLowerCase()}|${useAggregator ? 'agg' : 'site'}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  const sources = new Set<string>();
  let jobs: JobPostingItem[] = [];
  let careersUrl: string | null = null;
  let reachable = false;

  if (website) {
    const site = await readWebsite(website);
    reachable = site.reachable;
    careersUrl = site.careersUrl;
    if (site.jobs.length) {
      jobs.push(...site.jobs);
      sources.add('site');
    }
    const boardResults = await Promise.allSettled(Array.from(site.boards.values()).slice(0, 2).map(jobsFromBoard));
    boardResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.length) {
        jobs.push(...result.value);
        sources.add(Array.from(site.boards.values())[index].kind);
      }
    });
  }

  if (useAggregator) {
    const extra = await jobsFromJooble(name, location);
    if (extra.length) {
      jobs.push(...extra);
      sources.add('jooble');
    }
  }

  jobs = dedupe(jobs).slice(0, MAX_JOBS);
  const status: JobsResult['status'] = jobs.length
    ? 'hiring'
    : careersUrl
      ? 'careers'
      : website && !reachable
        ? 'unreachable'
        : 'none';

  const data: JobsResult = { status, careersUrl, jobs, sources: Array.from(sources), checkedAt: new Date().toISOString() };
  cache.set(cacheKey, { at: Date.now(), data });
  if (cache.size > 800) cache.delete(cache.keys().next().value as string);
  return data;
}
