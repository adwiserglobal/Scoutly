import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  Gauge,
  Globe2,
  Lock,
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
import { normalizeExternalUrl } from '../utils/externalUrl';
import BrandIcon, { brandFromUrl, type BrandName } from './BrandIcon';

interface BusinessSidePanelProps {
  business: Business;
  onClose: () => void;
  onToggleFavorite?: (business: Business) => void;
}

function LoaderRing({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  return (
    <span
      className={`${size === 'md' ? 'h-4 w-4 border-2' : 'h-3.5 w-3.5 border-[1.5px]'} inline-block shrink-0 animate-spin rounded-full border-white/[0.12] border-t-[#FF4D00]`}
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

function SignalRow({ icon, label, value, detected, loading, title, action, valueClassName = '' }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detected: boolean;
  loading?: boolean;
  title?: string;
  action?: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] py-3 last:border-b-0" title={title}>
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-stone-300">{icon}</span>
        <div className="min-w-0">
          <span className="block text-[10px] font-medium text-stone-300">{label}</span>
          <span className={`mt-0.5 block truncate text-[11px] font-semibold text-stone-100 ${valueClassName}`}>
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] py-2.5 last:border-b-0">
      <span className="text-[10px] text-stone-300">{label}</span>
      <span className="max-w-[64%] text-right text-[10px] font-medium text-stone-200">{value}</span>
    </div>
  );
}

function TrackingItem({ label, ok, loading }: { label: string; ok: boolean; loading?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-[#15191e] px-3 py-2.5">
      <span className="text-[10px] font-medium text-stone-300">{label}</span>
      <StatusIcon ok={ok} loading={loading} />
    </div>
  );
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="text-[#FF6A26]">{icon}</span>
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-300">{children}</span>
    </div>
  );
}

function SocialLogo({ network, url }: { network: string; url?: string }) {
  const normalized = network.toLowerCase();
  let brand: BrandName | null = url ? brandFromUrl(url) : null;
  if (!brand) {
    if (normalized.includes('instagram')) brand = 'instagram';
    else if (normalized.includes('facebook')) brand = 'facebook';
    else if (normalized.includes('whatsapp')) brand = 'whatsapp';
    else if (normalized.includes('youtube')) brand = 'youtube';
    else if (normalized.includes('tiktok')) brand = 'tiktok';
    else if (normalized.includes('linkedin')) brand = 'linkedin';
  }
  if (brand) return <BrandIcon brand={brand} className="h-4 w-4" alt={network} />;
  return <Globe2 className="h-4 w-4 text-stone-300" />;
}

function normalizeWebsiteDomain(website?: string | null) {
  const raw = String(website || '').trim();
  if (!raw) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return url.hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return raw
      .replace(/^https?:\/\//i, '')
      .split('/')[0]
      .replace(/^www\./i, '')
      .trim()
      .toLowerCase() || null;
  }
}

function isLockedEmail(value?: string | null) {
  return Boolean(value && value.includes('•'));
}

export default function BusinessSidePanel({ business, onClose, onToggleFavorite }: BusinessSidePanelProps) {
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
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const baseWebsiteUrl = useMemo(() => normalizeExternalUrl(business.website), [business.website]);
  const discoveredWebsiteUrl = useMemo(
    () => normalizeExternalUrl(enrichment?.discoveredWebsite || enrichment?.placeSignal?.website),
    [enrichment?.discoveredWebsite, enrichment?.placeSignal?.website]
  );
  const websiteUrl = baseWebsiteUrl || discoveredWebsiteUrl;
  const hasWebsite = Boolean(websiteUrl);
  const autoEnrichEnabled = localStorage.getItem('scoutly_auto_enrich') !== 'false';
  const { data: pageSpeed, isLoading: isPageSpeedLoading } = usePageSpeed(autoEnrichEnabled ? websiteUrl : null);

  useEffect(() => {
    markBusinessRecentlyViewed(business.id, business);
    setCopiedPhone(false);
    setGeneratedMessage('');
    setMessageVariation(0);
    setMessageSource(null);
    setMessageModel('');
    setMessageError(null);
    setIsMessageCopied(false);
    setIsGeneratingEmail(false);
    setEmailError(null);
  }, [business.id]);

  useEffect(() => {
    let cancelled = false;
    setEnrichment(null);
    setTrackingAudit(null);

    if (!autoEnrichEnabled) {
      setIsEnrichmentLoading(false);
      setIsTrackingLoading(false);
      return () => { cancelled = true; };
    }

    setIsEnrichmentLoading(true);
    setIsTrackingLoading(true);

    enrichBusinessData(baseWebsiteUrl, false, business.id, {
      name: business.name,
      address: business.address,
      phone: business.phone || business.phones?.[0] || null,
      latitude: business.latitude,
      longitude: business.longitude,
    })
      .then((data) => {
        if (cancelled) return;
        setEnrichment(data);
        setTrackingAudit(data?.trackingAudit || null);
      })
      .catch((error) => console.warn('[Scoutly Side Panel Enrichment]:', error))
      .finally(() => {
        if (!cancelled) {
          setIsEnrichmentLoading(false);
          setIsTrackingLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [business.id, baseWebsiteUrl, autoEnrichEnabled]);

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
      ? Object.entries(enrichment.socials).map(([network, item]: any) => ({ network, url: item?.value })).filter((item) => Boolean(item.url))
      : [];

    if (current.length > 0) return current.slice(0, 4);

    return (business.socials || []).filter(Boolean).slice(0, 4).map((url) => ({
      network: url.includes('instagram') ? 'Instagram'
        : url.includes('facebook') ? 'Facebook'
        : url.includes('youtube') || url.includes('youtu.be') ? 'YouTube'
        : url.includes('tiktok') ? 'TikTok'
        : url.includes('linkedin') ? 'LinkedIn'
        : url.includes('wa.me') || url.includes('whatsapp') ? 'WhatsApp'
        : 'Rede social',
      url,
    }));
  }, [enrichment, business.socials]);

  const placeSignalPhone = enrichment?.placeSignal?.phone || enrichment?.placeSignal?.phones?.[0] || null;
  const phoneToCopy = verifiedPhone || placeSignalPhone || business.phone || business.phones?.[0] || null;
  const whatsappNumber = verifiedWhatsapp || phoneToCopy;
  const whatsappUrl = getWhatsAppLink(whatsappNumber);
  const rawEmailAddress = verifiedEmail || business.email || business.emails?.[0] || null;
  const emailLocked = isLockedEmail(rawEmailAddress) || Boolean((business as any).emailLocked);
  const emailAddress = emailLocked ? null : rawEmailAddress;
  const googleBusinessUrl = getGoogleBusinessLink(business);
  const websiteDomain = useMemo(() => normalizeWebsiteDomain(websiteUrl), [websiteUrl]);
  const googleAdsTransparencyUrl = websiteDomain
    ? `https://adstransparency.google.com/?domain=${encodeURIComponent(websiteDomain)}&region=anywhere`
    : null;
  const metaAdsLibraryUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=${encodeURIComponent(business.name)}&media_type=all`;
  const trackingDetected = Boolean(trackingAudit?.hasTracking);
  const pageSpeedDetected = Boolean(pageSpeed && typeof pageSpeed.score === 'number');
  const isFavorite = Boolean(business.isFavorite);
  const confidencePercent = Math.round((business.confidence || 0) * 100);

  const opportunities = useMemo(() => {
    const list: string[] = [];
    if (!hasWebsite) list.push('Site não identificado');
    if (phoneToCopy && !verifiedWhatsapp && !isEnrichmentLoading) list.push('WhatsApp não confirmado');
    if (hasWebsite && !trackingAudit?.ga4?.detected && !isTrackingLoading) list.push('GA4 não confirmado');
    if (hasWebsite && !trackingAudit?.gtm?.detected && !isTrackingLoading) list.push('GTM não confirmado');
    if (hasWebsite && !trackingAudit?.metaPixel?.detected && !isTrackingLoading) list.push('Meta Pixel não confirmado');
    if (hasWebsite && !trackingAudit?.cookieConsent?.detected && !isTrackingLoading) list.push('Consentimento de cookies não confirmado');
    if (pageSpeedDetected && pageSpeed && pageSpeed.score < 50) list.push('Performance mobile crítica');
    return list.slice(0, 5);
  }, [hasWebsite, phoneToCopy, verifiedWhatsapp, trackingAudit, pageSpeedDetected, pageSpeed, isEnrichmentLoading, isTrackingLoading]);

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
        { ...business, pageSpeedScore: pageSpeed?.score, pageSpeedDiagnostics: pageSpeed?.diagnostics || [], trackingAudit, opportunities },
        { variationIndex: nextVariation, previousMessage: isVariation ? generatedMessage : '' }
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

  const handleSendEmail = async () => {
    if (!emailAddress || isGeneratingEmail) return;
    setIsGeneratingEmail(true);
    setEmailError(null);

    try {
      const response = await fetch('/api/ai/generate-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'email',
          business: { ...business, pageSpeedScore: pageSpeed?.score, pageSpeedDiagnostics: pageSpeed?.diagnostics || [], trackingAudit, opportunities },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.message) throw new Error(data?.error || 'Não foi possível preparar o e-mail.');

      const subject = data.subject || `Uma ideia para ${business.name}`;
      window.location.href = `mailto:${emailAddress}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(data.message)}`;
    } catch (error: any) {
      setEmailError(error?.message || 'Não foi possível preparar o e-mail.');
    } finally {
      setIsGeneratingEmail(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/[0.42] backdrop-blur-[2px] pointer-events-auto" onClick={onClose} />

      <aside className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-white/[0.08] bg-[#0b0e12]/[0.98] shadow-[0_0_70px_rgba(0,0,0,0.45)] backdrop-blur-2xl pointer-events-auto sm:w-[440px]">
        <div className="shrink-0 border-b border-white/[0.08] bg-[#101318] px-5 py-5">
          <div className="mb-4 h-[3px] w-12 rounded-full bg-[#FF5A12]" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-[18px] font-semibold tracking-tight text-white">{business.name}</h2>
                <button type="button" onClick={() => onToggleFavorite?.(business)} className="shrink-0 rounded-lg p-1 text-stone-300 transition hover:bg-white/[0.06] hover:text-white" title={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}>
                  <Star className={`h-4 w-4 ${isFavorite ? 'fill-[#FF6A26] text-[#FF6A26]' : ''}`} />
                </button>
              </div>
              <p className="mt-1 text-[11px] font-medium text-stone-300">{translateCategory(business.category)}</p>
            </div>
            <button type="button" onClick={onClose} className="shrink-0 rounded-xl p-2 text-stone-300 transition hover:bg-white/[0.06] hover:text-white" title="Fechar">
              <X className="h-5 w-5" />
            </button>
          </div>

          {business.address && (
            <div className="mt-4 flex items-start gap-2 text-[10px] leading-relaxed text-stone-300">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FF6A26]" />
              <span>{business.address}</span>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <a href={googleBusinessUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.10] bg-[#15191e] px-3 py-2 text-[10px] font-semibold text-stone-200 transition hover:border-[#FF5A12]/40 hover:bg-[#FF5A12]/[0.08]">
              <BrandIcon brand="googleMaps" className="h-4 w-4" alt="Google Maps" /> Ver no Google Maps
            </a>
            {hasWebsite && (
              <a href={websiteUrl!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.10] bg-[#15191e] px-3 py-2 text-[10px] font-semibold text-stone-200 transition hover:border-[#FF5A12]/40 hover:bg-[#FF5A12]/[0.08]">
                <Globe2 className="h-3.5 w-3.5 text-[#FF6A26]" /> Ver site
              </a>
            )}
            {phoneToCopy && (
              <a href={`tel:${phoneToCopy}`} className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.10] bg-[#15191e] px-3 py-2 text-[10px] font-semibold text-stone-200 transition hover:border-[#FF5A12]/40 hover:bg-[#FF5A12]/[0.08]">
                <Phone className="h-3.5 w-3.5 text-[#FF6A26]" /> Ligar
              </a>
            )}
            {whatsappUrl && (
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" onClick={() => recordRecommendationWhatsApp(business)} className="inline-flex items-center gap-2 rounded-xl border border-white/[0.10] bg-[#15191e] px-3 py-2 text-[10px] font-semibold text-stone-100 transition hover:border-emerald-500/35 hover:bg-emerald-500/[0.08]" title={verifiedWhatsapp ? 'WhatsApp verificado' : 'Número disponível, WhatsApp não confirmado'}>
                <BrandIcon brand="whatsapp" className="h-4 w-4" alt="WhatsApp" /> WhatsApp
                {verifiedWhatsapp ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <AlertCircle className="h-3.5 w-3.5 text-rose-400" />}
              </a>
            )}
          </div>

          {isAnythingLoading && (
            <div className="mt-4 flex items-center gap-2 text-[9px] font-medium text-stone-300"><LoaderRing /> Atualizando sinais do negócio</div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 custom-scrollbar">
          <section>
            <SectionTitle icon={<Globe2 className="h-4 w-4" />}>Presença digital</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {hasWebsite && (
                <a href={websiteUrl!} target="_blank" rel="noopener noreferrer" className="group inline-flex items-center gap-2 rounded-xl border border-white/[0.10] bg-[#15191e] px-3 py-2.5 text-[10px] font-semibold text-stone-100 transition hover:border-[#FF5A12]/35 hover:bg-[#FF5A12]/[0.08]">
                  <Globe2 className="h-4 w-4 text-[#FF6A26]" /> Site
                  <ChevronRight className="h-3.5 w-3.5 text-stone-400 transition-transform group-hover:translate-x-0.5 group-hover:text-[#FF6A26]" />
                </a>
              )}
              {socialLinks.map((item) => (
                <a key={item.url} href={item.url} target="_blank" rel="noopener noreferrer" className="group inline-flex items-center gap-2 rounded-xl border border-white/[0.10] bg-[#15191e] px-3 py-2.5 text-[10px] font-semibold text-stone-100 transition hover:border-[#FF5A12]/35 hover:bg-[#FF5A12]/[0.08]">
                  <SocialLogo network={item.network} url={item.url} /> {item.network}
                  <ChevronRight className="h-3.5 w-3.5 text-stone-400 transition-transform group-hover:translate-x-0.5 group-hover:text-[#FF6A26]" />
                </a>
              ))}
              {!hasWebsite && socialLinks.length === 0 && (
                <div className="rounded-xl border border-white/[0.08] bg-[#111418] px-3 py-2.5 text-[10px] text-stone-300">Nenhum canal digital identificado</div>
              )}
            </div>
          </section>

          {opportunities.length > 0 && (
            <section className="mt-6">
              <SectionTitle icon={<AlertCircle className="h-4 w-4" />}>Oportunidades</SectionTitle>
              <div className="rounded-2xl border border-white/[0.08] bg-[#111418] px-3.5">
                {opportunities.map((item) => (
                  <div key={item} className="flex items-center gap-2 border-b border-white/[0.07] py-2.5 text-[10px] font-medium text-stone-200 last:border-b-0">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-400" /><span>{item}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="mt-6">
            <SectionTitle icon={<Activity className="h-4 w-4" />}>Anúncios públicos</SectionTitle>
            <p className="mb-3 text-[9px] leading-relaxed text-stone-300">
              Verifique nas bibliotecas oficiais se encontramos anúncios associados a este negócio.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <a
                href={metaAdsLibraryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex min-w-0 items-center gap-2.5 rounded-xl border border-white/[0.10] bg-[#15191e] px-3 py-2.5 transition hover:border-[#1877F2]/40 hover:bg-[#1877F2]/[0.06]"
                title={`Pesquisar ${business.name} na Biblioteca de Anúncios da Meta`}
              >
                <BrandIcon brand="meta" className="h-6 w-6" alt="Meta" />
                <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-stone-100">Meta Ads</span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-stone-400 transition-transform group-hover:translate-x-0.5 group-hover:text-[#1877F2]" />
              </a>

              {googleAdsTransparencyUrl ? (
                <a
                  href={googleAdsTransparencyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex min-w-0 items-center gap-2.5 rounded-xl border border-white/[0.10] bg-[#15191e] px-3 py-2.5 transition hover:border-[#4285F4]/40 hover:bg-[#4285F4]/[0.06]"
                  title={`Pesquisar ${websiteDomain} no Google Ads Transparency Center`}
                >
                  <BrandIcon brand="googleAds" className="h-6 w-6 rounded-md bg-white" alt="Google Ads" />
                  <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-stone-100">Google Ads</span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-stone-400 transition-transform group-hover:translate-x-0.5 group-hover:text-[#4285F4]" />
                </a>
              ) : (
                <div
                  className="flex min-w-0 items-center gap-2.5 rounded-xl border border-white/[0.06] bg-[#111418] px-3 py-2.5 opacity-55"
                  title="A busca direta do Google fica disponível quando o negócio possui um site identificado"
                >
                  <BrandIcon brand="googleAds" className="h-6 w-6 rounded-md bg-white grayscale-[0.2]" alt="Google Ads" />
                  <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-stone-300">Google Ads</span>
                </div>
              )}
            </div>
          </section>

          <section className="mt-6">
            <SectionTitle icon={<Activity className="h-4 w-4" />}>Visão rápida</SectionTitle>
            <div className="rounded-2xl border border-white/[0.08] bg-[#111418] px-3.5">
              <SignalRow icon={<Globe2 className="h-4 w-4" />} label="Site" value={hasWebsite ? 'Identificado' : 'Não identificado'} detected={hasWebsite} />
              <SignalRow icon={<BrandIcon brand="whatsapp" className="h-4 w-4" alt="WhatsApp" />} label="WhatsApp" value={whatsappNumber || 'Não identificado'} detected={Boolean(verifiedWhatsapp)} loading={hasWebsite && isEnrichmentLoading} title={verifiedWhatsapp ? 'WhatsApp verificado' : 'Número disponível, WhatsApp não confirmado'} />
              <SignalRow icon={<Activity className="h-4 w-4" />} label="Tracking" value={trackingDetected ? 'Detectado' : 'Não confirmado'} detected={trackingDetected} loading={hasWebsite && isTrackingLoading} />
              <SignalRow icon={<Gauge className="h-4 w-4" />} label="PageSpeed mobile" value={pageSpeedDetected && pageSpeed ? `${pageSpeed.score}/100` : 'Indisponível'} detected={pageSpeedDetected} loading={hasWebsite && isPageSpeedLoading} />
            </div>
          </section>

          <section className="mt-6">
            <SectionTitle icon={<Phone className="h-4 w-4" />}>Contato atual</SectionTitle>
            <div className="rounded-2xl border border-white/[0.08] bg-[#111418] px-3.5">
              <SignalRow icon={<Phone className="h-4 w-4" />} label="Telefone" value={phoneToCopy || 'Não identificado'} detected={Boolean(phoneToCopy)} loading={hasWebsite && isEnrichmentLoading} action={phoneToCopy ? (
                <button type="button" onClick={handleCopyPhone} className="rounded-md p-1.5 text-stone-300 transition hover:bg-white/[0.06] hover:text-[#FF6A26]" title={copiedPhone ? 'Número copiado' : 'Copiar número'}>
                  {copiedPhone ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              ) : undefined} />
              <SignalRow
                icon={<Mail className="h-4 w-4" />}
                label="Email"
                value={emailLocked ? 'contato@empresa.com' : (emailAddress || 'Não identificado')}
                detected={Boolean(rawEmailAddress)}
                loading={hasWebsite && isEnrichmentLoading}
                valueClassName={emailLocked ? 'select-none blur-[4px]' : ''}
                action={emailLocked ? (
                  <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('scoutly-open-plans'))} className="inline-flex items-center gap-1 rounded-lg border border-[#FF5A12]/20 bg-[#FF5A12]/[0.08] px-2 py-1 text-[9px] font-semibold text-[#FF8A52]" title="E-mail completo disponível nos planos pagos">
                    <Lock className="h-3 w-3" /> Pro
                  </button>
                ) : emailAddress ? (
                  <button type="button" onClick={handleSendEmail} disabled={isGeneratingEmail} className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.09] bg-white/[0.04] px-2.5 py-1.5 text-[9px] font-semibold text-stone-200 transition hover:border-[#FF5A12]/35 hover:text-white disabled:cursor-not-allowed disabled:opacity-60" title="Gerar uma mensagem com IA e abrir no seu cliente de e-mail">
                    {isGeneratingEmail ? <LoaderRing /> : <Mail className="h-3 w-3 text-[#FF6A26]" />}{isGeneratingEmail ? 'Preparando' : 'Enviar'}
                  </button>
                ) : undefined}
              />
              <SignalRow icon={<BrandIcon brand="whatsapp" className="h-4 w-4" alt="WhatsApp" />} label="WhatsApp" value={whatsappNumber || 'Não identificado'} detected={Boolean(verifiedWhatsapp)} loading={hasWebsite && isEnrichmentLoading} title={verifiedWhatsapp ? 'WhatsApp verificado' : 'Número disponível, WhatsApp não confirmado'} action={whatsappUrl ? (
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" onClick={() => recordRecommendationWhatsApp(business)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.09] bg-white/[0.04] px-2.5 py-1.5 text-[9px] font-semibold text-stone-200 transition hover:border-emerald-500/35 hover:text-white">
                  Abrir {verifiedWhatsapp ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <AlertCircle className="h-3.5 w-3.5 text-rose-400" />}
                </a>
              ) : undefined} />
            </div>
            {emailError && <p className="mt-2 text-[9px] leading-relaxed text-rose-400">{emailError}</p>}
          </section>

          <section className="mt-6">
            <SectionTitle icon={<Sparkles className="h-4 w-4" />}>Gerar abordagem</SectionTitle>
            <div className="rounded-2xl border border-white/[0.08] bg-[#111418] p-3.5">
              {!generatedMessage && !messageError && <p className="text-[10px] leading-relaxed text-stone-300">Crie uma primeira mensagem usando os sinais encontrados para este negócio.</p>}
              {messageError && <p className="rounded-lg bg-rose-500/[0.08] px-3 py-2 text-[10px] text-rose-400">{messageError}</p>}
              {generatedMessage && (
                <div className="rounded-xl border border-[#FF4D00]/15 bg-[#FFF8F4] p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-[#D94400]" title={messageModel || undefined}>{messageSource === 'template' ? 'Fallback local' : 'Abordagem com IA'}</span>
                    <button type="button" onClick={handleCopyMessage} className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[9px] font-semibold text-stone-400 transition hover:bg-white hover:text-[#FF6A26]">
                      {isMessageCopied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}{isMessageCopied ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                  <p className="whitespace-pre-wrap text-[10px] leading-relaxed text-stone-700">{generatedMessage}</p>
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => handleGenerateApproach(Boolean(generatedMessage))} disabled={isGeneratingMessage} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#FF5A12] px-3 py-2.5 text-[10px] font-semibold text-white transition hover:bg-[#E04400] disabled:cursor-not-allowed disabled:opacity-60">
                  {isGeneratingMessage ? <LoaderRing /> : generatedMessage ? <RefreshCw className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {isGeneratingMessage ? 'Gerando' : generatedMessage ? 'Nova variação' : 'Gerar abordagem'}
                </button>
              </div>
            </div>
          </section>

          <section className="mt-6">
            <SectionTitle icon={<Tag className="h-4 w-4" />}>Sinais digitais</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              <TrackingItem label="GA4" ok={Boolean(trackingAudit?.ga4?.detected)} loading={hasWebsite && isTrackingLoading} />
              <TrackingItem label="GTM" ok={Boolean(trackingAudit?.gtm?.detected)} loading={hasWebsite && isTrackingLoading} />
              <TrackingItem label="Meta Pixel" ok={Boolean(trackingAudit?.metaPixel?.detected)} loading={hasWebsite && isTrackingLoading} />
              <TrackingItem label="Cookies" ok={Boolean(trackingAudit?.cookieConsent?.detected)} loading={hasWebsite && isTrackingLoading} />
            </div>
          </section>

          {pageSpeed && (
            <section className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <SectionTitle icon={<Gauge className="h-4 w-4" />}>Performance mobile</SectionTitle>
                <span className="mb-3 rounded-full border border-[#FF4D00]/20 bg-[#FF5A12]/[0.08] px-2.5 py-1 text-[10px] font-semibold text-[#FF8A52]">{pageSpeed.score}/100</span>
              </div>
              <div className="rounded-2xl border border-white/[0.08] bg-[#111418] p-3.5">
                <div className="grid grid-cols-4 gap-2">
                  {[[ 'FCP', pageSpeed.fcp || '-' ], [ 'LCP', pageSpeed.lcp || '-' ], [ 'TBT', pageSpeed.tbt || '-' ], [ 'CLS', pageSpeed.cls || '-' ]].map(([label, value]) => (
                    <div key={label} className="text-center"><span className="block text-[8px] font-semibold text-stone-300">{label}</span><span className="mt-1 block text-[10px] font-semibold text-stone-200">{value}</span></div>
                  ))}
                </div>
                {pageSpeed.opportunityTitle && (
                  <div className="mt-3 border-t border-white/[0.07] pt-3">
                    <span className="text-[10px] font-semibold text-stone-100">{pageSpeed.opportunityTitle}</span>
                    {pageSpeed.opportunityDescription && <p className="mt-1 text-[9px] leading-relaxed text-stone-300">{pageSpeed.opportunityDescription}</p>}
                  </div>
                )}
              </div>
            </section>
          )}

          <section className="mt-6 pb-3">
            <SectionTitle icon={<Building2 className="h-4 w-4" />}>Dados do negócio</SectionTitle>
            <div className="rounded-2xl border border-white/[0.08] bg-[#111418] px-3.5">
              <DetailRow label="Confiança da fonte" value={`${confidencePercent}%`} />
              <DetailRow label="Status" value={business.openStatusText || business.operatingStatus || 'Não identificado'} />
              <DetailRow label="Fonte" value={business.source || 'Não identificada'} />
              {(business.cnpj || enrichment?.cnpj?.[0]?.value) && <DetailRow label="CNPJ" value={business.cnpj || enrichment.cnpj[0].value} />}
            </div>
          </section>
        </div>
      </aside>
    </>
  );
}
