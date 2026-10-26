import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, CircleAlert, CreditCard, ShieldCheck } from 'lucide-react';
import { applyManagedPlan, fetchManagedAccount, saveManagedFeatures } from './api';
import type { ManagedAccount } from './types';

const PLANS = [
  { id: 'free', label: 'Free', hint: '5 créditos por dia, até 25 por mês' },
  { id: 'go', label: 'Go', hint: '80 créditos por ciclo, IA limitada' },
  { id: 'pro', label: 'Pro', hint: 'Créditos ilimitados e todos os recursos' },
  { id: 'agency', label: 'Agency', hint: 'Pro + workspace, equipe e pipeline compartilhado' },
];

const DURATIONS = [
  { id: 'forever', label: 'Sem data de término', days: null as number | null },
  { id: '7', label: '7 dias', days: 7 },
  { id: '30', label: '30 dias', days: 30 },
  { id: '90', label: '90 dias', days: 90 },
  { id: '365', label: '1 ano', days: 365 },
  { id: 'date', label: 'Até uma data…', days: null as number | null },
];

const ORIGIN_LABEL: Record<ManagedAccount['origin'], string> = {
  developer: 'Developer (definido no código)',
  stripe: 'Stripe (assinatura paga)',
  manual: 'Concedido manualmente',
  none: 'Sem assinatura',
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function SubscriptionManager({ uid, onBack }: { uid: string; onBack: () => void }) {
  const [account, setAccount] = useState<ManagedAccount | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const [plan, setPlan] = useState('pro');
  const [duration, setDuration] = useState('forever');
  const [until, setUntil] = useState('');
  const [note, setNote] = useState('');
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});

  const load = async () => {
    setError('');
    try {
      const data = await fetchManagedAccount(uid);
      setAccount(data);
      setPlan(['free', 'go', 'pro', 'agency'].includes(data.effective.plan) ? data.effective.plan : 'free');
      setEnabled(Object.fromEntries(data.features.map((feature) => [feature.key, feature.enabled])));
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar a conta.');
    }
  };

  useEffect(() => {
    setAccount(null);
    setNotice('');
    void load();
  }, [uid]);

  const locked = account?.origin === 'developer' || account?.origin === 'stripe';
  const planChanged = account ? plan !== account.effective.plan : false;
  const featuresChanged = useMemo(
    () => (account ? account.features.some((feature) => enabled[feature.key] !== feature.enabled) : false),
    [account, enabled],
  );

  const run = async (task: () => Promise<ManagedAccount>, success: string) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const data = await task();
      setAccount(data);
      setEnabled(Object.fromEntries(data.features.map((feature) => [feature.key, feature.enabled])));
      setNotice(success);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível concluir a operação.');
    } finally {
      setBusy(false);
    }
  };

  const applyPlan = () => {
    if (!account) return;
    const chosen = PLANS.find((item) => item.id === plan)?.label || plan;
    const who = account.user.email || account.user.firebase_uid;
    if (!window.confirm(`Aplicar o plano ${chosen} para ${who}?`)) return;
    const option = DURATIONS.find((item) => item.id === duration);
    void run(
      () => applyManagedPlan(uid, {
        plan,
        days: plan === 'free' ? null : option?.days ?? null,
        until: plan !== 'free' && duration === 'date' && until ? new Date(`${until}T23:59:59`).toISOString() : null,
        note,
      }),
      `Plano ${chosen} aplicado.`,
    );
  };

  const saveFeatures = () => {
    const enabledKeys = Object.entries(enabled).filter(([, value]) => value).map(([key]) => key);
    void run(() => saveManagedFeatures(uid, enabledKeys, note), 'Recursos atualizados.');
  };

  if (!account) {
    return (
      <>
        <button className="ghost-button" onClick={onBack}><ArrowLeft size={14} /> Voltar ao cliente</button>
        <div className="empty-state" style={{ marginTop: 24 }}>
          {error ? <><CircleAlert size={26} /><h2>{error}</h2></> : <h2>Carregando…</h2>}
        </div>
      </>
    );
  }

  return (
    <div className="subscription-manager">
      <button className="ghost-button" onClick={onBack}><ArrowLeft size={14} /> Voltar ao cliente</button>

      <div className="customer-identity" style={{ marginTop: 16 }}>
        <div>
          <h2>Gerenciar assinatura</h2>
          <p>{account.user.display_name || 'Sem nome'} · {account.user.email || account.user.firebase_uid}</p>
        </div>
      </div>

      {error && <div className="manager-alert error"><CircleAlert size={14} /> {error}</div>}
      {notice && <div className="manager-alert success"><CheckCircle2 size={14} /> {notice}</div>}

      <div className="detail-grid">
        <div className="detail-card">
          <span>Plano efetivo</span>
          <strong style={{ textTransform: 'capitalize' }}>{account.effective.plan}</strong>
          <small>{account.effective.viaTeam ? 'via equipe Agency' : account.effective.status}</small>
        </div>
        <div className="detail-card">
          <span>Origem</span>
          <strong style={{ fontSize: 13 }}>{ORIGIN_LABEL[account.origin]}</strong>
          <small>{account.effective.periodEnd ? `até ${formatDate(account.effective.periodEnd)}` : 'sem data de término'}</small>
        </div>
      </div>

      {account.origin === 'developer' && (
        <div className="manager-alert info"><ShieldCheck size={14} /> Conta Developer ({account.developerPlan}): o plano é definido no código e não pode ser alterado aqui. Os recursos abaixo ainda podem ser ajustados.</div>
      )}
      {account.origin === 'stripe' && (
        <div className="manager-alert warning"><CreditCard size={14} /> Há uma assinatura ativa no Stripe. Para trocar de plano ou cancelar, use o Stripe; assim não há cobrança duplicada.</div>
      )}

      <div className="activity-block">
        <h3>Plano</h3>
        <div className="plan-options">
          {PLANS.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={locked || busy}
              className={`plan-option ${plan === item.id ? 'selected' : ''}`}
              onClick={() => setPlan(item.id)}
            >
              <strong>{item.label}</strong>
              <small>{item.hint}</small>
            </button>
          ))}
        </div>

        {plan !== 'free' && (
          <div className="manager-row">
            <label>
              <span>Duração</span>
              <select value={duration} disabled={locked || busy} onChange={(e) => setDuration(e.target.value)}>
                {DURATIONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
            {duration === 'date' && (
              <label>
                <span>Término</span>
                <input type="date" value={until} disabled={locked || busy} onChange={(e) => setUntil(e.target.value)} />
              </label>
            )}
          </div>
        )}

        <label className="manager-note">
          <span>Observação (fica no log de auditoria)</span>
          <input value={note} maxLength={300} disabled={busy} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: parceria, cortesia, teste do cliente" />
        </label>

        <button
          className="primary-button"
          disabled={locked || busy || !planChanged || (plan !== 'free' && duration === 'date' && !until)}
          onClick={applyPlan}
        >
          {busy ? 'Aplicando…' : planChanged ? 'Aplicar plano' : 'Plano já aplicado'}
        </button>
      </div>

      <div className="activity-block">
        <h3>Recursos da conta</h3>
        <p className="manager-hint">Desativar bloqueia o recurso para esta conta, qualquer que seja o plano.</p>
        {account.features.map((feature) => (
          <div className="feature-row" key={feature.key}>
            <span>{feature.label}</span>
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(enabled[feature.key])}
              disabled={busy}
              className={`switch ${enabled[feature.key] ? 'on' : ''}`}
              onClick={() => setEnabled((current) => ({ ...current, [feature.key]: !current[feature.key] }))}
            >
              <i />
            </button>
          </div>
        ))}
        <button className="primary-button" style={{ marginTop: 12 }} disabled={busy || !featuresChanged} onClick={saveFeatures}>
          {busy ? 'Salvando…' : 'Salvar recursos'}
        </button>
      </div>
    </div>
  );
}
