import { memo } from 'react';
import { ActiveFilters } from '../types';
import { translateCategory } from '../utils/categoryTranslator';

interface FilterBarProps {
  activeFilters: ActiveFilters;
  onToggleFilter: (filterKey: keyof ActiveFilters | 'TODOS') => void;
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  availableCategories: Array<{ name: string; count: number }>;
  sortBy: 'CONFIDENCE' | 'NOME' | 'COM_CONTATO';
  onSelectSortBy: (sort: 'CONFIDENCE' | 'NOME' | 'COM_CONTATO') => void;
  filteredCount: number;
  totalCount: number;
  opportunitiesCount: number;
  whatsappCount: number;
  socialsCount: number;
}

function FilterBar({
  activeFilters,
  onToggleFilter,
  selectedCategory,
  onSelectCategory,
  availableCategories,
  sortBy,
  onSelectSortBy,
  filteredCount,
  totalCount,
  opportunitiesCount,
  whatsappCount,
  socialsCount,
}: FilterBarProps) {
  const isAll =
    !activeFilters.semSite &&
    !activeFilters.comSite &&
    !activeFilters.comWhatsapp &&
    !activeFilters.comRedeSocial;

  return (
    <div className="w-full bg-[#FAF7F2] border-b border-[#EDE8E0] px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex flex-col gap-3">
        {/* Top Row: Filter Pills & Dynamic Counters */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider mr-1 shrink-0">
              Filtro:
            </span>

            {/* Button: Todos */}
            <button
              type="button"
              onClick={() => onToggleFilter('TODOS')}
              className={`text-xs font-semibold px-3.5 py-1.5 rounded-xl transition shrink-0 border flex items-center gap-1.5 ${
                isAll
                  ? 'bg-[#FF4D00] text-white border-[#FF4D00] shadow-xs'
                  : 'bg-white text-stone-700 border-[#EDE8E0] hover:border-stone-400 hover:text-stone-900'
              }`}
            >
              <span>Todos</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isAll
                    ? 'bg-white/20 text-white'
                    : 'bg-stone-100 text-stone-600'
                }`}
              >
                {totalCount}
              </span>
            </button>

            {/* Button: Sem site (Oportunidades) */}
            <button
              type="button"
              onClick={() => onToggleFilter('semSite')}
              className={`text-xs font-semibold px-3.5 py-1.5 rounded-xl transition shrink-0 border flex items-center gap-1.5 ${
                activeFilters.semSite
                  ? 'bg-[#FF4D00] text-white border-[#FF4D00] shadow-xs'
                  : 'bg-white text-stone-700 border-[#EDE8E0] hover:border-amber-300 hover:text-stone-900'
              }`}
            >
              <span>Sem site (Oportunidades)</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeFilters.semSite
                    ? 'bg-white/20 text-white'
                    : 'bg-amber-100 text-amber-900'
                }`}
              >
                {opportunitiesCount}
              </span>
            </button>

            {/* Button: Com site */}
            <button
              type="button"
              onClick={() => onToggleFilter('comSite')}
              className={`text-xs font-semibold px-3.5 py-1.5 rounded-xl transition shrink-0 border flex items-center gap-1.5 ${
                activeFilters.comSite
                  ? 'bg-[#FF4D00] text-white border-[#FF4D00] shadow-xs'
                  : 'bg-white text-stone-700 border-[#EDE8E0] hover:border-stone-400 hover:text-stone-900'
              }`}
            >
              <span>Com site</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeFilters.comSite
                    ? 'bg-white/20 text-white'
                    : 'bg-stone-100 text-stone-600'
                }`}
              >
                {Math.max(0, totalCount - opportunitiesCount)}
              </span>
            </button>

            {/* Button: Com WhatsApp */}
            <button
              type="button"
              onClick={() => onToggleFilter('comWhatsapp')}
              className={`text-xs font-semibold px-3.5 py-1.5 rounded-xl transition shrink-0 border flex items-center gap-1.5 ${
                activeFilters.comWhatsapp
                  ? 'bg-[#FF4D00] text-white border-[#FF4D00] shadow-xs'
                  : 'bg-white text-stone-700 border-[#EDE8E0] hover:border-emerald-300 hover:text-stone-900'
              }`}
            >
              <img src="/whatsapp_icone.png" alt="WhatsApp" className="w-3.5 h-3.5 object-contain" />
              <span>Com WhatsApp</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeFilters.comWhatsapp
                    ? 'bg-white/20 text-white'
                    : 'bg-emerald-100 text-emerald-900'
                }`}
              >
                {whatsappCount}
              </span>
            </button>

            {/* Button: Com rede social */}
            <button
              type="button"
              onClick={() => onToggleFilter('comRedeSocial')}
              className={`text-xs font-semibold px-3.5 py-1.5 rounded-xl transition shrink-0 border flex items-center gap-1.5 ${
                activeFilters.comRedeSocial
                  ? 'bg-[#FF4D00] text-white border-[#FF4D00] shadow-xs'
                  : 'bg-white text-stone-700 border-[#EDE8E0] hover:border-purple-300 hover:text-stone-900'
              }`}
            >
              <span>Com rede social</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeFilters.comRedeSocial
                    ? 'bg-white/20 text-white'
                    : 'bg-purple-100 text-purple-900'
                }`}
              >
                {socialsCount}
              </span>
            </button>
          </div>

          {/* Results Summary Counter */}
          <div className="hidden sm:block text-xs font-semibold text-stone-500 shrink-0">
            Exibindo <strong className="text-stone-900">{filteredCount}</strong> {filteredCount === 1 ? 'negócio' : 'negócios'}
            {filteredCount !== totalCount && (
              <span className="text-stone-400"> de {totalCount}</span>
            )}
          </div>
        </div>

        {/* Bottom Row: Category Dropdown & Sorting */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#EDE8E0]/70">
          <div className="flex flex-wrap items-center gap-3">
            {/* Translated Category Dropdown */}
            <div className="flex items-center gap-1.5">
              <label
                htmlFor="category-select"
                className="text-[11px] font-bold text-stone-500 uppercase tracking-wider shrink-0"
              >
                Categoria:
              </label>
              <select
                id="category-select"
                value={selectedCategory}
                onChange={(e) => onSelectCategory(e.target.value)}
                className="bg-white border border-[#EDE8E0] rounded-xl px-3 py-1.5 text-xs text-stone-800 font-medium focus:outline-none focus:border-[#FF4D00] max-w-[240px] truncate cursor-pointer shadow-2xs"
              >
                <option value="TODAS">Todas as Categorias ({totalCount})</option>
                {availableCategories.map((cat) => (
                  <option key={cat.name} value={cat.name}>
                    {translateCategory(cat.name)} ({cat.count})
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5">
              <label
                htmlFor="sort-select"
                className="text-[11px] font-bold text-stone-500 uppercase tracking-wider shrink-0"
              >
                Ordenar:
              </label>
              <select
                id="sort-select"
                value={sortBy}
                onChange={(e) =>
                  onSelectSortBy(e.target.value as 'CONFIDENCE' | 'NOME' | 'COM_CONTATO')
                }
                className="bg-white border border-[#EDE8E0] rounded-xl px-3 py-1.5 text-xs text-stone-800 font-medium focus:outline-none focus:border-[#FF4D00] cursor-pointer shadow-2xs"
              >
                <option value="CONFIDENCE">Maior Confiança</option>
                <option value="NOME">Nome (A-Z)</option>
                <option value="COM_CONTATO">Com WhatsApp / Telefone primeiro</option>
              </select>
            </div>
          </div>

          {/* Mobile visible counter */}
          <div className="sm:hidden text-xs font-semibold text-stone-500">
            Exibindo <strong className="text-stone-900">{filteredCount}</strong> de {totalCount}
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(FilterBar);
