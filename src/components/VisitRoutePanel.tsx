import { Check, Columns3, ExternalLink, Route, Trash2, X } from 'lucide-react';
import { Business, VisitRouteStop, VisitStatus } from '../types';
import { getGoogleRouteLink } from '../services/api';

interface VisitRoutePanelProps {
  stops: VisitRouteStop[];
  onSetVisitStatus: (businessId: string, status: VisitStatus) => void;
  onRemoveStop: (businessId: string) => void;
  onClear: () => void;
  onCloseMode: () => void;
  onInspectBusiness: (business: Business) => void;
  onAddToPipeline: (business: Business) => void;
}

const STATUS_LABELS: Record<VisitStatus, string> = {
  PENDENTE: 'A visitar',
  VISITADO: 'Visitado',
  PULADO: 'Pulado',
};

function leadStatusLabel(value?: string) {
  const labels: Record<string, string> = {
    NOVO: 'Novo',
    CONTATADO: 'Contatado',
    EM_NEGOCIACAO: 'Em negociação',
    FECHADO: 'Fechado',
    PERDIDO: 'Perdido',
    ARQUIVADO: 'Arquivado',
  };
  return labels[value || 'NOVO'] || 'Novo';
}

export default function VisitRoutePanel({
  stops,
  onSetVisitStatus,
  onRemoveStop,
  onClear,
  onCloseMode,
  onInspectBusiness,
  onAddToPipeline,
}: VisitRoutePanelProps) {
  const visitedCount = stops.filter((stop) => stop.visitStatus === 'VISITADO').length;
  const googleRouteUrl = getGoogleRouteLink(stops.map((stop) => stop.business));

  return (
    <aside className="pointer-events-auto w-[360px] max-w-[calc(100vw-24px)] overflow-hidden rounded-[22px] border border-white/[0.09] bg-[#0d1014]/[0.98] shadow-[0_20px_70px_rgba(0,0,0,0.48)] backdrop-blur-2xl">
      <div className="border-b border-white/[0.07] bg-[#111418] px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#FF5A12]/20 bg-[#FF5A12]/[0.09] text-[#FF6A26]">
                <Route className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-[13px] font-semibold text-white">Rota de visitas</h3>
                <p className="mt-0.5 text-[9.5px] text-stone-500">
                  Monte a ordem clicando nos negócios do mapa.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onCloseMode}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-stone-600 transition hover:bg-white/[0.05] hover:text-white"
            title="Encerrar modo de rota"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/[0.12] px-3 py-2 text-[9.5px]">
          <span className="text-stone-500">
            {stops.length} {stops.length === 1 ? 'parada' : 'paradas'}
          </span>
          <span className="font-semibold text-stone-300">
            {visitedCount}/{stops.length} visitadas
          </span>
        </div>
      </div>

      <div className="max-h-[52vh] overflow-y-auto px-3 py-3 custom-scrollbar">
        {stops.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/[0.10] bg-white/[0.025] px-4 py-7 text-center">
            <p className="text-[11px] font-semibold text-stone-300">Sua rota está vazia</p>
            <p className="mt-1 text-[9.5px] leading-relaxed text-stone-600">
              Clique em um negócio no mapa para adicionar a primeira parada.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {stops.map((stop, index) => (
              <div
                key={stop.business.id}
                className="rounded-2xl border border-white/[0.08] bg-[#15191e] px-3 py-3.5"
              >
                <div className="flex items-start gap-2.5">
                  <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ${
                    stop.visitStatus === 'VISITADO'
                      ? 'bg-emerald-500'
                      : stop.visitStatus === 'PULADO'
                        ? 'bg-stone-600'
                        : 'bg-[#FF5A12]'
                  }`}>
                    {stop.visitStatus === 'VISITADO' ? <Check className="h-3.5 w-3.5" /> : index + 1}
                  </div>

                  <button
                    type="button"
                    onClick={() => onInspectBusiness(stop.business)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-[11px] font-semibold text-white">
                      {stop.business.name}
                    </span>
                    <span className="mt-0.5 block truncate text-[9px] text-stone-600">
                      {stop.business.address || 'Endereço não identificado'}
                    </span>
                    <span className="mt-1 block text-[9px] text-stone-500">
                      CRM · {leadStatusLabel(stop.business.leadStatus)}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onRemoveStop(stop.business.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-stone-600 transition hover:bg-rose-500/[0.08] hover:text-rose-400"
                    title="Remover da rota"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-1.5">
                  {(['PENDENTE', 'VISITADO', 'PULADO'] as VisitStatus[]).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => onSetVisitStatus(stop.business.id, status)}
                      className={`rounded-xl border px-2 py-1.5 text-[9px] font-semibold transition ${
                        stop.visitStatus === status
                          ? status === 'VISITADO'
                            ? 'border-emerald-500/25 bg-emerald-500/[0.10] text-emerald-400'
                            : status === 'PULADO'
                              ? 'border-white/[0.10] bg-white/[0.06] text-stone-300'
                              : 'border-[#FF5A12]/25 bg-[#FF5A12]/[0.10] text-[#FF7A3D]'
                          : 'border-white/[0.06] bg-white/[0.025] text-stone-600 hover:text-stone-300'
                      }`}
                    >
                      {STATUS_LABELS[status]}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => onAddToPipeline(stop.business)}
                  disabled={Boolean(stop.business.leadStatus && stop.business.leadStatus !== 'NOVO')}
                  className={`mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 text-[9px] font-semibold transition ${
                    stop.business.leadStatus && stop.business.leadStatus !== 'NOVO'
                      ? 'cursor-default border-white/[0.06] bg-white/[0.02] text-stone-600'
                      : 'border-[#FF5A12]/25 bg-[#FF5A12]/[0.07] text-[#FF7A3D] hover:bg-[#FF5A12]/[0.12]'
                  }`}
                >
                  <Columns3 className="h-3.5 w-3.5" />
                  {stop.business.leadStatus && stop.business.leadStatus !== 'NOVO'
                    ? 'Já está no pipeline'
                    : 'Adicionar ao pipeline'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-white/[0.07] bg-[#111418] p-3">
        {googleRouteUrl && (
          <a
            href={googleRouteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF5A12] px-3 py-2.5 text-[10px] font-semibold text-white transition hover:bg-[#ff6a27]"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-4.5 w-4.5 shrink-0"
            >
              <path fill="#4285F4" d="M12 2.25a6.75 6.75 0 0 0-6.75 6.75c0 4.83 6.75 12.75 6.75 12.75s6.75-7.92 6.75-12.75A6.75 6.75 0 0 0 12 2.25Z"/>
              <path fill="#34A853" d="M12 21.75s6.75-7.92 6.75-12.75c0-.44-.04-.88-.12-1.29L12 14.25v7.5Z"/>
              <path fill="#FBBC04" d="M5.8 6.31A6.7 6.7 0 0 0 5.25 9c0 1.42.58 3.11 1.42 4.83L12 8.5 5.8 6.31Z"/>
              <path fill="#EA4335" d="M12 2.25A6.74 6.74 0 0 0 5.8 6.31L12 12.5l4.76-4.76A6.75 6.75 0 0 0 12 2.25Z"/>
              <circle cx="12" cy="9" r="2.3" fill="#fff"/>
            </svg>
            <span>Abrir rota no Google Maps</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}

        {stops.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="mt-2 w-full rounded-lg px-3 py-2 text-[9px] font-medium text-stone-600 transition hover:bg-rose-500/[0.07] hover:text-rose-400"
          >
            Limpar rota
          </button>
        )}
      </div>
    </aside>
  );
}
