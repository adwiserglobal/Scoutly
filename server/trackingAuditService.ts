import * as cheerio from 'cheerio';
import dns from 'dns/promises';

export interface TrackingAuditResult {
  status: 'verified' | 'unreachable' | 'unknown';
  scannedUrl?: string;
  scanMode: 'static_html' | 'static_plus_assets';
  assetsScanned: number;
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
    evidence: string[];
  };
  notes: string[];
  checkedAt: string;
}

function emptyAudit(status: TrackingAuditResult['status'] = 'unknown'): TrackingAuditResult {
  return {
    status,
    scanMode: 'static_html',
    assetsScanned: 0,
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
      evidence: [],
    },
    notes: [],
    checkedAt: new Date().toISOString(),
  };
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

async function validatePublicHost(hostname: string): Promise<void> {
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new Error('Host not allowed');
  }

  const records = await Promise.race([
    dns.lookup(hostname, { all: true }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DNS timeout')), 1500)
    ),
  ]);

  if (!records.length || records.some((record) => isPrivateIP(record.address))) {
    throw new Error('Private or invalid host');
  }
}

async function safeFetchText(
  urlString: string,
  redirects = 0,
  timeoutMs = 5000,
  maxBytes = 2 * 1024 * 1024,
): Promise<{ text: string; finalUrl: string; contentType: string }> {
  if (redirects > 3) throw new Error('Too many redirects');

  const parsed = new URL(urlString);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Protocol not allowed');
  }

  await validatePublicHost(parsed.hostname);

  const response = await fetch(parsed.toString(), {
    method: 'GET',
    redirect: 'manual',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36 ScoutlyAudit/1.1',
      Accept: 'text/html,application/xhtml+xml,text/javascript,application/javascript,text/plain,*/*;q=0.5',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get('location');
    if (!location) throw new Error('Redirect without location');
    return safeFetchText(
      new URL(location, parsed).toString(),
      redirects + 1,
      timeoutMs,
      maxBytes,
    );
  }

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > maxBytes) throw new Error('Response too large');

  const text = await response.text();
  if (text.length > maxBytes) {
    return {
      text: text.slice(0, maxBytes),
      finalUrl: parsed.toString(),
      contentType: response.headers.get('content-type') || '',
    };
  }

  return {
    text,
    finalUrl: parsed.toString(),
    contentType: response.headers.get('content-type') || '',
  };
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
    ['OneTrust', /onetrust|optanon|cdn\.cookielaw\.org/i],
    ['Cookiebot', /cookiebot|consent\.cookiebot|cookieconsent/i],
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
    ['TrustArc', /trustarc|truste\.com/i],
    ['Usercentrics', /usercentrics|uc-consent/i],
    ['Ketch', /ketch\.com|ketch-consent/i],
    ['Sourcepoint', /sourcepoint|privacy-mgmt/i],
  ];

  return providers.find(([, pattern]) => pattern.test(source))?.[0];
}

function addUnique(target: string[], values: string[]) {
  for (const value of values) {
    if (!target.includes(value)) target.push(value);
  }
}

function collectScriptUrls(html: string, finalUrl: string): string[] {
  const $ = cheerio.load(html);
  const candidates = new Set<string>();

  $('script[src]').each((_, element) => {
    const src = $(element).attr('src')?.trim();
    if (!src || src.startsWith('data:')) return;

    try {
      const resolved = new URL(src, finalUrl);
      if (!['http:', 'https:'].includes(resolved.protocol)) return;
      candidates.add(resolved.toString());
    } catch {
      // Ignore malformed script URLs.
    }
  });

  return Array.from(candidates).slice(0, 18);
}

async function fetchScriptAssets(urls: string[]): Promise<string[]> {
  if (urls.length === 0) return [];

  const chunks: string[] = [];
  const queue = [...urls];
  const workers = Array.from({ length: Math.min(5, queue.length) }, async () => {
    while (queue.length > 0) {
      const url = queue.shift();
      if (!url) break;

      try {
        const response = await safeFetchText(url, 0, 3200, 750 * 1024);
        const contentType = response.contentType.toLowerCase();
        const looksTextual =
          !contentType ||
          contentType.includes('javascript') ||
          contentType.includes('text') ||
          contentType.includes('json');

        if (looksTextual && response.text) {
          chunks.push(`/* asset: ${url} */\n${response.text}`);
        }
      } catch {
        // Third-party scripts frequently block server-side requests. Ignore individually.
      }
    }
  });

  await Promise.allSettled(workers);
  return chunks;
}

function detectCookieSignals(source: string, visibleBodyText: string) {
  const evidence: string[] = [];
  const provider = detectCookieProvider(source);

  if (provider) evidence.push(`CMP: ${provider}`);

  const cookieBannerPhrase =
    /privacy settings|cookie settings|manage cookie settings|manage cookies|gerenciar cookies|configurar cookies|prefer[êe]ncias de cookies|cookie preferences|privacy preferences/i;
  const essentialPhrase =
    /only essential cookies|essential cookies only|necessary cookies only|apenas cookies essenciais|somente cookies essenciais/i;
  const consentPhrase =
    /agree to all|accept all|allow all|aceitar todos|aceito todos|permitir todos/i;
  const rejectPhrase =
    /reject all|decline all|deny all|only essential|apenas essenciais|somente essenciais|rejeitar todos|recusar todos/i;

  if (cookieBannerPhrase.test(source)) evidence.push('Texto de configurações de cookies');
  if (essentialPhrase.test(source)) evidence.push('Opção de cookies essenciais');
  if (consentPhrase.test(source)) evidence.push('Ação de aceitar todos');
  if (rejectPhrase.test(source)) evidence.push('Ação de rejeição/essenciais');

  const hasCookieLanguage =
    /cookie|cookies|consentimento|consent|privacidade|privacy/i.test(source);
  const hasBannerMarkup =
    /cookie[-_ ]?(banner|consent|notice|popup|modal)|consent[-_ ]?(banner|modal|manager)|cmp[-_ ]?(banner|modal)|privacy[-_ ]?(banner|modal|settings)/i.test(source);

  const hasAccept =
    consentPhrase.test(source) ||
    /aceitar(?:\s+todos)?|aceito|concordo|permitir(?:\s+todos)?|accept(?:\s+all)?|allow(?:\s+all)?/i.test(visibleBodyText);
  const hasReject =
    rejectPhrase.test(source) ||
    /rejeitar(?:\s+todos)?|recusar(?:\s+todos)?|não aceitar|nao aceitar|reject(?:\s+all)?|decline|deny(?:\s+all)?/i.test(visibleBodyText);
  const hasPreferences =
    cookieBannerPhrase.test(source) ||
    /prefer[êe]ncias|configurar cookies|gerenciar cookies|personalizar cookies|cookie settings|manage preferences|preferences/i.test(visibleBodyText);

  const detected = Boolean(
    provider ||
    (hasCookieLanguage && hasBannerMarkup) ||
    (cookieBannerPhrase.test(source) && (essentialPhrase.test(source) || consentPhrase.test(source))),
  );

  return {
    detected,
    provider,
    hasAccept,
    hasReject,
    hasPreferences,
    evidence,
  };
}

export async function auditWebsiteTracking(baseUrl: string): Promise<TrackingAuditResult> {
  const audit = emptyAudit();

  let primary = baseUrl.trim();
  if (!/^https?:\/\//i.test(primary)) primary = `https://${primary}`;

  let fetched: { text: string; finalUrl: string; contentType: string } | null = null;

  try {
    fetched = await safeFetchText(primary, 0, 5500, 2 * 1024 * 1024);
  } catch {
    if (primary.startsWith('https://')) {
      try {
        fetched = await safeFetchText(
          primary.replace(/^https:\/\//i, 'http://'),
          0,
          4500,
          2 * 1024 * 1024,
        );
      } catch {
        audit.status = 'unreachable';
        audit.notes.push('Não foi possível ler o conteúdo público do site.');
        return audit;
      }
    }
  }

  if (!fetched) return audit;

  audit.status = 'verified';
  audit.scannedUrl = fetched.finalUrl;

  const html = fetched.text;
  const $ = cheerio.load(html);
  const bodyText = $('body').text().replace(/\s+/g, ' ').toLowerCase();

  const scriptUrls = collectScriptUrls(html, fetched.finalUrl);
  const assetChunks = await fetchScriptAssets(scriptUrls);
  audit.assetsScanned = assetChunks.length;
  audit.scanMode = assetChunks.length > 0 ? 'static_plus_assets' : 'static_html';

  const source = [html, ...scriptUrls, ...assetChunks].join('\n').toLowerCase();

  const gtmIds = uniqueMatches(source, /\b(GTM-[A-Z0-9]+)\b/gi);
  audit.gtm.containerIds = gtmIds;
  audit.gtm.detected =
    gtmIds.length > 0 ||
    /googletagmanager\.com\/gtm\.js/i.test(source) ||
    /dataLayer\s*=.*gtm\.start/i.test(source);

  const ga4Ids = uniqueMatches(source, /\b(G-[A-Z0-9]{6,})\b/gi);
  const hasGtagLoader =
    /googletagmanager\.com\/gtag\/js\?[^"'<>\s]*id=G-/i.test(source);
  const hasGa4Config =
    /gtag\s*\(\s*['"]config['"]\s*,\s*['"]G-[A-Z0-9]+/i.test(source);
  const hasGa4Library =
    /google-analytics\.com\/g\/collect|google-analytics\.com\/analytics\.js|gtag\s*\(/i.test(source);

  audit.ga4.measurementIds = ga4Ids;
  audit.ga4.directDetection =
    ga4Ids.length > 0 || hasGtagLoader || hasGa4Config || hasGa4Library;
  audit.ga4.detected = audit.ga4.directDetection;

  const pixelIds = uniqueMatches(
    source,
    /fbq\s*\(\s*['"]init['"]\s*,\s*['"]([0-9]{5,})['"]/gi,
  );
  const pixelQueryIds = uniqueMatches(
    source,
    /facebook\.com\/tr\?[^"'<>\s]*\bid=([0-9]{5,})/gi,
  );
  addUnique(pixelIds, pixelQueryIds);

  const hasFacebookScript =
    /connect\.facebook\.net\/[^"'\s]*fbevents\.js/i.test(source);

  audit.metaPixel.pixelIds = pixelIds;
  audit.metaPixel.directDetection =
    pixelIds.length > 0 ||
    hasFacebookScript ||
    /\bfbq\s*\(/i.test(source);
  audit.metaPixel.detected = audit.metaPixel.directDetection;

  const adsIds = uniqueMatches(source, /\b(AW-[0-9]+)\b/gi);
  audit.googleAds.conversionIds = adsIds;
  audit.googleAds.detected =
    adsIds.length > 0 ||
    /googleadservices\.com\/pagead\/conversion|googletagmanager\.com\/gtag\/js\?[^"'<>\s]*id=AW-/i.test(source);

  const otherTrackers = new Set<string>();
  if (/analytics\.tiktok\.com|ttq\.load\s*\(/i.test(source)) {
    otherTrackers.add('TikTok Pixel');
  }
  if (/static\.hotjar\.com|hotjar\.com\/c\/hotjar-/i.test(source)) {
    otherTrackers.add('Hotjar');
  }
  if (/clarity\.ms\/tag\/|clarity\s*\(/i.test(source)) {
    otherTrackers.add('Microsoft Clarity');
  }
  if (/snap\.licdn\.com\/li\.lms-analytics/i.test(source)) {
    otherTrackers.add('LinkedIn Insight Tag');
  }
  if (/bat\.bing\.com\/bat\.js/i.test(source)) {
    otherTrackers.add('Microsoft Advertising UET');
  }
  audit.otherTrackers = Array.from(otherTrackers);

  audit.hasTracking =
    audit.ga4.detected ||
    audit.gtm.detected ||
    audit.metaPixel.detected ||
    audit.googleAds.detected ||
    audit.otherTrackers.length > 0;

  const cookieSignals = detectCookieSignals(source, bodyText);
  audit.cookieConsent.detected = cookieSignals.detected;
  audit.cookieConsent.provider = cookieSignals.provider;
  audit.cookieConsent.hasAcceptAction = cookieSignals.hasAccept;
  audit.cookieConsent.hasRejectAction = cookieSignals.hasReject;
  audit.cookieConsent.hasPreferencesAction = cookieSignals.hasPreferences;
  audit.cookieConsent.evidence = cookieSignals.evidence;
  audit.cookieConsent.level = !cookieSignals.detected
    ? 'not_detected'
    : cookieSignals.hasReject || cookieSignals.hasPreferences
      ? 'strong_signals'
      : 'basic_banner';

  if (audit.gtm.detected && !audit.ga4.detected) {
    audit.notes.push(
      'GTM detectado. O GA4 pode estar configurado dentro do container e não aparecer diretamente nos arquivos públicos.',
    );
  }
  if (audit.gtm.detected && !audit.metaPixel.detected) {
    audit.notes.push(
      'GTM detectado. O Meta Pixel pode estar configurado dentro do container e não aparecer diretamente nos arquivos públicos.',
    );
  }

  if (audit.assetsScanned > 0) {
    audit.notes.push(
      `A Scoutly também analisou ${audit.assetsScanned} arquivo(s) JavaScript público(s) referenciado(s) pela página.`,
    );
  }

  audit.notes.push(
    'Detecções positivas são fortes sinais técnicos. Ausência de detecção não prova ausência, porque algumas tags e banners só aparecem após execução do JavaScript, consentimento, região ou interação.',
  );

  return audit;
}
