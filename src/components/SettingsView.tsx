import { memo, useMemo, useState } from 'react';
import { updateProfile } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';
import { formatBRL, type BillingStatus } from '../lib/billing';
import { createBillingPortalSession, saveUserProfile, saveUserSettings } from '../services/api';

function getInitialBatchSize() {
  const raw = Number(localStorage.getItem('scoutly_results_batch_size') || 30);
  return [30, 60, 100].includes(raw) ? raw : 30;
}

interface SettingsViewProps {
  billing: BillingStatus;
  onOpenPlans: () => void;
}

function SettingsView({ billing, onOpenPlans }: SettingsViewProps) {
  const { user, signOut } = useAuth();

  const [displayName, setDisplayName] = useState(
    user?.displayName || localStorage.getItem('scoutly_profile_name') || ''
  );
  const [autoEnrich, setAutoEnrich] = useState(
    localStorage.getItem('scoutly_auto_enrich') !== 'false'
  );
  const [resultsBatchSize, setResultsBatchSize] = useState(getInitialBatchSize);
  const [savedMessage, setSavedMessage] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isOpeningBilling, setIsOpeningBilling] = useState(false);
  const [billingError, setBillingError] = useState('');

  const initials = useMemo(() => {
    const source = displayName || user?.email || 'S';
    return source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }, [displayName, user?.email]);

  const saveProfile = async () => {
    if (!user) return;

    const nextName = displayName.trim();
    if (!nextName) return;

    setIsSavingProfile(true);
    setSavedMessage('');

    try {
      await updateProfile(user, { displayName: nextName });
      localStorage.setItem('scoutly_profile_name', nextName);
      void saveUserProfile(nextName);
      setSavedMessage('Perfil atualizado');
    } catch (error) {
      console.error('[Scoutly Settings] Profile update failed:', error);
      setSavedMessage('Não foi possível atualizar o nome');
    } finally {
      setIsSavingProfile(false);
      window.setTimeout(() => setSavedMessage(''), 2200);
    }
  };

  const updateAutoEnrich = (enabled: boolean) => {
    setAutoEnrich(enabled);
    localStorage.setItem('scoutly_auto_enrich', String(enabled));
    window.dispatchEvent(new Event('scoutly-preferences-updated'));
    void saveUserSettings({ autoEnrich: enabled });
  };

  const updateBatchSize = (value: number) => {
    setResultsBatchSize(value);
    localStorage.setItem('scoutly_results_batch_size', String(value));
    window.dispatchEvent(new Event('scoutly-preferences-updated'));
    void saveUserSettings({ resultsBatchSize: value });
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const handleBillingAction = async () => {
    if (!billing.paidPlanId) {
      onOpenPlans();
      return;
    }

    if (isOpeningBilling) return;
    setIsOpeningBilling(true);
    setBillingError('');

    try {
      const portal = await createBillingPortalSession();
      window.location.assign(portal.url);
    } catch (error: any) {
      setBillingError(error?.message || 'Não foi possível abrir o portal de cobrança.');
      setIsOpeningBilling(false);
    }
  };

  const periodEndLabel = billing.periodEndsAt
    ? new Date(billing.periodEndsAt).toLocaleDateString('pt-BR')
    : '';

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#FAF7F2] px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-stone-950">
            Configurações
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Gerencie sua conta, preferências e plano.
          </p>
        </div>

        <div className="space-y-5">
          <section className="rounded-2xl border border-[#E7E0D8] bg-white p-5 md:p-6">
            <div className="mb-5">
              <h2 className="text-sm font-semibold text-stone-900">Meu perfil</h2>
              <p className="mt-1 text-xs text-stone-500">
                Informações usadas na sua conta Scoutly.
              </p>
            </div>

            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="shrink-0">
                {user?.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={displayName || user.email || 'Perfil'}
                    className="h-16 w-16 rounded-full border border-stone-200 object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-stone-200 bg-[#FAF7F2] text-sm font-semibold text-stone-600">
                    {initials}
                  </div>
                )}
              </div>

              <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium text-stone-500">
                    Nome
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-900 outline-none transition focus:border-[#FF4D00]"
                    placeholder="Seu nome"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-medium text-stone-500">
                    Email
                  </label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    readOnly
                    className="w-full cursor-not-allowed rounded-xl border border-stone-200 bg-[#F7F4EF] px-3.5 py-2.5 text-sm text-stone-500 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-stone-100 pt-4">
              <span className="text-[11px] text-stone-400">
                {savedMessage || 'A foto é sincronizada com seu provedor de login.'}
              </span>
              <button
                type="button"
                onClick={saveProfile}
                disabled={isSavingProfile || !displayName.trim()}
                className="rounded-xl bg-stone-950 px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#FF4D00] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSavingProfile ? 'Salvando...' : 'Salvar nome'}
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-[#E7E0D8] bg-white p-5 md:p-6">
            <div className="mb-5">
              <h2 className="text-sm font-semibold text-stone-900">Preferências</h2>
              <p className="mt-1 text-xs text-stone-500">
                Estas configurações ficam sincronizadas com sua conta Scoutly.
              </p>
            </div>

            <div className="divide-y divide-stone-100">
              <div className="flex items-center justify-between gap-5 py-4 first:pt-0">
                <div>
                  <div className="text-sm font-medium text-stone-800">
                    Analisar empresas automaticamente
                  </div>
                  <p className="mt-1 max-w-lg text-[11px] leading-relaxed text-stone-500">
                    Ao abrir uma empresa, a Scoutly verifica site, contatos públicos, tracking e outros sinais disponíveis.
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={autoEnrich}
                  onClick={() => updateAutoEnrich(!autoEnrich)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                    autoEnrich ? 'bg-[#FF4D00]' : 'bg-stone-300'
                  }`}
                >
                  <span
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${
                      autoEnrich ? 'left-6' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between gap-5 py-4 last:pb-0">
                <div>
                  <div className="text-sm font-medium text-stone-800">
                    Empresas carregadas por vez
                  </div>
                  <p className="mt-1 text-[11px] text-stone-500">
                    Define quantos resultados aparecem inicialmente em “Ver empresas”.
                  </p>
                </div>

                <select
                  value={resultsBatchSize}
                  onChange={(event) => updateBatchSize(Number(event.target.value))}
                  className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-700 outline-none focus:border-[#FF4D00]"
                >
                  <option value={30}>30</option>
                  <option value={60}>60</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#E7E0D8] bg-white p-5 md:p-6">
            <div className="mb-5">
              <h2 className="text-sm font-semibold text-stone-900">Plano e pagamento</h2>
              <p className="mt-1 text-xs text-stone-500">
                Seu acesso à Scoutly e informações de cobrança.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <span className="block text-[10px] font-medium uppercase tracking-wider text-stone-400">
                  Plano atual
                </span>
                <span className="mt-1.5 block text-sm font-semibold text-stone-900">
                  {billing.planName}
                </span>
              </div>

              <div>
                <span className="block text-[10px] font-medium uppercase tracking-wider text-stone-400">
                  Status
                </span>
                <span className="mt-1.5 block text-sm font-semibold text-stone-900">
                  {billing.isExpired
                    ? 'Acesso encerrado'
                    : billing.isTrial
                      ? `${billing.daysRemaining} ${billing.daysRemaining === 1 ? 'dia restante' : 'dias restantes'}`
                      : billing.subscriptionStatus === 'past_due'
                        ? 'Pagamento pendente'
                        : billing.cancelAtPeriodEnd
                          ? 'Cancelamento agendado'
                          : 'Assinatura ativa'}
                </span>
              </div>

              <div>
                <span className="block text-[10px] font-medium uppercase tracking-wider text-stone-400">
                  Cobrança
                </span>
                <span className="mt-1.5 block text-sm font-semibold text-stone-900">
                  {billing.isTrial || billing.monthlyPrice === null
                    ? 'Sem cobrança no teste'
                    : `${formatBRL(billing.monthlyPrice)} / mês`}
                </span>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 border-t border-stone-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-xl">
                <p className="text-[11px] leading-relaxed text-stone-500">
                  {billing.cancelAtPeriodEnd && periodEndLabel
                    ? `Seu plano permanece ativo até ${periodEndLabel}. Você pode reativar ou alterar a assinatura pelo portal de cobrança.`
                    : billing.isTrial
                      ? 'O teste inclui os recursos do Pro por 7 dias. Depois disso, é necessário escolher Go, Pro ou Agency para continuar usando a Scoutly.'
                      : 'Atualize o plano, método de pagamento, faturas ou cancelamento com segurança pela Stripe.'}
                </p>
                {billingError && (
                  <p className="mt-2 text-[11px] font-medium text-red-600">{billingError}</p>
                )}
              </div>

              <button
                type="button"
                onClick={handleBillingAction}
                disabled={isOpeningBilling}
                className="shrink-0 rounded-xl bg-[#FF4D00] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#E04400] disabled:cursor-wait disabled:opacity-60"
              >
                {isOpeningBilling
                  ? 'Abrindo...'
                  : billing.paidPlanId
                    ? 'Gerenciar assinatura'
                    : 'Ver planos'}
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-[#E7E0D8] bg-white p-5 md:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-stone-900">Sessão</h2>
                <p className="mt-1 text-xs text-stone-500">
                  Encerra o acesso da sua conta neste dispositivo.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
              >
                Sair da conta
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default memo(SettingsView);
