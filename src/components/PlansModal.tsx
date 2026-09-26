import { useState } from 'react';
import { LockKeyhole, X } from 'lucide-react';
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
    <div className="flex items-start gap-2 text-[11px] leading-relaxed text-stone-400">
      <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF5A12]" />
      <span>{children}</span>
    </div>
  );
}

export default function PlansModal({
  open,
  billing,
  onClose,
  onSignOut,
  forceOpen = false,
}: PlansModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null);
  const [checkoutError, setCheckoutError] = useState('');
  const [isRedirecting, setIsRedirecting] = useState(false);

  if (!open) return null;

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
      setCheckoutError(
        error?.message ||
          (isPaid
            ? 'Não foi possível abrir o portal de cobrança.'
            : 'Não foi possível abrir o checkout.')
      );
      setIsRedirecting(false);
    }
  };

  const buttonLabel = (plan: PlanId, fallback: string) => {
    if (isActivePaid && billing.paidPlanId === plan) return 'Plano atual';
    if (isRedirecting && selectedPlan === plan) {
      return isPaid ? 'Abrindo portal...' : 'Abrindo checkout...';
    }
    return isPaid ? 'Alterar plano' : fallback;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-[7px]">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[28px] border border-white/[0.09] bg-[#090c10] shadow-[0_28px_100px_rgba(0,0,0,0.62)]">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/[0.08] bg-[#090c10]/95 px-6 py-6 backdrop-blur-2xl md:px-8">
          <div>
            <div className="mb-3 h-[3px] w-12 rounded-full bg-[#FF5A12]" />
            <h2 className="text-2xl font-semibold tracking-tight text-white">Planos Scoutly</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-500">
              O Free continua disponível. Faça upgrade quando precisar de mais créditos, Scoutly AI e recursos avançados de prospecção.
            </p>
          </div>

          {!forceOpen && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-stone-500 transition hover:bg-white/[0.06] hover:text-white"
              aria-label="Fechar planos"
              title="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="px-6 py-6 md:px-8">
          <div className="mb-5 grid gap-3 md:grid-cols-[1.2fr_.8fr]">
            <div className="rounded-2xl border border-white/[0.08] bg-[#111418] px-4 py-3.5">
              <span className="block text-[10px] font-medium uppercase tracking-wider text-stone-600">Seu acesso atual</span>
              <span className="mt-1 block text-sm font-semibold text-white">
                {billing.isTrial
                  ? `Teste legado · ${billing.daysRemaining} ${billing.daysRemaining === 1 ? 'dia restante' : 'dias restantes'}`
                  : billing.plan === 'free'
                    ? 'Free'
                    : `${billing.planName} · assinatura ativa`}
              </span>
              <p className="mt-1 text-[10px] text-stone-500">
                {billing.plan === 'free'
                  ? '5 créditos por dia, até 25 por mês. Pipeline e favoritos incluídos.'
                  : billing.cancelAtPeriodEnd
                    ? 'Cancelamento agendado no fim do ciclo.'
                    : 'Cobrança gerenciada com segurança pela Stripe.'}
              </p>
            </div>

            <div className="rounded-2xl border border-[#FF5A12]/20 bg-[#FF5A12]/[0.055] px-4 py-3.5">
              <div className="flex items-center gap-2 text-[#FF7A3D]"><LockKeyhole className="h-3.5 w-3.5" /><span className="text-[10px] font-semibold uppercase tracking-wider">Free</span></div>
              <p className="mt-2 text-[11px] leading-relaxed text-stone-400">Sem Scoutly AI e sem recomendações inteligentes. Dados de prospecção são liberados por crédito.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <article className="flex flex-col rounded-[24px] border border-white/[0.08] bg-[#111418] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
              <div><span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-600">Começar</span><h3 className="mt-1 text-xl font-semibold text-white">Go</h3></div>
              <div className="mt-5"><span className="text-3xl font-semibold tracking-tight text-white">{formatBRL(SCOUTLY_PLANS.go.monthlyPrice)}</span><span className="ml-1 text-sm text-stone-600">/mês</span></div>
              <p className="mt-1 text-[11px] text-stone-500">Para prospecção individual recorrente</p>
              <div className="mt-5 flex-1 space-y-2.5">
                <Feature>1 usuário</Feature>
                <Feature>Mapa e busca de empresas</Feature>
                <Feature><strong className="font-semibold text-stone-200">80 créditos</strong> de prospecção por mês</Feature>
                <Feature>1 crédito por negócio desbloqueado</Feature>
                <Feature>Pipeline e favoritos</Feature>
                <Feature><strong className="font-semibold text-stone-200">10 conversas com a Scoutly AI por dia</strong></Feature>
                <Feature>Filtros essenciais</Feature>
              </div>
              <button type="button" onClick={() => handleSelectPlan('go')} disabled={isRedirecting || (isActivePaid && billing.paidPlanId === 'go')} className="mt-6 w-full rounded-xl border border-white/[0.10] bg-white/[0.04] px-4 py-3 text-xs font-semibold text-stone-200 transition hover:border-white/[0.16] hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-50">{buttonLabel('go', 'Escolher Go')}</button>
            </article>

            <article className="relative flex flex-col overflow-hidden rounded-[24px] border border-[#FF5A12]/45 bg-[#131517] p-5 shadow-[0_20px_60px_rgba(255,90,18,0.08)]">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FF5A12] to-transparent" />
              <div className="flex items-start justify-between gap-3"><div><span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#FF7A3D]">Individual</span><h3 className="mt-1 text-xl font-semibold text-white">Pro</h3></div><span className="rounded-full border border-[#FF5A12]/20 bg-[#FF5A12]/[0.10] px-2.5 py-1 text-[9px] font-semibold text-[#FF7A3D]">Mais indicado</span></div>
              <div className="mt-5"><span className="text-3xl font-semibold tracking-tight text-white">{formatBRL(SCOUTLY_PLANS.pro.monthlyPrice)}</span><span className="ml-1 text-sm text-stone-600">/mês</span></div>
              <div className="mt-5 flex-1 space-y-2.5">
                <Feature>1 usuário</Feature>
                <Feature>Prospecção sem limite de créditos</Feature>
                <Feature>Mapa, busca e filtros avançados</Feature>
                <Feature>Enriquecimento de contatos públicos</Feature>
                <Feature>Tracking, PageSpeed e sinais digitais</Feature>
                <Feature>Scoutly AI e recomendações inteligentes</Feature>
                <Feature>Favoritos e pipeline comercial</Feature>
              </div>
              <button type="button" onClick={() => handleSelectPlan('pro')} disabled={isRedirecting || (isActivePaid && billing.paidPlanId === 'pro')} className="mt-6 w-full rounded-xl bg-[#FF5A12] px-4 py-3 text-xs font-semibold text-white transition hover:bg-[#ff6a27] disabled:cursor-not-allowed disabled:opacity-50">{buttonLabel('pro', 'Escolher Pro')}</button>
            </article>

            <article className="flex flex-col rounded-[24px] border border-white/[0.08] bg-[#111418] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
              <div><span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-600">Equipes</span><h3 className="mt-1 text-xl font-semibold text-white">Agency</h3></div>
              <div className="mt-5"><span className="text-3xl font-semibold tracking-tight text-white">{formatBRL(SCOUTLY_PLANS.agency.monthlyPrice)}</span><span className="ml-1 text-sm text-stone-600">/mês</span></div>
              <p className="mt-1 text-[11px] text-stone-500">Até 5 usuários incluídos</p>
              <div className="mt-5 flex-1 space-y-2.5">
                <Feature>Tudo do Pro</Feature>
                <Feature>5 usuários incluídos</Feature>
                <Feature>{formatBRL(SCOUTLY_PLANS.agency.additionalSeatPrice)} por usuário adicional</Feature>
                <Feature>Prospecção e IA sem os limites do Go</Feature>
                <Feature>Estrutura preparada para operação em equipe</Feature>
              </div>
              <button type="button" onClick={() => handleSelectPlan('agency')} disabled={isRedirecting || (isActivePaid && billing.paidPlanId === 'agency')} className="mt-6 w-full rounded-xl border border-white/[0.10] bg-white/[0.04] px-4 py-3 text-xs font-semibold text-stone-200 transition hover:border-[#FF5A12]/30 hover:bg-[#FF5A12]/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-50">{buttonLabel('agency', 'Escolher Agency')}</button>
            </article>
          </div>

          {checkoutError && <div className="mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/[0.08] px-4 py-3 text-[11px] font-medium text-rose-300">{checkoutError}</div>}

          {selectedPlan && isRedirecting && (
            <div className="mt-5 rounded-2xl border border-white/[0.08] bg-[#111418] px-4 py-3.5">
              <span className="block text-xs font-semibold text-white">{isPaid ? 'Abrindo portal seguro' : 'Preparando checkout seguro'}</span>
              <p className="mt-1 text-[11px] leading-relaxed text-stone-500">{isPaid ? 'Você será redirecionado para a Stripe para alterar sua assinatura.' : 'Você será redirecionado para a Stripe para concluir a assinatura.'}</p>
            </div>
          )}

          <div className="mt-5 flex flex-col items-center gap-2 border-t border-white/[0.06] pt-5">
            <p className="text-center text-[10px] text-stone-600">O plano Free permanece disponível mesmo sem assinatura paga.</p>
            {forceOpen && onSignOut && <button type="button" onClick={() => onSignOut()} className="text-[10px] font-medium text-stone-500 underline underline-offset-4 transition hover:text-white">Sair da conta</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
