import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Gauge,
  Globe2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  RefreshCw,
  Sparkles,
  Star,
  Tag,
  X,
} from 'lucide-react';
import { Business } from '../types';
import { enrichBusinessData, fetchTrackingAudit, generateMessage, getGoogleBusinessLink, getWhatsAppLink } from '../services/api';
import { translateCategory } from '../utils/categoryTranslator';
import { usePageSpeed } from '../hooks/usePageSpeed';
import { markBusinessRecentlyViewed } from '../utils/recentBusinesses';
import { recordRecommendationWhatsApp } from '../utils/recommendations';

interface BusinessSidePanelProps {
  business: Business;
  onClose: () => void;
  onToggleFavorite?: (business: Business) => void;
}

function LoaderRing({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  return (
    <span
      className={`${size === 'md' ? 'h-4 w-4 border-2' : 'h-3.5 w-3.5 border-[1.5px]'} inline-block shrink-0 animate-spin rounded-full border-white/[0.10] border-t-[#FF4D00]`}
      aria-label="Carregando"
    />
  );
}

function StatusIcon({ ok, loading = false }: { ok: boolean; loading?: boolean }) {
  if (loading) return <LoaderRing />;

  return ok ? (
    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
  ) : (
    <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
  );
}

function SignalRow({
  icon,
  label,
  value,
  detected,
  loading,
  title,
  action,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detected: boolean;
  loading?: boolean;
  title?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 py-3 border-b border-white/[0.07] last:border-b-0"
      title={title}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-stone-600">{icon}</span>
        <div className="min-w-0">
          <span className="block text-[10px] font-medium text-stone-600">{label}</span>
          <span className="mt-0.5 block truncate text-[11px] font-semibold text-stone-200">
            {loading ? 'Verificando' : value}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {action}
        <StatusIcon ok={detected} loading={loading} />
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-white/[0.07] last:border-b-0">
      <span className="text-[10px] text-stone-600">{label}</span>
      <span className="max-w-[64%] text-right text-[10px] font-medium text-stone-600">
        {value}
      </span>
    </div>
  );
}

function TrackingItem({
  label,
  ok,
  loading,
}: {
  label: string;
  ok: boolean;
  loading?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-[#15191e] px-3 py-2.5">
      <span className="text-[10px] font-medium text-stone-600">{label}</span>
      <StatusIcon ok={ok} loading={loading} />
    </div>
  );
}

function SectionTitle({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="text-[#FF6A26]">{icon}</span>
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-500">
        {children}
      </span>
    </div>
  );
}

export default function BusinessSidePanel({
  business,
  onClose,
  onToggleFavorite,
}: BusinessSidePanelProps) {
  const [enrichment, setEnrichment] = useState<any>(null);
  const [trackingAudit, setTrackingAudit] = useState<any>(null);
  const [isEnrichmentLoading, setIsEnrichmentLoading] = useState(false);
  const [isTrackingLoading, setIsTrackingLoading] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [messageVariation, setMessageVariation] = useState(0);
  const [messageSource, setMessageSource] = useState<'gemini' | 'openrouter' | 'template' | null>(null);
  const [messageModel, setMessageModel] = useState('');
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
    setCopiedPhone(false);
    setGeneratedMessage('');
    setMessageVariation(0);
    setMessageSource(null);
    setMessageModel('');
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
      .catch((error) => {
        console.warn('[Scoutly Side Panel Enrichment]:', error);
      })
      .finally(() => {
        if (!cancelled) setIsEnrichmentLoading(false);
      });

    fetchTrackingAudit(business.website)
      .then((audit) => {
        if (!cancelled) setTrackingAudit(audit);
      })
      .catch((error) => {
        console.warn('[Scoutly Side Panel Tracking]:', error);
      })
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
    const current = enrichment?.socials && typeof enrichment.socials === 'object'
      ? Object.entries(enrichment.socials)
          .map(([network, item]: any) => ({
            network,
            url: item?.value,
          }))
          .filter((item) => Boolean(item.url))
      : [];

    if (current.length > 0) return current.slice(0, 4);

    return (business.socials || [])
      .filter(Boolean)
      .slice(0, 4)
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
  }, [enrichment, business.socials]);

  const whatsappUrl = verifiedWhatsapp ? getWhatsAppLink(verifiedWhatsapp) : null;
  const phoneToCopy = verifiedPhone || business.phone || business.phones?.[0] || null;
  const googleBusinessUrl = getGoogleBusinessLink(business);
  const trackingDetected = Boolean(trackingAudit?.hasTracking);
  const pageSpeedDetected = Boolean(pageSpeed && typeof pageSpeed.score === 'number');
  const isFavorite = Boolean(business.isFavorite);
  const confidencePercent = Math.round((business.confidence || 0) * 100);

  const opportunities = useMemo(() => {
    const list: string[] = [];

    if (!hasWebsite) list.push('Site não identificado');
    if (hasWebsite && !verifiedWhatsapp && !isEnrichmentLoading) list.push('WhatsApp não confirmado');
    if (hasWebsite && !trackingAudit?.ga4?.detected && !isTrackingLoading) list.push('GA4 não confirmado');
    if (hasWebsite && !trackingAudit?.gtm?.detected && !isTrackingLoading) list.push('GTM não confirmado');
    if (hasWebsite && !trackingAudit?.metaPixel?.detected && !isTrackingLoading) list.push('Meta Pixel não confirmado');
    if (hasWebsite && !trackingAudit?.cookieConsent?.detected && !isTrackingLoading) list.push('Consentimento de cookies não confirmado');
    if (pageSpeedDetected && pageSpeed && pageSpeed.score < 50) list.push('Performance mobile crítica');

    return list.slice(0, 5);
  }, [
    hasWebsite,
    verifiedWhatsapp,
    trackingAudit,
    pageSpeedDetected,
    pageSpeed,
    isEnrichmentLoading,
    isTrackingLoading,
  ]);

  const isAnythingLoading = isEnrichmentLoading || isTrackingLoading || isPageSpeedLoading;

  const handleCopyPhone = async () => {
    if (!phoneToCopy) return;
    await navigator.clipboard.writeText(phoneToCopy);
    setCopiedPhone(true);
    window.setTimeout(() => setCopiedPhone(false), 1600);
  };

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
      setMessageSource(result.source);
      setMessageModel(result.model || '');
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
        className="fixed inset-0 z-40 bg-black/[0.42] backdrop-blur-[2px] pointer-events-auto"
        onClick={onClose}
      />

      <aside className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-white/[0.08] bg-[#0b0e12]/[0.98] shadow-[0_0_70px_rgba(0,0,0,0.45)] backdrop-blur-2xl pointer-events-auto sm:w-[440px]">
        <div className="shrink-0 border-b border-white/[0.08] bg-[#101318] px-5 py-5">
          <div className="mb-4 h-[3px] w-12 rounded-full bg-[#FF5A12]" />

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-[18px] font-semibold tracking-tight text-white">
                  {business.name}
                </h2>
                <button
                  type="button"
                  onClick={() => onToggleFavorite?.(business)}
                  className="shrink-0 rounded-lg p-1 text-stone-600 transition hover:bg-white/[0.06] hover:text-stone-500"
                  title={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                >
                  <Star className={`h-4 w-4 ${isFavorite ? 'fill-[#FF6A26] text-[#FF6A26]' : ''}`} />
                </button>
              </div>

              <p className="mt-1 text-[11px] font-medium text-stone-500">
                {translateCategory(business.category)}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-xl p-2 text-stone-600 transition hover:bg-white/[0.06] hover:text-stone-600"
              title="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {business.address && (
            <div className="mt-4 flex items-start gap-2 text-[10px] leading-relaxed text-stone-500">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FF6A26]" />
              <span>{business.address}</span>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={googleBusinessUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.09] bg-[#15191e] px-3 py-2 text-[10px] font-semibold text-stone-600 transition hover:border-[#FF5A12]/40 hover:bg-[#FF5A12]/[0.08]"
              title="Abrir este negócio no Google Maps"
            >
              <MapPin className="h-3.5 w-3.5 text-[#FF6A26]" />
              Ver no Google
              <ExternalLink className="h-3 w-3 text-stone-600" />
            </a>

            {hasWebsite && (
              <a
                href={business.website!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.09] bg-[#15191e] px-3 py-2 text-[10px] font-semibold text-stone-600 transition hover:border-[#FF5A12]/40 hover:bg-[#FF5A12]/[0.08]"
              >
                <Globe2 className="h-3.5 w-3.5 text-[#FF6A26]" />
                Ver site
                <ExternalLink className="h-3 w-3 text-stone-600" />
              </a>
            )}

            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => recordRecommendationWhatsApp(business)}
                title="Este número de WhatsApp foi verificado com base nas informações disponibilizadas pela empresa no site"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/[0.08]0/90 px-3 py-2 text-[10px] font-semibold text-white transition hover:bg-emerald-500/[0.08]0"
              >
                <img
                  src="/whatsapp_icone.png"
                  alt=""
                  className="h-4 w-4 object-contain"
                />
                WhatsApp
                <CheckCircle2 className="h-3.5 w-3.5 text-white/90" />
              </a>
            )}

            {!whatsappUrl && verifiedPhone && (
              <a
                href={`tel:${verifiedPhone}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.09] bg-[#15191e] px-3 py-2 text-[10px] font-semibold text-stone-600 transition hover:border-[#FF5A12]/40 hover:bg-[#FF5A12]/[0.08]"
              >
                <Phone className="h-3.5 w-3.5 text-[#FF6A26]" />
                Ligar
              </a>
            )}
          </div>

          {isAnythingLoading && (
            <div className="mt-4 flex items-center gap-2 text-[9px] font-medium text-stone-600">
              <LoaderRing />
              Atualizando sinais do negócio
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 custom-scrollbar">
          <section>
            <SectionTitle icon={<Activity className="h-4 w-4" />}>
              Visão rápida
            </SectionTitle>

            <div className="rounded-2xl border border-white/[0.08] bg-[#111418] px-3.5">
              <SignalRow
                icon={<Globe2 className="h-4 w-4" />}
                label="Site"
                value={hasWebsite ? 'Identificado' : 'Não identificado'}
                detected={hasWebsite}
              />

              <SignalRow
                icon={<MessageCircle className="h-4 w-4" />}
                label="WhatsApp"
                value={verifiedWhatsapp || 'Não confirmado'}
                detected={Boolean(verifiedWhatsapp)}
                loading={hasWebsite && isEnrichmentLoading}
                title={
                  verifiedWhatsapp
                    ? 'Este número de WhatsApp foi verificado com base nas informações disponibilizadas pela empresa no site'
                    : undefined
                }
              />

              <SignalRow
                icon={<Activity className="h-4 w-4" />}
                label="Tracking"
                value={trackingDetected ? 'Detectado' : 'Não confirmado'}
                detected={trackingDetected}
                loading={hasWebsite && isTrackingLoading}
              />

              <SignalRow
                icon={<Gauge className="h-4 w-4" />}
                label="PageSpeed mobile"
                value={pageSpeedDetected && pageSpeed ? `${pageSpeed.score}/100` : 'Indisponível'}
                detected={pageSpeedDetected}
                loading={hasWebsite && isPageSpeedLoading}
              />
            </div>
          </section>

          <section className="mt-6">
            <SectionTitle icon={<Phone className="h-4 w-4" />}>
              Contato atual
            </SectionTitle>

            <div className="rounded-2xl border border-white/[0.08] bg-[#111418] px-3.5">
              <SignalRow
                icon={<Phone className="h-4 w-4" />}
                label="Telefone"
                value={phoneToCopy || 'Não identificado'}
                detected={Boolean(verifiedPhone)}
                loading={hasWebsite && isEnrichmentLoading}
                action={
                  phoneToCopy ? (
                    <button
                      type="button"
                      onClick={handleCopyPhone}
                      className="rounded-md p-1.5 text-stone-600 transition hover:bg-white/[0.06] hover:text-[#FF6A26]"
                      title={copiedPhone ? 'Número copiado' : 'Copiar número'}
                    >
                      {copiedPhone ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  ) : undefined
                }
              />

              <SignalRow
                icon={<Mail className="h-4 w-4" />}
                label="Email"
                value={verifiedEmail || business.email || 'Não identificado'}
                detected={Boolean(verifiedEmail)}
                loading={hasWebsite && isEnrichmentLoading}
              />

              <SignalRow
                icon={<MessageCircle className="h-4 w-4" />}
                label="WhatsApp"
                value={verifiedWhatsapp || 'Não confirmado'}
                detected={Boolean(verifiedWhatsapp)}
                loading={hasWebsite && isEnrichmentLoading}
                title={
                  verifiedWhatsapp
                    ? 'Este número de WhatsApp foi verificado com base nas informações disponibilizadas pela empresa no site'
                    : undefined
                }
              />
            </div>
          </section>

          <section className="mt-6">
            <SectionTitle icon={<Sparkles className="h-4 w-4" />}>
              Gerar abordagem
            </SectionTitle>

            <div className="rounded-2xl border border-white/[0.08] bg-[#111418] p-3.5">
              {!generatedMessage && !messageError && (
                <p className="text-[10px] leading-relaxed text-stone-500">
                  Crie uma primeira mensagem usando os sinais encontrados para este negócio.
                </p>
              )}

              {messageError && (
                <p className="rounded-lg bg-rose-500/[0.08]0/[0.08] px-3 py-2 text-[10px] text-rose-400">
                  {messageError}
                </p>
              )}

              {generatedMessage && (
                <div className="rounded-xl border border-[#FF4D00]/15 bg-[#FFF8F4] p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span
                      className="text-[9px] font-semibold uppercase tracking-wider text-[#D94400]"
                      title={messageModel || undefined}
                    >
                      {messageSource === 'template' ? 'Fallback local' : 'Abordagem com IA'}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyMessage}
                      className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[9px] font-semibold text-stone-500 transition hover:bg-[#15191e] hover:text-[#FF6A26]"
                    >
                      {isMessageCopied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      {isMessageCopied ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                  <p className="whitespace-pre-wrap text-[10px] leading-relaxed text-stone-600">
                    {generatedMessage}
                  </p>
                </div>
              )}

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => handleGenerateApproach(Boolean(generatedMessage))}
                  disabled={isGeneratingMessage}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#FF5A12] px-3 py-2.5 text-[10px] font-semibold text-white transition hover:bg-[#E04400] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isGeneratingMessage ? (
                    <LoaderRing />
                  ) : generatedMessage ? (
                    <RefreshCw className="h-3.5 w-3.5" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {isGeneratingMessage ? 'Gerando' : generatedMessage ? 'Nova variação' : 'Gerar abordagem'}
                </button>
              </div>
            </div>
          </section>

          <section className="mt-6">
            <SectionTitle icon={<Tag className="h-4 w-4" />}>
              Sinais digitais
            </SectionTitle>

            <div className="grid grid-cols-2 gap-2">
              <TrackingItem
                label="GA4"
                ok={Boolean(trackingAudit?.ga4?.detected)}
                loading={hasWebsite && isTrackingLoading}
              />
              <TrackingItem
                label="GTM"
                ok={Boolean(trackingAudit?.gtm?.detected)}
                loading={hasWebsite && isTrackingLoading}
              />
              <TrackingItem
                label="Meta Pixel"
                ok={Boolean(trackingAudit?.metaPixel?.detected)}
                loading={hasWebsite && isTrackingLoading}
              />
              <TrackingItem
                label="Cookies"
                ok={Boolean(trackingAudit?.cookieConsent?.detected)}
                loading={hasWebsite && isTrackingLoading}
              />
            </div>
          </section>

          {pageSpeed && (
            <section className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <SectionTitle icon={<Gauge className="h-4 w-4" />}>
                  Performance mobile
                </SectionTitle>

                <span className="mb-3 rounded-full border border-[#FF4D00]/20 bg-[#FFF3EC] px-2.5 py-1 text-[10px] font-semibold text-[#D94400]">
                  {pageSpeed.score}/100
                </span>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-[#111418] p-3.5">
                <div className="grid grid-cols-4 gap-2">
                  {[
                    ['FCP', pageSpeed.fcp || '-'],
                    ['LCP', pageSpeed.lcp || '-'],
                    ['TBT', pageSpeed.tbt || '-'],
                    ['CLS', pageSpeed.cls || '-'],
                  ].map(([label, value]) => (
                    <div key={label} className="text-center">
                      <span className="block text-[8px] font-semibold text-stone-600">{label}</span>
                      <span className="mt-1 block text-[10px] font-semibold text-stone-600">{value}</span>
                    </div>
                  ))}
                </div>

                {pageSpeed.opportunityTitle && (
                  <div className="mt-3 border-t border-white/[0.07] pt-3">
                    <span className="text-[10px] font-semibold text-stone-200">
                      {pageSpeed.opportunityTitle}
                    </span>
                    {pageSpeed.opportunityDescription && (
                      <p className="mt-1 text-[9px] leading-relaxed text-stone-500">
                        {pageSpeed.opportunityDescription}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}

          <section className="mt-6">
            <SectionTitle icon={<Building2 className="h-4 w-4" />}>
              Dados do negócio
            </SectionTitle>

            <div className="rounded-2xl border border-white/[0.08] bg-[#111418] px-3.5">
              <DetailRow label="Confiança da fonte" value={`${confidencePercent}%`} />
              <DetailRow
                label="Status"
                value={business.openStatusText || business.operatingStatus || 'Não identificado'}
              />
              <DetailRow label="Fonte" value={business.source || 'Não identificada'} />
              {(business.cnpj || enrichment?.cnpj?.[0]?.value) && (
                <DetailRow
                  label="CNPJ"
                  value={business.cnpj || enrichment.cnpj[0].value}
                />
              )}
            </div>
          </section>

          {socialLinks.length > 0 && (
            <section className="mt-6">
              <SectionTitle icon={<Globe2 className="h-4 w-4" />}>
                Presença digital
              </SectionTitle>

              <div className="flex flex-wrap gap-2">
                {socialLinks.map((item) => (
                  <a
                    key={item.url}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.09] bg-[#15191e] px-2.5 py-1.5 text-[9px] font-medium text-stone-600 transition hover:border-[#FF5A12]/40 hover:bg-[#FF5A12]/[0.08]"
                  >
                    {item.network}
                    <ExternalLink className="h-3 w-3 text-stone-600" />
                  </a>
                ))}
              </div>
            </section>
          )}

          {opportunities.length > 0 && (
            <section className="mt-6 pb-3">
              <SectionTitle icon={<AlertCircle className="h-4 w-4" />}>
                Oportunidades
              </SectionTitle>

              <div className="rounded-2xl border border-white/[0.08] bg-[#111418] px-3.5">
                {opportunities.map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-2 py-2.5 border-b border-white/[0.07] last:border-b-0 text-[10px] text-stone-600"
                  >
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                    <span>{item}</span>
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
