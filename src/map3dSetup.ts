import * as maplibregl from 'maplibre-gl';

const MAP_3D_LAYER_ID = 'scoutly-3d-buildings';
const MAP_MODE_STORAGE_KEY = 'scoutly-map-mode';
type ScoutlyMapMode = 'classic' | '3d';

const proto = maplibregl.Map.prototype as any;

function getSavedMapMode(): ScoutlyMapMode {
  if (typeof window === 'undefined') return 'classic';
  return window.localStorage.getItem(MAP_MODE_STORAGE_KEY) === '3d' ? '3d' : 'classic';
}

function setSavedMapMode(mode: ScoutlyMapMode) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(MAP_MODE_STORAGE_KEY, mode);
}

function applyMapMode(map: maplibregl.Map, mode: ScoutlyMapMode, animate = true) {
  if (map.getLayer(MAP_3D_LAYER_ID)) {
    map.setLayoutProperty(MAP_3D_LAYER_ID, 'visibility', mode === '3d' ? 'visible' : 'none');
  }

  const camera = mode === '3d'
    ? { pitch: 40, bearing: -12 }
    : { pitch: 0, bearing: 0 };

  if (animate) {
    map.easeTo({ ...camera, duration: 520, essential: true });
  } else {
    map.setPitch(camera.pitch);
    map.setBearing(camera.bearing);
  }

  setSavedMapMode(mode);
}

function mapIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 18 3.8 20.6A1.25 1.25 0 0 1 2 19.48V6.26c0-.47.27-.9.7-1.12L9 2l6 3 5.2-2.6A1.25 1.25 0 0 1 22 3.52v13.22c0 .47-.27.9-.7 1.12L15 21l-6-3Z"/>
      <path d="M9 2v16M15 5v16"/>
    </svg>`;
}

function cubeIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 3 7.5 4.2v9.6L12 21l-7.5-4.2V7.2L12 3Z"/>
      <path d="m4.8 7.4 7.2 4.1 7.2-4.1M12 11.5V21"/>
    </svg>`;
}

class ScoutlyMapModeControl implements maplibregl.IControl {
  private map?: maplibregl.Map;
  private container?: HTMLDivElement;
  private classicButton?: HTMLButtonElement;
  private threeDButton?: HTMLButtonElement;

  onAdd(map: maplibregl.Map) {
    this.map = map;

    const container = document.createElement('div');
    container.className = 'maplibregl-ctrl scoutly-map-mode-control';
    container.setAttribute('role', 'group');
    container.setAttribute('aria-label', 'Modo de visualização do mapa');

    const classicButton = document.createElement('button');
    classicButton.type = 'button';
    classicButton.className = 'scoutly-map-mode-btn';
    classicButton.title = 'Mapa clássico';
    classicButton.setAttribute('aria-label', 'Mapa clássico');
    classicButton.innerHTML = `${mapIcon()}<span>2D</span>`;

    const threeDButton = document.createElement('button');
    threeDButton.type = 'button';
    threeDButton.className = 'scoutly-map-mode-btn';
    threeDButton.title = 'Mapa 3D';
    threeDButton.setAttribute('aria-label', 'Mapa 3D');
    threeDButton.innerHTML = `${cubeIcon()}<span>3D</span>`;

    const setActiveState = (mode: ScoutlyMapMode) => {
      classicButton.classList.toggle('is-active', mode === 'classic');
      threeDButton.classList.toggle('is-active', mode === '3d');
      classicButton.setAttribute('aria-pressed', String(mode === 'classic'));
      threeDButton.setAttribute('aria-pressed', String(mode === '3d'));
    };

    classicButton.addEventListener('click', () => {
      applyMapMode(map, 'classic');
      setActiveState('classic');
    });

    threeDButton.addEventListener('click', () => {
      applyMapMode(map, '3d');
      setActiveState('3d');
    });

    const initialMode = getSavedMapMode();
    setActiveState(initialMode);

    container.append(classicButton, threeDButton);
    this.container = container;
    this.classicButton = classicButton;
    this.threeDButton = threeDButton;

    return container;
  }

  onRemove() {
    this.container?.remove();
    this.map = undefined;
  }
}

if (!proto.__scoutly3dPatched) {
  const originalAddSource = proto.addSource;
  const originalAddLayer = proto.addLayer;

  // MapLibre renders the markers inside WebGL, so CSS backdrop-filter cannot be
  // applied to them. This patch reproduces the glass effect with translucent
  // orange, a soft bloom and a restrained glass edge while preserving the
  // existing clustering, sizes, filters and interactions.
  proto.addLayer = function (layer: any, beforeId?: string) {
    if (layer?.id === 'clusters' && layer?.type === 'circle') {
      const radius = layer.paint?.['circle-radius'] || 18;

      if (!this.getLayer('clusters-glass-glow')) {
        originalAddLayer.call(this, {
          ...layer,
          id: 'clusters-glass-glow',
          paint: {
            'circle-color': 'rgba(255, 82, 18, 0.26)',
            'circle-radius': ['+', radius, 6],
            'circle-opacity': 0.72,
            'circle-blur': 0.82,
            'circle-stroke-width': 0,
          },
        }, beforeId);
      }

      return originalAddLayer.call(this, {
        ...layer,
        paint: {
          ...layer.paint,
          'circle-color': [
            'step',
            ['get', 'point_count'],
            'rgba(255, 104, 45, 0.48)',
            10,
            'rgba(255, 94, 31, 0.50)',
            50,
            'rgba(255, 82, 18, 0.52)',
            100,
            'rgba(246, 74, 12, 0.54)',
            500,
            'rgba(224, 61, 5, 0.56)',
          ],
          'circle-opacity': 0.92,
          'circle-blur': 0.025,
          'circle-stroke-width': 1.35,
          'circle-stroke-color': 'rgba(255, 255, 255, 0.50)',
          'circle-stroke-opacity': 0.9,
        },
      }, beforeId);
    }

    if (layer?.id === 'cluster-count' && layer?.type === 'symbol') {
      return originalAddLayer.call(this, {
        ...layer,
        paint: {
          ...layer.paint,
          'text-color': '#FFFFFF',
          'text-halo-color': 'rgba(82, 27, 7, 0.28)',
          'text-halo-width': 1.2,
          'text-halo-blur': 0.8,
        },
      }, beforeId);
    }

    if (layer?.id === 'unclustered-point' && layer?.type === 'circle') {
      const radius = layer.paint?.['circle-radius'] || ['get', 'markerRadius'];

      if (!this.getLayer('unclustered-point-glass-glow')) {
        originalAddLayer.call(this, {
          ...layer,
          id: 'unclustered-point-glass-glow',
          paint: {
            'circle-color': ['get', 'markerColor'],
            'circle-radius': ['+', radius, 3],
            'circle-opacity': [
              'case',
              ['==', ['get', 'showWhatsappIcon'], true],
              0,
              0.28,
            ],
            'circle-blur': 0.78,
            'circle-stroke-width': 0,
          },
        }, beforeId);
      }

      return originalAddLayer.call(this, {
        ...layer,
        paint: {
          ...layer.paint,
          'circle-opacity': [
            'case',
            ['==', ['get', 'showWhatsappIcon'], true],
            1,
            0.62,
          ],
          'circle-blur': 0.025,
          'circle-stroke-opacity': [
            'case',
            ['==', ['get', 'showWhatsappIcon'], true],
            1,
            0.68,
          ],
        },
      }, beforeId);
    }

    return originalAddLayer.call(this, layer, beforeId);
  };

  proto.addSource = function (id: string, source: any) {
    const result = originalAddSource.call(this, id, source);

    if (id === 'businesses' && !this.getLayer(MAP_3D_LAYER_ID) && this.getSource('carto')) {
      try {
        const styleLayers = this.getStyle()?.layers || [];
        const firstSymbolLayerId = styleLayers.find((layer: any) => layer.type === 'symbol')?.id;

        this.addLayer(
          {
            id: MAP_3D_LAYER_ID,
            type: 'fill-extrusion',
            source: 'carto',
            'source-layer': 'building',
            minzoom: 14.25,
            layout: {
              visibility: 'none',
            },
            paint: {
              'fill-extrusion-color': '#3d3d3d',
              'fill-extrusion-height': [
                'interpolate',
                ['linear'],
                ['zoom'],
                14.25,
                3,
                15,
                9,
                17,
                13,
              ],
              'fill-extrusion-base': 0,
              'fill-extrusion-opacity': 0.8,
              'fill-extrusion-vertical-gradient': true,
            },
          } as any,
          firstSymbolLayerId
        );

        if (!(this as any).__scoutlyMapModeControlAdded) {
          this.addControl(new ScoutlyMapModeControl(), 'top-right');
          (this as any).__scoutlyMapModeControlAdded = true;
        }

        const initialMode = getSavedMapMode();
        applyMapMode(this, initialMode, false);

        console.info('[Scoutly Map] 2D/3D mode control enabled');
      } catch (error) {
        console.error('[Scoutly Map] Could not enable map mode control:', error);
      }
    }

    return result;
  };

  proto.__scoutly3dPatched = true;
}
