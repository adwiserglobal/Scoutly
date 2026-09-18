import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Gauge,
  Globe2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  RefreshCw,
  Star,
  X,
} from 'lucide-react';
import { Business } from '../types';
import { enrichBusinessData, fetchTrackingAudit, getWhatsAppLink } from '../services/api';
import { translateCategory } from '../utils/categoryTranslator';
import { usePageSpeed } from '../hooks/usePageSpeed';

interface BusinessSidePanelProps {
  business: Business;
  onClose: () => void;
  onToggleFavorite?: (business: Business) => void;
}

function StatusIcon({ ok, loading = false }: { ok: boolean; loading?: boolean }) {
  if (loading) {
    return <RefreshCw className="h-4 w-4 shrink-0 animate-spin text-stone-400" />;
  }

  return ok ? (
    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
  ) : (
    <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
  );
}

function SignalRow({
  icon,
  label,
  value,
  detected,
  loading,
  title,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detected: boolean;
  loading?: boolean;
  title?: string;
}) {
  return (
    <div
      className="flex items-start justify-between gap-3 rounded-xl border border-stone-200 bg-white px-3 py-2.5"
      title={title}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="mt-0.5 text-stone-400">{icon}</span>
        <div className="min-w-0">
          <span className="block text-[10px] font-medium text-stone-400">{label}</span>
          <span className="mt-0.5 block truncate text-[11px] font-semibold text-stone-800">
            {loading ? 'Verificando' : value}
          </span>
        </div>
      </div>
      <StatusIcon ok={detected} loading={loading} />
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

  const hasWebsite = Boolean(business.website);
  const { data: pageSpeed, isLoading: isPageSpeedLoading } = usePageSpeed(
    hasWebsite ? business.website : null
  );

  useEffect(() => {
    let cancelled = false;

    setEnrichment(null);
    setTrackingAudit(null);

    if (!business.website) {
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
  }, [business.id, business.website]);

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

  const whatsappUrl = verifiedWhatsapp ? getWhatsAppLink(verifiedWhatsapp) : null;
  const trackingDetected = Boolean(trackingAudit?.hasTracking);
  const pageSpeedDetected = Boolean(pageSpeed && typeof pageSpeed.score === 'number');
  const isFavorite = Boolean(business.isFavorite);

  const opportunities = useMemo(() => {
    const list: string[] = [];

    if (!hasWebsite) list.push('Site não identificado');
    if (hasWebsite && !verifiedWhatsapp && !isEnrichmentLoading) list.push('WhatsApp não confirmado');
    if (hasWebsite && !trackingDetected && !isTrackingLoading) list.push('Tracking não confirmado');
    if (pageSpeedDetected && pageSpeed && pageSpeed.score < 50) list.push('Performance mobile crítica');

    return list.slice(0, 3);
  }, [
    hasWebsite,
    verifiedWhatsapp,
    trackingDetected,
    pageSpeedDetected,
    pageSpeed,
    isEnrichmentLoading,
    isTrackingLoading,
  ]);

  return (
    <aside className="fixed bottom-[82px] left-3 right-3 z-40 max-h-[72vh] overflow-hidden rounded-3xl border border-stone-200 bg-white/95 shadow-2xl backdrop-blur-xl pointer-events-auto sm:bottom-24 sm:left-auto sm:right-4 sm:top-24 sm:max-h-none sm:w-[390px]">
      <div className="flex h-full max-h-[72vh] flex-col sm:max-h-full">
        <div className="shrink-0 border-b border-stone-100 px-4 pb-4 pt-4 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-[17px] font-semibold tracking-tight text-stone-950">
                  {business.name}
                </h2>
                <button
                  type="button"
                  onClick={() => onToggleFavorite?.(business)}
                  className="shrink-0 rounded-lg p-1 text-stone-300 transition hover:bg-stone-100 hover:text-stone-600"
                  title={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                >
                  <Star className={`h-4 w-4 ${isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
                </button>
              </div>
              <p className="mt-0.5 text-[11px] font-medium text-stone-500">
                {translateCategory(business.category)}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-xl p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
              title="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {business.address && (
            <div className="mt-3 flex items-start gap-2 text-[10px] leading-relaxed text-stone-500">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-400" />
              <span>{business.address}</span>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {hasWebsite && (
              <a
                href={business.website!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-[10px] font-semibold text-stone-700 transition hover:bg-stone-50"
              >
                <Globe2 className="h-3.5 w-3.5 text-stone-400" />
                Ver site
                <ExternalLink className="h-3 w-3 text-stone-400" />
              </a>
            )}

            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Este número de WhatsApp foi verificado com base nas informações disponibilizadas pela empresa no site"
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-[10px] font-semibold text-white transition hover:bg-emerald-700"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                WhatsApp
                <CheckCircle2 className="h-3.5 w-3.5 text-white/90" />
              </a>
            )}

            {!whatsappUrl && verifiedPhone && (
              <a
                href={`tel:${verifiedPhone}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-[10px] font-semibold text-stone-700 transition hover:bg-stone-50"
              >
                <Phone className="h-3.5 w-3.5 text-stone-400" />
                Ligar
              </a>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <section>
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-stone-400">
                Visão rápida
              </span>
              {(isEnrichmentLoading || isTrackingLoading || isPageSpeedLoading) && (
                <span className="inline-flex items-center gap-1 text-[9px] text-stone-400">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Analisando
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2">
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
                value={pageSpeedDetected && pageSpeed ? `${pageSpeed.score}/100` : 'Não disponível'}
                detected={pageSpeedDetected}
                loading={hasWebsite && isPageSpeedLoading}
              />
            </div>
          </section>

          <section className="mt-5 border-t border-stone-100 pt-4">
            <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-stone-400">
              Contato atual
            </span>

            <div className="mt-2.5 space-y-2">
              <div className="flex items-center justify-between gap-3 py-1">
                <div className="flex min-w-0 items-center gap-2">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                  <span className="truncate text-[11px] font-medium text-stone-700">
                    {verifiedPhone || business.phone || 'Telefone não identificado'}
                  </span>
                </div>
                <StatusIcon ok={Boolean(verifiedPhone)} loading={hasWebsite && isEnrichmentLoading} />
              </div>

              <div className="flex items-center justify-between gap-3 py-1">
                <div className="flex min-w-0 items-center gap-2">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                  <span className="truncate text-[11px] font-medium text-stone-700">
                    {verifiedEmail || business.email || 'Email não identificado'}
                  </span>
                </div>
                <StatusIcon ok={Boolean(verifiedEmail)} loading={hasWebsite && isEnrichmentLoading} />
              </div>
            </div>

            {(business.phone || business.email) && !verifiedPhone && !verifiedEmail && !isEnrichmentLoading && (
              <p className="mt-2 text-[9px] leading-relaxed text-stone-400">
                Os contatos da base continuam visíveis, mas não foram confirmados no site atual.
              </p>
            )}
          </section>

          {opportunities.length > 0 && (
            <section className="mt-5 border-t border-stone-100 pt-4">
              <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-stone-400">
                Oportunidades
              </span>
              <div className="mt-2.5 space-y-2">
                {opportunities.map((item) => (
                  <div key={item} className="flex items-center gap-2 text-[10px] text-stone-600">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </aside>
  );
}
