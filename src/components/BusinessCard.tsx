import { memo, useState } from 'react';
import {
  Building2,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Globe2,
  Lock,
  Mail,
  MapPin,
  Phone,
  Star,
} from 'lucide-react';
import { Business } from '../types';
import { fetchAccessStatus, getGoogleBusinessLink, getTrustIcon, unlockBusinessContact } from '../services/api';
import { translateCategory } from '../utils/categoryTranslator';
import { recordRecommendationWhatsApp } from '../utils/recommendations';
import { normalizeExternalUrl } from '../utils/externalUrl';
import { isBusinessUnlockedInSession, markBusinessUnlockedInSession } from '../utils/businessUnlockSession';
import BrandIcon from './BrandIcon';

interface BusinessCardProps {
  business: Business;
  index?: number;
  isSelected: boolean;
  onSelect: () => void;
  onOpenDetails: (business: Business) => void;
  onToggleFavorite?: (business: Business) => void;
}

function shortLocation(business: Business): string {
  if (business.bairro) return business.bairro;
  if (business.municipio) return business.municipio;

  const parts = (business.address || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) return parts[parts.length - 2];
  return parts[0] || 'Localização disponível';
}

function BusinessCard({
  business,
  isSelected,
  onSelect,
  onOpenDetails,
  onToggleFavorite,
}: BusinessCardProps) {
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [isUnlockingShortcut, setIsUnlockingShortcut] = useState(false);
  const websiteUrl = normalizeExternalUrl(business.website);
  const hasWebsite = Boolean(websiteUrl);
  const hasPhone = Boolean(business.phone || business.phones?.length);
  const hasEmail = Boolean(business.email || business.emails?.length);
  const confidence = business.confidence || 0.8;
  const confidencePercent = Math.round(confidence * 100);
  const explicitWhatsappSocial = (business.socials || []).find((url) => /wa\.me\/|whatsapp\.com\//i.test(String(url || ''))) || null;
  const whatsappUrl = explicitWhatsappSocial ? normalizeExternalUrl(explicitWhatsappSocial) : null;
  const googleBusinessUrl = getGoogleBusinessLink(business);
  const isFavorited = Boolean(business.isFavorite);

  // Search/list results are protected until the server accepts the business-open
  // request. This prevents the Site/Google/Phone/WhatsApp shortcuts from
  // bypassing the prospecting credit gate.
  const requiresCreditGate = business.contactLocked !== false && !isBusinessUnlockedInSession(business.id);

  const ensureShortcutAccess = async () => {
    if (!requiresCreditGate) return true;
    if (isUnlockingShortcut) return false;

    setIsUnlockingShortcut(true);
    try {
      const result = await unlockBusinessContact(business);
      markBusinessUnlockedInSession(business.id);
      window.dispatchEvent(new CustomEvent('scoutly-access-updated', { detail: result.access }));
      return true;
    } catch (error: any) {
      const code = String(error?.code || '');

      // Free consumes the credit successfully, while paid e-mail remains gated.
      if (code === 'CONTACTS_REQUIRE_PAID_PLAN') {
        markBusinessUnlockedInSession(business.id);
        try {
          const access = await fetchAccessStatus();
          window.dispatchEvent(new CustomEvent('scoutly-access-updated', { detail: access }));
        } catch {
          window.dispatchEvent(new CustomEvent('scoutly-access-updated'));
        }
        return true;
      }

      if (code === 'DAILY_CREDIT_LIMIT' || code === 'MONTHLY_CREDIT_LIMIT') {
        window.dispatchEvent(new CustomEvent('scoutly-request-credits-exhausted'));
        return false;
      }

      onOpenDetails(business);
      return false;
    } finally {
      setIsUnlockingShortcut(false);
    }
  };

  const openExternalShortcut = async (event: React.MouseEvent, url: string) => {
    event.preventDefault();
    event.stopPropagation();

    if (!requiresCreditGate) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }

    const pendingWindow = window.open('about:blank', '_blank');
    if (pendingWindow) pendingWindow.opener = null;

    const allowed = await ensureShortcutAccess();
    if (!allowed) {
      pendingWindow?.close();
      return;
    }

    if (pendingWindow) pendingWindow.location.replace(url);
    else window.open(url, '_blank', 'noopener,noreferrer');
  };

  const showCreditsExhausted = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    window.dispatchEvent(new CustomEvent('scoutly-request-credits-exhausted'));
  };

  const handleCopyPhone = async (event: React.MouseEvent) => {
    event.stopPropagation();

    if (requiresCreditGate) {
      event.preventDefault();
      const allowed = await ensureShortcutAccess();
      if (!allowed) return;
    }

    if (!business.phone) return;

    try {
      await navigator.clipboard.writeText(business.phone);
      setCopiedPhone(true);
      window.setTimeout(() => setCopiedPhone(false), 1400);
    } catch {
      setCopiedPhone(false);
    }
  };

  return (
    <article
      id={`card-${business.id}`}
      onClick={onSelect}
      className={`group cursor-pointer rounded-[18px] border bg-[#17191c]/95 px-4 py-3.5 transition-all duration-200 ${
        isSelected
          ? 'border-[#FF5A12]/65 bg-[#1b1b1d] shadow-[0_0_0_1px_rgba(255,90,18,0.12)]'
          : 'border-white/[0.085] hover:border-white/[0.16] hover:bg-[#1b1d20]'
      }`}
    >
      <div className="flex min-w-0 items-start gap-3.5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] border border-white/[0.08] bg-[#111315] text-stone-400 sm:h-14 sm:w-14">
          <Building2 className="h-5 w-5" strokeWidth={1.7} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[14px] font-semibold tracking-[-0.015em] text-white sm:text-[15px]">
                {business.name}
              </h3>
              <p className="mt-0.5 truncate text-[10.5px] text-stone-400">
                {translateCategory(business.category)}
              </p>
            </div>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onToggleFavorite?.(business);
              }}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition ${
                isFavorited
                  ? 'bg-[#FF5A12]/12 text-[#FF6A26]'
                  : 'text-stone-400 hover:bg-white/[0.06] hover:text-white'
              }`}
              title={isFavorited ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
              aria-label={isFavorited ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            >
              <Star className={`h-4 w-4 ${isFavorited ? 'fill-current' : ''}`} />
            </button>
          </div>

          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5">
            <span className={`rounded-full px-2.5 py-1 text-[9.5px] font-semibold ${
              hasWebsite
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-[#FF5A12]/12 text-[#FF7A3D]'
            }`}>
              {hasWebsite ? 'Com site' : 'Sem site'}
            </span>

            {business.openStatus === 'ABERTO_AGORA' && (
              <span className="rounded-full bg-emerald-500/[0.08] px-2.5 py-1 text-[9.5px] font-medium text-emerald-400">
                Aberto agora
              </span>
            )}

            {business.openStatus === 'FECHADO_AGORA' && (
              <span className="rounded-full bg-rose-500/[0.08] px-2.5 py-1 text-[9.5px] font-medium text-rose-400">
                Fechado
              </span>
            )}

            <span className="flex min-w-0 items-center gap-1 text-[10px] text-stone-400">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{shortLocation(business)}</span>
            </span>
          </div>
        </div>

        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          <div className="text-right">
            <div className="text-[13px] font-semibold text-stone-200">{confidencePercent}%</div>
            <div className="mt-0.5 text-[8px] font-medium uppercase tracking-[0.1em] text-stone-400">confiança</div>
          </div>
          <img
            src={getTrustIcon(confidence)}
            alt=""
            className="h-5 w-5 object-contain opacity-80"
            title={`Nível de confiança dos dados: ${confidencePercent}%`}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-white/[0.07] pt-3">
        <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden text-[9px] font-semibold uppercase tracking-[0.08em] text-stone-400">
          {hasWebsite && (
            <span className="flex items-center gap-1">
              <BrandIcon brand="website" className="h-3.5 w-3.5" alt="Site" />
              Site
            </span>
          )}
          {hasPhone && (
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              Contato
            </span>
          )}
          {hasEmail && (
            <span className="hidden items-center gap-1 md:flex">
              <Mail className="h-3 w-3" />
              E-mail
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={showCreditsExhausted}
          className="scoutly-business-credit-lock hidden h-8 items-center gap-1.5 rounded-xl border border-[#FF5A12]/20 bg-[#FF5A12]/[0.07] px-3 text-[9.5px] font-semibold text-[#FF7A3D]"
          title="Seus créditos acabaram"
        >
          <Lock className="h-3.5 w-3.5" />
          Sem créditos
        </button>

        <div className="scoutly-business-shortcuts flex shrink-0 items-center gap-1.5 overflow-x-auto no-scrollbar">
          {requiresCreditGate ? (
            <button
              type="button"
              onClick={(event) => openExternalShortcut(event, googleBusinessUrl)}
              disabled={isUnlockingShortcut}
              className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-white/[0.10] bg-white/[0.05] px-2.5 text-[9.5px] font-semibold text-stone-200 transition hover:border-[#FF5A12]/35 hover:text-white disabled:opacity-60"
              title="Abrir no Google Maps"
            >
              <BrandIcon brand="googleMaps" className="h-3.5 w-3.5" alt="Google Maps" />
              <span className="hidden md:inline">Google Maps</span>
            </button>
          ) : (
            <a
              href={googleBusinessUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-2.5 text-[9.5px] font-medium text-stone-300 transition hover:border-white/[0.16] hover:text-white"
              title="Abrir no Google"
            >
              <BrandIcon brand="googleMaps" className="h-3.5 w-3.5" alt="Google Maps" />
              <span className="hidden md:inline">Google Maps</span>
            </a>
          )}

          {business.phone && (
            <button
              type="button"
              onClick={handleCopyPhone}
              className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-2.5 text-[9.5px] font-medium text-stone-300 transition hover:border-[#FF5A12]/35 hover:text-white"
              title={requiresCreditGate ? 'Abra os dados do negócio para acessar o telefone' : copiedPhone ? 'Número copiado' : 'Copiar telefone'}
            >
              {copiedPhone ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              <span className="hidden lg:inline">{copiedPhone ? 'Copiado' : 'Telefone'}</span>
            </button>
          )}

          {hasWebsite && (
            requiresCreditGate ? (
              <button
                type="button"
                onClick={(event) => openExternalShortcut(event, websiteUrl!)}
                disabled={isUnlockingShortcut}
                className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-white/[0.10] bg-white/[0.05] px-2.5 text-[9.5px] font-semibold text-stone-200 transition hover:border-[#FF5A12]/35 hover:text-white disabled:opacity-60"
                title="Abrir site"
              >
                <BrandIcon brand="website" className="h-3.5 w-3.5" alt="Site" />
                Site
              </button>
            ) : (
              <a
                href={websiteUrl!}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => event.stopPropagation()}
                className="inline-flex h-8 items-center rounded-xl border border-white/[0.08] bg-white/[0.03] px-2.5 text-[9.5px] font-medium text-stone-300 transition hover:border-white/[0.16] hover:text-white"
              >
                Site
              </a>
            )
          )}

          {whatsappUrl && (
            requiresCreditGate ? (
              <button
                type="button"
                onClick={(event) => openExternalShortcut(event, whatsappUrl)}
                disabled={isUnlockingShortcut}
                className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.10] px-2.5 text-[9.5px] font-semibold text-emerald-300 transition hover:bg-emerald-500/[0.16] disabled:opacity-60"
                title="WhatsApp confirmado por link explícito da fonte"
              >
                <BrandIcon brand="whatsapp" className="h-3.5 w-3.5" alt="WhatsApp" />
                <span className="hidden md:inline">WhatsApp</span>
              </button>
            ) : (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => {
                  event.stopPropagation();
                  recordRecommendationWhatsApp(business);
                }}
                className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] px-2.5 text-[9.5px] font-semibold text-emerald-400 transition hover:bg-emerald-500/[0.12]"
              >
                <BrandIcon brand="whatsapp" className="h-3.5 w-3.5" alt="WhatsApp" />
                <span className="hidden md:inline">WhatsApp</span>
              </a>
            )
          )}

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onOpenDetails(business);
            }}
            className="inline-flex h-8 items-center gap-1 rounded-xl px-2.5 text-[9.5px] font-semibold text-[#FF6A26] transition hover:bg-[#FF5A12]/[0.08]"
          >
            Detalhes
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </article>
  );
}

export default memo(BusinessCard);
