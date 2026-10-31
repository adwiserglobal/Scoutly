import { useCallback, useEffect, useState } from 'react';
import { BellRing, Loader2, Trash2 } from 'lucide-react';
import {
  deleteSearchAlert,
  fetchNotificationPrefs,
  fetchSearchAlerts,
  saveNotificationPrefs,
  toggleSearchAlert,
  type NotificationPrefs,
  type SearchAlert,
} from '../../services/api';

function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (next: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full border transition disabled:cursor-wait disabled:opacity-50 ${checked ? 'border-[#FF5A12] bg-[#FF5A12]' : 'border-white/[0.12] bg-[#1b1e23]'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString();
}

export default function NotificationsSection() {
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [alerts, setAlerts] = useState<SearchAlert[]>([]);
  const [limit, setLimit] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<keyof NotificationPrefs | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [prefsResult, alertsResult] = await Promise.allSettled([fetchNotificationPrefs(), fetchSearchAlerts()]);
    if (prefsResult.status === 'fulfilled') setPrefs(prefsResult.value);
    else setError(prefsResult.reason?.message || 'Não foi possível carregar as notificações.');
    if (alertsResult.status === 'fulfilled') {
      setAlerts(alertsResult.value.alerts);
      setLimit(alertsResult.value.limit);
    } else if ((alertsResult.reason as any)?.code !== 'ALERTS_MIGRATION_PENDING') {
      setError((current) => current || alertsResult.reason?.message || 'Não foi possível carregar os alertas.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const updatePref = async (key: keyof NotificationPrefs, value: boolean) => {
    if (!prefs) return;
    const previous = prefs;
    setPrefs({ ...prefs, [key]: value });
    setSavingKey(key);
    setError('');
    try {
      setPrefs(await saveNotificationPrefs({ [key]: value }));
    } catch (err: any) {
      setPrefs(previous);
      setError(err?.message || 'Não foi possível salvar a preferência.');
    } finally {
      setSavingKey(null);
    }
  };

  const toggleAlert = async (alert: SearchAlert, enabled: boolean) => {
    setBusyId(alert.id);
    setError('');
    try {
      const result = await toggleSearchAlert(alert.id, enabled);
      setAlerts(result.alerts);
      setLimit(result.limit);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível atualizar o alerta.');
    } finally {
      setBusyId(null);
    }
  };

  const removeAlert = async (alert: SearchAlert) => {
    setBusyId(alert.id);
    setError('');
    try {
      const result = await deleteSearchAlert(alert.id);
      setAlerts(result.alerts);
      setLimit(result.limit);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível remover o alerta.');
    } finally {
      setBusyId(null);
    }
  };

  const alertsOff = prefs?.businessAlerts === false;

  return (
    <section className="rounded-[22px] border border-white/[0.08] bg-[#111418] p-5 shadow-[0_14px_40px_rgba(0,0,0,0.16)] md:p-6">
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-white">Notificações</h2>
        <p className="mt-1 text-xs text-stone-500">Escolha quais e-mails da Scoutly você quer receber.</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-xs text-stone-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[13px] font-semibold text-white"><BellRing className="h-4 w-4 text-[#FF6A26]" /> Alertas de novos negócios</div>
              <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-stone-500">
                E-mail diário quando aparecem empresas novas nos alertas que você ativou com o sino. Desligar aqui pausa todos os alertas, sem apagar nenhum.
              </p>
            </div>
            <Switch label="Alertas de novos negócios" checked={prefs?.businessAlerts ?? true} disabled={!prefs || savingKey === 'businessAlerts'} onChange={(next) => updatePref('businessAlerts', next)} />
          </div>

          <div className={`rounded-2xl border border-white/[0.07] bg-[#0b0e12] p-3 ${alertsOff ? 'opacity-60' : ''}`}>
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-[11px] font-semibold text-stone-300">Seus alertas</span>
              {limit > 0 && <span className="text-[10px] text-stone-600">{alerts.length} de {limit}</span>}
            </div>
            {alerts.length === 0 ? (
              <p className="px-1 py-3 text-[11px] leading-relaxed text-stone-500">
                Nenhum alerta ainda. Abra uma empresa e toque em <span className="font-semibold text-stone-300">Avisar de empresas semelhantes</span> para receber um e-mail quando surgirem novas parecidas.
              </p>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {alerts.map((alert) => (
                  <li key={alert.id} className="flex items-center gap-3 px-1 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-semibold text-white">{alert.query}</div>
                      <div className="truncate text-[10px] text-stone-500">
                        {[alert.regionName, formatDate(alert.lastNotifiedAt) ? `último aviso ${formatDate(alert.lastNotifiedAt)}` : 'ainda sem avisos'].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <Switch label={`Alerta ${alert.query}`} checked={alert.enabled} disabled={busyId === alert.id} onChange={(next) => toggleAlert(alert, next)} />
                    <button
                      type="button"
                      onClick={() => removeAlert(alert)}
                      disabled={busyId === alert.id}
                      title="Remover alerta"
                      aria-label={`Remover alerta ${alert.query}`}
                      className="rounded-lg p-1.5 text-stone-500 transition hover:bg-rose-500/10 hover:text-rose-400 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-start justify-between gap-4 border-t border-white/[0.07] pt-5">
            <div>
              <div className="text-[13px] font-semibold text-white">Dicas e lembretes</div>
              <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-stone-500">
                E-mails com dicas de uso e lembretes quando você fica um tempo sem entrar na plataforma. Avisos de conta, cobrança e convites de equipe continuam sendo enviados.
              </p>
            </div>
            <Switch label="Dicas e lembretes" checked={prefs?.productEmails ?? true} disabled={!prefs || savingKey === 'productEmails'} onChange={(next) => updatePref('productEmails', next)} />
          </div>

          {error && <p className="text-[11px] font-medium text-rose-400">{error}</p>}
        </div>
      )}
    </section>
  );
}
