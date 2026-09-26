import { useEffect, useState } from 'react';
import { Lock, Sparkles, X } from 'lucide-react';
import { Business, LeadStatus } from '../types';
import AIAssistantDrawerBase from './AIAssistantDrawerBase';
import { CreditAccessStatus, fetchAccessStatus } from '../services/api';

interface AIAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  businesses: Business[];
  currentRegionName: string;
  onSelectBusiness: (business: Business) => void;
  onUpdateLeadStatus: (businessId: string, status: LeadStatus) => void;
  onApplyNewRegion?: (region: {
    name: string;
    center: { lat: number; lng: number };
    businesses?: Business[];
  }) => void;
}

export default function AIAssistantDrawer(props: AIAssistantDrawerProps) {
  const { isOpen, onClose } = props;
  const [access, setAccess] = useState<CreditAccessStatus | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    fetchAccessStatus()
      .then((result) => {
        if (!cancelled) setAccess(result);
      })
      .catch(() => {
        if (!cancelled) setAccess(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    const onAccess = (event: Event) => {
      const detail = (event as CustomEvent<CreditAccessStatus>).detail;
      if (detail?.plan) setAccess(detail);
    };
    window.addEventListener('scoutly-access-updated', onAccess);
    return () => window.removeEventListener('scoutly-access-updated', onAccess);
  }, []);

  if (!isOpen) return <AIAssistantDrawerBase {...props} />;

  if (!loading && access && access.plan !== 'free') {
    return <AIAssistantDrawerBase {...props} />;
  }

  return (
    <div className="fixed inset-y-0 right-0 z-[90] flex w-full max-w-[430px] flex-col border-l border-white/[0.08] bg-[#0d1013]/[0.99] text-white shadow-[-24px_0_80px_rgba(0,0,0,0.48)] backdrop-blur-2xl pointer-events-auto">
      <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#FF5A12]/20 bg-[#FF5A12]/[0.10] text-[#FF6A26]"><Sparkles className="h-4 w-4" /></span>
          <div><p className="text-sm font-semibold">Scoutly AI</p><p className="text-[10px] text-stone-500">Assistente de prospecção</p></div>
        </div>
        <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-stone-500 hover:text-white" aria-label="Fechar"><X className="h-4 w-4" /></button>
      </div>

      <div className="flex flex-1 items-center justify-center px-7 text-center">
        {loading ? (
          <div>
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-white/[0.10] border-t-[#FF5A12]" />
            <p className="mt-4 text-xs text-stone-500">Verificando seu plano…</p>
          </div>
        ) : (
          <div className="max-w-sm">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[#FF5A12]/20 bg-[#FF5A12]/[0.08] text-[#FF6A26]"><Lock className="h-5 w-5" /></span>
            <h3 className="mt-5 text-lg font-semibold tracking-tight">Scoutly AI é um recurso pago</h3>
            <p className="mt-2 text-sm leading-relaxed text-stone-500">No Free você pode buscar empresas, usar seus créditos, favoritos e pipeline. O plano Go libera 10 conversas com a IA por dia.</p>
            <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('scoutly-open-plans'))} className="mt-6 rounded-xl bg-[#FF5A12] px-5 py-3 text-xs font-semibold text-white hover:bg-[#ff6a27]">Ver planos</button>
          </div>
        )}
      </div>
    </div>
  );
}
