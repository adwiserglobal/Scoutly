import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  Database,
  Loader2,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Square,
  Target,
  Workflow,
  X,
  Zap,
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

const ACTIVE_PATHS = new Set(['/dashboard', '/favoritos', '/pipeline', '/configuracoes']);
const STAGE_LABELS: Record<string, string> = {
  queued: 'Na fila',
  planning: 'Planejando',
  searching: 'Buscando empresas',
  qualifying: 'Qualificando leads',
  saving: 'Salvando no pipeline',
  completed: 'Concluído',
  failed: 'Falhou',
  cancelled: 'Cancelado',
};

const PRESETS = [
  'Encontre despachantes sem site e priorize quem tem telefone',
  'Encontre clínicas odontológicas com presença digital fraca',
  'Encontre oficinas mecânicas com telefone e alto potencial comercial',
];

function statusClass(status: string) {
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
  const [pathname, setPathname] = useState(() => window.location.pathname.replace(/\/+$/, '') || '/');
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

  useEffect(() => {
    const sync = () => setPathname(window.location.pathname.replace(/\/+$/, '') || '/');
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  const visible = Boolean(user && ACTIVE_PATHS.has(pathname));

  const refreshRuns = async (selectActive = false) => {
    if (!user) return;
    setIsLoadingRuns(true);
    try {
      const nextRuns = await listAgentRuns();
      setRuns(nextRuns);
      if (selectActive) {
        const active = nextRuns.find((run) => isAgentRunActive(run.status));
        const candidate = active || nextRuns[0];
        if (candidate) {
          const detail = await getAgentRun(candidate.id);
          setSelectedRun(detail);
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar Agent Runs.');
    } finally {
      setIsLoadingRuns(false);
    }
  };

  useEffect(() => {
    if (!open || !user) return;
    void refreshRuns(!selectedRun);
  }, [open, user?.uid]);

  // The UI actively advances the durable queue for instant feedback. The worker
  // uses DB locking, so this is safe even when cron or another tab fires too.
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
        if (!cancelled) setError(err?.message || 'Oscilação ao acompanhar o Agent.');
      } finally {
        pumpRef.current = false;
      }
    };

    void tick();
    const interval = window.setInterval(tick, 1800);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [selectedRun?.id, selectedRun?.status]);

  const startRun = async () => {
    const cleanObjective = objective.trim();
    if (!cleanObjective) {
      setError('Descreva o que o Agent deve encontrar e qualificar.');
      return;
    }

    setIsStarting(true);
    setError('');
    try {
      localStorage.setItem('scoutly_agent_region', regionName.trim() || 'São Paulo - SP');
      const run = await createAgentRun({
        objective: cleanObjective,
        currentRegionName: regionName.trim() || 'São Paulo - SP',
        targetCount,
      });
      setSelectedRun(run);
      setRuns((prev) => [run, ...prev.filter((item) => item.id !== run.id)]);
      await kickAgentWorker();
      const detail = await getAgentRun(run.id);
      setSelectedRun(detail);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível iniciar o Agent Run.');
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
      const detail = await getAgentRun(run.id);
      setSelectedRun(detail);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível abrir esta execução.');
    }
  };

  const newRun = () => {
    setSelectedRun(null);
    setObjective('');
    setError('');
  };

  const leads = selectedRun?.leads || [];
  const events = useMemo(() => [...(selectedRun?.events || [])].reverse(), [selectedRun?.events]);

  if (!visible) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group fixed bottom-[76px] right-4 z-[34] flex h-11 items-center gap-2 rounded-2xl border border-[#FF5A12]/30 bg-[#111418]/[0.96] px-2.5 text-white shadow-[0_12px_34px_rgba(0,0,0,0.34)] backdrop-blur-2xl transition hover:border-[#FF5A12]/65 hover:bg-[#17191d] active:scale-[0.97] sm:bottom-5 sm:right-[148px] sm:px-3.5"
        aria-label="Abrir Scoutly Agentic"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF5A12] to-[#FF7A35] text-white shadow-[0_6px_18px_rgba(255,90,18,0.28)]">
          <Workflow className="h-4 w-4" />
        </span>
        <span className="hidden text-[11px] font-semibold tracking-[-0.01em] text-stone-100 sm:inline">
          Agentic
        </span>
        {runs.some((run) => isAgentRunActive(run.status)) && (
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex justify-end bg-black/70 backdrop-blur-[6px]" onMouseDown={() => setOpen(false)}>
          <section
            className="flex h-full w-full max-w-[860px] flex-col overflow-hidden border-l border-white/[0.09] bg-[#080b0e] shadow-[-30px_0_100px_rgba(0,0,0,0.48)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="flex shrink-0 items-center justify-between border-b border-white/[0.08] bg-[#0d1014] px-4 py-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF5A12] to-[#FF7A35] shadow-[0_10px_30px_rgba(255,90,18,0.22)]">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-base font-bold tracking-tight text-white">Scoutly Agentic</h2>
                    <span className="rounded-full border border-[#FF5A12]/25 bg-[#FF5A12]/10 px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-[#FF8A52]">Beta</span>
                  </div>
                  <p className="truncate text-[11px] text-stone-500">Objetivo → busca → enriquecimento → qualificação → pipeline</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => void refreshRuns(false)}
                  className="rounded-xl p-2 text-stone-500 transition hover:bg-white/[0.05] hover:text-white"
                  title="Atualizar"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoadingRuns ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-xl p-2 text-stone-500 transition hover:bg-white/[0.05] hover:text-white"
                  title="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </header>

            <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[230px_minmax(0,1fr)]">
              <aside className="hidden min-h-0 border-r border-white/[0.07] bg-[#0b0e12] lg:flex lg:flex-col">
                <div className="flex items-center justify-between px-4 pb-3 pt-4">
                  <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-stone-600">Agent Runs</span>
                  <button type="button" onClick={newRun} className="text-[10px] font-semibold text-[#FF7A3D] hover:text-[#FF9A68]">Novo</button>
                </div>
                <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-4 no-scrollbar">
                  {runs.length === 0 ? (
                    <div className="px-3 py-8 text-center text-[11px] leading-relaxed text-stone-600">Suas execuções aparecerão aqui.</div>
                  ) : runs.map((run) => (
                    <button
                      type="button"
                      key={run.id}
                      onClick={() => void selectRun(run)}
                      className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                        selectedRun?.id === run.id
                          ? 'border-[#FF5A12]/25 bg-[#FF5A12]/[0.07]'
                          : 'border-transparent hover:border-white/[0.06] hover:bg-white/[0.03]'
                      }`}
                    >
                      <div className="line-clamp-2 text-[11px] font-semibold leading-snug text-stone-200">{run.objective}</div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-[9px] text-stone-600">{timeAgo(run.created_at)}</span>
                        <span className={`rounded-full border px-1.5 py-0.5 text-[8px] font-semibold ${statusClass(run.status)}`}>
                          {STAGE_LABELS[run.status] || run.status}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </aside>

              <main className="min-h-0 overflow-y-auto custom-scrollbar">
                {!selectedRun ? (
                  <div className="mx-auto flex min-h-full max-w-2xl flex-col justify-center px-4 py-8 sm:px-7">
                    <div className="mb-7">
                      <div className="mb-3 flex items-center gap-2 text-[#FF7A3D]">
                        <Zap className="h-4 w-4" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.14em]">Autonomous prospecting</span>
                      </div>
                      <h3 className="max-w-xl text-2xl font-semibold tracking-[-0.035em] text-white sm:text-3xl">
                        Diga o resultado. O Agent executa o trabalho.
                      </h3>
                      <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone-500">
                        Ele planeja, busca empresas, expande a região quando necessário, verifica sites em lotes, qualifica oportunidades e salva os melhores leads no pipeline.
                      </p>
                    </div>

                    <div className="rounded-[24px] border border-white/[0.09] bg-[#101318] p-3 shadow-[0_24px_70px_rgba(0,0,0,0.22)] sm:p-4">
                      <textarea
                        value={objective}
                        onChange={(event) => setObjective(event.target.value)}
                        placeholder="Ex.: Encontre despachantes sem site em São Paulo, priorize os que têm telefone e salve os melhores no pipeline."
                        className="min-h-[118px] w-full resize-none bg-transparent px-2 py-2 text-sm leading-relaxed text-white outline-none placeholder:text-stone-700"
                      />

                      <div className="grid gap-2 border-t border-white/[0.07] pt-3 sm:grid-cols-[1fr_130px]">
                        <label className="rounded-xl border border-white/[0.07] bg-[#090c10] px-3 py-2">
                          <span className="block text-[8px] font-bold uppercase tracking-[0.12em] text-stone-600">Região base</span>
                          <input
                            value={regionName}
                            onChange={(event) => setRegionName(event.target.value)}
                            className="mt-1 w-full bg-transparent text-[11px] text-stone-300 outline-none"
                            placeholder="São Paulo - SP"
                          />
                        </label>

                        <label className="rounded-xl border border-white/[0.07] bg-[#090c10] px-3 py-2">
                          <span className="block text-[8px] font-bold uppercase tracking-[0.12em] text-stone-600">Meta de leads</span>
                          <select
                            value={targetCount}
                            onChange={(event) => setTargetCount(Number(event.target.value))}
                            className="mt-1 w-full bg-transparent text-[11px] text-stone-300 outline-none"
                          >
                            {[10, 25, 50, 100, 300].map((count) => <option key={count} value={count}>{count} leads</option>)}
                          </select>
                        </label>
                      </div>

                      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-[9px] leading-relaxed text-stone-600">O limite real depende do seu plano. O backend reduz automaticamente metas acima do permitido.</p>
                        <button
                          type="button"
                          onClick={() => void startRun()}
                          disabled={isStarting || !objective.trim()}
                          className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#FF5A12] px-4 text-[11px] font-bold text-white transition hover:bg-[#ff6a27] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {isStarting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
                          Executar Agent
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-2 sm:grid-cols-3">
                      {PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setObjective(preset)}
                          className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-3 py-3 text-left text-[10px] leading-relaxed text-stone-500 transition hover:border-[#FF5A12]/20 hover:bg-[#FF5A12]/[0.04] hover:text-stone-300"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>

                    {runs.length > 0 && (
                      <button type="button" onClick={() => void selectRun(runs[0])} className="mt-6 flex items-center justify-center gap-1 text-[10px] font-semibold text-stone-500 hover:text-white lg:hidden">
                        Ver última execução <ChevronRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="mx-auto max-w-3xl px-4 py-6 sm:px-7 sm:py-8">
                    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] ${statusClass(selectedRun.status)}`}>
                            {STAGE_LABELS[selectedRun.status] || selectedRun.status}
                          </span>
                          <span className="text-[9px] text-stone-600">{selectedRun.current_region_name}</span>
                        </div>
                        <h3 className="text-lg font-semibold leading-snug tracking-[-0.02em] text-white">{selectedRun.objective}</h3>
                        <p className="mt-2 text-xs leading-relaxed text-stone-500">{selectedRun.current_message}</p>
                      </div>

                      <div className="flex shrink-0 gap-2">
                        {isAgentRunActive(selectedRun.status) && (
                          <button type="button" onClick={() => void stopRun()} className="flex h-9 items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/[0.06] px-3 text-[10px] font-semibold text-rose-300 hover:bg-rose-500/[0.10]">
                            <Square className="h-3.5 w-3.5 fill-current" /> Cancelar
                          </button>
                        )}
                        <button type="button" onClick={newRun} className="h-9 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-[10px] font-semibold text-stone-400 hover:text-white">Novo Run</button>
                      </div>
                    </div>

                    <div className="rounded-[22px] border border-white/[0.08] bg-[#101318] p-4 sm:p-5">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="text-2xl font-semibold tabular-nums text-white">{selectedRun.progress}%</div>
                          <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-stone-600">Progresso</div>
                        </div>
                        <div className="grid grid-cols-3 gap-5 text-right">
                          <div><div className="text-sm font-semibold tabular-nums text-white">{selectedRun.found_count}</div><div className="text-[8px] uppercase tracking-wider text-stone-600">Encontrados</div></div>
                          <div><div className="text-sm font-semibold tabular-nums text-white">{selectedRun.qualified_count}</div><div className="text-[8px] uppercase tracking-wider text-stone-600">Qualificados</div></div>
                          <div><div className="text-sm font-semibold tabular-nums text-[#FF7A3D]">{selectedRun.target_count}</div><div className="text-[8px] uppercase tracking-wider text-stone-600">Meta</div></div>
                        </div>
                      </div>
                      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#FF5A12] to-[#FF8A52] transition-all duration-700" style={{ width: `${Math.max(2, selectedRun.progress)}%` }} />
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.08fr]">
                      <div className="rounded-[22px] border border-white/[0.08] bg-[#0e1115] p-4">
                        <div className="mb-4 flex items-center gap-2">
                          <Workflow className="h-4 w-4 text-[#FF6A26]" />
                          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-stone-400">Execução</span>
                        </div>
                        <div className="space-y-1">
                          {(selectedRun.steps || []).map((step) => (
                            <div key={step.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5">
                              <StepIcon step={step} />
                              <div className="min-w-0 flex-1">
                                <div className="text-[11px] font-medium text-stone-300">{step.label}</div>
                                {step.status === 'failed' && step.error && <div className="mt-0.5 truncate text-[9px] text-rose-400">{step.error}</div>}
                              </div>
                              <span className="text-[8px] uppercase tracking-wider text-stone-700">{step.status}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-[22px] border border-white/[0.08] bg-[#0e1115] p-4">
                        <div className="mb-4 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Database className="h-4 w-4 text-[#FF6A26]" />
                            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-stone-400">Activity Log</span>
                          </div>
                          {isAgentRunActive(selectedRun.status) && <span className="flex items-center gap-1.5 text-[9px] text-emerald-400"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />live</span>}
                        </div>
                        <div className="max-h-[210px] space-y-3 overflow-y-auto pr-1 custom-scrollbar">
                          {events.length === 0 ? (
                            <div className="py-8 text-center text-[10px] text-stone-700">Aguardando atividade...</div>
                          ) : events.map((event) => (
                            <div key={event.id} className="flex gap-2.5">
                              <Clock3 className="mt-0.5 h-3 w-3 shrink-0 text-stone-700" />
                              <div className="min-w-0">
                                <p className={`text-[10px] leading-relaxed ${event.level === 'error' ? 'text-rose-300' : event.level === 'success' ? 'text-emerald-300' : 'text-stone-500'}`}>{event.message}</p>
                                <span className="text-[8px] text-stone-700">{new Date(event.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {selectedRun.status === 'completed' && (
                      <div className="mt-4 rounded-[22px] border border-emerald-500/15 bg-emerald-500/[0.035] p-4 sm:p-5">
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400"><ShieldCheck className="h-4 w-4" /></div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-semibold text-white">Agent Run concluído</h4>
                            <p className="mt-1 text-[11px] leading-relaxed text-stone-400">{selectedRun.result_summary?.summaryText || `${selectedRun.saved_count} oportunidades foram adicionadas ao pipeline.`}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button type="button" onClick={() => window.location.assign('/pipeline')} className="flex h-9 items-center gap-2 rounded-xl bg-emerald-500 px-3.5 text-[10px] font-bold text-black hover:bg-emerald-400">
                                Ver no Pipeline <ChevronRight className="h-3.5 w-3.5" />
                              </button>
                              <button type="button" onClick={newRun} className="h-9 rounded-xl border border-white/[0.08] px-3.5 text-[10px] font-semibold text-stone-400 hover:text-white">Criar outro Agent</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedRun.status === 'failed' && (
                      <div className="mt-4 rounded-[20px] border border-rose-500/20 bg-rose-500/[0.06] p-4 text-[11px] leading-relaxed text-rose-300">
                        {selectedRun.error || 'A execução foi interrompida após várias tentativas automáticas.'}
                      </div>
                    )}

                    {leads.length > 0 && (
                      <div className="mt-6">
                        <div className="mb-3 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2"><Target className="h-4 w-4 text-[#FF6A26]" /><h4 className="text-[10px] font-bold uppercase tracking-[0.12em] text-stone-400">Oportunidades qualificadas</h4></div>
                          <span className="text-[9px] text-stone-600">{leads.length} exibidas</span>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {leads.slice(0, 30).map((lead) => {
                            const business = lead.business_snapshot || {};
                            const hasContact = Boolean(business.phone || business.phones?.length || business.email || business.emails?.length);
                            return (
                              <div key={lead.id} className="rounded-2xl border border-white/[0.07] bg-[#0f1216] p-3.5 transition hover:border-white/[0.12]">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="truncate text-[11px] font-semibold text-white">{business.name || 'Empresa'}</div>
                                    <div className="mt-1 line-clamp-1 text-[9px] text-stone-600">{business.address || business.category || ''}</div>
                                  </div>
                                  <div className="shrink-0 rounded-lg border border-[#FF5A12]/20 bg-[#FF5A12]/[0.07] px-2 py-1 text-[10px] font-bold tabular-nums text-[#FF8A52]">{Math.round(Number(lead.score || 0))}</div>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                  {!business.website && <span className="rounded-md bg-amber-500/10 px-2 py-1 text-[8px] font-semibold text-amber-300">Sem site</span>}
                                  {hasContact && <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-[8px] font-semibold text-emerald-300">Com contato</span>}
                                  {(lead.reasons || []).slice(0, 1).map((reason) => <span key={reason} className="max-w-full truncate rounded-md bg-white/[0.04] px-2 py-1 text-[8px] text-stone-500">{reason}</span>)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </main>
            </div>

            {error && (
              <div className="absolute bottom-4 left-1/2 z-20 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-2xl border border-rose-500/20 bg-[#171013]/95 px-4 py-3 shadow-2xl backdrop-blur-xl">
                <div className="flex items-start justify-between gap-4">
                  <p className="text-[11px] leading-relaxed text-rose-300">{error}</p>
                  <button type="button" onClick={() => setError('')} className="text-rose-400"><X className="h-4 w-4" /></button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
