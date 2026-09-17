import { CheckCircle2, CircleAlert, ShieldCheck, Tag, BarChart3, Cookie, Crosshair, Boxes } from 'lucide-react';

interface TrackingAuditPanelProps {
  audit: any;
}

function statusTone(ok: boolean) {
  return ok
    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
    : 'bg-amber-50 border-amber-200 text-amber-800';
}

function StatusIcon({ ok }: { ok: boolean }) {
  return ok ? (
    <CheckCircle2 className="w-4 h-4 shrink-0" />
  ) : (
    <CircleAlert className="w-4 h-4 shrink-0" />
  );
}

function joinIds(ids?: string[]) {
  if (!Array.isArray(ids) || ids.length === 0) return '';
  return ids.slice(0, 3).join(', ');
}

export default function TrackingAuditPanel({ audit }: TrackingAuditPanelProps) {
  if (!audit) return null;

  const cookie = audit.cookieConsent || {};
  const cookieStrong = cookie.level === 'strong_signals';
  const cookieDetected = Boolean(cookie.detected);
  const deepScan = audit.scanMode === 'static_plus_assets';
  const assetsScanned = Number(audit.assetsScanned || 0);

  const opportunities = [
    !audit.ga4?.detected && {
      title: 'GA4 não confirmado',
      description: audit.gtm?.detected
        ? 'Pode estar configurado dentro do GTM ou ser carregado dinamicamente.'
        : 'A Scoutly não encontrou sinais públicos de GA4 nesta varredura.',
    },
    !audit.gtm?.detected && {
      title: 'Google Tag Manager não confirmado',
      description: 'Nenhum sinal público de GTM foi encontrado nesta varredura.',
    },
    !audit.metaPixel?.detected && {
      title: 'Meta Pixel não confirmado',
      description: audit.gtm?.detected
        ? 'Pode estar configurado dentro do GTM.'
        : 'Nenhum sinal público de Meta Pixel foi encontrado nesta varredura.',
    },
    !cookieDetected && {
      title: 'Banner de cookies não confirmado',
      description:
        'A Scoutly não encontrou sinais suficientes no HTML ou nos scripts públicos. O banner ainda pode ser criado somente após execução do JavaScript.',
    },
    cookieDetected && !cookieStrong && {
      title: 'Consentimento de cookies merece revisão',
      description:
        'O banner foi encontrado, mas não identificamos com clareza rejeição ou gerenciamento de preferências.',
    },
  ].filter(Boolean) as Array<{ title: string; description: string }>;

  return (
    <div className="p-4 bg-[#FAF7F2] rounded-2xl border border-[#EDE8E0] space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider">
            Tracking & Privacidade
          </span>
          <p className="text-[11px] text-stone-500 mt-1">
            {deepScan
              ? `HTML + ${assetsScanned} script(s) público(s) analisado(s)`
              : 'HTML público analisado'}
          </p>
        </div>

        <div
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold ${statusTone(
            Boolean(audit.hasTracking),
          )}`}
        >
          <StatusIcon ok={Boolean(audit.hasTracking)} />
          {audit.hasTracking ? 'Tracking detectado' : 'Tracking não confirmado'}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className={`rounded-xl border p-3 ${statusTone(Boolean(audit.ga4?.detected))}`}>
          <div className="flex items-center gap-2 text-xs font-bold">
            <BarChart3 className="w-4 h-4" />
            <span>Google Analytics 4</span>
          </div>
          <div className="text-[10px] mt-1.5 font-medium">
            {audit.ga4?.detected
              ? 'Detectado'
              : audit.gtm?.detected
                ? 'Não confirmado fora do GTM'
                : 'Não confirmado'}
          </div>
          {joinIds(audit.ga4?.measurementIds) && (
            <div className="text-[9px] mt-1 font-mono opacity-80 truncate">
              {joinIds(audit.ga4.measurementIds)}
            </div>
          )}
        </div>

        <div className={`rounded-xl border p-3 ${statusTone(Boolean(audit.gtm?.detected))}`}>
          <div className="flex items-center gap-2 text-xs font-bold">
            <Tag className="w-4 h-4" />
            <span>Google Tag Manager</span>
          </div>
          <div className="text-[10px] mt-1.5 font-medium">
            {audit.gtm?.detected ? 'Detectado' : 'Não confirmado'}
          </div>
          {joinIds(audit.gtm?.containerIds) && (
            <div className="text-[9px] mt-1 font-mono opacity-80 truncate">
              {joinIds(audit.gtm.containerIds)}
            </div>
          )}
        </div>

        <div className={`rounded-xl border p-3 ${statusTone(Boolean(audit.metaPixel?.detected))}`}>
          <div className="flex items-center gap-2 text-xs font-bold">
            <Crosshair className="w-4 h-4" />
            <span>Meta Pixel</span>
          </div>
          <div className="text-[10px] mt-1.5 font-medium">
            {audit.metaPixel?.detected
              ? 'Detectado'
              : audit.gtm?.detected
                ? 'Não confirmado fora do GTM'
                : 'Não confirmado'}
          </div>
          {joinIds(audit.metaPixel?.pixelIds) && (
            <div className="text-[9px] mt-1 font-mono opacity-80 truncate">
              {joinIds(audit.metaPixel.pixelIds)}
            </div>
          )}
        </div>

        <div className={`rounded-xl border p-3 ${statusTone(cookieDetected)}`}>
          <div className="flex items-center gap-2 text-xs font-bold">
            <Cookie className="w-4 h-4" />
            <span>Consentimento de cookies</span>
          </div>
          <div className="text-[10px] mt-1.5 font-medium">
            {!cookieDetected
              ? 'Não confirmado'
              : cookieStrong
                ? 'Bons sinais de consentimento'
                : 'Banner detectado'}
          </div>

          {cookie.provider && (
            <div className="text-[9px] mt-1 font-medium opacity-80 truncate">
              CMP: {cookie.provider}
            </div>
          )}

          {Array.isArray(cookie.evidence) && cookie.evidence.length > 0 && (
            <div className="text-[9px] mt-1 opacity-75 truncate">
              {cookie.evidence.slice(0, 2).join(' • ')}
            </div>
          )}
        </div>
      </div>

      {(audit.googleAds?.detected || (audit.otherTrackers || []).length > 0) && (
        <div className="rounded-xl border border-stone-200 bg-white p-3">
          <div className="flex items-center gap-2 text-[10px] font-bold text-stone-500 uppercase tracking-wider">
            <Boxes className="w-3.5 h-3.5" />
            Outros sinais
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {audit.googleAds?.detected && (
              <span className="px-2 py-1 rounded-lg bg-stone-100 border border-stone-200 text-[10px] font-semibold text-stone-700">
                Google Ads
              </span>
            )}
            {(audit.otherTrackers || []).map((tracker: string) => (
              <span
                key={tracker}
                className="px-2 py-1 rounded-lg bg-stone-100 border border-stone-200 text-[10px] font-semibold text-stone-700"
              >
                {tracker}
              </span>
            ))}
          </div>
        </div>
      )}

      {opportunities.length > 0 && (
        <div className="pt-1">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            Oportunidades
          </div>
          <div className="space-y-1.5">
            {opportunities.map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2.5"
              >
                <div className="text-[11px] font-bold text-stone-900">
                  {item.title}
                </div>
                <div className="text-[10px] text-stone-600 mt-0.5 leading-relaxed">
                  {item.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[9px] text-stone-400 leading-relaxed">
        Detecções positivas indicam sinais técnicos encontrados. “Não confirmado” não significa
        ausência definitiva, porque algumas tecnologias só aparecem após JavaScript, consentimento,
        região ou interação do usuário.
      </p>
    </div>
  );
}
