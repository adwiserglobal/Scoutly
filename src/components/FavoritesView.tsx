import { memo, useMemo, useState } from 'react';
import {
  ChevronRight,
  Columns3,
  Compass,
  Download,
  ExternalLink,
  Search,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react';
import { Business, LeadStatus } from '../types';
import { getTrustIcon, getWhatsAppLink } from '../services/api';
import { recordRecommendationWhatsApp } from '../utils/recommendations';
import { usePageSpeed } from '../hooks/usePageSpeed';

interface FavoritesViewProps {
  businesses: Business[];
  onSelectBusiness: (business: Business) => void;
  onUpdateLeadStatus: (id: string, status: LeadStatus, notes?: string) => void;
  onToggleFavorite?: (business: Business) => void;
  onNavigateToExplore: () => void;
  onOpenAIChat: () => void;
}

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
  const waLink = getWhatsAppLink(biz.phone || biz.phones?.[0]);
  const hasWebsite = Boolean(biz.website);
  const { data: pageSpeed, isLoading: isSpeedLoading } = usePageSpeed(hasWebsite ? biz.website : null);
  const confidence = Math.round((biz.confidence || 0.8) * 100);

  return (
    <article className="group flex min-h-[250px] flex-col justify-between rounded-[22px] border border-white/[0.08] bg-[#111418] p-4 shadow-[0_14px_40px_rgba(0,0,0,0.18)] transition hover:border-white/[0.14] hover:bg-[#15191e]">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="inline-flex rounded-full border border-white/[0.08] bg-white/[0.035] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-stone-400">
              {biz.category}
            </span>
            <h3 className="mt-2 truncate text-[15px] font-semibold tracking-[-0.015em] text-white transition group-hover:text-[#FF6A26]">
              {biz.name}
            </h3>
            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-stone-500">
              {biz.address || 'Endereço disponível no mapa'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onToggleFavorite?.(biz)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FF5A12]/[0.09] text-[#FF6A26] transition hover:bg-[#FF5A12]/[0.15]"
            title="Remover dos favoritos"
          >
            <Star className="h-4 w-4 fill-current" />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
            hasWebsite
              ? 'bg-emerald-500/[0.10] text-emerald-400'
              : 'bg-[#FF5A12]/[0.10] text-[#FF7A3D]'
          }`}>
            {hasWebsite ? 'Com site' : 'Sem site'}
          </span>

          <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium text-stone-400">
            {biz.leadStatus && biz.leadStatus !== 'NOVO' ? biz.leadStatus.replaceAll('_', ' ') : 'Fora do pipeline'}
          </span>
        </div>

        {hasWebsite && (
          <div className="mt-3 flex items-center justify-between rounded-xl border border-white/[0.07] bg-black/[0.12] px-3 py-2.5">
            <span className="text-[10px] text-stone-500">PageSpeed mobile</span>
            <span className={`text-[11px] font-semibold ${
              isSpeedLoading
                ? 'text-stone-500'
                : pageSpeed
                  ? pageSpeed.score >= 90
                    ? 'text-emerald-400'
                    : pageSpeed.score >= 50
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  : 'text-stone-500'
            }`}>
              {isSpeedLoading ? 'Medindo...' : pageSpeed ? `${pageSpeed.score}/100` : 'Indisponível'}
            </span>
          </div>
        )}

        {biz.notes && (
          <div className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5 text-[10px] leading-relaxed text-stone-400">
            {biz.notes}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-white/[0.07] pt-3">
        <div className="mr-auto flex items-center gap-2 text-[10px] text-stone-500">
          <span className="font-semibold text-stone-300">{confidence}%</span>
          <img
            src={getTrustIcon(biz.confidence || 0.8)}
            alt=""
            className="h-4 w-4 object-contain opacity-80"
            title={`Confiança dos dados: ${confidence}%`}
          />
        </div>

        {waLink && (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => recordRecommendationWhatsApp(biz)}
            className="flex h-8 items-center rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] px-2.5 text-[10px] font-semibold text-emerald-400 transition hover:bg-emerald-500/[0.12]"
          >
            WhatsApp
          </a>
        )}

        {hasWebsite && (
          <a
            href={biz.website!}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-8 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] px-2.5 text-stone-400 transition hover:bg-white/[0.06] hover:text-white"
            title="Abrir site"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}

        {(!biz.leadStatus || biz.leadStatus === 'NOVO') ? (
          <button
            type="button"
            onClick={() => onUpdateLeadStatus(biz.id, 'CONTATADO', biz.notes)}
            className="flex h-8 items-center gap-1.5 rounded-xl border border-[#FF5A12]/25 bg-[#FF5A12]/[0.08] px-2.5 text-[10px] font-semibold text-[#FF7A3D] transition hover:border-[#FF5A12]/40 hover:bg-[#FF5A12]/[0.13]"
            title="Adicionar ao pipeline"
          >
            <Columns3 className="h-3.5 w-3.5" />
            <span className="hidden 2xl:inline">Pipeline</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onUpdateLeadStatus(biz.id, 'NOVO', biz.notes)}
            className="flex h-8 items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-2.5 text-[10px] font-semibold text-stone-400 transition hover:bg-white/[0.06] hover:text-white"
            title="Remover do pipeline"
          >
            <Columns3 className="h-3.5 w-3.5" />
            <span className="hidden 2xl:inline">No pipeline</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => onToggleFavorite?.(biz)}
          className="flex h-8 w-8 items-center justify-center rounded-xl text-stone-500 transition hover:bg-rose-500/[0.08] hover:text-rose-400"
          title="Remover dos favoritos"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => onSelect(biz)}
          className="flex h-8 items-center gap-1 rounded-xl bg-[#FF5A12] px-3 text-[10px] font-semibold text-white transition hover:bg-[#ff6a27]"
        >
          Detalhes
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </article>
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
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('TODAS');

  const favoriteBusinesses = useMemo(
    () => businesses.filter((business) => Boolean(business.isFavorite)),
    [businesses]
  );

  const categories = useMemo(
    () => Array.from(new Set(favoriteBusinesses.map((business) => business.category).filter(Boolean))),
    [favoriteBusinesses]
  );

  const filteredFavorites = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return favoriteBusinesses.filter((business) => {
      if (selectedCategoryFilter !== 'TODAS' && business.category !== selectedCategoryFilter) return false;
      if (!q) return true;

      return [
        business.name,
        business.category,
        business.address,
        business.notes || '',
      ].some((value) => value.toLowerCase().includes(q));
    });
  }, [favoriteBusinesses, selectedCategoryFilter, searchQuery]);

  const handleExportCSV = () => {
    if (favoriteBusinesses.length === 0) return;

    const headers = ['ID', 'Nome da Empresa', 'Categoria', 'Etapa Pipeline', 'Telefone', 'Tem Website', 'Website', 'Endereço', 'Anotações'];
    const rows = favoriteBusinesses.map((business) => [
      `"${business.id}"`,
      `"${business.name.replace(/"/g, '""')}"`,
      `"${business.category.replace(/"/g, '""')}"`,
      `"${business.leadStatus || 'NOVO'}"`,
      `"${business.phone || business.phones?.[0] || ''}"`,
      business.website ? 'Sim' : 'Não',
      `"${business.website || ''}"`,
      `"${business.address.replace(/"/g, '""')}"`,
      `"${(business.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csv = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map((row) => row.join(';'))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    link.setAttribute('download', `scoutly-favoritos-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="h-full flex-1 overflow-y-auto bg-[#090c10] px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#FF5A12]/20 bg-[#FF5A12]/[0.10] text-[#FF6A26]">
                <Star className="h-5 w-5 fill-current" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white">Favoritos</h1>
                <p className="mt-1 text-xs text-stone-500">Empresas salvas para acompanhamento e prospecção.</p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={favoriteBusinesses.length === 0}
            className="flex h-10 items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.035] px-3.5 text-[11px] font-semibold text-stone-300 transition hover:border-white/[0.14] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download className="h-4 w-4" />
            Exportar CSV ({favoriteBusinesses.length})
          </button>
        </header>

        {favoriteBusinesses.length > 0 && (
          <section className="flex flex-col gap-3 rounded-[22px] border border-white/[0.08] bg-[#101318] p-3 md:flex-row md:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-600" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Buscar por nome, categoria, endereço ou anotação"
                className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#0b0e12] pl-10 pr-4 text-xs text-white outline-none placeholder:text-stone-600 focus:border-[#FF5A12]/50"
              />
            </div>

            {categories.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {['TODAS', ...categories.slice(0, 5)].map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setSelectedCategoryFilter(category)}
                    className={`whitespace-nowrap rounded-xl border px-3 py-2 text-[10px] font-semibold transition ${
                      selectedCategoryFilter === category
                        ? 'border-[#FF5A12]/40 bg-[#FF5A12]/[0.12] text-[#FF7A3D]'
                        : 'border-white/[0.07] bg-white/[0.025] text-stone-500 hover:text-stone-300'
                    }`}
                  >
                    {category === 'TODAS' ? `Todas (${favoriteBusinesses.length})` : category}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {favoriteBusinesses.length === 0 ? (
          <section className="mx-auto flex min-h-[520px] max-w-2xl flex-col items-center justify-center px-6 py-12 text-center">
            <img
              src="/empty-favorites.svg"
              alt=""
              className="mb-6 h-32 w-32 object-contain sm:h-36 sm:w-36"
            />
            <h2 className="text-xl font-semibold tracking-[-0.02em] text-white">Nenhum favorito salvo</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-stone-500">
              Salve empresas estratégicas para acompanhar depois sem perder os melhores prospects.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={onNavigateToExplore}
                className="flex h-10 items-center gap-2 rounded-xl bg-[#FF5A12] px-4 text-xs font-semibold text-white transition hover:bg-[#ff6a27]"
              >
                <Compass className="h-4 w-4" />
                Explorar empresas
              </button>
              <button
                type="button"
                onClick={onOpenAIChat}
                className="flex h-10 items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.035] px-4 text-xs font-semibold text-stone-300 transition hover:text-white"
              >
                <Sparkles className="h-4 w-4 text-[#FF6A26]" />
                Pedir à IA
              </button>
            </div>
          </section>
        ) : filteredFavorites.length === 0 ? (
          <div className="rounded-[22px] border border-white/[0.08] bg-[#101318] px-6 py-14 text-center">
            <p className="text-sm font-medium text-stone-300">Nenhum favorito corresponde aos filtros.</p>
            <p className="mt-1 text-xs text-stone-600">Tente outra busca ou categoria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredFavorites.map((business) => (
              <FavoriteCard
                key={business.id}
                biz={business}
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
