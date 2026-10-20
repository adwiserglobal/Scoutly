import { appDataRequest, dbValue } from './appDataService.js';
import { getSubscriptionAccess } from './subscriptionAccessService.js';
import { EXTRA_SEAT_PRICE_BRL, getTeamContext, INCLUDED_AGENCY_SEATS, listTeamMembers } from './teamService.js';

/**
 * Data behind the owner's "Workspace" page. Everything is aggregated from what the app already stores:
 * credit/usage ledger rows, leads, favorites (counts only), AI messages (counts only), demo sites, agent runs.
 * Personal content (AI message text, favorites list) is never returned.
 */

const UNLOCK_QUERY = '__scoutly_credit_business_unlock__';
const AI_QUERY = '__scoutly_credit_ai_conversation__';
const DAY_MS = 24 * 60 * 60 * 1000;
const STALLED_DAYS = 7;
const ROW_LIMIT = 8000;
const STAGES = ['NOVO', 'CONTATADO', 'EM_NEGOCIACAO', 'FECHADO', 'PERDIDO'] as const;
const DEMO_MONTHLY_LIMIT_PER_USER = 150;

function httpError(message: string, statusCode: number, code: string): never {
  throw Object.assign(new Error(message), { statusCode, code });
}

const dayKey = (date: Date | string) => new Date(date).toISOString().slice(0, 10);

interface Delta { value: number; previous: number; change: number | null }
const delta = (value: number, previous: number): Delta => ({
  value, previous, change: previous > 0 ? Math.round(((value - previous) / previous) * 100) : null,
});

export interface Insight { id: string; tone: 'good' | 'warn' | 'info'; title: string; text: string }

export async function getWorkspaceInsights(ownerUid: string, daysInput: unknown) {
  const context = await getTeamContext(ownerUid);
  if (!context || context.role !== 'owner') httpError('Só o dono do workspace pode ver esta página.', 403, 'TEAM_FORBIDDEN');
  const access = await getSubscriptionAccess(ownerUid);
  if (access.plan !== 'agency' || !access.hasAccess) httpError('O Workspace é um recurso do plano Agency.', 402, 'TEAM_REQUIRES_AGENCY');

  const days = [7, 30, 90].includes(Number(daysInput)) ? Number(daysInput) : 30;
  const now = new Date();
  const start = new Date(now.getTime() - days * DAY_MS);
  const prevStart = new Date(now.getTime() - 2 * days * DAY_MS);
  const W = dbValue(context.workspaceId);
  const since = dbValue(prevStart.toISOString());

  const members = await listTeamMembers({ id: context.workspaceId, ownerUid: context.ownerUid });
  const uids = members.map((member) => member.uid);
  const uidList = uids.map((uid) => dbValue(uid)).join(',');

  const [events, messages, leads, favorites, demos, runs] = await Promise.all([
    appDataRequest<Array<{ user_uid: string; event_type: string; query: string | null; location: string | null; business_id: string | null; created_at: string }>>(
      `recommendation_events?workspace_id=eq.${W}&created_at=gte.${since}&select=user_uid,event_type,query,location,business_id,created_at&order=created_at.desc&limit=${ROW_LIMIT}`
    ).catch(() => []),
    appDataRequest<Array<{ user_uid: string; created_at: string }>>(
      `generated_messages?workspace_id=eq.${W}&created_at=gte.${since}&select=user_uid,created_at&limit=${ROW_LIMIT}`
    ).catch(() => []),
    appDataRequest<Array<{ user_uid: string; business_id: string; status: string; created_at: string; updated_at: string; category: string | null; website: string | null; name: string | null }>>(
      `user_leads?workspace_id=eq.${W}&select=user_uid,business_id,status,created_at,updated_at,category:business_snapshot->>category,website:business_snapshot->>website,name:business_snapshot->>name&limit=${ROW_LIMIT}`
    ).catch(() => []),
    appDataRequest<Array<{ user_uid: string; created_at: string }>>(
      `favorites?workspace_id=eq.${W}&select=user_uid,created_at&limit=${ROW_LIMIT}`
    ).catch(() => []),
    uidList
      ? appDataRequest<Array<{ user_uid: string; created_at: string; views: number }>>(
          `demo_sites?user_uid=in.(${uidList})&select=user_uid,created_at,views&limit=3000`
        ).catch(() => [])
      : Promise.resolve([]),
    appDataRequest<Array<{ user_uid: string; created_at: string; status: string; found_count: number | null; saved_count: number | null }>>(
      `agent_runs?workspace_id=eq.${W}&created_at=gte.${since}&select=user_uid,created_at,status,found_count,saved_count&limit=2000`
    ).catch(() => []),
  ]);

  const inPeriod = (iso: string) => new Date(iso).getTime() >= start.getTime();
  const isUnlock = (event: { query: string | null }) => event.query === UNLOCK_QUERY;
  const isAi = (event: { query: string | null }) => event.query === AI_QUERY;
  const isSearch = (event: { event_type: string; query: string | null }) => event.event_type === 'search' && !String(event.query || '').startsWith('__scoutly_credit_');

  const unlocks = events.filter(isUnlock);
  const aiConversations = events.filter(isAi);
  const searches = events.filter(isSearch);

  const split = <T extends { created_at: string }>(rows: T[]) => ({ now: rows.filter((row) => inPeriod(row.created_at)), prev: rows.filter((row) => !inPeriod(row.created_at)) });
  const u = split(unlocks), a = split(aiConversations), s = split(searches), m = split(messages), r = split(runs);
  const newLeads = split(leads.map((lead) => ({ ...lead, created_at: lead.created_at })));
  const newFavs = split(favorites);
  const wonLeads = leads.filter((lead) => lead.status === 'FECHADO');
  const wonNow = wonLeads.filter((lead) => inPeriod(lead.updated_at)).length;
  const wonPrev = wonLeads.filter((lead) => !inPeriod(lead.updated_at) && new Date(lead.updated_at).getTime() >= prevStart.getTime()).length;

  const summary = {
    unlocks: delta(u.now.length, u.prev.length),
    uniqueBusinesses: delta(new Set(u.now.map((e) => e.business_id)).size, new Set(u.prev.map((e) => e.business_id)).size),
    newLeads: delta(newLeads.now.length, newLeads.prev.length),
    won: delta(wonNow, wonPrev),
    aiMessages: delta(m.now.length, m.prev.length),
    aiConversations: delta(a.now.length, a.prev.length),
    searches: delta(s.now.length, s.prev.length),
    favorites: delta(newFavs.now.length, newFavs.prev.length),
    agentRuns: delta(r.now.length, r.prev.length),
  };

  // Daily series for the chart
  const series: Array<{ date: string; unlocks: number; leads: number; aiMessages: number; searches: number }> = [];
  const index = new Map<string, number>();
  for (let i = days - 1; i >= 0; i -= 1) {
    const key = dayKey(new Date(now.getTime() - i * DAY_MS));
    index.set(key, series.length);
    series.push({ date: key, unlocks: 0, leads: 0, aiMessages: 0, searches: 0 });
  }
  const bump = (iso: string, field: 'unlocks' | 'leads' | 'aiMessages' | 'searches') => {
    const at = index.get(dayKey(iso));
    if (at !== undefined) series[at][field] += 1;
  };
  u.now.forEach((e) => bump(e.created_at, 'unlocks'));
  newLeads.now.forEach((e) => bump(e.created_at, 'leads'));
  m.now.forEach((e) => bump(e.created_at, 'aiMessages'));
  s.now.forEach((e) => bump(e.created_at, 'searches'));

  // Funnel (current state of every lead)
  const funnel: Record<string, number> = Object.fromEntries(STAGES.map((stage) => [stage, 0]));
  for (const lead of leads) if (lead.status in funnel) funnel[lead.status] += 1;

  // Segments
  const byCategory = new Map<string, { count: number; won: number }>();
  for (const lead of leads) {
    const name = (lead.category || 'Sem categoria').trim() || 'Sem categoria';
    const entry = byCategory.get(name) || { count: 0, won: 0 };
    entry.count += 1;
    if (lead.status === 'FECHADO') entry.won += 1;
    byCategory.set(name, entry);
  }
  const categories = [...byCategory.entries()]
    .map(([name, value]) => ({ name, ...value }))
    .sort((x, y) => y.count - x.count)
    .slice(0, 6);

  // Per member
  const countBy = <T extends { user_uid: string }>(rows: T[]) => {
    const map = new Map<string, number>();
    rows.forEach((row) => map.set(row.user_uid, (map.get(row.user_uid) || 0) + 1));
    return map;
  };
  const mUnlocks = countBy(u.now), mAiConv = countBy(a.now), mMsgs = countBy(m.now), mSearches = countBy(s.now);
  const mLeads = countBy(newLeads.now), mFavs = countBy(newFavs.now), mDemos = countBy(demos.filter((d) => inPeriod(d.created_at)));
  const lastActivity = new Map<string, string>();
  for (const event of events) if (!lastActivity.has(event.user_uid)) lastActivity.set(event.user_uid, event.created_at);
  const perMember = members.map((member) => ({
    uid: member.uid, name: member.name, email: member.email, photoUrl: member.photoUrl, role: member.role,
    lastSeenAt: member.lastSeenAt, lastActivityAt: lastActivity.get(member.uid) || null,
    unlocks: mUnlocks.get(member.uid) || 0,
    aiConversations: mAiConv.get(member.uid) || 0,
    aiMessages: mMsgs.get(member.uid) || 0,
    searches: mSearches.get(member.uid) || 0,
    newLeads: mLeads.get(member.uid) || 0,
    favorites: mFavs.get(member.uid) || 0,
    demoSites: mDemos.get(member.uid) || 0,
  }));

  // Searches (aggregated, never tied to a person)
  const tally = (values: Array<string | null>, limit: number) => {
    const map = new Map<string, number>();
    for (const value of values) {
      const key = String(value || '').trim().toLowerCase();
      if (key.length >= 3) map.set(key, (map.get(key) || 0) + 1);
    }
    return [...map.entries()].sort((x, y) => y[1] - x[1]).slice(0, limit).map(([term, count]) => ({ term, count }));
  };
  const topSearches = tally(s.now.map((e) => e.query), 8);
  const topLocations = tally(s.now.map((e) => e.location), 5);

  // Weekday rhythm
  const weekday = Array.from({ length: 7 }, () => 0);
  u.now.forEach((event) => { weekday[new Date(event.created_at).getUTCDay()] += 1; });

  // Insights
  const insights: Insight[] = [];
  const worked = leads.filter((lead) => lead.status !== 'NOVO' && lead.status !== 'ARQUIVADO');
  const closable = leads.filter((lead) => ['CONTATADO', 'EM_NEGOCIACAO', 'FECHADO', 'PERDIDO'].includes(lead.status));
  if (closable.length >= 5) {
    const rate = Math.round((funnel.FECHADO / closable.length) * 100);
    insights.push({
      id: 'close-rate', tone: rate >= 15 ? 'good' : 'info', title: `Taxa de fechamento de ${rate}%`,
      text: `${funnel.FECHADO} de ${closable.length} leads trabalhados viraram cliente. ${rate >= 15 ? 'Bom ritmo: replique o que está funcionando.' : 'Acompanhe de perto as negociações em andamento para elevar esse número.'}`,
    });
  }
  const stalled = leads.filter((lead) => (lead.status === 'CONTATADO' || lead.status === 'EM_NEGOCIACAO') && now.getTime() - new Date(lead.updated_at).getTime() > STALLED_DAYS * DAY_MS).length;
  if (stalled > 0) {
    insights.push({ id: 'stalled', tone: 'warn', title: `${stalled} ${stalled === 1 ? 'lead parado' : 'leads parados'} há mais de ${STALLED_DAYS} dias`, text: 'Contatos sem movimentação esfriam rápido. Combine um follow-up com a equipe nesta semana.' });
  }
  const bestSegment = categories.find((category) => category.won > 0) ? [...categories].sort((x, y) => y.won - x.won)[0] : null;
  if (bestSegment && bestSegment.won > 0) {
    insights.push({ id: 'best-segment', tone: 'good', title: `${bestSegment.name} é o segmento que mais converte`, text: `${bestSegment.won} ${bestSegment.won === 1 ? 'cliente fechado' : 'clientes fechados'} entre ${bestSegment.count} leads desse segmento. Vale priorizar buscas parecidas.` });
  } else if (categories[0]) {
    insights.push({ id: 'top-segment', tone: 'info', title: `${categories[0].name} concentra seus leads`, text: `${categories[0].count} leads estão nesse segmento. Se ele não é o foco, diversifique as buscas.` });
  }
  const withoutSite = leads.filter((lead) => !lead.website).length;
  if (leads.length >= 5) {
    const share = Math.round((withoutSite / leads.length) * 100);
    if (share >= 25) insights.push({ id: 'no-site', tone: 'good', title: `${share}% dos leads não têm site`, text: 'É o melhor gancho para vender sites e presença digital. Use o site de demonstração na abordagem.' });
  }
  if (summary.unlocks.change !== null && Math.abs(summary.unlocks.change) >= 15 && summary.unlocks.previous >= 5) {
    const up = summary.unlocks.change > 0;
    insights.push({ id: 'trend', tone: up ? 'good' : 'warn', title: `Prospecção ${up ? 'subiu' : 'caiu'} ${Math.abs(summary.unlocks.change)}%`, text: `${summary.unlocks.value} empresas abertas contra ${summary.unlocks.previous} no período anterior.` });
  }
  const totalWeekday = weekday.reduce((x, y) => x + y, 0);
  if (totalWeekday >= 15) {
    const names = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
    const best = weekday.indexOf(Math.max(...weekday));
    insights.push({ id: 'weekday', tone: 'info', title: `A equipe prospecta mais na ${names[best]}`.replace('na domingo', 'no domingo').replace('na sábado', 'no sábado'), text: `${Math.round((weekday[best] / totalWeekday) * 100)}% das aberturas de empresas acontecem nesse dia.` });
  }
  const idle = perMember.filter((member) => member.role === 'member' && member.unlocks + member.aiConversations + member.searches + member.newLeads === 0);
  if (idle.length > 0) {
    insights.push({ id: 'idle', tone: 'warn', title: `${idle.length} ${idle.length === 1 ? 'membro sem atividade' : 'membros sem atividade'} no período`, text: `${idle.map((member) => member.name).slice(0, 3).join(', ')}${idle.length > 3 ? ' e mais' : ''}. Vale conferir se precisam de ajuda para começar.` });
  }
  const seatCapacity = INCLUDED_AGENCY_SEATS + context.extraSeats;
  if (members.length >= seatCapacity) {
    insights.push({ id: 'seats-full', tone: 'info', title: 'Todos os assentos estão em uso', text: `Sua equipe usa ${members.length} de ${seatCapacity} assentos. Adicione um assento por R$ ${EXTRA_SEAT_PRICE_BRL.toFixed(2).replace('.', ',')} por mês para convidar mais alguém.` });
  }
  if (insights.length === 0) {
    insights.push({ id: 'start', tone: 'info', title: 'Seus insights aparecem com o uso', text: 'Abra empresas, salve leads e use a IA. Em poucos dias esta página mostra tendências e oportunidades da sua equipe.' });
  }

  // Limits and credit tracking
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).getTime();
  const demosThisMonth = demos.filter((demo) => new Date(demo.created_at).getTime() >= monthStart).length;
  const demoViews = demos.reduce((sum, demo) => sum + Number(demo.views || 0), 0);
  const limits = [
    { id: 'seats', label: 'Assentos da equipe', used: members.length, limit: seatCapacity, unit: 'pessoas', note: `${INCLUDED_AGENCY_SEATS} incluídos${context.extraSeats ? ` + ${context.extraSeats} adicionais` : ''}` },
    { id: 'credits', label: 'Créditos de prospecção', used: summary.unlocks.value, limit: null as number | null, unit: 'empresas abertas', note: 'Ilimitados no Agency' },
    { id: 'ai', label: 'Conversas com a Scoutly AI', used: summary.aiConversations.value, limit: null as number | null, unit: 'conversas', note: 'Sem limite diário' },
    { id: 'demos', label: 'Sites de demonstração no mês', used: demosThisMonth, limit: DEMO_MONTHLY_LIMIT_PER_USER * members.length, unit: 'sites', note: `${DEMO_MONTHLY_LIMIT_PER_USER} por pessoa` },
    { id: 'agentic', label: 'Buscas do Agentic', used: summary.agentRuns.value, limit: null as number | null, unit: 'buscas', note: 'Até 300 empresas por busca, 5 simultâneas' },
    { id: 'flight', label: 'Modo voo', used: 0, limit: null as number | null, unit: '', note: 'Ilimitado' },
  ];

  const recentLeads = context.pipelineMode === 'shared'
    ? [...leads].sort((x, y) => new Date(y.updated_at).getTime() - new Date(x.updated_at).getTime()).slice(0, 8).map((lead) => ({
        name: lead.name || 'Empresa', status: lead.status, category: lead.category, updatedAt: lead.updated_at,
        by: members.find((member) => member.uid === lead.user_uid)?.name || '',
      }))
    : [];

  return {
    period: { days, start: start.toISOString(), end: now.toISOString() },
    pipelineMode: context.pipelineMode,
    summary,
    series,
    funnel,
    totals: { leads: leads.length, worked: worked.length, withoutSite, stalled, demoViews, demoSites: demos.length },
    categories,
    members: perMember,
    topSearches,
    topLocations,
    weekday,
    insights,
    limits,
    recentLeads,
  };
}
