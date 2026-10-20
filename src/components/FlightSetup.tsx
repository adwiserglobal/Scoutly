import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Lock, Play, X } from 'lucide-react';
import { getFlightStatus, type FlightStatus } from '../services/api';
import { FLIGHT_MODELS, getFlightModel, type FlightModelId } from '../flight/models';

const STORAGE_KEY = 'scoutly-flight-model';

export function loadFlightModel(): FlightModelId {
  try { return getFlightModel(localStorage.getItem(STORAGE_KEY)).id; } catch { return 'plane'; }
}

interface FlightSetupProps {
  /** Resolves with an error (to show here) or null when the flight started. */
  onPlay: (model: FlightModelId) => Promise<{ error: string; code?: string } | null>;
  onClose: () => void;
}

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[52px] text-[9px] font-semibold uppercase tracking-wider text-white/45">{label}</span>
      <span className="flex flex-1 gap-0.5">
        {[1, 2, 3, 4, 5].map((dot) => (
          <span key={dot} className={`h-1 flex-1 rounded-full ${dot <= value ? 'bg-[#ff7a45]' : 'bg-white/10'}`} />
        ))}
      </span>
    </div>
  );
}

export default function FlightSetup({ onPlay, onClose }: FlightSetupProps) {
  const [selected, setSelected] = useState<FlightModelId>(loadFlightModel);

  const [status, setStatus] = useState<FlightStatus | null>(null);
  const [starting, setStarting] = useState(false);
  const [problem, setProblem] = useState<{ error: string; code?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getFlightStatus().then((result) => { if (!cancelled) setStatus(result); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const play = async (id: FlightModelId) => {
    if (starting) return;
    try { localStorage.setItem(STORAGE_KEY, id); } catch { /* ignore */ }
    setStarting(true);
    setProblem(null);
    const result = await onPlay(id);
    if (result) { setProblem(result); setStarting(false); }
  };

  const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.max(0, Math.floor(seconds % 60))).padStart(2, '0')}`;
  const blocked = Boolean(status && !status.unlimited && (status.remainingSeconds ?? 0) <= 0);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const index = FLIGHT_MODELS.findIndex((model) => model.id === selected);
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowRight') setSelected(FLIGHT_MODELS[(index + 1) % FLIGHT_MODELS.length].id);
      else if (event.key === 'ArrowLeft') setSelected(FLIGHT_MODELS[(index + FLIGHT_MODELS.length - 1) % FLIGHT_MODELS.length].id);
      else if (event.key === 'Enter') void play(selected);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[200] flex justify-center px-3 pb-5 font-sans sm:pb-8" data-flight-setup>
      <div className="pointer-events-auto w-full max-w-[860px] rounded-3xl border border-white/10 bg-[#0c0e12]/95 p-4 text-white shadow-[0_24px_80px_rgba(0,0,0,0.65)] backdrop-blur-xl sm:p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#ff955f]">Modo voo</p>
            <h2 className="mt-0.5 text-base font-bold tracking-tight">Escolha sua aeronave</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {FLIGHT_MODELS.map((model) => {
            const active = model.id === selected;
            return (
              <button
                key={model.id}
                type="button"
                onClick={() => setSelected(model.id)}
                onDoubleClick={() => void play(model.id)}
                aria-pressed={active}
                className={`flex flex-col gap-2 rounded-2xl border p-3 text-left transition ${active ? 'border-[#ff7a45] bg-[#ff5a12]/10 shadow-[0_0_0_1px_#ff7a45]' : 'border-white/10 bg-white/[0.03] hover:border-white/25'}`}
              >
                <div className="h-[88px] overflow-hidden rounded-xl bg-black/40"><img src={`/flight/${model.id}.webp`} alt={model.name} width={360} height={240} loading="eager" decoding="async" className="h-full w-full object-cover" draggable={false} /></div>
                <div>
                  <p className="text-[12px] font-bold leading-tight">{model.name}</p>
                  <p className="mt-0.5 min-h-[28px] text-[10px] leading-snug text-white/50">{model.tagline}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <StatBar label="Veloc." value={model.stats.speed} />
                  <StatBar label="Agil." value={model.stats.agility} />
                  <StatBar label="Visão" value={model.stats.view} />
                </div>
              </button>
            );
          })}
        </div>

        {status && !status.unlimited && (
          <div className={`mt-3.5 flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-[12px] ${blocked ? 'border-rose-400/30 bg-rose-500/10 text-rose-200' : 'border-white/10 bg-white/[0.04] text-white/75'}`}>
            <span>
              {blocked
                ? 'Seu tempo de voo grátis de hoje acabou.'
                : <>Plano Free: <b className="text-white">5 min de voo por dia</b> · restam <b className="tabular-nums text-white">{formatTime(status.remainingSeconds ?? 0)}</b></>}
            </span>
            <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('scoutly-open-plans'))} className="inline-flex flex-none items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-white/15">
              <Lock className="h-3 w-3" /> Voo ilimitado
            </button>
          </div>
        )}

        {problem && (
          <p role="alert" className="mt-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3.5 py-2.5 text-[12px] leading-relaxed text-rose-200">{problem.error}</p>
        )}

        <div className="mt-3.5 flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
          <p className="hidden text-[11px] text-white/50 sm:block">← → escolhe · Enter voa · Esc fecha</p>
          <button
            type="button"
            onClick={() => void play(selected)}
            disabled={starting || blocked}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#ff5a12] px-7 text-sm font-bold text-white shadow-lg shadow-[#ff5a12]/25 transition hover:bg-[#ff6b2b] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />} Voar com {getFlightModel(selected).name}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
