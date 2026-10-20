import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, Check, Copy, Crown, ShieldCheck, Lightbulb, Link2, Loader2, LogOut,
  Mail, Minus, Plus, RefreshCw, Trash2, TrendingUp, Users, X,
} from 'lucide-react';
import {
  getTeamOverview, getWorkspaceInsights, inviteTeamMember, leaveTeam, removeTeamMember, renewTeamInvite,
  revokeTeamInvite, setExtraSeats, setMemberAdmin, setPipelineMode,
  type Delta, type PipelineMode, type TeamOverview, type WorkspaceInsights,
} from '../../services/teamApi';
import { ActivityChart, BarList, CHART_COLORS, Funnel, Ring, Sparkline, WeekdayBars } from './charts';

type Section = 'overview' | 'team' | 'usage';

const SECTIONS: Array<{ id: Section; label: string }> = [
  { id: 'overview', label: 'Visão geral' },
  { id: 'team', label: 'Equipe' },
  { id: 'usage', label: 'Uso e limites' },
];

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (v: number) => v.toLocaleString('pt-BR');

function ago(iso: string | null) {
  if (!iso) return 'nunca';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 2) return 'agora';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'ontem' : `${d} dias`;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';
}

function Avatar({ name, photo }: { name: string; photo: string | null }) {
  return photo ? (
    <img src={photo} alt="" referrerPolicy="no-referrer" className="h-8 w-8 shrink-0 rounded-full object-cover" />
  ) : (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[11px] font-semibold text-stone-300">
      {initials(name)}
    </span>
  );
}

function Card({ title, subtitle, action, children, className = '' }: {
  title?: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-white/[0.07] bg-[#111418] p-4 sm:p-5 ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h3 className="text-[13px] font-semibold text-white">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-[11px] text-stone-500">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

function DeltaBadge({ delta }: { delta: Delta }) {
  if (delta.change === null) return <span className="text-[10px] text-stone-600">sem base anterior</span>;
  const up = delta.change > 0;
  const flat = delta.change === 0;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${flat ? 'text-stone-500' : up ? 'text-emerald-400' : 'text-rose-400'}`}>
      <Icon className="h-3 w-3" />{Math.abs(delta.change)}%
    </span>
  );
}

function Kpi({ label, delta, spark, color }: { label: string; delta: Delta; spark?: number[]; color?: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#111418] p-4">
      <p className="text-[11px] text-stone-500">{label}</p>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <span className="text-[26px] font-semibold leading-none tracking-tight text-white tabular-nums">{num(delta.value)}</span>
        {spark && <Sparkline values={spark} color={color} />}
      </div>
      <div className="mt-2 flex items-center gap-1.5"><DeltaBadge delta={delta} /><span className="text-[10px] text-stone-600">vs. período anterior</span></div>
    </div>
  );
}

const STAGE_LABELS: Record<string, { label: string; color: string }> = {
  NOVO: { label: 'Novo', color: '#78716c' },
  CONTATADO: { label: 'Contatado', color: CHART_COLORS.blue },
  EM_NEGOCIACAO: { label: 'Negociação', color: CHART_COLORS.amber },
  FECHADO: { label: 'Fechado', color: CHART_COLORS.green },
  PERDIDO: { label: 'Perdido', color: '#F87171' },
};

const STATUS_PT: Record<string, string> = {
  NOVO: 'Novo', CONTATADO: 'Contatado', EM_NEGOCIACAO: 'Negociação', FECHADO: 'Fechado', PERDIDO: 'Perdido', ARQUIVADO: 'Arquivado',
};

function Skeleton({ h = 120 }: { h?: number }) {
  return <div className="animate-pulse rounded-2xl bg-white/[0.04]" style={{ height: h }} />;
}

export default function WorkspacePage({ onLeft }: { onLeft?: () => void }) {
  const [section, setSection] = useState<Section>('overview');
  const [days, setDays] = useState(30);
  const [overview, setOverview] = useState<TeamOverview | null>(null);
  const [insights, setInsights] = useState<WorkspaceInsights | null>(null);
  const [error, setError] = useState('');
  const [insightsError, setInsightsError] = useState('');
  const [loadingInsights, setLoadingInsights] = useState(false);

  const isOwner = overview?.role === 'owner';
  const canManage = overview?.role === 'owner' || overview?.role === 'admin';

  const loadOverview = useCallback(async () => {
    try {
      setOverview(await getTeamOverview());
      setError('');
    } catch (e: any) {
      setError(e?.message || 'Não foi possível carregar o workspace.');
    }
  }, []);

  useEffect(() => { void loadOverview(); }, [loadOverview]);

  useEffect(() => {
    if (!canManage) return;
    let cancelled = false;
    setLoadingInsights(true);
    getWorkspaceInsights(days)
      .then((data) => { if (!cancelled) { setInsights(data); setInsightsError(''); } })
      .catch((e: any) => { if (!cancelled) setInsightsError(e?.message || 'Não foi possível carregar os dados.'); })
      .finally(() => { if (!cancelled) setLoadingInsights(false); });
    return () => { cancelled = true; };
  }, [canManage, days]);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.06] p-5 text-[12px] text-rose-200">
          {error}
          <button type="button" onClick={() => void loadOverview()} className="ml-3 underline">Tentar novamente</button>
        </div>
      </div>
    );
  }

  if (!overview) {
    return <div className="mx-auto max-w-5xl space-y-3 px-4 py-6"><Skeleton h={56} /><Skeleton h={220} /><Skeleton h={220} /></div>;
  }

  if (!overview.teamEnabled) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <Users className="mx-auto h-8 w-8 text-stone-600" />
        <h2 className="mt-3 text-lg font-semibold text-white">Workspace é do plano Agency</h2>
        <p className="mt-1 text-[12px] text-stone-500">Convide sua equipe, defina se o pipeline é compartilhado e acompanhe a prospecção de todos.</p>
        <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('scoutly-open-plans'))} className="mt-5 rounded-xl bg-[#FF5A12] px-5 py-2.5 text-[12px] font-semibold text-white">
          Ver planos
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-2 sm:px-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-white">{overview.workspace.name || 'Workspace'}</h1>
            <span className="rounded-full border border-[#FF5A12]/30 bg-[#FF5A12]/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#FF8A55]">Agency</span>
          </div>
          <p className="mt-0.5 text-[11px] text-stone-500">
            {isOwner ? 'Painel do dono do workspace' : canManage ? 'Você é administrador deste workspace' : `Você faz parte da equipe de ${overview.ownerName}`}
            {' · '}{overview.seats.members} {overview.seats.members === 1 ? 'pessoa' : 'pessoas'} · pipeline {overview.workspace.pipelineMode === 'shared' ? 'compartilhado' : 'individual'}
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-1 rounded-xl border border-white/[0.07] bg-[#111418] p-1">
            {[7, 30, 90].map((d) => (
              <button key={d} type="button" onClick={() => setDays(d)} className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition ${days === d ? 'bg-white/[0.10] text-white' : 'text-stone-500 hover:text-stone-300'}`}>
                {d} dias
              </button>
            ))}
          </div>
        )}
      </header>

      {canManage && (
        <nav className="mb-5 flex gap-1 border-b border-white/[0.06]">
          {SECTIONS.map((s) => (
            <button key={s.id} type="button" onClick={() => setSection(s.id)} className={`relative px-3.5 pb-2.5 pt-1 text-[12px] font-medium transition ${section === s.id ? 'text-white' : 'text-stone-500 hover:text-stone-300'}`}>
              {s.label}
              {section === s.id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[#FF5A12]" />}
            </button>
          ))}
        </nav>
      )}

      {!canManage && <MemberView overview={overview} onLeft={onLeft} />}
      {canManage && section === 'overview' && <Overview insights={insights} loading={loadingInsights} error={insightsError} />}
      {canManage && section === 'team' && <TeamSection overview={overview} reload={loadOverview} isOwner={isOwner} onLeft={onLeft} />}
      {canManage && section === 'usage' && <UsageSection insights={insights} overview={overview} loading={loadingInsights} error={insightsError} />}
    </div>
  );
}

/* ─────────────── Overview ─────────────── */

function Overview({ insights, loading, error }: { insights: WorkspaceInsights | null; loading: boolean; error: string }) {
  if (error && !insights) return <p className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.06] p-4 text-[12px] text-rose-200">{error}</p>;
  if (!insights) return <div className="space-y-3"><Skeleton h={100} /><Skeleton h={260} /></div>;

  const s = insights.summary;
  const spark = (key: 'unlocks' | 'leads' | 'aiMessages' | 'searches') => insights.series.map((p) => p[key]);
  const stages = Object.keys(STAGE_LABELS).map((k) => ({ label: STAGE_LABELS[k].label, value: insights.funnel[k] || 0, color: STAGE_LABELS[k].color }));

  return (
    <div className={`space-y-4 transition-opacity ${loading ? 'opacity-60' : ''}`}>
      {insights.insights.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {insights.insights.map((ins) => {
            const Icon = ins.tone === 'warn' ? AlertTriangle : ins.tone === 'good' ? TrendingUp : Lightbulb;
            const tone = ins.tone === 'warn' ? 'text-amber-300 bg-amber-400/10' : ins.tone === 'good' ? 'text-emerald-300 bg-emerald-400/10' : 'text-sky-300 bg-sky-400/10';
            return (
              <article key={ins.id} className="flex gap-3 rounded-2xl border border-white/[0.07] bg-[#111418] p-4">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}><Icon className="h-4 w-4" /></span>
                <div className="min-w-0">
                  <h4 className="text-[12px] font-semibold text-white">{ins.title}</h4>
                  <p className="mt-1 text-[11px] leading-relaxed text-stone-400">{ins.text}</p>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Negócios desbloqueados" delta={s.unlocks} spark={spark('unlocks')} color={CHART_COLORS.orange} />
        <Kpi label="Novos leads no pipeline" delta={s.newLeads} spark={spark('leads')} color={CHART_COLORS.blue} />
        <Kpi label="Clientes fechados" delta={s.won} color={CHART_COLORS.green} />
        <Kpi label="Mensagens de IA" delta={s.aiMessages} spark={spark('aiMessages')} color={CHART_COLORS.violet} />
        <Kpi label="Buscas realizadas" delta={s.searches} spark={spark('searches')} color={CHART_COLORS.amber} />
        <Kpi label="Negócios únicos" delta={s.uniqueBusinesses} />
        <Kpi label="Conversas com IA" delta={s.aiConversations} />
        <Kpi label="Execuções do agente" delta={s.agentRuns} />
      </div>

      <Card title="Atividade da equipe" subtitle={`Últimos ${insights.period.days} dias`}>
        <ActivityChart
          data={insights.series}
          series={[
            { key: 'unlocks', label: 'Desbloqueios', color: CHART_COLORS.orange },
            { key: 'leads', label: 'Leads', color: CHART_COLORS.blue },
            { key: 'aiMessages', label: 'Mensagens IA', color: CHART_COLORS.violet },
            { key: 'searches', label: 'Buscas', color: CHART_COLORS.amber },
          ]}
        />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Funil do pipeline" subtitle="Porcentagem = passagem da etapa anterior">
          <Funnel stages={stages} />
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-3 text-center">
            <Mini label="Leads" value={insights.totals.leads} />
            <Mini label="Sem site" value={insights.totals.withoutSite} />
            <Mini label="Parados +7d" value={insights.totals.stalled} warn={insights.totals.stalled > 0} />
          </div>
        </Card>
        <Card title="Segmentos que mais rendem" subtitle="Leads por categoria · fechados à direita">
          <BarList
            items={insights.categories.map((c) => ({ label: c.name, value: c.count, sub: c.won ? `${c.won} fechado${c.won > 1 ? 's' : ''}` : undefined }))}
            empty="Ainda sem leads nesse período."
          />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Pesquisas mais feitas"><BarList items={insights.topSearches.map((t) => ({ label: t.term, value: t.count }))} color={CHART_COLORS.amber} /></Card>
        <Card title="Regiões mais exploradas"><BarList items={insights.topLocations.map((t) => ({ label: t.term, value: t.count }))} color={CHART_COLORS.blue} /></Card>
        <Card title="Ritmo da semana" subtitle="Dia mais forte em laranja"><WeekdayBars values={insights.weekday} /></Card>
      </div>

      <Card title="Desempenho por pessoa" subtitle="Somente contagens — mensagens de IA e favoritos são pessoais">
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[11px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-stone-600">
                <th className="px-1 pb-2 font-medium">Pessoa</th>
                <th className="px-1 pb-2 text-right font-medium">Desbloqueios</th>
                <th className="px-1 pb-2 text-right font-medium">Buscas</th>
                <th className="px-1 pb-2 text-right font-medium">Leads</th>
                <th className="px-1 pb-2 text-right font-medium">Msgs IA</th>
                <th className="px-1 pb-2 text-right font-medium">Sites</th>
                <th className="px-1 pb-2 text-right font-medium">Atividade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {insights.members.map((m) => (
                <tr key={m.uid} className="text-stone-300">
                  <td className="px-1 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={m.name} photo={m.photoUrl} />
                      <div className="min-w-0">
                        <p className="flex items-center gap-1 truncate font-medium text-white">{m.name}{m.role === 'owner' && <Crown className="h-3 w-3 text-amber-400" />}{m.role === 'admin' && <span className="rounded-full bg-sky-400/10 px-1.5 py-0.5 text-[9px] font-semibold text-sky-300">Admin</span>}</p>
                        <p className="truncate text-[10px] text-stone-600">{m.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-1 py-2.5 text-right tabular-nums">{m.unlocks}</td>
                  <td className="px-1 py-2.5 text-right tabular-nums">{m.searches}</td>
                  <td className="px-1 py-2.5 text-right tabular-nums">{m.newLeads}</td>
                  <td className="px-1 py-2.5 text-right tabular-nums">{m.aiMessages}</td>
                  <td className="px-1 py-2.5 text-right tabular-nums">{m.demoSites}</td>
                  <td className="px-1 py-2.5 text-right text-stone-500">{ago(m.lastActivityAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {insights.pipelineMode === 'shared' && (
        <Card title="Últimos leads do pipeline compartilhado">
          {insights.recentLeads.length === 0 ? (
            <p className="py-4 text-center text-[11px] text-stone-600">Nenhum lead ainda.</p>
          ) : (
            <ul className="divide-y divide-white/[0.05]">
              {insights.recentLeads.map((l, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-[11px]">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">{l.name}</p>
                    <p className="truncate text-[10px] text-stone-600">{l.category || 'Sem categoria'} · por {l.by}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-stone-300">{STATUS_PT[l.status] || l.status}</span>
                    <p className="mt-0.5 text-[10px] text-stone-600">{ago(l.updatedAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}

function Mini({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div>
      <p className={`text-lg font-semibold tabular-nums ${warn ? 'text-amber-300' : 'text-white'}`}>{num(value)}</p>
      <p className="text-[10px] text-stone-600">{label}</p>
    </div>
  );
}

/* ─────────────── Usage ─────────────── */

function UsageSection({ insights, overview, loading, error }: { insights: WorkspaceInsights | null; overview: TeamOverview; loading: boolean; error: string }) {
  if (error && !insights) return <p className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.06] p-4 text-[12px] text-rose-200">{error}</p>;
  if (!insights) return <div className="space-y-3"><Skeleton h={140} /><Skeleton h={140} /></div>;
  const seats = overview.seats;
  return (
    <div className={`space-y-4 ${loading ? 'opacity-60' : ''}`}>
      <div className="grid gap-3 md:grid-cols-2">
        {insights.limits.map((l) => {
          const unlimited = l.limit === null;
          const ratio = unlimited ? 0 : l.limit! > 0 ? l.used / l.limit! : 0;
          return (
            <article key={l.id} className="flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-[#111418] p-4">
              {unlimited ? (
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-400/10 text-lg text-emerald-300">∞</span>
              ) : (
                <div className="relative"><Ring value={ratio} /><span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-stone-300">{Math.round(ratio * 100)}%</span></div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold text-white">{l.label}</p>
                <p className="mt-0.5 text-[12px] tabular-nums text-stone-300">
                  {num(l.used)}{unlimited ? ` ${l.unit}` : ` de ${num(l.limit!)} ${l.unit}`}
                </p>
                <p className="mt-0.5 text-[10px] leading-snug text-stone-600">{l.note}</p>
              </div>
            </article>
          );
        })}
      </div>

      <Card title="Assentos" subtitle={`${seats.included} incluídos no Agency${seats.extra ? ` + ${seats.extra} extra${seats.extra > 1 ? 's' : ''}` : ''}`}>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full bg-[#FF5A12]" style={{ width: `${Math.min(100, ((seats.members + seats.pendingInvites) / Math.max(1, seats.capacity)) * 100)}%` }} />
            </div>
            <p className="mt-2 text-[11px] text-stone-500">
              {seats.members} ativos · {seats.pendingInvites} convites pendentes · {seats.available} livres de {seats.capacity}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-stone-600">Extras no mês</p>
            <p className="text-sm font-semibold text-white">{brl(seats.extra * seats.extraSeatPrice)}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ─────────────── Team ─────────────── */

function TeamSection({ overview, reload, isOwner, onLeft }: { overview: TeamOverview; reload: () => Promise<void>; isOwner: boolean; onLeft?: () => void }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [link, setLink] = useState<{ url: string; emailed: boolean; email: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const seats = overview.seats;
  const mode = overview.workspace.pipelineMode;

  const run = useCallback(async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setMessage(null);
    try { await fn(); await reload(); }
    catch (e: any) { setMessage({ tone: 'err', text: e?.message || 'Não foi possível concluir.' }); }
    finally { setBusy(null); }
  }, [reload]);

  const copy = async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1800); } catch { /* ignore */ }
  };

  const invite = (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!value) return;
    void run('invite', async () => {
      const res = await inviteTeamMember(value);
      setLink({ url: res.link, emailed: res.emailed, email: value });
      setEmail('');
    });
  };

  const extraPrice = brl(seats.extraSeatPrice);

  return (
    <div className="space-y-4">
      {message && (
        <p className={`rounded-xl border px-4 py-2.5 text-[12px] ${message.tone === 'err' ? 'border-rose-500/20 bg-rose-500/[0.06] text-rose-200' : 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-200'}`}>{message.text}</p>
      )}

      <Card title="Como o pipeline funciona" subtitle="Você decide. Mensagens de IA e favoritos são sempre pessoais.">
        <div className="grid gap-3 sm:grid-cols-2">
          {([
            ['individual', 'Individual', 'Cada pessoa tem o seu próprio pipeline. Você acompanha só os números.'],
            ['shared', 'Compartilhado', 'Todos veem os mesmos leads e quem trabalha em cada um. Evita abordar o mesmo cliente duas vezes.'],
          ] as Array<[PipelineMode, string, string]>).map(([id, label, text]) => (
            <button
              key={id}
              type="button"
              disabled={busy === 'mode'}
              onClick={() => mode !== id && void run('mode', async () => { await setPipelineMode(id); })}
              className={`rounded-xl border p-4 text-left transition ${mode === id ? 'border-[#FF5A12]/50 bg-[#FF5A12]/[0.07]' : 'border-white/[0.07] hover:border-white/[0.16]'}`}
            >
              <span className="flex items-center justify-between text-[12px] font-semibold text-white">
                {label}{mode === id && <Check className="h-4 w-4 text-[#FF5A12]" />}
              </span>
              <span className="mt-1 block text-[11px] leading-relaxed text-stone-500">{text}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card
        title="Convidar pessoa"
        subtitle={`${seats.available} ${seats.available === 1 ? 'assento livre' : 'assentos livres'} de ${seats.capacity}`}
      >
        <form onSubmit={invite} className="flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@da-pessoa.com"
            disabled={seats.available <= 0}
            className="min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-black/30 px-3.5 py-2.5 text-[12px] text-white outline-none placeholder:text-stone-600 focus:border-[#FF5A12]/50 disabled:opacity-50"
          />
          <button type="submit" disabled={busy === 'invite' || !email.trim() || seats.available <= 0} className="flex items-center justify-center gap-2 rounded-xl bg-[#FF5A12] px-5 py-2.5 text-[12px] font-semibold text-white transition hover:brightness-110 disabled:opacity-40">
            {busy === 'invite' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}Enviar convite
          </button>
        </form>
        {seats.available <= 0 && <p className="mt-2 text-[11px] text-amber-300">Todos os assentos estão ocupados. Adicione assentos extras abaixo para convidar mais gente.</p>}
        {link && (
          <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-3">
            <p className="text-[11px] text-emerald-200">
              {link.emailed ? `Convite enviado para ${link.email}.` : `Convite criado para ${link.email}. O e-mail não foi enviado automaticamente — compartilhe o link:`}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-black/40 px-2.5 py-1.5 text-[10px] text-stone-300">{link.url}</code>
              <button type="button" onClick={() => void copy(link.url, 'new')} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.10] px-2.5 py-1.5 text-[11px] text-stone-200 hover:bg-white/[0.05]">
                {copied === 'new' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}{copied === 'new' ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <p className="mt-2 text-[10px] text-stone-600">O link vale 7 dias e só funciona para o e-mail convidado.</p>
          </div>
        )}
      </Card>

      <Card title="Pessoas" subtitle={`${overview.members.length} no workspace`}>
        <ul className="divide-y divide-white/[0.05]">
          {overview.members.map((m) => (
            <li key={m.uid} className="flex items-center gap-3 py-3">
              <Avatar name={m.name} photo={m.photoUrl} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-[12px] font-medium text-white">
                  {m.name}
                  {m.role === 'owner' && <span className="flex items-center gap-1 rounded-full bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-300"><Crown className="h-2.5 w-2.5" />Dono</span>}
                  {m.role === 'admin' && <span className="flex items-center gap-1 rounded-full bg-sky-400/10 px-1.5 py-0.5 text-[9px] font-semibold text-sky-300"><ShieldCheck className="h-2.5 w-2.5" />Admin</span>}
                </p>
                <p className="truncate text-[10px] text-stone-600">{m.email} · visto {ago(m.lastSeenAt)}</p>
              </div>
              {m.role !== 'owner' && isOwner && (
                <button
                  type="button"
                  disabled={busy === `ad-${m.uid}`}
                  onClick={() => void run(`ad-${m.uid}`, async () => { await setMemberAdmin(m.uid, m.role !== 'admin'); })}
                  className="flex items-center gap-1.5 rounded-lg border border-white/[0.10] px-2.5 py-1.5 text-[11px] text-stone-200 hover:bg-white/[0.05] disabled:opacity-50"
                >
                  {busy === `ad-${m.uid}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                  {m.role === 'admin' ? 'Remover admin' : 'Tornar admin'}
                </button>
              )}
              {m.role !== 'owner' && (isOwner || m.role === 'member') && (
                removing === m.uid ? (
                  <div className="flex flex-wrap items-center justify-end gap-1.5 text-[10px]">
                    <button type="button" disabled={busy === `rm-${m.uid}`} onClick={() => void run(`rm-${m.uid}`, async () => { await removeTeamMember(m.uid, true); setRemoving(null); })} className="rounded-lg bg-rose-500/90 px-2.5 py-1.5 font-semibold text-white">Remover e manter leads</button>
                    <button type="button" disabled={busy === `rm-${m.uid}`} onClick={() => void run(`rm-${m.uid}`, async () => { await removeTeamMember(m.uid, false); setRemoving(null); })} className="rounded-lg border border-white/[0.12] px-2.5 py-1.5 text-stone-300">Remover sem leads</button>
                    <button type="button" onClick={() => setRemoving(null)} className="p-1.5 text-stone-500 hover:text-white"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setRemoving(m.uid)} title="Remover da equipe" className="rounded-lg p-2 text-stone-600 transition hover:bg-white/[0.05] hover:text-rose-400"><Trash2 className="h-4 w-4" /></button>
                )
              )}
            </li>
          ))}
        </ul>
      </Card>

      {overview.invites.length > 0 && (
        <Card title="Convites pendentes">
          <ul className="divide-y divide-white/[0.05]">
            {overview.invites.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.05] text-stone-500"><Mail className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-medium text-white">{inv.email}</p>
                  <p className="text-[10px] text-stone-600">expira em {new Date(inv.expiresAt).toLocaleDateString('pt-BR')}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button type="button" disabled={busy === `rn-${inv.id}`} onClick={() => void run(`rn-${inv.id}`, async () => {
                    const res = await renewTeamInvite(inv.id);
                    setLink({ url: res.link, emailed: res.emailed, email: inv.email });
                  })} className="flex items-center gap-1.5 rounded-lg border border-white/[0.10] px-2.5 py-1.5 text-[11px] text-stone-200 hover:bg-white/[0.05]">
                    {busy === `rn-${inv.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}Novo link
                  </button>
                  <button type="button" disabled={busy === `rv-${inv.id}`} onClick={() => void run(`rv-${inv.id}`, async () => { await revokeTeamInvite(inv.id); })} className="rounded-lg p-2 text-stone-600 hover:bg-white/[0.05] hover:text-rose-400" title="Cancelar convite"><X className="h-4 w-4" /></button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {isOwner ? (
      <Card title="Assentos extras" subtitle={`O Agency inclui ${seats.included} usuários. Cada adicional custa ${extraPrice}/mês, cobrado na mesma assinatura.`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button type="button" disabled={busy === 'seats' || seats.extra <= 0} onClick={() => void run('seats', async () => { await setExtraSeats(seats.extra - 1); })} className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.10] text-stone-200 hover:bg-white/[0.05] disabled:opacity-30"><Minus className="h-4 w-4" /></button>
              <div className="w-16 text-center">
                <p className="text-xl font-semibold tabular-nums text-white">{busy === 'seats' ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : seats.extra}</p>
                <p className="text-[10px] text-stone-600">extras</p>
              </div>
              <button type="button" disabled={busy === 'seats'} onClick={() => void run('seats', async () => { await setExtraSeats(seats.extra + 1); })} className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.10] text-stone-200 hover:bg-white/[0.05] disabled:opacity-30"><Plus className="h-4 w-4" /></button>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-white">{brl(seats.extra * seats.extraSeatPrice)}<span className="text-[11px] font-normal text-stone-500"> /mês</span></p>
              <p className="text-[10px] text-stone-600">Ajuste proporcional ao ciclo atual</p>
            </div>
          </div>
          {!seats.seatBillingConfigured && <p className="mt-3 text-[11px] text-stone-500">A cobrança de assentos extras ainda não foi habilitada nesta conta.</p>}
        </Card>
      ) : (
        <Card title="Assentos extras"><p className="text-[11px] text-stone-500">Apenas o dono do workspace altera assentos, cobrança e administradores.</p></Card>
      )}
      {!isOwner && <LeaveCard onLeft={onLeft} />}
    </div>
  );
}

/* ─────────────── Member ─────────────── */

function MemberView({ overview, onLeft }: { overview: TeamOverview; onLeft?: () => void }) {
  const shared = overview.workspace.pipelineMode === 'shared';
  const owner = useMemo(() => overview.members.find((m) => m.role === 'owner'), [overview.members]);

  return (
    <div className="space-y-4">
      <Card title="Sua equipe">
        <ul className="divide-y divide-white/[0.05]">
          {overview.members.map((m) => (
            <li key={m.uid} className="flex items-center gap-3 py-2.5">
              <Avatar name={m.name} photo={m.photoUrl} />
              <p className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-[12px] font-medium text-white">
                {m.name}{m.uid === owner?.uid && <Crown className="h-3 w-3 text-amber-400" />}
              </p>
              <span className="text-[10px] text-stone-600">visto {ago(m.lastSeenAt)}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Como funciona para você">
        <ul className="space-y-2 text-[11px] leading-relaxed text-stone-400">
          <li className="flex gap-2"><RefreshCw className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-600" />
            {shared ? 'O pipeline é compartilhado: você vê os leads de todos e quem está trabalhando em cada um.' : 'O pipeline é individual: apenas você vê seus leads.'}</li>
          <li className="flex gap-2"><Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-600" />Suas mensagens de IA e favoritos são pessoais. O dono vê apenas contagens de uso, nunca o conteúdo.</li>
          <li className="flex gap-2"><Crown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-600" />Você usa os recursos do plano Agency de {overview.ownerName}.</li>
        </ul>
      </Card>
      <LeaveCard onLeft={onLeft} />
    </div>
  );
}

function LeaveCard({ onLeft }: { onLeft?: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const leave = async () => {
    setBusy(true);
    setError('');
    try { await leaveTeam(); onLeft?.(); }
    catch (e: any) { setError(e?.message || 'Não foi possível sair da equipe.'); setBusy(false); }
  };
  return (
    <Card title="Sair da equipe" subtitle="Seus leads voltam para o seu workspace pessoal e você volta a gerenciar seu próprio plano.">
      {error && <p className="mb-3 text-[11px] text-rose-300">{error}</p>}
      {confirm ? (
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void leave()} disabled={busy} className="flex items-center gap-2 rounded-xl bg-rose-500/90 px-4 py-2.5 text-[12px] font-semibold text-white">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Confirmar saída</button>
          <button type="button" onClick={() => setConfirm(false)} className="px-3 py-2.5 text-[12px] text-stone-400">Cancelar</button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirm(true)} className="flex items-center gap-2 rounded-xl border border-white/[0.10] px-4 py-2.5 text-[12px] text-stone-200 hover:bg-white/[0.05]"><LogOut className="h-4 w-4" />Sair da equipe</button>
      )}
    </Card>
  );
}
