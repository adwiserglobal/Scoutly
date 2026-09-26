import { useCallback, useEffect, useState } from 'react';
import { Coins, LockKeyhole } from 'lucide-react';
import { fetchCreditState, openPlansForLockedFeature, type CreditState } from '../services/entitlements';

function creditLabel(state: CreditState) {
  const plan = String(state.plan || '').toLowerCase();
  if (plan === 'pro' || plan === 'agency' || plan === 'trial') return 'Créditos ilimitados';
  if (plan === 'free') return `${state.dailyRemaining ?? 0} de 5 hoje`;
  return `${state.monthlyRemaining ?? 0} de ${state.monthlyLimit ?? 80}`;
}

export default function CreditPill() {
  const [state, setState] = useState<CreditState | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (event?: Event) => {
    const custom = event as CustomEvent<CreditState> | undefined;
    if (custom?.detail?.plan) {
      setState(custom.detail);
      setLoading(false);
      return;
    }

    try {
      const next = await fetchCreditState();
      setState(next);
    } catch {
      // Header should never block the app if credits are temporarily unavailable.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const listener = (event: Event) => void refresh(event);
    window.addEventListener('scoutly-entitlements-changed', listener);
    window.addEventListener('focus', listener);
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => {
      window.removeEventListener('scoutly-entitlements-changed', listener);
      window.removeEventListener('focus', listener);
      window.clearInterval(timer);
    };
  }, [refresh]);

  if (loading && !state) {
    return (
      <div className="flex h-[38px] items-center gap-2 rounded-xl border border-white/10 bg-[#111418]/95 px-3 text-[10px] font-semibold text-stone-400 shadow-[0_12px_34px_rgba(0,0,0,.28)] backdrop-blur-xl">
        <Coins className="h-3.5 w-3.5 text-[#FF6A26]" /> Créditos
      </div>
    );
  }

  if (!state) return null;
  const limited = state.monthlyLimit !== null;
  const exhausted = limited && (state.monthlyRemaining ?? 0) <= 0;
  const dailyExhausted = state.dailyLimit !== null && (state.dailyRemaining ?? 0) <= 0;

  return (
    <button
      type="button"
      onClick={() => openPlansForLockedFeature('credits_header')}
      className={`flex h-[38px] items-center gap-2 rounded-xl border px-3 text-left shadow-[0_12px_34px_rgba(0,0,0,.28)] backdrop-blur-xl transition ${
        exhausted || dailyExhausted
          ? 'border-[#FF5A12]/35 bg-[#1b1512]/95 text-[#FF8A52] hover:bg-[#211711]'
          : 'border-white/10 bg-[#111418]/95 text-stone-200 hover:border-[#FF5A12]/30 hover:bg-[#171a1f]'
      }`}
      title={state.plan === 'free'
        ? `${state.monthlyUsed}/${state.monthlyLimit} créditos usados neste mês. Renovação diária à meia-noite UTC.`
        : state.monthlyLimit
          ? `${state.monthlyUsed}/${state.monthlyLimit} créditos usados no período.`
          : 'Plano com prospecção ilimitada.'}
    >
      {exhausted || dailyExhausted ? <LockKeyhole className="h-3.5 w-3.5" /> : <Coins className="h-3.5 w-3.5 text-[#FF6A26]" />}
      <div className="leading-none">
        <span className="block text-[9px] font-medium uppercase tracking-[0.08em] text-stone-500">Prospecção</span>
        <span className="mt-1 block text-[10px] font-semibold">{creditLabel(state)}</span>
      </div>
    </button>
  );
}
