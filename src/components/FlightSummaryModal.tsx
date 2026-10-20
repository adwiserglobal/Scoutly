import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpRight, Building2, Check, Clock3, Columns3, Eye, Lock, MapPinned, MousePointerClick, Plane, Sparkles, Target, X } from 'lucide-react';
import type { Business } from '../types';
import type { FlightSummary } from '../flight/summary';

interface FlightSummaryModalProps {
  summary: FlightSummary;
  /** Free plan: the missed-opportunities list is a paid feature (teaser only). */
  locked: boolean;
  missed: Business[];
  isInPipeline: (business: Business) => boolean;
  onAddToPipeline: (business: Business) => void;
  onOpen: (business: Business) => void;
  onClose: () => void;
  onUpgrade: () => void;
}

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.max(0, Math.round(seconds % 60));
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `0:${String(s).padStart(2, '0')}`;
};

function Stat({ icon, value, label, tone = 'neutral' }: { icon: React.ReactNode; value: string | number; label: string; tone?: 'neutral' | 'good' }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3.5">
      <span className={`mb-2.5 flex h-8 w-8 items-center justify-center rounded-xl ${tone === 'good' ? 'bg-emerald-400/12 text-emerald-300' : 'bg-[#ff5a12]/12 text-[#ff9869]'}`}>{icon}</span>
      <p className="text-[22px] font-extrabold leading-none tabular-nums tracking-tight text-white">{value}</p>
      <p className="mt-1.5 text-[11px] leading-snug text-[#aab0ba]">{label}</p>
    </div>
  );
}

function BusinessRow({ business, inPipeline, onAdd, onOpen }: { business: Business; inPipeline: boolean; onAdd: () => void; onOpen: () => void }) {
  const noSite = !business.website;
  const place = [business.bairro, business.municipio].filter(Boolean).join(', ') || business.address;
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3.5 transition hover:border-white/[0.16] sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl border border-white/[0.08] bg-[#14181d] text-[#b9bec7]"><Building2 className="h-5 w-5" /></span>
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-white">{business.name}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-[#aab0ba]">
            <span className="truncate">{business.category}</span>
            {place && <span className="truncate text-[#8b929e]">· {place}</span>}
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${noSite ? 'bg-emerald-400/12 text-emerald-300' : 'bg-white/[0.07] text-[#c4c9d1]'}`}>{noSite ? 'Sem site' : 'Com site'}</span>
          </p>
        </div>
      </div>
      <div className="flex flex-none items-center gap-2">
        <button
          type="button"
          onClick={onAdd}
          disabled={inPipeline}
          className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[12px] font-semibold transition ${inPipeline ? 'cursor-default border border-emerald-400/25 bg-emerald-400/10 text-emerald-300' : 'bg-[#ff5a12] text-white hover:bg-[#ff6b2b] active:scale-[0.98]'}`}
        >
          {inPipeline ? <><Check className="h-3.5 w-3.5" /> No pipeline</> : <><Columns3 className="h-3.5 w-3.5" /> Adicionar ao pipeline</>}
        </button>
        <button type="button" onClick={onOpen} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/[0.12] px-3 text-[12px] font-semibold text-white transition hover:bg-white/[0.07]">
          Ver mais <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}

export default function FlightSummaryModal({ summary, locked, missed, isInPipeline, onAddToPipeline, onOpen, onClose, onUpgrade }: FlightSummaryModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = previous; };
  }, [onClose]);

  const limitReached = summary.endedBy === 'limit';

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/65 p-0 backdrop-blur-md sm:items-center sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="flight-summary-title" className="relative flex max-h-[94dvh] w-full max-w-[760px] flex-col overflow-hidden rounded-t-[28px] border border-white/[0.1] bg-[#0d1014] font-sans text-white shadow-[0_30px_120px_rgba(0,0,0,0.7)] sm:max-h-[88dvh] sm:rounded-[28px]">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[radial-gradient(80%_100%_at_50%_0%,rgba(255,90,18,0.26),transparent_70%)]" />

        <header className="relative flex items-start justify-between gap-4 px-5 pb-4 pt-5 sm:px-7 sm:pt-6">
          <div className="flex items-center gap-3.5">
            <span className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff7a45] to-[#ff4d00] shadow-[0_10px_30px_-8px_rgba(255,90,18,0.8)]"><Plane className="h-6 w-6 text-white" /></span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#ff955f]">Resumo do voo</p>
              <h2 id="flight-summary-title" className="mt-0.5 text-[19px] font-extrabold leading-tight tracking-tight sm:text-[22px]">Negócios encontrados no seu voo</h2>
            </div>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Fechar" className="flex h-9 w-9 flex-none items-center justify-center rounded-xl text-[#aab0ba] outline-none transition hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-white/40"><X className="h-5 w-5" /></button>
        </header>

        <div className="relative min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 pb-5 sm:px-7">
          {limitReached && (
            <div className="flex flex-col gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/[0.08] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[13px] font-bold text-amber-200">Seu tempo de voo grátis de hoje acabou</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-amber-100/70">O plano Free inclui 5 minutos de voo por dia. Nos planos pagos o voo é ilimitado.</p>
              </div>
              <button type="button" onClick={onUpgrade} className="inline-flex h-9 flex-none items-center justify-center gap-1.5 rounded-xl bg-amber-300 px-4 text-[12px] font-bold text-[#3a2a00] hover:bg-amber-200">Ver planos</button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Stat icon={<Clock3 className="h-4 w-4" />} value={formatDuration(summary.durationSeconds)} label="Tempo de voo" />
            <Stat icon={<MapPinned className="h-4 w-4" />} value={summary.flownCount} label="Empresas sobrevoadas" />
            <Stat icon={<MousePointerClick className="h-4 w-4" />} value={summary.opened.length} label="Empresas abertas" />
            <Stat icon={<Target className="h-4 w-4" />} value={summary.noSiteCount} label="Sem site no caminho" tone="good" />
          </div>

          <section aria-labelledby="opened-title">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 id="opened-title" className="text-[14px] font-bold tracking-tight">Empresas que você abriu</h3>
              <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#c4c9d1]">{summary.opened.length}</span>
            </div>
            {summary.opened.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/[0.14] px-5 py-7 text-center">
                <Eye className="mx-auto mb-2 h-6 w-6 text-[#6f7682]" />
                <p className="text-[13px] font-semibold text-white">Você não abriu nenhuma empresa neste voo</p>
                <p className="mx-auto mt-1 max-w-sm text-[12px] leading-relaxed text-[#9aa1ac]">Quando um card aparecer embaixo, aperte Espaço ou toque em Abrir para ver os detalhes.</p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {summary.opened.map((business) => (
                  <BusinessRow key={business.id} business={business} inPipeline={isInPipeline(business)} onAdd={() => onAddToPipeline(business)} onOpen={() => onOpen(business)} />
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="missed-title">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 id="missed-title" className="flex items-center gap-2 text-[14px] font-bold tracking-tight">
                <Sparkles className="h-4 w-4 text-[#ff9869]" /> Oportunidades que ficaram para trás
              </h3>
              <span className="flex items-center gap-1 rounded-full bg-white/[0.08] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#c4c9d1]">
                {locked && <Lock className="h-3 w-3" />}{missed.length}
              </span>
            </div>

            {locked ? (
              <div className="relative overflow-hidden rounded-2xl border border-white/[0.1] bg-white/[0.025]">
                <ul aria-hidden className="pointer-events-none select-none space-y-2.5 p-3.5 opacity-60 blur-[5px]">
                  {[0, 1, 2].map((item) => (
                    <li key={item} className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3.5">
                      <span className="h-11 w-11 flex-none rounded-xl bg-white/10" />
                      <span className="flex-1 space-y-2"><span className="block h-3 w-2/3 rounded bg-white/20" /><span className="block h-2.5 w-1/3 rounded bg-white/10" /></span>
                      <span className="h-9 w-28 rounded-xl bg-white/10" />
                    </li>
                  ))}
                </ul>
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0d1014]/55 p-5 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#ff7a45]/40 bg-[#ff5a12]/15 text-[#ff9869]"><Lock className="h-5 w-5" /></span>
                  <div>
                    <p className="text-[14px] font-bold">{missed.length > 0 ? `${missed.length} ${missed.length === 1 ? 'oportunidade recomendada ficou' : 'oportunidades recomendadas ficaram'} para trás` : 'Veja o que você deixou passar'}</p>
                    <p className="mx-auto mt-1 max-w-sm text-[12px] leading-relaxed text-[#b5bac3]">Empresas que combinam com o que você prospecta e passaram perto do seu voo. Disponível nos planos pagos.</p>
                  </div>
                  <button type="button" onClick={onUpgrade} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#ff5a12] px-5 text-[13px] font-bold text-white shadow-lg shadow-[#ff5a12]/25 transition hover:bg-[#ff6b2b] active:scale-[0.98]"><Lock className="h-3.5 w-3.5" /> Desbloquear com um plano</button>
                </div>
              </div>
            ) : missed.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/[0.14] px-5 py-7 text-center">
                <Check className="mx-auto mb-2 h-6 w-6 text-emerald-300" />
                <p className="text-[13px] font-semibold text-white">Você não deixou nenhuma oportunidade para trás</p>
                <p className="mx-auto mt-1 max-w-sm text-[12px] leading-relaxed text-[#9aa1ac]">Nenhuma empresa recomendada passou despercebida neste trajeto.</p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {missed.map((business) => (
                  <BusinessRow key={business.id} business={business} inPipeline={isInPipeline(business)} onAdd={() => onAddToPipeline(business)} onOpen={() => onOpen(business)} />
                ))}
              </ul>
            )}
          </section>
        </div>

        <footer className="relative flex flex-col-reverse gap-2.5 border-t border-white/[0.08] bg-[#0b0e12] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <p className="text-[11px] text-[#8b929e]">As empresas continuam no mapa. Você pode voltar a voar quando quiser.</p>
          <button type="button" onClick={onClose} className="inline-flex h-10 items-center justify-center rounded-xl bg-white/[0.09] px-6 text-[13px] font-bold text-white transition hover:bg-white/[0.15]">Continuar prospectando</button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
