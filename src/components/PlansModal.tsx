import { useEffect, useMemo, useState } from 'react';
import { Check, Clock3, X } from 'lucide-react';
import { BillingStatus, formatBRL, SCOUTLY_PLANS } from '../lib/billing';
import { CreditAccessStatus, createBillingPortalSession, createCheckoutSession } from '../services/api';

interface PlansModalProps {
  open: boolean;
  billing: BillingStatus;
  onClose: () => void;
  onSignOut?: () => Promise<void> | void;
  forceOpen?: boolean;
}

type PlanId = 'go' | 'pro' | 'agency';
type CreditExhaustedDetail = {
  code?: 'DAILY_CREDIT_LIMIT' | 'MONTHLY_CREDIT_LIMIT' | string;
  access?: CreditAccessStatus | null;
};

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-[11px] leading-[1.35] text-stone-400">
      <Check className="mt-[1px] h-3.5 w-3.5 shrink-0 text-[#FF6A26]" />
      <span>{children}</span>
    </div>
  );
}

function formatResetDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export default function PlansModal({ open, billing, onClose, onSignOut, forceOpen = false }: PlansModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null);
  const [checkoutError, setCheckoutError] = useState('');
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);
  const [creditExhausted, setCreditExhausted] = useState<CreditExhaustedDetail | null>(null);

  useEffect(() => {
    const showPlans = () => {
      setCreditExhausted(null);
      setEventOpen(true);
    };
    const showCredits = (event: Event) => {
      const detail = (event as CustomEvent<CreditExhaustedDetail>).detail || {};
      setCreditExhausted(detail);
      setEventOpen(true);
    };

    window.addEventListener('scoutly-open-plans', showPlans);
    window.addEventListener('scoutly-credits-exhausted', showCredits);
    return () => {
      window.removeEventListener('scoutly-open-plans', showPlans);
      window.removeEventListener('scoutly-credits-exhausted', showCredits);
    };
  }, []);

  const visible = open || eventOpen;
  const isMonthlyExhausted = creditExhausted?.code === 'MONTHLY_CREDIT_LIMIT';
  const resetAt = useMemo(() => {
    if (!creditExhausted) return null;
    const value = isMonthlyExhausted
      ? creditExhausted.access?.monthlyResetsAt
      : creditExhausted.access?.resetsAt;
    return formatResetDate(value);
  }, [creditExhausted, isMonthlyExhausted]);

  if (!visible) return null;

  const close = () => {
    setEventOpen(false);
    setCreditExhausted(null);
    if (!forceOpen) onClose();
  };

  const isPaid = Boolean(billing.paidPlanId);
  const isActivePaid = isPaid && !billing.isExpired;

  const handleSelectPlan = async (plan: PlanId) => {
    if (isRedirecting) return;
    if (isActivePaid && billing.paidPlanId === plan) return;
    setSelectedPlan(plan);
    setCheckoutError('');
    setIsRedirecting(true);

    try {
      if (isPaid) {
        const portal = await createBillingPortalSession(plan);
        window.location.assign(portal.url);
        return;
      }
      localStorage.setItem('scoutly_pending_plan', plan);
      const checkout = await createCheckoutSession(plan);
      window.location.assign(checkout.url);
    } catch (error: any) {
      setCheckoutError(error?.message || 'Não foi possível abrir a cobrança.');
      setIsRedirecting(false);
    }
  };

  const buttonLabel = (plan: PlanId) => {
    if (isActivePaid && billing.paidPlanId === plan) return 'Plano atual';
    if (isRedirecting && selectedPlan === plan) return isPaid ? 'Abrindo portal…' : 'Abrindo checkout…';
    return isPaid ? 'Alterar plano' : `Escolher ${SCOUTLY_PLANS[plan].name}`;
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/72 p-3 backdrop-blur-[8px] pointer-events-auto">
      <div className="max-h-[calc(100dvh-24px)] w-full max-w-5xl overflow-y-auto rounded-[24px] border border-white/[0.09] bg-[#0b0e11] shadow-[0_30px_100px_rgba(0,0,0,0.64)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] bg-[#0b0e11]/98 px-5 py-4 backdrop-blur-2xl md:px-6">
          <div className="flex min-w-0 items-start gap-3.5">
            {creditExhausted ? (
              <img src="/credits-coin.png?v=3" alt="" className="mt-0.5 h-10 w-10 shrink-0 object-contain" draggable={false} />
            ) : (
              <div className="mt-1 h-[3px] w-10 shrink-0 rounded-full bg-[#FF5A12]" />
            )}
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-white md:text-[22px]">
                {creditExhausted ? 'Você está sem créditos' : 'Escolha o plano ideal'}
              </h2>
              {creditExhausted ? (
                <>
                  <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-stone-400">
                    {isMonthlyExhausted
                      ? 'Você atingiu o limite de 25 créditos do plano Free neste mês.'
                      : 'Você usou os 5 créditos gratuitos disponíveis para hoje.'}
                  </p>
                  <div className="mt-2 inline-flex items-center gap-2 rounded-xl border border-[#FF5A12]/20 bg-[#FF5A12]/[0.08] px-2.5 py-1.5 text-[10px] font-medium text-[#FF9A6B]">
                    <Clock3 className="h-3.5 w-3.5" />
                    {resetAt
                      ? `Renovação em ${resetAt} no seu horário local.`
                      : isMonthlyExhausted
                        ? 'O limite mensal renova no início do próximo mês em UTC.'
                        : 'Os créditos diários renovam à meia-noite UTC.'}
                  </div>
                </>
              ) : (
                <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-stone-500">
                  Continue no Free ou faça upgrade quando precisar de mais prospecção, IA e recursos avançados.
                </p>
              )}
            </div>
          </div>

          {!forceOpen && (
            <button type="button" onClick={close} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-stone-500 hover:text-white" aria-label="Fechar planos">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="px-5 py-4 md:px-6">
          <div className="mb-3 flex flex-col gap-1.5 rounded-2xl border border-white/[0.08] bg-[#111418] px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="block text-[9px] font-medium uppercase tracking-wider text-stone-600">Seu plano atual</span>
              <span className="mt-0.5 block text-sm font-semibold text-white">{billing.planName}</span>
            </div>
            <span className="text-[10px] text-stone-500">
              {billing.plan === 'free' ? '5 créditos por dia · até 25 créditos por mês' : 'Cobrança gerenciada pela Stripe'}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <article className="flex flex-col rounded-[20px] border border-white/[0.08] bg-[#111418] p-4">
              <div><span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-stone-600">Começar</span><h3 className="mt-0.5 text-lg font-semibold text-white">Go</h3></div>
              <div className="mt-3"><span className="text-[28px] font-semibold tracking-tight text-white">{formatBRL(SCOUTLY_PLANS.go.monthlyPrice)}</span><span className="ml-1 text-xs text-stone-600">/mês</span></div>
              <div className="mt-3 flex-1 space-y-2">
                <Feature>80 créditos de prospecção por ciclo mensal</Feature>
                <Feature>10 conversas com a Scoutly AI por dia</Feature>
                <Feature>Mapa e busca de empresas na região</Feature>
                <Feature>Recomendações inteligentes</Feature>
                <Feature>Favoritos e pipeline comercial</Feature>
                <Feature>1 crédito ao abrir os dados de um negócio</Feature>
              </div>
              <button type="button" onClick={() => handleSelectPlan('go')} disabled={isRedirecting || (isActivePaid && billing.paidPlanId === 'go')} className="mt-4 w-full rounded-xl border border-white/[0.10] bg-white/[0.04] px-4 py-2.5 text-[11px] font-semibold text-stone-200 hover:bg-white/[0.07] disabled:opacity-50">
                {buttonLabel('go')}
              </button>
            </article>

            <article className="relative flex flex-col overflow-hidden rounded-[20px] border border-[#FF5A12]/45 bg-[#131517] p-4 shadow-[0_20px_60px_rgba(255,90,18,0.08)]">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FF5A12] to-transparent" />
              <div className="flex items-start justify-between gap-3"><div><span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#FF7A3D]">Individual</span><h3 className="mt-0.5 text-lg font-semibold text-white">Pro</h3></div><span className="rounded-full border border-[#FF5A12]/20 bg-[#FF5A12]/[0.10] px-2 py-1 text-[8px] font-semibold text-[#FF7A3D]">Mais indicado</span></div>
              <div className="mt-3"><span className="text-[28px] font-semibold tracking-tight text-white">{formatBRL(SCOUTLY_PLANS.pro.monthlyPrice)}</span><span className="ml-1 text-xs text-stone-600">/mês</span></div>
              <div className="mt-3 flex-1 space-y-2">
                <Feature>Prospecção sem limite de créditos</Feature>
                <Feature>Scoutly AI sem limite diário</Feature>
                <Feature>Recomendações inteligentes</Feature>
                <Feature>Tracking, PageSpeed e sinais digitais</Feature>
                <Feature>Mensagens de prospecção com IA</Feature>
                <Feature>Favoritos e pipeline comercial</Feature>
              </div>
              <button type="button" onClick={() => handleSelectPlan('pro')} disabled={isRedirecting || (isActivePaid && billing.paidPlanId === 'pro')} className="mt-4 w-full rounded-xl bg-[#FF5A12] px-4 py-2.5 text-[11px] font-semibold text-white hover:bg-[#ff6a27] disabled:opacity-50">
                {buttonLabel('pro')}
              </button>
            </article>

            <article className="flex flex-col rounded-[20px] border border-white/[0.08] bg-[#111418] p-4">
              <div><span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-stone-600">Equipes</span><h3 className="mt-0.5 text-lg font-semibold text-white">Agency</h3></div>
              <div className="mt-3"><span className="text-[28px] font-semibold tracking-tight text-white">{formatBRL(SCOUTLY_PLANS.agency.monthlyPrice)}</span><span className="ml-1 text-xs text-stone-600">/mês</span></div>
              <div className="mt-3 flex-1 space-y-2">
                <Feature>Tudo do Pro</Feature>
                <Feature>5 usuários incluídos</Feature>
                <Feature>Prospecção e IA sem os limites do Go</Feature>
                <Feature>Workspace preparado para operação em equipe</Feature>
                <Feature>{formatBRL(SCOUTLY_PLANS.agency.additionalSeatPrice || 0)} por usuário adicional</Feature>
              </div>
              <button type="button" onClick={() => handleSelectPlan('agency')} disabled={isRedirecting || (isActivePaid && billing.paidPlanId === 'agency')} className="mt-4 w-full rounded-xl border border-white/[0.10] bg-white/[0.04] px-4 py-2.5 text-[11px] font-semibold text-stone-200 hover:border-[#FF5A12]/30 hover:bg-[#FF5A12]/[0.07] disabled:opacity-50">
                {buttonLabel('agency')}
              </button>
            </article>
          </div>

          {checkoutError && <div className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/[0.08] px-3 py-2.5 text-[10px] font-medium text-rose-300">{checkoutError}</div>}

          <div className="mt-3 flex flex-col items-center gap-1.5 border-t border-white/[0.06] pt-3">
            <p className="text-center text-[9px] text-stone-600">O plano Free permanece disponível sem cartão. Créditos gratuitos renovam à meia-noite UTC e respeitam o limite mensal.</p>
            {forceOpen && onSignOut && <button type="button" onClick={() => onSignOut()} className="text-[9px] font-medium text-stone-500 underline underline-offset-4 hover:text-white">Sair da conta</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
