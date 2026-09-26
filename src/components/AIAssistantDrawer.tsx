import { useEffect, useState } from 'react';
import { LockKeyhole, Sparkles, X } from 'lucide-react';
import AIAssistantDrawerUnlocked from './AIAssistantDrawerUnlocked';
import { fetchCreditState, openPlansForLockedFeature, type CreditState } from '../services/entitlements';

type Props = React.ComponentProps<typeof AIAssistantDrawerUnlocked>;

export default function AIAssistantDrawer(props: Props) {
  const [state, setState] = useState<CreditState | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!props.isOpen) return;
    setLoading(true);
    void fetchCreditState()
      .then(setState)
      .finally(() => setLoading(false));
  }, [props.isOpen]);

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<CreditState>).detail;
      if (detail?.plan) setState(detail);
    };
    window.addEventListener('scoutly-entitlements-changed', listener);
    return () => window.removeEventListener('scoutly-entitlements-changed', listener);
  }, []);

  if (!props.isOpen) return null;
  if (state && state.plan !== 'free') return <AIAssistantDrawerUnlocked {...props} />;

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-[2px]" onClick={props.onClose} />
      <aside className="fixed inset-y-0 right-0 z-[90] flex w-full flex-col border-l border-white/[0.08] bg-[#0b0e12] shadow-2xl sm:w-[420px]">
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
          <div className="flex items-center gap-2.5"><Sparkles className="h-4 w-4 text-[#FF6A26]" /><span className="text-[13px] font-semibold text-white">Scoutly AI</span></div>
          <button type="button" onClick={props.onClose} className="rounded-xl p-2 text-stone-500 hover:bg-white/[0.06] hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-sm text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-[#FF5A12]/20 bg-[#FF5A12]/[0.08] text-[#FF6A26]"><LockKeyhole className="h-5 w-5" /></div>
            <h3 className="mt-5 text-[18px] font-semibold text-white">Scoutly AI é um recurso pago</h3>
            <p className="mt-2 text-[11px] leading-relaxed text-stone-400">
              O plano Go inclui 10 conversas com a IA por dia. Pro e Agency oferecem acesso ampliado aos recursos inteligentes.
            </p>
            <button type="button" disabled={loading} onClick={() => openPlansForLockedFeature('free_ai')} className="mt-5 w-full rounded-xl bg-[#FF5A12] px-4 py-3 text-[11px] font-semibold text-white hover:bg-[#ff6a27] disabled:opacity-60">
              Ver planos
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
