export type Language = 'pt' | 'en';

const CHOICE_KEY = 'scoutly_language_choice';
const GEO_KEY = 'scoutly_geo_country';
const LEGACY_KEY = 'scoutly_language';

// Countries where Portuguese is the default; everyone else starts in English.
const PORTUGUESE_COUNTRIES = new Set(['BR', 'PT', 'AO', 'MZ', 'CV', 'GW', 'ST', 'TL']);

function read(storage: 'localStorage' | 'sessionStorage', key: string) {
  try { return window[storage].getItem(key); } catch { return null; }
}

function write(key: string, value: string) {
  try { window.localStorage.setItem(key, value); } catch { /* storage can be blocked */ }
}

const isLanguage = (value: unknown): value is Language => value === 'pt' || value === 'en';

export function languageForCountry(country: string | null | undefined): Language | null {
  const code = String(country || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;
  return PORTUGUESE_COUNTRIES.has(code) ? 'pt' : 'en';
}

/** The language the user explicitly picked (or ?lang=), if any. Always wins over detection. */
export function getChosenLanguage(): Language | null {
  const requested = new URLSearchParams(window.location.search).get('lang');
  if (isLanguage(requested)) return requested;
  const saved = read('localStorage', CHOICE_KEY) ?? read('sessionStorage', LEGACY_KEY);
  return isLanguage(saved) ? saved : null;
}

export function saveChosenLanguage(language: Language) {
  write(CHOICE_KEY, language);
}

function languageForTimezone(): Language | null {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    // Brazilian (and Portuguese) timezones keep the default, whatever the browser language is.
    if (/^America\/(Sao_Paulo|Bahia|Fortaleza|Recife|Belem|Manaus|Cuiaba|Campo_Grande|Porto_Velho|Boa_Vista|Rio_Branco|Araguaina|Maceio|Noronha|Santarem|Eirunepe)$/.test(zone)) return 'pt';
    if (/^(Europe\/Lisbon|Atlantic\/(Azores|Madeira)|Africa\/(Luanda|Maputo))$/.test(zone)) return 'pt';
    return zone ? 'en' : null;
  } catch {
    return null;
  }
}

/**
 * Synchronous guess for the first paint: explicit choice > cached IP country > timezone.
 * Portuguese is the default whenever we cannot tell; the IP lookup then confirms or corrects it.
 */
export function getInitialLanguage(): Language {
  const chosen = getChosenLanguage();
  if (chosen) return chosen;
  const cached = languageForCountry(read('localStorage', GEO_KEY));
  if (cached) return cached;
  if (navigator.language?.toLowerCase().startsWith('pt')) return 'pt';
  return languageForTimezone() ?? 'pt';
}

/** Asks the server which country the request comes from (IP based) and caches the answer. */
export async function detectCountryLanguage(): Promise<Language | null> {
  const cached = languageForCountry(read('localStorage', GEO_KEY));
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 4000);
    const response = await fetch('/api/geo', { signal: controller.signal, cache: 'no-store' });
    window.clearTimeout(timer);
    if (!response.ok) return cached;
    const data = await response.json();
    const language = languageForCountry(data?.country);
    if (language) write(GEO_KEY, String(data.country).toUpperCase());
    return language ?? cached;
  } catch {
    return cached;
  }
}

export const localeFor = (language: Language) => (language === 'pt' ? 'pt-BR' : 'en-US');

let activeLanguage: Language = 'pt';
export const setActiveLanguage = (language: Language) => { activeLanguage = language; };
/** For non-React helpers (formatters, category labels) that need the current language. */
export const getActiveLanguage = () => activeLanguage;
export const getActiveLocale = () => localeFor(activeLanguage);
