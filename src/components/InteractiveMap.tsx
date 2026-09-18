import { useEffect, useRef, memo, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
// @ts-ignore
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Business } from '../types';
import { translateCategory } from '../utils/categoryTranslator';
import { createGeoJSONCircle } from '../utils/geoUtils';

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

export interface RadarPinState {
  active: boolean;
  lat: number;
  lng: number;
  radiusMeters: number;
}

interface InteractiveMapProps {
  businesses: Business[];
  selectedBusiness: Business | null;
  onSelectBusiness: (business: Business) => void;
  centerCoordinates: { lat: number; lng: number };
  zoom?: number;
  activeFilters: {
    semSite: boolean;
    comSite: boolean;
    comWhatsapp: boolean;
    comRedeSocial: boolean;
  };
  onMapLoad?: () => void;
  onMapError?: (err: Error) => void;
  onBoundsChange?: (bounds: MapBounds | null, zoom: number) => void;
  radarPin?: RadarPinState | null;
  onRadarPinDrag?: (coords: { lat: number; lng: number }) => void;
  onRadarPinDrop?: (coords: { lat: number; lng: number }) => void;
  isPinPlacementMode?: boolean;
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
  activeFilters,
  onMapLoad,
  onMapError,
  onBoundsChange,
  radarPin,
  onRadarPinDrag,
  onRadarPinDrop,
  isPinPlacementMode = false,
}: InteractiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const businessesMapRef = useRef<Map<string, Business>>(new Map());
  const hoverPopupRef = useRef<maplibregl.Popup | null>(null);
  const popupLeaveTimerRef = useRef<any>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const pinMarkerRef = useRef<maplibregl.Marker | null>(null);
  const isPinPlacementModeRef = useRef(isPinPlacementMode);
  isPinPlacementModeRef.current = isPinPlacementMode;

  const onRadarPinDropRef = useRef(onRadarPinDrop);
  onRadarPinDropRef.current = onRadarPinDrop;

  const onRadarPinDragRef = useRef(onRadarPinDrag);
  onRadarPinDragRef.current = onRadarPinDrag;

  const radarPinRef = useRef(radarPin);
  radarPinRef.current = radarPin;

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
        style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
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
        setIsMapLoaded(true);
        onMapLoad?.();

        // 1. Add GeoJSON Source for Businesses
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

        // 1b. Add GeoJSON Source for Radar Circle Area
        map.addSource('radar-circle', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [],
          },
        });

        // 1c. Add Radar Circle Fill Layer (placed behind clusters and points)
        map.addLayer({
          id: 'radar-circle-fill',
          type: 'fill',
          source: 'radar-circle',
          paint: {
            'fill-color': '#FF4D00',
            'fill-opacity': 0.15,
          },
        });

        // 1d. Add Radar Circle Stroke/Border Layer
        map.addLayer({
          id: 'radar-circle-line',
          type: 'line',
          source: 'radar-circle',
          paint: {
            'line-color': '#FF4D00',
            'line-width': 2.5,
            'line-dasharray': [3, 2],
            'line-opacity': 0.9,
          },
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
              '#C43800',
              100,
              '#A02E00',
              500,
              '#7D2400',
            ],
            'circle-radius': [
              'step',
              ['get', 'point_count'],
              18,
              10,
              22,
              50,
              26,
              100,
              30,
              500,
              35,
            ],
            'circle-stroke-width': 2.5,
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
            'circle-color': ['get', 'markerColor'],
            'circle-radius': ['get', 'markerRadius'],
            'circle-stroke-width': ['get', 'outlineWidth'],
            'circle-stroke-color': ['get', 'outlineColor'],
          },
        });

        // 4b. Load and add WhatsApp Icon Layer (Conditional)
        map.loadImage('/whatsapp_icone.png')
          .then((response) => {
            if (response && response.data) {
              if (!map.hasImage('whatsapp-icon')) {
                map.addImage('whatsapp-icon', response.data);
              }
              if (!map.getLayer('unclustered-point-whatsapp')) {
                map.addLayer({
                  id: 'unclustered-point-whatsapp',
                  type: 'symbol',
                  source: 'businesses',
                  filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'showWhatsappIcon'], true]],
                  layout: {
                    'icon-image': 'whatsapp-icon',
                    'icon-size': 0.052,
                    'icon-allow-overlap': true,
                    'icon-ignore-placement': true,
                  },
                });
              }
            }
          })
          .catch((error) => {
            console.error('Failed to load whatsapp icon on map', error);
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
                  hasWebsite
                    ? `<a href="${escapeHtml(biz.website!)}" target="_blank" rel="noopener noreferrer" class="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-800 rounded-xl text-[11px] font-bold transition shadow-2xs">
                        <span>Ver site</span>
                      </a>`
                    : ''
                }
                <button type="button" data-biz-id="${escapeHtml(biz.id)}" class="btn-scoutly-open-panel flex-1 px-3 py-1.5 bg-[#FF4D00] hover:bg-[#E04400] text-white rounded-xl text-[11px] font-bold transition shadow-2xs shrink-0 cursor-pointer">
                  Ver resumo
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

            const detailsBtn = popupElement.querySelector('.btn-scoutly-open-panel');
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

        // Right-click anywhere on the map to drop the prospecting pin immediately
        map.on('contextmenu', (e) => {
          e.preventDefault();
          onRadarPinDropRef.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
        });

        // Click to drop pin when in pin placement mode
        map.on('click', (e) => {
          if (isPinPlacementModeRef.current) {
            onRadarPinDropRef.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
          }
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
        features: businesses.map((biz) => {
          let markerColor = '#FF4D00';
          let outlineColor = '#ffffff';
          let outlineWidth = 2;
          let markerRadius = 7;
          let showWhatsappIcon = false;

          const hasWebsite = Boolean(biz.website);
          const hasPhone = Boolean(biz.phone || (biz.phones && biz.phones.length > 0));
          const hasSocial = Boolean(biz.socials && biz.socials.length > 0);

          if (activeFilters.semSite && !hasWebsite) {
            markerColor = '#ef4444'; // red
          } else if (activeFilters.comSite && hasWebsite) {
            markerColor = '#22c55e'; // green
          } else if (activeFilters.comRedeSocial && hasSocial) {
            markerColor = '#3b82f6'; // blue
          }
          
          if (activeFilters.comWhatsapp && hasPhone) {
            outlineColor = '#25D366'; // whatsapp green outline
            outlineWidth = 2.5;
            markerColor = '#ffffff'; // white background behind whatsapp icon
            markerRadius = 10;
            showWhatsappIcon = true;
          }

          return {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [biz.longitude, biz.latitude],
            },
            properties: {
              id: biz.id,
              name: biz.name,
              markerColor,
              outlineColor,
              outlineWidth,
              markerRadius,
              showWhatsappIcon,
            },
          };
        }),
      };

      source.setData(geojson);
    }
  }, [businesses, activeFilters, isMapLoaded]);

  // Pan to selected business
  useEffect(() => {
    if (!mapRef.current || !selectedBusiness) return;
    mapRef.current.flyTo({
      center: [selectedBusiness.longitude, selectedBusiness.latitude],
      zoom: Math.max(mapRef.current.getZoom() || zoom, 16),
      essential: true,
    });
  }, [selectedBusiness]);

  // Handle Radar Pin Marker & Radius Circle updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    const circleSource = map.getSource('radar-circle') as maplibregl.GeoJSONSource | undefined;

    if (radarPin && radarPin.active) {
      // 1. Update Circle Source
      if (circleSource) {
        const circleFeature = createGeoJSONCircle(
          [radarPin.lng, radarPin.lat],
          radarPin.radiusMeters
        );
        circleSource.setData({
          type: 'FeatureCollection',
          features: [circleFeature],
        });
      }

      // 2. Create or Update Marker
      if (!pinMarkerRef.current) {
        const markerEl = document.createElement('div');
        markerEl.className = 'scoutly-draggable-pin-container group';
        markerEl.style.cursor = 'grab';
        markerEl.innerHTML = `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; pointer-events: auto; user-select: none;">
            <div style="background: rgba(24, 24, 27, 0.94); backdrop-filter: blur(8px); color: #ffffff; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 9999px; margin-bottom: 6px; box-shadow: 0 4px 16px rgba(0,0,0,0.5); border: 1.5px solid rgba(255, 77, 0, 0.7); white-space: nowrap; display: flex; align-items: center; gap: 6px; transition: all 0.2s;">
              <span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:#FF4D00; box-shadow: 0 0 8px #FF4D00;"></span>
              <span>Arraste o Pin 📍</span>
            </div>
            <div style="position: relative; width: 42px; height: 42px; border-radius: 50%; background: radial-gradient(circle at 30% 30%, #FF6A26, #E04400); display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 8px 24px rgba(255, 77, 0, 0.6), 0 0 0 3px #ffffff; transition: transform 0.15s ease;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
            <div style="width: 3px; height: 8px; background: #E04400; margin-top: -1px; border-radius: 0 0 3px 3px;"></div>
          </div>
        `;

        const marker = new maplibregl.Marker({
          element: markerEl,
          draggable: true,
          anchor: 'bottom',
        });

        marker.on('drag', () => {
          const lngLat = marker.getLngLat();
          // Update circle in real-time while dragging
          if (circleSource && radarPinRef.current) {
            const tempCircle = createGeoJSONCircle(
              [lngLat.lng, lngLat.lat],
              radarPinRef.current.radiusMeters
            );
            circleSource.setData({
              type: 'FeatureCollection',
              features: [tempCircle],
            });
          }
          onRadarPinDragRef.current?.({ lat: lngLat.lat, lng: lngLat.lng });
        });

        marker.on('dragend', () => {
          const lngLat = marker.getLngLat();
          onRadarPinDropRef.current?.({ lat: lngLat.lat, lng: lngLat.lng });
        });

        marker.setLngLat([radarPin.lng, radarPin.lat]).addTo(map);
        pinMarkerRef.current = marker;
      } else {
        const currentPos = pinMarkerRef.current.getLngLat();
        if (
          Math.abs(currentPos.lat - radarPin.lat) > 0.00001 ||
          Math.abs(currentPos.lng - radarPin.lng) > 0.00001
        ) {
          pinMarkerRef.current.setLngLat([radarPin.lng, radarPin.lat]);
        }
      }
    } else {
      // Clean up when deactivated
      if (pinMarkerRef.current) {
        pinMarkerRef.current.remove();
        pinMarkerRef.current = null;
      }
      if (circleSource) {
        circleSource.setData({
          type: 'FeatureCollection',
          features: [],
        });
      }
    }
  }, [radarPin, isMapLoaded]);

  // Update cursor when pin placement mode is active
  useEffect(() => {
    if (!mapRef.current) return;
    const canvas = mapRef.current.getCanvas();
    if (canvas) {
      canvas.style.cursor = isPinPlacementMode ? 'crosshair' : '';
    }
  }, [isPinPlacementMode]);

  return (
    <div className="relative w-full h-full bg-[#FAF7F2]">
      <div ref={mapContainerRef} className="w-full h-full" id="interactive-prospect-map" />
    </div>
  );
}

export default memo(InteractiveMap);

