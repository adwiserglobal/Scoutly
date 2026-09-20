import type { BillingStatus } from '../lib/billing';

interface SubscriptionSuccessModalProps {
  billing: BillingStatus | null;
  onContinue: () => void;
}

export default function SubscriptionSuccessModal({
  billing,
  onContinue,
}: SubscriptionSuccessModalProps) {
  if (!billing) return null;

  const renewalLabel = billing.periodEndsAt
    ? new Date(billing.periodEndsAt).toLocaleDateString('pt-BR')
    : '';

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-[3px]">
      <div className="w-full max-w-md rounded-3xl border border-[#E7E0D8] bg-[#FAF7F2] p-7 shadow-2xl">
        <div className="mb-5 h-[3px] w-12 rounded-full bg-[#FF4D00]" />

        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#D94400]">
          Pagamento confirmado
        </span>

        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
          Seu plano {billing.planName} está ativo
        </h2>

        <p className="mt-3 text-sm leading-relaxed text-stone-500">
          Sua assinatura foi sincronizada com a Scoutly e os recursos do plano já estão liberados.
        </p>

        {renewalLabel && (
          <div className="mt-5 rounded-2xl border border-[#E7E0D8] bg-white px-4 py-3.5">
            <span className="block text-[10px] font-medium uppercase tracking-wider text-stone-400">
              Próximo ciclo
            </span>
            <span className="mt-1 block text-sm font-semibold text-stone-900">
              {renewalLabel}
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={onContinue}
          className="mt-6 w-full rounded-xl bg-[#FF4D00] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#E04400]"
        >
          Começar a usar a Scoutly
        </button>

        <p className="mt-3 text-center text-[10px] leading-relaxed text-stone-400">
          Você pode gerenciar plano, pagamento e cancelamento em Configurações.
        </p>
      </div>
    </div>
  );
}
