import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import OnboardingExperience, {
  SCOUTLY_ONBOARDING_VERSION,
  type OnboardingAnswers,
} from './OnboardingExperience';
import {
  completeOnboardingTutorial,
  fetchOnboardingStatus,
  saveOnboardingAnswers,
} from '../services/onboardingApi';

const PRODUCT_PATHS = new Set(['/dashboard', '/favoritos', '/pipeline', '/configuracoes']);

type Mode = 'hidden' | 'wizard' | 'tutorial';

function currentPath() {
  return window.location.pathname.replace(/\/+$/, '') || '/';
}

const doneKey = (uid: string) => `scoutly-onboarding-done:${uid}`;

function readDone(uid: string) {
  try { return localStorage.getItem(doneKey(uid)) === String(SCOUTLY_ONBOARDING_VERSION); } catch { return false; }
}

function writeDone(uid: string) {
  try { localStorage.setItem(doneKey(uid), String(SCOUTLY_ONBOARDING_VERSION)); } catch { /* ignore */ }
}

// Accounts created moments ago have never onboarded: show the wizard without waiting for the network.
function isFreshAccount(creationTime?: string) {
  const created = creationTime ? Date.parse(creationTime) : NaN;
  return Number.isFinite(created) && Date.now() - created < 10 * 60 * 1000;
}

function markTutorialTargets() {
  document.querySelector<HTMLElement>('.scoutly-search-focus-ring')?.setAttribute('data-scoutly-tour', 'search');
  document.querySelector<HTMLElement>('button[title="Filtros"]')?.setAttribute('data-scoutly-tour', 'filters');
  document.querySelector<HTMLElement>('button[aria-label="Abrir Scoutly AI"]')?.setAttribute('data-scoutly-tour', 'ai');

  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button'));
  buttons.find((button) => /ver empresas/i.test(button.textContent || ''))?.setAttribute('data-scoutly-tour', 'businesses');
  buttons.find((button) => button.title === 'Pipeline')?.setAttribute('data-scoutly-tour', 'pipeline');
}

export default function OnboardingGate() {
  const { user, loading } = useAuth();
  const [pathname, setPathname] = useState(currentPath);
  const [mode, setMode] = useState<Mode>('hidden');
  const [statusCheckedFor, setStatusCheckedFor] = useState<string | null>(null);
  const checkingRef = useRef(false);

  useEffect(() => {
    const sync = () => setPathname(currentPath());
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  useEffect(() => {
    if (loading || !user || !PRODUCT_PATHS.has(pathname)) return;
    if (statusCheckedFor === user.uid || checkingRef.current) return;

    if (readDone(user.uid)) {
      setStatusCheckedFor(user.uid);
      return;
    }

    let cancelled = false;
    checkingRef.current = true;
    if (isFreshAccount((user as any).metadata?.creationTime)) setMode((current) => (current === 'hidden' ? 'wizard' : current));

    fetchOnboardingStatus()
      .then((status) => {
        if (cancelled) return;
        setStatusCheckedFor(user.uid);

        if (Number(status.onboardingVersion || 0) < SCOUTLY_ONBOARDING_VERSION) {
          setMode('wizard');
          return;
        }

        if (!status.tutorialCompleted) setMode('tutorial');
        else {
          writeDone(user.uid);
          setMode('hidden');
        }
      })
      .catch((error) => {
        console.warn('[Scoutly Onboarding] Could not load status:', error);
        if (!cancelled) setMode((current) => (current === 'wizard' ? current : 'hidden'));
      })
      .finally(() => {
        checkingRef.current = false;
      });

    return () => {
      cancelled = true;
    };
  }, [loading, pathname, statusCheckedFor, user?.uid]);

  useEffect(() => {
    if (mode !== 'tutorial') return;
    if (pathname !== '/dashboard') {
      window.history.replaceState({}, '', '/dashboard');
      window.dispatchEvent(new PopStateEvent('popstate'));
      return;
    }

    markTutorialTargets();
    const timers = [100, 350, 800].map((delay) => window.setTimeout(markTutorialTargets, delay));
    return () => timers.forEach(window.clearTimeout);
  }, [mode, pathname]);

  useEffect(() => {
    if (!user) {
      setMode('hidden');
      setStatusCheckedFor(null);
      checkingRef.current = false;
    }
  }, [user?.uid]);

  if (!user || !PRODUCT_PATHS.has(pathname) || mode === 'hidden') return null;

  const submitAnswers = async (answers: OnboardingAnswers) => {
    await saveOnboardingAnswers(answers);
    // Every new account is already on Free. Go straight into the product tour;
    // there is no trial activation wall anymore.
    setMode('tutorial');
  };

  const finishTutorial = async () => {
    try {
      await completeOnboardingTutorial();
    } finally {
      if (user) writeDone(user.uid);
      setMode('hidden');
      window.dispatchEvent(new Event('scoutly-access-updated'));
    }
  };

  return (
    <OnboardingExperience
      mode={mode === 'wizard' ? 'wizard' : 'tutorial'}
      userName={user.displayName}
      onSubmit={submitAnswers}
      onFinishTutorial={finishTutorial}
    />
  );
}
