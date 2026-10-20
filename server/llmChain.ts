import { GoogleGenAI } from '@google/genai';

/**
 * Text generation with an ordered chain of providers/models.
 * Each attempt has its own timeout and the whole chain has a hard time budget, so a busy
 * free-tier model never leaves the user waiting forever: we move on to the next candidate
 * and give up cleanly (LLM_UNAVAILABLE) when the budget is spent.
 */
export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmRequest {
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Reject shorter answers (treated as a failed attempt). */
  minLength?: number;
  /** Hard limit for the whole chain, in ms. */
  budgetMs?: number;
  /** Limit for each single attempt, in ms. */
  attemptMs?: number;
  /** Start the next candidate after this many ms without cancelling the slow one (first valid answer wins). */
  hedgeMs?: number;
  /** An answer failing this check counts as a failed attempt. */
  validate?: (text: string) => boolean;
  /** Restrict the chain to these providers (default: all configured). */
  providers?: Array<'gateway' | 'gemini' | 'openrouter'>;
  /** Ask the provider for JSON output when supported. */
  json?: boolean;
  title?: string;
}

export interface LlmResult {
  text: string;
  model: string;
  provider: 'gateway' | 'gemini' | 'openrouter';
  attempts: number;
}

export class LlmUnavailableError extends Error {
  statusCode = 503;
  code = 'LLM_UNAVAILABLE';
  /** Short, secret-free reasons per attempt (provider/model: cause) for diagnostics. */
  failures: string[];
  constructor(message = 'A IA está com muita demanda agora. Tente novamente em instantes.', failures: string[] = []) {
    super(message);
    this.failures = failures;
  }
}

const DEFAULT_OPENROUTER_MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-3-27b-it:free',
  'mistralai/mistral-small-3.2-24b-instruct:free',
  'deepseek/deepseek-chat-v3-0324:free',
  'openrouter/auto',
];

// Vercel AI Gateway (one key, OpenAI-compatible). Override with AI_GATEWAY_MODELS.
const DEFAULT_GATEWAY_MODELS = ['google/gemini-2.5-flash', 'openai/gpt-4o-mini', 'google/gemini-2.5-flash-lite'];

const DEFAULT_GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];

function list(value: string | undefined, fallback: string[]) {
  const items = String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
  return items.length ? items : fallback;
}

type Candidate = { provider: 'gateway' | 'gemini' | 'openrouter'; model: string };

const gatewayKey = () => String(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || '').trim();

let freeModelsCache: { at: number; models: string[] } | null = null;
const PREFERRED = ['gpt-oss', 'llama-3.3-70b', 'qwen3', 'qwen-2.5-72b', 'llama-4', 'deepseek', 'gemma-3', 'mistral-small', 'glm', 'kimi'];
const EXCLUDED = /vision|embed|guard|moderation|image|audio|tts|whisper|thinking-exp|safety/i;

/** Free model ids change often, so ask OpenRouter which ones exist right now (cached for an hour). */
async function liveFreeModels(): Promise<string[]> {
  if (freeModelsCache && Date.now() - freeModelsCache.at < 60 * 60 * 1000) return freeModelsCache.models;
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(4000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const models = (Array.isArray(data?.data) ? data.data : [])
      .filter((model: any) => typeof model?.id === 'string' && model.id.endsWith(':free') && !EXCLUDED.test(model.id)
        && Number(model.pricing?.prompt) === 0 && Number(model.context_length || 0) >= 16_000
        && (model.architecture?.output_modalities || ['text']).includes('text'))
      .map((model: any) => {
        const rank = PREFERRED.findIndex((key) => model.id.includes(key));
        return { id: model.id as string, rank: rank === -1 ? PREFERRED.length : rank, context: Number(model.context_length || 0) };
      })
      .sort((a: any, b: any) => a.rank - b.rank || b.context - a.context)
      .slice(0, 6)
      .map((model: any) => model.id);
    freeModelsCache = { at: Date.now(), models };
    return models;
  } catch (error: any) {
    console.warn('[LLM] could not list OpenRouter models:', error?.message || error);
    return [];
  }
}

async function candidates(allowed?: LlmRequest['providers']): Promise<Candidate[]> {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_API_KEY;
  // The gateway is paid/credit based and reliable, so it goes first; free tiers are the safety net.
  const chain: Candidate[] = gatewayKey()
    ? list(process.env.AI_GATEWAY_MODELS, DEFAULT_GATEWAY_MODELS).map((model) => ({ provider: 'gateway' as const, model }))
    : [];
  const gemini = geminiKey
    ? list(process.env.GEMINI_MODELS, DEFAULT_GEMINI_MODELS).map((model) => ({ provider: 'gemini' as const, model }))
    : [];
  let openrouterModels: string[] = [];
  if (process.env.OPENROUTER_API_KEY) {
    openrouterModels = String(process.env.OPENROUTER_MODELS || '').trim()
      ? list(process.env.OPENROUTER_MODELS, [])
      : await liveFreeModels();
    if (!openrouterModels.length) openrouterModels = DEFAULT_OPENROUTER_MODELS;
  }
  const openrouter = openrouterModels.map((model) => ({ provider: 'openrouter' as const, model }));
  // Interleave so a single saturated provider never consumes the whole budget.
  const max = Math.max(gemini.length, openrouter.length);
  for (let i = 0; i < max; i += 1) {
    if (gemini[i]) chain.push(gemini[i]);
    if (openrouter[i]) chain.push(openrouter[i]);
  }
  return allowed?.length ? chain.filter((item) => allowed.includes(item.provider)) : chain;
}

async function callGemini(model: string, request: LlmRequest, timeoutMs: number): Promise<string> {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_API_KEY || '';
  const ai = new GoogleGenAI({ apiKey: key });
  const system = request.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const contents = request.messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      temperature: request.temperature,
      maxOutputTokens: request.maxTokens,
      systemInstruction: system || undefined,
      responseMimeType: request.json ? 'application/json' : undefined,
      abortSignal: AbortSignal.timeout(timeoutMs),
    },
  });
  return String(response.text || '').trim();
}

async function callGateway(model: string, request: LlmRequest, timeoutMs: number): Promise<string> {
  const response = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${gatewayKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: request.messages, temperature: request.temperature, max_tokens: request.maxTokens }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  if (data?.error) throw new Error(String(data.error?.message || 'provider error'));
  return String(data?.choices?.[0]?.message?.content || '').trim();
}

async function callOpenRouter(model: string, request: LlmRequest, timeoutMs: number): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': process.env.APP_URL || 'https://scoutly.pro',
      'X-Title': request.title || 'Scoutly',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: request.messages,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  if (data?.error) throw new Error(String(data.error?.message || 'provider error'));
  return String(data?.choices?.[0]?.message?.content || '').trim();
}

async function attempt(candidate: Candidate, request: LlmRequest, timeoutMs: number): Promise<string> {
  const text = candidate.provider === 'gateway'
    ? await callGateway(candidate.model, request, timeoutMs)
    : candidate.provider === 'gemini'
      ? await callGemini(candidate.model, request, timeoutMs)
      : await callOpenRouter(candidate.model, request, timeoutMs);
  if (text.length < (request.minLength ?? 1)) throw new Error('answer too short');
  if (request.validate && !request.validate(text)) throw new Error('answer failed validation');
  return text;
}

export async function generateText(request: LlmRequest): Promise<LlmResult> {
  const budgetMs = request.budgetMs ?? 40_000;
  const attemptMs = request.attemptMs ?? 9_000;
  const hedgeMs = request.hedgeMs ?? 0;
  const started = Date.now();
  const queue = await candidates(request.providers);
  const failures: string[] = [];
  const note = (candidate: Candidate, error: any) =>
    failures.push(`${candidate.provider}/${candidate.model}: ${String(error?.message || error).slice(0, 80)}`);
  const counts = queue.reduce<Record<string, number>>((acc, item) => ({ ...acc, [item.provider]: (acc[item.provider] || 0) + 1 }), {});
  console.info(`[LLM] chain: ${Object.entries(counts).map(([name, n]) => `${name}x${n}`).join(' ') || 'EMPTY'}${request.title ? ` (${request.title})` : ''}`);
  if (queue.length === 0) {
    const gatewayOnly = request.providers?.length === 1 && request.providers[0] === 'gateway';
    throw new LlmUnavailableError(
      gatewayOnly
        ? 'O AI Gateway não está configurado neste deploy. Crie a variável AI_GATEWAY_API_KEY na Vercel (Production) e faça um novo deploy.'
        : 'Nenhum provedor de IA está configurado neste ambiente.',
      ['sem chave: AI_GATEWAY_API_KEY'],
    );
  }
  let attempts = 0;

  if (hedgeMs <= 0) {
    for (const candidate of queue) {
      const remaining = budgetMs - (Date.now() - started);
      if (remaining < 2_000) break;
      attempts += 1;
      try {
        const text = await attempt(candidate, request, Math.min(attemptMs, remaining));
        return { text, model: candidate.model, provider: candidate.provider, attempts };
      } catch (error: any) {
        note(candidate, error);
        console.warn(`[LLM] ${candidate.provider}/${candidate.model} failed:`, error?.message || error);
      }
    }
    throw new LlmUnavailableError(undefined, failures);
  }

  // Hedged mode: launch the next candidate when the current ones are slow or have failed.
  return new Promise<LlmResult>((resolve, reject) => {
    let next = 0;
    let pending = 0;
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      fn();
    };

    const launch = () => {
      if (settled) return;
      const remaining = budgetMs - (Date.now() - started);
      if (next >= queue.length || remaining < 2_000) {
        if (pending === 0) finish(() => reject(new LlmUnavailableError(undefined, failures)));
        return;
      }
      const candidate = queue[next];
      next += 1;
      attempts += 1;
      pending += 1;
      attempt(candidate, request, Math.min(attemptMs, remaining))
        .then((text) => finish(() => resolve({ text, model: candidate.model, provider: candidate.provider, attempts })))
        .catch((error: any) => {
          note(candidate, error);
          console.warn(`[LLM] ${candidate.provider}/${candidate.model} failed:`, error?.message || error);
          pending -= 1;
          if (!settled) launch();
        });
      timer = setTimeout(launch, hedgeMs);
    };
    launch();
  });
}
