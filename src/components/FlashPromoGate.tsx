import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Clock3, Sparkles, X, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SCOUTLY_PLANS } from '../lib/billing';
import {
  createFlashPromoCheckout,
  fetchFlashPromoStatus,
  type FlashPromoStatus,
} from '../services/flashPromoApi';

const HOME_PATH = '/dashboard';
const FLASH_DURATION_SECONDS = 12 * 60 * 60;
const REVEAL_DELAY_SECONDS = 3;

function currentPath() {
  return window.location.pathname.replace(/\/+$/, '') || '/';
}

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });
}

function splitCountdown(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  return {
    hours: Math.floor(safe / 3600),
    minutes: Math.floor((safe % 3600) / 60),
    seconds: safe % 60,
  };
}

function twoDigits(value: number) {
  return String(value).padStart(2, '0');
}

export default function FlashPromoGate() {
  const { user } = useAuth();
  const [pathname, setPathname] = useState(currentPath);
  const [promo, setPromo] = useState<FlashPromoStatus | null>(null);
  const [deadlineAt, setDeadlineAt] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [offerIdentity, setOfferIdentity] = useState('');
  const [isOpeningCheckout, setIsOpeningCheckout] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  const refresh = useCallback(async () => {
    if (!user || currentPath() !== HOME_PATH) return;

    try {
      const next = await fetchFlashPromoStatus();
      setPromo(next);

      if (!next.active || next.remainingSeconds <= 0) {
        setDeadlineAt(null);
        setRemainingSeconds(0);
        setVisible(false);
        return;
      }

      const nextIdentity = next.startsAt || next.expiresAt || 'flash';
      setOfferIdentity((current) => {
        if (current !== nextIdentity) setDismissed(false);
        return nextIdentity;
      });
      setRemainingSeconds(next.remainingSeconds);
      setDeadlineAt(Date.now() + next.remainingSeconds * 1000);
    } catch (error) {
      console.warn('[Scoutly Flash Promo] Could not refresh offer:', error);
    }
  }, [user?.uid]);

  useEffect(() => {
    const syncPath = () => {
      const next = currentPath();
      setPathname(next);
      if (next !== HOME_PATH) setVisible(false);
    };
    window.addEventListener('popstate', syncPath);
    return () => window.removeEventListener('popstate', syncPath);
  }, []);

  useEffect(() => {
    if (!user || pathname !== HOME_PATH) {
      setPromo(null);
      setVisible(false);
      return;
    }

    void refresh();

    const onAccessUpdated = (event: Event) => {
      const access = (event as CustomEvent<any>).detail;
      if (!access || (access.isFree && Number(access.monthlyUsed) === 5)) {
        void refresh();
      }
    };
    const onFocus = () => void refresh();

    window.addEventListener('scoutly-access-updated', onAccessUpdated);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('scoutly-access-updated', onAccessUpdated);
      window.removeEventListener('focus', onFocus);
    };
  }, [pathname, refresh, user?.uid]);

  useEffect(() => {
    if (!promo?.active || !deadlineAt || pathname !== HOME_PATH) return;

    const tick = () => {
      const nextRemaining = Math.max(0, Math.ceil((deadlineAt - Date.now()) / 1000));
      setRemainingSeconds(nextRemaining);
      if (nextRemaining <= 0) {
        setVisible(false);
        setPromo((current) => current ? { ...current, active: false, eligible: false, remainingSeconds: 0, reason: 'expired' } : current);
      }
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [deadlineAt, pathname, promo?.active]);

  useEffect(() => {
    if (!promo?.active || dismissed || pathname !== HOME_PATH) {
      if (dismissed) setVisible(false);
      return;
    }

    const elapsed = Math.max(0, FLASH_DURATION_SECONDS - promo.remainingSeconds);
    const revealDelayMs = Math.max(0, REVEAL_DELAY_SECONDS - elapsed) * 1000;
    const timer = window.setTimeout(() => setVisible(true), revealDelayMs);
    return () => window.clearTimeout(timer);
  }, [dismissed, offerIdentity, pathname, promo?.active, promo?.remainingSeconds]);

  const countdown = useMemo(() => splitCountdown(remainingSeconds), [remainingSeconds]);
  const regularPrice = SCOUTLY_PLANS.pro.monthlyPrice;
  const offerPrice = (promo?.offerPriceCents || 3599) / 100;

  const openCheckout = async () => {
    if (isOpeningCheckout || remainingSeconds <= 0) return;
    setIsOpeningCheckout(true);
    setCheckoutError('');
    try {
      const checkout = await createFlashPromoCheckout();
      window.location.assign(checkout.url);
    } catch (error: any) {
      setCheckoutError(error?.message || 'Não foi possível abrir o checkout da promoção.');
      setIsOpeningCheckout(false);
      if (error?.code === 'FLASH_PROMO_UNAVAILABLE') {
        setVisible(false);
        void refresh();
      }
    }
  };

  if (!user || pathname !== HOME_PATH || !promo?.active || !visible || remainingSeconds <= 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-md">
      <div className="relative w-full max-w-[560px] overflow-hidden rounded-[28px] border border-[#FF5A12]/30 bg-[#0d1013] text-white shadow-[0_34px_120px_rgba(0,0,0,0.72)]">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#FF5A12]/20 blur-[80px]" />
        <div className="pointer-events-none absolute -bottom-28 -left-24 h-64 w-64 rounded-full bg-orange-500/10 blur-[90px]" />

        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            setVisible(false);
          }}
          className="absolute right-5 top-5 z-20 flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-stone-500 transition hover:bg-white/[0.07] hover:text-white"
          aria-label="Fechar Flash Promo"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative z-10 px-6 pb-7 pt-7 sm:px-8 sm:pb-8 sm:pt-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#FF5A12]/25 bg-[#FF5A12]/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#FF7A3D]">
            <Zap className="h-3.5 w-3.5 fill-current" />
            Scoutly Flash Promo
          </div>

          <div className="mt-5 max-w-[440px]">
            <h2 className="text-[29px] font-semibold leading-[1.08] tracking-[-0.035em] text-white sm:text-[34px]">
              Você liberou uma oferta única do Pro.
            </h2>
            <p className="mt-3 text-sm leading-6 text-stone-400">
              Seus 5 primeiros créditos acabaram. Por tempo limitado, seu primeiro mês de Scoutly Pro sai por um preço especial.
            </p>
          </div>

          <div className="mt-6 rounded-[22px] border border-white/[0.08] bg-white/[0.035] p-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-stone-500">
                  <span className="line-through">{formatBRL(regularPrice)}</span>
                  <span className="rounded-md bg-[#FF5A12]/10 px-2 py-1 text-[10px] font-semibold text-[#FF7A3D]">1º mês</span>
                </div>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="text-[38px] font-semibold tracking-[-0.045em] text-white">{formatBRL(offerPrice)}</span>
                </div>
                <p className="mt-1 text-[11px] text-stone-500">Depois, o Pro volta ao preço normal mensal.</p>
              </div>

              <div className="flex items-center gap-2 text-xs font-medium text-stone-400">
                <Sparkles className="h-4 w-4 text-[#FF6A26]" />
                Oferta de primeira compra
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2.5 flex items-center gap-2 text-[11px] font-medium text-stone-500">
              <Clock3 className="h-3.5 w-3.5" />
              Esta oferta desaparece em
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2">
              {[
                ['HORAS', countdown.hours],
                ['MIN', countdown.minutes],
                ['SEG', countdown.seconds],
              ].map(([label, value], index) => (
                <div key={String(label)} className="contents">
                  <div className="rounded-2xl border border-white/[0.08] bg-[#090b0e] px-3 py-3 text-center">
                    <div className="font-mono text-2xl font-semibold tracking-[-0.03em] text-white">{twoDigits(Number(value))}</div>
                    <div className="mt-1 text-[8px] font-semibold tracking-[0.14em] text-stone-600">{label}</div>
                  </div>
                  {index < 2 && <span className="text-center text-lg font-semibold text-stone-700">:</span>}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
            {[
              'Créditos ilimitados para prospectar',
              'Scoutly AI e recomendações liberadas',
              'Contatos e dados completos',
              'Filtros avançados do Pro',
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 text-[11px] text-stone-400">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                  <Check className="h-3 w-3" />
                </span>
                {item}
              </div>
            ))}
          </div>

          {checkoutError && (
            <div className="mt-5 rounded-xl border border-rose-500/20 bg-rose-500/[0.07] px-3.5 py-3 text-xs text-rose-300">
              {checkoutError}
            </div>
          )}

          <button
            type="button"
            onClick={openCheckout}
            disabled={isOpeningCheckout || remainingSeconds <= 0}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF762E] to-[#FF3D00] px-5 py-4 text-sm font-semibold text-white shadow-[0_14px_36px_rgba(255,79,9,0.24)] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
          >
            <Zap className="h-4 w-4 fill-current" />
            {isOpeningCheckout ? 'Abrindo checkout...' : `Ativar Pro por ${formatBRL(offerPrice)}`}
          </button>

          <p className="mx-auto mt-3 max-w-[470px] text-center text-[9px] leading-4 text-stone-600">
            Oferta válida por 12 horas, apenas para a primeira assinatura do Scoutly Pro e somente no primeiro mês. A partir do 2º mês, a assinatura é renovada pelo preço normal vigente do Pro.
          </p>
        </div>
      </div>
    </div>
  );
}
