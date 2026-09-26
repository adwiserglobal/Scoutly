import { useEffect, useState } from 'react';
import { Building2, LockKeyhole, Mail, MapPin, Phone, ShieldCheck, Star, X } from 'lucide-react';
import type { Business } from '../types';
import { translateCategory } from '../utils/categoryTranslator';
import { openPlansForLockedFeature, unlockBusiness } from '../services/entitlements';
import BusinessSidePanelUnlocked from './BusinessSidePanelUnlocked';

interface BusinessSidePanelProps {
  business: Business;
  onClose: () => void;
  onToggleFavorite?: (business: Business) => void;
}

export default function BusinessSidePanel(props: BusinessSidePanelProps) {
  const { business, onClose, onToggleFavorite } = props;
  const [resolved, setResolved] = useState<Business>(business);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setResolved(business);
    setError('');
  }, [business.id, business.isLocked, business.unlockToken]);

  if (!resolved.isLocked) {
    return (
      <BusinessSidePanelUnlocked
        business={resolved}
        onClose={onClose}
        onToggleFavorite={onToggleFavorite}
      />
    );
  }

  const handleUnlock = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const result = await unlockBusiness(resolved);
      setResolved(result.business);
    } catch (err: any) {
      if (err?.status === 429 || String(err?.code || '').includes('CREDIT_LIMIT')) {
        openPlansForLockedFeature('side_panel_credit_limit');
      } else {
        setError(err?.message || 'Não foi possível liberar os dados.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/[0.42] backdrop-blur-[2px] pointer-events-auto" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-white/[0.08] bg-[#0b0e12]/[0.99] shadow-[0_0_70px_rgba(0,0,0,.45)] pointer-events-auto sm:w-[440px]">
        <div className="border-b border-white/[0.08] bg-[#101318] px-5 py-5">
          <div className="mb-4 h-[3px] w-12 rounded-full bg-[#FF5A12]" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-[18px] font-semibold tracking-tight text-white">{resolved.name}</h2>
                <button
                  type="button"
                  onClick={() => onToggleFavorite?.(resolved)}
                  className={`rounded-lg p-1 transition ${resolved.isFavorite ? 'text-[#FF6A26]' : 'text-stone-500 hover:text-white'}`}
                  title={resolved.isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                >
                  <Star className={`h-4 w-4 ${resolved.isFavorite ? 'fill-current' : ''}`} />
                </button>
              </div>
              <p className="mt-1 text-[11px] font-medium text-stone-300">{translateCategory(resolved.category)}</p>
              <div className="mt-3 flex items-start gap-2 text-[10px] leading-relaxed text-stone-400">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FF6A26]" />
                <span>{resolved.address}</span>
              </div>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl p-2 text-stone-400 hover:bg-white/[0.06] hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6">
          <div className="rounded-2xl border border-[#FF5A12]/20 bg-[#FF5A12]/[0.055] p-4">
            <div className="flex items-center gap-2 text-[#FF8A52]">
              <LockKeyhole className="h-4 w-4" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em]">Dados protegidos</span>
            </div>
            <p className="mt-3 text-[13px] font-semibold text-white">Desbloqueie este negócio por 1 crédito</p>
            <p className="mt-1.5 text-[10px] leading-relaxed text-stone-400">
              Os dados de prospecção reais só são enviados pelo servidor depois da autorização do crédito.
            </p>
          </div>

          <div className="mt-5 space-y-2">
            {[
              { label: 'E-mail', value: 'contato@empresa.com.br', icon: <Mail className="h-4 w-4" /> },
              { label: 'Telefone / WhatsApp', value: '(11) 99999-9999', icon: <Phone className="h-4 w-4" /> },
              { label: 'Website e sinais digitais', value: 'www.empresa.com.br', icon: <Building2 className="h-4 w-4" /> },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => openPlansForLockedFeature('locked_business_field')}
                className="group flex w-full items-center gap-3 rounded-xl border border-white/[0.08] bg-[#111418] px-3.5 py-3 text-left transition hover:border-[#FF5A12]/25"
              >
                <span className="text-stone-500">{item.icon}</span>
                <div className="min-w-0 flex-1">
                  <span className="block text-[9px] text-stone-500">{item.label}</span>
                  <span className="mt-1 block select-none truncate text-[11px] text-stone-400 blur-[4px]">{item.value}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[9px] font-semibold text-[#FF7A3D]">
                  <LockKeyhole className="h-3.5 w-3.5" /> PRO
                </div>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void handleUnlock()}
            disabled={loading}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF5A12] px-4 py-3 text-[11px] font-semibold text-white transition hover:bg-[#ff6a27] disabled:opacity-60"
          >
            <ShieldCheck className="h-4 w-4" />
            {loading ? 'Desbloqueando…' : 'Usar 1 crédito e ver dados'}
          </button>

          <button
            type="button"
            onClick={() => openPlansForLockedFeature('locked_business_upgrade')}
            className="mt-2 w-full rounded-xl border border-white/[0.09] bg-white/[0.03] px-4 py-3 text-[10px] font-semibold text-stone-300 transition hover:border-[#FF5A12]/30 hover:text-white"
          >
            Ver planos e aumentar limites
          </button>

          {error && <p className="mt-3 text-center text-[10px] text-rose-400">{error}</p>}
        </div>
      </aside>
    </>
  );
}
