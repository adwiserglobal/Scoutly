import * as maplibregl from 'maplibre-gl';

const MAP_3D_LAYER_ID = 'scoutly-3d-buildings';
const MAP_3D_GLOW_LAYER_ID = 'scoutly-3d-business-glow';
type ScoutlyMapMode = 'classic' | '3d';

const proto = maplibregl.Map.prototype as any;

function setLayerVisibility(map: maplibregl.Map, layerId: string, visible: boolean) {
  if (!map.getLayer(layerId)) return;
  map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
}

function applyMapMode(map: maplibregl.Map, mode: ScoutlyMapMode, animate = true) {
  const is3D = mode === '3d';

  setLayerVisibility(map, MAP_3D_LAYER_ID, is3D);
  setLayerVisibility(map, MAP_3D_GLOW_LAYER_ID, is3D);

  // 3D is deliberately opt-in. We do not persist it between reloads so the
  // normal 2D experience remains the lightweight default on every new load.
  map.getContainer().classList.toggle('scoutly-map-3d-active', is3D);

  // A cinematic angle close to the PinDrop reference, but intentionally less
  // aggressive so MapLibre does not have to keep a huge horizon of tiles alive.
  const targetPitch = is3D ? 48 : 0;
  const targetBearing = is3D ? -14 : 0;
  const targetZoom = is3D ? Math.max(map.getZoom(), 15.05) : map.getZoom();

  (map as any).setMaxPitch?.(60);

  if (animate) {
    map.easeTo({
      pitch: targetPitch,
      bearing: targetBearing,
      zoom: targetZoom,
      duration: 620,
      essential: true,
    });
  } else {
    map.setPitch(targetPitch);
    map.setBearing(targetBearing);
    if (is3D && map.getZoom() < 15.05) map.setZoom(15.05);
  }

  window.dispatchEvent(new CustomEvent('scoutly-map-mode-changed', {
    detail: { mode },
  }));
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

  onAdd(map: maplibregl.Map) {
    this.map = map;

    const container = document.createElement('div');
    container.className = 'maplibregl-ctrl scoutly-map-mode-control';
    container.setAttribute('role', 'group');
    container.setAttribute('aria-label', 'Modo de visualização do mapa');

    const classicButton = document.createElement('button');
    classicButton.type = 'button';
    classicButton.className = 'scoutly-map-mode-btn is-active';
    classicButton.title = 'Mapa clássico';
    classicButton.setAttribute('aria-label', 'Mapa clássico');
    classicButton.setAttribute('aria-pressed', 'true');
    classicButton.innerHTML = `${mapIcon()}<span>2D</span>`;

    const threeDButton = document.createElement('button');
    threeDButton.type = 'button';
    threeDButton.className = 'scoutly-map-mode-btn';
    threeDButton.title = 'Mapa 3D noturno';
    threeDButton.setAttribute('aria-label', 'Mapa 3D noturno');
    threeDButton.setAttribute('aria-pressed', 'false');
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

    container.append(classicButton, threeDButton);
    this.container = container;

    return container;
  }

  onRemove() {
    this.container?.remove();
    this.map = undefined;
  }
}

function buildingHeightExpression() {
  return [
    'case',
    ['has', 'render_height'], ['to-number', ['get', 'render_height'], 7],
    ['has', 'height'], ['to-number', ['get', 'height'], 7],
    ['has', 'levels'], ['*', ['to-number', ['get', 'levels'], 2], 3],
    7,
  ] as any;
}

function buildingBaseExpression() {
  return [
    'case',
    ['has', 'render_min_height'], ['to-number', ['get', 'render_min_height'], 0],
    ['has', 'min_height'], ['to-number', ['get', 'min_height'], 0],
    0,
  ] as any;
}

if (!proto.__scoutly3dPatched) {
  const originalAddSource = proto.addSource;

  proto.addSource = function (id: string, source: any) {
    const result = originalAddSource.call(this, id, source);

    if (id === 'businesses' && !this.getLayer(MAP_3D_LAYER_ID) && this.getSource('carto')) {
      try {
        const styleLayers = this.getStyle()?.layers || [];
        const firstSymbolLayerId = styleLayers.find((layer: any) => layer.type === 'symbol')?.id;
        const height = buildingHeightExpression();

        // One native GPU extrusion layer only. No terrain DEM, no textures, no
        // custom WebGL scene and no animation loop. This keeps the 3D mode much
        // lighter than fully rendered city/terrain implementations.
        this.addLayer(
          {
            id: MAP_3D_LAYER_ID,
            type: 'fill-extrusion',
            source: 'carto',
            'source-layer': 'building',
            minzoom: 15,
            maxzoom: 19,
            layout: {
              visibility: 'none',
            },
            paint: {
              'fill-extrusion-color': [
                'interpolate',
                ['linear'],
                height,
                0, '#151a20',
                24, '#1b232c',
                60, '#232d38',
                120, '#2a3541',
              ],
              'fill-extrusion-height': height,
              'fill-extrusion-base': buildingBaseExpression(),
              'fill-extrusion-opacity': 0.9,
              'fill-extrusion-vertical-gradient': true,
            },
          } as any,
          firstSymbolLayerId
        );

        // A single cheap circle layer creates the subtle night glow around the
        // existing business pins. It is hidden in 2D and has no DOM markers.
        if (!this.getLayer(MAP_3D_GLOW_LAYER_ID)) {
          this.addLayer({
            id: MAP_3D_GLOW_LAYER_ID,
            type: 'circle',
            source: 'businesses',
            minzoom: 15,
            filter: ['!', ['has', 'point_count']],
            layout: {
              visibility: 'none',
            },
            paint: {
              'circle-color': ['get', 'markerColor'],
              'circle-radius': ['*', ['get', 'markerRadius'], 1.9],
              'circle-opacity': 0.2,
              'circle-blur': 0.72,
              'circle-stroke-width': 0,
            },
          } as any);
        }

        if (!(this as any).__scoutlyMapModeControlAdded) {
          this.addControl(new ScoutlyMapModeControl(), 'top-right');
          (this as any).__scoutlyMapModeControlAdded = true;
        }

        // Always start in classic 2D. The richer night scene exists only after
        // the user explicitly clicks 3D on the current page load.
        applyMapMode(this, 'classic', false);

        console.info('[Scoutly Map] Lightweight night 3D mode enabled');
      } catch (error) {
        console.error('[Scoutly Map] Could not enable 3D mode:', error);
      }
    }

    return result;
  };

  proto.__scoutly3dPatched = true;
}
