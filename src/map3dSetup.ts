import * as maplibregl from 'maplibre-gl';

const MAP_3D_LAYER_ID = 'scoutly-3d-buildings';
const proto = maplibregl.Map.prototype as any;

if (!proto.__scoutly3dPatched) {
  const originalAddSource = proto.addSource;

  proto.addSource = function (id: string, source: any) {
    const result = originalAddSource.call(this, id, source);

    if (id === 'businesses' && !this.getLayer(MAP_3D_LAYER_ID) && this.getSource('carto')) {
      try {
        this.setPitch(48);
        this.setBearing(-18);

        const styleLayers = this.getStyle()?.layers || [];
        const firstSymbolLayerId = styleLayers.find((layer: any) => layer.type === 'symbol')?.id;

        this.addLayer(
          {
            id: MAP_3D_LAYER_ID,
            type: 'fill-extrusion',
            source: 'carto',
            'source-layer': 'building',
            minzoom: 14,
            paint: {
              // Use a guaranteed visible height first. CARTO's building source is
              // OpenMapTiles-compatible, but not every building has height metadata.
              'fill-extrusion-color': '#4a4a4a',
              'fill-extrusion-height': 18,
              'fill-extrusion-base': 0,
              'fill-extrusion-opacity': 0.96,
              'fill-extrusion-vertical-gradient': true,
            },
          } as any,
          firstSymbolLayerId
        );

        console.info('[Scoutly 3D] Building extrusion enabled');
      } catch (error) {
        console.error('[Scoutly 3D] Could not enable building extrusion:', error);
      }
    }

    return result;
  };

  proto.__scoutly3dPatched = true;
}
