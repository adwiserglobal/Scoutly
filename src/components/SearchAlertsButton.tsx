import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, BellRing, Loader2, Trash2 } from 'lucide-react';
import {
  SearchAlert, createSearchAlert, deleteSearchAlert, fetchSearchAlerts, toggleSearchAlert,
} from '../services/api';

export interface AlertScope {
  query: string;
  regionName: string;
  bbox: { west: number; south: number; east: number; north: number };
}

interface SearchAlertsButtonProps {
  getScope: () => AlertScope | null;
}

/** Bell next to the filters: create an alert for the active search and manage the existing ones. */
export default function SearchAlertsButton({ getScope }: SearchAlertsButtonProps) {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<SearchAlert[]>([]);
  const [limit, setLimit] = useState(1);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [scope, setScope] = useState<AlertScope | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSearchAlerts();
      setAlerts(data.alerts);
      setLimit(data.limit);
    } catch (err: any) {
      setError({ message: err?.message || 'Não foi possível carregar os alertas.', code: err?.code });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setScope(getScope());
    void load();
    const onPointer = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
    // The scope is read once per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const run = async (task: () => Promise<{ alerts: SearchAlert[]; limit: number }>) => {
    setBusy(true);
    setError(null);
    try {
      const data = await task();
      setAlerts(data.alerts);
      setLimit(data.limit);
    } catch (err: any) {
      setError({ message: err?.message || 'Não foi possível concluir.', code: err?.code });
    } finally {
      setBusy(false);
    }
  };

  const alreadyHas = Boolean(scope && alerts.some((alert) => alert.query.toLowerCase() === scope.query.toLowerCase() && alert.regionName === (scope.regionName || null)));
  const active = alerts.some((alert) => alert.enabled);

  return (
    <div ref={rootRef} className="relative shrink-0 max-[430px]:order-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="Alertas de empresas novas"
        title="Alertas de empresas novas"
        className={`flex h-[46px] w-[46px] items-center justify-center rounded-2xl border shadow-[0_14px_44px_rgba(0,0,0,0.28)] backdrop-blur-2xl transition hover:bg-[#171a1f] ${
          open ? 'border-[#FF5A12]/60 bg-[#171a1f] text-white' : 'border-white/10 bg-[#111418]/[0.94] text-stone-200'
        }`}
      >
        {active ? <BellRing className="h-4 w-4 text-[#FF6A26]" /> : <Bell className="h-4 w-4" />}
      </button>

      {open && (
        <div className="absolute right-0 top-[54px] z-50 w-[min(340px,calc(100vw-32px))] rounded-2xl border border-white/10 bg-[#111418]/[0.98] p-4 text-left shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
          <p className="text-[13px] font-bold text-white">Alertas de empresas novas</p>
          <p className="mt-1 text-[11px] leading-relaxed text-stone-400">
            Você recebe um e-mail quando aparecerem empresas novas na sua busca, no máximo uma vez por dia.
          </p>

          <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.04] p-3">
            {scope ? (
              <>
                <p className="break-words text-[12px] font-semibold text-white">{scope.query}</p>
                <p className="mt-0.5 break-words text-[11px] text-stone-400">{scope.regionName || 'Área da busca'}</p>
                <button
                  type="button"
                  disabled={busy || alreadyHas}
                  onClick={() => run(() => createSearchAlert(scope))}
                  className="mt-2.5 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[#FF5A12] text-[12px] font-bold text-white transition hover:bg-[#ff6b2a] disabled:cursor-default disabled:bg-white/10 disabled:text-stone-400"
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
                  {alreadyHas ? 'Alerta já criado' : 'Avisar quando abrir empresa nova'}
                </button>
              </>
            ) : (
              <p className="text-[11px] leading-relaxed text-stone-400">Faça uma busca (ex.: “despachante”) para criar um alerta dela.</p>
            )}
          </div>

          {error && (
            <div className="mt-2.5 rounded-lg border border-rose-500/20 bg-rose-500/[0.08] px-3 py-2 text-[11px] leading-relaxed text-rose-200">
              {error.message}
              {error.code === 'ALERT_LIMIT' && (
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('scoutly-open-plans'))}
                  className="ml-1.5 font-bold text-[#FF8A55] underline-offset-2 hover:underline"
                >
                  Ver planos
                </button>
              )}
            </div>
          )}

          <div className="mt-3">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-500">
              {`Seus alertas · ${alerts.length}/${limit}`}
            </p>
            {loading && <Loader2 className="h-4 w-4 animate-spin text-stone-500" />}
            {!loading && alerts.length === 0 && <p className="text-[11px] text-stone-500">Nenhum alerta ainda.</p>}
            <ul className="max-h-[200px] space-y-1.5 overflow-y-auto">
              {alerts.map((alert) => (
                <li key={alert.id} className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-2">
                  <button
                    type="button"
                    onClick={() => run(() => toggleSearchAlert(alert.id, !alert.enabled))}
                    disabled={busy}
                    role="switch"
                    aria-checked={alert.enabled}
                    aria-label={alert.enabled ? 'Pausar alerta' : 'Ativar alerta'}
                    className={`relative h-[18px] w-8 shrink-0 rounded-full transition ${alert.enabled ? 'bg-[#FF5A12]' : 'bg-white/15'}`}
                  >
                    <span className={`absolute top-0.5 h-[14px] w-[14px] rounded-full bg-white transition-all ${alert.enabled ? 'left-[16px]' : 'left-0.5'}`} />
                  </button>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-semibold text-white">{alert.query}</span>
                    <span className="block truncate text-[10px] text-stone-500">{alert.regionName || 'Área da busca'}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => run(() => deleteSearchAlert(alert.id))}
                    disabled={busy}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-stone-500 transition hover:bg-white/10 hover:text-rose-300"
                    aria-label="Remover alerta"
                    title="Remover alerta"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
