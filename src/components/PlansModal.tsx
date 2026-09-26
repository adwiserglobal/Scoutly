import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { BillingStatus, formatBRL, SCOUTLY_PLANS } from '../lib/billing';
import { createBillingPortalSession, createCheckoutSession } from '../services/api';

interface PlansModalProps {
  open: boolean;
  billing: BillingStatus;
  onClose: () => void;
  onSignOut?: () => Promise<void> | void;
  forceOpen?: boolean;
}

type PlanId = 'go' | 'pro' | 'agency';

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-[12px] leading-relaxed text-stone-400">
      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FF6A26]" />
      <span>{children}</span>
    </div>
  );
}

export default function PlansModal({ open, billing, onClose, onSignOut, forceOpen = false }: PlansModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null);
  const [checkoutError, setCheckoutError] = useState('');
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);

  useEffect(() => {
    const show = () => setEventOpen(true);
    window.addEventListener('scoutly-open-plans', show);
    return () => window.removeEventListener('scoutly-open-plans', show);
  }, []);

  const visible = open || eventOpen;
  if (!visible) return null;

  const close = () => {
    setEventOpen(false);
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
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/72 px-4 py-6 backdrop-blur-[8px] pointer-events-auto">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[26px] border border-white/[0.09] bg-[#0b0e11] shadow-[0_30px_100px_rgba(0,0,0,0.64)]">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/[0.08] bg-[#0b0e11]/95 px-6 py-6 backdrop-blur-2xl md:px-8">
          <div>
            <div className="mb-3 h-[3px] w-11 rounded-full bg-[#FF5A12]" />
            <h2 className="text-2xl font-semibold tracking-tight text-white">Escolha o plano ideal</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-500">
              A Scoutly continua disponível gratuitamente. Faça upgrade quando precisar de mais prospecção, IA e recursos avançados.
            </p>
          </div>
          {!forceOpen && (
            <button type="button" onClick={close} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-stone-500 hover:text-white" aria-label="Fechar planos">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="px-6 py-6 md:px-8">
          <div className="mb-5 flex flex-col gap-2 rounded-2xl border border-white/[0.08] bg-[#111418] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="block text-[10px] font-medium uppercase tracking-wider text-stone-600">Seu plano atual</span>
              <span className="mt-1 block text-sm font-semibold text-white">{billing.planName}</span>
            </div>
            <span className="text-[11px] text-stone-500">
              {billing.plan === 'free' ? '5 créditos por dia · até 25 créditos por mês' : 'Cobrança gerenciada pela Stripe'}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <article className="flex flex-col rounded-[22px] border border-white/[0.08] bg-[#111418] p-5">
              <div><span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-600">Começar</span><h3 className="mt-1 text-xl font-semibold text-white">Go</h3></div>
              <div className="mt-5"><span className="text-3xl font-semibold tracking-tight text-white">{formatBRL(SCOUTLY_PLANS.go.monthlyPrice)}</span><span className="ml-1 text-sm text-stone-600">/mês</span></div>
              <div className="mt-5 flex-1 space-y-2.5">
                <Feature>80 créditos de prospecção por ciclo mensal</Feature>
                <Feature>10 conversas com a Scoutly AI por dia</Feature>
                <Feature>Mapa e busca de empresas na região</Feature>
                <Feature>Recomendações inteligentes</Feature>
                <Feature>Favoritos e pipeline comercial</Feature>
                <Feature>1 crédito ao abrir os dados de um negócio</Feature>
              </div>
              <button type="button" onClick={() => handleSelectPlan('go')} disabled={isRedirecting || (isActivePaid && billing.paidPlanId === 'go')} className="mt-6 w-full rounded-xl border border-white/[0.10] bg-white/[0.04] px-4 py-3 text-xs font-semibold text-stone-200 hover:bg-white/[0.07] disabled:opacity-50">
                {buttonLabel('go')}
              </button>
            </article>

            <article className="relative flex flex-col overflow-hidden rounded-[22px] border border-[#FF5A12]/45 bg-[#131517] p-5 shadow-[0_20px_60px_rgba(255,90,18,0.08)]">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FF5A12] to-transparent" />
              <div className="flex items-start justify-between gap-3"><div><span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#FF7A3D]">Individual</span><h3 className="mt-1 text-xl font-semibold text-white">Pro</h3></div><span className="rounded-full border border-[#FF5A12]/20 bg-[#FF5A12]/[0.10] px-2.5 py-1 text-[9px] font-semibold text-[#FF7A3D]">Mais indicado</span></div>
              <div className="mt-5"><span className="text-3xl font-semibold tracking-tight text-white">{formatBRL(SCOUTLY_PLANS.pro.monthlyPrice)}</span><span className="ml-1 text-sm text-stone-600">/mês</span></div>
              <div className="mt-5 flex-1 space-y-2.5">
                <Feature>Prospecção sem limite de créditos</Feature>
                <Feature>Scoutly AI sem limite diário</Feature>
                <Feature>Recomendações inteligentes</Feature>
                <Feature>Tracking, PageSpeed e sinais digitais</Feature>
                <Feature>Mensagens de prospecção com IA</Feature>
                <Feature>Favoritos e pipeline comercial</Feature>
              </div>
              <button type="button" onClick={() => handleSelectPlan('pro')} disabled={isRedirecting || (isActivePaid && billing.paidPlanId === 'pro')} className="mt-6 w-full rounded-xl bg-[#FF5A12] px-4 py-3 text-xs font-semibold text-white hover:bg-[#ff6a27] disabled:opacity-50">
                {buttonLabel('pro')}
              </button>
            </article>

            <article className="flex flex-col rounded-[22px] border border-white/[0.08] bg-[#111418] p-5">
              <div><span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-600">Equipes</span><h3 className="mt-1 text-xl font-semibold text-white">Agency</h3></div>
              <div className="mt-5"><span className="text-3xl font-semibold tracking-tight text-white">{formatBRL(SCOUTLY_PLANS.agency.monthlyPrice)}</span><span className="ml-1 text-sm text-stone-600">/mês</span></div>
              <div className="mt-5 flex-1 space-y-2.5">
                <Feature>Tudo do Pro</Feature>
                <Feature>5 usuários incluídos</Feature>
                <Feature>Prospecção e IA sem os limites do Go</Feature>
                <Feature>Workspace preparado para operação em equipe</Feature>
                <Feature>{formatBRL(SCOUTLY_PLANS.agency.additionalSeatPrice || 0)} por usuário adicional</Feature>
              </div>
              <button type="button" onClick={() => handleSelectPlan('agency')} disabled={isRedirecting || (isActivePaid && billing.paidPlanId === 'agency')} className="mt-6 w-full rounded-xl border border-white/[0.10] bg-white/[0.04] px-4 py-3 text-xs font-semibold text-stone-200 hover:border-[#FF5A12]/30 hover:bg-[#FF5A12]/[0.07] disabled:opacity-50">
                {buttonLabel('agency')}
              </button>
            </article>
          </div>

          {checkoutError && <div className="mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/[0.08] px-4 py-3 text-[11px] font-medium text-rose-300">{checkoutError}</div>}

          <div className="mt-5 flex flex-col items-center gap-2 border-t border-white/[0.06] pt-5">
            <p className="text-center text-[10px] text-stone-600">O plano Free permanece disponível sem cartão. Créditos gratuitos renovam à meia-noite UTC e respeitam o limite mensal.</p>
            {forceOpen && onSignOut && <button type="button" onClick={() => onSignOut()} className="text-[10px] font-medium text-stone-500 underline underline-offset-4 hover:text-white">Sair da conta</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
