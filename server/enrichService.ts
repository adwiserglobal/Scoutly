import * as cheerio from 'cheerio';
import dns from 'dns/promises';

interface InfoItem {
  value: string;
  source: 'official_website';
  sourceUrl: string;
  verifiedAt: string;
  verification: 'verified_current_website' | 'candidate_current_website';
  evidence?: 'explicit_whatsapp_link' | 'structured_whatsapp' | 'whatsapp_label_near_number' | 'official_site_phone';
  confidence?: number;
}

interface TeamMember {
  name: string;
  role: string | null;
  sourceUrl: string;
}

export interface EnrichmentResult {
  siteStatus: 'verified' | 'unreachable' | 'unknown';
  finalUrl?: string;
  hasHttps?: boolean;
  title?: string;
  metaDescription?: string;
  whatsapp: InfoItem[];
  whatsappCandidates: InfoItem[];
  emails: InfoItem[];
  phones: InfoItem[];
  socials: {
    instagram?: InfoItem;
    facebook?: InfoItem;
    tiktok?: InfoItem;
    youtube?: InfoItem;
    linkedin?: InfoItem;
  };
  cnpj: InfoItem[];
  team: TeamMember[];
  openingHours?: string | null;
  contactFreshness: {
    checkedAt: string;
    websiteReachable: boolean;
    verifiedWhatsappCount: number;
    verifiedPhoneCount: number;
    verifiedEmailCount: number;
  };
  updatedAt: string;
}

const CACHE_TTL_MS = 30 * 60 * 1000;
const enrichmentCache = new Map<
  string,
  { expiresAt: number; data: EnrichmentResult }
>();

const dnsCache = new Map<string, { ips: string[]; expiresAt: number }>();

function normalizePhone(value: string): string {
  return value.replace(/\D/g, '');
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isPrivateIP(ip: string): boolean {
  const normalized = ip.toLowerCase();

  if (normalized === '::1') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  if (
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  ) return true;

  const parts = ip.split('.').map((part) => Number(part));
  if (parts.length === 4 && parts.every(Number.isFinite)) {
    const [a, b] = parts;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }

  return false;
}

async function resolveHostSafe(host: string): Promise<string[]> {
  const now = Date.now();
  const cached = dnsCache.get(host);
  if (cached && cached.expiresAt > now) return cached.ips;

  const records = await Promise.race([
    dns.lookup(host, { all: true }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DNS resolution timeout')), 1500)
    ),
  ]);

  const ips = records.map((record) => record.address);
  if (!ips.length || ips.some(isPrivateIP)) {
    throw new Error('Private or invalid host');
  }

  dnsCache.set(host, { ips, expiresAt: now + 10 * 60 * 1000 });
  return ips;
}

async function safeFetch(
  urlStr: string,
  redirects = 0,
  timeoutMs = 4500,
): Promise<{ content: string; finalUrl: string }> {
  if (redirects > 3) throw new Error('Too many redirects');

  const parsed = new URL(urlStr);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Protocol not allowed');
  }

  if (parsed.hostname === 'localhost' || parsed.hostname.endsWith('.localhost')) {
    throw new Error('Localhost not allowed');
  }

  await resolveHostSafe(parsed.hostname);

  const res = await fetch(parsed.toString(), {
    method: 'GET',
    redirect: 'manual',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36 ScoutlyEnrichment/1.1',
      Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if ([301, 302, 303, 307, 308].includes(res.status)) {
    const location = res.headers.get('location');
    if (!location) throw new Error('Redirect without location header');
    return safeFetch(new URL(location, parsed).toString(), redirects + 1, timeoutMs);
  }

  if (!res.ok) throw new Error(`HTTP Error ${res.status}`);

  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  if (
    !contentType.includes('text/html') &&
    !contentType.includes('application/xhtml+xml') &&
    !contentType.includes('text/plain') &&
    !contentType.includes('application/xml') &&
    !contentType.includes('text/xml')
  ) {
    throw new Error('Not HTML content');
  }

  const text = await res.text();
  return {
    content: text.length > 2 * 1024 * 1024 ? text.slice(0, 2 * 1024 * 1024) : text,
    finalUrl: parsed.toString(),
  };
}

function makeInfo(
  value: string,
  sourceUrl: string,
  verifiedAt: string,
  options: {
    verification?: InfoItem['verification'];
    evidence?: InfoItem['evidence'];
    confidence?: number;
  } = {},
): InfoItem {
  return {
    value,
    source: 'official_website',
    sourceUrl,
    verifiedAt,
    verification: options.verification || 'verified_current_website',
    evidence: options.evidence,
    confidence: options.confidence,
  };
}

function addPhone(result: EnrichmentResult, value: string, sourceUrl: string, verifiedAt: string) {
  const digits = normalizePhone(value);
  if (digits.length < 8 || digits.length > 15) return;

  if (!result.phones.some((item) => normalizePhone(item.value) === digits)) {
    result.phones.push(makeInfo(value.trim(), sourceUrl, verifiedAt));
  }
}

function addWhatsApp(
  result: EnrichmentResult,
  value: string,
  sourceUrl: string,
  verifiedAt: string,
  evidence: InfoItem['evidence'] = 'explicit_whatsapp_link',
  confidence = 0.98,
) {
  const digits = normalizePhone(value);
  if (digits.length < 10 || digits.length > 15) return;

  if (!result.whatsapp.some((item) => normalizePhone(item.value) === digits)) {
    result.whatsapp.push(makeInfo(digits, sourceUrl, verifiedAt, {
      evidence,
      confidence,
      verification: 'verified_current_website',
    }));
  }

  addPhone(result, digits, sourceUrl, verifiedAt);
}

function addWhatsAppCandidate(
  result: EnrichmentResult,
  value: string,
  sourceUrl: string,
  verifiedAt: string,
) {
  const digits = normalizePhone(value);
  if (digits.length < 10 || digits.length > 15) return;
  if (result.whatsapp.some((item) => normalizePhone(item.value) === digits)) return;
  if (!result.whatsappCandidates.some((item) => normalizePhone(item.value) === digits)) {
    result.whatsappCandidates.push(makeInfo(digits, sourceUrl, verifiedAt, {
      evidence: 'whatsapp_label_near_number',
      confidence: 0.72,
      verification: 'candidate_current_website',
    }));
  }
}

function extractWhatsappSignalsFromString(
  rawValue: string,
  sourceUrl: string,
  result: EnrichmentResult,
  verifiedAt: string,
) {
  if (!rawValue) return;

  let value = rawValue
    .replace(/\\u0026/gi, '&')
    .replace(/\\u003d/gi, '=')
    .replace(/\\\//g, '/')
    .replace(/&amp;/gi, '&')
    .replace(/%2f/gi, '/')
    .replace(/%3a/gi, ':')
    .replace(/%3f/gi, '?')
    .replace(/%3d/gi, '=')
    .replace(/%26/gi, '&');

  try {
    value = decodeURIComponent(value);
  } catch {
    // Keep the partially decoded value.
  }

  const urlPatterns = [
    /(?:https?:\/\/)?wa\.me\/([0-9+().\s-]{8,20})/gi,
    /(?:https?:\/\/)?(?:api\.)?whatsapp\.com\/(?:send|message)[^"'<>\s]*?[?&](?:phone|to)=([0-9+().\s-]{8,20})/gi,
    /whatsapp:\/\/send[^"'<>\s]*?[?&](?:phone|to)=([0-9+().\s-]{8,20})/gi,
  ];

  for (const pattern of urlPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(value)) !== null) {
      if (match[1]) addWhatsApp(result, match[1], sourceUrl, verifiedAt);
    }
  }

  // Many business sites render the number as text beside "WhatsApp" instead of
  // putting the phone directly in the href. Treat this only as website evidence
  // when the keyword and the number occur close together.
  const contextualRegex =
    /(?:whats\s*app|whatsapp|zap|fale\s+(?:conosco\s+)?(?:pelo|no)\s+whatsapp|chame\s+(?:no|pelo)\s+whatsapp)[^0-9+]{0,80}(\+?\d[\d().\s-]{8,20})/gi;
  let contextualMatch: RegExpExecArray | null;
  while ((contextualMatch = contextualRegex.exec(value)) !== null) {
    if (contextualMatch[1]) addWhatsAppCandidate(result, contextualMatch[1], sourceUrl, verifiedAt);
  }
}

function addEmail(result: EnrichmentResult, value: string, sourceUrl: string, verifiedAt: string) {
  const email = normalizeEmail(value);
  if (!email || !email.includes('@')) return;

  const isAsset = /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(email);
  const isDummy = /example|domain|sentry|bootstrap|wixpress|cloudflare/i.test(email);
  if (isAsset || isDummy) return;

  if (!result.emails.some((item) => normalizeEmail(item.value) === email)) {
    result.emails.push(makeInfo(email, sourceUrl, verifiedAt));
  }
}

function walkJsonLd(value: any, visitor: (item: any) => void) {
  if (!value) return;

  if (Array.isArray(value)) {
    for (const item of value) walkJsonLd(item, visitor);
    return;
  }

  if (typeof value !== 'object') return;

  visitor(value);

  for (const nested of Object.values(value)) {
    if (nested && typeof nested === 'object') {
      walkJsonLd(nested, visitor);
    }
  }
}

function extractDataFromPage(
  $: cheerio.CheerioAPI,
  sourceUrl: string,
  result: EnrichmentResult,
  verifiedAt: string,
) {
  const html = $.html();
  const text = $('body').text();

  extractWhatsappSignalsFromString(html, sourceUrl, result, verifiedAt);
  extractWhatsappSignalsFromString(text, sourceUrl, result, verifiedAt);

  // Explicit WhatsApp links are treated as high-confidence current evidence.
  $('a[href]').each((_, element) => {
    const href = ($(element).attr('href') || '').trim();
    if (!href) return;

    const waMatch = href.match(
      /(?:wa\.me\/|api\.whatsapp\.com\/send\?[^#]*?phone=|whatsapp\.com\/send\?[^#]*?phone=|whatsapp:\/\/send\?[^#]*?phone=)(\+?[0-9][0-9().\s-]{8,})/i,
    );
    if (waMatch?.[1]) {
      addWhatsApp(result, waMatch[1], sourceUrl, verifiedAt);
    }

    const elementText = $(element).text();
    const extraAttributes = [
      $(element).attr('onclick'),
      $(element).attr('data-href'),
      $(element).attr('data-url'),
      $(element).attr('data-link'),
      $(element).attr('data-phone'),
      $(element).attr('data-whatsapp'),
      $(element).attr('aria-label'),
      $(element).attr('title'),
      elementText,
    ].filter(Boolean).join(' ');
    extractWhatsappSignalsFromString(extraAttributes, sourceUrl, result, verifiedAt);
  });

  $('[onclick], [data-href], [data-url], [data-link], [data-phone], [data-whatsapp]').each((_, element) => {
    const values = [
      $(element).attr('onclick'),
      $(element).attr('data-href'),
      $(element).attr('data-url'),
      $(element).attr('data-link'),
      $(element).attr('data-phone'),
      $(element).attr('data-whatsapp'),
      $(element).text(),
    ].filter(Boolean).join(' ');
    extractWhatsappSignalsFromString(values, sourceUrl, result, verifiedAt);
  });

  // Fallback for raw WhatsApp URLs embedded in scripts/markup.
  const rawWaRegex =
    /(?:wa\.me\/|api\.whatsapp\.com\/send\?[^"'<>\s]*?phone=|whatsapp\.com\/send\?[^"'<>\s]*?phone=)([0-9]{10,15})/gi;
  let match: RegExpExecArray | null;
  while ((match = rawWaRegex.exec(html)) !== null) {
    addWhatsApp(result, match[1], sourceUrl, verifiedAt);
  }

  $('a[href^="tel:"]').each((_, element) => {
    const href = $(element).attr('href') || '';
    const raw = decodeURIComponent(href.replace(/^tel:/i, '').split('?')[0]).trim();
    addPhone(result, raw, sourceUrl, verifiedAt);
  });

  $('a[href^="mailto:"]').each((_, element) => {
    const href = $(element).attr('href') || '';
    const raw = decodeURIComponent(href.replace(/^mailto:/i, '').split('?')[0]).trim();
    addEmail(result, raw, sourceUrl, verifiedAt);
  });

  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
  while ((match = emailRegex.exec(text)) !== null) {
    addEmail(result, match[1], sourceUrl, verifiedAt);
  }

  const cnpjRegex = /([0-9]{2}\.?[0-9]{3}\.?[0-9]{3}\/?[0-9]{4}-?[0-9]{2})/g;
  while ((match = cnpjRegex.exec(text)) !== null) {
    const cnpj = match[1];
    if (!result.cnpj.some((item) => normalizePhone(item.value) === normalizePhone(cnpj))) {
      result.cnpj.push(makeInfo(cnpj, sourceUrl, verifiedAt));
    }
  }

  $('a[href]').each((_, element) => {
    const href = ($(element).attr('href') || '').trim();
    if (!href) return;

    if (href.includes('instagram.com/') && !result.socials.instagram && !href.includes('/p/')) {
      result.socials.instagram = makeInfo(href, sourceUrl, verifiedAt);
    }
    if (href.includes('facebook.com/') && !result.socials.facebook) {
      result.socials.facebook = makeInfo(href, sourceUrl, verifiedAt);
    }
    if (href.includes('tiktok.com/@') && !result.socials.tiktok) {
      result.socials.tiktok = makeInfo(href, sourceUrl, verifiedAt);
    }
    if (href.includes('youtube.com/') && !result.socials.youtube) {
      result.socials.youtube = makeInfo(href, sourceUrl, verifiedAt);
    }
    if (href.includes('linkedin.com/company/') && !result.socials.linkedin) {
      result.socials.linkedin = makeInfo(href, sourceUrl, verifiedAt);
    }
  });

  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      const parsed = JSON.parse($(element).html() || '{}');

      walkJsonLd(parsed, (item) => {
        if (typeof item.telephone === 'string') {
          addPhone(result, item.telephone, sourceUrl, verifiedAt);
          if (/whats\s*app|whatsapp/i.test(String(item.contactType || item.description || ''))) {
            addWhatsApp(result, item.telephone, sourceUrl, verifiedAt, 'structured_whatsapp', 0.95);
          }
        }

        const sameAsValues = Array.isArray(item.sameAs) ? item.sameAs : item.sameAs ? [item.sameAs] : [];
        for (const sameAs of sameAsValues) {
          if (typeof sameAs === 'string') {
            extractWhatsappSignalsFromString(sameAs, sourceUrl, result, verifiedAt);
          }
        }

        if (item.contactPoint) {
          const contactPoints = Array.isArray(item.contactPoint) ? item.contactPoint : [item.contactPoint];
          for (const contact of contactPoints) {
            if (!contact || typeof contact !== 'object') continue;
            const contactPhone = typeof contact.telephone === 'string' ? contact.telephone : '';
            const contactType = String(contact.contactType || contact.description || '');
            if (contactPhone) addPhone(result, contactPhone, sourceUrl, verifiedAt);
            if (contactPhone && /whats\s*app|whatsapp/i.test(contactType)) {
              addWhatsApp(result, contactPhone, sourceUrl, verifiedAt, 'structured_whatsapp', 0.95);
            }
            for (const key of ['url', 'sameAs']) {
              const candidate = contact[key];
              if (typeof candidate === 'string') {
                extractWhatsappSignalsFromString(candidate, sourceUrl, result, verifiedAt);
              }
            }
          }
        }

        const emails = Array.isArray(item.email) ? item.email : item.email ? [item.email] : [];
        for (const email of emails) {
          if (typeof email === 'string') addEmail(result, email, sourceUrl, verifiedAt);
        }

        if (!result.openingHours && item.openingHours) {
          result.openingHours = Array.isArray(item.openingHours)
            ? item.openingHours.join('; ')
            : String(item.openingHours);
        }

        if (!result.openingHours && item.openingHoursSpecification) {
          const specs = Array.isArray(item.openingHoursSpecification)
            ? item.openingHoursSpecification
            : [item.openingHoursSpecification];

          const formatted = specs
            .map((spec: any) => `${spec?.dayOfWeek || ''} ${spec?.opens || ''}-${spec?.closes || ''}`)
            .filter((value: string) => value.trim())
            .join('; ');

          if (formatted) result.openingHours = formatted;
        }
      });
    } catch {
      // Ignore invalid JSON-LD blocks.
    }
  });
}

function buildEmptyResult(): EnrichmentResult {
  const now = new Date().toISOString();

  return {
    siteStatus: 'unknown',
    whatsapp: [],
    whatsappCandidates: [],
    emails: [],
    phones: [],
    socials: {},
    cnpj: [],
    team: [],
    contactFreshness: {
      checkedAt: now,
      websiteReachable: false,
      verifiedWhatsappCount: 0,
      verifiedPhoneCount: 0,
      verifiedEmailCount: 0,
    },
    updatedAt: now,
  };
}

export async function enrichBusinessWebsite(
  baseUrl: string,
  options: { force?: boolean } = {},
): Promise<EnrichmentResult> {
  const cacheKey = baseUrl.toLowerCase().trim();
  const cached = enrichmentCache.get(cacheKey);

  if (!options.force && cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const result = buildEmptyResult();
  const verifiedAt = result.updatedAt;

  let primaryUrl = baseUrl.trim();
  let secondaryUrl: string | null = null;

  if (!/^https?:\/\//i.test(primaryUrl)) {
    primaryUrl = `https://${primaryUrl}`;
    secondaryUrl = `http://${baseUrl.trim()}`;
  } else if (primaryUrl.startsWith('https://')) {
    secondaryUrl = primaryUrl.replace(/^https:\/\//i, 'http://');
  }

  let homepageContent = '';
  let finalHomepageUrl = primaryUrl;

  try {
    const response = await safeFetch(primaryUrl);
    homepageContent = response.content;
    finalHomepageUrl = response.finalUrl;
  } catch (primaryError) {
    if (secondaryUrl) {
      try {
        const response = await safeFetch(secondaryUrl, 0, 3500);
        homepageContent = response.content;
        finalHomepageUrl = response.finalUrl;
      } catch {
        result.siteStatus = 'unreachable';
      }
    } else {
      result.siteStatus = 'unreachable';
    }
  }

  if (!homepageContent) {
    result.contactFreshness.checkedAt = new Date().toISOString();
    enrichmentCache.set(cacheKey, {
      expiresAt: Date.now() + 5 * 60 * 1000,
      data: result,
    });
    return result;
  }

  result.siteStatus = 'verified';
  result.finalUrl = finalHomepageUrl;
  result.hasHttps = finalHomepageUrl.startsWith('https://');
  result.contactFreshness.websiteReachable = true;

  const $home = cheerio.load(homepageContent);
  result.title = $home('title').text().trim();
  result.metaDescription = $home('meta[name="description"]').attr('content')?.trim();

  extractDataFromPage($home, finalHomepageUrl, result, verifiedAt);

  const discoveredSubpages: string[] = [];
  const baseHost = new URL(finalHomepageUrl).hostname.replace(/^www\./, '');

  $home('a[href]').each((_, element) => {
    if (discoveredSubpages.length >= 10) return;

    const href = $home(element).attr('href')?.trim();
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

    try {
      const fullUrl = new URL(href, finalHomepageUrl);
      const host = fullUrl.hostname.replace(/^www\./, '');
      if (host !== baseHost) return;

      const path = fullUrl.pathname.toLowerCase();
      if (
        /contato|contact|fale-conosco|fale|atendimento|whatsapp|orcamento|orçamento|support|suporte|sobre|about|quem-somos|localizacao|location/.test(
          path,
        ) &&
        fullUrl.toString() !== finalHomepageUrl &&
        !discoveredSubpages.includes(fullUrl.toString())
      ) {
        discoveredSubpages.push(fullUrl.toString());
      }
    } catch {
      // Ignore malformed links.
    }
  });

  const addContactPage = (candidate: string) => {
    if (discoveredSubpages.length >= 10) return;
    try {
      const fullUrl = new URL(candidate, finalHomepageUrl);
      const host = fullUrl.hostname.replace(/^www\./, '');
      if (host !== baseHost || fullUrl.toString() === finalHomepageUrl) return;
      if (!discoveredSubpages.includes(fullUrl.toString())) discoveredSubpages.push(fullUrl.toString());
    } catch {
      // Ignore malformed candidates.
    }
  };

  // Common contact endpoints often aren't linked in SPA menus or are injected by JS.
  for (const path of ['/contato', '/fale-conosco', '/atendimento', '/contact', '/whatsapp']) {
    addContactPage(path);
  }

  // Sitemap can expose contact pages that aren't present in the server-rendered homepage.
  try {
    const sitemapUrl = new URL('/sitemap.xml', finalHomepageUrl).toString();
    const sitemap = await safeFetch(sitemapUrl, 0, 2400);
    const $xml = cheerio.load(sitemap.content, { xmlMode: true });
    $xml('loc').each((_, element) => {
      if (discoveredSubpages.length >= 10) return;
      const candidate = $xml(element).text().trim();
      if (/contato|contact|fale|atendimento|whatsapp|support|suporte|sobre|about|quem-somos/i.test(candidate)) {
        addContactPage(candidate);
      }
    });
  } catch {
    // A sitemap is optional.
  }

  await Promise.allSettled(
    discoveredSubpages.slice(0, 10).map(async (url) => {
      const response = await safeFetch(url, 0, 3000);
      extractDataFromPage(cheerio.load(response.content), response.finalUrl, result, verifiedAt);
    }),
  );

  result.contactFreshness = {
    checkedAt: new Date().toISOString(),
    websiteReachable: true,
    verifiedWhatsappCount: result.whatsapp.filter((item) => (item.confidence ?? 1) >= 0.9).length,
    verifiedPhoneCount: result.phones.length,
    verifiedEmailCount: result.emails.length,
  };
  result.updatedAt = result.contactFreshness.checkedAt;

  enrichmentCache.set(cacheKey, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    data: result,
  });

  return result;
}
