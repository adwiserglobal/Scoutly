import * as maplibregl from 'maplibre-gl';

const MAP_3D_LAYER_ID = 'scoutly-3d-buildings';
const proto = maplibregl.Map.prototype as any;

if (!proto.__scoutly3dPatched) {
  const originalAddSource = proto.addSource;

  proto.addSource = function (id: string, source: any) {
    const result = originalAddSource.call(this, id, source);

    if (id === 'businesses' && !this.getLayer(MAP_3D_LAYER_ID) && this.getSource('carto')) {
      try {
        // Keep the 3D treatment present, but subtle enough that Scoutly's
        // business markers remain the visual priority.
        this.setPitch(40);
        this.setBearing(-12);

        const styleLayers = this.getStyle()?.layers || [];
        const firstSymbolLayerId = styleLayers.find((layer: any) => layer.type === 'symbol')?.id;

        this.addLayer(
          {
            id: MAP_3D_LAYER_ID,
            type: 'fill-extrusion',
            source: 'carto',
            'source-layer': 'building',
            minzoom: 14.25,
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

        console.info('[Scoutly 3D] Building extrusion enabled');
      } catch (error) {
        console.error('[Scoutly 3D] Could not enable building extrusion:', error);
      }
    }

    return result;
  };

  proto.__scoutly3dPatched = true;
}
