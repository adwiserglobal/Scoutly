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
    <aside className="pointer-events-auto w-[340px] max-w-[calc(100vw-32px)] overflow-hidden rounded-2xl border border-white/60 bg-[#FAF7F2]/95 shadow-2xl backdrop-blur-xl">
      <div className="border-b border-[#E7E0D8] bg-white/85 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Route className="h-4 w-4 text-[#FF4D00]" />
              <h3 className="text-sm font-semibold text-stone-950">Rota de visitas</h3>
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-stone-500">
              Clique nos negócios no mapa na ordem em que deseja visitá-los.
            </p>
          </div>
          <button
            type="button"
            onClick={onCloseMode}
            className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
            title="Encerrar modo de rota"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between text-[10px]">
          <span className="font-medium text-stone-500">
            {stops.length} {stops.length === 1 ? 'parada' : 'paradas'}
          </span>
          <span className="font-semibold text-stone-700">
            {visitedCount}/{stops.length} visitadas
          </span>
        </div>
      </div>

      <div className="max-h-[52vh] overflow-y-auto px-3 py-3 custom-scrollbar">
        {stops.length === 0 ? (
          <div className="rounded-xl border border-dashed border-stone-300 bg-white/70 px-4 py-6 text-center">
            <p className="text-[11px] font-semibold text-stone-700">Sua rota está vazia</p>
            <p className="mt-1 text-[10px] leading-relaxed text-stone-400">
              Clique em uma bolinha de negócio para adicionar a primeira parada.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {stops.map((stop, index) => (
              <div
                key={stop.business.id}
                className="rounded-xl border border-[#E7E0D8] bg-white px-3 py-3"
              >
                <div className="flex items-start gap-2.5">
                  <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                    stop.visitStatus === 'VISITADO'
                      ? 'bg-emerald-600'
                      : stop.visitStatus === 'PULADO'
                        ? 'bg-stone-500'
                        : 'bg-[#FF4D00]'
                  }`}>
                    {stop.visitStatus === 'VISITADO' ? <Check className="h-3.5 w-3.5" /> : index + 1}
                  </div>

                  <button
                    type="button"
                    onClick={() => onInspectBusiness(stop.business)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-[11px] font-semibold text-stone-900">
                      {stop.business.name}
                    </span>
                    <span className="mt-0.5 block truncate text-[9px] text-stone-400">
                      {stop.business.address || 'Endereço não identificado'}
                    </span>
                    <span className="mt-1 block text-[9px] text-stone-400">
                      CRM · {leadStatusLabel(stop.business.leadStatus)}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onRemoveStop(stop.business.id)}
                    className="rounded-md p-1 text-stone-300 transition hover:bg-stone-100 hover:text-red-500"
                    title="Remover da rota"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="mt-2.5 grid grid-cols-3 gap-1">
                  {(['PENDENTE', 'VISITADO', 'PULADO'] as VisitStatus[]).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => onSetVisitStatus(stop.business.id, status)}
                      className={`rounded-lg px-2 py-1.5 text-[9px] font-semibold transition ${
                        stop.visitStatus === status
                          ? status === 'VISITADO'
                            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                            : status === 'PULADO'
                              ? 'bg-stone-100 text-stone-700 ring-1 ring-stone-200'
                              : 'bg-[#FFF1E8] text-[#D94400] ring-1 ring-[#FF4D00]/20'
                          : 'bg-stone-50 text-stone-400 hover:bg-stone-100 hover:text-stone-600'
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
                  className={`mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-[9px] font-semibold transition ${
                    stop.business.leadStatus && stop.business.leadStatus !== 'NOVO'
                      ? 'cursor-default border-stone-200 bg-stone-50 text-stone-400'
                      : 'border-[#FF4D00]/20 bg-[#FFF7F2] text-[#D94400] hover:border-[#FF4D00]/40 hover:bg-[#FFF1E8]'
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

      <div className="border-t border-[#E7E0D8] bg-white/80 p-3">
        {googleRouteUrl && (
          <a
            href={googleRouteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#FF4D00] px-3 py-2.5 text-[10px] font-semibold text-white transition hover:bg-[#E04400]"
          >
            Abrir rota no Google Maps
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}

        {stops.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="mt-2 w-full rounded-lg px-3 py-2 text-[9px] font-medium text-stone-400 transition hover:bg-stone-100 hover:text-red-500"
          >
            Limpar rota
          </button>
        )}
      </div>
    </aside>
  );
}
