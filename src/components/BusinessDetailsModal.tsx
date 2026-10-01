import { useEffect, useRef, useState } from 'react';
import { Lock, Mail, MapPin, Phone, Star, X } from 'lucide-react';
import { Business, LeadStatus } from '../types';
import BusinessDetailsModalBase from './BusinessDetailsModalBase';
import { fetchAccessStatus, unlockBusinessContact } from '../services/api';
import { isBusinessUnlockedInSession, markBusinessUnlockedInSession } from '../utils/businessUnlockSession';

interface BusinessDetailsModalProps {
  business: Business | null;
  onClose: () => void;
  onUpdateStatus?: (id: string, status: LeadStatus, notes?: string) => void;
  onToggleFavorite?: (business: Business) => void;
}

type UnlockResult = Awaited<ReturnType<typeof unlockBusinessContact>>;
const modalUnlocks = new Map<string, Promise<UnlockResult>>();

function unlockOnce(business: any) {
  const key = String(business?.sealedContactToken || business?.id || '');
  const current = modalUnlocks.get(key);
  if (current) return current;
  const request = unlockBusinessContact(business);
  modalUnlocks.set(key, request);
  void request.finally(() => window.setTimeout(() => modalUnlocks.delete(key), 1200));
  return request;
}

function normalizeUnlockedBusiness(value: Business | null): Business | null {
  if (!value) return value;
  const raw = value as any;
  const email = raw.email && !String(raw.email).includes('•') ? String(raw.email) : null;
  const emails = Array.isArray(raw.emails)
    ? raw.emails.filter((item: unknown) => item && !String(item).includes('•'))
    : [];
  return {
    ...value,
    email: email || emails[0] || raw.email || null,
    emails: emails.length > 0 ? emails : email ? [email] : Array.isArray(raw.emails) ? raw.emails : [],
  } as Business;
}

function openPlans() {
  window.dispatchEvent(new CustomEvent('scoutly-open-plans'));
}

function refreshAccess() {
  window.dispatchEvent(new CustomEvent('scoutly-access-updated'));
}

async function refreshAccessStatus() {
  try {
    const access = await fetchAccessStatus();
    window.dispatchEvent(new CustomEvent('scoutly-access-updated', { detail: access }));
    return access;
  } catch {
    refreshAccess();
    return null;
  }
}

async function showCreditsExhausted(code?: string) {
  const access = await refreshAccessStatus();
  window.dispatchEvent(new CustomEvent('scoutly-credits-exhausted', {
    detail: { code, access },
  }));
}

function LockedBusinessModal({ business, onClose, onUpdateStatus, onToggleFavorite, message }: BusinessDetailsModalProps & { business: Business; message: string }) {
  const raw = business as any;
  const phone = business.phone && !String(business.phone).includes('•') ? business.phone : null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-[7px] pointer-events-auto">
      <div className="w-full max-w-2xl overflow-hidden rounded-[24px] border border-white/[0.09] bg-[#0d1013] text-white shadow-[-30px_0_100px_rgba(0,0,0,0.58)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] px-6 py-5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#FF6A26]">Detalhes do negócio</p>
            <h2 className="mt-1 truncate text-xl font-semibold tracking-tight">{business.name}</h2>
            <p className="mt-1 text-xs text-stone-500">{business.category}</p>
          </div>
          <div className="flex gap-2">
            {onToggleFavorite && (
              <button type="button" onClick={() => onToggleFavorite(business)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-stone-400 hover:text-white" title="Favoritar">
                <Star className={`h-4 w-4 ${business.isFavorite ? 'fill-[#FF5A12] text-[#FF5A12]' : ''}`} />
              </button>
            )}
            <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-stone-400 hover:text-white" aria-label="Fechar"><X className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="p-6">
          <div className="rounded-2xl border border-[#FF5A12]/20 bg-[#FF5A12]/[0.06] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold"><Lock className="h-4 w-4 text-[#FF6A26]" /> Não foi possível abrir este negócio</div>
            <p className="mt-2 text-xs leading-relaxed text-stone-400">{message}</p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5 sm:col-span-2">
              <MapPin className="mt-0.5 h-4 w-4 text-stone-500" />
              <div><p className="text-[10px] uppercase tracking-wide text-stone-600">Endereço</p><p className="mt-1 text-xs text-stone-300">{business.address || 'Não informado'}</p></div>
            </div>

            {phone && (
              <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5 text-left">
                <Phone className="h-4 w-4 text-stone-500" />
                <div className="min-w-0 flex-1"><p className="text-[10px] uppercase tracking-wide text-stone-600">Telefone</p><p className="mt-1 text-xs text-stone-300">{phone}</p></div>
              </div>
            )}

            {raw.hasProtectedEmail && (
              <button type="button" onClick={openPlans} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5 text-left hover:border-[#FF5A12]/25">
                <Mail className="h-4 w-4 text-stone-500" />
                <div className="min-w-0 flex-1"><p className="text-[10px] uppercase tracking-wide text-stone-600">E-mail</p><p className="mt-1 select-none text-xs text-stone-400 blur-[4px]">contato@empresa.com</p></div>
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#FF6A26]"><Lock className="h-3.5 w-3.5" /> Pro</div>
              </button>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-5">
            <div className="flex gap-2">
              {onUpdateStatus && (
                <button type="button" onClick={() => onUpdateStatus(business.id, 'CONTATADO', business.notes)} className="rounded-xl border border-white/[0.09] bg-white/[0.035] px-4 py-2.5 text-[11px] font-semibold text-stone-300 hover:text-white">
                  Adicionar ao pipeline
                </button>
              )}
            </div>
            <button type="button" onClick={openPlans} className="rounded-xl bg-[#FF5A12] px-5 py-2.5 text-[11px] font-semibold text-white hover:bg-[#ff6a27]">Ver planos</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BusinessDetailsModal(props: BusinessDetailsModalProps) {
  const { business } = props;
  const [resolvedBusiness, setResolvedBusiness] = useState<Business | null>(normalizeUnlockedBusiness(business));
  const [status, setStatus] = useState<'unlocking' | 'ready' | 'locked'>(business ? 'unlocking' : 'ready');
  const [message, setMessage] = useState('Não foi possível abrir este negócio agora. Tente novamente.');
  const attemptRef = useRef('');

  useEffect(() => {
    if (!business) {
      delete document.documentElement.dataset.scoutlyBusinessModal;
      return;
    }
    document.documentElement.dataset.scoutlyBusinessModal = 'true';
    return () => {
      delete document.documentElement.dataset.scoutlyBusinessModal;
    };
  }, [business?.id]);

  useEffect(() => {
    if (!business) {
      setResolvedBusiness(null);
      setStatus('ready');
      return;
    }

    const raw = business as any;
    setResolvedBusiness(normalizeUnlockedBusiness(business));
    if (!raw.contactLocked || isBusinessUnlockedInSession(business.id)) {
      setResolvedBusiness(normalizeUnlockedBusiness({ ...business, contactLocked: false } as Business));
      setStatus('ready');
      return;
    }
    if (!raw.sealedContactToken) {
      setMessage('Atualize a busca e tente abrir o negócio novamente.');
      setStatus('locked');
      return;
    }

    const key = `${business.id}:${raw.sealedContactToken}`;
    if (attemptRef.current === key) return;
    attemptRef.current = key;
    setStatus('unlocking');

    unlockOnce(raw)
      .then((result) => {
        markBusinessUnlockedInSession(business.id);
        setResolvedBusiness(normalizeUnlockedBusiness({ ...business, ...result.business, contactLocked: false } as Business));
        setStatus('ready');
        window.dispatchEvent(new CustomEvent('scoutly-access-updated', { detail: result.access }));
      })
      .catch((error: any) => {
        const code = String(error?.code || '');

        if (code === 'CONTACTS_REQUIRE_PAID_PLAN') {
          markBusinessUnlockedInSession(business.id);
          setResolvedBusiness(normalizeUnlockedBusiness({
            ...business,
            contactLocked: false,
            sealedContactToken: null,
          } as Business));
          setStatus('ready');
          void refreshAccessStatus();
          return;
        }

        if (code === 'DAILY_CREDIT_LIMIT' || code === 'MONTHLY_CREDIT_LIMIT') {
          props.onClose();
          void showCreditsExhausted(code);
          return;
        }

        refreshAccess();
        setMessage('Não foi possível abrir este negócio agora. Atualize a busca e tente novamente.');
        setStatus('locked');
      });
  }, [business]);

  if (!business) return null;
  if (status === 'ready') return <BusinessDetailsModalBase {...props} business={normalizeUnlockedBusiness(resolvedBusiness)} />;
  if (status === 'locked') return <LockedBusinessModal {...props} business={business} message={message} />;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 backdrop-blur-[7px] pointer-events-auto">
      <div className="rounded-2xl border border-white/[0.08] bg-[#0d1013] px-8 py-7 text-center text-white shadow-2xl">
        <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-white/[0.10] border-t-[#FF5A12]" />
        <p className="mt-4 text-sm font-semibold">Abrindo {business.name}</p>
        <p className="mt-1 text-xs text-stone-500">1 crédito é usado para visualizar este negócio.</p>
      </div>
    </div>
  );
}
