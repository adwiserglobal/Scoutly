import React from 'react';
import { MapPin, X, Navigation2, RefreshCw, Layers } from 'lucide-react';
import { formatDistance } from '../utils/geoUtils';

interface PinRadarControlProps {
  active: boolean;
  pinCoordinates: { lat: number; lng: number } | null;
  radiusMeters: number;
  onRadiusChange: (newRadius: number) => void;
  onClearPin: () => void;
  onCenterOnPin: () => void;
  businessesInRadiusCount: number;
  totalBusinessesCount: number;
  filterOnlyInRadius: boolean;
  onToggleFilterOnlyInRadius: () => void;
  isSearching: boolean;
  locationName?: string;
}

const PRESET_RADII = [250, 500, 1000, 2000, 5000];

export const PinRadarControl: React.FC<PinRadarControlProps> = ({
  active,
  pinCoordinates,
  radiusMeters,
  onRadiusChange,
  onClearPin,
  onCenterOnPin,
  businessesInRadiusCount,
  filterOnlyInRadius,
  onToggleFilterOnlyInRadius,
  isSearching,
  locationName,
}) => {
  if (!active || !pinCoordinates) return null;

  return (
    <div
      id="pin-radar-control-panel"
      className="bg-stone-900/90 text-white backdrop-blur-xl p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl border border-white/15 shadow-2xl flex flex-col gap-3 max-w-[340px] sm:max-w-[380px] w-full pointer-events-auto transition-all animate-in fade-in slide-in-from-top-4 duration-300"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center w-7 h-7 rounded-xl bg-[#FF4D00] text-white shadow-md shadow-[#FF4D00]/30 shrink-0">
            <MapPin className="w-4 h-4 animate-bounce" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF4D00] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-bold text-white tracking-wide uppercase">
                Pin de Prospecção
              </h3>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#FF4D00]/20 text-[#FF4D00] border border-[#FF4D00]/30">
                AO VIVO
              </span>
            </div>
            <p className="text-[11px] text-stone-400 line-clamp-1 max-w-[200px]">
              {locationName || `${pinCoordinates.lat.toFixed(5)}, ${pinCoordinates.lng.toFixed(5)}`}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClearPin}
          className="p-1.5 text-stone-400 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
          title="Remover Pin"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Drag instruction notice */}
      <div className="flex items-center gap-2 px-2.5 py-1.5 bg-white/5 rounded-xl border border-white/5 text-[11px] text-stone-300">
        <Layers className="w-3.5 h-3.5 text-[#FF4D00] shrink-0" />
        <span className="line-clamp-1">
          <strong>Arraste o pin</strong> no mapa para mudar de rua em tempo real
        </span>
      </div>

      {/* Radius selector */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-stone-400 font-medium">Raio de Cobertura:</span>
          <span className="text-white font-bold">{formatDistance(radiusMeters)}</span>
        </div>
        <div className="grid grid-cols-5 gap-1">
          {PRESET_RADII.map((r) => {
            const isSelected = radiusMeters === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => onRadiusChange(r)}
                className={`py-1.5 px-1 rounded-xl text-[10px] font-bold transition cursor-pointer text-center ${
                  isSelected
                    ? 'bg-[#FF4D00] text-white shadow-md shadow-[#FF4D00]/30'
                    : 'bg-white/10 text-stone-300 hover:bg-white/20 hover:text-white'
                }`}
              >
                {formatDistance(r)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stats & Actions */}
      <div className="flex items-center justify-between pt-1 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-stone-300 font-semibold text-[11px]">
            {isSearching ? (
              <span className="flex items-center gap-1 text-[#FF4D00]">
                <RefreshCw className="w-3 h-3 animate-spin" /> Buscando...
              </span>
            ) : (
              <span>
                <strong className="text-white font-bold">{businessesInRadiusCount}</strong>{' '}
                {businessesInRadiusCount === 1 ? 'negócio no raio' : 'negócios no raio'}
              </span>
            )}
          </span>
        </div>

        <button
          type="button"
          onClick={onCenterOnPin}
          className="flex items-center gap-1 px-2.5 py-1 bg-white/10 hover:bg-white/20 text-stone-200 hover:text-white rounded-lg text-[10px] font-bold tracking-wider transition cursor-pointer"
          title="Centralizar câmera no Pin"
        >
          <Navigation2 className="w-3 h-3 text-[#FF4D00]" />
          <span>FOCAR</span>
        </button>
      </div>

      {/* Toggle filter strictly to this radius */}
      <label className="flex items-center gap-2 pt-1 border-t border-white/10 text-[11px] text-stone-300 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={filterOnlyInRadius}
          onChange={onToggleFilterOnlyInRadius}
          className="w-3.5 h-3.5 rounded accent-[#FF4D00] cursor-pointer"
        />
        <span>Filtrar lista de empresas apenas dentro deste raio</span>
      </label>
    </div>
  );
};
