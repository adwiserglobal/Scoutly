import { memo, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Compass,
  Download,
  ExternalLink,
  GripVertical,
  Search,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { Business, LeadStatus } from '../types';
import { getTrustIcon, getWhatsAppLink } from '../services/api';
import { recordRecommendationWhatsApp } from '../utils/recommendations';

interface PipelineViewProps {
  businesses: Business[];
  onSelectBusiness: (business: Business) => void;
  onUpdateLeadStatus: (id: string, status: LeadStatus, notes?: string) => void;
  onOpenAIChat: () => void;
  onNavigateToExplore?: () => void;
}

interface ColumnConfig {
  id: LeadStatus;
  title: string;
  accent: string;
  badge: string;
}

const COLUMNS: ColumnConfig[] = [
  { id: 'CONTATADO', title: 'Contatados', accent: 'border-blue-500/25', badge: 'bg-blue-500/[0.10] text-blue-400' },
  { id: 'EM_NEGOCIACAO', title: 'Em negociação', accent: 'border-amber-500/25', badge: 'bg-amber-500/[0.10] text-amber-400' },
  { id: 'FECHADO', title: 'Fechados', accent: 'border-emerald-500/25', badge: 'bg-emerald-500/[0.10] text-emerald-400' },
  { id: 'PERDIDO', title: 'Perdidos', accent: 'border-rose-500/25', badge: 'bg-rose-500/[0.10] text-rose-400' },
];

const STAGE_ORDER: LeadStatus[] = ['CONTATADO', 'EM_NEGOCIACAO', 'FECHADO', 'PERDIDO'];

function PipelineView({
  businesses,
  onSelectBusiness,
  onUpdateLeadStatus,
  onOpenAIChat,
  onNavigateToExplore,
}: PipelineViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [draggedBizId, setDraggedBizId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<LeadStatus | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const activePipelineLeads = useMemo(
    () => businesses.filter((business) => business.leadStatus && business.leadStatus !== 'NOVO' && business.leadStatus !== 'ARQUIVADO'),
    [businesses]
  );

  const pipelineData = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const grouped: Record<LeadStatus, Business[]> = {
      NOVO: [],
      CONTATADO: [],
      EM_NEGOCIACAO: [],
      FECHADO: [],
      PERDIDO: [],
      ARQUIVADO: [],
    };

    activePipelineLeads.forEach((business) => {
      if (
        q &&
        ![business.name, business.category, business.address, business.notes || '']
          .some((value) => value.toLowerCase().includes(q))
      ) {
        return;
      }

      const status = business.leadStatus || 'CONTATADO';
      if (grouped[status]) grouped[status].push(business);
      else grouped.CONTATADO.push(business);
    });

    return grouped;
  }, [activePipelineLeads, searchQuery]);

  const totalInPipeline = activePipelineLeads.length;
  const negotiatingCount = pipelineData.EM_NEGOCIACAO.length;
  const closedCount = pipelineData.FECHADO.length;
  const conversionRate = totalInPipeline > 0 ? Math.round((closedCount / totalInPipeline) * 100) : 0;

  const saveComment = (business: Business) => {
    const draft = noteDrafts[business.id] ?? business.notes ?? '';
    if (draft === (business.notes || '')) return;
    onUpdateLeadStatus(
      business.id,
      business.leadStatus && business.leadStatus !== 'NOVO' ? business.leadStatus : 'CONTATADO',
      draft
    );
  };

  const removeFromPipeline = (business: Business) => {
    setNoteDrafts((current) => {
      const next = { ...current };
      delete next[business.id];
      return next;
    });
    onUpdateLeadStatus(business.id, 'NOVO', business.notes || '');
  };

  const moveLead = (business: Business, direction: 'next' | 'prev') => {
    const currentIndex = STAGE_ORDER.indexOf(business.leadStatus || 'CONTATADO');
    const nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;

    if (nextIndex >= 0 && nextIndex < STAGE_ORDER.length) {
      onUpdateLeadStatus(business.id, STAGE_ORDER[nextIndex], business.notes);
    }
  };

  const handleDragStart = (event: React.DragEvent, businessId: string) => {
    event.dataTransfer.setData('text/plain', businessId);
    event.dataTransfer.effectAllowed = 'move';
    setDraggedBizId(businessId);
  };

  const handleDragOver = (event: React.DragEvent, columnId: LeadStatus) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverColId(columnId);
  };

  const handleDrop = (event: React.DragEvent, targetStatus: LeadStatus) => {
    event.preventDefault();
    const businessId = event.dataTransfer.getData('text/plain') || draggedBizId;
    const business = businesses.find((item) => item.id === businessId);

    if (business && business.leadStatus !== targetStatus) {
      onUpdateLeadStatus(business.id, targetStatus, business.notes);
    }

    setDraggedBizId(null);
    setDragOverColId(null);
  };

  const handleExportPipeline = () => {
    if (activePipelineLeads.length === 0) return;

    const headers = ['ID', 'Nome da Empresa', 'Categoria', 'Etapa Pipeline', 'Telefone', 'Website', 'Endereço', 'Anotações'];
    const rows = activePipelineLeads.map((business) => [
      `"${business.id}"`,
      `"${business.name.replace(/"/g, '""')}"`,
      `"${business.category.replace(/"/g, '""')}"`,
      `"${business.leadStatus}"`,
      `"${business.phone || business.phones?.[0] || ''}"`,
      `"${business.website || ''}"`,
      `"${business.address.replace(/"/g, '""')}"`,
      `"${(business.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csv = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map((row) => row.join(';'))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    link.setAttribute('download', `scoutly-pipeline-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="h-full flex-1 overflow-y-auto bg-[#090c10] px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white">Pipeline</h1>
            <p className="mt-1 text-xs text-stone-500">Organize prospects por estágio e acompanhe o avanço comercial.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-11 items-center gap-2.5 rounded-2xl border border-white/[0.08] bg-[#111418] px-3.5">
              <Target className="h-4 w-4 text-stone-500" />
              <div>
                <span className="block text-[8px] font-semibold uppercase tracking-[0.1em] text-stone-600">No pipeline</span>
                <span className="text-[11px] font-semibold text-stone-200">{totalInPipeline} empresas</span>
              </div>
            </div>

            <div className="flex h-11 items-center gap-2.5 rounded-2xl border border-white/[0.08] bg-[#111418] px-3.5">
              <TrendingUp className="h-4 w-4 text-amber-400" />
              <div>
                <span className="block text-[8px] font-semibold uppercase tracking-[0.1em] text-stone-600">Negociação</span>
                <span className="text-[11px] font-semibold text-stone-200">{negotiatingCount}</span>
              </div>
            </div>

            <div className="flex h-11 items-center gap-2.5 rounded-2xl border border-white/[0.08] bg-[#111418] px-3.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <div>
                <span className="block text-[8px] font-semibold uppercase tracking-[0.1em] text-stone-600">Conversão</span>
                <span className="text-[11px] font-semibold text-stone-200">{closedCount} · {conversionRate}%</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleExportPipeline}
              disabled={totalInPipeline === 0}
              className="flex h-11 items-center gap-2 rounded-2xl border border-white/[0.08] bg-[#111418] px-3.5 text-[11px] font-semibold text-stone-300 transition hover:border-white/[0.14] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              Exportar
            </button>
          </div>
        </header>

        {totalInPipeline > 0 && (
          <section className="flex flex-col gap-3 rounded-[22px] border border-white/[0.08] bg-[#101318] p-3 md:flex-row md:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-600" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Filtrar pipeline por nome, categoria ou comentário"
                className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#0b0e12] pl-10 pr-4 text-xs text-white outline-none placeholder:text-stone-600 focus:border-[#FF5A12]/50"
              />
            </div>

            <button
              type="button"
              onClick={onOpenAIChat}
              className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#FF5A12]/20 bg-[#FF5A12]/[0.08] px-3.5 text-[10px] font-semibold text-[#FF7A3D] transition hover:bg-[#FF5A12]/[0.13]"
            >
              <Sparkles className="h-4 w-4" />
              Sugerir abordagens
            </button>
          </section>
        )}

        {totalInPipeline === 0 ? (
          <section className="mx-auto flex min-h-[540px] max-w-2xl flex-col items-center justify-center px-6 py-12 text-center">
            <img
              src="/empty-pipeline.svg"
              alt=""
              className="mb-7 h-36 w-36 object-contain sm:h-40 sm:w-40"
            />
            <h2 className="text-xl font-semibold tracking-[-0.02em] text-white">Seu pipeline está vazio</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-stone-500">
              Adicione empresas ao pipeline para organizar prospecções, acompanhar negociações e manter próximos passos visíveis.
            </p>
            {onNavigateToExplore && (
              <button
                type="button"
                onClick={onNavigateToExplore}
                className="mt-6 flex h-10 items-center gap-2 rounded-xl bg-[#FF5A12] px-4 text-xs font-semibold text-white transition hover:bg-[#ff6a27]"
              >
                <Compass className="h-4 w-4" />
                Explorar empresas
              </button>
            )}
          </section>
        ) : (
          <div className="grid min-h-[520px] grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
            {COLUMNS.map((column) => {
              const list = pipelineData[column.id] || [];
              const columnIndex = STAGE_ORDER.indexOf(column.id);
              const isDragOver = dragOverColId === column.id;

              return (
                <section
                  key={column.id}
                  onDragOver={(event) => handleDragOver(event, column.id)}
                  onDragLeave={() => setDragOverColId(null)}
                  onDrop={(event) => handleDrop(event, column.id)}
                  className={`flex min-h-[500px] max-h-[calc(100vh-230px)] flex-col rounded-[22px] border bg-[#0f1216] p-3 transition ${
                    isDragOver
                      ? 'border-[#FF5A12]/60 bg-[#FF5A12]/[0.035] ring-1 ring-[#FF5A12]/20'
                      : column.accent
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between rounded-2xl border border-white/[0.07] bg-[#15191e] px-3 py-3">
                    <span className="text-[11px] font-semibold text-stone-200">{column.title}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${column.badge}`}>
                      {list.length}
                    </span>
                  </div>

                  <div className="flex-1 space-y-2.5 overflow-y-auto pr-0.5 no-scrollbar">
                    {list.length === 0 ? (
                      <div className={`flex min-h-[110px] items-center justify-center rounded-2xl border border-dashed px-4 text-center ${
                        isDragOver ? 'border-[#FF5A12]/50 text-[#FF7A3D]' : 'border-white/[0.09] text-stone-700'
                      }`}>
                        <span className="text-[10px] font-medium">
                          {isDragOver ? 'Solte para mover para esta etapa' : 'Arraste uma empresa para cá'}
                        </span>
                      </div>
                    ) : (
                      list.map((business) => {
                        const waLink = getWhatsAppLink(business.phone || business.phones?.[0]);
                        const confidence = Math.round((business.confidence || 0.8) * 100);
                        const hasWebsite = Boolean(business.website);
                        const isBeingDragged = draggedBizId === business.id;

                        return (
                          <article
                            key={business.id}
                            draggable
                            onDragStart={(event) => handleDragStart(event, business.id)}
                            onDragEnd={() => {
                              setDraggedBizId(null);
                              setDragOverColId(null);
                            }}
                            className={`group cursor-grab rounded-2xl border bg-[#171a1f] p-3.5 shadow-[0_10px_28px_rgba(0,0,0,0.16)] transition active:cursor-grabbing ${
                              isBeingDragged
                                ? 'scale-[0.98] border-[#FF5A12]/60 opacity-45'
                                : 'border-white/[0.08] hover:border-white/[0.14] hover:bg-[#1a1e23]'
                            }`}
                          >
                            <div className="flex items-start gap-2.5">
                              <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-stone-700 transition group-hover:text-stone-500" />

                              <div className="min-w-0 flex-1">
                                <span className="inline-flex rounded-lg bg-white/[0.035] px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.08em] text-stone-500">
                                  {business.category}
                                </span>
                                <h3 className="mt-1.5 truncate text-[12px] font-semibold text-white">{business.name}</h3>
                                <p className="mt-0.5 truncate text-[9.5px] text-stone-600">{business.address || 'Endereço disponível'}</p>
                              </div>

                              <div className="flex shrink-0 items-center gap-1 text-[9px] font-semibold text-stone-500">
                                <span>{confidence}%</span>
                                <img
                                  src={getTrustIcon(business.confidence || 0.8)}
                                  alt=""
                                  className="h-3.5 w-3.5 object-contain opacity-75"
                                  title={`Confiança dos dados: ${confidence}%`}
                                />
                              </div>
                            </div>

                            <div className="mt-3">
                              <textarea
                                value={noteDrafts[business.id] ?? business.notes ?? ''}
                                onChange={(event) =>
                                  setNoteDrafts((current) => ({
                                    ...current,
                                    [business.id]: event.target.value,
                                  }))
                                }
                                onBlur={() => saveComment(business)}
                                onKeyDown={(event) => {
                                  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                                    event.currentTarget.blur();
                                  }
                                }}
                                onClick={(event) => event.stopPropagation()}
                                placeholder="Adicionar comentário..."
                                rows={2}
                                className="w-full resize-none rounded-xl border border-white/[0.07] bg-black/[0.14] px-2.5 py-2 text-[9.5px] leading-relaxed text-stone-300 outline-none placeholder:text-stone-700 focus:border-[#FF5A12]/35"
                              />
                            </div>

                            <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.07] pt-2.5">
                              <div className="flex items-center gap-1">
                                {waLink && (
                                  <a
                                    href={waLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      recordRecommendationWhatsApp(business);
                                    }}
                                    className="flex h-7 items-center rounded-lg border border-emerald-500/20 bg-emerald-500/[0.07] px-2 text-[9px] font-semibold text-emerald-400"
                                  >
                                    WA
                                  </a>
                                )}

                                {hasWebsite && (
                                  <a
                                    href={business.website!}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(event) => event.stopPropagation()}
                                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.025] text-stone-500 transition hover:text-white"
                                    title="Abrir site"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}

                                <button
                                  type="button"
                                  onClick={() => onSelectBusiness(business)}
                                  className="flex h-7 items-center rounded-lg border border-white/[0.07] bg-white/[0.025] px-2 text-[9px] font-semibold text-stone-400 transition hover:text-white"
                                >
                                  Ficha
                                </button>

                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    removeFromPipeline(business);
                                  }}
                                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-500/10 bg-rose-500/[0.04] text-stone-600 transition hover:border-rose-500/25 hover:bg-rose-500/[0.09] hover:text-rose-400"
                                  title="Remover do pipeline"
                                  aria-label="Remover do pipeline"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>

                              <div className="flex items-center gap-1">
                                {columnIndex > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => moveLead(business, 'prev')}
                                    className="flex h-7 w-7 items-center justify-center rounded-lg text-stone-600 transition hover:bg-white/[0.05] hover:text-white"
                                    title="Recuar etapa"
                                  >
                                    <ArrowLeft className="h-3.5 w-3.5" />
                                  </button>
                                )}
                                {columnIndex < STAGE_ORDER.length - 1 && (
                                  <button
                                    type="button"
                                    onClick={() => moveLead(business, 'next')}
                                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FF5A12]/[0.08] text-[#FF7A3D] transition hover:bg-[#FF5A12]/[0.14]"
                                    title="Avançar etapa"
                                  >
                                    <ArrowRight className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </article>
                        );
                      })
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(PipelineView);
