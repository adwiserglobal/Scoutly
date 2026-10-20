import { useEffect, useRef, useState } from 'react';
import { Check, Link2, Loader2, X } from 'lucide-react';
import { checkDemoSlug, renameDemoSite, type DemoSiteSummary, type DemoSlugCheck } from '../../services/api';
import { inputClass } from './editorUi';

interface Props {
  businessId: string;
  site: DemoSiteSummary | null;
  onRenamed: (site: DemoSiteSummary) => void;
  notify: (message: string, tone?: 'ok' | 'error') => void;
}

/** "Endereço do site": edit the slug with live availability check. Applies immediately (not via draft). */
export default function SiteAddressField({ businessId, site, onRenamed, notify }: Props) {
  const current = site?.slug || '';
  const [value, setValue] = useState(current);
  const [check, setCheck] = useState<DemoSlugCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const timer = useRef<number | null>(null);
  const requestId = useRef(0);

  useEffect(() => { setValue(current); setCheck(null); }, [current]);

  const onChange = (raw: string) => {
    const next = raw.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-{2,}/g, '-').slice(0, 40);
    setValue(next);
    setCheck(null);
    if (timer.current) window.clearTimeout(timer.current);
    if (!next || next === current) { setChecking(false); return; }
    setChecking(true);
    const id = ++requestId.current;
    timer.current = window.setTimeout(async () => {
      try {
        const result = await checkDemoSlug(businessId, next);
        if (id === requestId.current) setCheck(result);
      } catch {
        if (id === requestId.current) setCheck({ slug: next, available: false, reason: 'Não foi possível verificar agora.' });
      } finally {
        if (id === requestId.current) setChecking(false);
      }
    }, 450);
  };

  const dirty = value !== current && value.length > 0;
  const canSave = dirty && check?.available && !checking && !saving;

  const save = async () => {
    if (!canSave) return;
    if (site && (site.views > 0 || site.publishedAt) && !window.confirm('O link antigo deixará de funcionar. Quem já recebeu o link precisará do novo. Continuar?')) return;
    setSaving(true);
    try {
      const result = await renameDemoSite(businessId, value);
      onRenamed(result.site);
      notify('Endereço atualizado. Copie o novo link para enviar.');
    } catch (error: any) {
      notify(error?.message || 'Não foi possível alterar o endereço.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const host = typeof window !== 'undefined' ? window.location.host : 'scoutly.pro';

  return (
    <div className="space-y-2">
      <label htmlFor="site-address" className="flex items-center gap-1.5 text-[11px] font-semibold text-[#c3c8d0]"><Link2 className="h-3.5 w-3.5" /> Endereço do site</label>
      <div className="flex items-stretch overflow-hidden rounded-lg border border-white/[0.1] bg-[#0b0d11] focus-within:border-[#ff7a45]/70 focus-within:ring-2 focus-within:ring-[#ff5a12]/20">
        <span className="flex items-center whitespace-nowrap bg-white/[0.04] px-2.5 text-[11px] text-[#8b929e]">{host}/demo/</span>
        <input
          id="site-address"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={40}
          spellCheck={false}
          autoCapitalize="off"
          className="min-w-0 flex-1 bg-transparent px-2.5 py-2 text-[13px] text-white outline-none"
          aria-describedby="site-address-status"
        />
      </div>
      <div id="site-address-status" className="min-h-[18px] text-[11px]" aria-live="polite">
        {checking && <span className="flex items-center gap-1.5 text-[#9aa1ac]"><Loader2 className="h-3 w-3 animate-spin" />Verificando…</span>}
        {!checking && check?.available && dirty && <span className="flex items-center gap-1.5 text-emerald-300"><Check className="h-3.5 w-3.5" />Disponível</span>}
        {!checking && check && !check.available && (
          <span className="flex flex-wrap items-center gap-1.5 text-rose-300"><X className="h-3.5 w-3.5" />{check.reason}
            {check.suggestion && <button type="button" onClick={() => onChange(check.suggestion || '')} className="font-semibold text-[#ff9869] underline underline-offset-2">Usar {check.suggestion}</button>}
          </span>
        )}
      </div>
      <button type="button" onClick={() => void save()} disabled={!canSave} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white/[0.08] px-3 text-[12px] font-semibold text-white hover:bg-white/[0.14] disabled:cursor-not-allowed disabled:opacity-40">
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Salvar endereço
      </button>
      <p className="text-[10.5px] leading-relaxed text-[#8b929e]">Use letras minúsculas, números e hífen (3 a 40 caracteres). Mudar o endereço faz o link antigo parar de funcionar.</p>
    </div>
  );
}
