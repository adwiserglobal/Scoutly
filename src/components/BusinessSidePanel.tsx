import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Lock, Mail, MapPin, Phone, Star, X } from 'lucide-react';
import { Business } from '../types';
import BusinessSidePanelBase from './BusinessSidePanelBase';
import { getGoogleBusinessLink, unlockBusinessContact } from '../services/api';

interface BusinessSidePanelProps {
  business: Business;
  onClose: () => void;
  onToggleFavorite?: (business: Business) => void;
}

type UnlockResult = Awaited<ReturnType<typeof unlockBusinessContact>>;
const inFlightUnlocks = new Map<string, Promise<UnlockResult>>();

function unlockOnce(business: any) {
  const key = String(business?.sealedContactToken || business?.id || '');
  const existing = inFlightUnlocks.get(key);
  if (existing) return existing;
  const request = unlockBusinessContact(business);
  inFlightUnlocks.set(key, request);
  void request.finally(() => window.setTimeout(() => inFlightUnlocks.delete(key), 1200));
  return request;
}

function openPlans() {
  window.dispatchEvent(new CustomEvent('scoutly-open-plans'));
}

function refreshAccess() {
  window.dispatchEvent(new CustomEvent('scoutly-access-updated'));
}

function LockedPanel({
  business,
  onClose,
  onToggleFavorite,
  message,
}: BusinessSidePanelProps & { message: string }) {
  const raw = business as any;
  return (
    <aside className="fixed inset-y-0 right-0 z-[85] flex w-full max-w-[390px] flex-col border-l border-white/[0.08] bg-[#0d1013]/[0.98] text-white shadow-[-24px_0_70px_rgba(0,0,0,0.42)] backdrop-blur-2xl pointer-events-auto">
      <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] px-5 py-5">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#FF6A26]">Negócio</p>
          <h2 className="mt-1 truncate text-lg font-semibold tracking-tight">{business.name}</h2>
          <p className="mt-1 text-xs text-stone-500">{business.category}</p>
        </div>
        <div className="flex gap-2">
          {onToggleFavorite && (
            <button
              type="button"
              onClick={() => onToggleFavorite(business)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-stone-400 hover:text-white"
              title="Favoritar"
            >
              <Star className={`h-4 w-4 ${business.isFavorite ? 'fill-[#FF5A12] text-[#FF5A12]' : ''}`} />
            </button>
          )}
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-stone-400 hover:text-white" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="rounded-2xl border border-[#FF5A12]/20 bg-[#FF5A12]/[0.06] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Lock className="h-4 w-4 text-[#FF6A26]" />
            Dados protegidos
          </div>
          <p className="mt-2 text-xs leading-relaxed text-stone-400">{message}</p>
        </div>

        <div className="mt-5 space-y-3">
          <div className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-stone-500" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-stone-600">Endereço</p>
              <p className="mt-1 text-xs leading-relaxed text-stone-300">{business.address || 'Não informado'}</p>
            </div>
          </div>

          {raw.hasProtectedEmail && (
            <button type="button" onClick={openPlans} className="flex w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5 text-left hover:border-[#FF5A12]/25">
              <Mail className="h-4 w-4 shrink-0 text-stone-500" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wide text-stone-600">E-mail</p>
                <p className="mt-1 select-none text-xs text-stone-400 blur-[4px]">contato@empresa.com</p>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#FF6A26]"><Lock className="h-3.5 w-3.5" /> Pro</div>
            </button>
          )}

          {raw.hasProtectedPhone && (
            <button type="button" onClick={openPlans} className="flex w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5 text-left hover:border-[#FF5A12]/25">
              <Phone className="h-4 w-4 shrink-0 text-stone-500" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wide text-stone-600">Telefone / WhatsApp</p>
                <p className="mt-1 select-none text-xs text-stone-400 blur-[4px]">(11) 99999-9999</p>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#FF6A26]"><Lock className="h-3.5 w-3.5" /> Pro</div>
            </button>
          )}
        </div>

        <div className="mt-5 flex gap-2">
          <a href={getGoogleBusinessLink(business)} target="_blank" rel="noreferrer" className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] text-[11px] font-semibold text-stone-300 hover:text-white">
            Ver no Google <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <button type="button" onClick={openPlans} className="h-10 flex-1 rounded-xl bg-[#FF5A12] px-4 text-[11px] font-semibold text-white hover:bg-[#ff6a27]">
            Ver planos
          </button>
        </div>
      </div>
    </aside>
  );
}

export default function BusinessSidePanel(props: BusinessSidePanelProps) {
  const { business } = props;
  const [resolvedBusiness, setResolvedBusiness] = useState<Business>(business);
  const [status, setStatus] = useState<'unlocking' | 'ready' | 'locked'>('unlocking');
  const [message, setMessage] = useState('Liberando os dados deste negócio…');
  const attemptRef = useRef('');

  useEffect(() => {
    const raw = business as any;
    setResolvedBusiness(business);

    if (!raw.contactLocked) {
      setStatus('ready');
      return;
    }

    if (!raw.sealedContactToken) {
      setMessage('Os dados de contato deste negócio são um recurso pago. Escolha um plano para continuar.');
      setStatus('locked');
      return;
    }

    const attemptKey = `${business.id}:${raw.sealedContactToken}`;
    if (attemptRef.current === attemptKey) return;
    attemptRef.current = attemptKey;
    setStatus('unlocking');

    unlockOnce(raw)
      .then((result) => {
        const next = { ...business, ...result.business, contactLocked: false } as Business;
        setResolvedBusiness(next);
        setStatus('ready');
        window.dispatchEvent(new CustomEvent('scoutly-access-updated', { detail: result.access }));
      })
      .catch((error: any) => {
        refreshAccess();
        setMessage(error?.message || 'Seus créditos acabaram. Escolha um plano para continuar prospectando.');
        setStatus('locked');
      });
  }, [business]);

  if (status === 'ready') return <BusinessSidePanelBase {...props} business={resolvedBusiness} />;

  if (status === 'locked') {
    return <LockedPanel {...props} message={message} />;
  }

  return (
    <aside className="fixed inset-y-0 right-0 z-[85] flex w-full max-w-[390px] flex-col border-l border-white/[0.08] bg-[#0d1013]/[0.98] text-white shadow-[-24px_0_70px_rgba(0,0,0,0.42)] backdrop-blur-2xl pointer-events-auto">
      <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-5">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{business.name}</p>
          <p className="mt-1 text-xs text-stone-500">{business.category}</p>
        </div>
        <button type="button" onClick={props.onClose} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] text-stone-400" aria-label="Fechar"><X className="h-4 w-4" /></button>
      </div>
      <div className="flex flex-1 items-center justify-center px-6 text-center">
        <div>
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-white/[0.10] border-t-[#FF5A12]" />
          <p className="mt-4 text-sm font-medium text-stone-200">Abrindo negócio</p>
          <p className="mt-1 text-xs text-stone-500">1 crédito é usado para visualizar este negócio.</p>
        </div>
      </div>
    </aside>
  );
}
