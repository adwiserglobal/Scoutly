import { useEffect, useRef, useState, FormEvent, KeyboardEvent, memo } from 'react';
import { Search, Navigation, SlidersHorizontal, MapPin, Loader2 } from 'lucide-react';

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

interface LocationSuggestion {
  id: string;
  label: string;
  primary: string;
  secondary: string;
  kind: string;
  lat: number;
  lng: number;
  bbox?: {
    west: number;
    south: number;
    east: number;
    north: number;
  } | null;
}

function replaceLocationTail(query: string, label: string): string {
  const patterns = [
    /(\b(?:perto\s+de|perto\s+do|perto\s+da|pr[oó]ximo\s+de|pr[oó]ximo\s+do|pr[oó]ximo\s+da)\s+)(.+)$/i,
    /(\b(?:na\s+regi[ãa]o\s+de|na\s+regi[ãa]o\s+do|na\s+regi[ãa]o\s+da|regi[ãa]o\s+de|regi[ãa]o\s+do|regi[ãa]o\s+da)\s+)(.+)$/i,
    /(\b(?:em|no|na|nos|nas)\s+)(.+)$/i,
  ];

  for (const pattern of patterns) {
    if (pattern.test(query)) {
      return query.replace(pattern, (_match, prefix) => `${prefix}${label}`);
    }
  }

  return label;
}

function kindLabel(kind: string): string {
  const labels: Record<string, string> = {
    suburb: 'Bairro',
    district: 'Região',
    neighbourhood: 'Bairro',
    quarter: 'Bairro',
    city: 'Cidade',
    town: 'Cidade',
    village: 'Localidade',
    street: 'Rua',
    postcode: 'CEP',
    state: 'Estado',
    county: 'Município',
  };
  return labels[kind] || 'Local';
}

function Header({
  currentRegionName,
  onSearch,
  onUseCurrentLocation,
  isLocating,
  totalBusinessesCount,
  onOpenFilters,
  isPinActive = false,
  onTogglePinMode,
}: HeaderProps) {
  const [searchInput, setSearchInput] = useState('');
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const suggestionsAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (formRef.current && !formRef.current.contains(event.target as Node)) {
        setSuggestionsOpen(false);
        setActiveSuggestion(-1);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  useEffect(() => {
    const query = searchInput.trim();
    if (query.length < 2) {
      suggestionsAbortRef.current?.abort();
      setSuggestions([]);
      setSuggestionsOpen(false);
      setIsSuggesting(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      suggestionsAbortRef.current?.abort();
      const controller = new AbortController();
      suggestionsAbortRef.current = controller;
      setIsSuggesting(true);

      try {
        const params = new URLSearchParams({ q: query, currentRegionName });
        const response = await fetch(`/api/location-suggestions?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          setSuggestions([]);
          return;
        }

        const data = await response.json();
        const next = Array.isArray(data?.suggestions) ? data.suggestions : [];
        setSuggestions(next);
        setSuggestionsOpen(next.length > 0);
        setActiveSuggestion(-1);
      } catch (error: any) {
        if (error?.name !== 'AbortError') {
          console.warn('[Scoutly Autocomplete] Falha ao buscar locais:', error);
          setSuggestions([]);
        }
      } finally {
        if (suggestionsAbortRef.current === controller) {
          setIsSuggesting(false);
        }
      }
    }, 280);

    return () => window.clearTimeout(timer);
  }, [searchInput, currentRegionName]);

  const chooseSuggestion = (suggestion: LocationSuggestion) => {
    const nextQuery = replaceLocationTail(searchInput, suggestion.label);
    suggestionsAbortRef.current?.abort();
    setSearchInput(nextQuery);
    setSuggestionsOpen(false);
    setActiveSuggestion(-1);
    onSearch(nextQuery);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (activeSuggestion >= 0 && suggestionsOpen && suggestions[activeSuggestion]) {
      chooseSuggestion(suggestions[activeSuggestion]);
      return;
    }
    if (searchInput.trim()) {
      setSuggestionsOpen(false);
      onSearch(searchInput.trim());
    }
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!suggestionsOpen || suggestions.length === 0) {
      if (event.key === 'Escape') setSuggestionsOpen(false);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSuggestion((current) => (current + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSuggestion((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
    } else if (event.key === 'Enter' && activeSuggestion >= 0) {
      event.preventDefault();
      chooseSuggestion(suggestions[activeSuggestion]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setSuggestionsOpen(false);
      setActiveSuggestion(-1);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-center gap-3 w-full shrink-0 pointer-events-auto">
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

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-white/70 backdrop-blur-md p-1.5 rounded-full shadow-sm border border-white/40 h-auto sm:h-[52px]">
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="relative flex items-center flex-1 sm:w-72 lg:w-80 group h-full"
        >
          <div className="absolute left-3.5 text-stone-400 group-focus-within:text-[#FF4D00] transition pointer-events-none z-10">
            <Search className="w-4 h-4" />
          </div>

          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            onFocus={() => suggestions.length > 0 && setSuggestionsOpen(true)}
            placeholder="Empresa, segmento ou local..."
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={suggestionsOpen}
            className="w-full h-full bg-white/80 border-none rounded-full pl-10 pr-24 py-2.5 text-xs text-stone-900 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-[#FF4D00]/50 transition shadow-inner"
          />

          {isSuggesting && (
            <div className="absolute right-[76px] top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            </div>
          )}

          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3.5 py-1.5 bg-stone-900 hover:bg-[#FF4D00] text-white rounded-full text-[11px] font-bold tracking-wider uppercase transition active:scale-95 shadow-2xs cursor-pointer"
          >
            BUSCAR
          </button>

          {suggestionsOpen && suggestions.length > 0 && (
            <div
              role="listbox"
              className="absolute top-[calc(100%+10px)] left-0 right-0 z-[80] overflow-hidden rounded-2xl border border-white/50 bg-white/90 backdrop-blur-2xl shadow-[0_18px_50px_rgba(28,25,23,0.18)] p-1.5"
            >
              <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-stone-400">
                Locais
              </div>
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.id}
                  type="button"
                  role="option"
                  aria-selected={activeSuggestion === index}
                  onMouseEnter={() => setActiveSuggestion(index)}
                  onClick={() => chooseSuggestion(suggestion)}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition cursor-pointer ${
                    activeSuggestion === index ? 'bg-[#FF4D00]/10' : 'hover:bg-stone-100/90'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    activeSuggestion === index ? 'bg-[#FF4D00] text-white' : 'bg-stone-100 text-[#FF4D00]'
                  }`}>
                    <MapPin className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-semibold text-stone-900 truncate">
                      {suggestion.primary}
                    </div>
                    <div className="text-[10px] text-stone-500 truncate">
                      {suggestion.secondary || suggestion.label}
                    </div>
                  </div>
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-stone-400 shrink-0">
                    {kindLabel(suggestion.kind)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </form>

        <button
          type="button"
          onClick={onUseCurrentLocation}
          disabled={isLocating}
          className="h-full px-4 py-2 bg-white/90 border-2 border-[#FF4D00] text-[#FF4D00] hover:bg-[#FF4D00] hover:text-white rounded-full text-xs font-bold tracking-wider uppercase transition disabled:opacity-50 whitespace-nowrap active:scale-95 shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
        >
          <Navigation className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline-block">{isLocating ? 'LOCALIZANDO' : 'PERTO DE VOCÊ'}</span>
        </button>

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

      <button
        type="button"
        onClick={onOpenFilters}
        className="flex items-center gap-2 h-[52px] px-5 py-2 bg-white/70 backdrop-blur-md hover:bg-white border border-white/40 text-stone-700 hover:text-stone-900 rounded-full text-xs font-bold tracking-wider uppercase transition active:scale-95 shadow-sm cursor-pointer ml-auto sm:ml-0"
      >
        <SlidersHorizontal className="w-4 h-4" />
        <span>Filtros</span>
      </button>

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
