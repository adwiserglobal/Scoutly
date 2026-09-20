import { FormEvent, KeyboardEvent, memo, useEffect, useRef, useState } from 'react';
import { Loader2, LocateFixed, MapPin, Search, SlidersHorizontal } from 'lucide-react';
import { Business } from '../types';
import RecommendedDropdown from './RecommendedDropdown';

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
  recommendedBusinesses: Business[];
  recommendationsLocked: boolean;
  onSelectRecommended: (business: Business) => void;
  onOpenRecommendationsUpgrade: () => void;
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
  recommendedBusinesses,
  recommendationsLocked,
  onSelectRecommended,
  onOpenRecommendationsUpgrade,
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

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

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
    <div className="w-full pointer-events-auto pl-14 lg:pl-[72px] lg:pr-0">
      <div className="flex w-full items-center gap-2 max-[430px]:flex-wrap">
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="relative min-w-0 flex-1 max-[430px]:order-1 max-[430px]:basis-full"
        >
          <div className="relative flex h-[52px] items-center rounded-2xl border border-white/10 bg-[#111418]/[0.94] shadow-[0_14px_44px_rgba(0,0,0,0.32)] backdrop-blur-2xl">
            <Search className="pointer-events-none absolute left-4 h-4 w-4 text-stone-400" />

            <input
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={handleInputKeyDown}
              onFocus={() => suggestions.length > 0 && setSuggestionsOpen(true)}
              placeholder="Busque empresas, categorias ou bairros"
              autoComplete="off"
              aria-autocomplete="list"
              aria-expanded={suggestionsOpen}
              className="h-full w-full rounded-2xl bg-transparent pl-11 pr-[88px] text-[13px] text-white outline-none placeholder:text-stone-500 focus:ring-1 focus:ring-inset focus:ring-[#FF5A12]/45 sm:pr-[104px]"
            />

            {isSuggesting && (
              <Loader2 className="absolute right-[78px] h-3.5 w-3.5 animate-spin text-stone-500 sm:right-[92px]" />
            )}

            <button
              type="submit"
              className="absolute right-1.5 flex h-9 items-center justify-center rounded-xl bg-[#FF5A12] px-3.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-[#ff6a27] active:scale-[0.97] sm:px-4"
            >
              Buscar
            </button>
          </div>

          {suggestionsOpen && suggestions.length > 0 && (
            <div
              role="listbox"
              className="absolute left-0 right-0 top-[calc(100%+8px)] z-[80] overflow-hidden rounded-2xl border border-white/10 bg-[#121519]/[0.96] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.46)] backdrop-blur-2xl"
            >
              <div className="px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-stone-500">
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
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                    activeSuggestion === index ? 'bg-[#FF5A12]/12' : 'hover:bg-white/[0.05]'
                  }`}
                >
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                    activeSuggestion === index ? 'bg-[#FF5A12] text-white' : 'bg-white/[0.05] text-[#FF6A26]'
                  }`}>
                    <MapPin className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-medium text-white">{suggestion.primary}</div>
                    <div className="truncate text-[10px] text-stone-500">{suggestion.secondary || suggestion.label}</div>
                  </div>
                  <span className="shrink-0 text-[9px] font-medium uppercase tracking-wide text-stone-600">
                    {kindLabel(suggestion.kind)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </form>

        <button
          type="button"
          onClick={onOpenFilters}
          className="flex h-[52px] shrink-0 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[#111418]/[0.94] px-3.5 max-[430px]:order-2 max-[430px]:h-10 max-[430px]:flex-1 text-stone-200 shadow-[0_14px_44px_rgba(0,0,0,0.28)] backdrop-blur-2xl transition hover:border-white/20 hover:bg-[#171a1f] sm:px-4"
          title="Filtros"
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden text-[11px] font-semibold sm:inline">Filtros</span>
        </button>

        <button
          type="button"
          onClick={onUseCurrentLocation}
          disabled={isLocating}
          className="flex h-[52px] shrink-0 items-center justify-center gap-2 rounded-2xl border border-[#FF5A12]/70 bg-[#161413]/[0.94] px-3.5 max-[430px]:order-2 max-[430px]:h-10 max-[430px]:flex-1 text-[#FF6A26] shadow-[0_14px_44px_rgba(0,0,0,0.28)] backdrop-blur-2xl transition hover:bg-[#FF5A12]/10 disabled:opacity-50 sm:px-4"
          title="Usar minha localização"
        >
          {isLocating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
          <span className="hidden text-[11px] font-semibold xl:inline">
            {isLocating ? 'Localizando' : 'Perto de você'}
          </span>
        </button>

        <div className="hidden 2xl:block">
          <RecommendedDropdown
            businesses={recommendedBusinesses}
            locked={recommendationsLocked}
            onSelectBusiness={onSelectRecommended}
            onUpgrade={onOpenRecommendationsUpgrade}
          />
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2 lg:hidden">
        <div className="max-w-[55vw] truncate rounded-full border border-white/10 bg-[#111418]/[0.82] px-3 py-1.5 text-[9px] font-medium text-stone-400 backdrop-blur-xl">
          {currentRegionName}
        </div>
        <div className="rounded-full border border-white/10 bg-[#111418]/[0.82] px-3 py-1.5 text-[9px] font-semibold text-stone-300 backdrop-blur-xl">
          {new Intl.NumberFormat('pt-BR').format(totalBusinessesCount)} resultados
        </div>
      </div>
    </div>
  );
}

export default memo(Header);
