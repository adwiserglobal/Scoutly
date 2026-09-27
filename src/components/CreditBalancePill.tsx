import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { CreditAccessStatus, fetchAccessStatus } from '../services/api';

function currentPath() {
  return window.location.pathname.replace(/\/+$/, '') || '/';
}

const PRODUCT_PATHS = new Set(['/dashboard', '/favoritos', '/pipeline', '/configuracoes']);

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

  if (!user || !PRODUCT_PATHS.has(pathname) || !access) return null;

  let primary = 'Créditos';
  let secondary = '';

  if (access.isUnlimited) {
    primary = 'Ilimitados';
    secondary = access.plan === 'agency' ? 'Agency' : 'Pro';
  } else if (access.plan === 'go') {
    primary = `${access.monthlyRemaining ?? 0} créditos`;
    secondary = `${access.monthlyUsed}/80 usados neste ciclo`;
  } else {
    primary = `${access.remaining ?? 0} créditos hoje`;
    secondary = `${access.dailyUsed}/5 hoje · ${access.monthlyUsed}/25 no mês`;
  }

  const clickable = !access.isUnlimited;

  return (
    <button
      type="button"
      onClick={() => clickable && window.dispatchEvent(new CustomEvent('scoutly-open-plans'))}
      className={`fixed right-4 top-[74px] z-[69] flex min-h-[44px] items-center gap-2.5 rounded-2xl border border-white/[0.11] bg-[#111418]/[0.96] px-3 pr-3.5 text-left text-white shadow-[0_12px_34px_rgba(0,0,0,0.34)] backdrop-blur-2xl pointer-events-auto ${clickable ? 'transition hover:border-[#FF5A12]/40 hover:bg-[#171a1f]' : 'cursor-default'}`}
      title={access.plan === 'free' ? 'Free: 5 créditos por dia, limitado a 25 por mês' : undefined}
      aria-label={`${primary}. ${secondary}`}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl">
        <img src="/credits-coin.png" alt="" className="h-8 w-8 object-contain" draggable={false} />
      </span>
      <span className="min-w-0">
        <span className="block whitespace-nowrap text-[11px] font-semibold leading-none text-stone-100">{primary}</span>
        <span className="mt-1.5 block whitespace-nowrap text-[9px] leading-none text-stone-500">{secondary}</span>
      </span>
    </button>
  );
}
