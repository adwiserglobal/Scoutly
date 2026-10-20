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
  title?: string;
}

export interface LlmResult {
  text: string;
  model: string;
  provider: 'gemini' | 'openrouter';
  attempts: number;
}

export class LlmUnavailableError extends Error {
  statusCode = 503;
  code = 'LLM_UNAVAILABLE';
  constructor(message = 'A IA está com muita demanda agora. Tente novamente em instantes.') {
    super(message);
  }
}

const DEFAULT_OPENROUTER_MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-3-27b-it:free',
  'mistralai/mistral-small-3.2-24b-instruct:free',
  'deepseek/deepseek-chat-v3-0324:free',
  'openrouter/auto',
];

const DEFAULT_GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];

function list(value: string | undefined, fallback: string[]) {
  const items = String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
  return items.length ? items : fallback;
}

type Candidate = { provider: 'gemini' | 'openrouter'; model: string };

function candidates(): Candidate[] {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_API_KEY;
  const chain: Candidate[] = [];
  const gemini = geminiKey
    ? list(process.env.GEMINI_MODELS, DEFAULT_GEMINI_MODELS).map((model) => ({ provider: 'gemini' as const, model }))
    : [];
  const openrouter = process.env.OPENROUTER_API_KEY
    ? list(process.env.OPENROUTER_MODELS, DEFAULT_OPENROUTER_MODELS).map((model) => ({ provider: 'openrouter' as const, model }))
    : [];
  // Interleave so a single saturated provider never consumes the whole budget.
  const max = Math.max(gemini.length, openrouter.length);
  for (let i = 0; i < max; i += 1) {
    if (gemini[i]) chain.push(gemini[i]);
    if (openrouter[i]) chain.push(openrouter[i]);
  }
  return chain;
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
      abortSignal: AbortSignal.timeout(timeoutMs),
    },
  });
  return String(response.text || '').trim();
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

export async function generateText(request: LlmRequest): Promise<LlmResult> {
  const budgetMs = request.budgetMs ?? 40_000;
  const attemptMs = request.attemptMs ?? 9_000;
  const minLength = request.minLength ?? 1;
  const started = Date.now();
  let attempts = 0;

  for (const candidate of candidates()) {
    const remaining = budgetMs - (Date.now() - started);
    if (remaining < 2_000) break;
    attempts += 1;
    try {
      const timeout = Math.min(attemptMs, remaining);
      const text = candidate.provider === 'gemini'
        ? await callGemini(candidate.model, request, timeout)
        : await callOpenRouter(candidate.model, request, timeout);
      if (text.length >= minLength) {
        return { text, model: candidate.model, provider: candidate.provider, attempts };
      }
      console.warn(`[LLM] ${candidate.provider}/${candidate.model} returned too little text`);
    } catch (error: any) {
      console.warn(`[LLM] ${candidate.provider}/${candidate.model} failed:`, error?.message || error);
    }
  }

  throw new LlmUnavailableError();
}
