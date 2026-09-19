import { useState, memo } from 'react';
import { Star, ChevronDown, Check, Copy } from 'lucide-react';
import { Business } from '../types';
import { getGoogleBusinessLink, getWhatsAppLink, getTrustIcon } from '../services/api';
import { translateCategory } from '../utils/categoryTranslator';
import { usePageSpeed } from '../hooks/usePageSpeed';

interface BusinessCardProps {
  business: Business;
  index?: number;
  isSelected: boolean;
  onSelect: () => void;
  onOpenDetails: (business: Business) => void;
  onToggleFavorite?: (business: Business) => void;
}

function BusinessCard({
  business,
  isSelected,
  onSelect,
  onOpenDetails,
  onToggleFavorite,
}: BusinessCardProps) {
  const [isSpeedExpanded, setIsSpeedExpanded] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const hasWebsite = Boolean(business.website);
  const confidencePercent = Math.round((business.confidence || 0.8) * 100);
  const whatsappUrl = getWhatsAppLink(business.phone);
  const isFavorited = Boolean(business.isFavorite);
  const googleBusinessUrl = getGoogleBusinessLink(business);

  const handleCopyPhone = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!business.phone) return;
    await navigator.clipboard.writeText(business.phone);
    setCopiedPhone(true);
    window.setTimeout(() => setCopiedPhone(false), 1600);
  };

  const { data: pageSpeed, isLoading: isSpeedLoading } = usePageSpeed(
    hasWebsite ? business.website : null
  );

  return (
    <div
      id={`card-${business.id}`}
      onClick={onSelect}
      className={`group relative bg-white rounded-2xl p-4 sm:p-5 border transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md ${
        isSelected
          ? 'border-[#FF4D00] ring-2 ring-[#FF4D00]/15'
          : 'border-[#EDE8E0] hover:border-stone-300'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: Name, Star & Category */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-base text-stone-900 leading-snug group-hover:text-[#FF4D00] transition truncate">
              {business.name}
            </h3>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite?.(business);
              }}
              className="p-1 hover:bg-stone-100 rounded-lg transition cursor-pointer text-stone-400 hover:text-amber-500 shrink-0"
              title={isFavorited ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            >
              <Star
                className={`w-4 h-4 ${
                  isFavorited
                    ? 'fill-amber-500 text-amber-500'
                    : 'text-stone-300 hover:text-stone-400'
                }`}
              />
            </button>
          </div>
          <p className="text-xs text-stone-500 font-medium mt-0.5 truncate">
            {translateCategory(business.category)}
          </p>
        </div>

        {/* Website Status & Opening Hours Badges */}
        <div className="shrink-0 flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5">
            {hasWebsite ? (
              <span className="inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Site encontrado
              </span>
            ) : (
              <span className="inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                Site não identificado
              </span>
            )}

            {/* Real PageSpeed Score displayed upfront */}
            {hasWebsite && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSpeedExpanded(!isSpeedExpanded);
                }}
                className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border transition cursor-pointer shadow-2xs ${
                  isSpeedLoading
                    ? 'bg-stone-50 text-stone-600 border-stone-200 animate-pulse'
                    : pageSpeed
                    ? pageSpeed.score >= 90
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : pageSpeed.score >= 50
                      ? 'bg-amber-50 text-amber-800 border-amber-300'
                      : 'bg-rose-50 text-rose-800 border-rose-300'
                    : 'bg-stone-50 text-stone-600 border-stone-200'
                }`}
                title="Pontuação Google PageSpeed (clique para detalhes)"
              >
                <img src="/velocimetro.png" alt="Google PageSpeed" className="w-3.5 h-3.5 object-contain" />
                <span>
                  {isSpeedLoading ? (
                    '...'
                  ) : pageSpeed ? (
                    <span className="tracking-tight">{pageSpeed.score}/100</span>
                  ) : (
                    'Score'
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Status Aberto / Fechado / Não identificado */}
          {business.openStatus === 'ABERTO_AGORA' ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200" title={business.openStatusText}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
              {business.openStatusText || 'Aberto agora'}
            </span>
          ) : business.openStatus === 'FECHADO_AGORA' ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200" title={business.openStatusText}>
              <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
              {business.openStatusText || 'Fechado agora'}
            </span>
          ) : (
            <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-500 border border-stone-200">
              Horário não identificado
            </span>
          )}
        </div>
      </div>

      {/* Address */}
      <div className="mt-2.5 text-xs text-stone-600 truncate">
        {business.address}
      </div>

      {/* Contact Info Pills */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        {/* Phone */}
        <div className="flex max-w-[220px] items-center gap-1 rounded-lg border border-[#EDE8E0] bg-[#FAF7F2] px-2.5 py-1 text-stone-600">
          {business.phone ? (
            <>
              <span className="truncate font-medium text-stone-800">{business.phone}</span>
              <button
                type="button"
                onClick={handleCopyPhone}
                className="shrink-0 rounded-md p-1 text-stone-400 transition hover:bg-white hover:text-[#FF4D00]"
                title={copiedPhone ? 'Número copiado' : 'Copiar número'}
              >
                {copiedPhone ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </>
          ) : (
            <span className="truncate text-stone-400 italic">Telefone não identificado</span>
          )}
        </div>

        {/* Email */}
        <div className="px-2.5 py-1 bg-[#FAF7F2] rounded-lg border border-[#EDE8E0] text-stone-600 truncate max-w-[200px]">
          {business.email ? (
            <span className="font-medium text-stone-800">{business.email}</span>
          ) : (
            <span className="text-stone-400 italic">E-mail não identificado</span>
          )}
        </div>

        {/* Confidence Badge with Trust Icon */}
        <div className="ml-auto text-[11px] font-semibold text-stone-600 shrink-0 flex items-center gap-1.5 bg-[#FAF7F2] px-2 py-0.5 rounded-lg border border-[#EDE8E0]">
          <span>{confidencePercent}% conf.</span>
          <img
            src={getTrustIcon(business.confidence || 0.8)}
            alt="Indicador de Confiança"
            className="w-4 h-4 object-contain"
            title={`Nível de Confiança dos Dados: ${confidencePercent}%`}
          />
        </div>
      </div>

      {/* Collapsible PageSpeed Section */}
      {hasWebsite && (
        <div className="mt-3 pt-2.5 border-t border-stone-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsSpeedExpanded(!isSpeedExpanded);
            }}
            className="flex items-center justify-between w-full text-left py-1 group/toggle cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <img src="/velocimetro.png" alt="PageSpeed" className="w-4 h-4 object-contain" />
              <span className="text-xs font-semibold text-stone-700">
                Google PageSpeed:{' '}
                <strong
                  className={`font-black ${
                    pageSpeed
                      ? pageSpeed.score >= 90
                        ? 'text-emerald-600'
                        : pageSpeed.score >= 50
                        ? 'text-amber-600'
                        : 'text-rose-600'
                      : 'text-stone-500'
                  }`}
                >
                  {isSpeedLoading ? 'Medindo score...' : pageSpeed ? `${pageSpeed.score}/100` : 'Disponível'}
                </strong>
              </span>
            </div>
            <span className="text-[11px] font-bold text-[#FF4D00] group-hover/toggle:underline flex items-center gap-1">
              {isSpeedExpanded ? 'Recolher' : 'Ver mais informações'}
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  isSpeedExpanded ? 'rotate-180' : ''
                }`}
              />
            </span>
          </button>

          {isSpeedExpanded && (
            <div className="mt-2.5 p-3 rounded-xl bg-[#FAF7F2] border border-[#EDE8E0] space-y-2.5">
              {isSpeedLoading ? (
                <div className="flex items-center gap-2 text-xs text-stone-500 py-1">
                  <div className="w-3.5 h-3.5 border-2 border-[#FF4D00] border-t-transparent rounded-full animate-spin" />
                  <span>Obtendo diagnóstico do Google PageSpeed...</span>
                </div>
              ) : pageSpeed ? (
                <>
                  {/* Web Vitals Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="p-1.5 rounded-lg bg-white border border-stone-200">
                      <div className="text-[10px] text-stone-400 font-semibold uppercase">FCP (1ª Pintura)</div>
                      <div className="text-xs font-bold text-stone-800">{pageSpeed.fcp || '-'}</div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-white border border-stone-200">
                      <div className="text-[10px] text-stone-400 font-semibold uppercase">LCP (Conteúdo)</div>
                      <div className="text-xs font-bold text-stone-800">{pageSpeed.lcp || '-'}</div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-white border border-stone-200">
                      <div className="text-[10px] text-stone-400 font-semibold uppercase">TBT (Bloqueio)</div>
                      <div className="text-xs font-bold text-stone-800">{pageSpeed.tbt || '-'}</div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-white border border-stone-200">
                      <div className="text-[10px] text-stone-400 font-semibold uppercase">CLS (Estabilidade)</div>
                      <div className="text-xs font-bold text-stone-800">{pageSpeed.cls || '-'}</div>
                    </div>
                  </div>

                  {/* Commercial Argument */}
                  <div className="text-[11px] text-stone-600 bg-white p-2.5 rounded-lg border border-stone-200 leading-relaxed">
                    <strong className="text-stone-900 block mb-0.5 font-bold">
                      💡 {pageSpeed.opportunityTitle}
                    </strong>
                    <span>{pageSpeed.opportunityDescription}</span>
                  </div>
                </>
              ) : (
                <div className="text-xs text-stone-500 py-1">
                  Não foi possível obter dados para este site.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons & Details */}
      <div className="mt-3.5 pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={googleBusinessUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center px-3.5 py-1.5 rounded-xl text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 hover:text-stone-900 transition active:scale-95 shadow-2xs"
            title="Abrir este negócio no Google Maps"
          >
            <span>Ver no Google</span>
          </a>

          {/* Button: Ver site (Sem seta) */}
          {hasWebsite && (
            <a
              href={business.website!}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center px-3.5 py-1.5 rounded-xl text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 hover:text-stone-900 transition active:scale-95 shadow-2xs"
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
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition active:scale-95 shadow-2xs"
            >
              <img src="/whatsapp_icone.png" alt="WhatsApp" className="w-3.5 h-3.5 object-contain" />
              <span>WhatsApp</span>
            </a>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetails(business);
          }}
          className="text-xs font-bold text-[#FF4D00] hover:text-[#E04400] transition flex items-center gap-1 ml-auto"
        >
          Ver detalhes &rarr;
        </button>
      </div>
    </div>
  );
}

export default memo(BusinessCard);
