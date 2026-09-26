import { useCallback, useEffect, useState } from 'react';
import { Coins } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CreditAccessStatus, fetchAccessStatus } from '../services/api';

const PRODUCT_PATHS = new Set(['/dashboard', '/favoritos', '/pipeline', '/configuracoes']);

function currentPath() {
  return window.location.pathname.replace(/\/+$/, '') || '/';
}

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
    primary = 'Créditos ilimitados';
    secondary = access.plan === 'agency' ? 'Agency' : 'Pro';
  } else if (access.plan === 'go') {
    primary = `${access.monthlyRemaining ?? 0} créditos`;
    secondary = `${access.monthlyUsed}/80 usados no ciclo`;
  } else {
    primary = `${access.remaining ?? 0} créditos hoje`;
    secondary = `${access.monthlyUsed}/25 usados no mês`;
  }

  const clickable = !access.isUnlimited;
  return (
    <button
      type="button"
      onClick={() => clickable && window.dispatchEvent(new CustomEvent('scoutly-open-plans'))}
      className={`fixed right-4 top-[72px] z-[68] flex h-[42px] items-center gap-2.5 rounded-2xl border border-white/[0.10] bg-[#111418]/[0.95] px-3 text-left text-white shadow-[0_12px_34px_rgba(0,0,0,0.30)] backdrop-blur-2xl pointer-events-auto sm:right-[78px] sm:top-4 ${clickable ? 'transition hover:border-[#FF5A12]/35 hover:bg-[#171a1f]' : 'cursor-default'}`}
      title={access.plan === 'free' ? 'Free: 5 créditos por dia, limitado a 25 por mês' : undefined}
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-xl border border-[#FF5A12]/20 bg-[#FF5A12]/[0.10] text-[#FF6A26]">
        <Coins className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0">
        <span className="block whitespace-nowrap text-[11px] font-semibold leading-none text-stone-100">{primary}</span>
        <span className="mt-1 block whitespace-nowrap text-[9px] leading-none text-stone-500">{secondary}</span>
      </span>
    </button>
  );
}
