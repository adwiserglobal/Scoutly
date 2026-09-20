import { useState } from 'react';
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
    <div className="flex items-start gap-2 text-[11px] leading-relaxed text-stone-600">
      <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF4D00]" />
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

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-[2px]">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-3xl border border-[#E7E0D8] bg-[#FAF7F2] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#E7E0D8] px-6 py-6 md:px-8">
          <div>
            <div className="mb-3 h-[3px] w-12 rounded-full bg-[#FF4D00]" />
            <h2 className="text-2xl font-semibold tracking-tight text-stone-950">
              Escolha seu plano
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-stone-500">
              {isPaid
                ? 'Compare os planos e use o portal seguro da Stripe para fazer upgrade, downgrade, atualizar o pagamento ou cancelar.'
                : 'Teste todos os recursos por 7 dias. Depois, escolha um plano para continuar usando a Scoutly.'}
            </p>
          </div>

          {!forceOpen && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-3 py-2 text-sm font-medium text-stone-400 transition hover:bg-white hover:text-stone-700"
            >
              Fechar
            </button>
          )}
        </div>

        <div className="px-6 py-6 md:px-8">
          <div className="mb-5 rounded-2xl border border-[#E7E0D8] bg-white px-4 py-3.5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="block text-[10px] font-medium uppercase tracking-wider text-stone-400">
                  Seu acesso atual
                </span>
                <span className="mt-1 block text-sm font-semibold text-stone-900">
                  {billing.isExpired
                    ? 'Seu acesso está encerrado'
                    : billing.isTrial
                      ? `Teste Pro · ${billing.daysRemaining} ${billing.daysRemaining === 1 ? 'dia restante' : 'dias restantes'}`
                      : `${billing.planName} · assinatura ativa`}
                </span>
              </div>
              <span className="text-[11px] text-stone-500">
                {billing.isTrial
                  ? 'Sem cartão durante o período de teste'
                  : billing.cancelAtPeriodEnd
                    ? 'Cancelamento agendado no fim do ciclo'
                    : 'Cobrança gerenciada com segurança pela Stripe'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <article className="rounded-3xl border border-[#E7E0D8] bg-white p-5">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">
                  Começar
                </span>
                <h3 className="mt-1 text-xl font-semibold text-stone-950">
                  Go
                </h3>
              </div>

              <div className="mt-5">
                <span className="text-3xl font-semibold tracking-tight text-stone-950">
                  {formatBRL(SCOUTLY_PLANS.go.monthlyPrice)}
                </span>
                <span className="ml-1 text-sm text-stone-400">/mês</span>
              </div>

              <p className="mt-1 text-[11px] text-stone-500">
                Para quem prospecta por conta própria
              </p>

              <div className="mt-5 space-y-2.5">
                <Feature>1 usuário</Feature>
                <Feature>Mapa e busca de empresas</Feature>
                <Feature>Até {SCOUTLY_PLANS.go.monthlyAnalysisLimit} análises por mês</Feature>
                <Feature>Contatos públicos, favoritos e pipeline</Feature>
                <Feature>Até {SCOUTLY_PLANS.go.monthlyAiMessageLimit} mensagens com IA por mês</Feature>
                <Feature>Filtros essenciais</Feature>
              </div>

              <button
                type="button"
                onClick={() => handleSelectPlan('go')}
                disabled={isRedirecting || (isActivePaid && billing.paidPlanId === 'go')}
                className="mt-6 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-xs font-semibold text-stone-900 transition hover:border-stone-300 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isActivePaid && billing.paidPlanId === 'go'
                  ? 'Plano atual'
                  : isRedirecting && selectedPlan === 'go'
                    ? isPaid ? 'Abrindo portal...' : 'Abrindo checkout...'
                    : isPaid ? 'Alterar plano' : 'Continuar com Go'}
              </button>
            </article>

            <article className="rounded-3xl border border-[#FF4D00]/50 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#D94400]">
                    Individual
                  </span>
                  <h3 className="mt-1 text-xl font-semibold text-stone-950">
                    Pro
                  </h3>
                </div>
                <span className="rounded-full bg-[#FFF1E8] px-2.5 py-1 text-[9px] font-semibold text-[#D94400]">
                  Mais indicado
                </span>
              </div>

              <div className="mt-5">
                <span className="text-3xl font-semibold tracking-tight text-stone-950">
                  {formatBRL(SCOUTLY_PLANS.pro.monthlyPrice)}
                </span>
                <span className="ml-1 text-sm text-stone-400">/mês</span>
              </div>

              <div className="mt-5 space-y-2.5">
                <Feature>1 usuário</Feature>
                <Feature>Mapa, busca e filtros avançados</Feature>
                <Feature>Enriquecimento de contatos públicos</Feature>
                <Feature>Tracking, PageSpeed e sinais digitais</Feature>
                <Feature>IA para mensagens de prospecção</Feature>
                <Feature>Favoritos e pipeline comercial</Feature>
              </div>

              <button
                type="button"
                onClick={() => handleSelectPlan('pro')}
                disabled={isRedirecting || (isActivePaid && billing.paidPlanId === 'pro')}
                className="mt-6 w-full rounded-xl bg-[#FF4D00] px-4 py-3 text-xs font-semibold text-white transition hover:bg-[#E04400] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isActivePaid && billing.paidPlanId === 'pro'
                  ? 'Plano atual'
                  : isRedirecting && selectedPlan === 'pro'
                    ? isPaid ? 'Abrindo portal...' : 'Abrindo checkout...'
                    : isPaid ? 'Alterar plano' : 'Continuar com Pro'}
              </button>
            </article>

            <article className="rounded-3xl border border-[#E7E0D8] bg-white p-5">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">
                  Equipes
                </span>
                <h3 className="mt-1 text-xl font-semibold text-stone-950">
                  Agency
                </h3>
              </div>

              <div className="mt-5">
                <span className="text-3xl font-semibold tracking-tight text-stone-950">
                  {formatBRL(SCOUTLY_PLANS.agency.monthlyPrice)}
                </span>
                <span className="ml-1 text-sm text-stone-400">/mês</span>
              </div>

              <p className="mt-1 text-[11px] text-stone-500">
                Até 5 usuários incluídos
              </p>

              <div className="mt-5 space-y-2.5">
                <Feature>Tudo do Pro</Feature>
                <Feature>5 usuários incluídos</Feature>
                <Feature>{formatBRL(SCOUTLY_PLANS.agency.additionalSeatPrice)} por usuário adicional</Feature>
                <Feature>Estrutura preparada para operação em equipe</Feature>
                <Feature>Maior capacidade para uso recorrente</Feature>
              </div>

              <button
                type="button"
                onClick={() => handleSelectPlan('agency')}
                disabled={isRedirecting || (isActivePaid && billing.paidPlanId === 'agency')}
                className="mt-6 w-full rounded-xl border border-stone-200 bg-stone-950 px-4 py-3 text-xs font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isActivePaid && billing.paidPlanId === 'agency'
                  ? 'Plano atual'
                  : isRedirecting && selectedPlan === 'agency'
                    ? isPaid ? 'Abrindo portal...' : 'Abrindo checkout...'
                    : isPaid ? 'Alterar plano' : 'Continuar com Agency'}
              </button>
            </article>
          </div>

          {checkoutError && (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[11px] font-medium text-red-700">
              {checkoutError}
            </div>
          )}

          {selectedPlan && isRedirecting && (
            <div className="mt-5 rounded-2xl border border-[#E7E0D8] bg-white px-4 py-3.5">
              <span className="block text-xs font-semibold text-stone-900">
                {isPaid ? 'Abrindo portal seguro' : 'Preparando checkout seguro'}
              </span>
              <p className="mt-1 text-[11px] leading-relaxed text-stone-500">
                {isPaid
                  ? 'Você será redirecionado para a Stripe para alterar sua assinatura.'
                  : 'Você será redirecionado para a Stripe para concluir a assinatura.'}
              </p>
            </div>
          )}

          <div className="mt-5 flex flex-col items-center gap-2">
            <p className="text-center text-[10px] text-stone-400">
              Não existe plano gratuito permanente. Após o teste, é necessário um plano ativo para continuar usando a Scoutly.
            </p>

            {forceOpen && onSignOut && (
              <button
                type="button"
                onClick={() => onSignOut()}
                className="text-[10px] font-medium text-stone-500 underline underline-offset-4 transition hover:text-stone-800"
              >
                Sair da conta
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
