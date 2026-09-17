import {
  AlertCircle,
  BarChart3,
  Boxes,
  CheckCircle2,
  Cookie,
  Crosshair,
  Shield,
  Tag,
} from 'lucide-react';

interface TrackingAuditPanelProps {
  audit: any;
}

function joinIds(ids?: string[]) {
  if (!Array.isArray(ids) || ids.length === 0) return '';
  return ids.slice(0, 2).join(', ');
}

function StatusItem({
  icon,
  title,
  detected,
  subtitle,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detected: boolean;
  subtitle: string;
  detail?: string;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-stone-500">{icon}</div>

        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-semibold text-stone-900">{title}</div>

          <div className="mt-1.5 flex items-center gap-1.5">
            {detected ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-stone-400" />
            )}

            <span className="text-[10px] font-medium text-stone-500">{subtitle}</span>
          </div>

          {detail && (
            <div className="mt-1.5 truncate font-mono text-[9px] text-stone-400">{detail}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function OpportunityItem({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-2.5 border-b border-stone-100 py-3 last:border-b-0">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
      <div>
        <div className="text-[11px] font-semibold text-stone-900">{title}</div>
        <div className="mt-0.5 text-[10px] leading-relaxed text-stone-500">{description}</div>
      </div>
    </div>
  );
}

export default function TrackingAuditPanel({ audit }: TrackingAuditPanelProps) {
  if (!audit) return null;

  const cookie = audit.cookieConsent || {};
  const cookieDetected = Boolean(cookie.detected);
  const deepScan = audit.scanMode === 'static_plus_assets';
  const assetsScanned = Number(audit.assetsScanned || 0);

  const opportunities = [
    !audit.ga4?.detected && {
      title: 'GA4 não confirmado',
      description: audit.gtm?.detected
        ? 'Pode estar configurado dentro do GTM ou carregado dinamicamente.'
        : 'Nenhum sinal público de GA4 foi encontrado nesta análise.',
    },
    !audit.gtm?.detected && {
      title: 'Google Tag Manager não confirmado',
      description: 'Nenhum sinal público de GTM foi encontrado nesta análise.',
    },
    !audit.metaPixel?.detected && {
      title: 'Meta Pixel não confirmado',
      description: audit.gtm?.detected
        ? 'Pode estar configurado dentro do GTM.'
        : 'Nenhum sinal público de Meta Pixel foi encontrado nesta análise.',
    },
    !cookieDetected && {
      title: 'Consentimento de cookies não confirmado',
      description:
        'Não encontramos sinais suficientes no HTML ou nos scripts públicos. O banner pode depender da execução de JavaScript.',
    },
  ].filter(Boolean) as Array<{ title: string; description: string }>;

  return (
    <div className="rounded-3xl border border-stone-200 bg-[#FCFBF9] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">
            Tracking e privacidade
          </span>

          <p className="mt-1 text-[11px] text-stone-500">
            {deepScan
              ? `HTML e ${assetsScanned} script(s) públicos analisados`
              : 'HTML público analisado'}
          </p>
        </div>

        <div className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-2.5 py-1">
          {audit.hasTracking ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 text-stone-400" />
          )}

          <span className="text-[10px] font-medium text-stone-600">
            {audit.hasTracking ? 'Tracking detectado' : 'Tracking não confirmado'}
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <StatusItem
          icon={<BarChart3 className="h-4 w-4" />}
          title="Google Analytics 4"
          detected={Boolean(audit.ga4?.detected)}
          subtitle={
            audit.ga4?.detected
              ? 'Detectado'
              : audit.gtm?.detected
                ? 'Não confirmado fora do GTM'
                : 'Não confirmado'
          }
          detail={joinIds(audit.ga4?.measurementIds)}
        />

        <StatusItem
          icon={<Tag className="h-4 w-4" />}
          title="Google Tag Manager"
          detected={Boolean(audit.gtm?.detected)}
          subtitle={audit.gtm?.detected ? 'Detectado' : 'Não confirmado'}
          detail={joinIds(audit.gtm?.containerIds)}
        />

        <StatusItem
          icon={<Crosshair className="h-4 w-4" />}
          title="Meta Pixel"
          detected={Boolean(audit.metaPixel?.detected)}
          subtitle={
            audit.metaPixel?.detected
              ? 'Detectado'
              : audit.gtm?.detected
                ? 'Não confirmado fora do GTM'
                : 'Não confirmado'
          }
          detail={joinIds(audit.metaPixel?.pixelIds)}
        />

        <StatusItem
          icon={<Cookie className="h-4 w-4" />}
          title="Consentimento de cookies"
          detected={cookieDetected}
          subtitle={cookieDetected ? 'Detectado' : 'Não confirmado'}
          detail={
            cookie.provider
              ? `CMP ${cookie.provider}`
              : Array.isArray(cookie.evidence) && cookie.evidence.length > 0
                ? cookie.evidence.slice(0, 2).join(' · ')
                : undefined
          }
        />
      </div>

      {(audit.googleAds?.detected || (audit.otherTrackers || []).length > 0) && (
        <div className="mt-4 rounded-2xl border border-stone-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">
            <Boxes className="h-3.5 w-3.5" />
            Outros sinais
          </div>

          <div className="mt-2.5 flex flex-wrap gap-2">
            {audit.googleAds?.detected && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 px-2.5 py-1 text-[10px] font-medium text-stone-600">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                Google Ads
              </span>
            )}

            {(audit.otherTrackers || []).map((tracker: string) => (
              <span
                key={tracker}
                className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 px-2.5 py-1 text-[10px] font-medium text-stone-600"
              >
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                {tracker}
              </span>
            ))}
          </div>
        </div>
      )}

      {opportunities.length > 0 && (
        <div className="mt-4 rounded-2xl border border-stone-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">
            <Shield className="h-3.5 w-3.5" />
            Oportunidades
          </div>

          <div className="mt-1">
            {opportunities.map((item) => (
              <OpportunityItem
                key={item.title}
                title={item.title}
                description={item.description}
              />
            ))}
          </div>
        </div>
      )}

      <p className="mt-4 text-[9px] leading-relaxed text-stone-400">
        Detecções positivas indicam sinais técnicos encontrados. Não confirmado não significa
        ausência definitiva, porque algumas tecnologias só aparecem após JavaScript,
        consentimento, região ou interação do usuário.
      </p>
    </div>
  );
}
