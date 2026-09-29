import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { CreditAccessStatus, fetchAccessStatus } from '../services/api';

function currentPath() {
  return window.location.pathname.replace(/\/+$/, '') || '/';
}

const HOME_PATH = '/dashboard';

export default function CreditBalancePill() {
  const { user } = useAuth();
  const [access, setAccess] = useState<CreditAccessStatus | null>(null);
  const [pathname, setPathname] = useState(currentPath);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      setAccess(await fetchAccessStatus());
    } catch (error) {
      console.warn('[Scoutly Credits] Could not refresh balance:', error);
    }
  }, [user?.uid]);

  useEffect(() => {
    const syncPath = () => setPathname(currentPath());
    window.addEventListener('popstate', syncPath);
    return () => window.removeEventListener('popstate', syncPath);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.scoutlyUnlimited = 'false';
    document.documentElement.dataset.scoutlyCreditsExhausted = 'false';

    const style = document.createElement('style');
    style.dataset.scoutlyCreditGate = 'true';
    style.textContent = `
      html:not([data-scoutly-unlimited="true"]) .scoutly-hover-card a {
        display: none !important;
      }
      html[data-scoutly-credits-exhausted="true"] .scoutly-business-shortcuts {
        display: none !important;
      }
      html[data-scoutly-credits-exhausted="true"] .scoutly-business-credit-lock {
        display: inline-flex !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      style.remove();
      delete document.documentElement.dataset.scoutlyUnlimited;
      delete document.documentElement.dataset.scoutlyCreditsExhausted;
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.scoutlyUnlimited = access?.isUnlimited ? 'true' : 'false';
    const exhausted = Boolean(access && !access.isUnlimited && (access.remaining ?? 0) <= 0);
    document.documentElement.dataset.scoutlyCreditsExhausted = exhausted ? 'true' : 'false';
  }, [access?.isUnlimited, access?.remaining]);

  useEffect(() => {
    if (!user) {
      setAccess(null);
      return;
    }

    void refresh();

    const onAccess = (event: Event) => {
      const detail = (event as CustomEvent<CreditAccessStatus>).detail;
      if (detail?.plan) setAccess(detail);
      else void refresh();
    };
    const onFocus = () => void refresh();

    window.addEventListener('scoutly-access-updated', onAccess);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('scoutly-access-updated', onAccess);
      window.removeEventListener('focus', onFocus);
    };
  }, [user?.uid, refresh]);

  useEffect(() => {
    const showExhausted = () => {
      if (!access || access.isUnlimited || (access.remaining ?? 0) > 0) {
        void refresh();
        return;
      }
      const code = (access.monthlyRemaining ?? 1) <= 0
        ? 'MONTHLY_CREDIT_LIMIT'
        : 'DAILY_CREDIT_LIMIT';
      window.dispatchEvent(new CustomEvent('scoutly-credits-exhausted', {
        detail: { code, access },
      }));
    };

    window.addEventListener('scoutly-request-credits-exhausted', showExhausted);
    return () => window.removeEventListener('scoutly-request-credits-exhausted', showExhausted);
  }, [access, refresh]);

  if (!user || pathname !== HOME_PATH || !access) return null;

  let primary = 'Créditos';
  let secondary = '';
  const isDeveloper = Boolean((access as CreditAccessStatus & { isDeveloper?: boolean }).isDeveloper);

  if (access.isUnlimited) {
    primary = 'Ilimitados';
    secondary = isDeveloper ? 'Scoutly Developers' : access.plan === 'agency' ? 'Agency' : 'Pro';
  } else if (access.plan === 'go') {
    primary = `${access.monthlyRemaining ?? 0} créditos`;
    secondary = 'Seus créditos resetam a 00:00 UTC';
  } else {
    primary = `${access.remaining ?? 0} créditos hoje`;
    secondary = 'Seus créditos resetam a 00:00 UTC';
  }

  const clickable = !access.isUnlimited;
  const exhausted = !access.isUnlimited && (access.remaining ?? 0) <= 0;

  const handleClick = () => {
    if (!clickable) return;
    if (exhausted) {
      const code = (access.monthlyRemaining ?? 1) <= 0
        ? 'MONTHLY_CREDIT_LIMIT'
        : 'DAILY_CREDIT_LIMIT';
      window.dispatchEvent(new CustomEvent('scoutly-credits-exhausted', {
        detail: { code, access },
      }));
      return;
    }
    window.dispatchEvent(new CustomEvent('scoutly-open-plans'));
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`fixed right-[78px] top-4 z-[30] isolate flex min-h-[58px] items-center gap-3 overflow-visible rounded-2xl border border-white/[0.11] bg-[#111418]/[0.98] py-1.5 pl-3 pr-4 text-left text-white shadow-[0_12px_34px_rgba(0,0,0,0.38)] backdrop-blur-2xl pointer-events-auto xl:right-[104px] ${clickable ? 'transition hover:border-[#FF5A12]/40 hover:bg-[#171a1f]' : 'cursor-default'}`}
      title={access.plan === 'free' ? 'Free: 5 créditos por dia, limitado a 25 por mês' : undefined}
      aria-label={`${primary}. ${secondary}`}
    >
      <span className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center overflow-visible rounded-full border border-[#ff9a42]/55 bg-[radial-gradient(circle_at_34%_28%,#ffc153_0%,#ff8a16_40%,#e94a05_72%,#9f2700_100%)] shadow-[0_0_0_1px_rgba(255,90,18,0.20),0_5px_16px_rgba(255,90,18,0.30)]">
        <span className="flex h-9 w-9 items-center justify-center overflow-visible rounded-full">
          <img
            src="/credits-coin.png?v=coin-safe-20260929-1"
            alt="Créditos Scoutly"
            width={30}
            height={30}
            className="block h-[30px] w-[30px] max-w-none translate-x-[1px] scale-[0.88] object-contain drop-shadow-[0_3px_8px_rgba(75,22,0,0.32)]"
            draggable={false}
          />
        </span>
      </span>
      <span className="relative z-10 min-w-0">
        <span className="block whitespace-nowrap text-[11px] font-semibold leading-none text-stone-100">{primary}</span>
        <span className="mt-1.5 block whitespace-nowrap text-[9px] leading-none text-stone-500">{secondary}</span>
      </span>
    </button>
  );
}
