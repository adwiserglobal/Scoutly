import * as cheerio from 'cheerio';
import dns from 'dns/promises';
import { getDuckDB } from './overtureService';

interface InfoItem {
  value: string;
  source: string;
  sourceUrl: string;
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
  updatedAt: string;
}

// In-memory DNS Cache (10 min TTL)
const dnsCache = new Map<string, { ips: string[]; expiresAt: number }>();

function isPrivateIP(ip: string): boolean {
  if (ip === '::1') return true;
  if (ip.toLowerCase().startsWith('fc') || ip.toLowerCase().startsWith('fd')) return true;
  if (ip.toLowerCase().startsWith('fe8')) return true;

  const parts = ip.split('.');
  if (parts.length === 4) {
    const p0 = parseInt(parts[0], 10);
    const p1 = parseInt(parts[1], 10);
    if (p0 === 10) return true;
    if (p0 === 127) return true;
    if (p0 === 192 && p1 === 168) return true;
    if (p0 === 172 && p1 >= 16 && p1 <= 31) return true;
    if (p0 === 169 && p1 === 254) return true;
    if (p0 === 0) return true;
  }
  return false;
}

async function resolveHostSafe(host: string): Promise<string[]> {
  const now = Date.now();
  const cached = dnsCache.get(host);
  if (cached && cached.expiresAt > now) {
    return cached.ips;
  }

  const dnsPromise = dns.resolve(host);
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('DNS resolution timeout')), 1200)
  );

  try {
    const ips = await Promise.race([dnsPromise, timeoutPromise]);
    if (ips && Array.isArray(ips) && ips.length > 0) {
      dnsCache.set(host, { ips, expiresAt: now + 10 * 60 * 1000 });
      return ips;
    }
  } catch (err) {
    // If IPv4 resolve failed, try default lookup
  }
  
  dnsCache.set(host, { ips: ['127.0.0.1'], expiresAt: now + 5000 }); // short penalty cache
  throw new Error('DNS resolution failed');
}

async function safeFetch(
  urlStr: string,
  redirects = 0,
  timeoutMs = 3000
): Promise<{ content: string; finalUrl: string }> {
  if (redirects > 2) {
    throw new Error('Too many redirects');
  }

  const parsed = new URL(urlStr);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Protocol not allowed');
  }

  const host = parsed.hostname;
  if (host === 'localhost' || host.endsWith('.localhost')) {
    throw new Error('Localhost not allowed');
  }

  let ips: string[];
  try {
    ips = await resolveHostSafe(host);
  } catch (e: any) {
    throw new Error(`DNS resolution failed: ${e.message}`);
  }

  const targetIp = ips[0];
  if (isPrivateIP(targetIp)) {
    throw new Error(`Access to private IP ${targetIp} blocked for SSRF protection`);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(urlStr, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      redirect: 'manual',
      signal: controller.signal,
    });

    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get('location');
      if (!location) throw new Error('Redirect without location header');
      const nextUrl = new URL(location, urlStr).toString();
      clearTimeout(timeoutId);
      return safeFetch(nextUrl, redirects + 1, timeoutMs);
    }

    if (!res.ok) {
      throw new Error(`HTTP Error ${res.status}`);
    }

    const contentType = res.headers.get('content-type') || '';
    if (
      !contentType.includes('text/html') &&
      !contentType.includes('application/xhtml+xml') &&
      !contentType.includes('text/plain')
    ) {
      throw new Error('Not HTML content');
    }

    const text = await res.text();
    if (text.length > 1.5 * 1024 * 1024) {
      throw new Error('Response too large');
    }

    return { content: text, finalUrl: urlStr };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function enrichBusinessWebsite(baseUrl: string): Promise<EnrichmentResult> {
  const db = await getDuckDB();

  const cacheKey = baseUrl.toLowerCase().trim();
  
  // 1. DuckDB Cache Check (Fast)
  try {
    const rows = await new Promise<any[]>((resolve, reject) => {
      db.all(
        'SELECT data, updated_at FROM enrichment_cache WHERE url = ?',
        cacheKey,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    if (rows.length > 0) {
      const updatedAt = new Date(rows[0].updated_at).getTime();
      const ageDays = (Date.now() - updatedAt) / (1000 * 60 * 60 * 24);
      if (ageDays <= 7) {
        return JSON.parse(rows[0].data);
      }
    }
  } catch (err) {
    console.warn('[Enrich Cache Check Error]:', err);
  }

  const result: EnrichmentResult = {
    siteStatus: 'unknown',
    whatsapp: [],
    emails: [],
    phones: [],
    socials: {},
    cnpj: [],
    team: [],
    updatedAt: new Date().toISOString(),
  };

  // Determine initial target URLs to try (https first)
  let primaryUrl = baseUrl;
  let secondaryFallbackUrl: string | null = null;

  if (!primaryUrl.startsWith('http://') && !primaryUrl.startsWith('https://')) {
    primaryUrl = 'https://' + primaryUrl;
    secondaryFallbackUrl = 'http://' + baseUrl;
  }

  let homepageContent = '';
  let finalHomepageUrl = primaryUrl;

  // 2. Fetch Homepage (3s timeout)
  try {
    const res = await safeFetch(primaryUrl, 0, 3000);
    homepageContent = res.content;
    finalHomepageUrl = res.finalUrl;
    result.siteStatus = 'verified';
    result.finalUrl = finalHomepageUrl;
    result.hasHttps = finalHomepageUrl.startsWith('https');
  } catch (err) {
    if (secondaryFallbackUrl) {
      try {
        const res = await safeFetch(secondaryFallbackUrl, 0, 2500);
        homepageContent = res.content;
        finalHomepageUrl = res.finalUrl;
        result.siteStatus = 'verified';
        result.finalUrl = finalHomepageUrl;
        result.hasHttps = finalHomepageUrl.startsWith('https');
      } catch {
        result.siteStatus = 'unreachable';
      }
    } else {
      result.siteStatus = 'unreachable';
    }
  }

  if (result.siteStatus === 'unreachable' || !homepageContent) {
    // Save unreachable status to cache briefly (1 day) so user isn't stuck waiting repeatedly
    saveToCache(db, cacheKey, result);
    return result;
  }

  const $home = cheerio.load(homepageContent);
  result.title = $home('title').text().trim();
  result.metaDescription = $home('meta[name="description"]').attr('content')?.trim();

  // Extract from Homepage
  extractDataFromPage($home, finalHomepageUrl, result);

  // 3. Smart Subpage Discovery (Find up to 2 actual contact/about links from homepage)
  const discoveredSubpages: string[] = [];
  const baseHost = new URL(finalHomepageUrl).hostname.replace(/^www\./, '');

  $home('a[href]').each((_, el) => {
    if (discoveredSubpages.length >= 2) return;
    const href = $home(el).attr('href')?.trim();
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

    try {
      const fullUrl = new URL(href, finalHomepageUrl);
      const host = fullUrl.hostname.replace(/^www\./, '');
      if (host === baseHost) {
        const pathname = fullUrl.pathname.toLowerCase();
        if (
          /contato|contact|sobre|about|quem-somos|equipe|team|fale-conosco/.test(pathname) &&
          !discoveredSubpages.includes(fullUrl.toString()) &&
          fullUrl.toString() !== finalHomepageUrl
        ) {
          discoveredSubpages.push(fullUrl.toString());
        }
      }
    } catch {
      // Ignore invalid URLs
    }
  });

  // 4. Fetch Discovered Subpages in PARALLEL (2s timeout max)
  if (discoveredSubpages.length > 0) {
    const subpagePromises = discoveredSubpages.map((url) =>
      safeFetch(url, 0, 2000)
        .then(({ content, finalUrl }) => {
          const $sub = cheerio.load(content);
          extractDataFromPage($sub, finalUrl, result);
        })
        .catch(() => {
          // Ignore subpage failure
        })
    );

    await Promise.allSettled(subpagePromises);
  }

  // 5. Save enriched result to DuckDB cache
  saveToCache(db, cacheKey, result);

  return result;
}

function saveToCache(db: any, cacheKey: string, result: EnrichmentResult) {
  db.run(
    'INSERT OR REPLACE INTO enrichment_cache (url, data, updated_at) VALUES (?, ?, ?)',
    cacheKey,
    JSON.stringify(result),
    new Date().toISOString(),
    (err: any) => {
      if (err) console.warn('[DuckDB Save Cache Warning]:', err.message || err);
    }
  );
}

function extractDataFromPage($: cheerio.CheerioAPI, sourceUrl: string, result: EnrichmentResult) {
  const text = $('body').text();
  const html = $('body').html() || '';

  // WhatsApp: Links wa.me or api.whatsapp.com
  const waRegex = /(?:https?:\/\/)?(?:wa\.me|api\.whatsapp\.com\/send\?phone=)\/?([0-9]+)/gi;
  let match;
  while ((match = waRegex.exec(html)) !== null) {
    const waNumber = match[1];
    if (waNumber && waNumber.length >= 10 && !result.whatsapp.find((w) => w.value === waNumber)) {
      result.whatsapp.push({ value: waNumber, source: 'official_website', sourceUrl });
    }
  }

  // Tel: links for phones
  $('a[href^="tel:"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const rawPhone = href.replace(/^tel:/i, '').trim();
    const cleanDigits = rawPhone.replace(/\D/g, '');
    if (cleanDigits.length >= 8 && !result.phones.find((p) => p.value.replace(/\D/g, '') === cleanDigits)) {
      result.phones.push({ value: rawPhone, source: 'official_website', sourceUrl });
    }
  });

  // Emails
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
  while ((match = emailRegex.exec(text)) !== null) {
    const email = match[1].toLowerCase();
    const isImageExt = /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(email);
    const isDummy = /example|domain|email|sentry|bootstrap/i.test(email);
    if (!isImageExt && !isDummy && !result.emails.find((e) => e.value === email)) {
      result.emails.push({ value: email, source: 'official_website', sourceUrl });
    }
  }

  // CNPJ
  const cnpjRegex = /([0-9]{2}\.?[0-9]{3}\.?[0-9]{3}\/?[0-9]{4}-?[0-9]{2})/g;
  while ((match = cnpjRegex.exec(text)) !== null) {
    const cnpj = match[1];
    if (!result.cnpj.find((c) => c.value === cnpj)) {
      result.cnpj.push({ value: cnpj, source: 'official_website', sourceUrl });
    }
  }

  // Socials
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (href.includes('instagram.com/') && !result.socials.instagram && !href.includes('/p/')) {
      result.socials.instagram = { value: href, source: 'official_website', sourceUrl };
    }
    if (href.includes('facebook.com/') && !result.socials.facebook) {
      result.socials.facebook = { value: href, source: 'official_website', sourceUrl };
    }
    if (href.includes('tiktok.com/@') && !result.socials.tiktok) {
      result.socials.tiktok = { value: href, source: 'official_website', sourceUrl };
    }
    if (href.includes('youtube.com/') && !result.socials.youtube) {
      result.socials.youtube = { value: href, source: 'official_website', sourceUrl };
    }
    if (href.includes('linkedin.com/company/') && !result.socials.linkedin) {
      result.socials.linkedin = { value: href, source: 'official_website', sourceUrl };
    }
  });

  // Schema.org JSON-LD opening hours extraction fallback
  if (!result.openingHours) {
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const jsonText = $(el).html() || '';
        const parsed = JSON.parse(jsonText);
        const items = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of items) {
          if (item.openingHours) {
            result.openingHours = Array.isArray(item.openingHours)
              ? item.openingHours.join('; ')
              : String(item.openingHours);
            break;
          }
          if (item.openingHoursSpecification) {
            const specs = Array.isArray(item.openingHoursSpecification)
              ? item.openingHoursSpecification
              : [item.openingHoursSpecification];
            const formatted = specs
              .map((s: any) => `${s.dayOfWeek || ''} ${s.opens || ''}-${s.closes || ''}`)
              .join('; ');
            if (formatted.trim()) {
              result.openingHours = formatted;
              break;
            }
          }
        }
      } catch {
        // Ignore invalid json
      }
    });
  }
}
