import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, Eye, Globe, Loader2, RefreshCw, Sparkles, Trash2, ExternalLink } from 'lucide-react';
import type { Business } from '../types';
import {
  createDemoSite, deleteDemoSite, getDemoSite, setDemoSiteStyle,
  type DemoSiteState, type DemoStyleId,
} from '../services/api';

const STYLES: Array<{ id: DemoStyleId; label: string; swatch: string }> = [
  { id: 'clean', label: 'Clean', swatch: 'linear-gradient(135deg,#fff 50%,#0b78d6 50%)' },
  { id: 'warm', label: 'Quente', swatch: 'linear-gradient(135deg,#fbf6ee 50%,#c8501a 50%)' },
  { id: 'bold', label: 'Forte', swatch: 'linear-gradient(135deg,#0d0e11 50%,#ff5a12 50%)' },
  { id: 'elegant', label: 'Elegante', swatch: 'linear-gradient(135deg,#faf8f4 50%,#9b7142 50%)' },
  { id: 'fresh', label: 'Fresco', swatch: 'linear-gradient(135deg,#f5fbf7 50%,#1b9a52 50%)' },
  { id: 'noir', label: 'Noturno', swatch: 'linear-gradient(135deg,#0a0f1f 50%,#6d8dff 50%)' },
];

const STEPS = [
  'Lendo os dados da empresa…',
  'Escolhendo o estilo visual…',
  'Escrevendo os textos do site…',
  'Selecionando as imagens…',
  'Montando a página…',
  'Quase pronto…',
];

interface DemoSiteCardProps {
  business: Business;
  /** Real (unlocked) phone only; masked values are ignored on the server. */
  phone?: string | null;
}

export default function DemoSiteCard({ business, phone }: DemoSiteCardProps) {
  const [state, setState] = useState<DemoSiteState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'create' | 'style' | 'delete' | null>(null);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [copied, setCopied] = useState<'link' | 'message' | null>(null);
  const variationRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setState(null);
    variationRef.current = 0;
    getDemoSite(business.id)
      .then((result) => { if (!cancelled) setState(result); })
      .catch(() => { /* quota/state are optional; the create button still works */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [business.id]);

  useEffect(() => {
    if (busy !== 'create') { setStep(0); return undefined; }
    const timer = window.setInterval(() => setStep((current) => Math.min(STEPS.length - 1, current + 1)), 6500);
    return () => window.clearInterval(timer);
  }, [busy]);

  const payload = useCallback(() => ({
    id: business.id,
    name: business.name,
    category: business.category,
    address: business.address,
    bairro: business.bairro,
    municipio: business.municipio,
    phone: phone || '',
    rating: business.rating,
    reviewCount: business.reviewCount,
    openingHoursRaw: business.openingHoursRaw,
    googleMapsUrl: business.googleMapsUrl,
  }), [business, phone]);

  const create = async (isNewVersion: boolean) => {
    setBusy('create');
    setError(null);
    setErrorDetail(null);
    try {
      variationRef.current = isNewVersion ? variationRef.current + 1 : 0;
      const result = await createDemoSite(payload(), { variation: isNewVersion ? Math.max(1, variationRef.current) : 0 });
      setState(result);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível criar o site agora.');
      setErrorDetail(err?.detail || null);
    } finally {
      setBusy(null);
    }
  };

  const changeStyle = async (style: DemoStyleId) => {
    if (!state?.site || state.site.style === style) return;
    setBusy('style');
    setError(null);
    try { setState(await setDemoSiteStyle(business.id, style)); }
    catch (err: any) { setError(err?.message || 'Não foi possível trocar o estilo.'); }
    finally { setBusy(null); }
  };

  const remove = async () => {
    if (!window.confirm('Excluir o site de demonstração? O link deixará de funcionar.')) return;
    setBusy('delete');
    try {
      await deleteDemoSite(business.id);
      setState((current) => current ? { ...current, site: null, quota: { ...current.quota, used: Math.max(0, current.quota.used - 1) } } : current);
    } catch (err: any) { setError(err?.message || 'Não foi possível excluir.'); }
    finally { setBusy(null); }
  };

  const site = state?.site || null;
  const link = site ? `${window.location.origin}${site.path}` : '';
  const noSite = !business.website;

  const copy = async (kind: 'link' | 'message') => {
    if (!site) return;
    const text = kind === 'link'
      ? link
      : `Olá! Tudo bem? Preparei um rascunho de site para a ${business.name}, só para você ver como pode ficar: ${link}\nSe gostar, posso ajustar com as informações de vocês.`;
    try { await navigator.clipboard.writeText(text); setCopied(kind); window.setTimeout(() => setCopied(null), 1800); } catch { /* clipboard blocked */ }
  };

  const quota = state?.quota;
  const limitReached = !site && quota ? quota.used >= quota.limit : false;

  return (
    <section className={`mt-4 rounded-2xl border p-4 ${noSite ? 'border-[#ff7c42]/30 bg-gradient-to-br from-[#ff5a12]/[0.10] to-transparent' : 'border-white/[0.09] bg-white/[0.03]'}`} aria-label="Site de demonstração">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ff5a12]/15 text-[#ff9869]"><Globe className="h-[18px] w-[18px]" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-white">Site de demonstração</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-[#b5bac3]">
            {site
              ? 'Envie o link na abordagem e mostre o resultado antes de vender.'
              : noSite
                ? 'Essa empresa não tem site. Gere uma proposta pronta, com textos, imagens e layout próprios, para mostrar ao dono.'
                : 'Gere uma proposta de site novo para mostrar ao dono como a empresa poderia estar na internet.'}
          </p>
        </div>
      </div>

      {busy === 'create' && (
        <div className="mt-4 rounded-xl border border-white/[0.08] bg-black/25 p-3.5" role="status" aria-live="polite">
          <div className="flex items-center gap-2.5 text-[12px] font-medium text-white">
            <Loader2 className="h-4 w-4 animate-spin text-[#ff7a45]" /> {STEPS[step]}
          </div>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full animate-pulse rounded-full bg-[#ff5a12]" style={{ width: `${Math.min(92, 16 + step * 16)}%`, transition: 'width 1.2s ease' }} /></div>
          <p className="mt-2 text-[10px] text-[#9aa0aa]">Isso leva em torno de 20 a 40 segundos.</p>
        </div>
      )}

      {!site && busy !== 'create' && (
        <>
          <button
            type="button"
            onClick={() => create(false)}
            disabled={loading || limitReached}
            className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#ff5a12] px-4 text-[12px] font-bold text-white transition hover:bg-[#ff6b2b] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" /> Criar site de demonstração
          </button>
          {quota && <p className="mt-2 text-center text-[10px] text-[#9aa0aa]">{quota.used} de {quota.limit} neste mês · plano {quota.plan}</p>}
          {limitReached && (
            <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('scoutly-open-plans'))} className="mt-2 w-full text-center text-[11px] font-semibold text-[#ff9869] underline underline-offset-2">
              Limite do mês atingido. Ver planos
            </button>
          )}
        </>
      )}

      {site && busy !== 'create' && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2 rounded-xl border border-white/[0.09] bg-black/25 px-3 py-2.5">
            <span className="min-w-0 flex-1 truncate text-[11px] text-[#d9dce2]">{link.replace(/^https?:\/\//, '')}</span>
            <button type="button" onClick={() => copy('link')} className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-white/[0.07] px-2.5 text-[10.5px] font-semibold text-white hover:bg-white/[0.12]">
              {copied === 'link' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}{copied === 'link' ? 'Copiado' : 'Copiar'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <a href={`${site.path}?preview=1`} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#ff5a12] text-[12px] font-bold text-white hover:bg-[#ff6b2b]">
              <ExternalLink className="h-4 w-4" /> Abrir site
            </a>
            <button type="button" onClick={() => copy('message')} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.05] text-[12px] font-semibold text-white hover:bg-white/[0.09]">
              {copied === 'message' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />} {copied === 'message' ? 'Copiada' : 'Copiar mensagem'}
            </button>
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a4aab4]">Estilo visual</p>
            <div className="flex flex-wrap gap-1.5">
              {STYLES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => changeStyle(item.id)}
                  disabled={busy !== null}
                  aria-pressed={site.style === item.id}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium transition disabled:opacity-60 ${site.style === item.id ? 'border-[#ff7a45] bg-[#ff5a12]/15 text-white' : 'border-white/[0.1] text-[#c4c9d1] hover:border-white/25'}`}
                >
                  <span className="h-3.5 w-3.5 rounded-full border border-white/20" style={{ background: item.swatch }} />{item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 text-[11px] text-[#b5bac3]">
            <span className="inline-flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5" />
              {site.views > 0 ? `${site.views} visualizaç${site.views === 1 ? 'ão' : 'ões'}` : 'Ainda não aberto pelo lead'}
            </span>
            <span className="flex items-center gap-1">
              <button type="button" onClick={() => create(true)} disabled={busy !== null} className="inline-flex h-7 items-center gap-1.5 rounded-lg px-2 font-semibold text-[#ff9869] hover:bg-white/[0.06] disabled:opacity-50" title="Gera novos textos e imagens mantendo o mesmo link">
                <RefreshCw className="h-3.5 w-3.5" /> Nova versão
              </button>
              <button type="button" onClick={remove} disabled={busy !== null} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#9aa0aa] hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-50" aria-label="Excluir site">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </span>
          </div>
          {!site.hasPhotos && <p className="text-[10px] leading-relaxed text-[#9aa0aa]">Esta versão usa ilustrações no lugar de fotos.{site.photoNote ? ` Motivo: ${site.photoNote}` : ''}</p>}
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-[11px] leading-relaxed text-rose-300">
          <p>{error}</p>
          {errorDetail && <p className="mt-1.5 break-words text-[10px] text-rose-200/70">Detalhes técnicos: {errorDetail}</p>}
        </div>
      )}
    </section>
  );
}
