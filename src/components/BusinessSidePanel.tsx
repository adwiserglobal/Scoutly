import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Globe2,
  Mail,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import { Business } from '../types';
import {
  enrichBusinessData,
  fetchTrackingAudit,
  generateMessage,
  getGoogleBusinessLink,
  getWhatsAppLink,
} from '../services/api';
import { translateCategory } from '../utils/categoryTranslator';
import { usePageSpeed } from '../hooks/usePageSpeed';
import { markBusinessRecentlyViewed } from '../utils/recentBusinesses';
import { recordRecommendationWhatsApp } from '../utils/recommendations';

interface BusinessSidePanelProps {
  business: Business;
  onClose: () => void;
  onToggleFavorite?: (business: Business) => void;
  onAddToPipeline?: (business: Business) => void;
}

function LoaderRing() {
  return (
    <span
      className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-[1.5px] border-white/[0.12] border-t-[#FF641F]"
      aria-label="Carregando"
    />
  );
}

function InstagramIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.4" cy="6.7" r="1.1" fill="currentColor" />
    </svg>
  );
}

function FacebookIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="currentColor" d="M13.7 21v-8h2.7l.4-3h-3.1V8.1c0-.9.3-1.6 1.6-1.6H17V3.8c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2H7.5v3h2.8v8h3.4Z" />
    </svg>
  );
}

function WhatsAppIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="currentColor" d="M20.5 3.5A11.8 11.8 0 0 0 12.1 0C5.6 0 .3 5.3.3 11.8c0 2.1.5 4.1 1.6 5.9L.2 24l6.5-1.7a11.7 11.7 0 0 0 5.4 1.4h.1C18.7 23.7 24 18.4 24 11.9c0-3.2-1.2-6.1-3.5-8.4Zm-8.4 18.2h-.1a9.8 9.8 0 0 1-5-1.4l-.4-.2-3.8 1 1-3.7-.2-.4a9.8 9.8 0 1 1 8.5 4.7Zm5.4-7.3c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8 1-1 1.2-.2.2-.4.2-.7.1-2-.8-3.3-2.8-3.5-3.1-.2-.3 0-.5.1-.7l.5-.6c.2-.2.2-.4.3-.6.1-.2 0-.5 0-.6l-.9-2.1c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.2-1.2 2.9s1.2 3.3 1.4 3.5c.1.2 2.4 3.7 5.9 5.2.8.4 1.5.6 2 .7.8.3 1.6.2 2.2.1.7-.1 1.7-.7 1.9-1.3.2-.6.2-1.2.1-1.3-.1-.2-.3-.3-.6-.4Z" />
    </svg>
  );
}

function OpportunityChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-[#FF641F]/25 bg-[#FF641F]/[0.07] px-3 py-1.5 text-[10px] font-medium text-[#ff9a6b]">
      {children}
    </span>
  );
}

function PresenceCard({
  href,
  icon,
  label,
  verified = false,
}: {
  href?: string | null;
  icon: React.ReactNode;
  label: string;
  verified?: boolean;
}) {
  const content = (
    <>
      <span className="text-stone-300">{icon}</span>
      <span className="truncate text-[10px] font-medium text-stone-200">{label}</span>
      {verified && <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-emerald-400" />}
      {href && !verified && <ExternalLink className="ml-auto h-3 w-3 text-stone-600" />}
    </>
  );

  if (!href) {
    return (
      <div className="flex h-11 items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 opacity-45">
        {content}
      </div>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-11 items-center gap-2 rounded-xl border border-white/[0.09] bg-[#111418] px-3 transition hover:border-[#FF641F]/35 hover:bg-[#15191e]"
    >
      {content}
    </a>
  );
}

function firstName(value: string) {
  const clean = String(value || '').trim();
  return clean || 'Negócio';
}

function getInitials(value: string) {
  const words = String(value || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'SC';
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join('');
}

export default function BusinessSidePanel({
  business,
  onClose,
  onToggleFavorite,
  onAddToPipeline,
}: BusinessSidePanelProps) {
  const [enrichment, setEnrichment] = useState<any>(null);
  const [trackingAudit, setTrackingAudit] = useState<any>(null);
  const [isEnrichmentLoading, setIsEnrichmentLoading] = useState(false);
  const [isTrackingLoading, setIsTrackingLoading] = useState(false);
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [messageVariation, setMessageVariation] = useState(0);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [isGeneratingMessage, setIsGeneratingMessage] = useState(false);
  const [isMessageCopied, setIsMessageCopied] = useState(false);

  const hasWebsite = Boolean(business.website);
  const autoEnrichEnabled = localStorage.getItem('scoutly_auto_enrich') !== 'false';
  const { data: pageSpeed, isLoading: isPageSpeedLoading } = usePageSpeed(
    autoEnrichEnabled && hasWebsite ? business.website : null
  );

  useEffect(() => {
    markBusinessRecentlyViewed(business.id, business);
    setGeneratedMessage('');
    setMessageVariation(0);
    setMessageError(null);
    setIsMessageCopied(false);
  }, [business.id]);

  useEffect(() => {
    let cancelled = false;
    setEnrichment(null);
    setTrackingAudit(null);

    if (!business.website || !autoEnrichEnabled) {
      setIsEnrichmentLoading(false);
      setIsTrackingLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setIsEnrichmentLoading(true);
    setIsTrackingLoading(true);

    enrichBusinessData(business.website)
      .then((data) => {
        if (cancelled) return;
        setEnrichment(data);
        if (data?.trackingAudit) setTrackingAudit(data.trackingAudit);
      })
      .catch((error) => console.warn('[Scoutly Side Panel Enrichment]:', error))
      .finally(() => {
        if (!cancelled) setIsEnrichmentLoading(false);
      });

    fetchTrackingAudit(business.website)
      .then((audit) => {
        if (!cancelled) setTrackingAudit(audit);
      })
      .catch((error) => console.warn('[Scoutly Side Panel Tracking]:', error))
      .finally(() => {
        if (!cancelled) setIsTrackingLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [business.id, business.website, autoEnrichEnabled]);

  const verifiedWhatsapp = useMemo(() => {
    const items = Array.isArray(enrichment?.whatsapp) ? enrichment.whatsapp : [];
    return items[0]?.value || null;
  }, [enrichment]);

  const verifiedPhone = useMemo(() => {
    const items = Array.isArray(enrichment?.phones) ? enrichment.phones : [];
    return items[0]?.value || null;
  }, [enrichment]);

  const verifiedEmail = useMemo(() => {
    const items = Array.isArray(enrichment?.emails) ? enrichment.emails : [];
    return items[0]?.value || null;
  }, [enrichment]);

  const socialLinks = useMemo(() => {
    const fromEnrichment = enrichment?.socials && typeof enrichment.socials === 'object'
      ? Object.entries(enrichment.socials)
          .map(([network, item]: any) => ({ network: String(network), url: item?.value as string }))
          .filter((item) => Boolean(item.url))
      : [];

    const fromBusiness = (business.socials || [])
      .filter(Boolean)
      .map((url) => ({
        network: url.includes('instagram')
          ? 'Instagram'
          : url.includes('facebook')
            ? 'Facebook'
            : url.includes('linkedin')
              ? 'LinkedIn'
              : 'Rede social',
        url,
      }));

    const merged = [...fromEnrichment, ...fromBusiness];
    return merged.filter((item, index) => merged.findIndex((candidate) => candidate.url === item.url) === index);
  }, [enrichment, business.socials]);

  const instagramUrl = socialLinks.find((item) => item.network.toLowerCase().includes('instagram') || item.url.includes('instagram'))?.url || null;
  const facebookUrl = socialLinks.find((item) => item.network.toLowerCase().includes('facebook') || item.url.includes('facebook'))?.url || null;
  const phone = verifiedPhone || business.phone || business.phones?.[0] || null;
  const email = verifiedEmail || business.email || business.emails?.[0] || null;
  const whatsappCandidate = verifiedWhatsapp || phone;
  const whatsappUrl = whatsappCandidate ? getWhatsAppLink(whatsappCandidate) : null;
  const googleBusinessUrl = getGoogleBusinessLink(business);
  const isFavorite = Boolean(business.isFavorite);
  const isInPipeline = Boolean(business.leadStatus && !['NOVO', 'ARQUIVADO'].includes(business.leadStatus));
  const cityLabel = [business.municipio, business.uf].filter(Boolean).join(' - ');

  const opportunities = useMemo(() => {
    const list: string[] = [];

    if (!hasWebsite) list.push('Site não identificado');
    if (!instagramUrl && !isEnrichmentLoading) list.push('Instagram não identificado');
    if (!facebookUrl && !isEnrichmentLoading) list.push('Facebook não identificado');
    if (phone && !verifiedWhatsapp && !isEnrichmentLoading) list.push('WhatsApp não verificado');
    if (hasWebsite && !trackingAudit?.gtm?.detected && !isTrackingLoading) list.push('GTM não detectado');
    if (hasWebsite && !trackingAudit?.metaPixel?.detected && !isTrackingLoading) list.push('Meta Pixel não detectado');
    if (hasWebsite && !trackingAudit?.ga4?.detected && !isTrackingLoading) list.push('GA4 não detectado');
    if (pageSpeed && typeof pageSpeed.score === 'number' && pageSpeed.score < 50) list.push('Performance mobile baixa');

    return list.slice(0, 7);
  }, [
    hasWebsite,
    instagramUrl,
    facebookUrl,
    phone,
    verifiedWhatsapp,
    trackingAudit,
    pageSpeed,
    isEnrichmentLoading,
    isTrackingLoading,
  ]);

  const isAnythingLoading = isEnrichmentLoading || isTrackingLoading || isPageSpeedLoading;

  const handleGenerateApproach = async (isVariation = false) => {
    setIsGeneratingMessage(true);
    setMessageError(null);

    try {
      const nextVariation = isVariation ? messageVariation + 1 : 0;
      const result = await generateMessage(
        {
          ...business,
          pageSpeedScore: pageSpeed?.score,
          pageSpeedDiagnostics: pageSpeed?.diagnostics || [],
          trackingAudit,
          opportunities,
        },
        {
          variationIndex: nextVariation,
          previousMessage: isVariation ? generatedMessage : '',
        }
      );

      setGeneratedMessage(result.message);
      setMessageVariation(nextVariation);
      setIsMessageCopied(false);
    } catch (error: any) {
      setMessageError(error?.message || 'Não foi possível gerar a abordagem.');
    } finally {
      setIsGeneratingMessage(false);
    }
  };

  const handleCopyMessage = async () => {
    if (!generatedMessage) return;
    await navigator.clipboard.writeText(generatedMessage);
    setIsMessageCopied(true);
    window.setTimeout(() => setIsMessageCopied(false), 1600);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/[0.48] backdrop-blur-[2px] pointer-events-auto"
        onClick={onClose}
      />

      <aside className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-white/[0.08] bg-[#090c0f]/[0.985] shadow-[-28px_0_90px_rgba(0,0,0,0.45)] backdrop-blur-2xl pointer-events-auto sm:w-[470px]">
        <header className="shrink-0 border-b border-white/[0.07] px-5 pb-5 pt-5 sm:px-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#FF641F]/15 bg-[#FF641F]/[0.10] text-[14px] font-semibold text-[#FF7A3D]">
              {getInitials(business.name)}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-[20px] font-semibold leading-tight tracking-[-0.025em] text-white">
                    {firstName(business.name)}
                  </h2>
                  <p className="mt-1 text-[11px] text-stone-400">
                    {translateCategory(business.category)}{cityLabel ? ` · ${cityLabel}` : ''}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl p-2 text-stone-600 transition hover:bg-white/[0.05] hover:text-white"
                  title="Fechar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {business.address && (
                <div className="mt-3 flex items-start gap-2 text-[10px] leading-5 text-stone-500">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{business.address}</span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleFavorite?.(business)}
              className={`inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-[10px] font-medium transition ${
                isFavorite
                  ? 'border-[#FF641F]/30 bg-[#FF641F]/[0.09] text-[#FF8B56]'
                  : 'border-white/[0.08] bg-white/[0.025] text-stone-400 hover:border-white/[0.14] hover:text-white'
              }`}
            >
              <Star className={`h-3.5 w-3.5 ${isFavorite ? 'fill-current' : ''}`} />
              {isFavorite ? 'Favoritado' : 'Favoritar'}
            </button>

            <button
              type="button"
              disabled={isInPipeline}
              onClick={() => !isInPipeline && onAddToPipeline?.(business)}
              className={`inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-[10px] font-medium transition ${
                isInPipeline
                  ? 'border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-400'
                  : 'border-white/[0.08] bg-white/[0.025] text-stone-400 hover:border-[#FF641F]/25 hover:text-white'
              }`}
            >
              {isInPipeline ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {isInPipeline ? 'No pipeline' : 'Pipeline'}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 custom-scrollbar sm:px-6">
          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-[12px] font-semibold text-white">Oportunidades de prospecção</h3>
              {isAnythingLoading && (
                <span className="flex items-center gap-1.5 text-[9px] text-stone-600">
                  <LoaderRing /> analisando
                </span>
              )}
            </div>

            <div className="rounded-2xl border border-[#FF641F]/15 bg-[#FF641F]/[0.045] p-3.5">
              {opportunities.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {opportunities.map((item) => (
                    <OpportunityChip key={item}>{item}</OpportunityChip>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] leading-5 text-stone-500">
                  Nenhuma lacuna clara foi confirmada com os dados disponíveis até agora.
                </p>
              )}
            </div>
          </section>

          <section className="mt-5">
            <div className="grid grid-cols-2 gap-2">
              <a
                href={phone ? `tel:${phone}` : undefined}
                aria-disabled={!phone}
                className={`flex h-11 items-center justify-center gap-2 rounded-xl border text-[10px] font-semibold transition ${
                  phone
                    ? 'border-white/[0.09] bg-[#111418] text-white hover:border-white/[0.16]'
                    : 'pointer-events-none border-white/[0.05] bg-white/[0.02] text-stone-700'
                }`}
              >
                <Phone className="h-3.5 w-3.5" />
                Ligar
              </a>

              <a
                href={email ? `mailto:${email}` : undefined}
                aria-disabled={!email}
                className={`flex h-11 items-center justify-center gap-2 rounded-xl border text-[10px] font-semibold transition ${
                  email
                    ? 'border-white/[0.09] bg-[#111418] text-white hover:border-white/[0.16]'
                    : 'pointer-events-none border-white/[0.05] bg-white/[0.02] text-stone-700'
                }`}
              >
                <Mail className="h-3.5 w-3.5" />
                E-mail
              </a>

              <a
                href={whatsappUrl || undefined}
                target={whatsappUrl ? '_blank' : undefined}
                rel={whatsappUrl ? 'noopener noreferrer' : undefined}
                onClick={() => whatsappUrl && recordRecommendationWhatsApp(business)}
                aria-disabled={!whatsappUrl}
                className={`flex h-11 items-center justify-center gap-2 rounded-xl border text-[10px] font-semibold transition ${
                  whatsappUrl
                    ? 'border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300 hover:bg-emerald-400/[0.10]'
                    : 'pointer-events-none border-white/[0.05] bg-white/[0.02] text-stone-700'
                }`}
              >
                <WhatsAppIcon className="h-4 w-4" />
                WhatsApp
                {verifiedWhatsapp && <CheckCircle2 className="h-3.5 w-3.5" />}
              </a>

              <button
                type="button"
                onClick={() => void handleGenerateApproach(Boolean(generatedMessage))}
                disabled={isGeneratingMessage}
                className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#FF641F] px-3 text-[10px] font-semibold text-white transition hover:bg-[#ff7335] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGeneratingMessage ? <LoaderRing /> : generatedMessage ? <RefreshCw className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                {generatedMessage ? 'Nova abordagem' : 'Abordagem com IA'}
              </button>
            </div>
          </section>

          {(generatedMessage || messageError) && (
            <section className="mt-4">
              {messageError ? (
                <div className="rounded-2xl border border-rose-400/15 bg-rose-400/[0.05] p-4 text-[10px] leading-5 text-rose-300">
                  {messageError}
                </div>
              ) : (
                <div className="rounded-2xl border border-white/[0.08] bg-[#111418] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="text-[10px] font-semibold text-white">Abordagem sugerida</span>
                    <button
                      type="button"
                      onClick={handleCopyMessage}
                      className="inline-flex items-center gap-1.5 text-[9px] text-stone-500 transition hover:text-white"
                    >
                      {isMessageCopied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      {isMessageCopied ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                  <p className="whitespace-pre-wrap text-[11px] leading-6 text-stone-300">{generatedMessage}</p>
                </div>
              )}
            </section>
          )}

          <section className="mt-6">
            <h3 className="mb-3 text-[12px] font-semibold text-white">Presença digital</h3>
            <div className="grid grid-cols-2 gap-2">
              <PresenceCard href={business.website} icon={<Globe2 className="h-4 w-4" />} label="Site" />
              <PresenceCard href={instagramUrl} icon={<InstagramIcon />} label="Instagram" />
              <PresenceCard href={facebookUrl} icon={<FacebookIcon />} label="Facebook" />
              <PresenceCard href={whatsappUrl} icon={<WhatsAppIcon />} label={verifiedWhatsapp ? 'WhatsApp' : 'WhatsApp não verificado'} verified={Boolean(verifiedWhatsapp)} />
              <PresenceCard href={googleBusinessUrl} icon={<MapPin className="h-4 w-4" />} label="Google Maps" />
              <PresenceCard href={email ? `mailto:${email}` : null} icon={<Mail className="h-4 w-4" />} label="E-mail" verified={Boolean(verifiedEmail)} />
            </div>
          </section>

          <section className="mt-6">
            <h3 className="mb-3 text-[12px] font-semibold text-white">Contato</h3>
            <div className="rounded-2xl border border-white/[0.08] bg-[#111418] px-4">
              <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] py-3">
                <span className="text-[10px] text-stone-500">Telefone</span>
                <span className="truncate text-[10px] font-medium text-stone-200">{phone || 'Não identificado'}</span>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <span className="text-[10px] text-stone-500">E-mail</span>
                <span className="truncate text-[10px] font-medium text-stone-200">{email || 'Não identificado'}</span>
              </div>
            </div>
          </section>

          {hasWebsite && (
            <section className="mt-6 pb-6">
              <h3 className="mb-3 text-[12px] font-semibold text-white">Sinais do site</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['GTM', Boolean(trackingAudit?.gtm?.detected), isTrackingLoading],
                  ['GA4', Boolean(trackingAudit?.ga4?.detected), isTrackingLoading],
                  ['Meta Pixel', Boolean(trackingAudit?.metaPixel?.detected), isTrackingLoading],
                  ['Mobile', Boolean(pageSpeed && typeof pageSpeed.score === 'number' && pageSpeed.score >= 50), isPageSpeedLoading],
                ].map(([label, ok, loading]) => (
                  <div key={String(label)} className="flex h-11 items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.025] px-3">
                    <span className="text-[10px] text-stone-400">{String(label)}</span>
                    {loading ? (
                      <LoaderRing />
                    ) : ok ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-[#FF641F]" />
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </aside>
    </>
  );
}
