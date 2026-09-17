import * as cheerio from 'cheerio';
import dns from 'dns/promises';

export interface TrackingAuditResult {
  status: 'verified' | 'unreachable' | 'unknown';
  scannedUrl?: string;
  scanMode: 'static_html';
  hasTracking: boolean;
  ga4: {
    detected: boolean;
    measurementIds: string[];
    directDetection: boolean;
  };
  gtm: {
    detected: boolean;
    containerIds: string[];
  };
  metaPixel: {
    detected: boolean;
    pixelIds: string[];
    directDetection: boolean;
  };
  googleAds: {
    detected: boolean;
    conversionIds: string[];
  };
  otherTrackers: string[];
  cookieConsent: {
    detected: boolean;
    provider?: string;
    hasAcceptAction: boolean;
    hasRejectAction: boolean;
    hasPreferencesAction: boolean;
    level: 'strong_signals' | 'basic_banner' | 'not_detected';
  };
  notes: string[];
  checkedAt: string;
}

function emptyAudit(status: TrackingAuditResult['status'] = 'unknown'): TrackingAuditResult {
  return {
    status,
    scanMode: 'static_html',
    hasTracking: false,
    ga4: { detected: false, measurementIds: [], directDetection: false },
    gtm: { detected: false, containerIds: [] },
    metaPixel: { detected: false, pixelIds: [], directDetection: false },
    googleAds: { detected: false, conversionIds: [] },
    otherTrackers: [],
    cookieConsent: {
      detected: false,
      hasAcceptAction: false,
      hasRejectAction: false,
      hasPreferencesAction: false,
      level: 'not_detected',
    },
    notes: [],
    checkedAt: new Date().toISOString(),
  };
}

function isPrivateIP(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === '::1') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true;

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

async function validatePublicHost(hostname: string): Promise<void> {
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new Error('Host not allowed');
  }

  const records = await Promise.race([
    dns.lookup(hostname, { all: true }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('DNS timeout')), 1500)),
  ]);

  if (!records.length || records.some((record) => isPrivateIP(record.address))) {
    throw new Error('Private or invalid host');
  }
}

async function fetchHtml(urlString: string, redirects = 0): Promise<{ html: string; finalUrl: string }> {
  if (redirects > 3) throw new Error('Too many redirects');

  const parsed = new URL(urlString);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Protocol not allowed');
  await validatePublicHost(parsed.hostname);

  const response = await fetch(parsed.toString(), {
    method: 'GET',
    redirect: 'manual',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36 ScoutlyAudit/1.0',
      Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.7',
    },
    signal: AbortSignal.timeout(5000),
  });

  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get('location');
    if (!location) throw new Error('Redirect without location');
    return fetchHtml(new URL(location, parsed).toString(), redirects + 1);
  }

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('html') && !contentType.includes('text/plain')) {
    throw new Error('Unsupported content type');
  }

  const html = await response.text();
  if (html.length > 2 * 1024 * 1024) throw new Error('Response too large');
  return { html, finalUrl: parsed.toString() };
}

function uniqueMatches(source: string, pattern: RegExp): string[] {
  const values = new Set<string>();
  for (const match of source.matchAll(pattern)) {
    const value = (match[1] || match[0] || '').trim();
    if (value) values.add(value.toUpperCase());
  }
  return Array.from(values);
}

function detectCookieProvider(source: string): string | undefined {
  const providers: Array<[string, RegExp]> = [
    ['OneTrust', /onetrust|optanon/i],
    ['Cookiebot', /cookiebot|consent\.cookiebot/i],
    ['CookieYes', /cookieyes|cky-consent|cky-btn/i],
    ['Iubenda', /iubenda/i],
    ['Complianz', /complianz|cmplz_/i],
    ['Didomi', /didomi/i],
    ['ConsentManager', /consentmanager|cmpbox/i],
    ['Termly', /termly/i],
    ['Axeptio', /axeptio/i],
    ['Osano', /osano/i],
    ['Quantcast Choice', /quantcast|qc-cmp/i],
    ['CookieScript', /cookie-script|cookiescript/i],
    ['CookieHub', /cookiehub/i],
  ];

  return providers.find(([, pattern]) => pattern.test(source))?.[0];
}

export async function auditWebsiteTracking(baseUrl: string): Promise<TrackingAuditResult> {
  const audit = emptyAudit();

  let primary = baseUrl.trim();
  if (!/^https?:\/\//i.test(primary)) primary = `https://${primary}`;

  let fetched: { html: string; finalUrl: string } | null = null;
  try {
    fetched = await fetchHtml(primary);
  } catch {
    if (primary.startsWith('https://')) {
      try {
        fetched = await fetchHtml(primary.replace(/^https:\/\//i, 'http://'));
      } catch {
        audit.status = 'unreachable';
        audit.notes.push('Não foi possível ler o HTML público do site.');
        return audit;
      }
    }
  }

  if (!fetched) return audit;

  audit.status = 'verified';
  audit.scannedUrl = fetched.finalUrl;

  const html = fetched.html;
  const normalized = html.toLowerCase();
  const $ = cheerio.load(html);
  const bodyText = $('body').text().replace(/\s+/g, ' ').toLowerCase();
  const searchable = `${normalized}\n${bodyText}`;

  const gtmIds = uniqueMatches(html, /\b(GTM-[A-Z0-9]+)\b/gi);
  audit.gtm.containerIds = gtmIds;
  audit.gtm.detected = gtmIds.length > 0 || /googletagmanager\.com\/gtm\.js/i.test(html);

  const ga4Ids = uniqueMatches(html, /\b(G-[A-Z0-9]{6,})\b/gi);
  const hasGtagLoader = /googletagmanager\.com\/gtag\/js\?[^"'<>]*id=G-/i.test(html);
  const hasGa4Config = /gtag\s*\(\s*['"]config['"]\s*,\s*['"]G-[A-Z0-9]+/i.test(html);
  audit.ga4.measurementIds = ga4Ids;
  audit.ga4.directDetection = ga4Ids.length > 0 || hasGtagLoader || hasGa4Config;
  audit.ga4.detected = audit.ga4.directDetection;

  const pixelIds = uniqueMatches(html, /fbq\s*\(\s*['"]init['"]\s*,\s*['"]([0-9]{5,})['"]/gi);
  const pixelQueryIds = uniqueMatches(html, /facebook\.com\/tr\?[^"'<>]*\bid=([0-9]{5,})/gi);
  for (const id of pixelQueryIds) if (!pixelIds.includes(id)) pixelIds.push(id);
  const hasFacebookScript = /connect\.facebook\.net\/[^"']*fbevents\.js/i.test(html);
  audit.metaPixel.pixelIds = pixelIds;
  audit.metaPixel.directDetection = pixelIds.length > 0 || hasFacebookScript || /\bfbq\s*\(/i.test(html);
  audit.metaPixel.detected = audit.metaPixel.directDetection;

  const adsIds = uniqueMatches(html, /\b(AW-[0-9]+)\b/gi);
  audit.googleAds.conversionIds = adsIds;
  audit.googleAds.detected = adsIds.length > 0;

  const otherTrackers = new Set<string>();
  if (/analytics\.tiktok\.com|ttq\.load\s*\(/i.test(html)) otherTrackers.add('TikTok Pixel');
  if (/static\.hotjar\.com|hotjar\.com\/c\/hotjar-/i.test(html)) otherTrackers.add('Hotjar');
  if (/clarity\.ms\/tag\//i.test(html)) otherTrackers.add('Microsoft Clarity');
  if (/snap\.licdn\.com\/li\.lms-analytics/i.test(html)) otherTrackers.add('LinkedIn Insight Tag');
  if (/bat\.bing\.com\/bat\.js/i.test(html)) otherTrackers.add('Microsoft Advertising UET');
  audit.otherTrackers = Array.from(otherTrackers);

  audit.hasTracking =
    audit.ga4.detected ||
    audit.gtm.detected ||
    audit.metaPixel.detected ||
    audit.googleAds.detected ||
    audit.otherTrackers.length > 0;

  const provider = detectCookieProvider(searchable);
  const hasCookieLanguage = /cookie|cookies|consentimento|consent|privacidade|privacy/i.test(searchable);
  const hasBannerMarkup = /cookie[-_ ]?(banner|consent|notice|popup|modal)|consent[-_ ]?(banner|modal|manager)|cmp[-_ ]?(banner|modal)/i.test(searchable);
  const hasAccept = /aceitar(?:\s+todos)?|aceito|concordo|permitir(?:\s+todos)?|accept(?:\s+all)?|allow(?:\s+all)?/i.test(bodyText);
  const hasReject = /rejeitar(?:\s+todos)?|recusar(?:\s+todos)?|não aceitar|nao aceitar|reject(?:\s+all)?|decline|deny(?:\s+all)?/i.test(bodyText);
  const hasPreferences = /prefer[êe]ncias|configurar cookies|gerenciar cookies|personalizar cookies|cookie settings|manage preferences|preferences/i.test(bodyText);

  audit.cookieConsent.detected = Boolean(provider || (hasCookieLanguage && hasBannerMarkup));
  audit.cookieConsent.provider = provider;
  audit.cookieConsent.hasAcceptAction = hasAccept;
  audit.cookieConsent.hasRejectAction = hasReject;
  audit.cookieConsent.hasPreferencesAction = hasPreferences;
  audit.cookieConsent.level = !audit.cookieConsent.detected
    ? 'not_detected'
    : hasReject || hasPreferences
      ? 'strong_signals'
      : 'basic_banner';

  if (audit.gtm.detected && !audit.ga4.detected) {
    audit.notes.push('GTM detectado. O GA4 pode estar configurado dentro do container e não aparecer diretamente no HTML.');
  }
  if (audit.gtm.detected && !audit.metaPixel.detected) {
    audit.notes.push('GTM detectado. O Meta Pixel pode estar configurado dentro do container e não aparecer diretamente no HTML.');
  }
  audit.notes.push('A checagem de cookies usa sinais técnicos do HTML/CMP e não substitui uma avaliação jurídica de conformidade com a LGPD.');

  return audit;
}
