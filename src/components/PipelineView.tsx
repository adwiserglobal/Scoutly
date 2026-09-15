import { useState, useMemo, memo } from 'react';
import {
  Columns3,
  Search,
  Download,
  Plus,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  CheckCircle2,
  TrendingUp,
  Target,
  Sparkles,
  GripVertical,
  Compass,
} from 'lucide-react';
import { Business, LeadStatus } from '../types';
import { getWhatsAppLink, getTrustIcon } from '../services/api';

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
  badgeBg: string;
  badgeText: string;
  headerBg: string;
  borderColor: string;
}

const COLUMNS: ColumnConfig[] = [
  {
    id: 'CONTATADO',
    title: 'Contatados',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-800',
    headerBg: 'bg-blue-50/50',
    borderColor: 'border-blue-200',
  },
  {
    id: 'EM_NEGOCIACAO',
    title: 'Em Negociação',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-800',
    headerBg: 'bg-amber-50/50',
    borderColor: 'border-amber-200',
  },
  {
    id: 'FECHADO',
    title: 'Fechados / Clientes',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-800',
    headerBg: 'bg-emerald-50/50',
    borderColor: 'border-emerald-200',
  },
  {
    id: 'PERDIDO',
    title: 'Perdidos / Desistência',
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-800',
    headerBg: 'bg-rose-50/50',
    borderColor: 'border-rose-200',
  },
];

const STAGE_ORDER: LeadStatus[] = [
  'CONTATADO',
  'EM_NEGOCIACAO',
  'FECHADO',
  'PERDIDO',
];

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

  // Active pipeline items ONLY (excluding 'NOVO' un-added map businesses)
  const activePipelineLeads = useMemo(() => {
    return businesses.filter(
      (b) => b.leadStatus && b.leadStatus !== 'NOVO'
    );
  }, [businesses]);

  // Group businesses by status
  const pipelineData = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    const grouped: Record<LeadStatus, Business[]> = {
      NOVO: [],
      CONTATADO: [],
      EM_NEGOCIACAO: [],
      FECHADO: [],
      PERDIDO: [],
      ARQUIVADO: [],
    };

    activePipelineLeads.forEach((biz) => {
      const status = biz.leadStatus || 'CONTATADO';
      if (q) {
        const match =
          biz.name.toLowerCase().includes(q) ||
          biz.category.toLowerCase().includes(q) ||
          (biz.notes || '').toLowerCase().includes(q);
        if (!match) return;
      }
      if (grouped[status]) {
        grouped[status].push(biz);
      } else {
        grouped.CONTATADO.push(biz);
      }
    });

    return grouped;
  }, [activePipelineLeads, searchQuery]);

  // Metrics
  const totalInPipeline = activePipelineLeads.length;
  const contactedCount = (pipelineData.CONTATADO || []).length;
  const negotiatingCount = (pipelineData.EM_NEGOCIACAO || []).length;
  const closedCount = (pipelineData.FECHADO || []).length;
  const conversionRate =
    totalInPipeline > 0 ? Math.round((closedCount / totalInPipeline) * 100) : 0;

  // Move lead between stages
  const moveLead = (biz: Business, direction: 'next' | 'prev') => {
    const currentIdx = STAGE_ORDER.indexOf(biz.leadStatus || 'CONTATADO');
    const nextIdx = direction === 'next' ? currentIdx + 1 : currentIdx - 1;
    if (nextIdx >= 0 && nextIdx < STAGE_ORDER.length) {
      onUpdateLeadStatus(biz.id, STAGE_ORDER[nextIdx], biz.notes);
    }
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, bizId: string) => {
    e.dataTransfer.setData('text/plain', bizId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedBizId(bizId);
  };

  const handleDragEnd = () => {
    setDraggedBizId(null);
    setDragOverColId(null);
  };

  const handleDragOver = (e: React.DragEvent, colId: LeadStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColId !== colId) {
      setDragOverColId(colId);
    }
  };

  const handleDragLeave = (e: React.DragEvent, colId: LeadStatus) => {
    e.preventDefault();
    if (dragOverColId === colId) {
      setDragOverColId(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetStatus: LeadStatus) => {
    e.preventDefault();
    const bizId = e.dataTransfer.getData('text/plain') || draggedBizId;
    if (bizId) {
      const targetBiz = businesses.find((b) => b.id === bizId);
      if (targetBiz && targetBiz.leadStatus !== targetStatus) {
        onUpdateLeadStatus(bizId, targetStatus, targetBiz.notes);
      }
    }
    setDraggedBizId(null);
    setDragOverColId(null);
  };

  const handleExportPipeline = () => {
    if (activePipelineLeads.length === 0) return;

    const headers = [
      'ID',
      'Nome da Empresa',
      'Categoria',
      'Etapa Pipeline',
      'Telefone',
      'Website',
      'Endereço',
      'Anotações',
    ];

    const rows = activePipelineLeads.map((b) => [
      `"${b.id}"`,
      `"${b.name.replace(/"/g, '""')}"`,
      `"${b.category.replace(/"/g, '""')}"`,
      `"${b.leadStatus}"`,
      `"${b.phone || (b.phones && b.phones[0]) || ''}"`,
      `"${b.website || ''}"`,
      `"${b.address.replace(/"/g, '""')}"`,
      `"${(b.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `scoutly-pipeline-funil-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FAF7F2] overflow-y-auto p-4 md:p-8">
      <div className="max-w-[1600px] mx-auto w-full space-y-6">
        {/* Header and Funnel Metrics */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-[#FF4D00]/10 text-[#FF4D00] rounded-xl">
                <Columns3 className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
                Pipeline Comercial (Kanban)
              </h1>
            </div>
            <p className="text-xs text-stone-500 font-medium mt-1">
              Arraste as empresas entre os estágios para atualizar o progresso comercial.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="px-4 py-2 bg-white rounded-2xl border border-[#EDE8E0] shadow-2xs flex items-center gap-2.5">
              <Target className="w-4 h-4 text-stone-400" />
              <div>
                <span className="text-[10px] uppercase font-bold text-stone-400 block leading-tight">
                  No Pipeline
                </span>
                <span className="text-xs font-bold text-stone-900">
                  {totalInPipeline} empresas
                </span>
              </div>
            </div>

            <div className="px-4 py-2 bg-white rounded-2xl border border-[#EDE8E0] shadow-2xs flex items-center gap-2.5">
              <TrendingUp className="w-4 h-4 text-amber-500" />
              <div>
                <span className="text-[10px] uppercase font-bold text-stone-400 block leading-tight">
                  Em Negociação
                </span>
                <span className="text-xs font-bold text-amber-700">
                  {negotiatingCount} leads
                </span>
              </div>
            </div>

            <div className="px-4 py-2 bg-white rounded-2xl border border-[#EDE8E0] shadow-2xs flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <div>
                <span className="text-[10px] uppercase font-bold text-stone-400 block leading-tight">
                  Fechados
                </span>
                <span className="text-xs font-bold text-emerald-700">
                  {closedCount} ({conversionRate}%)
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleExportPipeline}
              disabled={totalInPipeline === 0}
              className="px-4 py-2.5 bg-white border border-[#EDE8E0] hover:bg-stone-50 disabled:opacity-50 text-stone-800 rounded-2xl text-xs font-bold transition shadow-2xs flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4 text-stone-600" />
              <span>Exportar Funil</span>
            </button>
          </div>
        </div>

        {/* Search Bar in Pipeline */}
        {totalInPipeline > 0 && (
          <div className="p-3 bg-white rounded-2xl border border-[#EDE8E0] shadow-2xs flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar empresas no pipeline por nome ou categoria..."
                className="w-full bg-[#FAF7F2] border border-[#EDE8E0] rounded-xl pl-10 pr-4 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#FF4D00]"
              />
            </div>
            <button
              type="button"
              onClick={onOpenAIChat}
              className="px-3.5 py-2 bg-stone-900 hover:bg-[#FF4D00] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Sugerir Abordagens IA</span>
            </button>
          </div>
        )}

        {/* Empty Pipeline Banner */}
        {totalInPipeline === 0 ? (
          <div className="p-12 bg-white rounded-3xl border border-[#EDE8E0] text-center max-w-xl mx-auto space-y-4 my-8 shadow-xs">
            <div className="w-16 h-16 bg-[#FF4D00]/10 text-[#FF4D00] rounded-2xl flex items-center justify-center mx-auto">
              <Columns3 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-stone-900">
                Seu Pipeline Comercial está vazio
              </h3>
              <p className="text-xs text-stone-500 mt-1 max-w-md mx-auto leading-relaxed">
                Nenhuma empresa foi adicionada ao pipeline ainda. Explore o mapa de prospecção, clique em uma empresa e pressione o botão <strong className="text-stone-800 font-bold">"Adicionar ao pipeline"</strong>.
              </p>
            </div>
            {onNavigateToExplore && (
              <button
                type="button"
                onClick={onNavigateToExplore}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#FF4D00] hover:bg-[#E04400] text-white rounded-xl text-xs font-bold transition shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer"
              >
                <Compass className="w-4 h-4" />
                <span>Explorar Empresas no Mapa</span>
              </button>
            )}
          </div>
        ) : (
          /* Kanban Board Columns */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start min-h-[500px]">
            {COLUMNS.map((col) => {
              const list = pipelineData[col.id] || [];
              const colIdx = STAGE_ORDER.indexOf(col.id);
              const isDragOver = dragOverColId === col.id;

              return (
                <div
                  key={col.id}
                  onDragOver={(e) => handleDragOver(e, col.id)}
                  onDragLeave={(e) => handleDragLeave(e, col.id)}
                  onDrop={(e) => handleDrop(e, col.id)}
                  className={`bg-[#F7F3EC]/80 rounded-3xl border transition-all duration-200 p-3 flex flex-col min-h-[480px] max-h-[calc(100vh-220px)] shadow-2xs ${
                    isDragOver
                      ? 'border-[#FF4D00] ring-2 ring-[#FF4D00]/20 bg-[#FFF0E6]/50 scale-[1.01]'
                      : col.borderColor
                  }`}
                >
                  {/* Column Header */}
                  <div
                    className={`p-3 rounded-2xl ${col.headerBg} border border-stone-200/60 mb-3 flex items-center justify-between`}
                  >
                    <span className="text-xs font-bold text-stone-900">
                      {col.title}
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${col.badgeBg} ${col.badgeText}`}
                    >
                      {list.length}
                    </span>
                  </div>

                  {/* Card List in Column */}
                  <div className="space-y-3 overflow-y-auto no-scrollbar flex-1 pr-0.5">
                    {list.length === 0 ? (
                      <div
                        className={`p-8 text-center border-2 border-dashed rounded-2xl transition ${
                          isDragOver
                            ? 'border-[#FF4D00] bg-[#FF4D00]/5 text-[#FF4D00]'
                            : 'border-stone-300/70 text-stone-400'
                        }`}
                      >
                        <span className="text-xs font-medium block">
                          {isDragOver ? 'Solte para mover para esta etapa' : 'Arraste um item para cá'}
                        </span>
                      </div>
                    ) : (
                      list.map((biz) => {
                        const waLink = getWhatsAppLink(
                          biz.phone || (biz.phones && biz.phones[0])
                        );
                        const hasWebsite = Boolean(biz.website);
                        const confidencePercent = Math.round(
                          (biz.confidence || 0.8) * 100
                        );
                        const isBeingDragged = draggedBizId === biz.id;

                        return (
                          <div
                            key={biz.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, biz.id)}
                            onDragEnd={handleDragEnd}
                            className={`p-4 bg-white rounded-2xl border border-[#EDE8E0] shadow-2xs hover:shadow-md transition-all duration-200 space-y-3 group cursor-grab active:cursor-grabbing ${
                              isBeingDragged ? 'opacity-40 scale-95 border-dashed border-[#FF4D00]' : ''
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 uppercase tracking-wider">
                                  {biz.category}
                                </span>
                                <h4 className="text-xs font-bold text-stone-900 mt-1 leading-snug group-hover:text-[#FF4D00] transition flex items-center gap-1.5">
                                  <GripVertical className="w-3.5 h-3.5 text-stone-300 shrink-0 group-hover:text-stone-500" />
                                  <span className="truncate">{biz.name}</span>
                                </h4>
                                <p className="text-[11px] text-stone-500 mt-0.5 truncate">
                                  {biz.address || 'Endereço ativo'}
                                </p>
                              </div>

                              {/* Trust Speedometer Icon */}
                              <div className="shrink-0 flex items-center gap-1 text-[10px] font-bold text-stone-500 bg-[#FAF7F2] px-1.5 py-0.5 rounded-md border border-[#EDE8E0]">
                                <span>{confidencePercent}%</span>
                                <img
                                  src={getTrustIcon(biz.confidence || 0.8)}
                                  alt="Confiança"
                                  className="w-3.5 h-3.5 object-contain"
                                  title={`Confiança dos dados: ${confidencePercent}%`}
                                />
                              </div>
                            </div>

                            {biz.notes && (
                              <div className="p-2 bg-[#FAF7F2] rounded-lg border border-[#EDE8E0] text-[10px] text-stone-600 line-clamp-2">
                                {biz.notes}
                              </div>
                            )}

                            {/* Action icons & Stage Transition Controls */}
                            <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-1.5">
                              <div className="flex items-center gap-1">
                                {waLink && (
                                  <a
                                    href={waLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg transition"
                                    title="WhatsApp"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <img
                                      src="/whatsapp_icone.png"
                                      alt="WhatsApp"
                                      className="w-3.5 h-3.5 object-contain"
                                    />
                                  </a>
                                )}
                                {hasWebsite && (
                                  <a
                                    href={biz.website!}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 bg-stone-50 hover:bg-stone-100 text-stone-700 rounded-lg transition"
                                    title="Site"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                <button
                                  type="button"
                                  onClick={() => onSelectBusiness(biz)}
                                  className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg text-[11px] font-semibold transition"
                                  title="Ver ficha completa"
                                >
                                  Ficha
                                </button>
                              </div>

                              {/* Move left / right arrows */}
                              <div className="flex items-center gap-1">
                                {colIdx > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => moveLead(biz, 'prev')}
                                    className="p-1 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-md transition cursor-pointer"
                                    title="Recuar etapa"
                                  >
                                    <ArrowLeft className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {colIdx < STAGE_ORDER.length - 1 && (
                                  <button
                                    type="button"
                                    onClick={() => moveLead(biz, 'next')}
                                    className="p-1 text-stone-700 hover:text-white hover:bg-stone-900 rounded-md transition cursor-pointer"
                                    title="Avançar etapa"
                                  >
                                    <ArrowRight className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(PipelineView);
