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
  Columns3,
} from 'lucide-react';
import { Business, LeadStatus } from '../types';
import { getWhatsAppLink, getTrustIcon } from '../services/api';
import { usePageSpeed } from '../hooks/usePageSpeed';

interface FavoritesViewProps {
  businesses: Business[];
  onSelectBusiness: (business: Business) => void;
  onUpdateLeadStatus: (id: string, status: LeadStatus, notes?: string) => void;
  onToggleFavorite?: (business: Business) => void;
  onNavigateToExplore: () => void;
  onOpenAIChat: () => void;
}

// Subcomponent to fetch and render PageSpeed score cleanly on each favorite card
function FavoriteCard({
  biz,
  onSelect,
  onToggleFavorite,
  onUpdateLeadStatus,
}: {
  biz: Business;
  onSelect: (b: Business) => void;
  onToggleFavorite?: (b: Business) => void;
  onUpdateLeadStatus: (id: string, status: LeadStatus, notes?: string) => void;
}) {
  const waLink = getWhatsAppLink(biz.phone || (biz.phones && biz.phones[0]));
  const hasWebsite = Boolean(biz.website);
  const { data: pageSpeed, isLoading: isSpeedLoading } = usePageSpeed(
    hasWebsite ? biz.website : null
  );

  const statusColors: Record<LeadStatus, { bg: string; text: string; border: string; label: string }> = {
    NOVO: { bg: 'bg-stone-100', text: 'text-stone-600', border: 'border-stone-200', label: 'Fora do Funil' },
    CONTATADO: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', label: 'Contatado' },
    EM_NEGOCIACAO: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Em Negociação' },
    FECHADO: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Fechado' },
    PERDIDO: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', label: 'Perdido' },
    ARQUIVADO: { bg: 'bg-stone-100', text: 'text-stone-500', border: 'border-stone-200', label: 'Arquivado' },
  };

  const statusCfg = statusColors[biz.leadStatus || 'NOVO'];

  return (
    <div className="p-5 bg-white rounded-3xl border border-[#EDE8E0] shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between group">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-600 uppercase tracking-wider">
              {biz.category}
            </span>
            <h3 className="text-sm font-bold text-stone-900 mt-1.5 leading-snug group-hover:text-[#FF4D00] transition truncate">
              {biz.name}
            </h3>
          </div>

          {/* Favorite toggle and Trust Icon */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onToggleFavorite?.(biz)}
              className="p-1.5 hover:bg-amber-50 rounded-xl transition cursor-pointer text-amber-500"
              title="Remover dos favoritos"
            >
              <Star className="w-5 h-5 fill-amber-500 text-amber-500" />
            </button>
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

        {/* PageSpeed Badge if website exists */}
        {hasWebsite && (
          <div className="flex items-center gap-2 pt-1">
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                isSpeedLoading
                  ? 'bg-stone-100 text-stone-500 border-stone-200 animate-pulse'
                  : pageSpeed
                  ? pageSpeed.score >= 90
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : pageSpeed.score >= 50
                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                    : 'bg-rose-50 text-rose-800 border-rose-300'
                  : 'bg-stone-100 text-stone-600 border-stone-200'
              }`}
            >
              <img src="/velocimetro.png" alt="Speed" className="w-3.5 h-3.5 object-contain" />
              <span>
                {isSpeedLoading
                  ? 'Medindo...'
                  : pageSpeed
                  ? `PageSpeed: ${pageSpeed.score}/100`
                  : 'PageSpeed indisponível'}
              </span>
            </div>
          </div>
        )}

        {/* Pipeline Stage Tag */}
        <div className="flex items-center gap-2 pt-1">
          <span className="text-[10px] text-stone-400 font-bold uppercase">Pipeline:</span>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
          >
            {statusCfg.label}
          </span>
        </div>

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
          {/* Unfavorite button */}
          <button
            type="button"
            onClick={() => onToggleFavorite?.(biz)}
            className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
            title="Remover dos favoritos"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => onSelect(biz)}
          className="inline-flex items-center gap-1 px-3.5 py-2 bg-stone-900 hover:bg-[#FF4D00] text-white rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
        >
          <span>Ver detalhes</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function FavoritesView({
  businesses,
  onSelectBusiness,
  onUpdateLeadStatus,
  onToggleFavorite,
  onNavigateToExplore,
  onOpenAIChat,
}: FavoritesViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('TODAS');

  // Strictly filter by isFavorite
  const favoriteBusinesses = useMemo(() => {
    return businesses.filter((b) => Boolean(b.isFavorite));
  }, [businesses]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    favoriteBusinesses.forEach((b) => {
      if (b.category) set.add(b.category);
    });
    return Array.from(set);
  }, [favoriteBusinesses]);

  const filteredFavorites = useMemo(() => {
    return favoriteBusinesses.filter((b) => {
      if (selectedCategoryFilter !== 'TODAS' && b.category !== selectedCategoryFilter) {
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
  }, [favoriteBusinesses, selectedCategoryFilter, searchQuery]);

  // Export favorites to CSV
  const handleExportCSV = () => {
    if (favoriteBusinesses.length === 0) return;

    const headers = [
      'ID',
      'Nome da Empresa',
      'Categoria',
      'Etapa Pipeline',
      'Telefone',
      'Tem Website',
      'Website',
      'Endereço',
      'Anotações',
    ];

    const rows = favoriteBusinesses.map((b) => [
      `"${b.id}"`,
      `"${b.name.replace(/"/g, '""')}"`,
      `"${b.category.replace(/"/g, '""')}"`,
      `"${b.leadStatus || 'NOVO'}"`,
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
      `scoutly-favoritos-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
                Empresas Favoritas
              </h1>
            </div>
            <p className="text-xs text-stone-500 font-medium mt-1">
              Lista de negócios marcados como favoritos com estrela, separados do pipeline comercial.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={favoriteBusinesses.length === 0}
              className="px-4 py-2.5 bg-white border border-[#EDE8E0] hover:bg-stone-50 text-stone-800 rounded-2xl text-xs font-bold transition shadow-2xs flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4 text-stone-600" />
              <span>Exportar CSV ({favoriteBusinesses.length})</span>
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
              placeholder="Buscar favoritos por nome, categoria ou anotações..."
              className="w-full bg-[#FAF7F2] border border-[#EDE8E0] rounded-2xl pl-10 pr-4 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#FF4D00]"
            />
          </div>

          {/* Category Filter Pills if categories exist */}
          {categories.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 md:pb-0">
              <button
                type="button"
                onClick={() => setSelectedCategoryFilter('TODAS')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  selectedCategoryFilter === 'TODAS'
                    ? 'bg-stone-900 text-white shadow-2xs'
                    : 'bg-[#FAF7F2] text-stone-600 hover:bg-stone-100 border border-[#EDE8E0]'
                }`}
              >
                Todas ({favoriteBusinesses.length})
              </button>
              {categories.slice(0, 5).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    selectedCategoryFilter === cat
                      ? 'bg-stone-900 text-white shadow-2xs'
                      : 'bg-[#FAF7F2] text-stone-600 hover:bg-stone-100 border border-[#EDE8E0]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Lead List / Empty State */}
        {filteredFavorites.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-[#EDE8E0] shadow-2xs flex flex-col items-center justify-center max-w-lg mx-auto mt-8">
            <div className="w-14 h-14 rounded-3xl bg-amber-50 flex items-center justify-center text-amber-500 mb-4 border border-amber-200">
              <Star className="w-7 h-7 fill-amber-500 text-amber-500" />
            </div>
            <h3 className="text-base font-bold text-stone-900 mb-1">
              Nenhuma empresa favoritada ainda
            </h3>
            <p className="text-xs text-stone-500 max-w-sm mb-6">
              Para favoritar uma empresa, clique no ícone de estrela <strong>(★)</strong> em qualquer card no mapa ou na lista.
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
            {filteredFavorites.map((biz) => (
              <FavoriteCard
                key={biz.id}
                biz={biz}
                onSelect={onSelectBusiness}
                onToggleFavorite={onToggleFavorite}
                onUpdateLeadStatus={onUpdateLeadStatus}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(FavoritesView);
