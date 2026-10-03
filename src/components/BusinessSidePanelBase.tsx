import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  ArrowUpRight,
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
  onAddToPipeline?: (business: Business) => void;
  onAskAgentic?: (business: Business) => void;
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

export default function BusinessSidePanel({ business, onClose, onToggleFavorite, onAddToPipeline, onAskAgentic }: BusinessSidePanelProps) {
  const [enrichment, setEnrichment] = useState<any>(null);
  const [whatsappPending, setWhatsappPending] = useState(false);
  const [showPipelinePrompt, setShowPipelinePrompt] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ channels: true, audit: false, ads: false, approach: false, details: false });
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
  // Plain addresses reach this component only after the authorized server unlock
  // or an entitlement-checked enrichment response. A stale list emailLocked
  // flag must not hide them from Developer/paid accounts.
  const isPlainEmail = Boolean(
    rawEmailAddress &&
    !isLockedEmail(rawEmailAddress) &&
    /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(String(rawEmailAddress).trim())
  );
  const emailLocked = !isPlainEmail && (isLockedEmail(rawEmailAddress) || Boolean((business as any).emailLocked));
  const emailAddress = isPlainEmail && !emailLocked ? String(rawEmailAddress).trim() : null;
  const googleBusinessUrl = getGoogleBusinessLink(business);
  const websiteDomain = useMemo(() => normalizeWebsiteDomain(websiteUrl), [websiteUrl]);
  const googleAdsTransparencyUrl = websiteDomain
    ? `https://adstransparency.google.com/?domain=${encodeURIComponent(websiteDomain)}&region=anywhere`
    : null;
  const metaAdsLibraryUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=${encodeURIComponent(business.name)}&media_type=all`;
  const trackingDetected = Boolean(trackingAudit?.hasTracking);
  // These are signals not confirmed by the audit, not proof that the business lacks them.
  const unconfirmedAuditCount = [
    trackingAudit?.ga4?.detected,
    trackingAudit?.gtm?.detected,
    trackingAudit?.metaPixel?.detected,
    trackingAudit?.cookieConsent?.detected,
    pageSpeed && typeof pageSpeed.score === 'number',
  ].filter((detected) => detected !== true).length;
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

  useEffect(() => {
    setWhatsappPending(false);
    setShowPipelinePrompt(false);
    setOpenSections({ channels: true, audit: false, ads: false, approach: false, details: false });
  }, [business.id]);

  useEffect(() => {
    const checkReturn = () => {
      if (!whatsappPending || document.visibilityState === 'hidden') return;
      setWhatsappPending(false);
      if (business.leadStatus === 'NOVO' || !business.leadStatus) setShowPipelinePrompt(true);
    };
    window.addEventListener('focus', checkReturn);
    document.addEventListener('visibilitychange', checkReturn);
    return () => {
      window.removeEventListener('focus', checkReturn);
      document.removeEventListener('visibilitychange', checkReturn);
    };
  }, [whatsappPending, business.id, business.leadStatus]);

  const recordWhatsAppClick = () => {
    recordRecommendationWhatsApp(business);
    setWhatsappPending(true);
  };
  const toggleSection = (section: string) => setOpenSections((current) => ({
    ...current, [section]: !current[section],
  }));
  const expandedSection = (section: string, label: string, summary?: string, missingCount?: number) => (
    <button
      type="button"
      aria-expanded={Boolean(openSections[section])}
      onClick={() => toggleSection(section)}
      className="group flex w-full items-center justify-between gap-3 rounded-xl px-1 py-3 text-left"
    >
      <div className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="text-[12px] font-semibold tracking-[-0.01em] text-[#e8e9ec]">{label}</span>
          {typeof missingCount === 'number' && missingCount > 0 && (
            <span
              className="inline-flex h-[15px] min-w-[15px] shrink-0 items-center justify-center rounded-full bg-[#c73544] px-[3px] text-[9px] font-semibold leading-none tabular-nums text-white"
              title={`${missingCount} itens não confirmados na auditoria`}
              aria-label={`${missingCount} itens não confirmados`}
            >
              {missingCount}
            </span>
          )}
        </span>
        {summary && <span className="mt-0.5 block text-[10px] text-[#969ca6]">{summary}</span>}
      </div>
      <ChevronDown className={`h-4 w-4 shrink-0 text-[#999faa] transition-transform duration-200 group-hover:text-white ${openSections[section] ? 'rotate-180' : ''}`} />
    </button>
  );
  return (
    <>
      <div className="fixed inset-0 z-[68] bg-black/45 backdrop-blur-[2px] pointer-events-auto" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-[70] flex w-full flex-col border-l border-white/[0.09] bg-[#0d1014] text-white shadow-[-28px_0_100px_rgba(0,0,0,0.48)] pointer-events-auto sm:w-[520px] lg:w-[550px]" aria-label={`Detalhes de ${business.name}`}>
        <header className="shrink-0 border-b border-white/[0.085] bg-[#101317] px-5 pb-5 pt-6 sm:px-7">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#a1a6af]">Perfil da empresa</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => onToggleFavorite?.(business)} className="flex h-9 w-9 items-center justify-center rounded-xl text-[#b8bdc7] transition hover:bg-white/[0.06] hover:text-white" aria-label={isFavorite ? 'Remover favorito' : 'Favoritar'}><Star className={`h-[18px] w-[18px] ${isFavorite ? 'fill-[#ff6a2a] text-[#ff6a2a]' : ''}`} /></button>
              <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl text-[#b8bdc7] transition hover:bg-white/[0.06] hover:text-white" aria-label="Fechar painel"><X className="h-[18px] w-[18px]" /></button>
            </div>
          </div>
          <h2 className="break-words text-[24px] font-semibold leading-[1.18] tracking-[-0.05em] text-[#f6f6f7]">{business.name}</h2>
          <p className="mt-2 text-[12px] text-[#bbc0c9]">{translateCategory(business.category)}</p>
          {business.address && <p className="mt-3 flex items-start gap-2 text-[11px] leading-[1.65] text-[#a4aab5]"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ff7439]" />{business.address}</p>}
          <button type="button" onClick={() => onAskAgentic?.(business)} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#ff7138]/30 bg-[#ff5a12]/[0.12] text-[12px] font-semibold text-[#ffad83] transition hover:border-[#ff7138]/55 hover:bg-[#ff5a12]/[0.19]">
            <Sparkles className="h-4 w-4" /> Pedir ao Scoutly Agentic <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {whatsappUrl ? <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" onClick={recordWhatsAppClick} title={verifiedWhatsapp ? 'WhatsApp identificado no site' : 'Testar WhatsApp: número não verificado'} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1a3028] text-[12px] font-semibold text-[#acf0cc] transition hover:bg-[#204635]"><BrandIcon brand="whatsapp" className="h-[17px] w-[17px]" alt="WhatsApp" /> WhatsApp <ArrowUpRight className="h-3.5 w-3.5" /></a> : <div className="flex h-11 items-center justify-center rounded-xl border border-white/[0.065] text-[11px] text-[#858b96]">WhatsApp indisponível</div>}
            {hasWebsite ? <a href={websiteUrl!} target="_blank" rel="noopener noreferrer" className="flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-[#1b1e23] text-[12px] font-semibold text-[#e6e7eb] transition hover:bg-[#272c32]"><BrandIcon brand="website" className="h-[17px] w-[17px]" alt="Site" /> Ver site <ArrowUpRight className="h-3.5 w-3.5" /></a> : <a href={googleBusinessUrl} target="_blank" rel="noopener noreferrer" className="flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-[#1b1e23] text-[12px] font-semibold text-[#e6e7eb] transition hover:bg-[#272c32]"><BrandIcon brand="googleMaps" className="h-4 w-4" alt="Google Maps" /> Google Maps <ArrowUpRight className="h-3.5 w-3.5" /></a>}
          </div>
          {showPipelinePrompt && (
            <div role="status" className="mt-4 rounded-2xl border border-[#ff753e]/25 bg-[#ff5a12]/[0.085] p-4">
              <p className="text-[12px] font-semibold text-[#f3f4f5]">Gostaria de adicionar este lead ao pipeline?</p>
              <p className="mt-1 text-[10px] leading-relaxed text-[#aeb4bf]">Você abriu o WhatsApp deste negócio. Quer acompanhar a oportunidade?</p>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => { onAddToPipeline?.(business); setShowPipelinePrompt(false); }} className="rounded-lg bg-[#ff5a12] px-3.5 py-2 text-[11px] font-semibold text-white transition hover:bg-[#ff7234]">Adicionar ao pipeline</button>
                <button type="button" onClick={() => setShowPipelinePrompt(false)} className="rounded-lg border border-white/[0.12] px-3.5 py-2 text-[11px] font-medium text-[#c4c8d0] transition hover:bg-white/[0.05]">Agora não</button>
              </div>
            </div>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 [scrollbar-color:#31363d_transparent] sm:px-7">
          {isAnythingLoading && <p className="mb-3 flex items-center gap-2 text-[10px] text-[#a6acb6]"><LoaderRing /> Atualizando informações do negócio</p>}
          <section className="rounded-2xl border border-white/[0.085] bg-[#14181d] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[12px] font-semibold text-white">Visão geral</h3>
              <span className="text-[10px] font-semibold text-[#a4abb6]">{confidencePercent}% de confiança da fonte</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-white/[0.035] px-3 py-3"><p className="text-[10px] text-[#989faa]">Site</p><p className="mt-1 text-[12px] font-semibold text-[#ecedf0]">{hasWebsite ? 'Identificado' : 'Não identificado'}</p></div>
              <div className="rounded-xl bg-white/[0.035] px-3 py-3"><p className="text-[10px] text-[#989faa]">WhatsApp</p><p className="mt-1 text-[12px] font-semibold text-[#ecedf0]">{verifiedWhatsapp ? 'Identificado' : whatsappUrl ? 'Possível' : 'Não identificado'}</p></div>
              <div className="rounded-xl bg-white/[0.035] px-3 py-3"><p className="text-[10px] text-[#989faa]">Tracking</p><p className="mt-1 text-[12px] font-semibold text-[#ecedf0]">{trackingDetected ? 'Detectado' : 'Não confirmado'}</p></div>
              <div className="rounded-xl bg-white/[0.035] px-3 py-3"><p className="text-[10px] text-[#989faa]">Performance</p><p className="mt-1 text-[12px] font-semibold text-[#ecedf0]">{pageSpeedDetected ? `${pageSpeed!.score}/100` : 'Sem medição'}</p></div>
            </div>
            {opportunities.length > 0 && (
              <div className="mt-4 border-t border-white/[0.08] pt-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#ff9869]">Possíveis oportunidades</p>
                <div className="flex flex-wrap gap-1.5">{opportunities.slice(0, 3).map((item) => <span key={item} className="rounded-lg border border-[#ff7c42]/[0.15] bg-[#ff6a2a]/[0.065] px-2.5 py-1.5 text-[10px] text-[#f1c4ad]">{item}</span>)}</div>
                <p className="mt-2 text-[9px] text-[#9298a3]">Sinais não confirmados exigem validação antes de abordar o negócio.</p>
              </div>
            )}
          </section>

          <div className="mt-4 divide-y divide-white/[0.085]">
            <section>
              {expandedSection('channels', 'Contato e presença digital', phoneToCopy ? 'Telefone e canais identificados' : 'Canais identificados')}
              {openSections.channels && <div className="space-y-2 pb-4">
                {phoneToCopy && <div className="flex items-center justify-between gap-3 rounded-xl bg-[#171b20] px-3.5 py-3"><div className="flex min-w-0 items-center gap-2.5"><Phone className="h-4 w-4 text-[#b4bac3]" /><span className="truncate text-[11px] text-[#e4e6eb]">{phoneToCopy}</span></div><button type="button" onClick={handleCopyPhone} className="rounded-lg p-1.5 text-[#b4bac3] transition hover:bg-white/[0.07]" title="Copiar telefone">{copiedPhone ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}</button></div>}
                {emailLocked ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-[#171b20] px-3.5 py-3">
                    <span className="flex items-center gap-2.5 text-[11px] text-[#c8cdd5]"><Mail className="h-4 w-4" />E-mail disponível no Pro</span>
                    <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('scoutly-open-plans'))} className="inline-flex items-center gap-1 rounded-lg border border-[#ff5a12]/20 bg-[#ff5a12]/[0.08] px-2.5 py-1.5 text-[10px] font-semibold text-[#ffad83]"><Lock className="h-3 w-3" />Ver planos</button>
                  </div>
                ) : emailAddress ? (
                  <a href={`mailto:${emailAddress}`} aria-label={`Enviar e-mail para ${emailAddress}`} className="group flex items-center justify-between gap-3 rounded-xl border border-white/[0.09] bg-[#171b20] px-3.5 py-3 text-[11px] font-medium text-[#e4e6eb] transition hover:border-[#ff5a12]/35 hover:bg-[#20242a]">
                    <span className="flex min-w-0 items-center gap-2.5"><Mail className="h-4 w-4 shrink-0 text-[#cbd0d7]" /><span className="truncate">{emailAddress}</span></span>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-[#ff9d6c] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </a>
                ) : (
                  <div className="flex items-center gap-2.5 rounded-xl bg-[#171b20] px-3.5 py-3 text-[11px] text-[#9ba1ab]"><Mail className="h-4 w-4" />E-mail não encontrado</div>
                )}
                {socialLinks.length > 0 && <div className="flex flex-wrap gap-2">{socialLinks.map((item) => <a key={item.url} href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-white/[0.11] bg-[#171b20] px-3 py-2.5 text-[11px] font-medium text-[#dee0e5] transition hover:border-white/[0.26]"><SocialLogo network={item.network} url={item.url} />{item.network}<ArrowUpRight className="h-3 w-3 text-[#a4aab5]" /></a>)}</div>}
                <a href={googleBusinessUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 py-2 text-[11px] text-[#c8ccd3] transition hover:text-white"><BrandIcon brand="googleMaps" className="h-4 w-4" alt="Google Maps" /> Ver no Google Maps <ArrowUpRight className="h-3.5 w-3.5" /></a>
              </div>}
            </section>
            <section>
              {expandedSection('audit', 'Auditoria digital', 'Tags, rastreamento e velocidade', hasWebsite && (isTrackingLoading || isPageSpeedLoading) ? undefined : unconfirmedAuditCount)}
              {openSections.audit && <div className="pb-4">
                <div className="grid grid-cols-2 gap-2">
                  <TrackingItem label="Google Analytics" ok={Boolean(trackingAudit?.ga4?.detected)} loading={hasWebsite && isTrackingLoading} />
                  <TrackingItem label="Tag Manager" ok={Boolean(trackingAudit?.gtm?.detected)} loading={hasWebsite && isTrackingLoading} />
                  <TrackingItem label="Meta Pixel" ok={Boolean(trackingAudit?.metaPixel?.detected)} loading={hasWebsite && isTrackingLoading} />
                  <TrackingItem label="Cookies" ok={Boolean(trackingAudit?.cookieConsent?.detected)} loading={hasWebsite && isTrackingLoading} />
                </div>
                {pageSpeed ? <div className="mt-3 rounded-xl bg-[#171b20] px-3.5 py-3"><p className="text-[11px] font-semibold text-white">Mobile: {pageSpeed.score}/100</p><p className="mt-1 text-[10px] text-[#a4aab5]">FCP {pageSpeed.fcp || '–'} · LCP {pageSpeed.lcp || '–'} · CLS {pageSpeed.cls || '–'}</p></div> : !isPageSpeedLoading && <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#171b20] px-3.5 py-3 text-[11px] text-[#a5abb5]"><Gauge className="h-4 w-4" />Performance mobile não medida</div>}
              </div>}
            </section>
            <section>
              {expandedSection('ads', 'Bibliotecas de anúncios', 'Pesquisa em plataformas oficiais')}
              {openSections.ads && <div className="grid grid-cols-2 gap-2 pb-4">
                <a href={metaAdsLibraryUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl bg-[#171b20] px-3 py-3 text-[11px] font-medium text-white"><BrandIcon brand="meta" className="h-5 w-5" alt="Meta" /> Meta Ads <ArrowUpRight className="ml-auto h-3 w-3" /></a>
                {googleAdsTransparencyUrl ? <a href={googleAdsTransparencyUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl bg-[#171b20] px-3 py-3 text-[11px] font-medium text-white"><BrandIcon brand="googleAds" className="h-5 w-5 rounded bg-white" alt="Google Ads" /> Google Ads <ArrowUpRight className="ml-auto h-3 w-3" /></a> : <div className="flex items-center gap-2 rounded-xl bg-[#171b20] px-3 py-3 text-[11px] text-[#8b919a]"><BrandIcon brand="googleAds" className="h-5 w-5 rounded bg-white" alt="Google Ads" /> Sem domínio</div>}
              </div>}
            </section>
            <section>
              {expandedSection('approach', 'Abordagem comercial', 'Gerar uma mensagem personalizada')}
              {openSections.approach && <div className="pb-4">
                {generatedMessage ? <div className="rounded-xl border border-white/[0.1] bg-[#171b20] p-3.5"><p className="whitespace-pre-wrap text-[11px] leading-relaxed text-[#d9dce2]">{generatedMessage}</p><button type="button" onClick={handleCopyMessage} className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-[#ff9c70]">{isMessageCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{isMessageCopied ? 'Copiado' : 'Copiar'}</button></div> : <p className="text-[11px] leading-relaxed text-[#a4aab5]">Gere uma sugestão de abordagem usando apenas os sinais disponíveis.</p>}
                {messageError && <p className="mt-2 text-[10px] text-rose-300">{messageError}</p>}
                <button type="button" onClick={() => handleGenerateApproach(Boolean(generatedMessage))} disabled={isGeneratingMessage} className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-[#ff5a12] px-3 text-[11px] font-semibold text-white disabled:opacity-50">{isGeneratingMessage ? <LoaderRing /> : <Sparkles className="h-3.5 w-3.5" />}{generatedMessage ? 'Gerar outra versão' : 'Gerar abordagem'}</button>
              </div>}
            </section>
            <section>
              {expandedSection('details', 'Dados e origem', 'Status, fonte e identificação')}
              {openSections.details && <div className="rounded-xl bg-[#171b20] px-3.5 pb-2">
                <DetailRow label="Status" value={business.openStatusText || business.operatingStatus || 'Não identificado'} />
                <DetailRow label="Fonte" value={business.source || 'Não identificada'} />
                <DetailRow label="Confiança" value={`${confidencePercent}%`} />
                {(business.cnpj || enrichment?.cnpj?.[0]?.value) && <DetailRow label="CNPJ" value={business.cnpj || enrichment.cnpj[0].value} />}
              </div>}
            </section>
          </div>
        </div>
      </aside>
    </>
  );
}
