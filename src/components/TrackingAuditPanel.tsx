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
  return ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <CircleAlert className="w-4 h-4 shrink-0" />;
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

  const opportunities = [
    !audit.ga4?.detected && {
      title: 'GA4 não detectado',
      description: audit.gtm?.detected
        ? 'Pode estar configurado dentro do GTM, mas não apareceu diretamente no HTML.'
        : 'O site pode estar sem mensuração moderna de comportamento e conversões.',
    },
    !audit.gtm?.detected && {
      title: 'Google Tag Manager não detectado',
      description: 'Há oportunidade para organizar tags, eventos e pixels em um único container.',
    },
    !audit.metaPixel?.detected && {
      title: 'Meta Pixel não detectado',
      description: audit.gtm?.detected
        ? 'Pode estar dentro do GTM. A Scoutly não encontrou o pixel diretamente no HTML.'
        : 'O site pode estar perdendo sinais importantes para remarketing e otimização no Meta Ads.',
    },
    !cookieDetected && {
      title: 'Banner de cookies não detectado',
      description: 'Não encontramos uma CMP ou banner de consentimento no HTML público do site.',
    },
    cookieDetected && !cookieStrong && {
      title: 'Consentimento de cookies parece básico',
      description: 'O banner foi detectado, mas não encontramos sinais claros de rejeição ou preferências.',
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
            Sinais técnicos encontrados no site público
          </p>
        </div>
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold ${statusTone(Boolean(audit.hasTracking))}`}>
          <StatusIcon ok={Boolean(audit.hasTracking)} />
          {audit.hasTracking ? 'Tracking detectado' : 'Sem tracking detectado'}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className={`rounded-xl border p-3 ${statusTone(Boolean(audit.ga4?.detected))}`}>
          <div className="flex items-center gap-2 text-xs font-bold">
            <BarChart3 className="w-4 h-4" />
            <span>Google Analytics 4</span>
          </div>
          <div className="text-[10px] mt-1.5 font-medium">
            {audit.ga4?.detected ? 'Detectado' : audit.gtm?.detected ? 'Não detectado diretamente' : 'Não detectado'}
          </div>
          {joinIds(audit.ga4?.measurementIds) && (
            <div className="text-[9px] mt-1 font-mono opacity-80 truncate">{joinIds(audit.ga4.measurementIds)}</div>
          )}
        </div>

        <div className={`rounded-xl border p-3 ${statusTone(Boolean(audit.gtm?.detected))}`}>
          <div className="flex items-center gap-2 text-xs font-bold">
            <Tag className="w-4 h-4" />
            <span>Google Tag Manager</span>
          </div>
          <div className="text-[10px] mt-1.5 font-medium">
            {audit.gtm?.detected ? 'Detectado' : 'Não detectado'}
          </div>
          {joinIds(audit.gtm?.containerIds) && (
            <div className="text-[9px] mt-1 font-mono opacity-80 truncate">{joinIds(audit.gtm.containerIds)}</div>
          )}
        </div>

        <div className={`rounded-xl border p-3 ${statusTone(Boolean(audit.metaPixel?.detected))}`}>
          <div className="flex items-center gap-2 text-xs font-bold">
            <Crosshair className="w-4 h-4" />
            <span>Meta Pixel</span>
          </div>
          <div className="text-[10px] mt-1.5 font-medium">
            {audit.metaPixel?.detected ? 'Detectado' : audit.gtm?.detected ? 'Não detectado diretamente' : 'Não detectado'}
          </div>
          {joinIds(audit.metaPixel?.pixelIds) && (
            <div className="text-[9px] mt-1 font-mono opacity-80 truncate">{joinIds(audit.metaPixel.pixelIds)}</div>
          )}
        </div>

        <div className={`rounded-xl border p-3 ${statusTone(cookieStrong)}`}>
          <div className="flex items-center gap-2 text-xs font-bold">
            <Cookie className="w-4 h-4" />
            <span>Consentimento de cookies</span>
          </div>
          <div className="text-[10px] mt-1.5 font-medium">
            {!cookieDetected
              ? 'Banner não detectado'
              : cookieStrong
                ? 'Bons sinais de consentimento'
                : 'Banner básico detectado'}
          </div>
          {cookie.provider && (
            <div className="text-[9px] mt-1 font-medium opacity-80 truncate">CMP: {cookie.provider}</div>
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
              <span className="px-2 py-1 rounded-lg bg-stone-100 border border-stone-200 text-[10px] font-semibold text-stone-700">Google Ads</span>
            )}
            {(audit.otherTrackers || []).map((tracker: string) => (
              <span key={tracker} className="px-2 py-1 rounded-lg bg-stone-100 border border-stone-200 text-[10px] font-semibold text-stone-700">{tracker}</span>
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
              <div key={item.title} className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2.5">
                <div className="text-[11px] font-bold text-stone-900">{item.title}</div>
                <div className="text-[10px] text-stone-600 mt-0.5 leading-relaxed">{item.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[9px] text-stone-400 leading-relaxed">
        A Scoutly analisa o HTML público e sinais de CMP. Isso não comprova conformidade jurídica com a LGPD e tags carregadas apenas após execução avançada de JavaScript podem não aparecer nesta checagem.
      </p>
    </div>
  );
}
