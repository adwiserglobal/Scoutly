import { useState, useEffect } from 'react';
import { ArrowUpRight, ExternalLink, Phone, X, Plus, Check, Columns3, Trash2, Star, ChevronDown, Sparkles, Copy, MessageCircle, RefreshCw, AlertCircle, CheckCircle2, Globe2, Activity, Mail } from 'lucide-react';
import { Business, LeadStatus } from '../types';
import { enrichBusinessData, fetchTrackingAudit, getWhatsAppLink, getTrustIcon, generateMessage } from '../services/api';
import { translateCategory } from '../utils/categoryTranslator';
import { usePageSpeed } from '../hooks/usePageSpeed';
import TrackingAuditPanel from './TrackingAuditPanel';

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

  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichmentData, setEnrichmentData] = useState<any>(null);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [trackingAudit, setTrackingAudit] = useState<any>(null);
  const [isTrackingAuditLoading, setIsTrackingAuditLoading] = useState(false);
  const [trackingAuditError, setTrackingAuditError] = useState<string | null>(null);

  const [isGeneratingMessage, setIsGeneratingMessage] = useState(false);
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [messageVariation, setMessageVariation] = useState(0);
  const [messageSource, setMessageSource] = useState<'gemini' | 'openrouter' | 'template' | null>(null);
  const [messageModel, setMessageModel] = useState('');
  const [messageError, setMessageError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

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
  }, [business]);

  const hasWebsite = Boolean(business.website);
  const confidencePercent = Math.round((business.confidence || 0.8) * 100);
  const isFavorited = Boolean(business.isFavorite);

  const { data: pageSpeed, isLoading: isSpeedLoading } = usePageSpeed(
    hasWebsite ? business.website : null
  );

  useEffect(() => {
    let cancelled = false;

    setTrackingAudit(null);
    setTrackingAuditError(null);

    if (!business.website) {
      setIsTrackingAuditLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setIsTrackingAuditLoading(true);

    fetchTrackingAudit(business.website)
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
  }, [business.id, business.website]);

  useEffect(() => {
    let cancelled = false;

    if (!business.website) return () => {
      cancelled = true;
    };

    enrichBusinessData(business.website)
      .then((data) => {
        if (cancelled) return;
        setEnrichmentData(data);
        if (data?.trackingAudit) {
          setTrackingAudit(data.trackingAudit);
          setTrackingAuditError(null);
        }
      })
      .catch((error) => {
        // Automatic freshness check is best-effort. Manual refresh below surfaces errors.
        console.warn('[Scoutly Contact Freshness] Falha:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [business.id, business.website]);

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
    if (!business.website) return;
    setIsEnriching(true);
    setEnrichError(null);
    try {
      const data = await enrichBusinessData(business.website, true);
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

  // Contact quality: current official website evidence wins over dataset contacts.
  const normalizePhone = (value: string) => String(value || '').replace(/\D/g, '');
  const normalizeEmail = (value: string) => String(value || '').trim().toLowerCase();

  const datasetPhones = Array.isArray(business.phones)
    ? [...business.phones]
    : business.phone
      ? [business.phone]
      : [];
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

  // WhatsApp CTA is only shown when the current official website exposes an explicit WhatsApp link.
  const verifiedWhatsappTarget = whatsapps[0] || null;
  let whatsappUrl = getWhatsAppLink(verifiedWhatsappTarget);

  if (whatsappUrl && generatedMessage) {
    whatsappUrl = `${whatsappUrl}?text=${encodeURIComponent(generatedMessage)}`;
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

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto no-scrollbar cursor-pointer"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl bg-white rounded-3xl border border-[#EDE8E0] shadow-2xl p-5 sm:p-6 my-auto max-h-[92vh] overflow-y-auto no-scrollbar cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button top-right */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl transition cursor-pointer z-20"
          title="Fechar"
        >
          <X className="w-5 h-5" />
        </button>
        {/* Loading Overlay cobrindo toda a área do modal durante o enriquecimento */}
        {isEnriching && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#FFF8F3]/85 backdrop-blur-sm transition-all duration-300 rounded-3xl p-6">
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
                <span className="text-xs font-bold uppercase tracking-wider text-stone-900">
                  Carregando
                </span>
              </div>
              <p className="text-[11px] text-stone-500 font-medium mt-1">
                Consultando dados do site...
              </p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-stone-100 pb-5 mb-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <h2 className="text-2xl font-bold text-stone-900 tracking-tight leading-snug">
                {business.name}
              </h2>
              <button
                type="button"
                onClick={handleToggleFavorite}
                className="p-1.5 hover:bg-stone-100 rounded-xl transition cursor-pointer text-stone-400 hover:text-amber-500 shrink-0"
                title={isFavorited ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
              >
                <Star
                  className={`w-5 h-5 ${
                    isFavorited
                      ? 'fill-amber-500 text-amber-500'
                      : 'text-stone-300 hover:text-stone-400'
                  }`}
                />
              </button>
            </div>
            <p className="text-xs text-stone-500 font-medium mt-1">
              {translateCategory(business.category)}
            </p>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 mt-4">
              {hasWebsite && (
                <a
                  href={business.website!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-stone-700 bg-white hover:bg-stone-50 border border-stone-200 transition"
                >
                  <Globe2 className="w-3.5 h-3.5 text-stone-400" />
                  <span>Ver site</span>
                </a>
              )}

              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 border border-emerald-600 transition shadow-2xs"
                  title="Este número de WhatsApp foi verificado com base nas informações disponibilizadas pela empresa no site"
                >
                  <img src="/whatsapp_icone.png" alt="WhatsApp" className="w-4 h-4 object-contain" />
                  <span>Conversar no WhatsApp</span>
                  <CheckCircle2
                    className="w-3.5 h-3.5 text-white/90"
                    aria-label="WhatsApp verificado"
                  />
                </a>
              )}

              {!whatsappUrl && primaryVerifiedPhone && (
                <a
                  href={`tel:${primaryVerifiedPhone}`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-stone-700 bg-white hover:bg-stone-50 border border-stone-200 transition"
                  title="Telefone confirmado no site oficial"
                >
                  <Phone className="w-3.5 h-3.5 text-stone-400" />
                  <span>Ligar</span>
                </a>
              )}

              <button
                type="button"
                onClick={() => handleGenerateMessage(false)}
                disabled={isGeneratingMessage}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-[#FF4D00] bg-white hover:bg-[#FFF7F3] border border-[#FF4D00]/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingMessage ? (
                  <div className="w-3.5 h-3.5 border-2 border-[#FF4D00] border-t-transparent rounded-full animate-spin shrink-0" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-[#FF4D00]" />
                )}
                <span>{isGeneratingMessage ? 'Gerando...' : 'Gerar mensagem'}</span>
              </button>
            </div>

            {/* AI Generated Message Box */}
            {messageError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
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

                    {messageSource === 'template' ? (
                      <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-stone-500">
                        <AlertCircle className="w-3 h-3" />
                        Fallback local
                      </span>
                    ) : messageSource ? (
                      <span
                        className="inline-flex items-center gap-1 text-[9px] font-semibold text-stone-500"
                        title={messageModel || undefined}
                      >
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        IA ativa
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleGenerateMessage(true)}
                      disabled={isGeneratingMessage}
                      className="flex items-center gap-1.5 text-[10px] font-bold text-stone-600 hover:text-stone-900 bg-white hover:bg-stone-50 border border-stone-200 px-2.5 py-1.5 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
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
                <div className="text-xs text-stone-800 whitespace-pre-wrap leading-relaxed">
                  {generatedMessage}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Resumo rápido */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-5 px-1 text-[10px] text-stone-500">
          <span className="inline-flex items-center gap-1.5">
            {hasWebsite ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-stone-400" />
            )}
            {hasWebsite ? 'Site identificado' : 'Site não identificado'}
          </span>

          <span className="inline-flex items-center gap-1.5">
            {whatsapps.length > 0 ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            ) : verifiedPhones.length > 0 || verifiedEmails.length > 0 ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-stone-400" />
            )}
            {whatsapps.length > 0
              ? 'WhatsApp verificado'
              : verifiedPhones.length > 0 || verifiedEmails.length > 0
                ? 'Contato verificado'
                : 'Contato não confirmado'}
          </span>

          <span className="inline-flex items-center gap-1.5">
            {trackingAudit?.hasTracking ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-stone-400" />
            )}
            {isTrackingAuditLoading
              ? 'Tracking em análise'
              : trackingAudit?.hasTracking
                ? 'Tracking detectado'
                : 'Tracking não confirmado'}
          </span>

          <span className="inline-flex items-center gap-1.5">
            {pageSpeed ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-stone-400" />
            )}
            {isSpeedLoading ? 'Performance em análise' : pageSpeed ? `PageSpeed ${pageSpeed.score}/100` : 'Performance indisponível'}
          </span>
        </div>

        {/* Informações Principais */}
        <div className="grid grid-cols-1 lg:grid-cols-[0.82fr_1.18fr] gap-5 mb-5">
          {/* Coluna Esquerda: Informações do Estabelecimento */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-stone-900 border-b border-stone-100 pb-2">
              Informações do Estabelecimento
            </h3>
            
            <div className="p-4 bg-[#FAF7F2] rounded-2xl border border-[#EDE8E0]">
              <span className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                Endereço Completo
              </span>
              <span className="text-xs font-semibold text-stone-800 mt-1 block">
                {business.address}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div className="p-4 bg-[#FAF7F2] rounded-2xl border border-[#EDE8E0]">
                <span className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                  Confiabilidade
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm font-bold text-stone-900">
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
              <div className="p-4 bg-[#FAF7F2] rounded-2xl border border-[#EDE8E0]">
                <span className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                  Horário de Funcionamento
                </span>
                <span className="text-xs font-bold text-stone-900 mt-1 block">
                  {business.openStatusText || 'Horário não identificado'}
                </span>
                {business.openingHoursRaw && (
                  <span className="text-[10px] text-stone-500 block mt-0.5 font-mono">
                    {business.openingHoursRaw}
                  </span>
                )}
              </div>
            </div>

            {/* Redes Sociais */}
            <div className="p-4 bg-[#FAF7F2] rounded-2xl border border-[#EDE8E0]">
              <span className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">
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
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-stone-800 bg-white hover:bg-stone-50 border border-[#EDE8E0] hover:border-stone-400 transition shadow-2xs group max-w-full truncate"
                      >
                        <span className="truncate">{soc.replace(/^https?:\/\/(www\.)?/, '')}</span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-stone-400 group-hover:text-stone-900 shrink-0" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs font-medium text-stone-500 italic">
                    Nenhuma rede social registrada
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Coluna Direita: Enriquecimento */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-stone-100 pb-2">
              <div>
                <h3 className="text-sm font-semibold text-stone-900">Enriquecimento Digital</h3>
                <p className="text-[10px] text-stone-400 mt-0.5">Sinais atuais encontrados no site e nas fontes do negócio</p>
              </div>
              {hasWebsite && (
                <button
                  onClick={handleEnrich}
                  disabled={isEnriching}
                  className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg bg-white text-stone-600 hover:text-stone-900 border border-stone-200 hover:border-stone-300 disabled:opacity-50 transition"
                >
                  <RefreshCw className={`w-3 h-3 ${isEnriching ? 'animate-spin' : ''}`} />
                  {isEnriching ? 'Verificando' : 'Verificar novamente'}
                </button>
              )}
            </div>

            {enrichError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                {enrichError}
              </div>
            )}

            <div className="rounded-2xl border border-stone-200 bg-white p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="block text-[9px] font-semibold text-stone-400 uppercase tracking-wider">
                    Site oficial
                  </span>
                  {hasWebsite ? (
                    <a
                      href={business.website!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-stone-800 hover:text-[#FF4D00] min-w-0"
                    >
                      <Globe2 className="w-3.5 h-3.5 shrink-0 text-stone-400" />
                      <span className="truncate">{business.website}</span>
                      <ArrowUpRight className="w-3.5 h-3.5 shrink-0 text-stone-400" />
                    </a>
                  ) : (
                    <span className="text-xs text-stone-500 mt-1.5 block">Site não identificado</span>
                  )}
                </div>

                {enrichmentData?.siteStatus === 'verified' && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-stone-500 shrink-0">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Online
                  </span>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-3.5">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <span className="block text-[9px] font-semibold text-stone-400 uppercase tracking-wider">
                    Contatos
                  </span>
                  <span className="block text-[10px] text-stone-400 mt-0.5">
                    Contatos atuais têm prioridade sobre dados antigos da base
                  </span>
                </div>

                {hasFreshContactEvidence && contactCheckedAt && (
                  <span
                    className="inline-flex items-center gap-1 text-[9px] font-semibold text-stone-500 shrink-0"
                    title={`Verificado em ${contactCheckedAt.toLocaleString('pt-BR')}`}
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Verificado agora
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-stone-200 bg-[#FCFBF9] p-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-stone-500">
                    <Phone className="w-3.5 h-3.5" />
                    Telefone
                  </div>

                  {verifiedPhones.length > 0 ? (
                    <div className="mt-2 space-y-1.5">
                      {verifiedPhones.slice(0, 2).map((phone: string, idx: number) => (
                        <a
                          key={`verified-ph-${idx}`}
                          href={`tel:${phone}`}
                          className="flex items-center justify-between gap-2 text-[11px] font-medium text-stone-800"
                        >
                          <span className="truncate">{phone}</span>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        </a>
                      ))}
                    </div>
                  ) : datasetPhones.length > 0 ? (
                    <div className="mt-2">
                      <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-stone-700">
                        <span className="truncate">{datasetPhones[0]}</span>
                        <AlertCircle className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      </div>
                      <span className="text-[9px] text-stone-400 mt-1 block">Não confirmado no site atual</span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-stone-400 mt-2 block">Não identificado</span>
                  )}
                </div>

                <div className="rounded-xl border border-stone-200 bg-[#FCFBF9] p-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-stone-500">
                    <MessageCircle className="w-3.5 h-3.5" />
                    WhatsApp
                  </div>

                  {whatsapps.length > 0 ? (
                    <div className="mt-2">
                      <div
                        className="flex items-center justify-between gap-2"
                        title="Este número de WhatsApp foi verificado com base nas informações disponibilizadas pela empresa no site"
                      >
                        <span className="text-[11px] font-medium text-stone-800 truncate">{whatsapps[0]}</span>
                        <span className="inline-flex items-center gap-1 text-[9px] font-medium text-stone-500 shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Verificado
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2">
                      <span className="text-[10px] text-stone-500 block">Não confirmado</span>
                      <span className="text-[9px] text-stone-400 mt-1 block">
                        Um telefone comum não é tratado como WhatsApp sem evidência no site.
                      </span>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-stone-200 bg-[#FCFBF9] p-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-stone-500">
                    <Mail className="w-3.5 h-3.5" />
                    Email
                  </div>

                  {emails.length > 0 ? (
                    <a
                      href={`mailto:${emails[0]}`}
                      className="mt-2 flex items-center justify-between gap-2 text-[11px] font-medium text-stone-800 hover:text-[#FF4D00]"
                    >
                      <span className="truncate">{emails[0]}</span>
                      {verifiedEmailKeys.has(normalizeEmail(emails[0])) ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      )}
                    </a>
                  ) : (
                    <span className="text-[10px] text-stone-400 mt-2 block">Não identificado</span>
                  )}
                </div>

                <div className="rounded-xl border border-stone-200 bg-[#FCFBF9] p-3">
                  <div className="text-[10px] font-semibold text-stone-500">CNPJ</div>
                  {cnpj.length > 0 ? (
                    <span className="mt-2 block truncate font-mono text-[10px] text-stone-700">{cnpj[0]}</span>
                  ) : (
                    <span className="text-[10px] text-stone-400 mt-2 block">Não identificado</span>
                  )}
                </div>
              </div>

              {(unverifiedDatasetPhones.length > 0 || unverifiedDatasetEmails.length > 0) && (
                <details className="mt-3 border-t border-stone-100 pt-2.5">
                  <summary className="cursor-pointer text-[9px] font-medium text-stone-400 hover:text-stone-600">
                    Ver dados antigos ou ainda não confirmados da base
                  </summary>
                  <div className="mt-2 space-y-1.5">
                    {unverifiedDatasetPhones.slice(0, 3).map((phone: string, idx: number) => (
                      <div key={`old-phone-${idx}`} className="flex items-center justify-between gap-2 text-[10px] text-stone-500">
                        <span className="truncate">{phone}</span>
                        <span className="inline-flex items-center gap-1 text-stone-400">
                          <AlertCircle className="w-3 h-3" />
                          Não confirmado
                        </span>
                      </div>
                    ))}
                    {unverifiedDatasetEmails.slice(0, 3).map((email: string, idx: number) => (
                      <div key={`old-email-${idx}`} className="flex items-center justify-between gap-2 text-[10px] text-stone-500">
                        <span className="truncate">{email}</span>
                        <span className="inline-flex items-center gap-1 text-stone-400">
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
              <details className="group rounded-2xl border border-stone-200 bg-white overflow-hidden">
                <summary className="list-none cursor-pointer flex items-center justify-between gap-3 px-4 py-3.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Activity className="w-4 h-4 text-stone-400 shrink-0" />
                    <div className="min-w-0">
                      <span className="block text-[11px] font-semibold text-stone-800">Tracking e privacidade</span>
                      <span className="block text-[9px] text-stone-400 mt-0.5 truncate">
                        GA4, GTM, Meta Pixel e consentimento de cookies
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="inline-flex items-center gap-1 text-[9px] font-medium text-stone-500">
                      {isTrackingAuditLoading ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          Analisando
                        </>
                      ) : trackingAudit?.hasTracking ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Detectado
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3 h-3 text-stone-400" />
                          Não confirmado
                        </>
                      )}
                    </span>
                    <ChevronDown className="w-4 h-4 text-stone-400 transition-transform group-open:rotate-180" />
                  </div>
                </summary>

                <div className="border-t border-stone-100 p-3.5">
                  {isTrackingAuditLoading && !trackingAudit && (
                    <div className="flex items-center gap-2 text-[10px] text-stone-500">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#FF4D00]" />
                      Analisando sinais de tracking
                    </div>
                  )}

                  {trackingAudit && <TrackingAuditPanel audit={trackingAudit} />}

                  {trackingAuditError && !trackingAudit && !isTrackingAuditLoading && (
                    <div className="text-[10px] text-stone-500">
                      Não foi possível concluir a análise automática deste site.
                    </div>
                  )}
                </div>
              </details>
            )}

            {(enrichmentData && Object.keys(enrichmentData.socials || {}).length > 0) || team.length > 0 ? (
              <details className="group rounded-2xl border border-stone-200 bg-white overflow-hidden">
                <summary className="list-none cursor-pointer flex items-center justify-between gap-3 px-4 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <Globe2 className="w-4 h-4 text-stone-400" />
                    <div>
                      <span className="block text-[11px] font-semibold text-stone-800">Mais dados digitais</span>
                      <span className="block text-[9px] text-stone-400 mt-0.5">Redes sociais e equipe pública</span>
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-stone-400 transition-transform group-open:rotate-180" />
                </summary>

                <div className="border-t border-stone-100 p-3.5 space-y-3">
                  {enrichmentData && Object.keys(enrichmentData.socials || {}).length > 0 && (
                    <div>
                      <span className="block text-[9px] font-semibold text-stone-400 uppercase tracking-wider mb-2">
                        Redes sociais confirmadas no site
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(enrichmentData.socials).map(([net, item]: any) => (
                          <a
                            key={net}
                            href={item.value}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium text-stone-700 bg-[#FCFBF9] hover:bg-stone-50 border border-stone-200 transition"
                          >
                            <span className="capitalize">{net}</span>
                            <ArrowUpRight className="w-3 h-3 text-stone-400" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {team.length > 0 && (
                    <div>
                      <span className="block text-[9px] font-semibold text-stone-400 uppercase tracking-wider mb-2">
                        Equipe pública
                      </span>
                      <div className="space-y-1.5">
                        {team.slice(0, 4).map((member: any, idx: number) => (
                          <div key={idx} className="text-[10px] text-stone-600">
                            <span className="font-semibold text-stone-800">{member.name}</span>
                            {member.role && <span className="ml-1 text-stone-400">{member.role}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </details>
            ) : null}

          </div>
        </div>

        {/* Google PageSpeed Insights */}
        {hasWebsite && (
          <details className="group mb-4 rounded-2xl border border-stone-200 bg-white overflow-hidden">
            <summary className="list-none cursor-pointer flex items-center justify-between gap-3 px-4 py-3.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <img src="/velocimetro.png" alt="Google PageSpeed" className="w-4 h-4 object-contain shrink-0" />
                <div className="min-w-0">
                  <span className="block text-[11px] font-semibold text-stone-800">Performance do site</span>
                  <span className="block text-[9px] text-stone-400 mt-0.5">Google PageSpeed e Core Web Vitals</span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-semibold text-stone-600">
                  {isSpeedLoading ? 'Medindo' : pageSpeed ? `${pageSpeed.score}/100` : 'Indisponível'}
                </span>
                <ChevronDown className="w-4 h-4 text-stone-400 transition-transform group-open:rotate-180" />
              </div>
            </summary>

            <div className="border-t border-stone-100 p-4 space-y-3">
              {isSpeedLoading && (
                <div className="flex items-center gap-2 text-[10px] text-stone-500">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#FF4D00]" />
                  Medindo performance
                </div>
              )}

              {pageSpeed && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      ['FCP', pageSpeed.fcp || '-'],
                      ['LCP', pageSpeed.lcp || '-'],
                      ['TBT', pageSpeed.tbt || '-'],
                      ['CLS', pageSpeed.cls || '-'],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-stone-200 bg-[#FCFBF9] p-2.5">
                        <span className="block text-[9px] font-semibold text-stone-400">{label}</span>
                        <span className="mt-1 block text-[11px] font-semibold text-stone-800">{value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-xl border border-stone-200 bg-[#FCFBF9] p-3">
                    <span className="block text-[10px] font-semibold text-stone-800">{pageSpeed.opportunityTitle}</span>
                    <p className="mt-1 text-[10px] leading-relaxed text-stone-500">{pageSpeed.opportunityDescription}</p>
                  </div>

                  {pageSpeed.diagnostics && pageSpeed.diagnostics.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="block text-[9px] font-semibold uppercase tracking-wider text-stone-400">
                        Diagnósticos
                      </span>
                      {pageSpeed.diagnostics.slice(0, 4).map((diag, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white px-3 py-2 text-[10px]"
                        >
                          <span className="text-stone-600">{diag.title}</span>
                          <span className="shrink-0 font-semibold text-stone-400">{diag.impact}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </details>
        )}

        {/* Gestão de Prospecção */}
        <details className="group rounded-2xl border border-stone-200 bg-white overflow-hidden">
          <summary className="list-none cursor-pointer flex items-center justify-between gap-3 px-4 py-3.5">
            <div>
              <span className="block text-[11px] font-semibold text-stone-800">Funil de vendas e anotações</span>
              <span className="block text-[9px] text-stone-400 mt-0.5">Status comercial e histórico deste lead</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-medium text-stone-500">
                {currentLeadStatus === 'NOVO' ? 'Fora do funil' : currentLeadStatus.replaceAll('_', ' ')}
              </span>
              <ChevronDown className="w-4 h-4 text-stone-400 transition-transform group-open:rotate-180" />
            </div>
          </summary>
          <div className="border-t border-stone-100 p-4">

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div>
              <span className="text-xs font-bold text-stone-900 uppercase tracking-wider block">
                Funil de Vendas (CRM)
              </span>
              <span className="text-[11px] text-stone-500">
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
                        : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
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
              className="w-full text-xs p-3 rounded-xl border border-[#EDE8E0] bg-[#FAF7F2] text-stone-800 focus:outline-hidden focus:border-[#FF4D00] resize-none"
            />
            <div className="flex justify-end mt-2">
              <button
                type="button"
                onClick={handleSaveNotes}
                className="text-xs font-semibold bg-stone-900 hover:bg-stone-800 text-white px-3.5 py-1.5 rounded-xl transition"
              >
                Salvar Anotações
              </button>
            </div>
          </div>
        
          </div>
        </details>
      </div>
    </div>
  );
}