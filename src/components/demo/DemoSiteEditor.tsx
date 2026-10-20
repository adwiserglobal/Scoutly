import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, Cloud, CloudOff, ExternalLink, Eye, Globe, Laptop, Loader2, MoreHorizontal, Pencil, Smartphone, Tablet, Undo2 } from 'lucide-react';
import { renderDemoSite } from '../../../shared/demoSite/render';
import type { DemoSiteData } from '../../../shared/demoSite/types';
import {
  discardDemoDraft, getDemoDraft, publishDemoDraft, saveDemoDraft, type DemoSiteSummary,
} from '../../services/api';
import { ContentPanel, DesignPanel, SectionsPanel, type Updater } from './editorPanels';

interface DemoSiteEditorProps {
  businessId: string;
  businessName: string;
  onClose: (site: DemoSiteSummary | null) => void;
}

type SaveState = 'saved' | 'dirty' | 'saving' | 'error';
type Tab = 'content' | 'design' | 'sections';
type Device = 'desktop' | 'tablet' | 'mobile';

const DEVICE_WIDTH: Record<Device, string> = { desktop: '100%', tablet: '820px', mobile: '390px' };

export default function DemoSiteEditor({ businessId, businessName, onClose }: DemoSiteEditorProps) {
  const [data, setData] = useState<DemoSiteData | null>(null);
  const [site, setSite] = useState<DemoSiteSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [unpublished, setUnpublished] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [tab, setTab] = useState<Tab>('content');
  const [device, setDevice] = useState<Device>('desktop');
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit');
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  const [previewData, setPreviewData] = useState<DemoSiteData | null>(null);

  const dataRef = useRef<DemoSiteData | null>(null);
  const dirtyRef = useRef(false);
  const savingRef = useRef<Promise<void> | null>(null);
  const saveTimer = useRef<number | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const scrollRef = useRef(0);

  const flash = useCallback((text: string, tone: 'ok' | 'error' = 'ok') => {
    setToast({ text, tone });
    window.setTimeout(() => setToast((current) => (current?.text === text ? null : current)), 3800);
  }, []);

  // Load the draft (or the published version when there is no draft)
  useEffect(() => {
    let cancelled = false;
    getDemoDraft(businessId)
      .then((result) => {
        if (cancelled) return;
        dataRef.current = result.data;
        setData(result.data);
        setPreviewData(result.data);
        setSite(result.site);
        setUnpublished(result.site.unpublished);
      })
      .catch((error: any) => { if (!cancelled) setLoadError(error?.message || 'Não foi possível abrir o editor.'); });
    return () => { cancelled = true; };
  }, [businessId]);

  const failedRef = useRef(false);
  const persist = useCallback(async () => {
    if (savingRef.current) { await savingRef.current; }
    if (!dirtyRef.current || !dataRef.current) return;
    const snapshot = dataRef.current;
    dirtyRef.current = false;
    failedRef.current = false;
    setSaveState('saving');
    const run = (async () => {
      try {
        const result = await saveDemoDraft(businessId, snapshot);
        setSite(result.site);
        setUnpublished(true);
        setSaveState(dirtyRef.current ? 'dirty' : 'saved');
      } catch (error: any) {
        dirtyRef.current = true;
        failedRef.current = true;
        setSaveState('error');
        flash(error?.message || 'Não foi possível salvar. Tentaremos de novo.', 'error');
      }
    })();
    savingRef.current = run;
    await run;
    savingRef.current = null;
    // Edits made while saving (or a failed save) get another attempt shortly.
    if (dirtyRef.current) scheduleSaveRef.current(failedRef.current ? 6000 : 1500);
  }, [businessId, flash]);

  const scheduleSaveRef = useRef<(delay?: number) => void>(() => undefined);
  const scheduleSave = useCallback((delay = 1300) => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => { void persist(); }, delay);
  }, [persist]);

  scheduleSaveRef.current = scheduleSave;

  const update: Updater = useCallback((mutate) => {
    const current = dataRef.current;
    if (!current) return;
    const next = structuredClone(current);
    mutate(next);
    dataRef.current = next;
    dirtyRef.current = true;
    setData(next);
    setSaveState('dirty');
    scheduleSave();
  }, [scheduleSave]);

  // Debounced preview so typing never feels heavy
  useEffect(() => {
    if (!data) return undefined;
    const timer = window.setTimeout(() => setPreviewData(data), 180);
    return () => window.clearTimeout(timer);
  }, [data]);

  const html = useMemo(
    () => (previewData ? renderDemoSite(previewData, previewData.copy.style, { preview: true, editor: true }) : ''),
    [previewData],
  );

  // iframe <-> editor messages (scroll position, section clicks)
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const message = event.data || {};
      if (message.t === 'scroll') scrollRef.current = Number(message.y) || 0;
      if (message.t === 'select' && typeof message.id === 'string') {
        if (/^x-/.test(message.id)) setTab('content');
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const restoreScroll = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage({ t: 'restore', y: scrollRef.current }, '*');
  }, []);

  const focusSection = useCallback((id: string) => {
    iframeRef.current?.contentWindow?.postMessage({ t: 'goto', id }, '*');
  }, []);

  // Save on tab close / leaving
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  useEffect(() => () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); }, []);

  const flush = useCallback(async () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    await persist();
  }, [persist]);

  const close = async () => {
    await flush();
    onClose(site);
  };

  const publish = async () => {
    setPublishing(true);
    try {
      await flush();
      if (dirtyRef.current) throw new Error('Ainda há alterações sem salvar. Tente novamente.');
      const result = await publishDemoDraft(businessId);
      setSite(result.site);
      setUnpublished(false);
      flash('Site publicado! O link já mostra a versão nova.');
    } catch (error: any) {
      flash(error?.message || 'Não foi possível publicar.', 'error');
    } finally {
      setPublishing(false);
    }
  };

  const openPreview = () => {
    const current = dataRef.current;
    if (!current) return;
    const page = renderDemoSite(current, current.copy.style, { preview: true });
    const url = URL.createObjectURL(new Blob([page], { type: 'text/html' }));
    window.open(url, '_blank', 'noopener');
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const discard = async () => {
    setMenuOpen(false);
    if (!window.confirm('Descartar as alterações não publicadas e voltar à versão publicada?')) return;
    try {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      dirtyRef.current = false;
      const result = await discardDemoDraft(businessId);
      dataRef.current = result.data;
      setData(result.data);
      setPreviewData(result.data);
      setSite(result.site);
      setUnpublished(false);
      setSaveState('saved');
      flash('Alterações descartadas.');
    } catch (error: any) {
      flash(error?.message || 'Não foi possível descartar.', 'error');
    }
  };

  const publicUrl = site ? `${window.location.origin}${site.path}` : '';
  const copyLink = async () => {
    setMenuOpen(false);
    try { await navigator.clipboard.writeText(publicUrl); flash('Link copiado.'); } catch { flash('Não foi possível copiar o link.', 'error'); }
  };

  const status = saveState === 'saving'
    ? { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, text: 'Salvando…', cls: 'text-[#c3c8d0]' }
    : saveState === 'dirty'
      ? { icon: <Pencil className="h-3.5 w-3.5" />, text: 'Editando…', cls: 'text-[#c3c8d0]' }
      : saveState === 'error'
        ? { icon: <CloudOff className="h-3.5 w-3.5" />, text: 'Não salvou', cls: 'text-rose-300' }
        : { icon: <Cloud className="h-3.5 w-3.5" />, text: 'Salvo na nuvem', cls: 'text-emerald-300' };

  const tabs: Array<[Tab, string]> = [['content', 'Conteúdo'], ['design', 'Design'], ['sections', 'Seções']];

  return createPortal(
    <div className="fixed inset-0 z-[300] flex flex-col overflow-hidden bg-[#08090c] font-sans text-white" role="dialog" aria-label={`Editor do site de ${businessName}`}>
      {/* Top bar */}
      <header className="flex h-14 flex-none items-center gap-2 border-b border-white/[0.08] bg-[#0d0f13] px-3 sm:gap-3 sm:px-4">
        <button type="button" onClick={() => void close()} className="flex h-9 items-center gap-2 rounded-lg px-2.5 text-[13px] font-medium text-[#d0d4db] hover:bg-white/[0.07]" aria-label="Fechar editor">
          <ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">Voltar</span>
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold">{data?.business.name || businessName}</p>
          <p className={`flex items-center gap-1.5 text-[11px] ${status.cls}`}>
            {status.icon}{status.text}
            {unpublished && saveState !== 'error' && <span className="ml-1 rounded bg-[#ff5a12]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#ff9869]">Não publicado</span>}
          </p>
        </div>

        <div className="hidden items-center gap-0.5 rounded-lg border border-white/[0.09] p-0.5 md:flex" role="group" aria-label="Tamanho da tela">
          {([['desktop', Laptop, 'Computador'], ['tablet', Tablet, 'Tablet'], ['mobile', Smartphone, 'Celular']] as const).map(([id, Icon, label]) => (
            <button key={id} type="button" aria-label={label} aria-pressed={device === id} onClick={() => setDevice(id)} className={`flex h-8 w-9 items-center justify-center rounded-md ${device === id ? 'bg-white/[0.12] text-white' : 'text-[#9aa1ac] hover:text-white'}`}><Icon className="h-4 w-4" /></button>
          ))}
        </div>

        <button type="button" onClick={openPreview} disabled={!data} className="flex h-9 items-center gap-2 rounded-lg border border-white/[0.12] px-3 text-[13px] font-semibold hover:bg-white/[0.07] disabled:opacity-50">
          <Eye className="h-4 w-4" /><span className="hidden sm:inline">Visualizar</span>
        </button>
        <button type="button" onClick={() => void publish()} disabled={!data || publishing || (!unpublished && saveState === 'saved')} className="flex h-9 items-center gap-2 rounded-lg bg-[#ff5a12] px-3.5 text-[13px] font-bold text-white shadow-lg shadow-[#ff5a12]/20 hover:bg-[#ff6b2b] disabled:cursor-not-allowed disabled:opacity-45 sm:px-4">
          {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}Publicar
        </button>

        <div className="relative">
          <button type="button" onClick={() => setMenuOpen((open) => !open)} aria-label="Mais ações" className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/[0.07]"><MoreHorizontal className="h-5 w-5" /></button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-11 z-20 w-60 overflow-hidden rounded-xl border border-white/[0.1] bg-[#14171c] py-1 shadow-2xl">
                <button type="button" onClick={() => void copyLink()} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] hover:bg-white/[0.06]"><Check className="h-4 w-4 text-[#9aa1ac]" />Copiar link público</button>
                {site && <a href={`${site.path}?preview=1`} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] hover:bg-white/[0.06]"><ExternalLink className="h-4 w-4 text-[#9aa1ac]" />Abrir página publicada</a>}
                <button type="button" onClick={() => void discard()} disabled={!unpublished} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] text-[#ff9c9c] hover:bg-white/[0.06] disabled:opacity-40"><Undo2 className="h-4 w-4" />Descartar alterações</button>
              </div>
            </>
          )}
        </div>
      </header>

      {loadError && (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-sm rounded-2xl border border-rose-400/25 bg-rose-500/10 p-5 text-center text-[13px] text-rose-200">
            <AlertTriangle className="mx-auto mb-2 h-6 w-6" />{loadError}
            <button type="button" onClick={() => onClose(null)} className="mt-4 block w-full rounded-lg bg-white/10 py-2 font-semibold text-white">Voltar</button>
          </div>
        </div>
      )}

      {!data && !loadError && (
        <div className="absolute inset-0 z-[5] flex flex-col items-center justify-center bg-gradient-to-b from-[#FFF8F3] via-[#FAF3EC] to-[#FAF7F2] p-6 text-center">
          <img src="/scoutly-loading.gif" alt="Scoutly" className="h-36 w-36 object-contain drop-shadow-sm sm:h-44 sm:w-44" />
          <div className="mt-3 flex items-center gap-2.5">
            <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[#FF4D00] border-t-transparent" />
            <span className="text-xs font-bold uppercase tracking-wider text-stone-900">Abrindo o editor</span>
          </div>
          <p className="mt-1 text-[11px] font-medium text-stone-500">Carregando o site de {businessName}</p>
        </div>
      )}

      {data && (
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* Side panel */}
          <aside className={`${mobileView === 'edit' ? 'flex' : 'hidden'} min-h-0 w-full flex-1 flex-col border-white/[0.08] bg-[#0d0f13] md:flex md:w-[380px] md:flex-none md:border-r`}>
            <nav className="flex flex-none gap-1 border-b border-white/[0.08] p-2" aria-label="Seções do editor">
              {tabs.map(([id, label]) => (
                <button key={id} type="button" onClick={() => setTab(id)} aria-pressed={tab === id} className={`h-9 flex-1 rounded-lg text-[13px] font-semibold transition ${tab === id ? 'bg-white/[0.1] text-white' : 'text-[#9aa1ac] hover:text-white'}`}>{label}</button>
              ))}
            </nav>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {tab === 'content' && <ContentPanel data={data} update={update} focusSection={focusSection} notify={(m) => flash(m, 'error')} />}
              {tab === 'design' && <DesignPanel data={data} update={update} focusSection={focusSection} notify={(m) => flash(m, 'error')} />}
              {tab === 'sections' && <SectionsPanel data={data} update={update} focusSection={focusSection} notify={(m) => flash(m, 'error')} />}
            </div>
          </aside>

          {/* Preview */}
          <main className={`${mobileView === 'preview' ? 'flex' : 'hidden'} min-h-0 flex-1 items-stretch justify-center bg-[#16181d] md:flex md:p-5`}>
            <div className="h-full transition-[width] duration-300 ease-out" style={{ width: DEVICE_WIDTH[device], maxWidth: '100%' }}>
              <iframe
                ref={iframeRef}
                title="Prévia do site"
                srcDoc={html}
                sandbox="allow-scripts"
                onLoad={restoreScroll}
                className={`h-full w-full bg-white ${device === 'desktop' ? 'md:rounded-xl' : 'rounded-2xl border border-white/10'}`}
              />
            </div>
          </main>
        </div>
      )}

      {/* Mobile switch */}
      {data && (
        <div className="flex flex-none gap-1 border-t border-white/[0.08] bg-[#0d0f13] p-2 md:hidden">
          {([['edit', 'Editar', Pencil], ['preview', 'Ver site', Eye]] as const).map(([id, label, Icon]) => (
            <button key={id} type="button" onClick={() => setMobileView(id)} aria-pressed={mobileView === id} className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-lg text-[13px] font-semibold ${mobileView === id ? 'bg-white/[0.1] text-white' : 'text-[#9aa1ac]'}`}><Icon className="h-4 w-4" />{label}</button>
          ))}
        </div>
      )}

      {toast && (
        <div role="status" className={`pointer-events-none fixed bottom-20 left-1/2 z-[310] flex max-w-[92vw] -translate-x-1/2 items-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-medium shadow-2xl md:bottom-8 ${toast.tone === 'ok' ? 'border-emerald-400/30 bg-[#0f2a1f] text-emerald-100' : 'border-rose-400/30 bg-[#2a1216] text-rose-100'}`}>
          {toast.tone === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}{toast.text}
        </div>
      )}
    </div>,
    document.body,
  );
}
