import { randomUUID } from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { appDataRequest, dbValue, ensureAppUser } from './appDataService.js';
import type { FirebaseIdentity } from './firebaseTokenService.js';
import { searchBusinessesAdaptive } from './adaptiveBusinessSearchService.js';
import { enrichBusinessWebsite } from './enrichService.js';
import type { BusinessSummary } from './aiService.js';

export type AgentRunStatus =
  | 'queued'
  | 'planning'
  | 'searching'
  | 'qualifying'
  | 'saving'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface AgentRunRecord {
  id: string;
  user_uid: string;
  workspace_id: string | null;
  objective: string;
  current_region_name: string;
  status: AgentRunStatus;
  stage: string;
  target_count: number;
  found_count: number;
  processed_count: number;
  qualified_count: number;
  saved_count: number;
  progress: number;
  priority: number;
  current_message: string;
  plan: AgentPlan | Record<string, never>;
  result_summary: Record<string, any>;
  error: string | null;
  attempts: number;
  worker_id: string | null;
  lock_token: string | null;
  locked_until: string | null;
  next_attempt_at: string;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentPlan {
  searchQuery: string;
  businessTypeHint: string;
  regionName: string;
  targetCount: number;
  filters: {
    noWebsite: boolean;
    hasWebsite: boolean;
    hasPhone: boolean;
    noSocial: boolean;
  };
  enrichWebsites: boolean;
  qualificationFocus: 'website_opportunity' | 'contactability' | 'general';
  strategy: string[];
}

export interface AgentRunDetail extends AgentRunRecord {
  steps: any[];
  leads: any[];
  events: any[];
}

const ACTIVE_STATUSES = ['queued', 'planning', 'searching', 'qualifying', 'saving'];

const PLAN_CAPS: Record<string, { maxTarget: number; concurrent: number; priority: number }> = {
  trial: { maxTarget: 50, concurrent: 1, priority: 5 },
  go: { maxTarget: 25, concurrent: 1, priority: 10 },
  pro: { maxTarget: 100, concurrent: 2, priority: 20 },
  agency: { maxTarget: 300, concurrent: 5, priority: 30 },
  expired: { maxTarget: 0, concurrent: 0, priority: 0 },
};

function normalizeText(value: string) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferTargetCount(objective: string, requested?: number | null) {
  if (Number.isFinite(requested) && Number(requested) > 0) return Math.floor(Number(requested));
  const match = objective.match(/\b(\d{1,3})\b/);
  if (match) return Math.max(1, Number(match[1]));
  return 25;
}

function extractJsonObject(raw: string): any | null {
  const trimmed = String(raw || '').trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidate = fenced || trimmed;
  const first = candidate.indexOf('{');
  const last = candidate.lastIndexOf('}');
  if (first < 0 || last <= first) return null;
  try {
    return JSON.parse(candidate.slice(first, last + 1));
  } catch {
    return null;
  }
}

async function callAgentModel(prompt: string, maxTokens = 700): Promise<{ text: string; model: string } | null> {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (openRouterKey) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openRouterKey}`,
          'HTTP-Referer': process.env.APP_URL || 'https://scoutly.pro',
          'X-Title': 'Scoutly Agentic',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openrouter/auto',
          temperature: 0.1,
          max_tokens: maxTokens,
          messages: [
            {
              role: 'system',
              content: 'Você é o planner operacional da Scoutly. Seja preciso, conservador e nunca invente empresas ou dados.',
            },
            { role: 'user', content: prompt },
          ],
        }),
        signal: AbortSignal.timeout(9000),
      });

      if (response.ok) {
        const data = await response.json();
        const text = String(data?.choices?.[0]?.message?.content || '').trim();
        if (text) return { text, model: 'openrouter/auto' };
      }
    } catch (error: any) {
      console.warn('[Scoutly Agentic] OpenRouter planner failed:', error?.message || error);
    }
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      const text = String(response.text || '').trim();
      if (text) return { text, model: 'gemini-2.5-flash' };
    } catch (error: any) {
      console.warn('[Scoutly Agentic] Gemini planner failed:', error?.message || error);
    }
  }

  return null;
}

function buildFallbackPlan(run: AgentRunRecord): AgentPlan {
  const text = normalizeText(run.objective);
  const noWebsite = /sem site|sem website|nao tem site|não tem site|site ruim|presenca digital fraca|presença digital fraca/.test(text);
  const hasWebsite = !noWebsite && /com site|com website/.test(text);
  const hasPhone = /com telefone|com whatsapp|whatsapp|telefone/.test(text);
  const noSocial = /sem instagram|sem rede social|sem redes sociais/.test(text);

  const qualificationFocus: AgentPlan['qualificationFocus'] = noWebsite || /vender site|website|presenca digital|presença digital/.test(text)
    ? 'website_opportunity'
    : hasPhone
      ? 'contactability'
      : 'general';

  return {
    searchQuery: run.objective,
    businessTypeHint: '',
    regionName: run.current_region_name,
    targetCount: run.target_count,
    filters: { noWebsite, hasWebsite, hasPhone, noSocial },
    enrichWebsites: !noWebsite,
    qualificationFocus,
    strategy: [
      'Buscar empresas reais na base canônica da Scoutly',
      'Expandir geografia automaticamente quando a consulta estiver ampla e os resultados forem escassos',
      'Deduplicar e ordenar candidatos por potencial comercial',
      'Enriquecer sites em lotes pequenos para proteger APIs e infraestrutura',
      'Salvar os melhores leads no pipeline do usuário',
    ],
  };
}

async function buildAgentPlan(run: AgentRunRecord): Promise<AgentPlan> {
  const fallback = buildFallbackPlan(run);
  const prompt = `Transforme o objetivo abaixo em um plano de busca local para a Scoutly.

OBJETIVO: ${run.objective}
REGIÃO ATUAL: ${run.current_region_name}
META FIXA DE RESULTADOS: ${run.target_count}

Retorne APENAS JSON válido com este formato:
{
  "searchQuery": "consulta curta que preserve nicho e localização explícita do usuário",
  "businessTypeHint": "segmento principal",
  "filters": {
    "noWebsite": false,
    "hasWebsite": false,
    "hasPhone": false,
    "noSocial": false
  },
  "qualificationFocus": "website_opportunity|contactability|general"
}

Regras: não altere a quantidade-alvo; não invente localização; se a localização não estiver explícita, deixe a consulta sem inventar bairro/cidade; remova apenas palavras de ação como encontre, procure, qualifique, crie lista.`;

  const model = await callAgentModel(prompt, 500);
  if (!model) return fallback;

  const parsed = extractJsonObject(model.text);
  if (!parsed || typeof parsed.searchQuery !== 'string' || !parsed.searchQuery.trim()) return fallback;

  const modelFilters = parsed.filters && typeof parsed.filters === 'object' ? parsed.filters : {};
  const focus = ['website_opportunity', 'contactability', 'general'].includes(parsed.qualificationFocus)
    ? parsed.qualificationFocus
    : fallback.qualificationFocus;

  return {
    ...fallback,
    searchQuery: parsed.searchQuery.trim(),
    businessTypeHint: typeof parsed.businessTypeHint === 'string' ? parsed.businessTypeHint.trim() : '',
    filters: {
      noWebsite: Boolean(modelFilters.noWebsite || fallback.filters.noWebsite),
      hasWebsite: Boolean(modelFilters.hasWebsite || fallback.filters.hasWebsite),
      hasPhone: Boolean(modelFilters.hasPhone || fallback.filters.hasPhone),
      noSocial: Boolean(modelFilters.noSocial || fallback.filters.noSocial),
    },
    qualificationFocus: focus,
  };
}

function businessToSnapshot(business: BusinessSummary) {
  const phone = business.phone || business.phones?.[0] || null;
  const email = business.emails?.[0] || null;
  return {
    ...business,
    latitude: business.lat,
    longitude: business.lng,
    coordinates: { lat: business.lat, lng: business.lng },
    websites: business.website ? [business.website] : [],
    email,
    emails: business.emails || [],
    phone,
    phones: business.phones || (phone ? [phone] : []),
    socials: business.socials || [],
    operatingStatus: null,
    source: business.sources?.[0] || 'Scoutly Agentic',
    sources: business.sources || ['scoutly'],
    leadStatus: 'NOVO',
    notes: '',
  };
}

function initialCandidateScore(snapshot: any, plan: AgentPlan) {
  let score = 25;
  const hasWebsite = Boolean(snapshot.website);
  const hasPhone = Boolean(snapshot.phone || snapshot.phones?.length);
  const hasEmail = Boolean(snapshot.email || snapshot.emails?.length);
  const hasSocial = Boolean(snapshot.socials?.length);

  if (!hasWebsite) score += plan.qualificationFocus === 'website_opportunity' ? 38 : 18;
  if (hasPhone) score += 20;
  if (hasEmail) score += 8;
  if (hasSocial) score += 4;
  score += Math.round(Math.max(0, Math.min(1, Number(snapshot.confidence || 0))) * 10);

  if (plan.filters.noWebsite) score += hasWebsite ? -60 : 40;
  if (plan.filters.hasWebsite) score += hasWebsite ? 25 : -60;
  if (plan.filters.hasPhone) score += hasPhone ? 25 : -60;
  if (plan.filters.noSocial) score += hasSocial ? -40 : 15;

  return Math.max(0, Math.min(100, score));
}

async function qualifyLead(snapshot: any, plan: AgentPlan) {
  const reasons: string[] = [];
  const hasWebsite = Boolean(snapshot.website);
  const hasPhone = Boolean(snapshot.phone || snapshot.phones?.length);
  const hasEmail = Boolean(snapshot.email || snapshot.emails?.length);
  const knownSocials = Array.isArray(snapshot.socials) ? snapshot.socials : [];

  if (plan.filters.noWebsite && hasWebsite) {
    return { qualified: false, score: 0, reasons: ['Possui site e o objetivo exige empresas sem site'], enrichment: {} };
  }
  if (plan.filters.hasWebsite && !hasWebsite) {
    return { qualified: false, score: 0, reasons: ['Não possui site e o objetivo exige empresas com site'], enrichment: {} };
  }
  if (plan.filters.hasPhone && !hasPhone) {
    return { qualified: false, score: 0, reasons: ['Não possui telefone identificado'], enrichment: {} };
  }
  if (plan.filters.noSocial && knownSocials.length > 0) {
    return { qualified: false, score: 0, reasons: ['Já possui rede social identificada'], enrichment: {} };
  }

  let score = initialCandidateScore(snapshot, plan);
  let enrichment: any = {};

  if (!hasWebsite) {
    reasons.push('Sem site identificado');
  }
  if (hasPhone) reasons.push('Contato telefônico disponível');
  if (hasEmail) reasons.push('E-mail disponível');

  if (hasWebsite && plan.enrichWebsites) {
    try {
      enrichment = await enrichBusinessWebsite(snapshot.website);
      if (enrichment.siteStatus === 'unreachable') {
        score += 18;
        reasons.push('Site indisponível ou inacessível');
      } else if (enrichment.siteStatus === 'verified') {
        if (!enrichment.metaDescription) {
          score += 5;
          reasons.push('Site sem meta description identificada');
        }
        if (enrichment.whatsapp?.length) {
          score += 10;
          reasons.push('WhatsApp verificado no site');
        }
        if (enrichment.emails?.length && !hasEmail) {
          score += 6;
          reasons.push('E-mail encontrado no site oficial');
        }
        if (plan.filters.noSocial) {
          const discoveredSocials = Object.values(enrichment.socials || {}).filter(Boolean);
          if (discoveredSocials.length > 0) {
            return {
              qualified: false,
              score: 0,
              reasons: ['Rede social encontrada durante a verificação do site'],
              enrichment,
            };
          }
        }
      }
    } catch (error: any) {
      reasons.push('Auditoria do site indisponível nesta tentativa');
      enrichment = { error: String(error?.message || error).slice(0, 300) };
    }
  }

  if (!reasons.length) reasons.push('Compatível com o objetivo do Agent');
  return {
    qualified: true,
    score: Math.max(0, Math.min(100, score)),
    reasons: reasons.slice(0, 6),
    enrichment,
  };
}

async function logEvent(
  runId: string,
  eventType: string,
  message: string,
  level: 'debug' | 'info' | 'warning' | 'error' | 'success' = 'info',
  metadata: Record<string, any> = {},
) {
  await appDataRequest('agent_run_events', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      run_id: runId,
      event_type: eventType,
      message,
      level,
      metadata,
    }),
  }).catch((error) => console.warn('[Scoutly Agentic] Event log failed:', error));
}

async function updateStep(runId: string, stepKey: string, payload: Record<string, any>) {
  await appDataRequest(
    `agent_run_steps?run_id=eq.${dbValue(runId)}&step_key=eq.${dbValue(stepKey)}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ ...payload, updated_at: new Date().toISOString() }),
    }
  );
}

async function updateRun(run: AgentRunRecord, payload: Record<string, any>) {
  const filter = run.lock_token
    ? `agent_runs?id=eq.${dbValue(run.id)}&lock_token=eq.${dbValue(run.lock_token)}&status=neq.cancelled`
    : `agent_runs?id=eq.${dbValue(run.id)}&status=neq.cancelled`;

  return appDataRequest<any[]>(filter, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ ...payload, updated_at: new Date().toISOString() }),
  });
}

async function unlockRun(run: AgentRunRecord, extra: Record<string, any> = {}) {
  await updateRun(run, {
    worker_id: null,
    lock_token: null,
    locked_until: null,
    next_attempt_at: new Date().toISOString(),
    ...extra,
  });
}

async function getSubscriptionPlan(userUid: string) {
  const rows = await appDataRequest<any[]>(
    `subscriptions?user_uid=eq.${dbValue(userUid)}&select=plan,status&limit=1`
  );
  const row = rows[0];
  if (!row) return 'trial';
  if (['canceled', 'unpaid', 'incomplete_expired'].includes(String(row.status || ''))) return 'expired';
  const plan = String(row.plan || 'trial').toLowerCase();
  return PLAN_CAPS[plan] ? plan : 'trial';
}

export async function createAgentRun(
  identity: FirebaseIdentity,
  input: { objective: string; currentRegionName?: string; targetCount?: number | null }
) {
  const objective = String(input.objective || '').trim();
  if (objective.length < 5) {
    throw Object.assign(new Error('Descreva o objetivo do Agent com mais detalhes.'), { statusCode: 400 });
  }
  if (objective.length > 1200) {
    throw Object.assign(new Error('O objetivo está muito longo. Use até 1.200 caracteres.'), { statusCode: 400 });
  }

  const { workspaceId } = await ensureAppUser(identity);
  const planName = await getSubscriptionPlan(identity.uid);
  const caps = PLAN_CAPS[planName] || PLAN_CAPS.trial;
  if (caps.maxTarget <= 0) {
    throw Object.assign(new Error('Seu plano não possui acesso ativo ao Scoutly Agentic.'), { statusCode: 402 });
  }

  const active = await appDataRequest<Array<{ id: string }>>(
    `agent_runs?user_uid=eq.${dbValue(identity.uid)}&status=in.(${ACTIVE_STATUSES.join(',')})&select=id&limit=${caps.concurrent}`
  );
  if (active.length >= caps.concurrent) {
    throw Object.assign(
      new Error(`Seu plano permite ${caps.concurrent} Agent Run${caps.concurrent > 1 ? 's' : ''} simultâneo${caps.concurrent > 1 ? 's' : ''}.`),
      { statusCode: 429 }
    );
  }

  const requested = inferTargetCount(objective, input.targetCount);
  const targetCount = Math.max(1, Math.min(requested, caps.maxTarget));
  const currentRegionName = String(input.currentRegionName || 'São Paulo - SP').trim() || 'São Paulo - SP';

  const rows = await appDataRequest<AgentRunRecord[]>('agent_runs?select=*', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      user_uid: identity.uid,
      workspace_id: workspaceId,
      objective,
      current_region_name: currentRegionName,
      target_count: targetCount,
      priority: caps.priority,
      status: 'queued',
      stage: 'planning',
      progress: 0,
      current_message: 'Agent Run criado. Preparando plano...',
      result_summary: {
        requestedTarget: requested,
        targetCapped: requested > targetCount,
        plan: planName,
      },
    }),
  });

  const run = rows[0];
  if (!run) throw new Error('Não foi possível criar o Agent Run.');

  await appDataRequest('agent_run_steps?on_conflict=run_id,step_key', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify([
      { run_id: run.id, step_key: 'planning', label: 'Planejar estratégia' },
      { run_id: run.id, step_key: 'searching', label: 'Buscar e deduplicar empresas' },
      { run_id: run.id, step_key: 'qualifying', label: 'Enriquecer e qualificar leads' },
      { run_id: run.id, step_key: 'saving', label: 'Salvar melhores oportunidades' },
    ]),
  });

  await logEvent(run.id, 'run_created', `Agent Run criado com meta de ${targetCount} leads.`, 'success', {
    plan: planName,
    targetCount,
  });

  return run;
}

export async function listAgentRunsForUser(userUid: string) {
  return appDataRequest<AgentRunRecord[]>(
    `agent_runs?user_uid=eq.${dbValue(userUid)}&select=*&order=created_at.desc&limit=20`
  );
}

export async function getAgentRunForUser(userUid: string, runId: string): Promise<AgentRunDetail | null> {
  const rows = await appDataRequest<AgentRunRecord[]>(
    `agent_runs?id=eq.${dbValue(runId)}&user_uid=eq.${dbValue(userUid)}&select=*&limit=1`
  );
  const run = rows[0];
  if (!run) return null;

  const [steps, leads, events] = await Promise.all([
    appDataRequest<any[]>(
      `agent_run_steps?run_id=eq.${dbValue(runId)}&select=*&order=id.asc`
    ),
    appDataRequest<any[]>(
      `agent_run_leads?run_id=eq.${dbValue(runId)}&status=in.(qualified,saved)&select=id,business_id,status,score,reasons,business_snapshot,enrichment,updated_at&order=score.desc&limit=120`
    ),
    appDataRequest<any[]>(
      `agent_run_events?run_id=eq.${dbValue(runId)}&select=id,level,event_type,message,metadata,created_at&order=created_at.desc&limit=80`
    ),
  ]);

  return { ...run, steps, leads, events };
}

export async function cancelAgentRun(userUid: string, runId: string) {
  const rows = await appDataRequest<AgentRunRecord[]>(
    `agent_runs?id=eq.${dbValue(runId)}&user_uid=eq.${dbValue(userUid)}&status=in.(${ACTIVE_STATUSES.join(',')})`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        status: 'cancelled',
        stage: 'cancelled',
        current_message: 'Execução cancelada pelo usuário.',
        cancelled_at: new Date().toISOString(),
        locked_until: null,
        lock_token: null,
        worker_id: null,
        updated_at: new Date().toISOString(),
      }),
    }
  );

  if (rows[0]) await logEvent(runId, 'run_cancelled', 'Agent Run cancelado pelo usuário.', 'warning');
  return rows[0] || null;
}

async function processPlanning(run: AgentRunRecord) {
  await updateStep(run.id, 'planning', {
    status: 'running',
    attempt: Number(run.attempts || 0) + 1,
    started_at: new Date().toISOString(),
    error: null,
  });
  await logEvent(run.id, 'planning_started', 'Analisando objetivo e montando estratégia.');

  const plan = await buildAgentPlan(run);

  await updateStep(run.id, 'planning', {
    status: 'completed',
    output: plan,
    completed_at: new Date().toISOString(),
  });

  await unlockRun(run, {
    plan,
    status: 'searching',
    stage: 'searching',
    progress: 8,
    attempts: 0,
    error: null,
    current_message: `Plano pronto. Buscando ${run.target_count} oportunidades...`,
  });
  await logEvent(run.id, 'planning_completed', 'Plano operacional criado.', 'success', { plan });
}

async function processSearching(run: AgentRunRecord) {
  const plan = (run.plan && Object.keys(run.plan).length ? run.plan : buildFallbackPlan(run)) as AgentPlan;
  await updateStep(run.id, 'searching', {
    status: 'running',
    attempt: Number(run.attempts || 0) + 1,
    started_at: new Date().toISOString(),
    input: { searchQuery: plan.searchQuery, regionName: plan.regionName },
    error: null,
  });
  await logEvent(run.id, 'search_started', `Buscando empresas para “${plan.searchQuery}”.`);

  const result = await searchBusinessesAdaptive(plan.searchQuery, plan.regionName || run.current_region_name);
  const unique = new Map<string, BusinessSummary>();
  for (const business of result.businesses || []) {
    if (!business?.id) continue;
    unique.set(business.id, business);
    if (unique.size >= 300) break;
  }

  const candidates = Array.from(unique.values()).map((business) => {
    const snapshot = businessToSnapshot(business);
    return {
      run_id: run.id,
      business_id: business.id,
      status: 'candidate',
      initial_score: initialCandidateScore(snapshot, plan),
      score: initialCandidateScore(snapshot, plan),
      reasons: [],
      business_snapshot: snapshot,
      enrichment: {},
    };
  });

  if (candidates.length > 0) {
    await appDataRequest('agent_run_leads?on_conflict=run_id,business_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(candidates),
    });
  }

  await updateStep(run.id, 'searching', {
    status: 'completed',
    output: {
      foundCount: candidates.length,
      region: result.region,
      businessType: result.businessType,
    },
    completed_at: new Date().toISOString(),
  });

  if (candidates.length === 0) {
    await unlockRun(run, {
      status: 'failed',
      stage: 'failed',
      progress: 100,
      found_count: 0,
      current_message: 'Nenhuma empresa confiável foi encontrada para esse objetivo.',
      error: 'Nenhum candidato encontrado',
      completed_at: new Date().toISOString(),
    });
    await logEvent(run.id, 'search_empty', 'Nenhum candidato confiável encontrado.', 'error');
    return;
  }

  await unlockRun(run, {
    status: 'qualifying',
    stage: 'qualifying',
    found_count: candidates.length,
    progress: 25,
    attempts: 0,
    error: null,
    current_message: `${candidates.length} empresas encontradas. Qualificando em lotes seguros...`,
    result_summary: {
      ...(run.result_summary || {}),
      businessType: result.businessType,
      resolvedRegion: result.region.name,
    },
  });
  await logEvent(run.id, 'search_completed', `${candidates.length} empresas candidatas encontradas.`, 'success');
}

async function processQualifying(run: AgentRunRecord) {
  const plan = (run.plan && Object.keys(run.plan).length ? run.plan : buildFallbackPlan(run)) as AgentPlan;
  await updateStep(run.id, 'qualifying', {
    status: 'running',
    attempt: Number(run.attempts || 0) + 1,
    started_at: run.processed_count === 0 ? new Date().toISOString() : undefined,
    error: null,
  });

  const batch = await appDataRequest<any[]>(
    `agent_run_leads?run_id=eq.${dbValue(run.id)}&status=eq.candidate&select=id,business_id,business_snapshot,initial_score&order=initial_score.desc&limit=6`
  );

  if (batch.length === 0 || run.qualified_count >= run.target_count) {
    await updateStep(run.id, 'qualifying', {
      status: 'completed',
      output: {
        processedCount: run.processed_count,
        qualifiedCount: run.qualified_count,
      },
      completed_at: new Date().toISOString(),
    });
    await unlockRun(run, {
      status: 'saving',
      stage: 'saving',
      progress: 88,
      attempts: 0,
      error: null,
      current_message: `Qualificação concluída. Salvando as melhores ${Math.min(run.target_count, run.qualified_count)} oportunidades...`,
    });
    await logEvent(run.id, 'qualification_completed', `${run.qualified_count} leads qualificados.`, 'success');
    return;
  }

  const evaluated = await Promise.all(
    batch.map(async (row) => ({ row, result: await qualifyLead(row.business_snapshot, plan) }))
  );

  let qualifiedInBatch = 0;
  for (const item of evaluated) {
    const status = item.result.qualified ? 'qualified' : 'rejected';
    if (item.result.qualified) qualifiedInBatch += 1;
    await appDataRequest(`agent_run_leads?id=eq.${dbValue(item.row.id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        status,
        score: item.result.score,
        reasons: item.result.reasons,
        enrichment: item.result.enrichment,
        updated_at: new Date().toISOString(),
      }),
    });
  }

  const nextProcessed = run.processed_count + batch.length;
  const nextQualified = run.qualified_count + qualifiedInBatch;
  const ceiling = Math.min(run.found_count, Math.max(run.target_count * 2, run.target_count + 20), 320);
  const shouldFinish = nextQualified >= run.target_count || nextProcessed >= ceiling || batch.length < 6;
  const progress = Math.min(86, 25 + Math.round((Math.min(nextProcessed, ceiling) / Math.max(1, ceiling)) * 60));

  await logEvent(
    run.id,
    'qualification_batch',
    `Lote analisado: ${nextProcessed}/${ceiling}. ${nextQualified} leads qualificados até agora.`,
    'info',
    { processed: nextProcessed, qualified: nextQualified }
  );

  if (shouldFinish) {
    await updateStep(run.id, 'qualifying', {
      status: 'completed',
      output: { processedCount: nextProcessed, qualifiedCount: nextQualified },
      completed_at: new Date().toISOString(),
    });
    await unlockRun(run, {
      status: 'saving',
      stage: 'saving',
      processed_count: nextProcessed,
      qualified_count: nextQualified,
      progress: 88,
      attempts: 0,
      error: null,
      current_message: `Qualificação concluída. Salvando as melhores ${Math.min(run.target_count, nextQualified)} oportunidades...`,
    });
  } else {
    await unlockRun(run, {
      processed_count: nextProcessed,
      qualified_count: nextQualified,
      progress,
      attempts: 0,
      error: null,
      current_message: `Qualificando empresas... ${nextQualified}/${run.target_count} oportunidades aprovadas.`,
    });
  }
}

async function generateFinalSummary(run: AgentRunRecord, selected: any[]) {
  const summaryPrompt = `Escreva um resumo operacional curto, em português do Brasil, para um Agent Run de prospecção da Scoutly.
Objetivo: ${run.objective}
Meta: ${run.target_count}
Empresas encontradas: ${run.found_count}
Empresas processadas: ${run.processed_count}
Leads selecionados: ${selected.length}
Não liste nomes nem invente dados. Diga que os leads foram adicionados ao pipeline e mencione se a meta foi atingida ou parcialmente atingida. Máximo 90 palavras.`;
  const model = await callAgentModel(summaryPrompt, 250);
  if (model?.text) return { text: model.text, model: model.model };

  const partial = selected.length < run.target_count;
  return {
    text: partial
      ? `O Agent encontrou ${run.found_count} empresas, qualificou as melhores oportunidades disponíveis e adicionou ${selected.length} leads ao pipeline. A meta de ${run.target_count} não foi totalmente atingida com os critérios atuais; ampliar a região ou flexibilizar filtros tende a aumentar o volume.`
      : `O Agent concluiu a prospecção, analisou ${run.found_count} empresas e adicionou ${selected.length} oportunidades priorizadas ao seu pipeline. A meta foi atingida com os critérios definidos.`,
    model: 'local-fallback',
  };
}

async function processSaving(run: AgentRunRecord) {
  await updateStep(run.id, 'saving', {
    status: 'running',
    attempt: Number(run.attempts || 0) + 1,
    started_at: new Date().toISOString(),
    error: null,
  });

  const selected = await appDataRequest<any[]>(
    `agent_run_leads?run_id=eq.${dbValue(run.id)}&status=eq.qualified&select=id,business_id,score,reasons,business_snapshot&order=score.desc&limit=${Math.max(1, run.target_count)}`
  );

  if (selected.length > 0) {
    const leadRows = selected.map((item) => ({
      user_uid: run.user_uid,
      workspace_id: run.workspace_id,
      business_id: item.business_id,
      status: 'NOVO',
      notes: `Scoutly Agentic • Score ${Math.round(Number(item.score || 0))}/100${Array.isArray(item.reasons) && item.reasons.length ? ` • ${item.reasons.slice(0, 2).join(' • ')}` : ''}`,
      business_snapshot: {
        ...item.business_snapshot,
        leadStatus: 'NOVO',
        notes: `Scoutly Agentic • Score ${Math.round(Number(item.score || 0))}/100`,
      },
      source_agent_run_id: run.id,
      updated_at: new Date().toISOString(),
    }));

    await appDataRequest('user_leads?on_conflict=user_uid,business_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(leadRows),
    });
  }

  const summary = await generateFinalSummary(run, selected);
  const completedAt = new Date().toISOString();

  await updateStep(run.id, 'saving', {
    status: 'completed',
    output: { savedCount: selected.length },
    completed_at: completedAt,
  });

  await unlockRun(run, {
    status: 'completed',
    stage: 'completed',
    saved_count: selected.length,
    qualified_count: Math.max(run.qualified_count, selected.length),
    progress: 100,
    attempts: 0,
    error: null,
    completed_at: completedAt,
    current_message: selected.length >= run.target_count
      ? `Concluído: ${selected.length} oportunidades adicionadas ao pipeline.`
      : `Concluído parcialmente: ${selected.length}/${run.target_count} oportunidades adicionadas ao pipeline.`,
    result_summary: {
      ...(run.result_summary || {}),
      summaryText: summary.text,
      summaryModel: summary.model,
      selectedBusinessIds: selected.map((item) => item.business_id),
      partial: selected.length < run.target_count,
    },
  });

  await logEvent(
    run.id,
    'run_completed',
    `${selected.length} oportunidades salvas no pipeline.`,
    'success',
    { savedCount: selected.length, targetCount: run.target_count }
  );
}

async function failOrRetry(run: AgentRunRecord, error: any) {
  const attempts = Number(run.attempts || 0) + 1;
  const message = String(error?.message || error || 'Erro inesperado').slice(0, 1000);
  const shouldFail = attempts >= 3;
  const delaySeconds = Math.min(90, Math.pow(3, attempts) * 4);

  if (shouldFail) {
    await updateStep(run.id, run.stage, {
      status: 'failed',
      error: message,
      attempt: attempts,
      completed_at: new Date().toISOString(),
    }).catch(() => undefined);
  }

  await updateRun(run, {
    status: shouldFail ? 'failed' : run.status,
    stage: shouldFail ? 'failed' : run.stage,
    attempts,
    error: message,
    current_message: shouldFail
      ? 'O Agent encontrou um erro persistente e interrompeu esta execução.'
      : `Falha temporária. Nova tentativa automática em ${delaySeconds}s...`,
    progress: shouldFail ? 100 : run.progress,
    completed_at: shouldFail ? new Date().toISOString() : null,
    next_attempt_at: new Date(Date.now() + delaySeconds * 1000).toISOString(),
    worker_id: null,
    lock_token: null,
    locked_until: null,
  });

  await logEvent(run.id, shouldFail ? 'run_failed' : 'run_retry', message, shouldFail ? 'error' : 'warning', {
    attempts,
    delaySeconds,
  });
}

export async function processAgentQueueOnce(workerId = `worker-${randomUUID()}`) {
  const claimed = await appDataRequest<AgentRunRecord[]>('rpc/claim_scoutly_agent_run', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ p_worker_id: workerId, p_lock_seconds: 75 }),
  });

  const run = claimed[0];
  if (!run) return { processed: false, status: 'idle' as const };

  try {
    if (run.status === 'planning' || run.stage === 'planning') {
      await processPlanning(run);
    } else if (run.status === 'searching' || run.stage === 'searching') {
      await processSearching(run);
    } else if (run.status === 'qualifying' || run.stage === 'qualifying') {
      await processQualifying(run);
    } else if (run.status === 'saving' || run.stage === 'saving') {
      await processSaving(run);
    } else {
      await unlockRun(run);
    }

    return { processed: true, runId: run.id, stage: run.stage };
  } catch (error: any) {
    console.error('[Scoutly Agentic Worker]', run.id, error);
    await failOrRetry(run, error);
    return {
      processed: true,
      runId: run.id,
      stage: run.stage,
      error: String(error?.message || error),
    };
  }
}
