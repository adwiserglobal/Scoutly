import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Play, X } from 'lucide-react';
import { FLIGHT_MODELS, getFlightModel, type FlightModelId } from '../flight/models';

const STORAGE_KEY = 'scoutly-flight-model';

export function loadFlightModel(): FlightModelId {
  try { return getFlightModel(localStorage.getItem(STORAGE_KEY)).id; } catch { return 'plane'; }
}

interface FlightSetupProps {
  onPlay: (model: FlightModelId) => void;
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

  const play = (id: FlightModelId) => {
    try { localStorage.setItem(STORAGE_KEY, id); } catch { /* ignore */ }
    onPlay(id);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const index = FLIGHT_MODELS.findIndex((model) => model.id === selected);
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowRight') setSelected(FLIGHT_MODELS[(index + 1) % FLIGHT_MODELS.length].id);
      else if (event.key === 'ArrowLeft') setSelected(FLIGHT_MODELS[(index + FLIGHT_MODELS.length - 1) % FLIGHT_MODELS.length].id);
      else if (event.key === 'Enter') play(selected);
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
                onDoubleClick={() => play(model.id)}
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

        <div className="mt-3.5 flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
          <p className="hidden text-[11px] text-white/50 sm:block">← → escolhe · Enter voa · Esc fecha</p>
          <button
            type="button"
            onClick={() => play(selected)}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#ff5a12] px-7 text-sm font-bold text-white shadow-lg shadow-[#ff5a12]/25 transition hover:bg-[#ff6b2b] active:scale-[0.98]"
          >
            <Play className="h-4 w-4 fill-current" /> Voar com {getFlightModel(selected).name}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
