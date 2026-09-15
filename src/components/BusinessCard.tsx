import { memo } from 'react';
import { Star } from 'lucide-react';
import { Business } from '../types';
import { getWhatsAppLink, getTrustIcon } from '../services/api';
import { translateCategory } from '../utils/categoryTranslator';

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
  const hasWebsite = Boolean(business.website);
  const confidencePercent = Math.round((business.confidence || 0.8) * 100);
  const whatsappUrl = getWhatsAppLink(business.phone);
  const isFavorited = Boolean(business.leadStatus && business.leadStatus !== 'NOVO');

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
          {hasWebsite ? (
            <span className="inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Site encontrado
            </span>
          ) : (
            <span className="inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              Site não identificado
            </span>
          )}

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
        <div className="px-2.5 py-1 bg-[#FAF7F2] rounded-lg border border-[#EDE8E0] text-stone-600 truncate max-w-[200px]">
          {business.phone ? (
            <span className="font-medium text-stone-800">{business.phone}</span>
          ) : (
            <span className="text-stone-400 italic">Telefone não identificado</span>
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

        {/* Confidence Badge with Speedometer Icon */}
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

      {/* Action Buttons & Details */}
      <div className="mt-3.5 pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
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
