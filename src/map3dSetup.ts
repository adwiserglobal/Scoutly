import * as maplibregl from 'maplibre-gl';

const MAP_3D_LAYER_ID = 'scoutly-3d-buildings';
const proto = maplibregl.Map.prototype as any;

if (!proto.__scoutly3dPatched) {
  const originalAddSource = proto.addSource;

  proto.addSource = function (id: string, source: any) {
    const result = originalAddSource.call(this, id, source);

    // The Scoutly map adds this source only after the CARTO base style is loaded.
    // That gives us a safe point to enable the subtle 3D treatment once per map.
    if (id === 'businesses' && !this.getLayer(MAP_3D_LAYER_ID) && this.getSource('carto')) {
      try {
        this.setPitch(38);
        this.setBearing(-12);

        const firstSymbolLayerId = this
          .getStyle()
          ?.layers
          ?.find((layer: any) => layer.type === 'symbol')?.id;

        this.addLayer(
          {
            id: MAP_3D_LAYER_ID,
            type: 'fill-extrusion',
            source: 'carto',
            'source-layer': 'building',
            minzoom: 14.5,
            filter: ['!=', ['get', 'hide_3d'], true],
            paint: {
              'fill-extrusion-color': '#353535',
              'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8],
              'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
              'fill-extrusion-opacity': 0.78,
              'fill-extrusion-vertical-gradient': true,
            },
          } as any,
          firstSymbolLayerId
        );
      } catch (error) {
        console.warn('[Scoutly 3D] Could not enable building extrusion:', error);
      }
    }

    return result;
  };

  proto.__scoutly3dPatched = true;
}
