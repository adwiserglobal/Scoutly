import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { ChevronDown, ChevronUp, Route, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { Business, ActiveFilters, LeadStatus, NavigationTab, VisitRouteStop, VisitStatus } from './types';
import { searchAddressOrCity } from './services/geocoding';
import { checkBusinessSocials, confirmCheckoutSession, fetchUserLeads, refreshSubscriptionFromStripe, saveUserLead, saveVisitRoute } from './services/api';
import { mapCacheService } from './services/mapCacheService';
import { useAuth } from './context/AuthContext';
import { getBoundsForRadius, calculateDistanceInMeters } from './utils/geoUtils';
import BottomMenu from './components/BottomMenu';
import Header from './components/Header';
import FilterBar from './components/FilterBar';
import InteractiveMap, { MapBounds, RadarPinState } from './components/InteractiveMap';
import BusinessCard from './components/BusinessCard';
import BusinessDetailsModal from './components/BusinessDetailsModal';
import BusinessSidePanel from './components/BusinessSidePanel';
import LoadingScreen from './components/LoadingScreen';
import AIAssistantDrawer from './components/AIAssistantDrawer';
import FavoritesView from './components/FavoritesView';
import PipelineView from './components/PipelineView';
import SettingsView from './components/SettingsView';
import PlansModal from './components/PlansModal';
import SubscriptionSuccessModal from './components/SubscriptionSuccessModal';
import VisitRoutePanel from './components/VisitRoutePanel';
import LoginView from './components/LoginView';
import { hydrateRecentlyViewedBusinesses, setRecentBusinessesUserScope } from './utils/recentBusinesses';
import { getBillingStatus, hasRecommendationsAccess } from './lib/billing';
import {
  getRecommendedBusinesses,
  recordRecommendationFavorite,
  recordRecommendationPipeline,
  recordRecommendationSearch,
  hydrateRecommendationSignals,
  setRecommendationUserScope,
  RECOMMENDATION_SIGNAL_EVENT,
} from './utils/recommendations';

const VISIT_ROUTE_STORAGE_KEY = 'scoutly_visit_route';

function loadSavedVisitRoute(): VisitRouteStop[] {
  if (typeof window === 'undefined') return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(VISIT_ROUTE_STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((stop) =>
      stop &&
      stop.business &&
      typeof stop.business.id === 'string' &&
      Number.isFinite(Number(stop.business.latitude)) &&
      Number.isFinite(Number(stop.business.longitude))
    );
  } catch {
    return [];
  }
}

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

  // Radar Pin State for Drag & Drop Real-time prospecting
  const [radarPin, setRadarPin] = useState<{
    active: boolean;
    lat: number;
    lng: number;
    radiusMeters: number;
    locationName?: string;
  } | null>(null);
  const [isPinPlacementMode, setIsPinPlacementMode] = useState(false);
  const [filterOnlyInRadius, setFilterOnlyInRadius] = useState(false);
  const [isPinSearching, setIsPinSearching] = useState(false);
  const [isRouteMode, setIsRouteMode] = useState(false);
  const [visitRouteStops, setVisitRouteStops] = useState<VisitRouteStop[]>(loadSavedVisitRoute);
  const routeHydratedRef = useRef(false);
  const routeSyncTimerRef = useRef<number | null>(null);
  const [recommendationRevision, setRecommendationRevision] = useState(0);
  const [recommendationHistoryBusinesses, setRecommendationHistoryBusinesses] = useState<Business[]>([]);
  
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

  const [isPlansOpen, setIsPlansOpen] = useState(false);
  const [serverSubscription, setServerSubscription] = useState<any>(null);
  const [billingStatus, setBillingStatus] = useState(() => getBillingStatus(user));
  const [subscriptionWelcome, setSubscriptionWelcome] = useState<ReturnType<typeof getBillingStatus> | null>(null);
  const [billingSyncError, setBillingSyncError] = useState('');

  useEffect(() => {
    setRecommendationUserScope(user?.uid || null);
    setRecentBusinessesUserScope(user?.uid || null);

    if (!user) {
      setRecommendationHistoryBusinesses([]);
      hydrateRecommendationSignals([]);
      hydrateRecentlyViewedBusinesses([]);
    }
  }, [user?.uid]);

  useEffect(() => {
    const refreshRecommendations = () => setRecommendationRevision((value) => value + 1);
    window.addEventListener(RECOMMENDATION_SIGNAL_EVENT, refreshRecommendations);
    window.addEventListener('storage', refreshRecommendations);
    return () => {
      window.removeEventListener(RECOMMENDATION_SIGNAL_EVENT, refreshRecommendations);
      window.removeEventListener('storage', refreshRecommendations);
    };
  }, []);

  useEffect(() => {
    const refreshBilling = () => setBillingStatus(getBillingStatus(user, serverSubscription));
    refreshBilling();

    const interval = window.setInterval(refreshBilling, 60 * 1000);
    window.addEventListener('focus', refreshBilling);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshBilling);
    };
  }, [user, serverSubscription]);

  // Pagination / Progressive Rendering for High Performance (prevent DOM overload)
  const [visibleCount, setVisibleCount] = useState<number>(() => {
    const stored = Number(localStorage.getItem('scoutly_results_batch_size') || 30);
    return [30, 60, 100].includes(stored) ? stored : 30;
  });

  // Multi-select Filters (allows multiple simultaneous filters: e.g. sem site + com whatsapp)
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({
    semSite: false,
    comSite: false,
    comWhatsapp: false,
    comRedeSocial: false,
    semRedeSocial: false,
  });
  const [selectedCategory, setSelectedCategory] = useState<string>('TODAS');
  const [sortBy, setSortBy] = useState<'CONFIDENCE' | 'NOME' | 'COM_CONTATO'>('CONFIDENCE');
  const [isLocating, setIsLocating] = useState(false);

  const [socialVerification, setSocialVerification] = useState<
    Record<string, 'checking' | 'has_social' | 'no_social' | 'failed'>
  >({});
  const [isSocialVerificationRunning, setIsSocialVerificationRunning] = useState(false);
  const socialVerificationRef = useRef<
    Record<string, 'checking' | 'has_social' | 'no_social' | 'failed'>
  >({});

  // Reset pagination when filters change
  useEffect(() => {
    const stored = Number(localStorage.getItem('scoutly_results_batch_size') || 30);
    setVisibleCount([30, 60, 100].includes(stored) ? stored : 30);
  }, [activeFilters, selectedCategory, sortBy, businesses]);

  useEffect(() => {
    window.localStorage.setItem(VISIT_ROUTE_STORAGE_KEY, JSON.stringify(visitRouteStops));

    if (!user || !routeHydratedRef.current) return;
    if (routeSyncTimerRef.current) window.clearTimeout(routeSyncTimerRef.current);

    routeSyncTimerRef.current = window.setTimeout(() => {
      void saveVisitRoute(visitRouteStops);
    }, 500);

    return () => {
      if (routeSyncTimerRef.current) window.clearTimeout(routeSyncTimerRef.current);
    };
  }, [visitRouteStops, user]);

  useEffect(() => {
    const syncPreferences = () => {
      const stored = Number(localStorage.getItem('scoutly_results_batch_size') || 30);
      setVisibleCount([30, 60, 100].includes(stored) ? stored : 30);
    };

    window.addEventListener('scoutly-preferences-updated', syncPreferences);
    return () => window.removeEventListener('scoutly-preferences-updated', syncPreferences);
  }, []);

  const handleToggleFilter = useCallback((filterKey: keyof ActiveFilters | 'TODOS') => {
    if (filterKey === 'TODOS') {
      setActiveFilters({
        semSite: false,
        comSite: false,
        comWhatsapp: false,
        comRedeSocial: false,
        semRedeSocial: false,
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
        if (next.comRedeSocial) next.semRedeSocial = false;
      } else if (filterKey === 'semRedeSocial') {
        next.semRedeSocial = !prev.semRedeSocial;
        if (next.semRedeSocial) next.comRedeSocial = false;
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

  socialVerificationRef.current = socialVerification;

  const businessIdSignature = useMemo(
    () => businesses.map((business) => business.id).join('|'),
    [businesses]
  );

  useEffect(() => {
    if (!activeFilters.semRedeSocial) {
      setIsSocialVerificationRunning(false);
      return;
    }

    let cancelled = false;

    const candidates = businesses.filter((business) => {
      const hasKnownSocials = Boolean(business.socials && business.socials.length > 0);
      const status = socialVerificationRef.current[business.id];

      return !hasKnownSocials && Boolean(business.website) && !status;
    });

    if (candidates.length === 0) {
      setIsSocialVerificationRunning(false);
      return;
    }

    const nextVerification = { ...socialVerificationRef.current };
    for (const business of candidates) {
      nextVerification[business.id] = 'checking';
    }
    socialVerificationRef.current = nextVerification;
    setSocialVerification(nextVerification);
    setIsSocialVerificationRunning(true);

    const queue = [...candidates];

    const worker = async () => {
      while (!cancelled && queue.length > 0) {
        const business = queue.shift();
        if (!business?.website) continue;

        try {
          const result = await checkBusinessSocials(business.website);
          if (cancelled) return;

          const nextStatus: 'has_social' | 'no_social' | 'failed' =
            result.hasSocial && result.socials.length > 0
              ? 'has_social'
              : result.siteStatus === 'verified'
                ? 'no_social'
                : 'failed';

          setSocialVerification((prev) => {
            const next = { ...prev, [business.id]: nextStatus };
            socialVerificationRef.current = next;
            return next;
          });

          if (nextStatus === 'has_social') {
            setBusinesses((prev) =>
              prev.map((item) =>
                item.id === business.id
                  ? { ...item, socials: result.socials }
                  : item
              )
            );
          }
        } catch (error) {
          if (cancelled) return;
          console.warn('[Scoutly Social Verification]:', business.name, error);

          setSocialVerification((prev) => {
            const next = { ...prev, [business.id]: 'failed' as const };
            socialVerificationRef.current = next;
            return next;
          });
        }
      }
    };

    const workers = Array.from(
      { length: Math.min(4, candidates.length) },
      () => worker()
    );

    Promise.allSettled(workers).then(() => {
      if (!cancelled) setIsSocialVerificationRunning(false);
    });

    return () => {
      cancelled = true;
    };
  }, [activeFilters.semRedeSocial, businessIdSignature]);

  // Hydrate all account-scoped data from the Scoutly App DB after Firebase auth.
  useEffect(() => {
    if (!user) {
      routeHydratedRef.current = false;
      return;
    }

    let cancelled = false;
    routeHydratedRef.current = false;

    fetchUserLeads().then((data) => {
      if (cancelled) return;

      if (data?.leads) setUserLeadsMap(data.leads);
      if (data?.favorites) setUserFavoritesMap(data.favorites);
      if (data?.subscription) {
        setServerSubscription(data.subscription);
        setBillingStatus(getBillingStatus(user, data.subscription));
      }

      if (data?.settings) {
        if (typeof data.settings.auto_enrich === 'boolean') {
          localStorage.setItem('scoutly_auto_enrich', String(data.settings.auto_enrich));
        }
        if ([30, 60, 100].includes(Number(data.settings.results_batch_size))) {
          localStorage.setItem(
            'scoutly_results_batch_size',
            String(data.settings.results_batch_size)
          );
        }
        window.dispatchEvent(new Event('scoutly-preferences-updated'));
      }

      hydrateRecommendationSignals(
        Array.isArray(data?.recommendationEvents) ? data.recommendationEvents : []
      );
      hydrateRecentlyViewedBusinesses(
        Array.isArray(data?.recentBusinesses) ? data.recentBusinesses : []
      );

      const historicalById = new Map<string, Business>();
      const favorites = data?.favorites || {};
      const leads = data?.leads || {};

      const addHistoricalBusiness = (candidate: any) => {
        if (
          !candidate ||
          typeof candidate.id !== 'string' ||
          !Number.isFinite(Number(candidate.latitude)) ||
          !Number.isFinite(Number(candidate.longitude))
        ) {
          return;
        }

        const lead = leads[candidate.id];
        historicalById.set(candidate.id, {
          ...candidate,
          isFavorite: Boolean(favorites[candidate.id] ?? candidate.isFavorite),
          leadStatus: lead?.status || candidate.leadStatus || 'NOVO',
          notes: lead?.notes || candidate.notes || '',
        } as Business);
      };

      Object.values(leads).forEach((lead: any) => addHistoricalBusiness(lead?.business));
      (data?.favoriteBusinesses || []).forEach(addHistoricalBusiness);
      (data?.recentBusinesses || []).forEach((item: any) =>
        addHistoricalBusiness(item?.business_snapshot)
      );
      (data?.recommendationEvents || []).forEach((event: any) =>
        addHistoricalBusiness(event?.metadata?.business)
      );

      setRecommendationHistoryBusinesses([...historicalById.values()]);

      if (data?.route?.exists) {
        setVisitRouteStops(data.route.stops as VisitRouteStop[]);
      } else if (visitRouteStops.length > 0) {
        void saveVisitRoute(visitRouteStops);
      }

      routeHydratedRef.current = true;
    });

    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!user) return;

    const params = new URLSearchParams(window.location.search);
    const billingResult = params.get('billing');
    if (!billingResult) return;

    const cleanBillingParams = () => {
      params.delete('billing');
      params.delete('session_id');
      const query = params.toString();
      window.history.replaceState(
        {},
        '',
        `${window.location.pathname}${query ? `?${query}` : ''}`
      );
    };

    if (billingResult === 'cancel') {
      cleanBillingParams();
      setIsPlansOpen(true);
      return;
    }

    let cancelled = false;

    if (billingResult === 'portal-return') {
      let refreshes = 0;

      const refreshAfterPortal = async () => {
        refreshes += 1;

        try {
          const subscription = await refreshSubscriptionFromStripe();
          if (cancelled) return;

          setServerSubscription(subscription);
          setBillingStatus(getBillingStatus(user, subscription));
          cleanBillingParams();
          return;
        } catch (error) {
          console.warn('[Scoutly Billing] Stripe refresh pending:', error);
        }

        const data = await fetchUserLeads();
        if (cancelled) return;

        if (data?.subscription) {
          setServerSubscription(data.subscription);
          setBillingStatus(getBillingStatus(user, data.subscription));
        }

        if (refreshes < 3) {
          window.setTimeout(refreshAfterPortal, 1500);
        } else {
          cleanBillingParams();
        }
      };

      void refreshAfterPortal();
      return () => {
        cancelled = true;
      };
    }

    if (billingResult !== 'success') return;

    const sessionId = String(params.get('session_id') || '').trim();
    let attempts = 0;
    setBillingSyncError('');

    const applySubscription = (subscription: any) => {
      if (!subscription || cancelled) return false;

      setServerSubscription(subscription);
      const nextBilling = getBillingStatus(user, subscription);
      setBillingStatus(nextBilling);

      const isPaidPlan =
        nextBilling.plan === 'go' ||
        nextBilling.plan === 'pro' ||
        nextBilling.plan === 'agency';

      if (!isPaidPlan) return false;

      localStorage.removeItem('scoutly_pending_plan');
      setIsPlansOpen(false);
      setSubscriptionWelcome(nextBilling);
      cleanBillingParams();
      return true;
    };

    const refreshSubscription = async () => {
      attempts += 1;

      if (attempts === 1 && sessionId.startsWith('cs_')) {
        try {
          const confirmed = await confirmCheckoutSession(sessionId);
          if (applySubscription(confirmed)) return;
        } catch (error) {
          console.warn('[Scoutly Billing] Checkout confirmation pending:', error);
        }
      }

      const data = await fetchUserLeads();
      if (cancelled) return;
      if (applySubscription(data?.subscription)) return;

      if (attempts < 6) {
        window.setTimeout(refreshSubscription, 1500);
      } else {
        setBillingSyncError(
          'O pagamento foi concluído, mas a Scoutly ainda não conseguiu sincronizar sua assinatura. Aguarde alguns segundos e atualize a página.'
        );
      }
    };

    void refreshSubscription();

    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

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
      recordRecommendationSearch(query, result.name);
      setCenterCoordinates({ lat: result.lat, lng: result.lng });
      setCurrentRegionName(result.name);
    } else {
      recordRecommendationSearch(query, currentRegionName);
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

  const rememberRecommendationBusiness = useCallback((business: Business) => {
    setRecommendationHistoryBusinesses((current) => {
      const next = [business, ...current.filter((item) => item.id !== business.id)];
      return next.slice(0, 120);
    });
  }, []);

  const handleToggleRouteMode = useCallback(() => {
    setIsRouteMode((current) => {
      const next = !current;
      if (next) {
        setRadarPin(null);
        setIsPinPlacementMode(false);
        setFilterOnlyInRadius(false);
        setIsListOpen(false);
        setIsFiltersOpen(false);
        setModalBusiness(null);
        setSelectedBusiness(null);
      }
      return next;
    });
  }, []);

  const handleMapBusinessSelect = useCallback((biz: Business) => {
    rememberRecommendationBusiness(biz);

    if (isRouteMode) {
      setVisitRouteStops((current) => {
        if (current.some((stop) => stop.business.id === biz.id)) return current;
        return [
          ...current,
          {
            business: biz,
            visitStatus: 'PENDENTE',
            addedAt: Date.now(),
          },
        ];
      });
      setSelectedBusiness(null);
      setModalBusiness(null);
      return;
    }

    setSelectedBusiness(biz);
    setModalBusiness(null);
  }, [isRouteMode, rememberRecommendationBusiness]);

  const handleSetVisitStatus = useCallback((businessId: string, status: VisitStatus) => {
    setVisitRouteStops((current) =>
      current.map((stop) =>
        stop.business.id === businessId ? { ...stop, visitStatus: status } : stop
      )
    );
  }, []);

  const handleRemoveRouteStop = useCallback((businessId: string) => {
    setVisitRouteStops((current) => current.filter((stop) => stop.business.id !== businessId));
  }, []);

  const handleClearVisitRoute = useCallback(() => {
    setVisitRouteStops([]);
  }, []);

  const handleInspectRouteBusiness = useCallback((biz: Business) => {
    setSelectedBusiness(biz);
    setModalBusiness(null);
  }, []);

  // Toggle or Drop Pin at current screen center
  const handleTogglePinMode = useCallback(() => {
    if (radarPin && radarPin.active) {
      // If already active, toggle off
      setRadarPin(null);
      setIsPinPlacementMode(false);
      setFilterOnlyInRadius(false);
    } else {
      // Activate pin at current center
      const lat = centerCoordinates.lat;
      const lng = centerCoordinates.lng;
      const radiusMeters = 1000;
      setRadarPin({
        active: true,
        lat,
        lng,
        radiusMeters,
        locationName: currentRegionName,
      });
      setIsPinPlacementMode(false);

      // Trigger immediate dedicated search in that radius
      setIsPinSearching(true);
      mapCacheService
        .fetchPinRadius(lat, lng, radiusMeters, (allPlaces) => {
          const currentLeads = leadsMapRef.current;
          const currentFavorites = favoritesMapRef.current;
          const mergedPlaces = allPlaces.map((p) => ({
            ...p,
            isFavorite: Boolean(currentFavorites[p.id]),
            leadStatus: currentLeads[p.id]?.status || 'NOVO',
            notes: currentLeads[p.id]?.notes || '',
          }));
          setBusinesses(mergedPlaces);
        })
        .finally(() => {
          setIsPinSearching(false);
        });
    }
  }, [radarPin, centerCoordinates, currentRegionName]);

  // Handle Dragging Pin in Real-time
  const handleRadarPinDrag = useCallback((coords: { lat: number; lng: number }) => {
    setRadarPin((prev) => (prev ? { ...prev, lat: coords.lat, lng: coords.lng } : null));
  }, []);

  // Handle Pin Drop (dragend, click, or right click)
  const handleRadarPinDrop = useCallback((coords: { lat: number; lng: number }) => {
    const radiusMeters = radarPin?.radiusMeters || 1000;
    setRadarPin({
      active: true,
      lat: coords.lat,
      lng: coords.lng,
      radiusMeters,
      locationName: `Localização (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`,
    });
    setIsPinPlacementMode(false);

    // Instant Search around dropped location
    setIsPinSearching(true);
    mapCacheService
      .fetchPinRadius(coords.lat, coords.lng, radiusMeters, (allPlaces) => {
        const currentLeads = leadsMapRef.current;
        const currentFavorites = favoritesMapRef.current;
        const mergedPlaces = allPlaces.map((p) => ({
          ...p,
          isFavorite: Boolean(currentFavorites[p.id]),
          leadStatus: currentLeads[p.id]?.status || 'NOVO',
          notes: currentLeads[p.id]?.notes || '',
        }));
        setBusinesses(mergedPlaces);
      })
      .finally(() => {
        setIsPinSearching(false);
      });
  }, [radarPin?.radiusMeters]);

  const handlePinRadiusChange = useCallback((newRadius: number) => {
    if (!radarPin) return;
    setRadarPin((prev) => (prev ? { ...prev, radiusMeters: newRadius } : null));

    setIsPinSearching(true);
    mapCacheService
      .fetchPinRadius(radarPin.lat, radarPin.lng, newRadius, (allPlaces) => {
        const currentLeads = leadsMapRef.current;
        const currentFavorites = favoritesMapRef.current;
        const mergedPlaces = allPlaces.map((p) => ({
          ...p,
          isFavorite: Boolean(currentFavorites[p.id]),
          leadStatus: currentLeads[p.id]?.status || 'NOVO',
          notes: currentLeads[p.id]?.notes || '',
        }));
        setBusinesses(mergedPlaces);
      })
      .finally(() => {
        setIsPinSearching(false);
      });
  }, [radarPin]);

  const handleClearPin = useCallback(() => {
    setRadarPin(null);
    setIsPinPlacementMode(false);
    setFilterOnlyInRadius(false);
  }, []);

  const handleCenterOnPin = useCallback(() => {
    if (radarPin) {
      setCenterCoordinates({ lat: radarPin.lat, lng: radarPin.lng });
    }
  }, [radarPin]);

  // Calculate businesses strictly inside the radar radius
  const businessesInRadiusCount = useMemo(() => {
    if (!radarPin || !radarPin.active) return 0;
    return businesses.filter(
      (b) =>
        calculateDistanceInMeters(
          radarPin.lat,
          radarPin.lng,
          b.latitude,
          b.longitude
        ) <= radarPin.radiusMeters
    ).length;
  }, [businesses, radarPin]);

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

  // Social-network filter uses live site verification to avoid stale dataset false positives.
  const noSocialCandidatesCount = useMemo(() => {
    return businesses.filter(
      (business) =>
        (!business.socials || business.socials.length === 0) &&
        Boolean(business.website)
    ).length;
  }, [businesses]);

  const verifiedNoSocialCount = useMemo(() => {
    return businesses.filter(
      (business) =>
        (!business.socials || business.socials.length === 0) &&
        socialVerification[business.id] === 'no_social'
    ).length;
  }, [businesses, socialVerification]);

  const noSocialsCount = activeFilters.semRedeSocial
    ? verifiedNoSocialCount
    : noSocialCandidatesCount;

  // Filter & Sort businesses
  const filteredBusinesses = useMemo(() => {
    let list = businesses.filter((biz) => {
      // Pin Radar Filter: if enabled, only show businesses within the pin's radius
      if (filterOnlyInRadius && radarPin && radarPin.active) {
        const dist = calculateDistanceInMeters(
          radarPin.lat,
          radarPin.lng,
          biz.latitude,
          biz.longitude
        );
        if (dist > radarPin.radiusMeters) {
          return false;
        }
      }

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

      // Multi-filter: Sem rede social
      // Strict mode: only show businesses whose official website was checked
      // and did not expose any social-network links.
      if (activeFilters.semRedeSocial) {
        if (biz.socials && biz.socials.length > 0) {
          return false;
        }

        if (socialVerification[biz.id] !== 'no_social') {
          return false;
        }
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
  }, [businesses, activeFilters, selectedCategory, sortBy, socialVerification]);

  const businessListRegionName = useMemo(() => {
    const counts = new Map<string, number>();

    for (const business of businesses) {
      const city = String(business.municipio || '').trim();
      const district = String(business.bairro || '').trim();
      const state = String(business.uf || '').trim();

      let label = '';
      if (city && district) label = `${city} - ${district}`;
      else if (city && state) label = `${city} - ${state}`;
      else if (city) label = city;
      else if (district) label = district;

      if (label) counts.set(label, (counts.get(label) || 0) + 1);
    }

    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    if (ranked.length > 0 && ranked[0][1] >= 2) return ranked[0][0];

    const normalizedCurrent = currentRegionName.trim();
    if (
      normalizedCurrent &&
      normalizedCurrent !== 'São Paulo - Pinheiros' &&
      normalizedCurrent !== 'Sua Localização Atual'
    ) {
      return normalizedCurrent;
    }

    return '';
  }, [businesses, currentRegionName]);

  // Progressive rendering slice for buttery smooth 60fps scrolling
  const displayedBusinesses = useMemo(() => {
    return filteredBusinesses.slice(0, visibleCount);
  }, [filteredBusinesses, visibleCount]);

  // Stable callbacks for BusinessCard memoization
  const handleCardSelect = useCallback((biz: Business) => {
    rememberRecommendationBusiness(biz);
    setModalBusiness(biz);
  }, [rememberRecommendationBusiness]);

  const handleOpenDetails = useCallback((biz: Business) => {
    rememberRecommendationBusiness(biz);
    setModalBusiness(biz);
  }, [rememberRecommendationBusiness]);

  // Toggle Favorite status (and persist in database)
  const handleToggleFavorite = useCallback((biz: Business) => {
    const nextIsFavorite = !biz.isFavorite;
    const nextBusiness = { ...biz, isFavorite: nextIsFavorite };
    rememberRecommendationBusiness(nextBusiness);
    recordRecommendationFavorite(biz, nextIsFavorite);
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
    setVisitRouteStops((prev) =>
      prev.map((stop) =>
        stop.business.id === biz.id
          ? { ...stop, business: { ...stop.business, isFavorite: nextIsFavorite } }
          : stop
      )
    );
    // Save favorite state to database
    saveUserLead(biz.id, undefined, undefined, nextIsFavorite, {
      ...biz,
      isFavorite: nextIsFavorite,
    });
  }, [rememberRecommendationBusiness]);

  // Update Lead Status (and persist in database)
  const handleUpdateStatus = useCallback((id: string, newStatus: LeadStatus, notes?: string) => {
    const updatedNotes = notes !== undefined ? notes : '';
    const signalBusiness =
      businesses.find((business) => business.id === id) ||
      visitRouteStops.find((stop) => stop.business.id === id)?.business ||
      (selectedBusiness?.id === id ? selectedBusiness : null) ||
      (modalBusiness?.id === id ? modalBusiness : null);

    if (signalBusiness) {
      const nextBusiness = { ...signalBusiness, leadStatus: newStatus, notes: updatedNotes };
      rememberRecommendationBusiness(nextBusiness);
      recordRecommendationPipeline(signalBusiness, newStatus !== 'NOVO' && newStatus !== 'ARQUIVADO');
    }
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
    setVisitRouteStops((prev) =>
      prev.map((stop) =>
        stop.business.id === id
          ? { ...stop, business: { ...stop.business, leadStatus: newStatus, notes: updatedNotes } }
          : stop
      )
    );
    // Save to persistent database
    saveUserLead(id, newStatus, updatedNotes, undefined, signalBusiness || undefined);
  }, [businesses, visitRouteStops, selectedBusiness, modalBusiness, rememberRecommendationBusiness]);

  const recommendationCandidates = useMemo(() => {
    const byId = new Map<string, Business>();

    for (const business of recommendationHistoryBusinesses) {
      byId.set(business.id, business);
    }

    // Live map data wins over persisted snapshots when both are available.
    for (const business of businesses) {
      byId.set(business.id, business);
    }

    return [...byId.values()];
  }, [businesses, recommendationHistoryBusinesses]);

  const recommendedBusinesses = useMemo(
    () => getRecommendedBusinesses(recommendationCandidates, 12),
    [recommendationCandidates, recommendationRevision]
  );

  const recommendationsLocked = !hasRecommendationsAccess(billingStatus);

  const handleSelectRecommended = useCallback((business: Business) => {
    rememberRecommendationBusiness(business);
    setCenterCoordinates({ lat: business.latitude, lng: business.longitude });
    setCurrentRegionName(business.address || business.name);
    setSelectedBusiness(business);
    setModalBusiness(null);
    setIsFiltersOpen(false);
  }, [rememberRecommendationBusiness]);

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
            onSelectBusiness={handleMapBusinessSelect}
            centerCoordinates={centerCoordinates}
            zoom={14}
            activeFilters={activeFilters}
            onMapLoad={() => setIsMapLoading(false)}
            onMapError={(err) => {
              setIsMapLoading(false);
              setMapError(err.message);
            }}
            onBoundsChange={handleBoundsChange}
            routeMode={isRouteMode}
            routeStops={visitRouteStops}
          />
      </div>

      {/* Top contrast veil: keeps map visible while improving toolbar legibility */}
      {currentTab === 'INICIO' && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-32 bg-gradient-to-b from-black/[0.78] via-black/[0.34] to-transparent" />
      )}

      {/* Main Foreground Layer */}
      <div className={`relative w-full h-full flex flex-col pointer-events-none ${isListOpen ? 'z-[60]' : 'z-10'}`}>
        
        {/* Only show Header & Filters on INICIO tab */}
        {currentTab === 'INICIO' && (
          <>
            <div className="absolute top-4 left-4 right-4 z-30 pointer-events-none flex items-start justify-center">
              <div className="w-full flex flex-col items-center justify-between pointer-events-none">
                <Header
                  currentRegionName={currentRegionName}
                  onSearch={handleSearch}
                  onUseCurrentLocation={handleUseCurrentLocation}
                  onSelectPreset={handleSelectPreset}
                  isLocating={isLocating}
                  totalOpportunitiesCount={opportunitiesCount}
                  totalBusinessesCount={filteredBusinesses.length}
                  onOpenFilters={() => {
                    setSelectedBusiness(null);
                    setIsListOpen(false);
                    setIsFiltersOpen(true);
                  }}
                  recommendedBusinesses={recommendedBusinesses}
                  recommendationsLocked={recommendationsLocked}
                  onSelectRecommended={handleSelectRecommended}
                  onOpenRecommendationsUpgrade={() => setIsPlansOpen(true)}
                />
              </div>
            </div>

            {!selectedBusiness && !modalBusiness && !isFiltersOpen && !isListOpen && (
              <div className="absolute right-4 top-4 z-30 pointer-events-auto">
                <button
                  type="button"
                  onClick={handleToggleRouteMode}
                  className={`flex h-[46px] items-center justify-center gap-2 rounded-2xl border px-3.5 text-[11px] font-semibold shadow-[0_14px_44px_rgba(0,0,0,0.28)] backdrop-blur-2xl transition active:scale-[0.97] ${
                    isRouteMode
                      ? 'border-[#FF5A12] bg-[#FF5A12] text-white'
                      : 'border-white/10 bg-[#111418]/[0.94] text-stone-200 hover:border-[#FF5A12]/35 hover:bg-[#171a1f]'
                  }`}
                  title={isRouteMode ? 'Encerrar rota' : 'Traçar rota'}
                  aria-label={isRouteMode ? 'Encerrar rota' : 'Traçar rota'}
                >
                  <Route className="h-4 w-4" />
                  <span className="hidden xl:inline">{isRouteMode ? 'Encerrar rota' : 'Rota'}</span>
                </button>
              </div>
            )}

            {isRouteMode && !isListOpen && (
              <div className="absolute top-[138px] left-4 z-30 pointer-events-none sm:top-[82px] lg:left-[88px]">
                <VisitRoutePanel
                  stops={visitRouteStops}
                  onSetVisitStatus={handleSetVisitStatus}
                  onRemoveStop={handleRemoveRouteStop}
                  onClear={handleClearVisitRoute}
                  onCloseMode={() => setIsRouteMode(false)}
                  onInspectBusiness={handleInspectRouteBusiness}
                  onAddToPipeline={(business) => {
                    if (!business.leadStatus || business.leadStatus === 'NOVO') {
                      handleUpdateStatus(business.id, 'CONTATADO', business.notes);
                    }
                  }}
                />
              </div>
            )}

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
                  noSocialsCount={noSocialsCount}
                  noSocialCandidatesCount={noSocialCandidatesCount}
                  isNoSocialVerificationRunning={isSocialVerificationRunning}
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
            className={`fixed inset-0 z-[70] flex items-end justify-center px-3 pointer-events-none transition-opacity duration-500 sm:px-5 ${
              isListOpen ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {/* Backdrop Blur effect over the map when list is open */}
            <div 
              className={`absolute inset-0 bg-black/[0.38] transition-all duration-500 ${isListOpen ? 'opacity-100 backdrop-blur-[7px] pointer-events-auto' : 'opacity-0 pointer-events-none'}`} 
              onClick={() => setIsListOpen(false)}
            />
            
            {/* The List Container */}
            <div className={`relative flex h-[calc(100dvh-76px)] w-full max-w-[1180px] flex-col overflow-hidden rounded-t-[30px] border border-white/[0.10] bg-[#111315]/[0.97] pb-4 shadow-[0_-24px_90px_rgba(0,0,0,0.46)] backdrop-blur-2xl pointer-events-auto transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${isListOpen ? 'translate-y-0' : 'translate-y-full'}`}>
              {/* Drawer Handle */}
              <button 
                onClick={() => setIsListOpen(false)}
                className="w-full flex flex-col items-center justify-center p-3 cursor-pointer hover:bg-white/[0.035] rounded-t-[28px] transition"
              >
                <div className="mb-2 h-1 w-12 rounded-full bg-white/[0.16]" />
                <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-500">
                  Ocultar Empresas <ChevronDown className="w-3 h-3" />
                </span>
              </button>

              <div className="flex-1 overflow-y-auto px-3 pb-6 sm:px-5 md:px-6 custom-scrollbar">
                <div className="mb-4 flex items-center justify-between gap-4 border-b border-white/[0.07] px-1 pb-3">
                  <span className="truncate text-[11px] font-semibold uppercase tracking-[0.1em] text-stone-300">
                    {businessListRegionName ? `Estabelecimentos em ${businessListRegionName}` : 'Estabelecimentos nesta área'}
                  </span>
                  <span className="shrink-0 text-[11px] font-medium text-stone-500">
                    {isBusinessesLoading ? (
                      <span className="font-semibold text-[#FF6A26] animate-pulse">Carregando dados...</span>
                    ) : (
                      `${filteredBusinesses.length} ${filteredBusinesses.length === 1 ? 'negócio' : 'negócios'}`
                    )}
                  </span>
                </div>

                {/* Error Banner */}
                {businessesError && (
                  <div className="mb-4 rounded-2xl border border-rose-500/20 bg-rose-500/[0.08] p-4 text-xs leading-relaxed text-rose-300">
                    {businessesError}
                  </div>
                )}

                {/* List or Empty State */}
                {filteredBusinesses.length === 0 && !isBusinessesLoading && !isZoomTooLow ? (
                  <div className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-8 text-center">
                    <p className="mb-1 text-sm font-semibold text-stone-200">
                      Nenhum estabelecimento encontrado nesta área.
                    </p>
                    <p className="text-xs text-stone-500">
                      Mova o mapa para outra região ou ajuste os filtros acima.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
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
                      <div className="col-span-full mt-2 flex flex-col items-center gap-2 pb-4 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            const stored = Number(localStorage.getItem('scoutly_results_batch_size') || 30);
                            const batchSize = [30, 60, 100].includes(stored) ? stored : 30;
                            setVisibleCount((prev) => Math.min(prev + batchSize, filteredBusinesses.length));
                          }}
                          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/[0.09] bg-white/[0.035] px-4 py-3 text-xs font-semibold text-stone-300 transition hover:border-[#FF5A12]/35 hover:bg-[#FF5A12]/[0.06] hover:text-white active:scale-[0.99] cursor-pointer"
                        >
                          <span>Carregar mais 30 estabelecimentos</span>
                          <span className="text-[11px] text-stone-400 font-normal">
                            ({displayedBusinesses.length} de {filteredBusinesses.length} visíveis)
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setVisibleCount(filteredBusinesses.length)}
                          className="cursor-pointer text-[11px] font-medium text-stone-500 underline underline-offset-2 transition hover:text-stone-300"
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

        {!isAIChatOpen && !isFiltersOpen && !selectedBusiness && !isListOpen && currentTab === 'INICIO' && (
          <button
            type="button"
            onClick={() => setIsAIChatOpen(true)}
            className="group fixed bottom-5 right-4 z-30 flex h-11 items-center gap-2 rounded-2xl border border-white/[0.10] bg-[#111418]/[0.96] px-2.5 text-white shadow-[0_12px_34px_rgba(0,0,0,0.34)] backdrop-blur-2xl transition hover:border-[#FF5A12]/40 hover:bg-[#15181c] active:scale-[0.97] sm:px-3.5 pointer-events-auto"
            aria-label="Abrir Scoutly AI"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-xl border border-[#FF5A12]/20 bg-[#FF5A12]/[0.10] text-[#FF6A26] transition group-hover:bg-[#FF5A12]/[0.15]">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="hidden text-[11px] font-semibold tracking-[-0.01em] text-stone-100 sm:inline">
              Scoutly AI
            </span>
          </button>
        )}

        {/* View Businesses Button (floating below BottomMenu) */}
        {currentTab === 'INICIO' && (
          <div className="absolute bottom-[18px] left-1/2 -translate-x-1/2 z-30 pointer-events-auto transition-transform duration-500">
            <button
              onClick={() => {
                const nextOpen = !isListOpen;
                setIsListOpen(nextOpen);
                if (nextOpen) setSelectedBusiness(null);
              }}
              className="flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-[#111418]/[0.92] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-stone-300 shadow-[0_10px_28px_rgba(0,0,0,0.28)] backdrop-blur-xl transition-all cursor-pointer hover:border-[#FF5A12]/35 hover:text-white hover:scale-[1.02] active:scale-95"
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
          <div className="absolute inset-0 z-20 bg-[#FAF7F2] overflow-y-auto pointer-events-auto pb-24 pt-4 lg:pl-[190px]">
            <FavoritesView
              businesses={businesses}
              onSelectBusiness={(biz) => {
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
          <div className="absolute inset-0 z-20 bg-[#FAF7F2] overflow-y-auto pointer-events-auto pb-24 pt-4 lg:pl-[190px]">
            <PipelineView
              businesses={businesses}
              onSelectBusiness={(biz) => {
                setModalBusiness(biz);
              }}
              onUpdateLeadStatus={handleUpdateStatus}
              onOpenAIChat={() => setIsAIChatOpen(true)}
              onNavigateToExplore={() => setCurrentTab('INICIO')}
            />
          </div>
        )}

        {currentTab === 'CONFIGURACOES' && (
          <div className="absolute inset-0 z-20 bg-[#FAF7F2] overflow-y-auto pointer-events-auto pb-24 pt-4 lg:pl-[190px]">
            <SettingsView
              billing={billingStatus}
              onOpenPlans={() => setIsPlansOpen(true)}
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

      {/* Compact map business side panel */}
      {currentTab === 'INICIO' && selectedBusiness && !isListOpen && !modalBusiness && (
        <BusinessSidePanel
          business={selectedBusiness}
          onClose={() => setSelectedBusiness(null)}
          onToggleFavorite={handleToggleFavorite}
        />
      )}

      <PlansModal
        open={isPlansOpen || billingStatus.isExpired}
        billing={billingStatus}
        forceOpen={billingStatus.isExpired}
        onClose={() => setIsPlansOpen(false)}
        onSignOut={signOut}
      />

      <SubscriptionSuccessModal
        billing={subscriptionWelcome}
        onContinue={() => setSubscriptionWelcome(null)}
      />

      {billingSyncError && (
        <div className="fixed left-1/2 top-5 z-[115] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <p className="text-xs leading-relaxed text-amber-900">{billingSyncError}</p>
            <button
              type="button"
              onClick={() => setBillingSyncError('')}
              className="shrink-0 text-[11px] font-semibold text-amber-900 underline underline-offset-2"
            >
              Fechar
            </button>
          </div>
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


    </div>
  );
}
