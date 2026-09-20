import { memo } from 'react';
import { ArrowRight, Building2, Globe2, MapPin, Phone, Star } from 'lucide-react';
import { Business } from '../types';
import { translateCategory } from '../utils/categoryTranslator';

interface ResultsPanelProps {
  businesses: Business[];
  totalCount: number;
  currentRegionName: string;
  isLoading: boolean;
  selectedBusinessId?: string | null;
  onSelectBusiness: (business: Business) => void;
  onToggleFavorite: (business: Business) => void;
  onOpenAll: () => void;
}

function compactLocation(business: Business): string {
  if (business.bairro) return business.bairro;
  if (business.municipio) return business.municipio;
  const parts = (business.address || '').split(',').map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 2] : parts[0] || 'Localização disponível no mapa';
}

function ResultsPanel({
  businesses,
  totalCount,
  currentRegionName,
  isLoading,
  selectedBusinessId,
  onSelectBusiness,
  onToggleFavorite,
  onOpenAll,
}: ResultsPanelProps) {
  const visibleBusinesses = businesses.slice(0, 8);
  const formattedCount = new Intl.NumberFormat('pt-BR').format(totalCount);

  return (
    <aside className="scoutly-results-panel pointer-events-auto fixed bottom-4 right-4 top-4 z-30 hidden w-[360px] flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[#101215]/[0.92] shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-2xl lg:flex xl:w-[380px]">
      <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] px-5 pb-4 pt-5">
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-white">Empresas nesta área</h2>
          <p className="mt-1 text-[11px] text-stone-400">
            {isLoading ? 'Atualizando resultados' : `${formattedCount} resultados`}
          </p>
        </div>
        <div className="shrink-0 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-[10px] font-medium text-stone-300">
          Mais relevantes
        </div>
      </div>

      <div className="border-b border-white/[0.08] px-5 py-3">
        <div className="flex items-center gap-2 text-[10px] text-stone-400">
          <MapPin className="h-3.5 w-3.5 text-[#FF5A12]" />
          <span className="truncate">{currentRegionName}</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 no-scrollbar">
        {visibleBusinesses.length === 0 && !isLoading ? (
          <div className="flex h-full min-h-[220px] items-center justify-center px-8 text-center">
            <div>
              <Building2 className="mx-auto mb-3 h-7 w-7 text-stone-600" />
              <p className="text-sm font-semibold text-stone-200">Nenhuma empresa visível</p>
              <p className="mt-1 text-[11px] leading-relaxed text-stone-500">Mova o mapa ou ajuste os filtros para ampliar a busca.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {visibleBusinesses.map((business) => {
              const hasPhone = Boolean(business.phone || business.phones?.length);
              const isSelected = selectedBusinessId === business.id;
              const isOpportunity = !business.website;

              return (
                <button
                  key={business.id}
                  type="button"
                  onClick={() => onSelectBusiness(business)}
                  className={`group w-full rounded-2xl border px-3 py-3 text-left transition-all duration-200 ${
                    isSelected
                      ? 'border-[#FF5A12]/65 bg-[#FF5A12]/10 shadow-[0_0_0_1px_rgba(255,90,18,0.08)]'
                      : 'border-white/[0.09] bg-white/[0.028] hover:border-white/[0.16] hover:bg-white/[0.055]'
                  }`}
                >
                  <div className="flex gap-3">
                    <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border ${
                      isSelected
                        ? 'border-[#FF5A12]/[0.35] bg-[#FF5A12]/[0.16] text-[#FF6A26]'
                        : 'border-white/[0.08] bg-gradient-to-br from-stone-800 to-stone-900 text-stone-400'
                    }`}>
                      <Building2 className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-[13px] font-semibold text-white">{business.name}</h3>
                          <p className="mt-0.5 truncate text-[10px] text-stone-400">{translateCategory(business.category)}</p>
                        </div>

                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(event) => {
                            event.stopPropagation();
                            onToggleFavorite(business);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              event.stopPropagation();
                              onToggleFavorite(business);
                            }
                          }}
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition ${
                            business.isFavorite
                              ? 'bg-[#FF5A12]/15 text-[#FF6A26]'
                              : 'text-stone-500 hover:bg-white/[0.08] hover:text-white'
                          }`}
                          aria-label={business.isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                        >
                          <Star className={`h-3.5 w-3.5 ${business.isFavorite ? 'fill-current' : ''}`} />
                        </span>
                      </div>

                      <div className="mt-2 flex min-w-0 items-center gap-2 text-[10px] text-stone-500">
                        <span className={`shrink-0 rounded-full px-2 py-0.5 font-medium ${
                          isOpportunity
                            ? 'bg-[#FF5A12]/12 text-[#FF7A3D]'
                            : 'bg-emerald-500/10 text-emerald-400'
                        }`}>
                          {isOpportunity ? 'Sem site' : 'Com site'}
                        </span>
                        <span className="truncate">{compactLocation(business)}</span>
                      </div>

                      <div className="mt-2 flex items-center gap-3 text-[9px] font-medium uppercase tracking-[0.08em] text-stone-500">
                        {business.website && (
                          <span className="flex items-center gap-1">
                            <Globe2 className="h-3 w-3" />
                            Site
                          </span>
                        )}
                        {hasPhone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            Contato
                          </span>
                        )}
                        <span className="ml-auto text-stone-600">
                          {Math.round((business.confidence || 0.8) * 100)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-white/[0.08] p-3">
        <button
          type="button"
          onClick={onOpenAll}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-[11px] font-semibold text-stone-200 transition hover:border-[#FF5A12]/[0.40] hover:bg-[#FF5A12]/[0.08] hover:text-white"
        >
          Ver todos os resultados
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </aside>
  );
}

export default memo(ResultsPanel);
