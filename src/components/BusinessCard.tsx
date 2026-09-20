import { memo, useState } from 'react';
import {
  Building2,
  Check,
  Copy,
  ExternalLink,
  Globe2,
  Mail,
  MapPin,
  Phone,
  Star,
} from 'lucide-react';
import { Business } from '../types';
import { getGoogleBusinessLink, getTrustIcon, getWhatsAppLink } from '../services/api';
import { translateCategory } from '../utils/categoryTranslator';
import { recordRecommendationWhatsApp } from '../utils/recommendations';

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
  return parts[0] || 'Localização no mapa';
}

function BusinessCard({
  business,
  isSelected,
  onSelect,
  onOpenDetails,
  onToggleFavorite,
}: BusinessCardProps) {
  const [copiedPhone, setCopiedPhone] = useState(false);
  const hasWebsite = Boolean(business.website);
  const hasPhone = Boolean(business.phone || business.phones?.length);
  const hasEmail = Boolean(business.email || business.emails?.length);
  const confidencePercent = Math.round((business.confidence || 0.8) * 100);
  const whatsappUrl = getWhatsAppLink(business.phone);
  const googleBusinessUrl = getGoogleBusinessLink(business);
  const isFavorited = Boolean(business.isFavorite);

  const handleCopyPhone = async (event: React.MouseEvent) => {
    event.stopPropagation();
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
      className={`group relative cursor-pointer overflow-hidden rounded-[20px] border bg-[#17191c] p-3.5 shadow-[0_10px_32px_rgba(0,0,0,0.16)] transition-all duration-200 sm:p-4 ${
        isSelected
          ? 'border-[#FF5A12]/70 ring-1 ring-[#FF5A12]/25'
          : 'border-white/[0.09] hover:border-white/[0.16] hover:bg-[#1b1d20]'
      }`}
    >
      <div className="flex min-w-0 gap-3">
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border transition sm:h-16 sm:w-16 ${
          hasWebsite
            ? 'border-emerald-500/15 bg-emerald-500/[0.055] text-stone-400'
            : 'border-[#FF5A12]/18 bg-[#FF5A12]/[0.065] text-[#FF6A26]'
        }`}>
          <Building2 className="h-5 w-5" strokeWidth={1.8} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[14px] font-semibold tracking-[-0.01em] text-white sm:text-[15px]">
                {business.name}
              </h3>
              <p className="mt-0.5 truncate text-[11px] text-stone-400">
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
                  : 'text-stone-500 hover:bg-white/[0.06] hover:text-white'
              }`}
              title={isFavorited ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
              aria-label={isFavorited ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            >
              <Star className={`h-4 w-4 ${isFavorited ? 'fill-current' : ''}`} />
            </button>
          </div>

          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
              hasWebsite
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-[#FF5A12]/12 text-[#FF7A3D]'
            }`}>
              {hasWebsite ? 'Com site' : 'Sem site'}
            </span>

            {business.openStatus === 'ABERTO_AGORA' && (
              <span className="rounded-full bg-emerald-500/[0.08] px-2.5 py-1 text-[10px] font-medium text-emerald-400">
                Aberto agora
              </span>
            )}

            {business.openStatus === 'FECHADO_AGORA' && (
              <span className="rounded-full bg-rose-500/[0.08] px-2.5 py-1 text-[10px] font-medium text-rose-400">
                Fechado
              </span>
            )}

            <span className="flex min-w-0 items-center gap-1 text-[10px] text-stone-500">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{shortLocation(business)}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 border-t border-white/[0.07] pt-3">
        <div className="flex min-w-0 flex-1 items-center gap-3 text-[9px] font-semibold uppercase tracking-[0.09em] text-stone-500">
          {hasWebsite && (
            <span className="flex items-center gap-1">
              <Globe2 className="h-3 w-3" />
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
            <span className="hidden items-center gap-1 sm:flex">
              <Mail className="h-3 w-3" />
              E-mail
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5 text-[10px] font-medium text-stone-500">
          <span>{confidencePercent}%</span>
          <img
            src={getTrustIcon(business.confidence || 0.8)}
            alt=""
            className="h-4 w-4 object-contain opacity-75"
            title={`Nível de confiança dos dados: ${confidencePercent}%`}
          />
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-1.5">
        <a
          href={googleBusinessUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.035] px-2.5 text-[10px] font-medium text-stone-300 transition hover:border-white/[0.16] hover:bg-white/[0.065] hover:text-white"
          title="Abrir no Google"
        >
          <ExternalLink className="h-3 w-3" />
          Google
        </a>

        {business.phone && (
          <button
            type="button"
            onClick={handleCopyPhone}
            className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.035] px-2.5 text-[10px] font-medium text-stone-300 transition hover:border-white/[0.16] hover:bg-white/[0.065] hover:text-white"
            title={copiedPhone ? 'Número copiado' : 'Copiar telefone'}
          >
            {copiedPhone ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            <span className="hidden sm:inline">{copiedPhone ? 'Copiado' : 'Telefone'}</span>
          </button>
        )}

        {hasWebsite && (
          <a
            href={business.website!}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="inline-flex h-8 items-center rounded-xl border border-white/[0.08] bg-white/[0.035] px-2.5 text-[10px] font-medium text-stone-300 transition hover:border-white/[0.16] hover:bg-white/[0.065] hover:text-white"
          >
            Ver site
          </a>
        )}

        {whatsappUrl && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => {
              event.stopPropagation();
              recordRecommendationWhatsApp(business);
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] px-2.5 text-[10px] font-semibold text-emerald-400 transition hover:bg-emerald-500/[0.12]"
          >
            <img src="/whatsapp_icone.png" alt="" className="h-3.5 w-3.5 object-contain" />
            <span className="hidden sm:inline">WhatsApp</span>
          </a>
        )}

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpenDetails(business);
          }}
          className="ml-auto inline-flex h-8 items-center rounded-xl px-2.5 text-[10px] font-semibold text-[#FF6A26] transition hover:bg-[#FF5A12]/[0.08]"
        >
          Ver detalhes
        </button>
      </div>
    </article>
  );
}

export default memo(BusinessCard);
