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

    let cancelled = false;
    checkingRef.current = true;

    fetchOnboardingStatus()
      .then((status) => {
        if (cancelled) return;
        setStatusCheckedFor(user.uid);
        if (Number(status.onboardingVersion || 0) < SCOUTLY_ONBOARDING_VERSION) {
          setMode('wizard');
        } else if (!status.tutorialCompleted) {
          setMode('tutorial');
        } else {
          setMode('hidden');
        }
      })
      .catch((error) => {
        console.warn('[Scoutly Onboarding] Could not load status:', error);
        // Never block access to the product if the onboarding service is temporarily unavailable.
        if (!cancelled) setMode('hidden');
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
    setMode('tutorial');
  };

  const finishTutorial = async () => {
    try {
      await completeOnboardingTutorial();
    } finally {
      // The product should always become usable even if persistence has a temporary failure.
      setMode('hidden');
    }
  };

  return (
    <OnboardingExperience
      mode={mode}
      userName={user.displayName}
      onSubmit={submitAnswers}
      onFinishTutorial={finishTutorial}
    />
  );
}
