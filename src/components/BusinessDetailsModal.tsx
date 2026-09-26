import { useEffect, useState } from 'react';
import { LockKeyhole, Mail, Phone, ShieldCheck, Star, X } from 'lucide-react';
import type { Business, LeadStatus } from '../types';
import { openPlansForLockedFeature, unlockBusiness } from '../services/entitlements';
import BusinessDetailsModalUnlocked from './BusinessDetailsModalUnlocked';

interface BusinessDetailsModalProps {
  business: Business | null;
  onClose: () => void;
  onUpdateStatus?: (id: string, status: LeadStatus, notes?: string) => void;
  onToggleFavorite?: (business: Business) => void;
}

export default function BusinessDetailsModal(props: BusinessDetailsModalProps) {
  const { business, onClose, onUpdateStatus, onToggleFavorite } = props;
  const [resolved, setResolved] = useState<Business | null>(business);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setResolved(business);
    setError('');
  }, [business?.id, business?.isLocked, business?.unlockToken]);

  if (!resolved) return null;

  if (!resolved.isLocked) {
    return (
      <BusinessDetailsModalUnlocked
        business={resolved}
        onClose={onClose}
        onUpdateStatus={onUpdateStatus}
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
        openPlansForLockedFeature('details_credit_limit');
      } else {
        setError(err?.message || 'Não foi possível liberar os dados.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="w-full max-w-xl overflow-hidden rounded-[24px] border border-white/[0.10] bg-[#0d1014] shadow-[0_30px_100px_rgba(0,0,0,.6)]" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] px-5 py-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-[18px] font-semibold text-white">{resolved.name}</h2>
              <button type="button" onClick={() => onToggleFavorite?.(resolved)} className={resolved.isFavorite ? 'text-[#FF6A26]' : 'text-stone-500 hover:text-white'}>
                <Star className={`h-4 w-4 ${resolved.isFavorite ? 'fill-current' : ''}`} />
              </button>
            </div>
            <p className="mt-1 text-[10px] text-stone-500">{resolved.address}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-stone-500 hover:bg-white/[0.06] hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-5">
          <div className="rounded-2xl border border-[#FF5A12]/20 bg-[#FF5A12]/[0.055] p-4">
            <div className="flex items-center gap-2 text-[#FF8A52]"><LockKeyhole className="h-4 w-4" /><span className="text-[10px] font-semibold uppercase tracking-[0.12em]">Recurso Pro</span></div>
            <p className="mt-2.5 text-[14px] font-semibold text-white">Use 1 crédito para ver os dados reais</p>
            <p className="mt-1 text-[10px] leading-relaxed text-stone-400">O conteúdo borrado abaixo é apenas uma prévia visual. E-mail, telefone e demais dados reais não foram enviados para o navegador.</p>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {[{ icon: <Mail className="h-4 w-4" />, label: 'E-mail', fake: 'contato@empresa.com.br' }, { icon: <Phone className="h-4 w-4" />, label: 'Telefone', fake: '(11) 99999-9999' }].map((item) => (
              <button key={item.label} type="button" onClick={() => openPlansForLockedFeature('blurred_contact')} className="relative flex items-center gap-3 rounded-xl border border-white/[0.08] bg-[#111418] p-3 text-left">
                <span className="text-stone-500">{item.icon}</span>
                <div className="min-w-0 flex-1"><span className="block text-[8px] uppercase tracking-wider text-stone-600">{item.label}</span><span className="mt-1 block select-none truncate text-[10px] text-stone-400 blur-[4px]">{item.fake}</span></div>
                <LockKeyhole className="h-3.5 w-3.5 text-[#FF6A26]" />
              </button>
            ))}
          </div>

          <button type="button" onClick={() => void handleUnlock()} disabled={loading} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF5A12] px-4 py-3 text-[11px] font-semibold text-white hover:bg-[#ff6a27] disabled:opacity-60">
            <ShieldCheck className="h-4 w-4" /> {loading ? 'Desbloqueando…' : 'Usar 1 crédito'}
          </button>
          <button type="button" onClick={() => openPlansForLockedFeature('locked_details_upgrade')} className="mt-2 w-full rounded-xl border border-white/[0.09] bg-white/[0.03] px-4 py-3 text-[10px] font-semibold text-stone-300 hover:border-[#FF5A12]/30">Ver planos</button>
          {error && <p className="mt-3 text-center text-[10px] text-rose-400">{error}</p>}
        </div>
      </div>
    </div>
  );
}
