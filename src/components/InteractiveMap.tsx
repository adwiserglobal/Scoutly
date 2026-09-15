import { useEffect, useRef, memo } from 'react';
import * as maplibregl from 'maplibre-gl';
// @ts-ignore
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Business } from '../types';
import { getWhatsAppLink } from '../services/api';
import { translateCategory } from '../utils/categoryTranslator';

// Configure worker URL explicitly for Vite so vector tiles are fetched and parsed
if (typeof window !== 'undefined' && maplibregl.setWorkerUrl) {
  maplibregl.setWorkerUrl(maplibreWorkerUrl);
}

export interface MapBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

interface InteractiveMapProps {
  businesses: Business[];
  selectedBusiness: Business | null;
  onSelectBusiness: (business: Business) => void;
  centerCoordinates: { lat: number; lng: number };
  zoom?: number;
  onMapLoad?: () => void;
  onMapError?: (err: Error) => void;
  onBoundsChange?: (bounds: MapBounds | null, zoom: number) => void;
}

function escapeHtml(str: string) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function InteractiveMap({
  businesses,
  selectedBusiness,
  onSelectBusiness,
  centerCoordinates,
  zoom = 14,
  onMapLoad,
  onMapError,
  onBoundsChange,
}: InteractiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const businessesMapRef = useRef<Map<string, Business>>(new Map());
  const hoverPopupRef = useRef<maplibregl.Popup | null>(null);
  const popupLeaveTimerRef = useRef<any>(null);

  // Keep fast O(1) lookup map in sync with current businesses
  useEffect(() => {
    const map = new Map<string, Business>();
    for (const b of businesses) {
      map.set(b.id, b);
    }
    businessesMapRef.current = map;
  }, [businesses]);

  // Stable callback ref for onSelectBusiness inside popup event listeners
  const onSelectBusinessRef = useRef(onSelectBusiness);
  onSelectBusinessRef.current = onSelectBusiness;

  // Initialize MapLibre
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return;

    let resizeObserver: ResizeObserver | null = null;

    try {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [centerCoordinates.lng, centerCoordinates.lat],
        zoom: zoom,
        attributionControl: false,
      });
      mapRef.current = map;

      // Add Controls
      map.addControl(new maplibregl.NavigationControl(), 'top-right');
      
      map.addControl(
        new maplibregl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true,
          showUserLocation: true,
        }),
        'top-right'
      );

      // Create persistent hover popup
      const hoverPopup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 14,
        className: 'scoutly-hover-popup',
        maxWidth: '320px',
      });
      hoverPopupRef.current = hoverPopup;

      // Resize observer to ensure canvas dimensions always match container
      resizeObserver = new ResizeObserver(() => {
        mapRef.current?.resize();
      });
      if (mapContainerRef.current) {
        resizeObserver.observe(mapContainerRef.current);
      }

      const triggerBoundsUpdate = () => {
        const m = mapRef.current;
        if (!m) return;
        const currentZoom = m.getZoom();
        const b = m.getBounds();
        if (currentZoom < 12) {
          onBoundsChange?.(null, currentZoom);
        } else {
          onBoundsChange?.(
            {
              west: b.getWest(),
              south: b.getSouth(),
              east: b.getEast(),
              north: b.getNorth(),
            },
            currentZoom
          );
        }
      };

      // Fallback: If map doesn't fire load event for some reason
      const fallbackTimer = setTimeout(() => {
        mapRef.current?.resize();
        onMapLoad?.();
        triggerBoundsUpdate();
      }, 3000);

      map.on('load', () => {
        clearTimeout(fallbackTimer);
        map.resize();
        onMapLoad?.();

        // 1. Add GeoJSON Source
        map.addSource('businesses', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [],
          },
          cluster: true,
          clusterMaxZoom: 15,
          clusterRadius: 50,
        });

        // 2. Add Cluster Circles Layer
        map.addLayer({
          id: 'clusters',
          type: 'circle',
          source: 'businesses',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': [
              'step',
              ['get', 'point_count'],
              '#FF4D00',
              10,
              '#E04400',
              50,
              '#B33600',
            ],
            'circle-radius': [
              'step',
              ['get', 'point_count'],
              18,
              10,
              23,
              50,
              28,
            ],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        });

        // 3. Add Cluster Text Count Layer
        map.addLayer({
          id: 'cluster-count',
          type: 'symbol',
          source: 'businesses',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': '{point_count_abbreviated}',
            'text-size': 12,
          },
          paint: {
            'text-color': '#ffffff',
          },
        });

        // 4. Add Unclustered Point Layer (Individual Businesses)
        map.addLayer({
          id: 'unclustered-point',
          type: 'circle',
          source: 'businesses',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': '#FF4D00',
            'circle-radius': 7,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        });

        // 5. Interaction Handlers
        map.on('click', 'clusters', (e) => {
          const features = map.queryRenderedFeatures(e.point, {
            layers: ['clusters'],
          });
          const clusterId = features[0]?.properties?.cluster_id;
          const source = map.getSource('businesses') as maplibregl.GeoJSONSource;

          if (clusterId && source) {
            source
              .getClusterExpansionZoom(clusterId)
              .then((targetZoom) => {
                const coordinates = (features[0].geometry as any).coordinates;
                map.easeTo({
                  center: coordinates,
                  zoom: targetZoom,
                });
              })
              .catch(() => {});
          }
        });

        map.on('click', 'unclustered-point', (e) => {
          const feature = e.features?.[0];
          if (feature && feature.properties) {
            const bizId = feature.properties.id;
            const found = businessesMapRef.current.get(bizId);
            if (found) {
              onSelectBusinessRef.current(found);
            }
          }
        });

        map.on('mouseenter', 'clusters', () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'clusters', () => {
          map.getCanvas().style.cursor = '';
        });

        // Hover Mini-Preview on orange dot markers
        map.on('mouseenter', 'unclustered-point', (e) => {
          if (popupLeaveTimerRef.current) {
            clearTimeout(popupLeaveTimerRef.current);
          }
          map.getCanvas().style.cursor = 'pointer';

          const feature = e.features?.[0];
          if (!feature || !feature.properties) return;

          const coordinates = (feature.geometry as any).coordinates.slice();
          const bizId = feature.properties.id;
          const biz = businessesMapRef.current.get(bizId);
          if (!biz) return;

          const hasWebsite = Boolean(biz.website);
          const rawPhone = biz.phone || (biz.phones && biz.phones.length > 0 ? biz.phones[0] : null);
          const waLink = getWhatsAppLink(rawPhone);

          const popupHtml = `
            <div class="scoutly-hover-card p-3.5 bg-white rounded-2xl border border-[#EDE8E0] shadow-xl text-stone-900 font-sans min-w-[240px] max-w-[280px]">
              <div class="flex items-start justify-between gap-2 mb-1">
                <h4 class="text-xs font-bold text-stone-900 leading-snug line-clamp-2">${escapeHtml(biz.name)}</h4>
                ${
                  hasWebsite
                    ? '<span class="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-stone-100 text-stone-600 shrink-0">Com site</span>'
                    : '<span class="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-[#FFF0E6] text-[#FF4D00] border border-[#FF4D00]/20 shrink-0">Sem site</span>'
                }
              </div>
              <p class="text-[11px] text-stone-500 mb-3 line-clamp-1">${escapeHtml(translateCategory(biz.category))} • ${escapeHtml(biz.address || '')}</p>
              
              <div class="flex items-center gap-1.5 pt-2 border-t border-stone-100">
                ${
                  waLink
                    ? `<a href="${waLink}" target="_blank" rel="noopener noreferrer" class="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-950 rounded-xl text-[11px] font-bold transition shadow-2xs">
                        <img src="/whatsapp_icone.png" class="w-3.5 h-3.5 object-contain" alt="WA" />
                        <span>WhatsApp</span>
                      </a>`
                    : ''
                }
                ${
                  hasWebsite
                    ? `<a href="${escapeHtml(biz.website!)}" target="_blank" rel="noopener noreferrer" class="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-800 rounded-xl text-[11px] font-bold transition shadow-2xs">
                        <span>Ver site</span>
                      </a>`
                    : ''
                }
                <button type="button" data-biz-id="${escapeHtml(biz.id)}" class="btn-scoutly-open-modal px-3 py-1.5 bg-[#FF4D00] hover:bg-[#E04400] text-white rounded-xl text-[11px] font-bold transition shadow-2xs shrink-0 cursor-pointer">
                  Detalhes
                </button>
              </div>
            </div>
          `;

          hoverPopup
            .setLngLat(coordinates)
            .setHTML(popupHtml)
            .addTo(map);

          // Add interactive listeners to popup container so users can click buttons inside
          const popupElement = hoverPopup.getElement();
          if (popupElement) {
            popupElement.onmouseenter = () => {
              if (popupLeaveTimerRef.current) {
                clearTimeout(popupLeaveTimerRef.current);
              }
            };
            popupElement.onmouseleave = () => {
              popupLeaveTimerRef.current = setTimeout(() => {
                hoverPopup.remove();
              }, 250);
            };

            const detailsBtn = popupElement.querySelector('.btn-scoutly-open-modal');
            if (detailsBtn) {
              detailsBtn.addEventListener('click', (ev) => {
                ev.stopPropagation();
                onSelectBusinessRef.current(biz);
                hoverPopup.remove();
              });
            }
          }
        });

        map.on('mouseleave', 'unclustered-point', () => {
          map.getCanvas().style.cursor = '';
          if (popupLeaveTimerRef.current) {
            clearTimeout(popupLeaveTimerRef.current);
          }
          popupLeaveTimerRef.current = setTimeout(() => {
            hoverPopup.remove();
          }, 300);
        });

        // Initial bounds notification
        triggerBoundsUpdate();
      });

      // Notify on pan / zoom end
      map.on('moveend', () => {
        triggerBoundsUpdate();
      });

      map.on('error', (e) => {
        console.error('MapLibre Error:', e);
        const errObj = e.error instanceof Error ? e.error : new Error(e.error?.message || 'Ocorreu um erro no mapa.');
        onMapError?.(errObj);
      });
    } catch (err: any) {
      onMapError?.(err);
    }

    return () => {
      if (popupLeaveTimerRef.current) {
        clearTimeout(popupLeaveTimerRef.current);
      }
      resizeObserver?.disconnect();
      hoverPopupRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []); // Run only once

  // Update center when centerCoordinates change explicitly from search/header
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.flyTo({
      center: [centerCoordinates.lng, centerCoordinates.lat],
      zoom: zoom,
      essential: true,
    });
  }, [centerCoordinates.lat, centerCoordinates.lng]);

  // Update GeoJSON source when businesses change
  useEffect(() => {
    if (!mapRef.current) return;

    const source = mapRef.current.getSource('businesses') as maplibregl.GeoJSONSource;
    if (source) {
      const geojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: businesses.map((biz) => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [biz.longitude, biz.latitude],
          },
          properties: {
            id: biz.id,
            name: biz.name,
          },
        })),
      };

      source.setData(geojson);
    }
  }, [businesses]);

  // Pan to selected business
  useEffect(() => {
    if (!mapRef.current || !selectedBusiness) return;
    mapRef.current.flyTo({
      center: [selectedBusiness.longitude, selectedBusiness.latitude],
      zoom: Math.max(mapRef.current.getZoom() || zoom, 16),
      essential: true,
    });
  }, [selectedBusiness]);

  return (
    <div className="relative w-full h-full bg-[#FAF7F2]">
      <div ref={mapContainerRef} className="w-full h-full" id="interactive-prospect-map" />

      {/* Map Header Status Badge */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <div className="bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-[#EDE8E0] shadow-sm flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FF4D00]"></span>
          <span className="text-xs font-medium text-stone-800 tracking-tight">
            {businesses.length} {businesses.length === 1 ? 'negócio exibido' : 'negócios no mapa'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default memo(InteractiveMap);

