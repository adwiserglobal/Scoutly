import { useState, useEffect } from 'react';
import { ArrowUpRight, ExternalLink, Phone, X, Plus, Check, Columns3, Trash2, Star, ChevronDown, Sparkles, Copy, MessageCircle, RefreshCw } from 'lucide-react';
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
      const data = await enrichBusinessData(business.website);
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

      const msg = await generateMessage(payload, {
        variationIndex: nextVariation,
        previousMessage: isVariation ? generatedMessage : '',
      });

      setGeneratedMessage(msg);
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

  // Merge Data Helpers (guarantee array safety)
  const phones = Array.isArray(business.phones)
    ? [...business.phones]
    : business.phone
    ? [business.phone]
    : [];
  const emails = Array.isArray(business.emails) ? [...business.emails] : [];
  const whatsapps: string[] = [];
  const cnpj: string[] = [];
  const team: any[] = [];

  if (enrichmentData) {
    enrichmentData.phones?.forEach((p: any) => {
      if (!phones.includes(p.value)) phones.push(p.value);
    });
    enrichmentData.emails?.forEach((e: any) => {
      if (!emails.includes(e.value)) emails.push(e.value);
    });
    enrichmentData.whatsapp?.forEach((w: any) => {
      whatsapps.push(w.value);
    });
    enrichmentData.cnpj?.forEach((c: any) => {
      cnpj.push(c.value);
    });
    enrichmentData.team?.forEach((t: any) => {
      team.push(t);
    });
  }

  // Calculate WhatsApp URL (prioritize explicitly verified WhatsApp, then fallback to phone)
  const whatsappTarget = whatsapps.length > 0 ? whatsapps[0] : business.phone;
  let whatsappUrl = getWhatsAppLink(whatsappTarget);
  if (whatsappUrl && generatedMessage) {
    whatsappUrl = `${whatsappUrl}?text=${encodeURIComponent(generatedMessage)}`;
  }

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto no-scrollbar cursor-pointer"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-white rounded-3xl border border-[#EDE8E0] shadow-2xl p-6 sm:p-8 my-auto max-h-[92vh] overflow-y-auto no-scrollbar cursor-default"
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
            <div className="flex flex-wrap items-center gap-2.5 mt-3.5">
              {/* Button: Ver site */}
              {hasWebsite && (
                <a
                  href={business.website!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold text-stone-800 bg-stone-100 hover:bg-stone-200 border border-stone-200 transition active:scale-95 shadow-2xs"
                >
                  <span>Ver site</span>
                </a>
              )}

              {/* Button: Conversar no WhatsApp */}
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 transition active:scale-95 shadow-2xs"
                >
                  <img src="/whatsapp_icone.png" alt="WhatsApp" className="w-4 h-4 object-contain" />
                  <span>Conversar no WhatsApp</span>
                </a>
              )}

              <button
                type="button"
                onClick={() => handleGenerateMessage(false)}
                disabled={isGeneratingMessage}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-[#FF4D00] bg-white/40 hover:bg-white/60 backdrop-blur-md border border-white/60 shadow-[0_4px_12px_rgba(255,77,0,0.08)] transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingMessage ? (
                  <div className="w-4 h-4 border-2 border-[#FF4D00] border-t-transparent rounded-full animate-spin shrink-0" />
                ) : (
                  <Sparkles className="w-4 h-4 text-[#FF4D00]" />
                )}
                <span>{isGeneratingMessage ? 'Gerando...' : 'Gerar Mensagem (IA)'}</span>
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
                  <span className="text-[10px] font-bold text-[#FF4D00] uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Mensagem Gerada
                  </span>

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

        {/* Informações Principais */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Coluna Esquerda: Informações do Estabelecimento */}
          <div className="space-y-3.5">
            <h3 className="text-sm font-bold text-stone-900 border-b border-stone-100 pb-2">
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
          <div className="space-y-3.5">
            <div className="flex items-center justify-between border-b border-stone-100 pb-2">
              <h3 className="text-sm font-bold text-stone-900">Enriquecimento Digital</h3>
              {hasWebsite && !enrichmentData && (
                <button
                  onClick={handleEnrich}
                  disabled={isEnriching}
                  className="text-[10px] font-bold tracking-wider uppercase px-3 py-1.5 rounded-lg bg-[#FF4D00] text-white hover:bg-[#E04400] disabled:opacity-50 transition"
                >
                  {isEnriching ? 'Buscando...' : 'Atualizar Dados'}
                </button>
              )}
            </div>

            {enrichError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                {enrichError}
              </div>
            )}

            {/* Site */}
            <div className="p-4 bg-[#FAF7F2] rounded-2xl border border-[#EDE8E0]">
              <span className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">
                Site Oficial
              </span>
              <div>
                {hasWebsite ? (
                  <a
                    href={business.website!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-between gap-2 w-full px-3.5 py-2.5 rounded-xl text-xs font-bold text-[#FF4D00] bg-white border border-[#FF4D00]/30 hover:bg-[#FF4D00] hover:text-white transition shadow-2xs group"
                  >
                    <span className="truncate">{business.website}</span>
                    <ArrowUpRight className="w-4 h-4 shrink-0 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </a>
                ) : (
                  <span className="text-xs font-medium text-stone-500 italic">
                    Site não identificado
                  </span>
                )}
              </div>
            </div>

            {hasWebsite && (
              <>
                {isTrackingAuditLoading && !trackingAudit && (
                  <div className="p-4 bg-[#FAF7F2] rounded-2xl border border-[#EDE8E0]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-4 h-4 border-2 border-[#FF4D00] border-t-transparent rounded-full animate-spin shrink-0" />
                      <div>
                        <span className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                          Tracking & Privacidade
                        </span>
                        <span className="block text-[11px] text-stone-600 mt-0.5">
                          Analisando GA4, GTM, Meta Pixel e cookies...
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {trackingAudit && <TrackingAuditPanel audit={trackingAudit} />}

                {trackingAuditError && !trackingAudit && !isTrackingAuditLoading && (
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200">
                    <span className="block text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                      Tracking & Privacidade
                    </span>
                    <span className="block text-[11px] text-amber-800 mt-1">
                      Não foi possível concluir a análise automática deste site.
                    </span>
                  </div>
                )}
              </>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Contatos */}
              <div className="p-4 bg-[#FAF7F2] rounded-2xl border border-[#EDE8E0]">
                <span className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">
                  Telefone / WhatsApp
                </span>
                {phones.length > 0 || whatsapps.length > 0 ? (
                  <div className="space-y-2">
                    {/* Botões de WhatsApp com ícone e ação direta */}
                    {whatsapps.map((w: any, idx) => {
                      let waLink = getWhatsAppLink(w);
                      if (waLink && generatedMessage) {
                        waLink = `${waLink}?text=${encodeURIComponent(generatedMessage)}`;
                      }
                      return (
                        <a
                          key={`wa-${idx}`}
                          href={waLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-bold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 transition shadow-2xs group"
                          title="Abrir WhatsApp"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <img
                              src="/whatsapp_icone.png"
                              alt="WhatsApp"
                              className="w-4 h-4 object-contain shrink-0"
                            />
                            <span className="truncate">{w}</span>
                          </div>
                          <span className="text-[10px] uppercase tracking-wider bg-emerald-200/80 group-hover:bg-emerald-300 text-emerald-950 font-bold px-1.5 py-0.5 rounded-md shrink-0">
                            Abrir
                          </span>
                        </a>
                      );
                    })}

                    {/* Telefones fixos / adicionais */}
                    {phones
                      .filter((p: any) => !whatsapps.includes(p))
                      .map((p: any, idx) => (
                        <a
                          key={`ph-${idx}`}
                          href={`tel:${p}`}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium text-stone-800 bg-white hover:bg-stone-50 border border-[#EDE8E0] transition"
                        >
                          <Phone className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          <span className="truncate">{p}</span>
                        </a>
                      ))}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <span className="block text-xs font-medium text-stone-500 italic">
                      Telefone não identificado
                    </span>
                    <span className="block text-xs font-medium text-stone-500 italic">
                      WhatsApp não identificado
                    </span>
                  </div>
                )}
              </div>

              {/* Email & CNPJ */}
              <div className="p-4 bg-[#FAF7F2] rounded-2xl border border-[#EDE8E0]">
                <span className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">
                  Email & CNPJ
                </span>
                {emails.length > 0 || cnpj.length > 0 ? (
                  <div className="space-y-1.5">
                    {emails.map((e: any, idx) => (
                      <a
                        key={`em-${idx}`}
                        href={`mailto:${e}`}
                        className="block text-xs text-stone-800 hover:text-[#FF4D00] truncate bg-white border border-[#EDE8E0] px-2.5 py-1.5 rounded-xl transition"
                        title={e}
                      >
                        {e}
                      </a>
                    ))}
                    {cnpj.map((c: any, idx) => (
                      <div
                        key={`cn-${idx}`}
                        className="text-xs font-mono text-stone-700 bg-stone-100 border border-stone-200 px-2.5 py-1 rounded-lg truncate"
                      >
                        CNPJ: {c}
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="block text-xs font-medium text-stone-500 italic">
                    Email não identificado
                  </span>
                )}
              </div>
            </div>

            {/* Redes Sociais do Site */}
            {enrichmentData && Object.keys(enrichmentData.socials).length > 0 && (
              <div className="p-4 bg-[#FAF7F2] rounded-2xl border border-[#EDE8E0]">
                <span className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">
                  Redes Sociais (Extraídas do Site)
                </span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {Object.entries(enrichmentData.socials).map(([net, item]: any) => (
                    <a
                      key={net}
                      href={item.value}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-stone-800 bg-white hover:bg-stone-50 border border-[#EDE8E0] hover:border-stone-400 transition shadow-2xs group max-w-full"
                    >
                      <span className="capitalize font-bold text-stone-900">{net}</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-stone-400 group-hover:text-stone-900 shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Equipe Pública */}
            <div className="p-4 bg-[#FAF7F2] rounded-2xl border border-[#EDE8E0]">
              <span className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">
                Equipe Pública Identificada
              </span>
              {team.length > 0 ? (
                <div className="space-y-2 mt-2 max-h-32 overflow-y-auto">
                  {team.map((t: any, idx) => (
                    <div key={idx} className="text-xs">
                      <span className="font-bold text-stone-800">{t.name}</span>
                      {t.role && <span className="text-stone-500 ml-1">- {t.role}</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-xs font-medium text-stone-500 italic">
                  Equipe não identificada publicamente
                </span>
              )}
            </div>

          </div>
        </div>

        {/* Google PageSpeed Insights Section (quando houver site) */}
        {hasWebsite && (
          <div className="mb-6 p-4 sm:p-5 bg-[#FAF7F2] rounded-2xl border border-[#EDE8E0] space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <img src="/velocimetro.png" alt="Google PageSpeed" className="w-5 h-5 object-contain" />
                <div>
                  <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                    Google PageSpeed Insights
                  </h4>
                  <p className="text-[11px] text-stone-500">
                    Métricas reais de velocidade mobile e Core Web Vitals
                  </p>
                </div>
              </div>

              {/* Score upfront */}
              <div className="flex items-center gap-2">
                <div
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border shadow-2xs ${
                    isSpeedLoading
                      ? 'bg-stone-100 text-stone-600 border-stone-200 animate-pulse'
                      : pageSpeed
                      ? pageSpeed.score >= 90
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : pageSpeed.score >= 50
                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                        : 'bg-rose-50 text-rose-800 border-rose-300'
                      : 'bg-stone-100 text-stone-600 border-stone-200'
                  }`}
                >
                  <img src="/velocimetro.png" alt="Speed" className="w-4 h-4 object-contain" />
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
                  className="text-xs font-bold text-[#FF4D00] hover:text-[#E04400] flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-stone-200/60 transition cursor-pointer"
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
                <div className="p-2 bg-white rounded-xl border border-stone-200">
                  <span className="block text-[10px] text-stone-400 font-bold uppercase">FCP (1ª Pintura)</span>
                  <span className="text-xs font-black text-stone-800">{pageSpeed.fcp || '-'}</span>
                </div>
                <div className="p-2 bg-white rounded-xl border border-stone-200">
                  <span className="block text-[10px] text-stone-400 font-bold uppercase">LCP (Maior Conteúdo)</span>
                  <span className="text-xs font-black text-stone-800">{pageSpeed.lcp || '-'}</span>
                </div>
                <div className="p-2 bg-white rounded-xl border border-stone-200">
                  <span className="block text-[10px] text-stone-400 font-bold uppercase">TBT (Bloqueio)</span>
                  <span className="text-xs font-black text-stone-800">{pageSpeed.tbt || '-'}</span>
                </div>
                <div className="p-2 bg-white rounded-xl border border-stone-200">
                  <span className="block text-[10px] text-stone-400 font-bold uppercase">CLS (Estabilidade)</span>
                  <span className="text-xs font-black text-stone-800">{pageSpeed.cls || '-'}</span>
                </div>
              </div>
            )}

            {/* Expandable Details (recolhido por padrão) */}
            {isSpeedDetailsExpanded && pageSpeed && (
              <div className="pt-2 space-y-3 border-t border-stone-200/80">
                {/* Commercial Opportunity Pitch */}
                <div className="p-3 bg-white rounded-xl border border-stone-200 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-stone-900">
                    <Sparkles className="w-4 h-4 text-[#FF4D00]" />
                    <span>Oportunidade Comercial para Prospecção</span>
                  </div>
                  <strong className="text-xs text-stone-800 block">
                    {pageSpeed.opportunityTitle}
                  </strong>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    {pageSpeed.opportunityDescription}
                  </p>
                </div>

                {/* Diagnostics list */}
                {pageSpeed.diagnostics && pageSpeed.diagnostics.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">
                      Diagnósticos Técnicos Recomendados
                    </span>
                    <div className="space-y-1">
                      {pageSpeed.diagnostics.map((diag, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between text-xs bg-white px-3 py-2 rounded-lg border border-stone-200"
                        >
                          <span className="text-stone-700">{diag.title}</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              diag.impact === 'Crítico'
                                ? 'bg-rose-100 text-rose-800'
                                : diag.impact === 'Alto'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-stone-100 text-stone-700'
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
        <div className="border-t border-stone-100 pt-5">
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
      </div>
    </div>
  );
}