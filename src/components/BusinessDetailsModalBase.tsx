import DevWhatsAppTool from './DevWhatsAppTool';
import SimilarAlertButton from './SimilarAlertButton';
import { useState, useEffect } from 'react';
import { ArrowUpRight, ExternalLink, Phone, X, Plus, Check, Columns3, Trash2, Star, ChevronDown, Sparkles, Copy, MessageCircle, RefreshCw, AlertCircle, CheckCircle2, Globe2, Activity, Mail, MapPin, FileText, Gauge } from 'lucide-react';
import { Business, LeadStatus } from '../types';
import { enrichBusinessData, fetchTrackingAudit, getGoogleBusinessLink, getWhatsAppLink, getTrustIcon, generateMessage } from '../services/api';
import { translateCategory } from '../utils/categoryTranslator';
import { usePageSpeed } from '../hooks/usePageSpeed';
import TrackingAuditPanel from './TrackingAuditPanel';
import { markBusinessRecentlyViewed } from '../utils/recentBusinesses';
import { recordRecommendationWhatsApp } from '../utils/recommendations';
import { normalizeExternalUrl } from '../utils/externalUrl';
import BrandIcon, { brandFromUrl, type BrandName } from './BrandIcon';
import { useDiagnosticPdf } from '../hooks/useDiagnosticPdf';
import { getActiveLocale } from '../i18n/language';

interface BusinessDetailsModalProps {
  business: Business | null;
  onClose: () => void;
  onUpdateStatus?: (id: string, status: LeadStatus, notes?: string) => void;
  onToggleFavorite?: (business: Business) => void;
}

export default function BusinessDetailsModal({
  business,
  onClose,
  onUpdateStatus,
  onToggleFavorite,
}: BusinessDetailsModalProps) {
  if (!business) return null;

  const [currentLeadStatus, setCurrentLeadStatus] = useState<LeadStatus>(
    business.leadStatus || 'NOVO'
  );
  const [notes, setNotes] = useState(business.notes || '');
  const [isSpeedDetailsExpanded, setIsSpeedDetailsExpanded] = useState(false);

  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichmentData, setEnrichmentData] = useState<any>(null);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [trackingAudit, setTrackingAudit] = useState<any>(null);
  const [isTrackingAuditLoading, setIsTrackingAuditLoading] = useState(false);
  const [trackingAuditError, setTrackingAuditError] = useState<string | null>(null);

  const [isGeneratingMessage, setIsGeneratingMessage] = useState(false);
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [messageVariation, setMessageVariation] = useState(0);
  const [messageSource, setMessageSource] = useState<'gateway' | 'gemini' | 'openrouter' | null>(null);
  const [messageModel, setMessageModel] = useState('');
  const [messageError, setMessageError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState('');
  const { download: downloadPdf, isGenerating: isGeneratingPdf, error: pdfError, needsReload: pdfNeedsReload, clearError: clearPdfError } = useDiagnosticPdf();

  useEffect(() => {
    setCurrentLeadStatus(business.leadStatus || 'NOVO');
    setNotes(business.notes || '');
    setEnrichmentData(null);
    setEnrichError(null);
    setTrackingAudit(null);
    setTrackingAuditError(null);
    setGeneratedMessage('');
    setMessageVariation(0);
    setMessageSource(null);
    setMessageModel('');
    setMessageError(null);
    setCopiedPhone('');
    clearPdfError();
    markBusinessRecentlyViewed(business.id, business);
  }, [business]);

  const baseWebsiteUrl = normalizeExternalUrl(business.website);
  const discoveredWebsiteUrl = normalizeExternalUrl(
    enrichmentData?.discoveredWebsite || enrichmentData?.placeSignal?.website
  );
  const websiteUrl = baseWebsiteUrl || discoveredWebsiteUrl;
  const hasWebsite = Boolean(websiteUrl);
  const websiteDomain = (() => {
    if (!websiteUrl) return null;
    try {
      return new URL(websiteUrl).hostname.replace(/^www\./i, '').toLowerCase();
    } catch {
      return null;
    }
  })();
  const metaAdsLibraryUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=${encodeURIComponent(business.name)}&media_type=all`;
  const googleAdsTransparencyUrl = websiteDomain
    ? `https://adstransparency.google.com/?domain=${encodeURIComponent(websiteDomain)}&region=anywhere`
    : null;
  const autoEnrichEnabled = localStorage.getItem('scoutly_auto_enrich') !== 'false';
  const confidencePercent = Math.round((business.confidence || 0.8) * 100);
  const isFavorited = Boolean(business.isFavorite);
  const googleBusinessUrl = getGoogleBusinessLink(business);

  const { data: pageSpeed, isLoading: isSpeedLoading } = usePageSpeed(
    autoEnrichEnabled ? websiteUrl : null
  );

  useEffect(() => {
    let cancelled = false;

    setTrackingAudit(null);
    setTrackingAuditError(null);

    if (!websiteUrl || !autoEnrichEnabled) {
      setIsTrackingAuditLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setIsTrackingAuditLoading(true);

    fetchTrackingAudit(websiteUrl)
      .then((audit) => {
        if (!cancelled) setTrackingAudit(audit);
      })
      .catch((error: any) => {
        if (!cancelled) {
          console.warn('[Scoutly Tracking Audit] Falha:', error);
          setTrackingAuditError(error?.message || 'Não foi possível analisar o tracking deste site.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsTrackingAuditLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [business.id, websiteUrl, autoEnrichEnabled]);

  useEffect(() => {
    let cancelled = false;

    if (!autoEnrichEnabled) return () => {
      cancelled = true;
    };

    enrichBusinessData(baseWebsiteUrl, false, business.id, {
      name: business.name,
      address: business.address,
      phone: business.phone || business.phones?.[0] || null,
      latitude: business.latitude,
      longitude: business.longitude,
    })
      .then((data) => {
        if (cancelled) return;
        setEnrichmentData(data);
        if (data?.trackingAudit) {
          setTrackingAudit(data.trackingAudit);
          setTrackingAuditError(null);
        }
      })
      .catch((error) => {
        console.warn('[Scoutly Contact Freshness] Falha:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [business.id, baseWebsiteUrl, autoEnrichEnabled]);

  const handleToggleFavorite = () => {
    onToggleFavorite?.(business);
  };

  const handleStatusChange = (newStatus: LeadStatus) => {
    setCurrentLeadStatus(newStatus);
    onUpdateStatus?.(business.id, newStatus, notes);
  };

  const handleSaveNotes = () => {
    onUpdateStatus?.(business.id, currentLeadStatus, notes);
  };

  const handleEnrich = async () => {
    setIsEnriching(true);
    setEnrichError(null);
    try {
      const data = await enrichBusinessData(websiteUrl, true, business.id, {
        name: business.name,
        address: business.address,
        phone: business.phone || business.phones?.[0] || null,
        latitude: business.latitude,
        longitude: business.longitude,
      });
      setEnrichmentData(data);
      if (data?.trackingAudit) {
        setTrackingAudit(data.trackingAudit);
        setTrackingAuditError(null);
      }
    } catch (err: any) {
      setEnrichError(err.message || 'Falha ao enriquecer dados.');
    } finally {
      setIsEnriching(false);
    }
  };

  const handleGenerateMessage = async (isVariation = false) => {
    setIsGeneratingMessage(true);
    setMessageError(null);

    try {
      const nextVariation = isVariation ? messageVariation + 1 : 0;
      const payload = {
        ...business,
        pageSpeedScore: pageSpeed?.score,
        pageSpeedDiagnostics: pageSpeed?.diagnostics || [],
        trackingAudit,
      };

      const result = await generateMessage(payload, {
        variationIndex: nextVariation,
        previousMessage: isVariation ? generatedMessage : '',
      });

      setGeneratedMessage(result.message);
      setMessageSource(result.source);
      setMessageModel(result.model || '');
      setMessageVariation(nextVariation);
      setIsCopied(false);
    } catch (err: any) {
      setMessageError(err.message || 'Falha ao gerar mensagem.');
    } finally {
      setIsGeneratingMessage(false);
    }
  };

  const handleCopyMessage = () => {
    if (generatedMessage) {
      navigator.clipboard.writeText(generatedMessage);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleCopyPhone = async (phone: string) => {
    if (!phone) return;
    await navigator.clipboard.writeText(phone);
    setCopiedPhone(phone);
    setTimeout(() => setCopiedPhone(''), 1600);
  };

  // Contact quality: current official website evidence wins over dataset contacts.
  const normalizePhone = (value: string) => String(value || '').replace(/\D/g, '');
  const normalizeEmail = (value: string) => String(value || '').trim().toLowerCase();

  const placeSignalPhones = Array.isArray(enrichmentData?.placeSignal?.phones)
    ? enrichmentData.placeSignal.phones.filter(Boolean)
    : enrichmentData?.placeSignal?.phone
      ? [enrichmentData.placeSignal.phone]
      : [];
  const datasetPhones = Array.from(new Set([
    ...placeSignalPhones,
    ...(Array.isArray(business.phones)
      ? business.phones
      : business.phone
        ? [business.phone]
        : []),
  ].filter(Boolean)));
  const datasetEmails = Array.isArray(business.emails) ? [...business.emails] : [];

  const verifiedPhoneItems = Array.isArray(enrichmentData?.phones) ? enrichmentData.phones : [];
  const verifiedEmailItems = Array.isArray(enrichmentData?.emails) ? enrichmentData.emails : [];
  const verifiedWhatsappItems = Array.isArray(enrichmentData?.whatsapp) ? enrichmentData.whatsapp : [];

  const verifiedPhones = verifiedPhoneItems.map((item: any) => item.value).filter(Boolean);
  const verifiedEmails = verifiedEmailItems.map((item: any) => item.value).filter(Boolean);
  const whatsapps = verifiedWhatsappItems.map((item: any) => item.value).filter(Boolean);

  const verifiedPhoneKeys = new Set(verifiedPhones.map(normalizePhone));
  const verifiedEmailKeys = new Set(verifiedEmails.map(normalizeEmail));

  const unverifiedDatasetPhones = datasetPhones.filter(
    (phone: string) => !verifiedPhoneKeys.has(normalizePhone(phone))
  );
  const unverifiedDatasetEmails = datasetEmails.filter(
    (email: string) => !verifiedEmailKeys.has(normalizeEmail(email))
  );

  const phones = verifiedPhones.length > 0 ? verifiedPhones : datasetPhones;
  const emails = verifiedEmails.length > 0 ? verifiedEmails : datasetEmails;

  const cnpj: string[] = [];
  const team: any[] = [];

  enrichmentData?.cnpj?.forEach((item: any) => {
    if (item?.value && !cnpj.includes(item.value)) cnpj.push(item.value);
  });
  enrichmentData?.team?.forEach((item: any) => {
    team.push(item);
  });

  const verifiedWhatsappTarget = whatsapps[0] || null;
  // A normal phone number is not proof of WhatsApp. Keep the WhatsApp action
  // disabled unless the website audit found explicit WhatsApp evidence.
  const whatsappCandidate = verifiedWhatsappTarget;
  const whatsappVerified = Boolean(verifiedWhatsappTarget);
  let whatsappUrl = getWhatsAppLink(whatsappCandidate);

  if (whatsappUrl && generatedMessage) {
    const separator = whatsappUrl.includes('?') ? '&' : '?';
    whatsappUrl = `${whatsappUrl}${separator}text=${encodeURIComponent(generatedMessage)}`;
  }

  const primaryVerifiedPhone = verifiedPhones.find(
    (phone: string) => !whatsapps.some((wa: string) => normalizePhone(wa) === normalizePhone(phone))
  ) || null;

  const contactCheckedAt = enrichmentData?.contactFreshness?.checkedAt
    ? new Date(enrichmentData.contactFreshness.checkedAt)
    : null;
  const hasFreshContactEvidence =
    Boolean(enrichmentData?.contactFreshness?.websiteReachable) &&
    (verifiedPhones.length > 0 || verifiedEmails.length > 0 || whatsapps.length > 0);

  const handleDownloadDiagnostic = () => {
    const enrichedSocials = Object.values(enrichmentData?.socials || {})
      .map((item: any) => String(item?.value || item?.url || ''))
      .filter((value) => /^https?:\/\//i.test(value));

    return downloadPdf({
      business: { ...business, socials: [...(business.socials || []), ...enrichedSocials] },
      websiteUrl,
      pageSpeed,
      tracking: trackingAudit,
      // Presence only (masked, credit-locked values still count): the PDF never contains phone/e-mail values.
      contact: {
        hasPhone: phones.length > 0 || Boolean(business.hasProtectedPhone),
        hasWhatsApp: whatsapps.length > 0,
        hasEmail: emails.length > 0 || Boolean(business.hasProtectedEmail),
      },
    });
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-[3px] flex items-center justify-center p-3 sm:p-6 overflow-y-auto no-scrollbar cursor-pointer"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl bg-[#0d1014] text-white rounded-3xl border border-white/[0.09] shadow-[0_30px_120px_rgba(0,0,0,0.55)] p-5 sm:p-7 my-auto max-h-[92vh] overflow-y-auto no-scrollbar cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button top-right */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-[#a4aab5] hover:text-white hover:bg-white/[0.07] rounded-xl transition cursor-pointer z-20"
          title="Fechar"
        >
          <X className="w-5 h-5" />
        </button>
        {/* Loading Overlay cobrindo toda a área do modal durante o enriquecimento */}
        {isEnriching && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#0d1014]/85 backdrop-blur-sm transition-all duration-300 rounded-3xl p-6">
            <div className="flex flex-col items-center justify-center text-center">
              <img
                src="/scoutly-loading.gif"
                alt="Carregando"
                className="w-28 h-28 sm:w-36 sm:h-36 object-contain drop-shadow-xs"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div className="flex items-center gap-2.5 mt-2">
                <div className="w-4 h-4 border-2 border-[#FF4D00] border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#f6f6f7]">
                  Carregando
                </span>
              </div>
              <p className="text-[11px] text-[#d3d7dd] font-medium mt-1">
                Consultando dados do site...
              </p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-white/[0.085] pb-5 mb-6">
          <div className="min-w-0 flex-1">
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.16em] text-[#a1a6af]">Perfil da empresa</span>
            <div className="flex items-center gap-2.5">
              <h2 className="text-2xl font-semibold text-[#f6f6f7] tracking-[-0.03em] leading-snug">
                {business.name}
              </h2>
              <button
                type="button"
                onClick={handleToggleFavorite}
                className="p-1.5 hover:bg-white/[0.07] rounded-xl transition cursor-pointer text-[#a4aab5] hover:text-amber-500 shrink-0"
                title={isFavorited ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
              >
                <Star
                  className={`w-5 h-5 ${
                    isFavorited
                      ? 'fill-amber-500 text-amber-500'
                      : 'text-[#5f6672] hover:text-white'
                  }`}
                />
              </button>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-[#bbc0c9]">
              <span>{translateCategory(business.category)}</span>
              {typeof business.rating === 'number' && (
                <span className="inline-flex items-center gap-1 text-[#ffc989]">
                  <Star className="h-3 w-3 fill-current" />
                  {business.rating.toFixed(1)}
                  {typeof business.reviewCount === 'number' && (
                    <span className="font-normal text-[#8f96a1]">({business.reviewCount} avaliações)</span>
                  )}
                </span>
              )}
            </p>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <a
                href={googleBusinessUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-[#d3d7dd] bg-[#14181d] hover:bg-white/[0.07] border border-white/[0.1] transition"
                title="Abrir este negócio no Google Maps"
              >
                <BrandIcon brand="googleMaps" className="h-4 w-4" alt="Google Maps" />
                <span>Google Maps</span>
              </a>

              {hasWebsite && (
                <a
                  href={websiteUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-[#ecedf0] bg-[#14181d] hover:bg-white/[0.07] border border-white/[0.14] transition"
                >
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-[#161a1f]"><BrandIcon brand="website" className="h-3.5 w-3.5" alt="Site" /></span>
                  <span>Ver site</span>
                </a>
              )}

              <a
                href={metaAdsLibraryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-[#ecedf0] bg-[#14181d] hover:bg-white/[0.07] border border-white/[0.14] transition"
                title="Pesquisar na Biblioteca de Anúncios da Meta"
              >
                <BrandIcon brand="meta" className="h-4 w-4" alt="Meta" />
                <span>Meta Ads</span>
              </a>

              {googleAdsTransparencyUrl && (
                <a
                  href={googleAdsTransparencyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-[#ecedf0] bg-[#14181d] hover:bg-white/[0.07] border border-white/[0.14] transition"
                  title="Pesquisar no Google Ads Transparency Center"
                >
                  <BrandIcon brand="googleAds" className="h-4 w-4 rounded bg-[#14181d]" alt="Google Ads" />
                  <span>Google Ads</span>
                </a>
              )}

              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => recordRecommendationWhatsApp(business)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 border border-emerald-600 transition shadow-2xs"
                  title="WhatsApp confirmado por evidência no site oficial"
                >
                  <BrandIcon brand="whatsapp" className="h-4 w-4" alt="WhatsApp" />
                  <span>WhatsApp confirmado</span>
                </a>
              )}

              {!whatsappUrl && primaryVerifiedPhone && (
                <a
                  href={`tel:${primaryVerifiedPhone}`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-[#d3d7dd] bg-[#14181d] hover:bg-white/[0.07] border border-white/[0.1] transition"
                  title="Telefone confirmado no site oficial"
                >
                  <Phone className="w-3.5 h-3.5 text-[#a4aab5]" />
                  <span>Ligar</span>
                </a>
              )}

              <button
                type="button"
                onClick={() => handleGenerateMessage(false)}
                disabled={isGeneratingMessage}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-[#FF4D00] bg-[#14181d] hover:bg-[#FF5A12]/[0.1] border border-[#FF4D00]/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingMessage ? (
                  <div className="w-3.5 h-3.5 border-2 border-[#FF4D00] border-t-transparent rounded-full animate-spin shrink-0" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-[#FF4D00]" />
                )}
                <span>{isGeneratingMessage ? 'Gerando...' : 'Gerar mensagem'}</span>
              </button>
              <SimilarAlertButton business={business} compact />
              <DevWhatsAppTool compact />

              <button
                type="button"
                onClick={handleDownloadDiagnostic}
                disabled={isGeneratingPdf || (hasWebsite && isSpeedLoading)}
                title="Baixa um PDF com os dados reais deste negócio para enviar ao cliente"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.14] transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingPdf || (hasWebsite && isSpeedLoading) ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
                ) : (
                  <FileText className="w-3.5 h-3.5" />
                )}
                <span>
                  {hasWebsite && isSpeedLoading
                    ? 'Medindo velocidade...'
                    : isGeneratingPdf
                    ? 'Gerando PDF...'
                    : 'Relatório em PDF'}
                </span>
              </button>
            </div>

            {pdfError && (
              <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl text-xs text-rose-300">
                {pdfError}
                {pdfNeedsReload && (
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="ml-3 rounded-lg border border-white/[0.16] px-2.5 py-1 font-semibold text-white transition hover:bg-white/[0.08]"
                  >
                    Recarregar página
                  </button>
                )}
              </div>
            )}

            {/* AI Generated Message Box */}
            {messageError && (
              <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl text-xs text-rose-300">
                {messageError}
              </div>
            )}
            
            {generatedMessage && (
              <div className="mt-4 p-4 bg-[#FF4D00]/5 border border-[#FF4D00]/20 rounded-2xl relative group">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-[#FF4D00] uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> Mensagem Gerada
                    </span>

                    {messageSource ? (
                      <span
                        className="inline-flex items-center gap-1 text-[9px] font-semibold text-[#d3d7dd]"
                        title={messageModel || undefined}
                      >
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        IA ativa
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleGenerateMessage(true)}
                      disabled={isGeneratingMessage}
                      className="flex items-center gap-1.5 text-[10px] font-bold text-[#a4aab5] hover:text-white bg-[#14181d] hover:bg-white/[0.07] border border-white/[0.1] px-2.5 py-1.5 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Gerar outra abordagem"
                    >
                      <RefreshCw className={`w-3 h-3 ${isGeneratingMessage ? 'animate-spin' : ''}`} />
                      {isGeneratingMessage ? 'Gerando...' : 'Nova variação'}
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyMessage}
                      className="flex items-center gap-1.5 text-[10px] font-bold text-[#FF4D00] bg-[#FF4D00]/8 hover:bg-[#FF4D00]/12 px-2.5 py-1.5 rounded-lg transition"
                    >
                      {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {isCopied ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                </div>
                <div className="text-xs text-[#ecedf0] whitespace-pre-wrap leading-relaxed">
                  {generatedMessage}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Resumo rápido */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-5">
          <div className="rounded-2xl border border-white/[0.1] bg-[#14181d] px-3.5 py-3">
            <div className="flex items-center gap-2 text-[#a4aab5]">
              <Globe2 className="w-3.5 h-3.5" />
              <span className="text-[9px] font-semibold uppercase tracking-wider">Site</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              {hasWebsite ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-[#a4aab5]" />
              )}
              <span className="text-[11px] font-semibold text-[#d3d7dd]">
                {hasWebsite ? 'Identificado' : 'Não identificado'}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.1] bg-[#14181d] px-3.5 py-3">
            <div className="flex items-center gap-2 text-[#a4aab5]">
              <Phone className="w-3.5 h-3.5" />
              <span className="text-[9px] font-semibold uppercase tracking-wider">Contatos</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              {whatsapps.length > 0 || verifiedPhones.length > 0 || verifiedEmails.length > 0 ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-[#a4aab5]" />
              )}
              <span className="text-[11px] font-semibold text-[#d3d7dd]">
                {whatsapps.length > 0
                  ? 'WhatsApp confirmado'
                  : verifiedPhones.length > 0 || verifiedEmails.length > 0
                    ? 'Contato confirmado'
                    : 'Não confirmado'}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.1] bg-[#14181d] px-3.5 py-3">
            <div className="flex items-center gap-2 text-[#a4aab5]">
              <Activity className="w-3.5 h-3.5" />
              <span className="text-[9px] font-semibold uppercase tracking-wider">Tracking</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              {trackingAudit?.hasTracking ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-[#a4aab5]" />
              )}
              <span className="text-[11px] font-semibold text-[#d3d7dd]">
                {isTrackingAuditLoading
                  ? 'Analisando'
                  : trackingAudit?.hasTracking
                    ? 'Detectado'
                    : 'Não confirmado'}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.1] bg-[#14181d] px-3.5 py-3">
            <div className="flex items-center gap-2 text-[#a4aab5]">
              <Activity className="w-3.5 h-3.5" />
              <span className="text-[9px] font-semibold uppercase tracking-wider">Performance</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              {pageSpeed ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-[#a4aab5]" />
              )}
              <span className="text-[11px] font-semibold text-[#d3d7dd]">
                {isSpeedLoading ? 'Medindo' : pageSpeed ? `${pageSpeed.score}/100` : 'Indisponível'}
              </span>
            </div>
          </div>
        </div>

        {/* Informações Principais */}
        <div className="grid grid-cols-1 lg:grid-cols-[0.82fr_1.18fr] gap-5 mb-5">
          {/* Coluna Esquerda: Informações do Estabelecimento */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-[#f6f6f7] border-b border-white/[0.085] pb-2">
              Informações do Estabelecimento
            </h3>
            
            <div className="p-4 bg-[#171b20] rounded-2xl border border-white/[0.085]">
              <span className="block text-[10px] font-bold text-[#a4aab5] uppercase tracking-wider">
                Endereço Completo
              </span>
              <span className="text-xs font-semibold text-[#ecedf0] mt-1 block">
                {business.address}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div className="p-4 bg-[#171b20] rounded-2xl border border-white/[0.085]">
                <span className="block text-[10px] font-bold text-[#a4aab5] uppercase tracking-wider">
                  Confiabilidade
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm font-bold text-[#f6f6f7]">
                    {confidencePercent}%
                  </span>
                  <img
                    src={getTrustIcon(business.confidence || 0.8)}
                    alt="Confiabilidade"
                    className="w-5 h-5 object-contain"
                    title={`Indicador de Confiança: ${confidencePercent}%`}
                  />
                </div>
              </div>
              <div className="p-4 bg-[#171b20] rounded-2xl border border-white/[0.085]">
                <span className="block text-[10px] font-bold text-[#a4aab5] uppercase tracking-wider">
                  Horário de Funcionamento
                </span>
                <span className="text-xs font-bold text-[#f6f6f7] mt-1 block">
                  {business.openStatusText || 'Horário não identificado'}
                </span>
                {business.openingHoursRaw && (
                  <span className="text-[10px] text-[#d3d7dd] block mt-0.5 font-mono">
                    {business.openingHoursRaw}
                  </span>
                )}
              </div>
            </div>

            {/* Redes Sociais */}
            <div className="p-4 bg-[#171b20] rounded-2xl border border-white/[0.085]">
              <span className="block text-[10px] font-bold text-[#a4aab5] uppercase tracking-wider mb-2">
                Redes Sociais
              </span>
              <div>
                {Array.isArray(business.socials) && business.socials.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {business.socials.map((soc, idx) => (
                      <a
                        key={idx}
                        href={soc}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#ecedf0] bg-[#14181d] hover:bg-white/[0.07] border border-white/[0.085] hover:border-white/30 transition shadow-2xs group max-w-full truncate"
                      >
                        {brandFromUrl(soc) ? <BrandIcon brand={brandFromUrl(soc)!} className="h-4 w-4" alt="" /> : <Globe2 className="h-4 w-4 text-[#a4aab5]" />}
                        <span className="truncate">{soc.replace(/^https?:\/\/(www\.)?/, '')}</span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-[#a4aab5] group-hover:text-white shrink-0" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs font-medium text-[#d3d7dd] italic">
                    Nenhuma rede social registrada
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Coluna Direita: Enriquecimento */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-white/[0.085] pb-2">
              <div>
                <h3 className="text-sm font-semibold text-[#f6f6f7]">Enriquecimento Digital</h3>
                <p className="text-[10px] text-[#a4aab5] mt-0.5">Sinais atuais encontrados no site e nas fontes do negócio</p>
              </div>
              {hasWebsite && (
                <button
                  onClick={handleEnrich}
                  disabled={isEnriching}
                  className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg bg-[#14181d] text-[#a4aab5] hover:text-white border border-white/[0.1] hover:border-white/25 disabled:opacity-50 transition"
                >
                  <RefreshCw className={`w-3 h-3 ${isEnriching ? 'animate-spin' : ''}`} />
                  {isEnriching ? 'Verificando' : 'Verificar novamente'}
                </button>
              )}
            </div>

            {enrichError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl text-xs text-rose-300">
                {enrichError}
              </div>
            )}

            <div className="rounded-2xl border border-white/[0.1] bg-[#14181d] p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="block text-[9px] font-semibold text-[#a4aab5] uppercase tracking-wider">
                    Site oficial
                  </span>
                  {hasWebsite ? (
                    <a
                      href={websiteUrl!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#ecedf0] hover:text-[#FF4D00] min-w-0"
                    >
                      <Globe2 className="w-3.5 h-3.5 shrink-0 text-[#a4aab5]" />
                      <span className="truncate">{enrichmentData?.discoveredWebsite || business.website}</span>
                      <ArrowUpRight className="w-3.5 h-3.5 shrink-0 text-[#a4aab5]" />
                    </a>
                  ) : (
                    <span className="text-xs text-[#d3d7dd] mt-1.5 block">Site não identificado</span>
                  )}
                </div>

                {enrichmentData?.siteStatus === 'verified' && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-[#d3d7dd] shrink-0">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    Online
                  </span>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.1] bg-[#14181d] p-3.5">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <span className="block text-[9px] font-semibold text-[#a4aab5] uppercase tracking-wider">
                    Contatos
                  </span>
                  <span className="block text-[10px] text-[#a4aab5] mt-0.5">
                    Contatos atuais têm prioridade sobre dados antigos da base
                  </span>
                </div>

                {hasFreshContactEvidence && contactCheckedAt && (
                  <span
                    className="inline-flex items-center gap-1 text-[9px] font-semibold text-[#d3d7dd] shrink-0"
                    title={`Verificado em ${contactCheckedAt.toLocaleString(getActiveLocale())}`}
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    Verificado agora
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-white/[0.1] bg-[#171b20] p-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#d3d7dd]">
                    <Phone className="w-3.5 h-3.5" />
                    Telefone
                  </div>

                  {verifiedPhones.length > 0 ? (
                    <div className="mt-2 space-y-1.5">
                      {verifiedPhones.slice(0, 2).map((phone: string, idx: number) => (
                        <div
                          key={`verified-ph-${idx}`}
                          className="flex items-center justify-between gap-2 text-[11px] font-medium text-[#ecedf0]"
                        >
                          <a href={`tel:${phone}`} className="truncate hover:text-[#FF4D00]">
                            {phone}
                          </a>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleCopyPhone(phone)}
                              className="rounded-md p-1 text-[#a4aab5] transition hover:bg-white/[0.07] hover:text-[#FF4D00]"
                              title={copiedPhone === phone ? 'Número copiado' : 'Copiar número'}
                            >
                              {copiedPhone === phone ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : datasetPhones.length > 0 ? (
                    <div className="mt-2">
                      <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-[#d3d7dd]">
                        <span className="truncate">{datasetPhones[0]}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleCopyPhone(datasetPhones[0])}
                            className="rounded-md p-1 text-[#a4aab5] transition hover:bg-white/[0.07] hover:text-[#FF4D00]"
                            title={copiedPhone === datasetPhones[0] ? 'Número copiado' : 'Copiar número'}
                          >
                            {copiedPhone === datasetPhones[0] ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <AlertCircle className="w-3.5 h-3.5 text-[#a4aab5] shrink-0" />
                        </div>
                      </div>
                      <span className="text-[9px] text-[#a4aab5] mt-1 block">Não confirmado no site atual</span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-[#a4aab5] mt-2 block">Não identificado</span>
                  )}
                </div>

                <div className="rounded-xl border border-white/[0.1] bg-[#171b20] p-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#d3d7dd]">
                    <BrandIcon brand="whatsapp" className="h-4 w-4" alt="WhatsApp" />
                    WhatsApp
                  </div>

                  {whatsapps.length > 0 ? (
                    <div className="mt-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-[#ecedf0] truncate">{whatsapps[0]}</span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      </div>
                      <a
                        href={whatsappUrl || undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => recordRecommendationWhatsApp(business)}
                        className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1.5 text-[10px] font-semibold text-white transition"
                      >
                        <img src="/whatsapp_icone.png" alt="" className="w-3.5 h-3.5 object-contain" />
                        Abrir WhatsApp
                      </a>
                    </div>
                  ) : whatsappUrl ? (
                    <div className="mt-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-semibold text-amber-300">Possível WhatsApp</span>
                        <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      </div>
                      <span className="mt-1 block truncate text-[10px] text-[#d3d7dd]">{whatsappCandidate}</span>
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => recordRecommendationWhatsApp(business)}
                        className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-700 bg-emerald-600 px-2.5 py-1.5 text-[10px] font-semibold text-white transition hover:bg-emerald-700"
                      >
                        <BrandIcon brand="whatsapp" className="h-3.5 w-3.5" alt="WhatsApp" />
                        Testar no WhatsApp
                      </a>
                    </div>
                  ) : (
                    <div className="mt-2">
                      <span className="text-[10px] text-[#d3d7dd] block">Não identificado</span>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-white/[0.1] bg-[#171b20] p-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#d3d7dd]">
                    <Mail className="w-3.5 h-3.5" />
                    Email
                  </div>

                  {emails.length > 0 ? (
                    <a
                      href={`mailto:${emails[0]}`}
                      className="mt-2 flex items-center justify-between gap-2 text-[11px] font-medium text-[#ecedf0] hover:text-[#FF4D00]"
                    >
                      <span className="truncate">{emails[0]}</span>
                      {verifiedEmailKeys.has(normalizeEmail(emails[0])) ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-[#a4aab5] shrink-0" />
                      )}
                    </a>
                  ) : (
                    <span className="text-[10px] text-[#a4aab5] mt-2 block">Não identificado</span>
                  )}
                </div>

                <div className="rounded-xl border border-white/[0.1] bg-[#171b20] p-3">
                  <div className="text-[10px] font-semibold text-[#d3d7dd]">CNPJ</div>
                  {cnpj.length > 0 ? (
                    <span className="mt-2 block truncate font-mono text-[10px] text-[#d3d7dd]">{cnpj[0]}</span>
                  ) : (
                    <span className="text-[10px] text-[#a4aab5] mt-2 block">Não identificado</span>
                  )}
                </div>
              </div>

              {(unverifiedDatasetPhones.length > 0 || unverifiedDatasetEmails.length > 0) && (
                <details className="mt-3 border-t border-white/[0.085] pt-2.5">
                  <summary className="cursor-pointer text-[9px] font-medium text-[#a4aab5] hover:text-white">
                    Ver dados antigos ou ainda não confirmados da base
                  </summary>
                  <div className="mt-2 space-y-1.5">
                    {unverifiedDatasetPhones.slice(0, 3).map((phone: string, idx: number) => (
                      <div key={`old-phone-${idx}`} className="flex items-center justify-between gap-2 text-[10px] text-[#d3d7dd]">
                        <span className="truncate">{phone}</span>
                        <span className="inline-flex items-center gap-1 text-[#a4aab5]">
                          <AlertCircle className="w-3 h-3" />
                          Não confirmado
                        </span>
                      </div>
                    ))}
                    {unverifiedDatasetEmails.slice(0, 3).map((email: string, idx: number) => (
                      <div key={`old-email-${idx}`} className="flex items-center justify-between gap-2 text-[10px] text-[#d3d7dd]">
                        <span className="truncate">{email}</span>
                        <span className="inline-flex items-center gap-1 text-[#a4aab5]">
                          <AlertCircle className="w-3 h-3" />
                          Não confirmado
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>

            {hasWebsite && (
              <>
                {isTrackingAuditLoading && !trackingAudit && (
                  <div className="rounded-2xl border border-white/[0.1] bg-[#14181d] p-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-4 h-4 border-2 border-[#FF4D00] border-t-transparent rounded-full animate-spin shrink-0" />
                      <div>
                        <span className="block text-[9px] font-semibold text-[#a4aab5] uppercase tracking-wider">
                          Tracking e privacidade
                        </span>
                        <span className="block text-[10px] text-[#d3d7dd] mt-0.5">
                          Analisando GA4, GTM, Meta Pixel e cookies
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {trackingAudit && <TrackingAuditPanel audit={trackingAudit} />}

                {trackingAuditError && !trackingAudit && !isTrackingAuditLoading && (
                  <div className="rounded-2xl border border-white/[0.1] bg-[#14181d] p-3.5">
                    <span className="block text-[9px] font-semibold text-[#a4aab5] uppercase tracking-wider">
                      Tracking e privacidade
                    </span>
                    <span className="block text-[10px] text-[#d3d7dd] mt-1">
                      Não foi possível concluir a análise automática deste site.
                    </span>
                  </div>
                )}
              </>
            )}

            {enrichmentData && Object.keys(enrichmentData.socials || {}).length > 0 && (
              <div className="rounded-2xl border border-white/[0.1] bg-[#14181d] p-3.5">
                <span className="block text-[9px] font-semibold text-[#a4aab5] uppercase tracking-wider mb-2">
                  Redes sociais confirmadas no site
                </span>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(enrichmentData.socials).map(([net, item]: any) => (
                    <a
                      key={net}
                      href={item.value}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium text-[#d3d7dd] bg-[#171b20] hover:bg-white/[0.07] border border-white/[0.1] transition"
                    >
                      {brandFromUrl(item.value) ? <BrandIcon brand={brandFromUrl(item.value)!} className="h-4 w-4" alt={String(net)} /> : null}
                      <span className="capitalize">{net}</span>
                      <ArrowUpRight className="w-3 h-3 text-[#a4aab5]" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {team.length > 0 && (
              <div className="rounded-2xl border border-white/[0.1] bg-[#14181d] p-3.5">
                <span className="block text-[9px] font-semibold text-[#a4aab5] uppercase tracking-wider mb-2">
                  Equipe pública
                </span>
                <div className="space-y-1.5">
                  {team.slice(0, 4).map((member: any, idx: number) => (
                    <div key={idx} className="text-[10px] text-[#a4aab5]">
                      <span className="font-semibold text-[#ecedf0]">{member.name}</span>
                      {member.role && <span className="ml-1 text-[#a4aab5]">{member.role}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Google PageSpeed Insights Section (quando houver site) */}
        {hasWebsite && (
          <div className="mb-5 p-4 sm:p-5 bg-[#14181d] rounded-2xl border border-white/[0.1] space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <Gauge className="h-5 w-5 text-[#ff9d6c]" aria-label="Google PageSpeed" />
                <div>
                  <h4 className="text-xs font-bold text-[#f6f6f7] uppercase tracking-wider">
                    Google PageSpeed Insights
                  </h4>
                  <p className="text-[11px] text-[#d3d7dd]">
                    Métricas reais de velocidade mobile e Core Web Vitals
                  </p>
                </div>
              </div>

              {/* Score upfront */}
              <div className="flex items-center gap-2">
                <div
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border shadow-2xs ${
                    isSpeedLoading
                      ? 'bg-white/[0.06] text-[#a4aab5] border-white/[0.1] animate-pulse'
                      : pageSpeed
                      ? pageSpeed.score >= 90
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                        : pageSpeed.score >= 50
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                        : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                      : 'bg-white/[0.06] text-[#a4aab5] border-white/[0.1]'
                  }`}
                >
                  <Gauge className="h-4 w-4 text-[#ff9d6c]" aria-label="Velocidade" />
                  <span>
                    {isSpeedLoading
                      ? 'Medindo...'
                      : pageSpeed
                      ? `Score: ${pageSpeed.score}/100 • ${
                          pageSpeed.score >= 90
                            ? 'Rápido'
                            : pageSpeed.score >= 50
                            ? 'Médio'
                            : 'Crítico'
                        }`
                      : 'Score indisponível'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsSpeedDetailsExpanded(!isSpeedDetailsExpanded)}
                  className="text-xs font-bold text-[#FF4D00] hover:text-[#E04400] flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-white/[0.07]/[0.08] transition cursor-pointer"
                >
                  <span>{isSpeedDetailsExpanded ? 'Recolher' : 'Ver mais informações'}</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${
                      isSpeedDetailsExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            {pageSpeed && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center pt-1">
                <div className="p-2 bg-[#14181d] rounded-xl border border-white/[0.1]">
                  <span className="block text-[10px] text-[#a4aab5] font-bold uppercase">FCP (1ª Pintura)</span>
                  <span className="text-xs font-black text-[#ecedf0]">{pageSpeed.fcp || '-'}</span>
                </div>
                <div className="p-2 bg-[#14181d] rounded-xl border border-white/[0.1]">
                  <span className="block text-[10px] text-[#a4aab5] font-bold uppercase">LCP (Maior Conteúdo)</span>
                  <span className="text-xs font-black text-[#ecedf0]">{pageSpeed.lcp || '-'}</span>
                </div>
                <div className="p-2 bg-[#14181d] rounded-xl border border-white/[0.1]">
                  <span className="block text-[10px] text-[#a4aab5] font-bold uppercase">TBT (Bloqueio)</span>
                  <span className="text-xs font-black text-[#ecedf0]">{pageSpeed.tbt || '-'}</span>
                </div>
                <div className="p-2 bg-[#14181d] rounded-xl border border-white/[0.1]">
                  <span className="block text-[10px] text-[#a4aab5] font-bold uppercase">CLS (Estabilidade)</span>
                  <span className="text-xs font-black text-[#ecedf0]">{pageSpeed.cls || '-'}</span>
                </div>
              </div>
            )}

            {/* Expandable Details (recolhido por padrão) */}
            {isSpeedDetailsExpanded && pageSpeed && (
              <div className="pt-2 space-y-3 border-t border-white/[0.085]">
                {/* Commercial Opportunity Pitch */}
                <div className="p-3 bg-[#14181d] rounded-xl border border-white/[0.1] space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#f6f6f7]">
                    <Sparkles className="w-4 h-4 text-[#FF4D00]" />
                    <span>Oportunidade Comercial para Prospecção</span>
                  </div>
                  <strong className="text-xs text-[#ecedf0] block">
                    {pageSpeed.opportunityTitle}
                  </strong>
                  <p className="text-xs text-[#a4aab5] leading-relaxed">
                    {pageSpeed.opportunityDescription}
                  </p>
                </div>

                {/* Diagnostics list */}
                {pageSpeed.diagnostics && pageSpeed.diagnostics.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-[#d3d7dd] uppercase tracking-wider block">
                      Diagnósticos Técnicos Recomendados
                    </span>
                    <div className="space-y-1">
                      {pageSpeed.diagnostics.map((diag, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between text-xs bg-[#14181d] px-3 py-2 rounded-lg border border-white/[0.1]"
                        >
                          <span className="text-[#d3d7dd]">{diag.title}</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              diag.impact === 'Crítico'
                                ? 'bg-rose-500/15 text-rose-300'
                                : diag.impact === 'Alto'
                                ? 'bg-amber-500/15 text-amber-300'
                                : 'bg-white/[0.06] text-[#d3d7dd]'
                            }`}
                          >
                            Impacto {diag.impact}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Gestão de Prospecção (Pipeline e Anotações) */}
        <div className="border-t border-white/[0.085] pt-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div>
              <span className="text-xs font-bold text-[#f6f6f7] uppercase tracking-wider block">
                Funil de Vendas (CRM)
              </span>
              <span className="text-[11px] text-[#d3d7dd]">
                Selecione a etapa deste lead no seu processo comercial:
              </span>
            </div>

            {/* Stages Selector Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'NOVO', label: 'Fora do Funil' },
                  { id: 'CONTATADO', label: 'Contatado' },
                  { id: 'EM_NEGOCIACAO', label: 'Em Negociação' },
                  { id: 'FECHADO', label: 'Fechado' },
                  { id: 'PERDIDO', label: 'Perdido' },
                ] as const
              ).map((stage) => {
                const isActive = currentLeadStatus === stage.id;
                return (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => handleStatusChange(stage.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      isActive
                        ? 'bg-[#FF4D00] text-white shadow-2xs'
                        : 'bg-white/[0.06] hover:bg-white/[0.1] text-[#d3d7dd]'
                    }`}
                  >
                    {stage.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-3">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Adicione anotações sobre este negócio (ex: responsável, histórico de contato, interesse)..."
              rows={3}
              className="w-full text-xs p-3 rounded-xl border border-white/[0.085] bg-[#171b20] text-[#ecedf0] focus:outline-hidden focus:border-[#FF4D00] resize-none"
            />
            <div className="flex justify-end mt-2">
              <button
                type="button"
                onClick={handleSaveNotes}
                className="text-xs font-semibold bg-[#FF5A12] hover:bg-[#ff6a2a] text-white px-3.5 py-1.5 rounded-xl transition"
              >
                Salvar Anotações
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}