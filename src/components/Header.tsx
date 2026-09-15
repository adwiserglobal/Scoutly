import { useState, FormEvent, memo } from 'react';
import { Search, Navigation, Sparkles } from 'lucide-react';

interface HeaderProps {
  currentRegionName: string;
  onSearch: (query: string) => void;
  onUseCurrentLocation: () => void;
  onSelectPreset?: (region: { name: string; lat: number; lng: number }) => void;
  onOpenAIAssistant?: () => void;
  isLocating: boolean;
  totalOpportunitiesCount: number;
}

function Header({
  currentRegionName,
  onSearch,
  onUseCurrentLocation,
  onOpenAIAssistant,
  isLocating,
}: HeaderProps) {
  const [searchInput, setSearchInput] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      onSearch(searchInput.trim());
    }
  };

  return (
    <header className="w-full bg-[#FAF7F2] border-b border-[#EDE8E0] px-4 lg:px-8 py-3.5">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Brand Logo (Bigger & Crisp) */}
        <div className="flex items-center py-0.5">
          <img
            src="/logo.png"
            alt="Scoutly - Radar de Prospecção"
            className="h-16 sm:h-24 w-auto max-w-[360px] sm:max-w-[480px] object-contain cursor-pointer transition hover:opacity-95 drop-shadow-2xs"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>

        {/* Enhanced Search & Location Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Main Search Input */}
          <form
            onSubmit={handleSubmit}
            className="relative flex items-center flex-1 sm:w-80 group"
          >
            <div className="absolute left-3.5 text-stone-400 group-focus-within:text-[#FF4D00] transition pointer-events-none">
              <Search className="w-4 h-4" />
            </div>

            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Pesquise cidade, bairro ou rua..."
              className="w-full bg-white border border-[#EDE8E0] rounded-2xl pl-10 pr-24 py-2.5 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#FF4D00] focus:ring-2 focus:ring-[#FF4D00]/15 transition shadow-2xs"
            />

            <button
              type="submit"
              className="absolute right-1.5 px-3.5 py-1.5 bg-stone-900 hover:bg-[#FF4D00] text-white rounded-xl text-[11px] font-bold tracking-wider uppercase transition active:scale-95 shadow-2xs cursor-pointer"
            >
              BUSCAR
            </button>
          </form>

          {/* Button: Perto de você com contorno laranja */}
          <button
            type="button"
            onClick={onUseCurrentLocation}
            disabled={isLocating}
            className="px-4 py-2.5 bg-white border-2 border-[#FF4D00] text-[#FF4D00] hover:bg-[#FF4D00] hover:text-white rounded-2xl text-xs font-bold tracking-wider uppercase transition disabled:opacity-50 whitespace-nowrap active:scale-95 shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <Navigation className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
            <span>{isLocating ? 'LOCALIZANDO...' : 'PERTO DE VOCÊ'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}

export default memo(Header);
