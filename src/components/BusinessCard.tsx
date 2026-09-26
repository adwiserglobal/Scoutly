import { memo, useState } from 'react';
import { Building2, LockKeyhole, MapPin, Star } from 'lucide-react';
import type { Business } from '../types';
import { translateCategory } from '../utils/categoryTranslator';
import { openPlansForLockedFeature, unlockBusiness } from '../services/entitlements';
import BusinessCardBase from './BusinessCardBase';

interface BusinessCardProps {
  business: Business;
  index?: number;
  isSelected: boolean;
  onSelect: () => void;
  onOpenDetails: (business: Business) => void;
  onToggleFavorite?: (business: Business) => void;
}

function shortLocation(business: Business): string {
  const parts = (business.address || '').split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 2];
  return parts[0] || 'Localização disponível';
}

function LockedBusinessCard({ business, onOpenDetails, onToggleFavorite }: BusinessCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const open = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const result = await unlockBusiness(business);
      onOpenDetails(result.business);
    } catch (err: any) {
      const code = String(err?.code || '');
      if (code.includes('CREDIT_LIMIT') || err?.status === 429) {
        openPlansForLockedFeature('business_credit_limit');
      } else {
        setError(err?.message || 'Não foi possível abrir este negócio.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <article
      id={`card-${business.id}`}
      onClick={() => void open()}
      className="group cursor-pointer rounded-[18px] border border-white/[0.085] bg-[#17191c]/95 px-4 py-3.5 transition hover:border-[#FF5A12]/30 hover:bg-[#1b1d20]"
    >
      <div className="flex items-start gap-3.5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] border border-white/[0.08] bg-[#111315] text-stone-400 sm:h-14 sm:w-14">
          <Building2 className="h-5 w-5" strokeWidth={1.7} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[14px] font-semibold text-white sm:text-[15px]">{business.name}</h3>
              <p className="mt-0.5 truncate text-[10.5px] text-stone-400">{translateCategory(business.category)}</p>
            </div>
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); onToggleFavorite?.(business); }}
              className={`flex h-8 w-8 items-center justify-center rounded-xl transition ${business.isFavorite ? 'bg-[#FF5A12]/12 text-[#FF6A26]' : 'text-stone-500 hover:bg-white/[0.06] hover:text-white'}`}
              title={business.isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            >
              <Star className={`h-4 w-4 ${business.isFavorite ? 'fill-current' : ''}`} />
            </button>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-stone-500">
            <MapPin className="h-3 w-3" />
            <span className="truncate">{shortLocation(business)}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/[0.07] pt-3">
        <div className="relative overflow-hidden rounded-xl border border-white/[0.07] bg-[#101216] px-3 py-2.5">
          <span className="block text-[8px] uppercase tracking-[0.1em] text-stone-600">E-mail</span>
          <span className="mt-1 block select-none truncate text-[10px] text-stone-500 blur-[4px]">contato@empresa.com.br</span>
          <LockKeyhole className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#FF6A26]" />
        </div>
        <div className="relative overflow-hidden rounded-xl border border-white/[0.07] bg-[#101216] px-3 py-2.5">
          <span className="block text-[8px] uppercase tracking-[0.1em] text-stone-600">Contato</span>
          <span className="mt-1 block select-none text-[10px] text-stone-500 blur-[4px]">(11) 99999-9999</span>
          <LockKeyhole className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#FF6A26]" />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-[9.5px] font-semibold text-stone-400">
          <LockKeyhole className="h-3.5 w-3.5 text-[#FF6A26]" />
          Recurso Pro · 1 crédito para abrir
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={(event) => { event.stopPropagation(); void open(); }}
          className="rounded-xl bg-[#FF5A12] px-3 py-2 text-[9.5px] font-semibold text-white transition hover:bg-[#ff6a27] disabled:opacity-60"
        >
          {loading ? 'Abrindo…' : 'Ver dados'}
        </button>
      </div>
      {error && <p className="mt-2 text-[9px] text-rose-400">{error}</p>}
    </article>
  );
}

function BusinessCard(props: BusinessCardProps) {
  if (props.business.isLocked) return <LockedBusinessCard {...props} />;
  return <BusinessCardBase {...props} />;
}

export default memo(BusinessCard);
