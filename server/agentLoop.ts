import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { generateText, type LlmMessage } from './llmChain.js';
import { runScoutlyBusinessSearch } from './searchFacade.js';
import { resolveSearchProfile, scoreAgainstProfile } from './searchProfiles.js';
import type { AIChatResponse, BusinessSummary, ChatMessage } from './aiService.js';

/**
 * Scoutly Agentic, tool-using version. The model plans in a short loop (at most MAX_STEPS tool
 * calls): it can search the Scoutly business base, search the web, read a public page, and then
 * writes the final answer. The protocol is plain JSON (one action per turn) so it works with any
 * model of the chain (Vercel AI Gateway first). Returns null when no model answers, so the caller
 * can fall back to the deterministic orchestrator.
 */

const MAX_STEPS = 5;
const MAX_WEB_SEARCHES = 3;
const MAX_PAGES = 2;
const TOTAL_BUDGET_MS = 45_000;

type Action =
  | { tool: 'search_businesses'; args: { segment?: string; location?: string; noWebsite?: boolean; hasPhone?: boolean; noSocial?: boolean; limit?: number } }
  | { tool: 'web_search'; args: { query?: string } }
  | { tool: 'read_page'; args: { url?: string } }
  | { tool: 'finish'; args: { answer?: string; businessIds?: string[]; addToPipeline?: boolean; followUps?: string[] } };

export type AgentResponse = AIChatResponse & {
  followUps?: string[];
  conversationContext?: Record<string, unknown>;
};

export interface AgentInput {
  message: string;
  history: ChatMessage[];
  businesses: BusinessSummary[];
  currentRegionName: string;
  language: 'pt' | 'en';
  conversationContext?: Record<string, any> | null;
}

const clip = (value: unknown, max: number) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

function compact(business: BusinessSummary) {
  return {
    id: business.id,
    name: clip(business.name, 70),
    category: clip(business.category, 40),
    address: clip(business.address, 80),
    website: business.website ? 'sim' : 'não',
    phone: business.phone || business.phones?.length ? 'sim' : 'não',
    socials: business.socials?.length || 0,
  };
}

function extractJson(text: string): any | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        try { return JSON.parse(text.slice(start, index + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

function privateAddress(address: string) {
  if (address.includes(':')) return /^(::1?|f[cd]|fe80)/i.test(address) || address.toLowerCase().startsWith('::ffff:');
  const [a, b] = address.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}

async function isPublicUrl(value: string) {
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) return false;
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return false;
    if (isIP(host)) return !privateAddress(host);
    const records = await lookup(host, { all: true });
    return records.length > 0 && records.every((record) => !privateAddress(record.address));
  } catch {
    return false;
  }
}

async function webSearch(query: string) {
  const apiKey = String(process.env.SERPER_API_KEY || '').trim();
  if (!apiKey) return { error: 'Busca na web não configurada neste ambiente.' };
  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: clip(query, 300), gl: 'br', hl: 'pt-br', num: 7 }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return { error: `Busca na web indisponível (${response.status}).` };
    const data = await response.json();
    return {
      answer: clip(data?.answerBox?.answer || data?.answerBox?.snippet || data?.knowledgeGraph?.description, 300) || undefined,
      results: (Array.isArray(data?.organic) ? data.organic : []).slice(0, 7).map((hit: any) => ({
        title: clip(hit.title, 120), url: String(hit.link || ''), snippet: clip(hit.snippet, 240),
      })),
    };
  } catch (error: any) {
    return { error: `Busca na web falhou: ${clip(error?.message, 80)}` };
  }
}

async function readPage(url: string) {
  if (!(await isPublicUrl(url))) return { error: 'URL não permitida ou inválida.' };
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ScoutlyAgentic/1.0)', Accept: 'text/html,text/plain' },
      redirect: 'follow',
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) return { error: `Página respondeu ${response.status}.` };
    if (!(await isPublicUrl(response.url))) return { error: 'Redirecionamento não permitido.' };
    const type = response.headers.get('content-type') || '';
    if (!/text\/|html|json/.test(type)) return { error: 'Conteúdo não é texto.' };
    const html = (await response.text()).slice(0, 400_000);
    const text = html
      .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
    return { url: response.url, text: text.slice(0, 3800) };
  } catch (error: any) {
    return { error: `Não consegui abrir a página: ${clip(error?.message, 80)}` };
  }
}

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------

function systemPrompt(input: AgentInput) {
  const english = input.language === 'en';
  return `Você é o Scoutly Agentic, o assistente de prospecção local do Scoutly (plataforma B2B que encontra empresas por região). Seu trabalho: ajudar vendedores e agências a achar bons prospects e a decidir como abordá-los. Seja direto, útil e concreto; nada de enrolação.

Hoje: ${new Date().toISOString().slice(0, 10)}. Região atual do mapa: ${input.currentRegionName}.
Idioma da resposta final: ${english ? 'inglês' : 'português do Brasil'}.

FERRAMENTAS (responda SEMPRE com UM único objeto JSON por vez, sem texto fora dele):
1. {"thought":"...","tool":"search_businesses","args":{"segment":"despachante","location":"Santo André - SP","noWebsite":true,"hasPhone":false,"noSocial":false,"limit":10}}
   Busca empresas reais na base do Scoutly (mapa). "location" é opcional (cidade/bairro/estado); sem ela usa a região atual do mapa. Os resultados aparecem no mapa do usuário.
2. {"thought":"...","tool":"web_search","args":{"query":"..."}}  Pesquisa na web (Google). Use para: tendências do segmento, dados sobre uma empresa/dono, concorrentes, ideias de abordagem, notícias, preços de mercado.
3. {"thought":"...","tool":"read_page","args":{"url":"https://..."}}  Lê o texto de uma página pública (use uma URL vinda da web_search).
4. {"thought":"...","tool":"finish","args":{"answer":"resposta em markdown","businessIds":["id1","id2"],"addToPipeline":false,"followUps":["pergunta curta 1","pergunta curta 2"]}}

REGRAS:
- No máximo ${MAX_STEPS} chamadas de ferramenta antes do finish. Prefira 1–3. Se a pergunta é conversa simples ou sobre os resultados já na tela, vá direto ao finish.
- Para "encontre/liste/mostre empresas": use search_businesses. Combine com web_search quando o usuário quiser contexto (ex.: "quais segmentos crescem aqui?").
- Em businessIds do finish, coloque só ids que apareceram nos resultados das ferramentas ou na lista "Resultados atuais" e que realmente atendem ao pedido (ordene do melhor para o pior). Sem ids = não mostra cartões.
- Nunca invente empresas, telefones, donos ou números. Só afirme o que veio das ferramentas; se não achou, diga e sugira o próximo passo.
- Quando usar a web, cite as fontes no texto como links markdown [título](url), no máximo 3.
- Resposta final: curta (até ~150 palavras), com **negrito** nos pontos-chave e, quando útil, uma recomendação prática de abordagem ("o que eu faria"). Sem tabelas.
- followUps: 2 ou 3 próximos passos úteis, frases curtas escritas como o usuário falaria, no idioma da resposta.
- addToPipeline=true só se o usuário pediu para adicionar/salvar no pipeline.`;
}

function contextBlock(input: AgentInput) {
  const list = input.businesses.slice(0, 30).map(compact);
  const noSite = input.businesses.filter((business) => !business.website).length;
  const withPhone = input.businesses.filter((business) => business.phone || business.phones?.length).length;
  const lines = [
    input.conversationContext?.businessType ? `Contexto da conversa: segmento "${input.conversationContext.businessType}" em ${input.conversationContext.regionName || input.currentRegionName}.` : null,
    `Resultados atuais na tela: ${input.businesses.length} empresas (${noSite} sem site, ${withPhone} com telefone).`,
    list.length ? `Primeiros resultados (id|nome|categoria|site|telefone|redes):\n${list.map((item) => `${item.id}|${item.name}|${item.category}|${item.website}|${item.phone}|${item.socials}`).join('\n')}` : null,
  ];
  return lines.filter(Boolean).join('\n');
}

export async function runScoutlyAgent(input: AgentInput): Promise<AgentResponse | null> {
  const started = Date.now();
  const pool = new Map<string, BusinessSummary>(input.businesses.map((business) => [business.id, business]));
  let lastSearch: { query: string; segment: string; region: { name: string; center: { lat: number; lng: number } }; businesses: BusinessSummary[]; shown: BusinessSummary[]; filters: string[] } | null = null;
  let webSearches = 0;
  let pages = 0;
  let model = '';

  const messages: LlmMessage[] = [{ role: 'system', content: systemPrompt(input) }];
  const recent = input.history.slice(-8).filter((item) => item?.content?.trim());
  const historyText = recent.map((item) => `${item.role === 'user' ? 'Usuário' : 'Assistente'}: ${clip(item.content, 500)}`).join('\n');
  messages.push({ role: 'user', content: `${contextBlock(input)}\n\n${historyText ? `Conversa recente:\n${historyText}\n\n` : ''}Pedido atual do usuário: ${input.message}` });

  const ask = async (): Promise<Action | null> => {
    const remaining = TOTAL_BUDGET_MS - (Date.now() - started);
    if (remaining < 4000) return null;
    const result = await generateText({
      messages, temperature: 0.2, maxTokens: 900, budgetMs: Math.min(remaining, 18_000), attemptMs: 12_000, json: true,
      validate: (text) => Boolean(extractJson(text)?.tool), title: 'Scoutly Agentic',
    });
    model = result.model;
    const parsed = extractJson(result.text);
    messages.push({ role: 'assistant', content: JSON.stringify(parsed) });
    return parsed as Action;
  };

  try {
    for (let step = 0; step <= MAX_STEPS; step += 1) {
      let action: Action | null;
      try {
        action = await ask();
      } catch (error: any) {
        if (step === 0) return null;
        console.warn('[Agent] model failed mid-run:', error?.message || error);
        break;
      }
      if (!action) break;

      if (action.tool === 'finish') {
        return finalize(action.args, input, pool, lastSearch, model);
      }

      let observation: unknown;
      if (step >= MAX_STEPS) {
        observation = { error: 'Limite de ferramentas atingido. Use finish agora.' };
      } else if (action.tool === 'search_businesses') {
        const args = action.args || {};
        const segment = clip(args.segment, 80);
        if (!segment) {
          observation = { error: 'Informe o segmento.' };
        } else {
          const location = clip(args.location, 80);
          const query = location ? `${segment} em ${location}` : segment;
          try {
            const result = await runScoutlyBusinessSearch(query, input.currentRegionName);
            const profile = resolveSearchProfile(segment);
            let found = Array.isArray(result.businesses) ? result.businesses : [];
            if (profile) {
              found = found.filter((business) => scoreAgainstProfile({
                name: business.name, category: business.category, basicCategory: business.basicCategory, taxonomyPrimary: business.taxonomyPrimary,
              }, profile) > 0);
            }
            const filters: string[] = [];
            let filtered = found;
            if (args.noWebsite) { filtered = filtered.filter((business) => !business.website); filters.push('sem site identificado'); }
            if (args.hasPhone) { filtered = filtered.filter((business) => business.phone || business.phones?.some(Boolean)); filters.push('com telefone/WhatsApp'); }
            if (args.noSocial) { filtered = filtered.filter((business) => !business.socials?.some(Boolean)); filters.push('sem redes sociais identificadas'); }
            const limit = Math.max(1, Math.min(Number(args.limit) || 10, 20));
            const shown = filtered.slice(0, limit);
            for (const business of found) pool.set(business.id, business);
            lastSearch = {
              query, segment, region: { name: result.region?.name || input.currentRegionName, center: result.region?.center || { lat: -23.5505, lng: -46.6333 } },
              businesses: found, shown, filters,
            };
            observation = {
              regiao: lastSearch.region.name,
              encontradas_no_segmento: found.length,
              apos_filtros: filtered.length,
              resultados: shown.map(compact),
            };
          } catch (error: any) {
            observation = { error: `Busca falhou: ${clip(error?.message, 100)}` };
          }
        }
      } else if (action.tool === 'web_search') {
        if (webSearches >= MAX_WEB_SEARCHES) observation = { error: 'Limite de pesquisas na web atingido.' };
        else { webSearches += 1; observation = await webSearch(clip(action.args?.query, 300)); }
      } else if (action.tool === 'read_page') {
        if (pages >= MAX_PAGES) observation = { error: 'Limite de páginas lidas atingido.' };
        else { pages += 1; observation = await readPage(String(action.args?.url || '')); }
      } else {
        observation = { error: 'Ferramenta desconhecida. Use search_businesses, web_search, read_page ou finish.' };
      }

      messages.push({ role: 'user', content: `Resultado da ferramenta:\n${JSON.stringify(observation).slice(0, 7000)}\n\nContinue: responda com o próximo JSON (ou finish).` });
    }
  } catch (error: any) {
    console.warn('[Agent] failed:', error?.message || error);
    if (!lastSearch) return null;
  }

  // Out of steps/time without a finish: answer from what was gathered.
  if (lastSearch) {
    const search = lastSearch as NonNullable<typeof lastSearch>;
    return finalize({
      answer: input.language === 'en'
        ? `I found **${search.shown.length}** results for **${search.segment}** in **${search.region.name}**.`
        : `Encontrei **${search.shown.length}** resultados para **${search.segment}** em **${search.region.name}**.`,
    }, input, pool, search, model || 'agent');
  }
  return null;
}

function finalize(
  args: { answer?: string; businessIds?: string[]; addToPipeline?: boolean; followUps?: string[] },
  input: AgentInput,
  pool: Map<string, BusinessSummary>,
  lastSearch: { query: string; segment: string; region: { name: string; center: { lat: number; lng: number } }; businesses: BusinessSummary[]; shown: BusinessSummary[]; filters: string[] } | null,
  model: string,
): AgentResponse {
  const answer = String(args.answer || '').trim() || (input.language === 'en' ? 'Done.' : 'Pronto.');
  let ids = (Array.isArray(args.businessIds) ? args.businessIds : []).map(String).filter((id) => pool.has(id));
  ids = [...new Set(ids)].slice(0, 20);
  if (!ids.length && lastSearch && !Array.isArray(args.businessIds)) ids = lastSearch.shown.map((business) => business.id);

  const shownBusinesses = ids.map((id) => pool.get(id)!).filter(Boolean);
  const base: AgentResponse = {
    text: answer,
    matchedBusinessIds: ids,
    modelUsed: `agent:${model}`,
    followUps: (Array.isArray(args.followUps) ? args.followUps : []).map((item) => clip(item, 90)).filter(Boolean).slice(0, 3),
    suggestedAction: args.addToPipeline && ids.length ? { type: 'add_to_pipeline', businessIds: ids } : undefined,
  };

  if (lastSearch) {
    base.searchSummary = {
      requestedCount: Math.max(lastSearch.shown.length, shownBusinesses.length),
      availableCount: lastSearch.businesses.length,
      matchingCount: lastSearch.shown.length,
      shownCount: shownBusinesses.length,
      businessType: lastSearch.segment,
      regionName: lastSearch.region.name,
      appliedFilters: lastSearch.filters,
      usedCurrentContext: false,
    };
    base.conversationContext = {
      businessType: lastSearch.segment, canonicalSegment: lastSearch.segment, location: lastSearch.region.name,
      regionName: lastSearch.region.name, requestedCount: lastSearch.shown.length, appliedFilters: lastSearch.filters,
    };
    base.newRegion = { name: lastSearch.region.name, center: lastSearch.region.center, businesses: lastSearch.businesses };
  }
  return base;
}
