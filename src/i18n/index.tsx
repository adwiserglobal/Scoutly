import { Fragment, createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  detectCountryLanguage,
  getChosenLanguage,
  getInitialLanguage,
  localeFor,
  saveChosenLanguage,
  setActiveLanguage,
  type Language,
} from './language';
import { EN } from './en';
import { startDomTranslation, stopDomTranslation } from './domTranslator';

export type { Language } from './language';

type Vars = Record<string, string | number>;
export type TFunction = (portuguese: string, vars?: Vars) => string;

interface LanguageContextValue {
  language: Language;
  locale: string;
  setLanguage: (language: Language) => void;
  t: TFunction;
}

const interpolate = (text: string, vars?: Vars) =>
  vars ? text.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match)) : text;

/** Portuguese text is the key; English comes from the dictionary and falls back to the original. */
export function translate(language: Language, portuguese: string, vars?: Vars) {
  return interpolate(language === 'en' ? EN[portuguese] ?? portuguese : portuguese, vars);
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  // First visit: let the visitor's IP country decide, unless they already picked a language.
  useEffect(() => {
    if (getChosenLanguage()) return;
    let cancelled = false;
    detectCountryLanguage().then((detected) => {
      if (!cancelled && detected && !getChosenLanguage()) setLanguageState(detected);
    });
    return () => { cancelled = true; };
  }, []);

  // Before children render, so non-React helpers and the marketing video see the right language.
  setActiveLanguage(language);
  document.documentElement.lang = language === 'pt' ? 'pt-BR' : 'en';

  useEffect(() => {
    document.documentElement.lang = language === 'pt' ? 'pt-BR' : 'en';
    if (language === 'en') startDomTranslation();
    else stopDomTranslation();
    return () => stopDomTranslation();
  }, [language]);

  const setLanguage = useCallback((next: Language) => {
    saveChosenLanguage(next);
    setLanguageState(next);
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      locale: localeFor(language),
      setLanguage,
      t: (portuguese, vars) => translate(language, portuguese, vars),
    }),
    [language, setLanguage],
  );

  return (
    <LanguageContext.Provider value={value}>
      <Fragment key={language}>{children}</Fragment>
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider');
  return context;
}

export const useT = () => useLanguage().t;
