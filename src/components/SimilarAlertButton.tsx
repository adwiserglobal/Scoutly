import { useState } from 'react';
import { Bell, BellRing, Check, Loader2 } from 'lucide-react';
import { Business } from '../types';
import { createSearchAlert } from '../services/api';
import { translateCategory } from '../utils/categoryTranslator';

const HALF_AREA_DEGREES = 0.12; // ~13 km around the company: its city / metro neighbourhood

function regionLabel(business: Business) {
  const city = business.municipio?.trim();
  if (city) return business.uf ? `${city} - ${business.uf}` : city;
  const parts = String(business.address || '').split(',').map((part) => part.trim()).filter(Boolean);
  return (parts.slice(-3, -1).join(', ') || parts[parts.length - 1] || '').slice(0, 60);
}

/** Bell on the company card: get an email when new companies like this one show up nearby. */
export default function SimilarAlertButton({ business, compact = false }: { business: Business; compact?: boolean }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);

  const category = translateCategory(business.category);
  const lat = Number(business.coordinates?.lat ?? business.latitude);
  const lng = Number(business.coordinates?.lng ?? business.longitude);
  if (!category || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const create = async () => {
    setState('loading');
    setError(null);
    try {
      await createSearchAlert({
        query: category,
        regionName: regionLabel(business),
        bbox: { west: lng - HALF_AREA_DEGREES, east: lng + HALF_AREA_DEGREES, south: lat - HALF_AREA_DEGREES, north: lat + HALF_AREA_DEGREES },
      });
      setState('done');
    } catch (err: any) {
      setState('idle');
      setError({ message: err?.message || 'Não foi possível criar o alerta.', code: err?.code });
    }
  };

  return (
    <div className={compact ? '' : 'mt-3'}>
      <button
        type="button"
        onClick={create}
        disabled={state !== 'idle'}
        className={`flex items-center justify-center gap-2 rounded-xl border text-[12px] font-semibold transition ${compact ? 'h-9 px-3.5' : 'h-11 w-full'} ${
          state === 'done'
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
            : 'border-white/[0.12] bg-[#1b1e23] text-[#e8eaee] hover:border-[#FF5A12]/40 hover:bg-[#20252b]'
        }`}
        title={`Avisar por e-mail quando abrir ${category} semelhante perto daqui`}
      >
        {state === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : state === 'done' ? <Check className="h-4 w-4" /> : <BellRing className="h-4 w-4 text-[#FF6A26]" />}
        {state === 'done' ? 'Alerta criado: você será avisado por e-mail' : 'Avisar de empresas semelhantes'}
      </button>
      {error && (
        <p className="mt-1.5 text-[11px] leading-relaxed text-rose-300">
          {error.message}
          {error.code === 'ALERT_LIMIT' && (
            <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('scoutly-open-plans'))} className="ml-1.5 font-bold text-[#FF8A55] hover:underline">
              Ver planos
            </button>
          )}
        </p>
      )}
    </div>
  );
}
