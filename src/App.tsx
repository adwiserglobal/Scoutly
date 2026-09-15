import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { Business, ActiveFilters, LeadStatus, NavigationTab } from './types';
import { searchAddressOrCity } from './services/geocoding';
import { fetchPlacesFromOverture, fetchUserLeads, saveUserLead } from './services/api';
import { useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
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
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isBusinessesLoading, setIsBusinessesLoading] = useState(false);
  const [businessesError, setBusinessesError] = useState<string | null>(null);
  const [isZoomTooLow, setIsZoomTooLow] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(14);

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

  // Load persistent user leads from database on mount
  useEffect(() => {
    fetchUserLeads().then((leads) => {
      if (leads) {
        setUserLeadsMap(leads);
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

      // Check zoom constraint
      if (zoom < 12 || !bounds) {
        setIsZoomTooLow(true);
        // Abort any ongoing query
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
        }
        setIsBusinessesLoading(false);
        return;
      }

      setIsZoomTooLow(false);

      // Debounce the query by 600ms
      debounceTimerRef.current = setTimeout(async () => {
        // Abort previous in-flight request if user moved map again
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        setIsBusinessesLoading(true);
        setBusinessesError(null);

        try {
          const places = await fetchPlacesFromOverture(
            bounds.west,
            bounds.south,
            bounds.east,
            bounds.north,
            5000,
            controller.signal
          );
          
          // Merge with persistent user leads from database
          const currentLeads = leadsMapRef.current;
          const mergedPlaces = places.map((p) => {
            const saved = currentLeads[p.id];
            return {
              ...p,
              leadStatus: saved ? (saved.status as LeadStatus) : 'NOVO',
              notes: saved ? saved.notes : '',
            };
          });

          setBusinesses(mergedPlaces);
        } catch (err: any) {
          if (err.name === 'AbortError') {
            // Ignored, user panned map
            return;
          }
          console.warn('[Places Fetch Warning]:', err.message || err);
          setBusinessesError(
            err.message || 'Não foi possível obter dados para esta área.'
          );
        } finally {
          setIsBusinessesLoading(false);
        }
      }, 600);
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

  // Update Lead Status (and persist in database)
  const handleUpdateStatus = useCallback((id: string, newStatus: LeadStatus, notes?: string) => {
    const updatedNotes = notes || '';
    setBusinesses((prev) =>
      prev.map((b) => (b.id === id ? { ...b, leadStatus: newStatus, notes: updatedNotes } : b))
    );
    setUserLeadsMap((prev) => ({
      ...prev,
      [id]: { status: newStatus, notes: updatedNotes },
    }));
    // Save to persistent database
    saveUserLead(id, newStatus, updatedNotes);
  }, []);

  const savedLeadsCount = useMemo(() => {
    return businesses.filter((b) => b.leadStatus && b.leadStatus !== 'NOVO').length;
  }, [businesses]);

  const pipelineDealsCount = useMemo(() => {
    return businesses.filter(
      (b) => b.leadStatus === 'CONTATADO' || b.leadStatus === 'EM_NEGOCIACAO'
    ).length;
  }, [businesses]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <LoginView />;
  }

  return (
    <div className="min-h-screen flex flex-row bg-[#FAF7F2] text-stone-900 font-sans">
      {/* Sidebar na lateral esquerda */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        savedLeadsCount={savedLeadsCount}
        pipelineDealsCount={pipelineDealsCount}
        onOpenAIChat={() => setIsAIChatOpen(true)}
        onLogout={signOut}
      />

      {/* Área principal das telas */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        {currentTab === 'INICIO' && (
          <>
            {/* Header */}
            <Header
              currentRegionName={currentRegionName}
              onSearch={handleSearch}
              onUseCurrentLocation={handleUseCurrentLocation}
              onSelectPreset={handleSelectPreset}
              onOpenAIAssistant={() => setIsAIChatOpen(true)}
              isLocating={isLocating}
              totalOpportunitiesCount={opportunitiesCount}
            />

            {/* Filter Bar */}
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

            {/* Main Interactive Workspace */}
            <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 flex flex-col gap-6">
              {/* Split Section: Interactive Map + Business Cards Feed */}
              <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Map View (Left Column - 7 cols on Desktop - Fixed on scroll) */}
                <div className="lg:col-span-7 h-[460px] lg:h-[calc(100vh-2rem)] lg:sticky lg:top-4 rounded-3xl overflow-hidden shadow-xs border border-[#EDE8E0] relative bg-stone-100 shrink-0">
                  {/* Loading Overlay com blur suave, gif e indicador carregando */}
                  {(isMapLoading || isBusinessesLoading) && (
                    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#FFF8F3]/80 backdrop-blur-xs transition-all duration-300 pointer-events-none p-4">
                      <div className="flex flex-col items-center justify-center text-center">
                        <img
                          src="/scoutly-loading.gif"
                          alt="Carregando"
                          className="w-32 h-32 sm:w-44 sm:h-44 object-contain drop-shadow-xs"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        <div className="flex items-center justify-center gap-2.5 mt-2">
                          <div className="w-4 h-4 border-2 border-[#FF4D00] border-t-transparent rounded-full animate-spin shrink-0"></div>
                          <span className="text-xs font-bold uppercase tracking-wider text-stone-900">
                            Carregando
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {mapError && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#FAF7F2] p-6 text-center">
                      <span className="text-sm font-semibold text-red-600 mb-2">
                        Erro ao carregar mapa
                      </span>
                      <span className="text-xs text-stone-600">{mapError}</span>
                    </div>
                  )}

                  {/* Zoom Alert Overlay */}
                  {isZoomTooLow && !isMapLoading && (
                    <div className="absolute top-4 right-14 z-20 bg-amber-500/90 text-white backdrop-blur-md px-4 py-2 rounded-xl text-xs font-bold shadow-md animate-bounce">
                      Aproxime o mapa para visualizar os negócios (Zoom {Math.round(currentZoom)}/12)
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
                    onMapLoad={() => setIsMapLoading(false)}
                    onMapError={(err) => {
                      setIsMapLoading(false);
                      setMapError(err.message);
                    }}
                    onBoundsChange={handleBoundsChange}
                  />
                </div>

                {/* Business Cards Feed (Right Column - 5 cols on Desktop) */}
                <div className="lg:col-span-5 flex flex-col gap-3.5">
                  <div className="flex items-center justify-between px-1">
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

                  {/* Low Zoom Warning */}
                  {isZoomTooLow && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-2xl text-xs leading-relaxed">
                      <p className="font-bold text-sm mb-1">Aproxime o mapa para visualizar os negócios</p>
                      <p className="text-amber-700">
                        Para garantir alta performance e precisão, os dados de estabelecimentos são carregados no nível de aproximação 12 ou superior.
                      </p>
                    </div>
                  )}

                  {/* Error Banner */}
                  {businessesError && (
                    <div className="bg-red-50 text-red-700 p-4 rounded-2xl text-xs border border-red-200 leading-relaxed">
                      {businessesError}
                    </div>
                  )}

                  {/* List or Empty State */}
                  {filteredBusinesses.length === 0 && !isBusinessesLoading && !isZoomTooLow ? (
                    <div className="bg-white rounded-2xl p-8 border border-[#EDE8E0] text-center">
                      <p className="text-sm font-semibold text-stone-800 mb-1">
                        Nenhum estabelecimento encontrado nesta área.
                      </p>
                      <p className="text-xs text-stone-500">
                        Mova o mapa para outra região ou ajuste os filtros acima.
                      </p>
                    </div>
                  ) : (
                    <>
                      {displayedBusinesses.map((biz, idx) => (
                        <BusinessCard
                          key={biz.id}
                          business={biz}
                          index={idx}
                          isSelected={selectedBusiness?.id === biz.id}
                          onSelect={() => handleCardSelect(biz)}
                          onOpenDetails={handleOpenDetails}
                          onToggleFavorite={(b) => {
                            const isFav = Boolean(b.leadStatus && b.leadStatus !== 'NOVO');
                            handleUpdateStatus(b.id, isFav ? 'NOVO' : 'CONTATADO', b.notes);
                          }}
                        />
                      ))}

                      {/* Progressive Load More button when results exceed current page slice */}
                      {visibleCount < filteredBusinesses.length && (
                        <div className="pt-2 pb-4 flex flex-col items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setVisibleCount((prev) => Math.min(prev + 30, filteredBusinesses.length))}
                            className="w-full py-3 px-4 rounded-2xl bg-white border border-[#EDE8E0] hover:border-[#FF4D00] text-stone-800 hover:text-[#FF4D00] text-xs font-bold transition shadow-2xs hover:shadow-xs active:scale-[0.99] flex items-center justify-center gap-2"
                          >
                            <span>Carregar mais 30 estabelecimentos</span>
                            <span className="text-[11px] text-stone-400 font-normal">
                              ({displayedBusinesses.length} de {filteredBusinesses.length} visíveis)
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setVisibleCount(filteredBusinesses.length)}
                            className="text-[11px] text-stone-500 hover:text-stone-800 font-medium underline underline-offset-2 transition"
                          >
                            Exibir todos ({filteredBusinesses.length})
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </section>
            </main>
          </>
        )}

        {currentTab === 'FAVORITOS' && (
          <FavoritesView
            businesses={businesses}
            onSelectBusiness={(biz) => {
              setSelectedBusiness(biz);
              setModalBusiness(biz);
            }}
            onUpdateLeadStatus={handleUpdateStatus}
            onNavigateToExplore={() => setCurrentTab('INICIO')}
            onOpenAIChat={() => setIsAIChatOpen(true)}
          />
        )}

        {currentTab === 'PIPELINE' && (
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
        )}

        {currentTab === 'CONFIGURACOES' && (
          <SettingsView
            businesses={businesses}
            currentRegionName={currentRegionName}
            onClearLocalCache={() => {
              localStorage.clear();
              setUserLeadsMap({});
              setBusinesses((prev) =>
                prev.map((b) => ({ ...b, leadStatus: 'NOVO', notes: '' }))
              );
            }}
          />
        )}
      </div>

      {/* Business Details Modal */}
      <BusinessDetailsModal
        business={modalBusiness}
        onClose={() => setModalBusiness(null)}
        onUpdateStatus={handleUpdateStatus}
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
      {!isAIChatOpen && currentTab === 'INICIO' && (
        <button
          type="button"
          onClick={() => setIsAIChatOpen(true)}
          className="fixed bottom-6 right-6 z-40 overflow-hidden orange-liquid-glass px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-2.5 cursor-pointer active:scale-95 group transition-all duration-300 hover:scale-105"
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
