import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as maplibregl from 'maplibre-gl';
import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, Globe, MousePointerClick, X, Zap } from 'lucide-react';
import type { Business } from '../types';
import type { FlightState, PlaneFlight } from '../flight/PlaneFlight';

const NEARBY_METERS = 230;
const FLYOVER_METERS = 140;

interface FlightModeProps {
  map: maplibregl.Map;
  businesses: Business[];
  selectedBusiness: Business | null;
  onSelectBusiness: (business: Business) => void;
  onExit: () => void;
}

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const dLat = (lat2 - lat1) * 111_320;
  const dLng = (lng2 - lng1) * 111_320 * Math.cos((lat1 * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

function bearingTo(lat1: number, lng1: number, lat2: number, lng2: number) {
  const dy = lat2 - lat1;
  const dx = (lng2 - lng1) * Math.cos((lat1 * Math.PI) / 180);
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
}

const HELP_KEY = 'scoutly-flight-help-seen';

export default function FlightMode({ map, businesses, selectedBusiness, onSelectBusiness, onExit }: FlightModeProps) {
  const engineRef = useRef<PlaneFlight | null>(null);
  const stateRef = useRef<FlightState | null>(null);
  const businessesRef = useRef(businesses);
  businessesRef.current = businesses;
  const selectedRef = useRef(selectedBusiness);
  selectedRef.current = selectedBusiness;
  const nearestRef = useRef<Business | null>(null);
  const flownRef = useRef<Set<string>>(new Set());
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const touchRef = useRef({ left: false, right: false, up: false, down: false, boost: false });

  const [hud, setHud] = useState({ speed: 0, heading: 0, nearest: null as Business | null, distance: 0, relative: 0 });
  const [flown, setFlown] = useState({ total: 0, opportunities: 0 });
  const [loadError, setLoadError] = useState(false);
  const [showHelp, setShowHelp] = useState(() => {
    try { return localStorage.getItem(HELP_KEY) !== '1'; } catch { return true; }
  });

  const exit = useCallback(() => onExit(), [onExit]);

  // Hide floating app widgets (e.g. the credit pill) that would overlap the flight HUD
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = 'button[data-credit-pill],[data-credit-pill]{display:none!important}';
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  const syncInput = useCallback(() => {
    const keys = keysRef.current;
    const touch = touchRef.current;
    const left = keys.has('ArrowLeft') || keys.has('a') || touch.left;
    const right = keys.has('ArrowRight') || keys.has('d') || touch.right;
    const up = keys.has('ArrowUp') || keys.has('w') || touch.up;
    const down = keys.has('ArrowDown') || keys.has('s') || touch.down;
    engineRef.current?.setInput({
      turn: (right ? 1 : 0) - (left ? 1 : 0),
      throttle: (up ? 1 : 0) - (down ? 1 : 0),
      boost: keys.has('Shift') || touch.boost,
    });
  }, []);

  const interact = useCallback(() => {
    const target = nearestRef.current;
    if (target) onSelectBusiness(target);
  }, [onSelectBusiness]);

  // Engine lifecycle (three.js is loaded lazily, only when someone actually flies)
  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    (async () => {
      try {
        const { PlaneFlight: Engine } = await import('../flight/PlaneFlight');
        if (cancelled) return;
        const engine = new Engine(map, { onFrame: (state) => { stateRef.current = state; } });
        engineRef.current = engine;
        const center = map.getCenter();
        engine.start(center.lng, center.lat, map.getBearing());
        syncInput();

        timer = window.setInterval(() => {
          const state = stateRef.current;
          if (!state) return;
          let best: Business | null = null;
          let bestDistance = Infinity;
          for (const business of businessesRef.current) {
            const c = business.coordinates;
            if (!c) continue;
            const d = distanceMeters(state.lat, state.lng, c.lat, c.lng);
            if (d < bestDistance) { best = business; bestDistance = d; }
            if (d < FLYOVER_METERS && !flownRef.current.has(business.id)) {
              flownRef.current.add(business.id);
              setFlown((current) => ({
                total: current.total + 1,
                opportunities: current.opportunities + (business.website ? 0 : 1),
              }));
            }
          }
          const near = best && bestDistance <= NEARBY_METERS ? best : null;
          nearestRef.current = near;
          setHud({
            speed: Math.round(state.speed * 3.6),
            heading: Math.round(state.heading),
            nearest: near,
            distance: Math.round(bestDistance),
            relative: near ? ((bearingTo(state.lat, state.lng, near.coordinates.lat, near.coordinates.lng) - state.heading + 540) % 360) - 180 : 0,
          });
        }, 120);
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      engineRef.current?.stop();
      engineRef.current = null;
      markerRef.current?.remove();
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Pause while a business card is open; resume when it closes
  useEffect(() => {
    engineRef.current?.setPaused(Boolean(selectedBusiness));
  }, [selectedBusiness]);

  // Highlight ring around the nearest business
  useEffect(() => {
    const target = hud.nearest;
    if (!target) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (!markerRef.current) {
      const element = document.createElement('div');
      element.className = 'flight-ring';
      markerRef.current = new maplibregl.Marker({ element }).setLngLat([target.coordinates.lng, target.coordinates.lat]).addTo(map);
    } else {
      markerRef.current.setLngLat([target.coordinates.lng, target.coordinates.lat]);
    }
  }, [hud.nearest, map]);

  // Keyboard
  useEffect(() => {
    const typing = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null;
      return Boolean(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable));
    };
    const normalize = (key: string) => (key.length === 1 ? key.toLowerCase() : key);
    const onDown = (event: KeyboardEvent) => {
      if (typing(event)) return;
      const key = normalize(event.key);
      if (key === 'Escape') { exit(); return; }
      if (key === ' ' || key === 'Enter' || key === 'e') {
        event.preventDefault();
        if (!event.repeat) interact();
        return;
      }
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's', 'Shift'].includes(key)) {
        event.preventDefault();
        keysRef.current.add(key);
        syncInput();
      }
    };
    const onUp = (event: KeyboardEvent) => {
      keysRef.current.delete(normalize(event.key));
      syncInput();
    };
    const onBlur = () => { keysRef.current.clear(); syncInput(); };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [exit, interact, syncInput]);

  useEffect(() => {
    if (!showHelp) return undefined;
    const timer = window.setTimeout(() => {
      setShowHelp(false);
      try { localStorage.setItem(HELP_KEY, '1'); } catch { /* ignore */ }
    }, 9000);
    return () => window.clearTimeout(timer);
  }, [showHelp]);

  const holdProps = (name: 'left' | 'right' | 'up' | 'down' | 'boost') => ({
    onPointerDown: (event: React.PointerEvent) => {
      event.preventDefault();
      (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
      touchRef.current[name] = true;
      syncInput();
    },
    onPointerUp: () => { touchRef.current[name] = false; syncInput(); },
    onPointerCancel: () => { touchRef.current[name] = false; syncInput(); },
    onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
  });

  const compass = useMemo(() => ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'][Math.round(hud.heading / 45) % 8], [hud.heading]);
  const arrowRotation = hud.relative;

  const padButton = 'flex h-16 w-16 select-none items-center justify-center rounded-2xl border border-white/15 bg-black/55 text-white shadow-lg backdrop-blur-md active:scale-95 active:bg-[#ff5a12]/80 touch-none';

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[200] font-sans" data-flight-hud>
      <style>{`
        .flight-ring{width:74px;height:74px;border-radius:50%;border:3px solid #ff7a45;box-shadow:0 0 0 6px rgba(255,90,18,.18),0 0 28px rgba(255,90,18,.65);animation:flightPulse 1.2s ease-in-out infinite;pointer-events:none}
        @keyframes flightPulse{0%,100%{transform:scale(.82);opacity:.95}50%{transform:scale(1.12);opacity:.55}}
      `}</style>

      {/* Top bar */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 flex items-start justify-between gap-3 p-4">
        <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-white/10 bg-black/60 px-3.5 py-2.5 text-white shadow-xl backdrop-blur-md">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ff5a12]"><Globe className="h-4 w-4" /></span>
          <div className="leading-tight">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#ff955f]">Modo voo</p>
            <p className="text-[11px] text-white/65">
              {flown.total} sobrevoada{flown.total === 1 ? '' : 's'}
              {flown.opportunities > 0 && <span className="text-emerald-300"> · {flown.opportunities} sem site</span>}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={exit}
          className="pointer-events-auto flex h-11 items-center gap-2 rounded-2xl border border-white/15 bg-black/60 px-4 text-xs font-semibold text-white shadow-xl backdrop-blur-md hover:bg-white/10"
        >
          <X className="h-4 w-4" /> Sair <kbd className="ml-1 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/70">Esc</kbd>
        </button>
      </div>

      {/* Help */}
      {showHelp && !loadError && (
        <div className="pointer-events-none absolute left-1/2 top-24 hidden -translate-x-1/2 rounded-2xl border border-white/10 bg-black/70 px-5 py-3 text-center text-[12px] text-white/85 shadow-2xl backdrop-blur-md md:block">
          <span className="font-semibold text-white">← →</span> ou <span className="font-semibold text-white">A D</span> para virar ·{' '}
          <span className="font-semibold text-white">↑ ↓</span> para acelerar ·{' '}
          <span className="font-semibold text-white">Shift</span> turbo ·{' '}
          <span className="font-semibold text-white">Espaço</span> abre a empresa mais próxima
        </div>
      )}

      {loadError && (
        <div className="pointer-events-auto absolute left-1/2 top-24 -translate-x-1/2 rounded-2xl border border-red-400/30 bg-black/80 px-5 py-3 text-sm text-red-200">
          Não foi possível carregar o modo voo. Atualize a página e tente novamente.
        </div>
      )}

      {/* Nearby business card */}
      {hud.nearest && (
        <div className="pointer-events-auto absolute bottom-28 left-1/2 w-[min(92vw,380px)] -translate-x-1/2 md:bottom-8">
          <button
            type="button"
            onClick={interact}
            className="group flex w-full items-center gap-3 rounded-2xl border border-[#ff7a45]/40 bg-black/75 p-3.5 text-left text-white shadow-2xl backdrop-blur-md transition hover:border-[#ff7a45]"
          >
            <span className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-[#ff5a12]/15 text-[#ff955f]">
              <ArrowUpIcon rotation={arrowRotation} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-bold">{hud.nearest.name}</span>
              <span className="mt-0.5 flex items-center gap-2 text-[11px] text-white/60">
                <span className="truncate">{hud.nearest.category}</span>
                <span>· {hud.distance} m</span>
                {!hud.nearest.website && <span className="rounded bg-emerald-400/15 px-1.5 py-0.5 font-semibold text-emerald-300">Sem site</span>}
              </span>
            </span>
            <span className="flex flex-none items-center gap-1.5 rounded-lg bg-[#ff5a12] px-2.5 py-1.5 text-[11px] font-bold">
              <MousePointerClick className="h-3.5 w-3.5" /> Abrir
              <kbd className="hidden rounded bg-white/20 px-1 text-[10px] md:inline">Espaço</kbd>
            </span>
          </button>
        </div>
      )}

      {/* Instruments */}
      <div className="pointer-events-none absolute bottom-6 left-4 hidden items-center gap-3 rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-white shadow-xl backdrop-blur-md md:flex">
        <div className="text-center">
          <p className="text-2xl font-extrabold tabular-nums leading-none">{hud.speed}</p>
          <p className="mt-1 text-[10px] uppercase tracking-wider text-white/50">km/h</p>
        </div>
        <div className="h-8 w-px bg-white/10" />
        <div className="text-center">
          <p className="text-2xl font-extrabold tabular-nums leading-none">{compass}</p>
          <p className="mt-1 text-[10px] uppercase tracking-wider text-white/50">{hud.heading}°</p>
        </div>
      </div>

      {/* Touch controls */}
      <div className="pointer-events-none absolute bottom-6 left-4 right-4 flex items-end justify-between md:hidden">
        <div className="pointer-events-auto flex gap-3">
          <button type="button" aria-label="Virar à esquerda" className={padButton} {...holdProps('left')}><ArrowLeft className="h-7 w-7" /></button>
          <button type="button" aria-label="Virar à direita" className={padButton} {...holdProps('right')}><ArrowRight className="h-7 w-7" /></button>
        </div>
        <div className="pointer-events-auto flex gap-3">
          <button type="button" aria-label="Turbo" className={padButton} {...holdProps('boost')}><Zap className="h-7 w-7" /></button>
          <div className="flex flex-col gap-2">
            <button type="button" aria-label="Acelerar" className={`${padButton} !h-[30px] !rounded-xl`} {...holdProps('up')}><ChevronUp className="h-5 w-5" /></button>
            <button type="button" aria-label="Desacelerar" className={`${padButton} !h-[30px] !rounded-xl`} {...holdProps('down')}><ChevronDown className="h-5 w-5" /></button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ArrowUpIcon({ rotation }: { rotation: number }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" style={{ transform: `rotate(${rotation}deg)`, transition: 'transform .15s linear' }} fill="currentColor" aria-hidden>
      <path d="M12 2 4.5 21l7.5-4.4 7.5 4.4z" />
    </svg>
  );
}
