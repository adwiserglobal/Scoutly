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

  const isDeveloper = Boolean((access as CreditAccessStatus & { isDeveloper?: boolean }).isDeveloper);
  // What the coin shows: the number of credits left, or "Ilimitados"
  const amount = access.isUnlimited
    ? 'Ilimitados'
    : String(access.plan === 'go' ? access.monthlyRemaining ?? 0 : access.remaining ?? 0);
  const unit = access.isUnlimited ? '' : access.plan === 'go' ? 'no mês' : 'hoje';
  const detail = access.isUnlimited
    ? `Créditos ilimitados${isDeveloper ? ' · Scoutly Developers' : access.plan === 'agency' ? ' · Agency' : ' · Pro'}`
    : access.plan === 'go'
      ? `${amount} créditos neste mês. Seus créditos resetam a 00:00 UTC`
      : `${amount} créditos hoje. Seus créditos resetam a 00:00 UTC`;
  const primary = access.isUnlimited ? 'Ilimitados' : `${amount} créditos`;
  const secondary = detail;

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
      data-credit-pill
      onClick={handleClick}
      className={`fixed right-[78px] top-[22px] z-[30] flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-1.5 text-left pointer-events-auto xl:right-[104px] ${clickable ? 'cursor-pointer transition active:scale-95' : 'cursor-default'}`}
      title={access.plan === 'free' && !access.isUnlimited ? 'Free: 5 créditos por dia, limitado a 25 por mês' : detail}
      aria-label={`${primary}. ${secondary}`}
    >
      <img
        src="/credits-coin-3d.webp?v=2"
        alt=""
        width={28}
        height={28}
        className={`block h-[28px] w-[28px] shrink-0 object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.55)] ${clickable ? 'transition-transform hover:scale-110 hover:-rotate-6' : ''}`}
        draggable={false}
      />
      <span className={`whitespace-nowrap leading-none [text-shadow:0_1px_2px_rgba(0,0,0,0.9),0_0_10px_rgba(0,0,0,0.6)] ${access.isUnlimited ? 'text-[12px] font-bold tracking-tight text-white' : exhausted ? 'text-[16px] font-extrabold tabular-nums text-rose-300' : 'text-[16px] font-extrabold tabular-nums text-white'}`}>
        {amount}
        {unit && <span className="ml-1 text-[10px] font-semibold uppercase tracking-wide text-white/70">{unit}</span>}
      </span>
    </button>
  );
}
