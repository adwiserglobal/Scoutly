import { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Globe2, Lock, Mail, MapPin, MessageCircle, Phone, Star, X } from 'lucide-react';
import { Business } from '../types';
import BusinessSidePanelBase from './BusinessSidePanelBase';
import { CreditAccessStatus, getGoogleBusinessLink, getWhatsAppLink, unlockBusinessContact } from '../services/api';

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

function normalizeWebsiteDomain(website?: string | null) {
  const raw = String(website || '').trim();
  if (!raw) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return url.hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return raw.replace(/^https?:\/\//i, '').split('/')[0].replace(/^www\./i, '').trim().toLowerCase() || null;
  }
}

function PanelShell({
  business,
  onClose,
  onToggleFavorite,
  children,
}: BusinessSidePanelProps & { children: React.ReactNode }) {
  return (
    <aside className="fixed inset-y-0 right-0 z-[85] flex w-full max-w-[420px] flex-col border-l border-white/[0.08] bg-[#0d1013]/[0.99] text-white shadow-[-24px_0_70px_rgba(0,0,0,0.42)] backdrop-blur-2xl pointer-events-auto">
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
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-stone-400 transition hover:text-white"
              title={business.isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            >
              <Star className={`h-4 w-4 ${business.isFavorite ? 'fill-[#FF5A12] text-[#FF5A12]' : ''}`} />
            </button>
          )}
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-stone-400 hover:text-white" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
    </aside>
  );
}

function ProEmailRow({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <button
      type="button"
      onClick={openPlans}
      className="group flex w-full items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3.5 text-left transition hover:border-[#FF5A12]/30 hover:bg-[#FF5A12]/[0.04]"
      title="E-mail disponível nos planos pagos"
    >
      <Mail className="h-4 w-4 shrink-0 text-stone-500" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-[10px] uppercase tracking-wide text-stone-600">E-mail</p>
          <span className="rounded-md border border-[#FF5A12]/20 bg-[#FF5A12]/[0.08] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-[#FF6A26]">Pro</span>
        </div>
        <p className="mt-1 select-none text-xs text-stone-400 blur-[4px]">contato@empresa.com</p>
      </div>
      <Lock className="h-4 w-4 shrink-0 text-[#FF6A26]" />
    </button>
  );
}

function FreeUnlockedPanel(props: BusinessSidePanelProps & { business: Business }) {
  const { business } = props;
  const raw = business as any;
  const phone = business.phone || business.phones?.[0] || null;
  const whatsappUrl = getWhatsAppLink(phone);
  const websiteDomain = useMemo(() => normalizeWebsiteDomain(business.website), [business.website]);
  const metaAdsUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=${encodeURIComponent(business.name)}&media_type=all`;
  const googleAdsUrl = websiteDomain
    ? `https://adstransparency.google.com/?domain=${encodeURIComponent(websiteDomain)}&region=anywhere`
    : null;

  return (
    <PanelShell {...props} business={business}>
      <div className="mb-5 rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-500">Plano Free</p>
            <p className="mt-1 text-xs text-stone-300">1 crédito usado para abrir este negócio.</p>
          </div>
          <button type="button" onClick={openPlans} className="shrink-0 text-[10px] font-semibold text-[#FF6A26] hover:text-[#ff8653]">Fazer upgrade</button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-stone-500" />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-stone-600">Endereço</p>
            <p className="mt-1 text-xs leading-relaxed text-stone-300">{business.address || 'Não informado'}</p>
          </div>
        </div>

        {phone ? (
          <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5">
            <Phone className="h-4 w-4 shrink-0 text-stone-500" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wide text-stone-600">Telefone</p>
              <p className="mt-1 truncate text-xs text-stone-200">{phone}</p>
            </div>
            <a href={`tel:${phone}`} className="text-[10px] font-semibold text-[#FF6A26]">Ligar</a>
          </div>
        ) : null}

        <ProEmailRow visible={Boolean(raw.emailPaidLocked || raw.hasProtectedEmail)} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <a href={getGoogleBusinessLink(business)} target="_blank" rel="noreferrer" className="flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] text-[10px] font-semibold text-stone-300 hover:text-white">
          <MapPin className="h-3.5 w-3.5 text-[#FF6A26]" /> Google
        </a>
        {business.website ? (
          <a href={business.website} target="_blank" rel="noreferrer" className="flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] text-[10px] font-semibold text-stone-300 hover:text-white">
            <Globe2 className="h-3.5 w-3.5 text-[#FF6A26]" /> Site
          </a>
        ) : (
          <div className="flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] text-[10px] text-stone-600"><Globe2 className="h-3.5 w-3.5" /> Sem site</div>
        )}
        {whatsappUrl ? (
          <a href={whatsappUrl} target="_blank" rel="noreferrer" className="flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500/[0.08]">
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </a>
        ) : null}
      </div>

      <div className="mt-6">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-500">Verificar anúncios públicos</p>
        <div className="grid grid-cols-2 gap-2">
          <a href={metaAdsUrl} target="_blank" rel="noreferrer" className="flex h-11 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 text-[10px] font-semibold text-stone-300 hover:text-white">
            <img src="/meta-ads-logo.png" alt="Meta" className="h-5 w-5 object-contain" /> Meta Ads <ExternalLink className="ml-auto h-3 w-3 text-stone-600" />
          </a>
          {googleAdsUrl ? (
            <a href={googleAdsUrl} target="_blank" rel="noreferrer" className="flex h-11 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 text-[10px] font-semibold text-stone-300 hover:text-white">
              <img src="/google-ads-logo.png" alt="Google Ads" className="h-5 w-5 rounded bg-white object-contain" /> Google Ads <ExternalLink className="ml-auto h-3 w-3 text-stone-600" />
            </a>
          ) : null}
        </div>
      </div>
    </PanelShell>
  );
}

function LockedPanel({ business, message, ...props }: BusinessSidePanelProps & { message: string }) {
  const raw = business as any;
  return (
    <PanelShell {...props} business={business}>
      <div className="rounded-2xl border border-[#FF5A12]/20 bg-[#FF5A12]/[0.06] p-4">
        <div className="flex items-center gap-2 text-sm font-semibold"><Lock className="h-4 w-4 text-[#FF6A26]" /> Créditos indisponíveis</div>
        <p className="mt-2 text-xs leading-relaxed text-stone-400">{message}</p>
      </div>

      <div className="mt-5 space-y-3">
        <div className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-stone-500" />
          <div><p className="text-[10px] uppercase tracking-wide text-stone-600">Endereço</p><p className="mt-1 text-xs leading-relaxed text-stone-300">{business.address || 'Não informado'}</p></div>
        </div>
        <ProEmailRow visible={Boolean(raw.hasProtectedEmail)} />
        {raw.hasProtectedPhone && (
          <button type="button" onClick={openPlans} className="flex w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5 text-left hover:border-[#FF5A12]/25">
            <Phone className="h-4 w-4 shrink-0 text-stone-500" />
            <div className="min-w-0 flex-1"><p className="text-[10px] uppercase tracking-wide text-stone-600">Telefone / WhatsApp</p><p className="mt-1 select-none text-xs text-stone-400 blur-[4px]">(11) 99999-9999</p></div>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#FF6A26]"><Lock className="h-3.5 w-3.5" /> Upgrade</div>
          </button>
        )}
      </div>

      <button type="button" onClick={openPlans} className="mt-5 h-10 w-full rounded-xl bg-[#FF5A12] px-4 text-[11px] font-semibold text-white hover:bg-[#ff6a27]">Ver planos</button>
    </PanelShell>
  );
}

export default function BusinessSidePanel(props: BusinessSidePanelProps) {
  const { business } = props;
  const [resolvedBusiness, setResolvedBusiness] = useState<Business>(business);
  const [access, setAccess] = useState<CreditAccessStatus | null>(null);
  const [status, setStatus] = useState<'unlocking' | 'ready' | 'locked'>('unlocking');
  const [message, setMessage] = useState('Liberando os dados deste negócio…');
  const attemptRef = useRef('');

  useEffect(() => {
    const raw = business as any;
    setResolvedBusiness(business);
    setAccess(null);

    if (!raw.contactLocked) {
      setStatus('ready');
      return;
    }

    if (!raw.sealedContactToken) {
      setMessage('Os dados deste negócio estão protegidos. Escolha um plano para continuar.');
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
        setAccess(result.access);
        setStatus('ready');
        window.dispatchEvent(new CustomEvent('scoutly-access-updated', { detail: result.access }));
      })
      .catch((error: any) => {
        setMessage(error?.message || 'Seus créditos acabaram. Escolha um plano para continuar prospectando.');
        setStatus('locked');
      });
  }, [business]);

  if (status === 'ready' && access?.plan === 'free') {
    return <FreeUnlockedPanel {...props} business={resolvedBusiness} />;
  }

  if (status === 'ready') return <BusinessSidePanelBase {...props} business={resolvedBusiness} />;
  if (status === 'locked') return <LockedPanel {...props} message={message} />;

  return (
    <PanelShell {...props}>
      <div className="flex min-h-[55vh] items-center justify-center px-6 text-center">
        <div>
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-white/[0.10] border-t-[#FF5A12]" />
          <p className="mt-4 text-sm font-medium text-stone-200">Abrindo negócio</p>
          <p className="mt-1 text-xs text-stone-500">1 crédito é usado para liberar os dados.</p>
        </div>
      </div>
    </PanelShell>
  );
}
