import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  Loader2,
  MapPin,
  Phone,
  Play,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Square,
  Target,
  Workflow,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  AgentRun,
  AgentRunStep,
  cancelAgentRun,
  createAgentRun,
  getAgentRun,
  isAgentRunActive,
  kickAgentWorker,
  listAgentRuns,
} from '../services/agenticApi';

const STAGE_LABELS: Record<string, string> = {
  queued: 'Na fila',
  planning: 'Planejando',
  searching: 'Buscando empresas',
  qualifying: 'Qualificando oportunidades',
  saving: 'Salvando no pipeline',
  completed: 'Concluído',
  failed: 'Não concluído',
  cancelled: 'Cancelado',
};

const PRESETS = [
  'Encontre 30 despachantes em São Paulo sem site e priorize os que têm telefone',
  'Encontre 25 clínicas odontológicas com presença digital fraca em São Paulo',
  'Encontre 20 oficinas mecânicas com telefone e alto potencial comercial',
];

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractPromptCount(value: string): number | null {
  const match = value.match(/\b(\d{1,3})\b/);
  if (!match) return null;
  const count = Number(match[1]);
  return Number.isFinite(count) && count > 0 ? Math.min(300, count) : null;
}

function extractPromptLocation(value: string): string | null {
  const match = value.match(
    /\b(?:em|no|na)\s+(.+?)(?=\s+(?:sem|com|prioriz|que\s+ten|e\s+(?:adicione|salve|qualifique|priorize)|para\s+(?:vender|prospec))\b|[,.;]|$)/i,
  );
  return match?.[1]?.trim() || null;
}

function promptSignals(value: string) {
  const text = normalizeText(value);
  const items: string[] = [];
  const count = extractPromptCount(value);
  const location = extractPromptLocation(value);
  if (count) items.push(`${count} leads`);
  if (location) items.push(location);
  if (/sem site|sem website|nao tem site/.test(text)) items.push('Sem site');
  if (/telefone|whatsapp/.test(text)) items.push(/prioriz/.test(text) ? 'Priorizar contato' : 'Com contato');
  if (/sem instagram|sem rede social/.test(text)) items.push('Sem redes sociais');
  return items.slice(0, 4);
}

function statusTone(status: string) {
  if (status === 'completed') return 'border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-300';
  if (status === 'failed') return 'border-rose-500/25 bg-rose-500/[0.08] text-rose-300';
  if (status === 'cancelled') return 'border-stone-500/20 bg-stone-500/[0.08] text-stone-400';
  return 'border-[#FF5A12]/25 bg-[#FF5A12]/[0.08] text-[#FF8A52]';
}

function StepIcon({ step }: { step: AgentRunStep }) {
  if (step.status === 'completed') return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  if (step.status === 'running') return <Loader2 className="h-4 w-4 animate-spin text-[#FF6A26]" />;
  if (step.status === 'failed') return <X className="h-4 w-4 text-rose-400" />;
  return <Circle className="h-4 w-4 text-stone-700" />;
}

function timeAgo(value?: string | null) {
  if (!value) return '';
  const delta = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(delta)) return '';
  if (delta < 60_000) return 'agora';
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)} min`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)} h`;
  return `${Math.floor(delta / 86_400_000)} d`;
}

export default function AgenticLauncher() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [objective, setObjective] = useState('');
  const [targetCount, setTargetCount] = useState(25);
  const [regionName, setRegionName] = useState(() => localStorage.getItem('scoutly_agent_region') || 'São Paulo - SP');
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<AgentRun | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);
  const [error, setError] = useState('');
  const pumpRef = useRef(false);

  const visible = Boolean(user);
  const signals = useMemo(() => promptSignals(objective), [objective]);

  const refreshRuns = async (selectActive = false) => {
    if (!user) return;
    setIsLoadingRuns(true);
    try {
      const nextRuns = await listAgentRuns();
      setRuns(nextRuns);
      if (selectActive) {
        const candidate = nextRuns.find((run) => isAgentRunActive(run.status)) || nextRuns[0];
        if (candidate) setSelectedRun(await getAgentRun(candidate.id));
      }
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar as execuções.');
    } finally {
      setIsLoadingRuns(false);
    }
  };

  useEffect(() => {
    if (!open || !user) return;
    void refreshRuns(!selectedRun);
  }, [open, user?.uid]);

  useEffect(() => {
    if (!selectedRun || !isAgentRunActive(selectedRun.status)) return;
    let cancelled = false;

    const tick = async () => {
      if (pumpRef.current || cancelled) return;
      pumpRef.current = true;
      try {
        await kickAgentWorker();
        if (cancelled) return;
        const detail = await getAgentRun(selectedRun.id);
        if (!cancelled) {
          setSelectedRun(detail);
          setRuns((prev) => prev.map((run) => (run.id === detail.id ? { ...run, ...detail } : run)));
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Oscilação ao acompanhar a execução.');
      } finally {
        pumpRef.current = false;
      }
    };

    void tick();
    const interval = window.setInterval(tick, 2200);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [selectedRun?.id, selectedRun?.status]);

  const handleObjectiveChange = (value: string) => {
    setObjective(value);
    const inferred = extractPromptCount(value);
    if (inferred) setTargetCount(inferred);
    const inferredLocation = extractPromptLocation(value);
    if (inferredLocation) setRegionName(inferredLocation.includes('-') ? inferredLocation : `${inferredLocation} - SP`);
  };

  const startRun = async () => {
    const cleanObjective = objective.trim();
    if (!cleanObjective) {
      setError('Descreva o resultado que você quer receber.');
      return;
    }

    setIsStarting(true);
    setError('');
    try {
      const promptCount = extractPromptCount(cleanObjective);
      const finalTarget = promptCount || targetCount;
      localStorage.setItem('scoutly_agent_region', regionName.trim() || 'São Paulo - SP');
      const run = await createAgentRun({
        objective: cleanObjective,
        currentRegionName: regionName.trim() || 'São Paulo - SP',
        targetCount: finalTarget,
      });
      setSelectedRun(run);
      setRuns((prev) => [run, ...prev.filter((item) => item.id !== run.id)]);
      await kickAgentWorker();
      setSelectedRun(await getAgentRun(run.id));
    } catch (err: any) {
      setError(err?.message || 'Não foi possível iniciar o Agent.');
    } finally {
      setIsStarting(false);
    }
  };

  const stopRun = async () => {
    if (!selectedRun || !isAgentRunActive(selectedRun.status)) return;
    try {
      const next = await cancelAgentRun(selectedRun.id);
      setSelectedRun({ ...selectedRun, ...next });
      setRuns((prev) => prev.map((run) => (run.id === next.id ? { ...run, ...next } : run)));
    } catch (err: any) {
      setError(err?.message || 'Não foi possível cancelar a execução.');
    }
  };

  const selectRun = async (run: AgentRun) => {
    setError('');
    try {
      setSelectedRun(await getAgentRun(run.id));
    } catch (err: any) {
      setError(err?.message || 'Não foi possível abrir esta execução.');
    }
  };

  const newRun = (reuse?: AgentRun) => {
    setSelectedRun(null);
    setObjective(reuse?.objective || '');
    if (reuse) {
      setTargetCount(reuse.target_count || 25);
      setRegionName(reuse.current_region_name || 'São Paulo - SP');
    }
    setError('');
  };

  const leads = selectedRun?.leads || [];
  const events = selectedRun?.events || [];
  const isActive = selectedRun ? isAgentRunActive(selectedRun.status) : false;
  const displayProgress = selectedRun?.status === 'failed' ? Math.min(95, selectedRun.progress || 0) : selectedRun?.progress || 0;

  if (!visible) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group pointer-events-auto fixed bottom-[76px] right-4 z-[80] flex h-11 items-center gap-2 rounded-2xl border border-[#FF5A12]/40 bg-[#0e1115]/95 px-2.5 text-white shadow-[0_14px_42px_rgba(0,0,0,0.44)] backdrop-blur-2xl transition hover:border-[#FF5A12]/70 hover:bg-[#15191e] active:scale-[0.98] sm:bottom-5 sm:right-[148px] sm:px-3.5"
        aria-label="Abrir Scoutly Agent"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#FF5A12] text-white shadow-[0_7px_22px_rgba(255,90,18,0.24)]">
          <Workflow className="h-4 w-4" />
        </span>
        <span className="hidden text-[11px] font-semibold text-stone-100 sm:inline">Scoutly Agent</span>
        {runs.some((run) => isAgentRunActive(run.status)) && <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />}
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] bg-black/72 backdrop-blur-[7px]" onMouseDown={() => setOpen(false)}>
          <section
            className="absolute inset-y-0 right-0 flex w-full max-w-[980px] flex-col overflow-hidden border-l border-white/[0.08] bg-[#080a0d] shadow-[-40px_0_120px_rgba(0,0,0,0.55)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-white/[0.07] px-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#FF5A12] text-white">
                  <Sparkles className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-sm font-semibold text-white">Scoutly Agent</h2>
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.11em] text-stone-500">Agentic</span>
                  </div>
                  <p className="mt-0.5 truncate text-[10px] text-stone-600">Prospecção executada de ponta a ponta</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => void refreshRuns(false)} className="rounded-xl p-2.5 text-stone-600 transition hover:bg-white/[0.05] hover:text-white" title="Atualizar">
                  <RefreshCw className={`h-4 w-4 ${isLoadingRuns ? 'animate-spin' : ''}`} />
                </button>
                <button type="button" onClick={() => setOpen(false)} className="rounded-xl p-2.5 text-stone-600 transition hover:bg-white/[0.05] hover:text-white" title="Fechar">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </header>

            <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)]">
              <aside className="hidden min-h-0 border-r border-white/[0.06] bg-[#0a0d10] lg:flex lg:flex-col">
                <div className="flex items-center justify-between px-4 pb-3 pt-4">
                  <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-stone-700">Execuções</span>
                  <button type="button" onClick={() => newRun()} className="text-[10px] font-semibold text-[#FF7A3D] hover:text-[#FF9B70]">Nova</button>
                </div>
                <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-4 no-scrollbar">
                  {runs.length === 0 ? (
                    <p className="px-3 py-8 text-center text-[10px] leading-relaxed text-stone-700">Suas missões aparecerão aqui.</p>
                  ) : runs.map((run) => (
                    <button
                      type="button"
                      key={run.id}
                      onClick={() => void selectRun(run)}
                      className={`w-full rounded-xl px-3 py-3 text-left transition ${selectedRun?.id === run.id ? 'bg-white/[0.06]' : 'hover:bg-white/[0.035]'}`}
                    >
                      <div className="line-clamp-2 text-[10px] font-medium leading-snug text-stone-300">{run.objective}</div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-[8px] text-stone-700">{timeAgo(run.created_at)}</span>
                        <span className={`rounded-full border px-1.5 py-0.5 text-[7px] font-semibold ${statusTone(run.status)}`}>{STAGE_LABELS[run.status] || run.status}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </aside>

              <main className="min-h-0 overflow-y-auto custom-scrollbar">
                {!selectedRun ? (
                  <div className="mx-auto flex min-h-full max-w-[720px] flex-col justify-center px-5 py-10 sm:px-8">
                    <div className="mb-7 max-w-2xl">
                      <span className="mb-3 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#FF7A3D]"><Target className="h-3.5 w-3.5" />Defina o resultado</span>
                      <h3 className="text-[28px] font-semibold leading-[1.08] tracking-[-0.045em] text-white sm:text-[38px]">Diga o que você quer encontrar. O Scoutly faz o resto.</h3>
                      <p className="mt-4 max-w-xl text-sm leading-relaxed text-stone-500">O Agent busca, amplia a região quando necessário, verifica sinais comerciais, prioriza oportunidades e entrega a lista no seu pipeline.</p>
                    </div>

                    <div className="rounded-[26px] border border-white/[0.09] bg-[#0f1317] p-3 shadow-[0_24px_80px_rgba(0,0,0,0.24)] sm:p-4">
                      <textarea
                        value={objective}
                        onChange={(event) => handleObjectiveChange(event.target.value)}
                        placeholder="Ex.: Encontre 30 despachantes em São Paulo sem site e priorize quem tem telefone"
                        className="min-h-[128px] w-full resize-none bg-transparent px-2 py-2 text-[15px] leading-relaxed text-white outline-none placeholder:text-stone-700"
                      />

                      {signals.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-1.5 px-2">
                          {signals.map((signal) => <span key={signal} className="rounded-full border border-white/[0.08] bg-white/[0.035] px-2.5 py-1 text-[9px] font-medium text-stone-400">{signal}</span>)}
                        </div>
                      )}

                      <div className="flex flex-col gap-2 border-t border-white/[0.07] pt-3 sm:flex-row sm:items-center">
                        <label className="flex h-10 flex-1 items-center gap-2 rounded-xl border border-white/[0.07] bg-[#090c10] px-3">
                          <MapPin className="h-3.5 w-3.5 text-stone-600" />
                          <input value={regionName} onChange={(event) => setRegionName(event.target.value)} className="min-w-0 flex-1 bg-transparent text-[10px] text-stone-300 outline-none" aria-label="Região" />
                        </label>
                        <label className="flex h-10 items-center gap-2 rounded-xl border border-white/[0.07] bg-[#090c10] px-3 sm:w-[130px]">
                          <Target className="h-3.5 w-3.5 text-stone-600" />
                          <input
                            type="number"
                            min={1}
                            max={300}
                            value={targetCount}
                            onChange={(event) => setTargetCount(Math.max(1, Math.min(300, Number(event.target.value) || 1)))}
                            className="w-full bg-transparent text-[10px] text-stone-300 outline-none"
                            aria-label="Meta de leads"
                          />
                        </label>
                        <button type="button" disabled={isStarting || !objective.trim()} onClick={() => void startRun()} className="flex h-10 items-center justify-center gap-2 rounded-xl bg-[#FF5A12] px-5 text-[10px] font-semibold text-white transition hover:bg-[#ff6b2b] disabled:cursor-not-allowed disabled:opacity-40">
                          {isStarting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                          Executar
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      {PRESETS.map((preset) => (
                        <button key={preset} type="button" onClick={() => handleObjectiveChange(preset)} className="rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5 text-[9px] text-stone-500 transition hover:border-white/[0.12] hover:text-stone-300">{preset}</button>
                      ))}
                    </div>
                    {error && <div className="mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/[0.07] px-4 py-3 text-xs text-rose-300">{error}</div>}
                  </div>
                ) : (
                  <div className="mx-auto max-w-[760px] px-4 py-6 sm:px-7 sm:py-8">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.1em] ${statusTone(selectedRun.status)}`}>{STAGE_LABELS[selectedRun.status] || selectedRun.status}</span>
                          <span className="text-[9px] text-stone-700">{selectedRun.current_region_name}</span>
                        </div>
                        <h3 className="max-w-2xl text-[21px] font-semibold leading-tight tracking-[-0.035em] text-white sm:text-[26px]">{selectedRun.objective}</h3>
                        <p className={`mt-3 text-xs leading-relaxed ${selectedRun.status === 'failed' ? 'text-rose-300/80' : 'text-stone-500'}`}>{selectedRun.current_message}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {isActive && <button type="button" onClick={() => void stopRun()} className="flex h-9 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 text-[9px] font-semibold text-stone-400 hover:text-white"><Square className="h-3 w-3 fill-current" />Parar</button>}
                        <button type="button" onClick={() => newRun(selectedRun)} className="flex h-9 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 text-[9px] font-semibold text-stone-300 hover:bg-white/[0.05] hover:text-white"><RotateCcw className="h-3.5 w-3.5" />Usar como novo</button>
                      </div>
                    </div>

                    <div className="mt-7 rounded-[22px] border border-white/[0.08] bg-[#0d1115] p-4 sm:p-5">
                      <div className="flex items-end justify-between gap-4">
                        <div>
                          <div className="text-[10px] font-medium text-stone-600">Progresso da missão</div>
                          <div className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-white">{selectedRun.status === 'failed' ? 'Interrompida' : `${displayProgress}%`}</div>
                        </div>
                        <div className="grid grid-cols-3 gap-5 text-right sm:gap-8">
                          <div><div className="text-lg font-semibold text-white">{selectedRun.found_count}</div><div className="text-[7px] uppercase tracking-[0.1em] text-stone-700">Encontrados</div></div>
                          <div><div className="text-lg font-semibold text-white">{selectedRun.processed_count}</div><div className="text-[7px] uppercase tracking-[0.1em] text-stone-700">Analisados</div></div>
                          <div><div className="text-lg font-semibold text-[#FF7A3D]">{selectedRun.saved_count || selectedRun.qualified_count}</div><div className="text-[7px] uppercase tracking-[0.1em] text-stone-700">Selecionados</div></div>
                        </div>
                      </div>
                      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.05]"><div className={`h-full rounded-full transition-all duration-700 ${selectedRun.status === 'failed' ? 'bg-rose-500/70' : 'bg-[#FF5A12]'}`} style={{ width: `${Math.max(3, displayProgress)}%` }} /></div>
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-[0.78fr_1.22fr]">
                      <section className="rounded-[20px] border border-white/[0.08] bg-[#0c0f13] p-4">
                        <div className="mb-4 text-[9px] font-semibold uppercase tracking-[0.13em] text-stone-600">Execução</div>
                        <div className="space-y-3">
                          {(selectedRun.steps || []).map((step) => (
                            <div key={step.id} className="flex items-center gap-3 rounded-xl bg-white/[0.018] px-3 py-2.5">
                              <StepIcon step={step} />
                              <span className="min-w-0 flex-1 text-[10px] font-medium text-stone-300">{step.label}</span>
                              <span className="text-[7px] uppercase tracking-[0.08em] text-stone-700">{step.status === 'running' ? 'em andamento' : step.status}</span>
                            </div>
                          ))}
                        </div>
                      </section>

                      <section className="rounded-[20px] border border-white/[0.08] bg-[#0c0f13] p-4">
                        <div className="mb-4 flex items-center justify-between">
                          <div className="text-[9px] font-semibold uppercase tracking-[0.13em] text-stone-600">Oportunidades</div>
                          <span className="text-[9px] text-stone-700">meta {selectedRun.target_count}</span>
                        </div>

                        {leads.length === 0 ? (
                          <div className={`flex min-h-[178px] flex-col items-center justify-center rounded-2xl border border-dashed px-6 text-center ${selectedRun.status === 'failed' ? 'border-rose-500/20 bg-rose-500/[0.035]' : 'border-white/[0.07] bg-white/[0.015]'}`}>
                            {isActive ? <Loader2 className="mb-3 h-5 w-5 animate-spin text-[#FF6A26]" /> : <SearchIcon />}
                            <p className="text-[11px] font-medium text-stone-300">{isActive ? 'O Agent está procurando e validando empresas.' : 'Nenhuma oportunidade foi entregue nesta execução.'}</p>
                            {selectedRun.status === 'failed' && <button type="button" onClick={() => newRun(selectedRun)} className="mt-4 flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-[9px] font-semibold text-black">Ajustar e executar novamente <ArrowRight className="h-3 w-3" /></button>}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {leads.slice(0, 8).map((lead) => {
                              const business = lead.business_snapshot || {};
                              const phone = business.phone || business.phones?.[0];
                              return (
                                <div key={lead.id} className="rounded-2xl border border-white/[0.06] bg-[#11151a] p-3.5">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0"><div className="truncate text-[11px] font-semibold text-white">{business.name || 'Empresa'}</div><div className="mt-1 truncate text-[9px] text-stone-600">{business.address || business.category || 'Endereço não identificado'}</div></div>
                                    <div className="shrink-0 rounded-lg bg-[#FF5A12]/10 px-2 py-1 text-[9px] font-semibold text-[#FF8A52]">{Math.round(Number(lead.score || 0))}</div>
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-1.5">
                                    {!business.website && <span className="rounded-full bg-white/[0.04] px-2 py-1 text-[8px] text-stone-400">Sem site</span>}
                                    {phone && <span className="flex items-center gap-1 rounded-full bg-emerald-500/[0.08] px-2 py-1 text-[8px] text-emerald-300"><Phone className="h-2.5 w-2.5" />Contato</span>}
                                    {(lead.reasons || []).slice(0, 2).map((reason) => <span key={reason} className="rounded-full bg-white/[0.04] px-2 py-1 text-[8px] text-stone-500">{reason}</span>)}
                                  </div>
                                </div>
                              );
                            })}
                            {leads.length > 8 && <div className="pt-2 text-center text-[9px] text-stone-700">+ {leads.length - 8} oportunidades nesta execução</div>}
                          </div>
                        )}
                      </section>
                    </div>

                    {selectedRun.result_summary?.summaryText && (
                      <div className="mt-4 rounded-[18px] border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-[10px] leading-relaxed text-stone-500">{selectedRun.result_summary.summaryText}</div>
                    )}

                    <details className="group mt-4 rounded-[18px] border border-white/[0.06] bg-[#0b0e11]">
                      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.11em] text-stone-600">
                        Activity log <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" />
                      </summary>
                      <div className="border-t border-white/[0.05] px-4 py-3">
                        {events.length === 0 ? <p className="text-[9px] text-stone-700">Nenhum evento registrado.</p> : (
                          <div className="space-y-2.5">
                            {[...events].reverse().slice(-20).map((event) => (
                              <div key={event.id} className="flex items-start gap-2.5 text-[9px]"><Clock3 className="mt-0.5 h-3 w-3 shrink-0 text-stone-700" /><div className="min-w-0 flex-1"><span className={event.level === 'error' ? 'text-rose-300' : event.level === 'success' ? 'text-emerald-300' : 'text-stone-500'}>{event.message}</span><span className="ml-2 text-stone-800">{timeAgo(event.created_at)}</span></div></div>
                            ))}
                          </div>
                        )}
                      </div>
                    </details>

                    {error && <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/[0.07] px-4 py-3 text-xs text-rose-300">{error}</div>}
                  </div>
                )}
              </main>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function SearchIcon() {
  return (
    <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.025]">
      <Sparkles className="h-4 w-4 text-stone-600" />
    </div>
  );
}
