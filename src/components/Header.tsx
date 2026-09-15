import { useState, FormEvent, memo } from 'react';
import { Search, Navigation, SlidersHorizontal, MapPin } from 'lucide-react';

interface HeaderProps {
  currentRegionName: string;
  onSearch: (query: string) => void;
  onUseCurrentLocation: () => void;
  onSelectPreset?: (region: { name: string; lat: number; lng: number }) => void;
  onOpenAIAssistant?: () => void;
  isLocating: boolean;
  totalOpportunitiesCount: number;
  totalBusinessesCount: number;
  onOpenFilters: () => void;
  isPinActive?: boolean;
  onTogglePinMode?: () => void;
}

function Header({
  onSearch,
  onUseCurrentLocation,
  isLocating,
  totalBusinessesCount,
  onOpenFilters,
  isPinActive = false,
  onTogglePinMode,
}: HeaderProps) {
  const [searchInput, setSearchInput] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      onSearch(searchInput.trim());
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-center gap-3 w-full shrink-0 pointer-events-auto">
      {/* Brand Logo - Enlarged, background removed */}
      <div className="flex items-center shrink-0 pr-1">
        <img
          src="/logo_white.png"
          alt="Scoutly - Radar de Prospecção"
          className="h-12 sm:h-14 md:h-16 w-auto object-contain cursor-pointer transition-transform duration-200 hover:scale-105 drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      </div>

      {/* Enhanced Search & Location Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-white/70 backdrop-blur-md p-1.5 rounded-full shadow-sm border border-white/40 h-auto sm:h-[52px]">
        {/* Main Search Input */}
        <form
          onSubmit={handleSubmit}
          className="relative flex items-center flex-1 sm:w-72 lg:w-80 group h-full"
        >
          <div className="absolute left-3.5 text-stone-400 group-focus-within:text-[#FF4D00] transition pointer-events-none">
            <Search className="w-4 h-4" />
          </div>

          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Pesquise cidade, bairro ou rua..."
            className="w-full h-full bg-white/80 border-none rounded-full pl-10 pr-24 py-2.5 text-xs text-stone-900 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-[#FF4D00]/50 transition shadow-inner"
          />

          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3.5 py-1.5 bg-stone-900 hover:bg-[#FF4D00] text-white rounded-full text-[11px] font-bold tracking-wider uppercase transition active:scale-95 shadow-2xs cursor-pointer"
          >
            BUSCAR
          </button>
        </form>

        {/* Button: Perto de você com contorno laranja */}
        <button
          type="button"
          onClick={onUseCurrentLocation}
          disabled={isLocating}
          className="h-full px-4 py-2 bg-white/90 border-2 border-[#FF4D00] text-[#FF4D00] hover:bg-[#FF4D00] hover:text-white rounded-full text-xs font-bold tracking-wider uppercase transition disabled:opacity-50 whitespace-nowrap active:scale-95 shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
        >
          <Navigation className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline-block">{isLocating ? 'LOCALIZANDO' : 'PERTO DE VOCÊ'}</span>
        </button>

        {/* Button: Soltar Pin no Mapa (Draggable Radar Pin) */}
        {onTogglePinMode && (
          <button
            type="button"
            onClick={onTogglePinMode}
            title={isPinActive ? 'Pin ativo no mapa (clique para remover ou reposicionar)' : 'Soltar pin arrastável no mapa para prospecção rápida'}
            className={`h-full px-4 py-2 rounded-full text-xs font-bold tracking-wider uppercase transition whitespace-nowrap active:scale-95 shadow-2xs flex items-center justify-center gap-2 cursor-pointer ${
              isPinActive
                ? 'bg-[#FF4D00] text-white border-2 border-[#FF4D00] shadow-md shadow-[#FF4D00]/30 animate-pulse'
                : 'bg-white/90 border-2 border-stone-800 text-stone-900 hover:bg-stone-900 hover:text-white'
            }`}
          >
            <MapPin className={`w-3.5 h-3.5 ${isPinActive ? 'text-white' : 'text-[#FF4D00]'}`} />
            <span className="hidden sm:inline-block">
              {isPinActive ? 'PIN ATIVO' : 'SOLTAR PIN'}
            </span>
          </button>
        )}
      </div>

      {/* Button: Filters */}
      <button
        type="button"
        onClick={onOpenFilters}
        className="flex items-center gap-2 h-[52px] px-5 py-2 bg-white/70 backdrop-blur-md hover:bg-white border border-white/40 text-stone-700 hover:text-stone-900 rounded-full text-xs font-bold tracking-wider uppercase transition active:scale-95 shadow-sm cursor-pointer ml-auto sm:ml-0"
      >
        <SlidersHorizontal className="w-4 h-4" />
        <span>Filtros</span>
      </button>

      {/* Business Counter Badge - Moved to right side after filters */}
      <div className="flex items-center gap-2 h-[52px] px-4 py-2 bg-white/70 backdrop-blur-md border border-white/40 rounded-full shadow-sm text-xs font-semibold text-stone-800 shrink-0">
        <span className="w-2.5 h-2.5 rounded-full bg-[#FF4D00]"></span>
        <span className="tracking-tight whitespace-nowrap">
          {totalBusinessesCount} {totalBusinessesCount === 1 ? 'negócio' : 'negócios'}
        </span>
      </div>
    </div>
  );
}

export default memo(Header);
