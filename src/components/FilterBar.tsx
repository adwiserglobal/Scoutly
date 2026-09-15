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
    <div className="flex flex-col gap-6 w-full shrink-0 pb-8">
      {/* Digital Status Filters */}
      <div className="flex flex-col gap-3">
        <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
          Status Digital:
        </span>
        
        <div className="flex flex-col gap-2.5">
          {/* Button: Todos */}
          <button
            type="button"
            onClick={() => onToggleFilter('TODOS')}
            className={`text-xs font-semibold px-4 py-3 rounded-xl transition border flex items-center justify-between gap-1.5 backdrop-blur-md ${
              isAll
                ? 'bg-[#FF4D00] text-white border-[#FF4D00] shadow-lg shadow-[#FF4D00]/25'
                : 'bg-white/5 text-stone-200 border-white/10 hover:bg-white/10 hover:border-white/20 hover:text-white shadow-sm'
            }`}
          >
            <span>Todos os negócios</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                isAll
                  ? 'bg-white/20 text-white'
                  : 'bg-white/10 text-stone-300'
              }`}
            >
              {totalCount}
            </span>
          </button>

          {/* Button: Sem site (Oportunidades) */}
          <button
            type="button"
            onClick={() => onToggleFilter('semSite')}
            className={`text-xs font-semibold px-4 py-3 rounded-xl transition border flex items-center justify-between gap-1.5 backdrop-blur-md ${
              activeFilters.semSite
                ? 'bg-[#FF4D00] text-white border-[#FF4D00] shadow-lg shadow-[#FF4D00]/25'
                : 'bg-white/5 text-stone-200 border-white/10 hover:bg-white/10 hover:border-amber-400/40 hover:text-white shadow-sm'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${activeFilters.semSite ? 'bg-white' : 'bg-red-500'}`} />
              <span>Sem site (Oportunidades)</span>
            </div>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                activeFilters.semSite
                  ? 'bg-white/20 text-white'
                  : 'bg-amber-500/20 text-amber-300'
              }`}
            >
              {opportunitiesCount}
            </span>
          </button>

          {/* Button: Com site */}
          <button
            type="button"
            onClick={() => onToggleFilter('comSite')}
            className={`text-xs font-semibold px-4 py-3 rounded-xl transition border flex items-center justify-between gap-1.5 backdrop-blur-md ${
              activeFilters.comSite
                ? 'bg-[#FF4D00] text-white border-[#FF4D00] shadow-lg shadow-[#FF4D00]/25'
                : 'bg-white/5 text-stone-200 border-white/10 hover:bg-white/10 hover:border-green-400/40 hover:text-white shadow-sm'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${activeFilters.comSite ? 'bg-white' : 'bg-green-500'}`} />
              <span>Com site</span>
            </div>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                activeFilters.comSite
                  ? 'bg-white/20 text-white'
                  : 'bg-white/10 text-stone-300'
              }`}
            >
              {Math.max(0, totalCount - opportunitiesCount)}
            </span>
          </button>

          {/* Button: Com WhatsApp */}
          <button
            type="button"
            onClick={() => onToggleFilter('comWhatsapp')}
            className={`text-xs font-semibold px-4 py-3 rounded-xl transition border flex items-center justify-between gap-1.5 backdrop-blur-md ${
              activeFilters.comWhatsapp
                ? 'bg-[#FF4D00] text-white border-[#FF4D00] shadow-lg shadow-[#FF4D00]/25'
                : 'bg-white/5 text-stone-200 border-white/10 hover:bg-white/10 hover:border-emerald-400/40 hover:text-white shadow-sm'
            }`}
          >
            <div className="flex items-center gap-2">
              <img src="/whatsapp_icone.png" alt="WhatsApp" className="w-4 h-4 object-contain" />
              <span>Com WhatsApp</span>
            </div>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                activeFilters.comWhatsapp
                  ? 'bg-white/20 text-white'
                  : 'bg-emerald-500/20 text-emerald-300'
              }`}
            >
              {whatsappCount}
            </span>
          </button>

          {/* Button: Com Rede Social */}
          <button
            type="button"
            onClick={() => onToggleFilter('comRedeSocial')}
            className={`text-xs font-semibold px-4 py-3 rounded-xl transition border flex items-center justify-between gap-1.5 backdrop-blur-md ${
              activeFilters.comRedeSocial
                ? 'bg-[#FF4D00] text-white border-[#FF4D00] shadow-lg shadow-[#FF4D00]/25'
                : 'bg-white/5 text-stone-200 border-white/10 hover:bg-white/10 hover:border-blue-400/40 hover:text-white shadow-sm'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${activeFilters.comRedeSocial ? 'bg-white' : 'bg-blue-500'}`} />
              <span>Com rede social</span>
            </div>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                activeFilters.comRedeSocial
                  ? 'bg-white/20 text-white'
                  : 'bg-blue-500/20 text-blue-300'
              }`}
            >
              {socialsCount}
            </span>
          </button>
        </div>
      </div>

      <div className="h-px bg-white/10 w-full" />

      {/* Selectors: Category and Sorting */}
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label
            htmlFor="category-select"
            className="text-[11px] font-bold text-stone-400 uppercase tracking-wider"
          >
            Categoria:
          </label>
          <select
            id="category-select"
            value={selectedCategory}
            onChange={(e) => onSelectCategory(e.target.value)}
            className="w-full bg-stone-800/90 text-stone-100 border border-white/15 rounded-xl px-4 py-3 text-xs font-semibold focus:outline-none focus:border-[#FF4D00] cursor-pointer shadow-sm transition backdrop-blur-md"
          >
            <option value="TODAS" className="bg-stone-900 text-stone-100">Todas as Categorias ({totalCount})</option>
            {availableCategories.map((cat) => (
              <option key={cat.name} value={cat.name} className="bg-stone-900 text-stone-100">
                {translateCategory(cat.name)} ({cat.count})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="sort-select"
            className="text-[11px] font-bold text-stone-400 uppercase tracking-wider"
          >
            Ordenar por:
          </label>
          <select
            id="sort-select"
            value={sortBy}
            onChange={(e) =>
              onSelectSortBy(e.target.value as 'CONFIDENCE' | 'NOME' | 'COM_CONTATO')
            }
            className="w-full bg-stone-800/90 text-stone-100 border border-white/15 rounded-xl px-4 py-3 text-xs font-semibold focus:outline-none focus:border-[#FF4D00] cursor-pointer shadow-sm transition backdrop-blur-md"
          >
            <option value="CONFIDENCE" className="bg-stone-900 text-stone-100">Maior Confiança</option>
            <option value="COM_CONTATO" className="bg-stone-900 text-stone-100">Melhores Contatos Primeiro</option>
            <option value="NOME" className="bg-stone-900 text-stone-100">Ordem Alfabética (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Info summary */}
      <div className="mt-4 pt-4 border-t border-white/10 text-center">
        <div className="text-xs text-stone-400 font-medium">
          Exibindo <strong className="text-white">{filteredCount}</strong> de {totalCount} negócios
        </div>
      </div>
    </div>
  );
}

export default memo(FilterBar);
