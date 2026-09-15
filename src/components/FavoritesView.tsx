import { useState, useMemo, memo } from 'react';
import {
  Star,
  Search,
  Download,
  Phone,
  ExternalLink,
  ChevronRight,
  Compass,
  Sparkles,
  Trash2,
  Filter,
} from 'lucide-react';
import { Business, LeadStatus } from '../types';
import { getWhatsAppLink, getTrustIcon } from '../services/api';

interface FavoritesViewProps {
  businesses: Business[];
  onSelectBusiness: (business: Business) => void;
  onUpdateLeadStatus: (id: string, status: LeadStatus, notes?: string) => void;
  onNavigateToExplore: () => void;
  onOpenAIChat: () => void;
}

function FavoritesView({
  businesses,
  onSelectBusiness,
  onUpdateLeadStatus,
  onNavigateToExplore,
  onOpenAIChat,
}: FavoritesViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('TODOS');

  // Saved leads are businesses that have a status or are in userLeads
  const savedLeads = useMemo(() => {
    return businesses.filter(
      (b) => b.leadStatus && b.leadStatus !== 'NOVO'
    );
  }, [businesses]);

  const filteredLeads = useMemo(() => {
    return savedLeads.filter((b) => {
      if (selectedStatusFilter !== 'TODOS' && b.leadStatus !== selectedStatusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = b.name.toLowerCase().includes(q);
        const matchCat = b.category.toLowerCase().includes(q);
        const matchAddr = b.address.toLowerCase().includes(q);
        const matchNotes = (b.notes || '').toLowerCase().includes(q);
        if (!matchName && !matchCat && !matchAddr && !matchNotes) return false;
      }
      return true;
    });
  }, [savedLeads, selectedStatusFilter, searchQuery]);

  // Export leads to CSV
  const handleExportCSV = () => {
    if (savedLeads.length === 0) return;

    const headers = [
      'ID',
      'Nome da Empresa',
      'Categoria',
      'Status do Lead',
      'Telefone',
      'Tem Website',
      'Website',
      'Endereço',
      'Anotações',
    ];

    const rows = savedLeads.map((b) => [
      `"${b.id}"`,
      `"${b.name.replace(/"/g, '""')}"`,
      `"${b.category.replace(/"/g, '""')}"`,
      `"${b.leadStatus}"`,
      `"${b.phone || (b.phones && b.phones[0]) || ''}"`,
      b.website ? 'Sim' : 'Não',
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
      `scoutly-leads-favoritos-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const statusColors: Record<LeadStatus, { bg: string; text: string; border: string }> = {
    NOVO: { bg: 'bg-stone-100', text: 'text-stone-700', border: 'border-stone-200' },
    CONTATADO: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    EM_NEGOCIACAO: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    FECHADO: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    PERDIDO: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
    ARQUIVADO: { bg: 'bg-stone-100', text: 'text-stone-500', border: 'border-stone-200' },
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FAF7F2] overflow-y-auto p-4 md:p-8">
      <div className="max-w-7xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-100 text-amber-900 rounded-xl">
                <Star className="w-5 h-5 fill-amber-500 text-amber-500" />
              </div>
              <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
                Favoritos & Leads Salvos
              </h1>
            </div>
            <p className="text-xs text-stone-500 font-medium mt-1">
              Gerencie as oportunidades que você marcou para contato ou acompanhamento comercial.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={savedLeads.length === 0}
              className="px-4 py-2.5 bg-white border border-[#EDE8E0] hover:bg-stone-50 text-stone-800 rounded-2xl text-xs font-bold transition shadow-2xs flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4 text-stone-600" />
              <span>Exportar CSV ({savedLeads.length})</span>
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-4 bg-white rounded-3xl border border-[#EDE8E0] shadow-2xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome, categoria ou anotações..."
              className="w-full bg-[#FAF7F2] border border-[#EDE8E0] rounded-2xl pl-10 pr-4 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#FF4D00]"
            />
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 md:pb-0">
            {['TODOS', 'CONTATADO', 'EM_NEGOCIACAO', 'FECHADO', 'PERDIDO'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setSelectedStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  selectedStatusFilter === st
                    ? 'bg-stone-900 text-white shadow-2xs'
                    : 'bg-[#FAF7F2] text-stone-600 hover:bg-stone-100 border border-[#EDE8E0]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Lead List / Empty State */}
        {filteredLeads.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-[#EDE8E0] shadow-2xs flex flex-col items-center justify-center max-w-lg mx-auto mt-8">
            <div className="w-14 h-14 rounded-3xl bg-[#FFF0E6] flex items-center justify-center text-[#FF4D00] mb-4">
              <Star className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-stone-900 mb-1">
              Nenhum lead encontrado nesta visualização
            </h3>
            <p className="text-xs text-stone-500 max-w-sm mb-6">
              Você pode marcar empresas no mapa clicando em <strong>"Adicionar à lista"</strong> ou
              pedir para o <strong>Scoutly Copilot</strong> encontrar as melhores oportunidades para você.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onNavigateToExplore}
                className="px-4 py-2.5 bg-stone-900 hover:bg-[#FF4D00] text-white rounded-2xl text-xs font-bold transition shadow-xs flex items-center gap-2 cursor-pointer"
              >
                <Compass className="w-4 h-4" />
                <span>Explorar no Radar</span>
              </button>
              <button
                type="button"
                onClick={onOpenAIChat}
                className="px-4 py-2.5 bg-white border border-[#EDE8E0] hover:bg-stone-50 text-stone-800 rounded-2xl text-xs font-bold transition shadow-2xs flex items-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-[#FF4D00]" />
                <span>Pedir à IA</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLeads.map((biz) => {
              const waLink = getWhatsAppLink(biz.phone || (biz.phones && biz.phones[0]));
              const hasWebsite = Boolean(biz.website);
              const statusCfg = statusColors[biz.leadStatus] || statusColors.CONTATADO;

              return (
                <div
                  key={biz.id}
                  className="p-5 bg-white rounded-3xl border border-[#EDE8E0] shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between group"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-600 uppercase tracking-wider">
                          {biz.category}
                        </span>
                        <h3 className="text-sm font-bold text-stone-900 mt-1.5 leading-snug group-hover:text-[#FF4D00] transition">
                          {biz.name}
                        </h3>
                      </div>

                      {/* Status Badge & Trust Icon */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-xl border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                        >
                          {biz.leadStatus}
                        </span>
                        <img
                          src={getTrustIcon(biz.confidence || 0.8)}
                          alt="Confiança"
                          className="w-4 h-4 object-contain"
                          title={`Confiança dos dados: ${Math.round((biz.confidence || 0.8) * 100)}%`}
                        />
                      </div>
                    </div>

                    <p className="text-xs text-stone-500 line-clamp-2">
                      📍 {biz.address || 'Endereço na região ativa'}
                    </p>

                    {/* Notes preview if any */}
                    {biz.notes && (
                      <div className="p-2.5 bg-[#FAF7F2] rounded-xl border border-[#EDE8E0] text-[11px] text-stone-700 italic">
                        "{biz.notes}"
                      </div>
                    )}
                  </div>

                  {/* Actions footer */}
                  <div className="mt-4 pt-3.5 border-t border-stone-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {waLink && (
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl transition cursor-pointer"
                          title="Abrir WhatsApp"
                        >
                          <img
                            src="/whatsapp_icone.png"
                            alt="WhatsApp"
                            className="w-4 h-4 object-contain"
                          />
                        </a>
                      )}
                      {hasWebsite && (
                        <a
                          href={biz.website!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 rounded-xl transition cursor-pointer"
                          title="Abrir Site"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      {/* Remove / Reset */}
                      <button
                        type="button"
                        onClick={() => onUpdateLeadStatus(biz.id, 'NOVO')}
                        className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                        title="Remover dos favoritos"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectBusiness(biz)}
                      className="inline-flex items-center gap-1 px-3.5 py-2 bg-stone-900 hover:bg-[#FF4D00] text-white rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
                    >
                      <span>Ver detalhes</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
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

export default memo(FavoritesView);
