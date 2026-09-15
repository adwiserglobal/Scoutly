import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { ChevronDown, ChevronUp, SlidersHorizontal, X } from 'lucide-react';
import { Business, ActiveFilters, LeadStatus, NavigationTab } from './types';
import { searchAddressOrCity } from './services/geocoding';
import { fetchUserLeads, saveUserLead } from './services/api';
import { mapCacheService } from './services/mapCacheService';
import { useAuth } from './context/AuthContext';
import BottomMenu from './components/BottomMenu';
import Header from './components/Header';
import FilterBar from './components/FilterBar';
import InteractiveMap, { MapBounds } from './components/InteractiveMap';
import BusinessCard from './components/BusinessCard';
import BusinessDetailsModal from './components/BusinessDetailsModal';
import LoadingScreen from './components/LoadingScreen';
import AIAssistantDrawer from './components/AIAssistantDrawer';
import FavoritesView from './components/FavoritesView';
import PipelineView from './components/PipelineView';
import SettingsView from './components/SettingsView';
import LoginView from './components/LoginView';

export default function App() {
  const { user, loading, signOut } = useAuth();
  const [currentTab, setCurrentTab] = useState<NavigationTab>('INICIO');
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [userLeadsMap, setUserLeadsMap] = useState<Record<string, { status: LeadStatus; notes: string }>>({});
  const [userFavoritesMap, setUserFavoritesMap] = useState<Record<string, boolean>>({});
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isBusinessesLoading, setIsBusinessesLoading] = useState(false);
  const [businessesError, setBusinessesError] = useState<string | null>(null);
  const [isZoomTooLow, setIsZoomTooLow] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(14);
  
  const [isListOpen, setIsListOpen] = useState(false); // New state for businesses list drawer
  const [isFiltersOpen, setIsFiltersOpen] = useState(false); // New state for filters drawer

  const [currentRegionName, setCurrentRegionName] = useState('São Paulo - Pinheiros');
  const [centerCoordinates, setCenterCoordinates] = useState({
    lat: -23.5658,
    lng: -46.6872,
  });

  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [modalBusiness, setModalBusiness] = useState<Business | null>(null);
  const [isAIChatOpen, setIsAIChatOpen] = useState<boolean>(false);

  // Pagination / Progressive Rendering for High Performance (prevent DOM overload)
  const [visibleCount, setVisibleCount] = useState<number>(30);

  // Multi-select Filters (allows multiple simultaneous filters: e.g. sem site + com whatsapp)
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({
    semSite: false,
    comSite: false,
    comWhatsapp: false,
    comRedeSocial: false,
  });
  const [selectedCategory, setSelectedCategory] = useState<string>('TODAS');
  const [sortBy, setSortBy] = useState<'CONFIDENCE' | 'NOME' | 'COM_CONTATO'>('CONFIDENCE');
  const [isLocating, setIsLocating] = useState(false);

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(30);
  }, [activeFilters, selectedCategory, sortBy, businesses]);

  const handleToggleFilter = useCallback((filterKey: keyof ActiveFilters | 'TODOS') => {
    if (filterKey === 'TODOS') {
      setActiveFilters({
        semSite: false,
        comSite: false,
        comWhatsapp: false,
        comRedeSocial: false,
      });
      return;
    }

    setActiveFilters((prev) => {
      const next = { ...prev };
      if (filterKey === 'semSite') {
        next.semSite = !prev.semSite;
        if (next.semSite) next.comSite = false;
      } else if (filterKey === 'comSite') {
        next.comSite = !prev.comSite;
        if (next.comSite) next.semSite = false;
      } else if (filterKey === 'comWhatsapp') {
        next.comWhatsapp = !prev.comWhatsapp;
      } else if (filterKey === 'comRedeSocial') {
        next.comRedeSocial = !prev.comRedeSocial;
      }
      return next;
    });
  }, []);

  // Refs for debouncing and request cancellation
  const debounceTimerRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const leadsMapRef = useRef<Record<string, { status: LeadStatus; notes: string }>>({});
  leadsMapRef.current = userLeadsMap;
  const favoritesMapRef = useRef<Record<string, boolean>>({});
  favoritesMapRef.current = userFavoritesMap;

  // Load persistent user leads and favorites from database on mount
  useEffect(() => {
    fetchUserLeads().then((data) => {
      if (data && data.leads) {
        setUserLeadsMap(data.leads);
      }
      if (data && data.favorites) {
        setUserFavoritesMap(data.favorites);
      }
    });
  }, []);

  // Dynamic available categories with counts
  const availableCategories = useMemo(() => {
    const catMap = new Map<string, number>();
    for (const b of businesses) {
      if (b.category) {
        catMap.set(b.category, (catMap.get(b.category) || 0) + 1);
      }
    }
    return Array.from(catMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [businesses]);

  // Handle map bounding box update (with 600ms debounce & request cancellation)
  const handleBoundsChange = useCallback(
    (bounds: MapBounds | null, zoom: number) => {
      setCurrentZoom(zoom);

      // Cancel any pending debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      // Check zoom constraint (supports zoom 11+ smoothly)
      if (zoom < 11 || !bounds) {
        setIsZoomTooLow(true);
        mapCacheService.cancelOngoingRequests();
        setIsBusinessesLoading(false);
        return;
      }

      setIsZoomTooLow(false);

      // Debounce the query between 200-350ms (280ms optimal for Google Maps-like fluidity)
      debounceTimerRef.current = setTimeout(async () => {
        setIsBusinessesLoading(true);
        setBusinessesError(null);

        try {
          await mapCacheService.loadViewport(
            bounds,
            zoom,
            (allPlaces, fromCache) => {
              // Merge with persistent user leads and favorites from database
              const currentLeads = leadsMapRef.current;
              const currentFavorites = favoritesMapRef.current;
              const mergedPlaces = allPlaces.map((p) => {
                const saved = currentLeads[p.id];
                const isFav = Boolean(currentFavorites[p.id]);
                return {
                  ...p,
                  isFavorite: isFav,
                  leadStatus: saved ? (saved.status as LeadStatus) : 'NOVO',
                  notes: saved ? saved.notes : '',
                };
              });

              // Progressive state update without clearing screen or flickering
              setBusinesses(mergedPlaces);
            }
          );
        } catch (err: any) {
          if (err.name === 'AbortError') {
            return;
          }
          console.warn('[Places Fetch Warning]:', err.message || err);
          setBusinessesError(
            err.message || 'Não foi possível obter dados para esta área.'
          );
        } finally {
          setIsBusinessesLoading(false);
        }
      }, 280);
    },
    []
  );

  // Geocoding Search
  const handleSearch = async (query: string) => {
    setIsLocating(true);
    const result = await searchAddressOrCity(query);

    if (result) {
      setCenterCoordinates({ lat: result.lat, lng: result.lng });
      setCurrentRegionName(result.name);
    } else {
      alert(`Local não encontrado para "${query}". Tente um nome de cidade ou bairro.`);
    }
    setIsLocating(false);
  };

  // Browser Geolocation
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocalização não é suportada pelo seu navegador.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCenterCoordinates({ lat: latitude, lng: longitude });
        setCurrentRegionName('Sua Localização Atual');
        setIsLocating(false);
      },
      (error) => {
        setIsLocating(false);
        console.warn('Erro ao obter localização:', error);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Preset region click
  const handleSelectPreset = (preset: { name: string; lat: number; lng: number }) => {
    setCenterCoordinates({ lat: preset.lat, lng: preset.lng });
    setCurrentRegionName(preset.name);
  };

  // Calculate opportunities count (businesses without website)
  const opportunitiesCount = useMemo(() => {
    return businesses.filter((b) => !b.website).length;
  }, [businesses]);

  // Calculate businesses with WhatsApp/Phone
  const whatsappCount = useMemo(() => {
    return businesses.filter((b) => Boolean(b.phone || (b.phones && b.phones.length > 0))).length;
  }, [businesses]);

  // Calculate businesses with Social Networks
  const socialsCount = useMemo(() => {
    return businesses.filter((b) => Boolean(b.socials && b.socials.length > 0)).length;
  }, [businesses]);

  // Filter & Sort businesses
  const filteredBusinesses = useMemo(() => {
    let list = businesses.filter((biz) => {
      // Multi-filter: Sem site
      if (activeFilters.semSite && biz.website) {
        return false;
      }

      // Multi-filter: Com site
      if (activeFilters.comSite && !biz.website) {
        return false;
      }

      // Multi-filter: Com WhatsApp
      if (
        activeFilters.comWhatsapp &&
        !biz.phone &&
        (!biz.phones || biz.phones.length === 0)
      ) {
        return false;
      }

      // Multi-filter: Com rede social
      if (
        activeFilters.comRedeSocial &&
        (!biz.socials || biz.socials.length === 0)
      ) {
        return false;
      }

      // Filter: Category
      if (selectedCategory !== 'TODAS' && biz.category !== selectedCategory) {
        return false;
      }

      return true;
    });

    // Sorting
    if (sortBy === 'CONFIDENCE') {
      list.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    } else if (sortBy === 'NOME') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'COM_CONTATO') {
      list.sort((a, b) => {
        const aHasPhone = a.phone || a.phones.length > 0 ? 1 : 0;
        const bHasPhone = b.phone || b.phones.length > 0 ? 1 : 0;
        if (bHasPhone !== aHasPhone) return bHasPhone - aHasPhone;
        return (b.confidence || 0) - (a.confidence || 0);
      });
    }

    return list;
  }, [businesses, activeFilters, selectedCategory, sortBy]);

  // Progressive rendering slice for buttery smooth 60fps scrolling
  const displayedBusinesses = useMemo(() => {
    return filteredBusinesses.slice(0, visibleCount);
  }, [filteredBusinesses, visibleCount]);

  // Stable callbacks for BusinessCard memoization
  const handleCardSelect = useCallback((biz: Business) => {
    setSelectedBusiness(biz);
    setModalBusiness(biz);
  }, []);

  const handleOpenDetails = useCallback((biz: Business) => {
    setModalBusiness(biz);
  }, []);

  // Toggle Favorite status (and persist in database)
  const handleToggleFavorite = useCallback((biz: Business) => {
    const nextIsFavorite = !biz.isFavorite;
    setBusinesses((prev) =>
      prev.map((b) => (b.id === biz.id ? { ...b, isFavorite: nextIsFavorite } : b))
    );
    setModalBusiness((prev) =>
      prev && prev.id === biz.id ? { ...prev, isFavorite: nextIsFavorite } : prev
    );
    setSelectedBusiness((prev) =>
      prev && prev.id === biz.id ? { ...prev, isFavorite: nextIsFavorite } : prev
    );
    setUserFavoritesMap((prev) => ({
      ...prev,
      [biz.id]: nextIsFavorite,
    }));
    // Save favorite state to database
    saveUserLead(biz.id, undefined, undefined, nextIsFavorite);
  }, []);

  // Update Lead Status (and persist in database)
  const handleUpdateStatus = useCallback((id: string, newStatus: LeadStatus, notes?: string) => {
    const updatedNotes = notes !== undefined ? notes : '';
    setBusinesses((prev) =>
      prev.map((b) => (b.id === id ? { ...b, leadStatus: newStatus, notes: updatedNotes } : b))
    );
    setModalBusiness((prev) =>
      prev && prev.id === id ? { ...prev, leadStatus: newStatus, notes: updatedNotes } : prev
    );
    setSelectedBusiness((prev) =>
      prev && prev.id === id ? { ...prev, leadStatus: newStatus, notes: updatedNotes } : prev
    );
    setUserLeadsMap((prev) => ({
      ...prev,
      [id]: { status: newStatus, notes: updatedNotes },
    }));
    // Save to persistent database
    saveUserLead(id, newStatus, updatedNotes);
  }, []);

  const favoritesCount = useMemo(() => {
    return businesses.filter((b) => Boolean(b.isFavorite)).length;
  }, [businesses]);

  const pipelineDealsCount = useMemo(() => {
    return businesses.filter(
      (b) => b.leadStatus && b.leadStatus !== 'NOVO'
    ).length;
  }, [businesses]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <LoginView />;
  }

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#FAF7F2] text-stone-900 font-sans flex flex-col">
      
      {/* Background Fullscreen Map */}
      <div className="absolute inset-0 z-0">
        {mapError && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#FAF7F2]/80 p-6 text-center">
            <span className="text-sm font-semibold text-red-600 mb-2">
              Erro ao carregar mapa
            </span>
            <span className="text-xs text-stone-600">{mapError}</span>
          </div>
        )}

          <InteractiveMap
            businesses={filteredBusinesses}
            selectedBusiness={selectedBusiness}
            onSelectBusiness={(biz) => {
              setSelectedBusiness(biz);
              setModalBusiness(biz);
            }}
            centerCoordinates={centerCoordinates}
            zoom={14}
            activeFilters={activeFilters}
            onMapLoad={() => setIsMapLoading(false)}
            onMapError={(err) => {
              setIsMapLoading(false);
              setMapError(err.message);
            }}
            onBoundsChange={handleBoundsChange}
          />
      </div>

      {/* Main Foreground Layer */}
      <div className="relative z-10 w-full h-full flex flex-col pointer-events-none">
        
        {/* Only show Header & Filters on INICIO tab */}
        {currentTab === 'INICIO' && (
          <>
            <div className="absolute top-4 left-4 right-4 z-30 pointer-events-none flex items-start justify-center">
              <div className="max-w-[1400px] w-full flex flex-col items-center justify-between pointer-events-none">
                <Header
                  currentRegionName={currentRegionName}
                  onSearch={handleSearch}
                  onUseCurrentLocation={handleUseCurrentLocation}
                  onSelectPreset={handleSelectPreset}
                  onOpenAIAssistant={() => setIsAIChatOpen(true)}
                  isLocating={isLocating}
                  totalOpportunitiesCount={opportunitiesCount}
                  totalBusinessesCount={filteredBusinesses.length}
                  onOpenFilters={() => setIsFiltersOpen(true)}
                />
              </div>
            </div>

            {/* Side Drawer for Filters - Glassmorphism */}
            <div 
              className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[400px] bg-stone-900/85 backdrop-blur-2xl border-l border-white/10 shadow-2xl flex flex-col pointer-events-auto transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                isFiltersOpen ? 'translate-x-0' : 'translate-x-full'
              }`}
            >
              {/* Backdrop */}
              <div 
                className={`fixed inset-0 bg-black/40 backdrop-blur-xs -z-10 transition-opacity duration-500 ${
                  isFiltersOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                }`}
                onClick={() => setIsFiltersOpen(false)}
              />

              <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-white/5 backdrop-blur-md shrink-0">
                <div className="flex items-center gap-2.5">
                  <SlidersHorizontal className="w-5 h-5 text-[#FF4D00]" />
                  <h2 className="text-base font-bold text-white tracking-wide">Filtros</h2>
                </div>
                <button
                  onClick={() => setIsFiltersOpen(false)}
                  className="p-2 text-stone-400 hover:text-white hover:bg-white/10 rounded-full transition cursor-pointer"
                  title="Fechar filtros"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 text-stone-200">
                <FilterBar
                  activeFilters={activeFilters}
                  onToggleFilter={handleToggleFilter}
                  selectedCategory={selectedCategory}
                  onSelectCategory={setSelectedCategory}
                  availableCategories={availableCategories}
                  sortBy={sortBy}
                  onSelectSortBy={setSortBy}
                  filteredCount={filteredBusinesses.length}
                  totalCount={businesses.length}
                  opportunitiesCount={opportunitiesCount}
                  whatsappCount={whatsappCount}
                  socialsCount={socialsCount}
                />
              </div>
            </div>
            
            {/* Zoom Alert Overlay */}
            {isZoomTooLow && !isMapLoading && (
              <div className="absolute top-[180px] left-1/2 -translate-x-1/2 z-20 bg-amber-500/90 text-white backdrop-blur-md px-4 py-2 rounded-xl text-xs font-bold shadow-md animate-bounce pointer-events-auto">
                Aproxime o mapa para visualizar os negócios (Zoom {Math.round(currentZoom)}/12)
              </div>
            )}
          </>
        )}

        {/* Business List Drawer Overlay for INICIO tab */}
        {currentTab === 'INICIO' && (
          <div 
            className={`absolute inset-x-0 bottom-0 top-[140px] z-20 flex justify-center pointer-events-none transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isListOpen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
            }`}
          >
            {/* Backdrop Blur effect over the map when list is open */}
            <div 
              className={`absolute inset-0 bg-white/30 transition-opacity duration-700 ${isListOpen ? 'opacity-100 backdrop-blur-md pointer-events-auto' : 'opacity-0'}`} 
              onClick={() => setIsListOpen(false)}
            />
            
            {/* The List Container */}
            <div className="relative w-full max-w-4xl h-full bg-[#FAF7F2] rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] flex flex-col pointer-events-auto border border-[#EDE8E0] transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] pb-24">
              {/* Drawer Handle */}
              <button 
                onClick={() => setIsListOpen(false)}
                className="w-full flex flex-col items-center justify-center p-3 cursor-pointer hover:bg-stone-50 rounded-t-3xl transition"
              >
                <div className="w-12 h-1.5 bg-stone-300 rounded-full mb-2" />
                <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1">
                  Ocultar Empresas <ChevronDown className="w-3 h-3" />
                </span>
              </button>

              <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-8 custom-scrollbar">
                <div className="flex items-center justify-between px-1 mb-4">
                  <span className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                    Estabelecimentos em {currentRegionName.split(',')[0]}
                  </span>
                  <span className="text-xs font-semibold text-stone-500">
                    {isBusinessesLoading ? (
                      <span className="text-[#FF4D00] font-bold animate-pulse">Carregando dados...</span>
                    ) : (
                      `${filteredBusinesses.length} ${filteredBusinesses.length === 1 ? 'negócio' : 'negócios'}`
                    )}
                  </span>
                </div>

                {/* Error Banner */}
                {businessesError && (
                  <div className="bg-red-50 text-red-700 p-4 rounded-2xl text-xs border border-red-200 leading-relaxed mb-4">
                    {businessesError}
                  </div>
                )}

                {/* List or Empty State */}
                {filteredBusinesses.length === 0 && !isBusinessesLoading && !isZoomTooLow ? (
                  <div className="bg-white rounded-2xl p-8 border border-[#EDE8E0] text-center mt-4">
                    <p className="text-sm font-semibold text-stone-800 mb-1">
                      Nenhum estabelecimento encontrado nesta área.
                    </p>
                    <p className="text-xs text-stone-500">
                      Mova o mapa para outra região ou ajuste os filtros acima.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3.5">
                    {displayedBusinesses.map((biz, idx) => (
                      <BusinessCard
                        key={biz.id}
                        business={biz}
                        index={idx}
                        isSelected={selectedBusiness?.id === biz.id}
                        onSelect={() => handleCardSelect(biz)}
                        onOpenDetails={handleOpenDetails}
                        onToggleFavorite={handleToggleFavorite}
                      />
                    ))}

                    {/* Progressive Load More button */}
                    {visibleCount < filteredBusinesses.length && (
                      <div className="pt-2 pb-4 flex flex-col items-center gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => setVisibleCount((prev) => Math.min(prev + 30, filteredBusinesses.length))}
                          className="w-full py-3 px-4 rounded-2xl bg-white border border-[#EDE8E0] hover:border-[#FF4D00] text-stone-800 hover:text-[#FF4D00] text-xs font-bold transition shadow-2xs hover:shadow-xs active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <span>Carregar mais 30 estabelecimentos</span>
                          <span className="text-[11px] text-stone-400 font-normal">
                            ({displayedBusinesses.length} de {filteredBusinesses.length} visíveis)
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setVisibleCount(filteredBusinesses.length)}
                          className="text-[11px] text-stone-500 hover:text-stone-800 font-medium underline underline-offset-2 transition cursor-pointer"
                        >
                          Exibir todos ({filteredBusinesses.length})
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* View Businesses Button (floating below BottomMenu) */}
        {currentTab === 'INICIO' && (
          <div className="absolute bottom-[18px] left-1/2 -translate-x-1/2 z-30 pointer-events-auto transition-transform duration-500">
            <button
              onClick={() => setIsListOpen(!isListOpen)}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-white/70 hover:bg-white text-stone-700 hover:text-stone-900 rounded-full text-[10px] font-bold tracking-wider uppercase transition-all shadow-md border border-white/40 backdrop-blur-md cursor-pointer hover:scale-105 active:scale-95"
            >
              {isListOpen ? (
                <>
                  <ChevronDown className="w-3.5 h-3.5" /> Ocultar
                </>
              ) : (
                <>
                  <ChevronUp className="w-3.5 h-3.5" /> Ver Empresas
                </>
              )}
              {!isListOpen && filteredBusinesses.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-[#FF4D00] rounded-full text-[9px] text-white">
                  {filteredBusinesses.length}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Other Tabs Content */}
        {currentTab === 'FAVORITOS' && (
          <div className="absolute inset-0 z-20 bg-[#FAF7F2] overflow-y-auto pointer-events-auto pb-24 pt-4">
            <FavoritesView
              businesses={businesses}
              onSelectBusiness={(biz) => {
                setSelectedBusiness(biz);
                setModalBusiness(biz);
              }}
              onUpdateLeadStatus={handleUpdateStatus}
              onToggleFavorite={handleToggleFavorite}
              onNavigateToExplore={() => setCurrentTab('INICIO')}
              onOpenAIChat={() => setIsAIChatOpen(true)}
            />
          </div>
        )}

        {currentTab === 'PIPELINE' && (
          <div className="absolute inset-0 z-20 bg-[#FAF7F2] overflow-y-auto pointer-events-auto pb-24 pt-4">
            <PipelineView
              businesses={businesses}
              onSelectBusiness={(biz) => {
                setSelectedBusiness(biz);
                setModalBusiness(biz);
              }}
              onUpdateLeadStatus={handleUpdateStatus}
              onOpenAIChat={() => setIsAIChatOpen(true)}
              onNavigateToExplore={() => setCurrentTab('INICIO')}
            />
          </div>
        )}

        {currentTab === 'CONFIGURACOES' && (
          <div className="absolute inset-0 z-20 bg-[#FAF7F2] overflow-y-auto pointer-events-auto pb-24 pt-4">
            <SettingsView
              businesses={businesses}
              currentRegionName={currentRegionName}
              onClearLocalCache={() => {
                localStorage.clear();
                mapCacheService.clear();
                setUserLeadsMap({});
                setBusinesses([]);
              }}
            />
          </div>
        )}
      </div>

      <BottomMenu
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        savedLeadsCount={favoritesCount}
        pipelineDealsCount={pipelineDealsCount}
      />

      {/* Map Loading Indicator */}
      {currentTab === 'INICIO' && isBusinessesLoading && (
        <div className="fixed bottom-[90px] left-1/2 -translate-x-1/2 z-40 flex items-center gap-2.5 pointer-events-none transition-all duration-300 drop-shadow-md">
          <div className="w-4 h-4 border-[2.5px] border-[#FF4D00] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-black text-white tracking-widest flex items-center drop-shadow-md">
            CARREGANDO<span className="inline-block w-3 text-left loading-dots" />
          </span>
        </div>
      )}

      {/* Business Details Modal */}
      <BusinessDetailsModal
        business={modalBusiness}
        onClose={() => setModalBusiness(null)}
        onUpdateStatus={handleUpdateStatus}
        onToggleFavorite={handleToggleFavorite}
      />

      {/* Scoutly Copilot AI Assistant Drawer */}
      <AIAssistantDrawer
        isOpen={isAIChatOpen}
        onClose={() => setIsAIChatOpen(false)}
        businesses={businesses}
        currentRegionName={currentRegionName}
        onSelectBusiness={(biz) => {
          setSelectedBusiness(biz);
          setModalBusiness(biz);
        }}
        onUpdateLeadStatus={handleUpdateStatus}
        onApplyNewRegion={(region) => {
          setCurrentRegionName(region.name);
          setCenterCoordinates(region.center);
          if (region.businesses && region.businesses.length > 0) {
            setBusinesses(region.businesses);
          }
        }}
      />

      {/* Floating Action Button: Scoutly AI (Orange Liquid Glass Design) */}
      {!isAIChatOpen && !isFiltersOpen && currentTab === 'INICIO' && (
        <button
          type="button"
          onClick={() => setIsAIChatOpen(true)}
          className="fixed bottom-[52px] right-4 lg:right-8 z-30 overflow-hidden orange-liquid-glass px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-2.5 cursor-pointer active:scale-95 group transition-all duration-300 hover:scale-105 pointer-events-auto"
        >
          {/* Glass reflection highlight overlay */}
          <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/40 to-transparent pointer-events-none rounded-t-full" />

          <img
            src="/ai-icon.png"
            alt="Scoutly AI"
            className="w-7 h-7 rounded-full object-cover shrink-0 border border-white/70 shadow-2xs relative z-10 group-hover:scale-110 transition-transform"
          />
          <span className="text-xs font-black text-white tracking-wider uppercase drop-shadow-xs relative z-10">
            Scoutly AI
          </span>
        </button>
      )}
    </div>
  );
}
