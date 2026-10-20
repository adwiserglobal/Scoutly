import * as THREE from 'three';
import * as maplibregl from 'maplibre-gl';
import { getFlightModel, type FlightModelId, type FlightModelProfile } from './models';

/**
 * 3D "prospecting flight" mode: a small plane flies over the map and the camera chases it.
 * The plane is drawn with three.js in a MapLibre custom layer that shares the map's WebGL
 * context, so it sits in the same depth buffer as the (optional) 3D buildings.
 *
 * World frame used for the model matrix: x = east, y = south, z = up (Web Mercator units).
 * Model frame: +X right wing, +Y up, -Z nose.
 */

export interface FlightState {
  lng: number;
  lat: number;
  heading: number; // degrees, clockwise from north
  speed: number; // m/s
  altitude: number; // m (visual)
  turn: number; // -1..1 smoothed
  vertical: number; // -1..1 smoothed climb
}

export interface FlightInput {
  turn: number; // -1 (left) .. 1 (right)
  throttle: number; // -1 (slow) .. 1 (faster)
  boost: boolean;
  climb: number; // -1 (descend) .. 1 (climb)
}

export interface PlaneFlightOptions {
  model?: FlightModelId;
  onFrame?: (state: FlightState) => void;
}

const LAYER_ID = 'scoutly-plane-layer';
const BUILDINGS_ID = 'scoutly-flight-buildings';
const TRAIL_POINTS = 70;

const ORANGE = 0xff5a12;
const CREAM = 0xf6f1e8;

interface FlightModelRig {
  group: THREE.Group;
  animate: (spin: number, time: number, speedRatio: number) => void;
}

function buildPlaneModel(): FlightModelRig {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: ORANGE, metalness: 0.15, roughness: 0.42, side: THREE.DoubleSide });
  const cream = new THREE.MeshStandardMaterial({ color: CREAM, metalness: 0.1, roughness: 0.5, side: THREE.DoubleSide });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a1d23, metalness: 0.4, roughness: 0.55, side: THREE.DoubleSide });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x9fd6ff, metalness: 0.7, roughness: 0.12, transparent: true, opacity: 0.82, side: THREE.DoubleSide,
  });

  // Fuselage: lathe around Y, then laid along -Z (nose forward)
  const profile = [
    [0.0, -4.7], [0.22, -4.6], [0.42, -3.9], [0.72, -2.4], [1.0, -0.8], [1.16, 0.6],
    [1.14, 1.9], [1.0, 3.0], [0.72, 3.8], [0.34, 4.25], [0.0, 4.4],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const fuselageGeo = new THREE.LatheGeometry(profile, 36);
  fuselageGeo.rotateX(-Math.PI / 2);
  group.add(new THREE.Mesh(fuselageGeo, paint));

  // Cream band around the fuselage
  const bandGeo = new THREE.LatheGeometry(
    [[1.01, -0.2], [1.17, -0.2], [1.19, 0.5], [1.17, 1.2], [1.03, 1.2]].map(([r, y]) => new THREE.Vector2(r, y)),
    36,
  );
  bandGeo.rotateX(-Math.PI / 2);
  group.add(new THREE.Mesh(bandGeo, cream));

  // Canopy
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), glass);
  canopy.scale.set(0.82, 0.62, 1.55);
  canopy.position.set(0, 0.95, -0.35);
  group.add(canopy);

  // Wings (planform extruded, laid flat)
  const wingShape = new THREE.Shape([
    [-5.6, 0.25], [-0.9, 1.3], [0.9, 1.3], [5.6, 0.25], [5.6, -0.75], [0.9, -1.4], [-0.9, -1.4], [-5.6, -0.75],
  ].map(([x, y]) => new THREE.Vector2(x, y)));
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.2, bevelEnabled: false });
  wingGeo.rotateX(-Math.PI / 2);
  const wing = new THREE.Mesh(wingGeo, cream);
  wing.position.set(0, -0.12, -0.1);
  group.add(wing);
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.24, 1.05), paint);
    tip.position.set(side * 5.15, -0.02, -0.28);
    group.add(tip);
  }

  // Horizontal stabilizer
  const stabShape = new THREE.Shape([
    [-2.3, 0.1], [-0.5, 0.75], [0.5, 0.75], [2.3, 0.1], [2.3, -0.35], [0.5, -0.7], [-0.5, -0.7], [-2.3, -0.35],
  ].map(([x, y]) => new THREE.Vector2(x, y)));
  const stabGeo = new THREE.ExtrudeGeometry(stabShape, { depth: 0.14, bevelEnabled: false });
  stabGeo.rotateX(-Math.PI / 2);
  const stab = new THREE.Mesh(stabGeo, cream);
  stab.position.set(0, 0.1, 3.85);
  group.add(stab);

  // Vertical fin
  const finShape = new THREE.Shape([
    [2.6, 0.2], [3.4, 2.5], [4.3, 2.6], [4.5, 0.2],
  ].map(([x, y]) => new THREE.Vector2(x, y)));
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.16, bevelEnabled: false });
  finGeo.rotateY(-Math.PI / 2);
  finGeo.translate(0.08, 0.15, 0);
  group.add(new THREE.Mesh(finGeo, paint));

  // Landing gear
  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.9, 8), dark);
    strut.position.set(side * 1.05, -0.62, -1.0);
    strut.rotation.z = side * 0.28;
    group.add(strut);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.2, 18), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 1.2, -1.05, -1.0);
    group.add(wheel);
  }

  // Nose spinner + propeller
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.75, 24), cream);
  spinner.geometry.rotateX(-Math.PI / 2);
  spinner.position.set(0, 0, -4.75);
  group.add(spinner);

  const propeller = new THREE.Group();
  propeller.position.set(0, 0, -4.9);
  for (let i = 0; i < 2; i += 1) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.34, 2.9, 0.05), dark);
    blade.rotation.z = i * (Math.PI / 2);
    propeller.add(blade);
  }
  const blur = new THREE.Mesh(
    new THREE.CircleGeometry(1.5, 32),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }),
  );
  propeller.add(blur);
  group.add(propeller);

  // Navigation lights
  const lights: THREE.Mesh[] = [];
  for (const [side, color] of [[-1, 0xff2d2d], [1, 0x2dff7a]] as const) {
    const light = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 12, 10),
      new THREE.MeshBasicMaterial({ color }),
    );
    light.position.set(side * 5.7, 0.0, -0.3);
    group.add(light);
    lights.push(light);
  }

  return {
    group,
    animate(spin, time) {
      propeller.rotation.z = spin;
      const blink = Math.sin(time * 7) > 0.2 ? 1 : 0.25;
      for (const light of lights) light.scale.setScalar(blink + 0.4);
    },
  };
}

const makeMaterials = (primary: number, secondary: number) => ({
  primary: new THREE.MeshStandardMaterial({ color: primary, metalness: 0.2, roughness: 0.4, side: THREE.DoubleSide }),
  secondary: new THREE.MeshStandardMaterial({ color: secondary, metalness: 0.15, roughness: 0.5, side: THREE.DoubleSide }),
  dark: new THREE.MeshStandardMaterial({ color: 0x15181d, metalness: 0.45, roughness: 0.5, side: THREE.DoubleSide }),
  glass: new THREE.MeshStandardMaterial({
    color: 0x9fd6ff, metalness: 0.7, roughness: 0.12, transparent: true, opacity: 0.82, side: THREE.DoubleSide,
  }),
});

function buildJetModel(): FlightModelRig {
  const group = new THREE.Group();
  const m = makeMaterials(0x2c3a52, 0xdfe5ee);
  const accent = new THREE.MeshStandardMaterial({ color: ORANGE, metalness: 0.2, roughness: 0.4, side: THREE.DoubleSide });

  const profile = [
    [0, -6.4], [0.25, -6.2], [0.55, -4.8], [0.85, -2.6], [1.0, -0.2], [1.0, 2.0], [0.85, 4.2], [0.6, 5.6], [0.0, 6.0],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const bodyGeo = new THREE.LatheGeometry(profile, 32);
  bodyGeo.rotateX(-Math.PI / 2);
  const body = new THREE.Mesh(bodyGeo, m.primary);
  body.scale.set(1, 0.85, 1);
  group.add(body);

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 7.5), accent);
  stripe.position.set(0, 0.86, -0.4);
  group.add(stripe);

  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 16), m.glass);
  canopy.scale.set(0.62, 0.55, 2.0);
  canopy.position.set(0, 0.7, -2.6);
  group.add(canopy);

  // Swept delta-like wings
  const wingShape = new THREE.Shape([
    [-5.4, -1.6], [-0.8, -2.6], [0.8, -2.6], [5.4, -1.6], [5.4, -0.9], [0.9, 2.4], [-0.9, 2.4], [-5.4, -0.9],
  ].map(([x, y]) => new THREE.Vector2(x, y)));
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.16, bevelEnabled: false });
  wingGeo.rotateX(-Math.PI / 2);
  const wing = new THREE.Mesh(wingGeo, m.secondary);
  wing.position.set(0, -0.25, 1.8);
  group.add(wing);
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.2, 1.0), accent);
    tip.position.set(side * 5.1, -0.17, 3.0);
    group.add(tip);
  }

  // Stabilizers + twin canted fins
  const stab = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.12, 1.2), m.secondary);
  stab.position.set(0, 0, 5.0);
  group.add(stab);
  for (const side of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.9, 1.5), m.primary);
    fin.position.set(side * 0.9, 1.0, 5.0);
    fin.rotation.z = -side * 0.22;
    group.add(fin);
    const intake = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 1.3, 16), m.dark);
    intake.rotation.x = Math.PI / 2;
    intake.position.set(side * 1.05, -0.2, -1.2);
    group.add(intake);
  }

  // Engine glow
  const glow = new THREE.Mesh(
    new THREE.ConeGeometry(0.55, 2.2, 20),
    new THREE.MeshBasicMaterial({ color: 0xff8a3d, transparent: true, opacity: 0.85 }),
  );
  glow.geometry.rotateX(Math.PI / 2);
  glow.position.set(0, 0, 7.0);
  group.add(glow);

  return {
    group,
    animate(_spin, time, speedRatio) {
      const flicker = 0.85 + Math.sin(time * 38) * 0.12;
      glow.scale.set(1, 1, (0.5 + speedRatio * 0.9) * flicker);
    },
  };
}

function buildHeliModel(palette: { primary: number; secondary: number; accent: number }, rescue: boolean): FlightModelRig {
  const group = new THREE.Group();
  const m = makeMaterials(palette.primary, palette.secondary);
  const accent = new THREE.MeshStandardMaterial({ color: palette.accent, metalness: 0.2, roughness: 0.4, side: THREE.DoubleSide });

  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 36, 24), m.primary);
  body.scale.set(rescue ? 1.75 : 1.5, rescue ? 1.5 : 1.3, rescue ? 3.0 : 2.5);
  group.add(body);

  const belt = new THREE.Mesh(new THREE.BoxGeometry(rescue ? 3.55 : 3.05, 0.34, rescue ? 3.6 : 3.1), accent);
  belt.position.set(0, -0.15, 0.3);
  belt.scale.set(0.99, 1, 0.99);
  group.add(belt);

  const bubble = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), m.glass);
  bubble.scale.set(1.25, 0.95, 1.5);
  bubble.position.set(0, 0.35, rescue ? -2.0 : -1.65);
  group.add(bubble);

  // Tail boom
  const boomLength = rescue ? 6.2 : 5.2;
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.5, boomLength, 18), m.primary);
  boom.rotation.x = Math.PI / 2;
  boom.position.set(0, 0.15, 2 + boomLength / 2);
  group.add(boom);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.9, 1.2), accent);
  fin.position.set(0, 0.9, 2 + boomLength - 0.1);
  fin.rotation.x = -0.35;
  group.add(fin);
  const hStab = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.1, 0.6), m.secondary);
  hStab.position.set(0, 0.3, 2 + boomLength - 0.9);
  group.add(hStab);

  // Engine hump + mast
  const hump = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 2.0), m.secondary);
  hump.position.set(0, 1.15, 0.5);
  group.add(hump);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.7, 12), m.dark);
  mast.position.set(0, 1.7, 0.4);
  group.add(mast);

  // Skids
  for (const side of [-1, 1]) {
    const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, rescue ? 5.2 : 4.4, 10), m.dark);
    skid.rotation.x = Math.PI / 2;
    skid.position.set(side * 1.45, -1.75, 0.2);
    group.add(skid);
    for (const z of [-1.0, 1.4]) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 8), m.dark);
      strut.position.set(side * 1.3, -1.2, z);
      strut.rotation.z = side * 0.18;
      group.add(strut);
    }
  }

  // Main rotor
  const rotor = new THREE.Group();
  rotor.position.set(0, 2.1, 0.4);
  const bladeCount = rescue ? 4 : 2;
  for (let i = 0; i < bladeCount; i += 1) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(rescue ? 8.4 : 8.8, 0.06, 0.42), m.dark);
    blade.rotation.y = (i * Math.PI) / bladeCount;
    rotor.add(blade);
  }
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(rescue ? 4.2 : 4.4, 40),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }),
  );
  disc.rotation.x = -Math.PI / 2;
  rotor.add(disc);
  group.add(rotor);

  // Tail rotor
  const tailRotor = new THREE.Group();
  tailRotor.position.set(0.32, 1.0, 2 + boomLength - 0.1);
  for (let i = 0; i < 2; i += 1) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.7, 0.16), m.dark);
    blade.rotation.x = (i * Math.PI) / 2;
    tailRotor.add(blade);
  }
  group.add(tailRotor);

  // Beacon
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), new THREE.MeshBasicMaterial({ color: 0xff2d2d }));
  beacon.position.set(0, 2.05, 2 + boomLength - 0.2);
  group.add(beacon);

  return {
    group,
    animate(spin, time) {
      rotor.rotation.y = spin * 1.4;
      tailRotor.rotation.x = spin * 2;
      beacon.scale.setScalar(Math.sin(time * 6) > 0.1 ? 1.2 : 0.3);
    },
  };
}

function buildModel(id: FlightModelId): FlightModelRig {
  if (id === 'jet') return buildJetModel();
  if (id === 'heli-city') return buildHeliModel({ primary: 0xff5a12, secondary: 0xf6f1e8, accent: 0x1b1f26 }, false);
  if (id === 'heli-rescue') return buildHeliModel({ primary: 0xf4f4f1, secondary: 0x2b3a55, accent: 0xd8262d }, true);
  return buildPlaneModel();
}

function buildShadow() {
  const shape = new THREE.Shape();
  // Fuselage + wings + tail silhouette on the ground plane (x, y) -> later rotated flat
  const pts: Array<[number, number]> = [
    [0, 4.6], [0.5, 3.8], [0.9, 1.4], [5.6, 0.7], [5.6, -0.3], [0.9, -0.9], [0.9, -3.0], [2.4, -3.6], [2.4, -4.0],
    [0.4, -4.4], [0, -4.8], [-0.4, -4.4], [-2.4, -4.0], [-2.4, -3.6], [-0.9, -3.0], [-0.9, -0.9], [-5.6, -0.3],
    [-5.6, 0.7], [-0.9, 1.4], [-0.5, 3.8],
  ];
  shape.setFromPoints(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide,
  }));
}

const angleDiff = (a: number, b: number) => ((((a - b) % 360) + 540) % 360) - 180;

export class PlaneFlight {
  private map: maplibregl.Map;
  private options: PlaneFlightOptions;
  private profile: FlightModelProfile;
  private state: FlightState;
  private input: FlightInput = { turn: 0, throttle: 0, boost: false, climb: 0 };
  private raf = 0;
  private last = 0;
  private running = false;
  private cameraBearing = 0;
  private cameraZoom = 16.2;
  /** Mouse-wheel offset on top of the automatic chase zoom (negative = farther from the aircraft). */
  private userZoom = 0;
  private roll = 0;
  private pitchTilt = 0;
  private prevSpeed = 0;
  private spin = 0;
  private paused = false;
  private layerAdded = false;
  private restoreHandlers: Array<() => void> = [];

  // three.js objects (created in onAdd, once GL exists)
  private renderer: THREE.WebGLRenderer | null = null;
  private camera = new THREE.Camera();
  private planeScene = new THREE.Scene();
  private shadowScene = new THREE.Scene();
  private trailScene = new THREE.Scene();
  private plane: FlightModelRig | null = null;
  private shadow: THREE.Mesh | null = null;
  private trail: THREE.Points | null = null;
  private trailPositions = new Float32Array(TRAIL_POINTS * 3);
  private trailAges = new Float32Array(TRAIL_POINTS);
  private trailCount = 0;
  private trailTimer = 0;
  private anchor = { lng: 0, lat: 0 };
  private elapsed = 0;

  constructor(map: maplibregl.Map, options: PlaneFlightOptions = {}) {
    this.map = map;
    this.options = options;
    this.profile = getFlightModel(options.model);
    this.state = { lng: 0, lat: 0, heading: 0, speed: this.profile.cruise, altitude: this.profile.altitude, turn: 0, vertical: 0 };
  }

  get currentState() {
    return this.state;
  }

  setInput(input: Partial<FlightInput>) {
    this.input = { ...this.input, ...input };
  }

  setPaused(value: boolean) {
    this.paused = value;
  }

  start(lng: number, lat: number, heading = 0) {
    if (this.running) return;
    this.running = true;
    this.state = { lng, lat, heading, speed: this.profile.cruise, altitude: this.profile.altitude, turn: 0, vertical: 0 };
    this.prevSpeed = this.profile.cruise;
    this.anchor = { lng, lat };
    this.cameraBearing = this.map.getBearing();
    this.cameraZoom = this.map.getZoom();
    this.trailCount = 0;
    this.lockInteractions();
    this.addLayer();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  stop(restoreView = true) {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.raf);
    if (this.layerAdded && this.map.getLayer(LAYER_ID)) this.map.removeLayer(LAYER_ID);
    this.layerAdded = false;
    if (this.map.getLayer(BUILDINGS_ID)) this.map.removeLayer(BUILDINGS_ID);
    for (const restore of this.restoreHandlers) restore();
    this.restoreHandlers = [];
    if (restoreView) {
      this.map.easeTo({ pitch: 0, bearing: 0, padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: 900 });
    }
  }

  // ---------------------------------------------------------------------------

  private lockInteractions() {
    this.userZoom = 0;
    const onWheel = (event: WheelEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest?.('[role="dialog"], [data-no-flight-zoom]')) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : 1;
      this.userZoom = Math.min(2.4, Math.max(-1.8, this.userZoom - (event.deltaY * unit) * 0.0035));
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    this.restoreHandlers.push(() => window.removeEventListener('wheel', onWheel));
    const handlers: Array<[string, any]> = [
      ['dragPan', this.map.dragPan], ['scrollZoom', this.map.scrollZoom], ['boxZoom', this.map.boxZoom],
      ['dragRotate', this.map.dragRotate], ['keyboard', this.map.keyboard],
      ['doubleClickZoom', this.map.doubleClickZoom], ['touchZoomRotate', this.map.touchZoomRotate],
      ['touchPitch', (this.map as any).touchPitch],
    ];
    for (const [, handler] of handlers) {
      if (handler?.isEnabled?.()) {
        handler.disable();
        this.restoreHandlers.push(() => handler.enable());
      }
    }
  }

  private addBuildings() {
    try {
      const style = this.map.getStyle();
      const building = (style.layers || []).find((layer: any) =>
        layer['source-layer'] === 'building' && layer.source,
      ) as any;
      if (!building || this.map.getLayer(BUILDINGS_ID)) return;
      this.map.addLayer({
        id: BUILDINGS_ID,
        type: 'fill-extrusion',
        source: building.source,
        'source-layer': 'building',
        minzoom: 14,
        paint: {
          'fill-extrusion-color': ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 8],
            0, '#1d222b', 40, '#2a313d', 120, '#3a4352'],
          'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': 0.92,
        },
      } as any);
    } catch {
      /* buildings are a bonus; the plane works without them */
    }
  }

  private addLayer() {
    if (this.map.getLayer(LAYER_ID)) return;
    const self = this;
    const layer: maplibregl.CustomLayerInterface = {
      id: LAYER_ID,
      type: 'custom',
      renderingMode: '3d',
      onAdd(_map, gl) {
        self.setupScene(gl);
      },
      render(_gl, args) {
        self.renderScene(args);
      },
      onRemove() {
        self.disposeScene();
      },
    };
    this.map.addLayer(layer);
    this.layerAdded = true;
  }

  private setupScene(gl: WebGL2RenderingContext) {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.map.getCanvas(), context: gl, antialias: true,
    });
    this.renderer.autoClear = false;

    this.plane = buildModel(this.profile.id);
    this.planeScene.add(this.plane.group);
    this.planeScene.add(new THREE.AmbientLight(0xffffff, 1.35));
    this.planeScene.add(new THREE.HemisphereLight(0xcfe3ff, 0x2b2118, 0.9));
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
    sun.position.set(-6, 10, 5);
    this.planeScene.add(sun);

    this.shadow = buildShadow();
    this.shadowScene.add(this.shadow);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.trailPositions, 3));
    geometry.setAttribute('age', new THREE.BufferAttribute(this.trailAges, 1));
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uPx: { value: Math.max(1, window.devicePixelRatio || 1) } },
      vertexShader: `
        attribute float age;
        varying float vAge;
        uniform float uPx;
        void main() {
          vAge = age;
          gl_Position = projectionMatrix * vec4(position, 1.0);
          gl_PointSize = (5.0 + age * 18.0) * uPx;
        }`,
      fragmentShader: `
        varying float vAge;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          if (d > 0.5) discard;
          float a = (1.0 - vAge) * 0.5 * (1.0 - d * 2.0);
          gl_FragColor = vec4(vec3(1.0), a);
        }`,
    });
    this.trail = new THREE.Points(geometry, material);
    this.trail.frustumCulled = false;
    this.trailScene.add(this.trail);
  }

  private disposeScene() {
    this.renderer?.dispose();
    this.renderer = null;
    this.plane = null;
    this.shadow = null;
    this.trail = null;
    this.planeScene.clear();
    this.shadowScene.clear();
    this.trailScene.clear();
  }

  private renderScene(args: maplibregl.CustomRenderMethodInput) {
    if (!this.renderer || !this.plane || !this.shadow || !this.trail) return;
    const main = new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix as unknown as number[]);
    const { lng, lat, heading, altitude } = this.state;
    const here = maplibregl.MercatorCoordinate.fromLngLat([lng, lat], 0);
    const unit = here.meterInMercatorCoordinateUnits();
    const h = THREE.MathUtils.degToRad(heading);

    // Model basis: +X -> right of heading, +Y -> up, +Z -> backwards (world frame: east, south, up)
    const basis = new THREE.Matrix4().makeBasis(
      new THREE.Vector3(Math.cos(h), Math.sin(h), 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(-Math.sin(h), Math.cos(h), 0),
    );
    const scale = unit * this.profile.scale;

    this.renderer.resetState();

    // Ground shadow (smaller & lighter the higher we are)
    const shadowMatrix = new THREE.Matrix4()
      .makeTranslation(here.x, here.y, unit * 0.6)
      .multiply(basis)
      .multiply(new THREE.Matrix4().makeScale(scale, scale, scale));
    this.camera.projectionMatrix = main.clone().multiply(shadowMatrix);
    this.renderer.render(this.shadowScene, this.camera);

    // Contrail
    const anchor = maplibregl.MercatorCoordinate.fromLngLat([this.anchor.lng, this.anchor.lat], 0);
    const anchorUnit = anchor.meterInMercatorCoordinateUnits();
    const trailMatrix = new THREE.Matrix4()
      .makeTranslation(anchor.x, anchor.y, 0)
      .multiply(new THREE.Matrix4().makeScale(anchorUnit, anchorUnit, anchorUnit));
    this.camera.projectionMatrix = main.clone().multiply(trailMatrix);
    this.renderer.render(this.trailScene, this.camera);

    // Plane: bank (roll about the nose axis) and pitch (about the wings)
    const attitude = new THREE.Matrix4()
      .makeRotationZ(-this.roll)
      .multiply(new THREE.Matrix4().makeRotationX(this.pitchTilt));
    const planeMatrix = new THREE.Matrix4()
      .makeTranslation(here.x, here.y, unit * altitude)
      .multiply(basis)
      .multiply(new THREE.Matrix4().makeScale(scale, scale, scale))
      .multiply(attitude);
    this.camera.projectionMatrix = main.clone().multiply(planeMatrix);
    this.plane.animate(this.spin, this.elapsed, Math.min(1, this.state.speed / this.profile.maxSpeed));
    this.renderer.render(this.planeScene, this.camera);
  }

  private tick = (now: number) => {
    if (!this.running) return;
    const dt = Math.min(0.05, Math.max(0.001, (now - this.last) / 1000));
    this.last = now;
    this.elapsed += dt;
    this.update(dt);
    this.raf = requestAnimationFrame(this.tick);
  };

  private update(dt: number) {
    const state = this.state;
    const profile = this.profile;
    const isHeli = profile.kind === 'heli';
    const frozen = this.paused;

    // Throttle + boost
    let target = state.speed;
    if (this.input.throttle !== 0) target = state.speed + this.input.throttle * profile.maxSpeed * 0.5 * dt;
    const cap = this.input.boost ? profile.maxSpeed : profile.maxSpeed * 0.6;
    target = Math.min(cap, Math.max(profile.minSpeed, target));
    if (!this.input.boost && state.speed > cap) target = Math.max(cap, state.speed - profile.maxSpeed * dt);
    state.speed += (target - state.speed) * Math.min(1, dt * 5);

    // Turning (helicopters can pirouette even when hovering)
    const desiredTurn = frozen ? 0 : this.input.turn;
    state.turn += (desiredTurn - state.turn) * Math.min(1, dt * 5.5);
    if (!frozen) state.heading = (state.heading + profile.turnRate * state.turn * dt + 360) % 360;

    // Climb / descend
    state.vertical += ((frozen ? 0 : this.input.climb) - state.vertical) * Math.min(1, dt * 4);
    if (!frozen) {
      state.altitude = THREE.MathUtils.clamp(
        state.altitude + state.vertical * profile.climbRate * dt,
        profile.minAltitude,
        profile.maxAltitude,
      );
    }

    // Move
    if (!frozen) {
      const meters = state.speed * dt;
      const rad = THREE.MathUtils.degToRad(state.heading);
      state.lat += (Math.cos(rad) * meters) / 111_320;
      state.lng += (Math.sin(rad) * meters) / (111_320 * Math.max(0.2, Math.cos(THREE.MathUtils.degToRad(state.lat))));
    }

    // Attitude: bank into turns, nose up/down with the climb; helicopters lean forward with speed
    this.roll += (state.turn * profile.bank - this.roll) * Math.min(1, dt * 6);
    this.prevSpeed = state.speed;
    const atLimit = (state.altitude <= profile.minAltitude && this.input.climb < 0)
      || (state.altitude >= profile.maxAltitude && this.input.climb > 0);
    const climbPitch = atLimit ? 0 : state.vertical * (isHeli ? 0.1 : 0.3);
    const forwardLean = isHeli ? -0.22 * Math.min(1, state.speed / profile.maxSpeed) : 0;
    this.pitchTilt += (climbPitch + forwardLean - this.pitchTilt) * Math.min(1, dt * 4);
    this.spin += dt * (isHeli ? 34 : 22 + state.speed * 0.12);

    // Contrail (planes only)
    this.trailTimer += dt;
    if (!isHeli && this.trailTimer > 0.035 && !frozen) {
      this.trailTimer = 0;
      this.pushTrailPoint();
    }
    this.ageTrail(dt);

    // Camera: chase with lag, zoom out a little with speed and altitude
    this.cameraBearing += angleDiff(state.heading, this.cameraBearing) * Math.min(1, dt * 2.6);
    const speedZoom = Math.log2(Math.max(0.5, state.speed / profile.cruise)) * 0.5;
    const altitudeZoom = Math.log2(Math.max(0.3, state.altitude / profile.altitude)) * 0.45;
    const targetZoom = (isHeli ? 16.7 : 16.1) - speedZoom - altitudeZoom + this.userZoom;
    this.cameraZoom += (targetZoom - this.cameraZoom) * Math.min(1, dt * 2.5);
    const height = this.map.getContainer().clientHeight || 700;
    this.map.jumpTo({
      center: [state.lng, state.lat],
      bearing: (this.cameraBearing + 360) % 360,
      pitch: Math.min(this.map.getMaxPitch?.() ?? 60, 56),
      zoom: this.cameraZoom,
      padding: { top: Math.round(height * 0.4), bottom: 0, left: 0, right: 0 },
    });

    this.options.onFrame?.({ ...state });
    this.map.triggerRepaint();
  }

  private pushTrailPoint() {
    const { lng, lat, heading, altitude } = this.state;
    const rad = THREE.MathUtils.degToRad(heading);
    const toMeters = (value: number, origin: number, isLng: boolean) =>
      (value - origin) * 111_320 * (isLng ? Math.cos(THREE.MathUtils.degToRad(this.anchor.lat)) : 1);
    const east = toMeters(lng, this.anchor.lng, true);
    const north = toMeters(lat, this.anchor.lat, false);
    // Tail sits ~45 m behind the plane
    const back = 45;
    const x = east - Math.sin(rad) * back;
    const y = -(north - Math.cos(rad) * back); // y points south in the world frame

    // shift ring buffer
    this.trailPositions.copyWithin(3, 0, (TRAIL_POINTS - 1) * 3);
    this.trailAges.copyWithin(1, 0, TRAIL_POINTS - 1);
    this.trailPositions[0] = x;
    this.trailPositions[1] = y;
    this.trailPositions[2] = altitude - 4;
    this.trailAges[0] = 0;
    this.trailCount = Math.min(TRAIL_POINTS, this.trailCount + 1);
    this.trail?.geometry.setDrawRange(0, this.trailCount);

    // keep numbers small: re-anchor when far away
    if (Math.abs(x) > 6000 || Math.abs(y) > 6000) {
      this.anchor = { lng, lat };
      this.trailCount = 0;
    }
  }

  private ageTrail(dt: number) {
    if (!this.trail || this.trailCount === 0) return;
    for (let i = 0; i < this.trailCount; i += 1) {
      this.trailAges[i] = Math.min(1, this.trailAges[i] + dt * 0.55);
    }
    (this.trail.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.trail.geometry.getAttribute('age') as THREE.BufferAttribute).needsUpdate = true;
  }
}
