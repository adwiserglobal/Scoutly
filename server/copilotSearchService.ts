import { GoogleGenAI } from '@google/genai';
import { searchBusinessesAdaptive } from './adaptiveBusinessSearchService.js';
import { fetchBusinessesFromSerper } from './serperService.js';
import { interpretSearchIntent } from './searchInterpreter.js';
import { resolveSearchProfile, normalizeSearchText } from './searchProfiles.js';
import type { AIChatRequest, AIChatResponse, BusinessSummary } from './aiService.js';

const NUMBER_WORDS: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, três: 3, quatro: 4, cinco: 5,
  seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12,
  treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16,
  dezassete: 17, dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20,
};

type SearchConstraints = {
  noWebsite: boolean;
  hasWebsite: boolean;
  requirePhone: boolean;
  prioritizePhone: boolean;
  noSocial: boolean;
  hasSocial: boolean;
  requestedPipelineAdd: boolean;
};

function normalize(value: string): string {
  return normalizeSearchText(value || '').replace(/\s+/g, ' ').trim();
}

function extractRequestedCount(message: string): number | null {
  const text = normalize(message);
  const digitMatch = text.match(/\b(\d{1,3})\b/);
  if (digitMatch) {
    const parsed = Number(digitMatch[1]);
    if (Number.isFinite(parsed) && parsed > 0) return Math.min(parsed, 50);
  }

  for (const [word, value] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`(^|\\s)${word}(\\s|$)`, 'i').test(text)) return value;
  }
  return null;
}

function extractLocation(message: string): string | null {
  const match = message.match(
    /\b(?:em|no|na|nos|nas)\s+(.+?)(?=\s+(?:sem|com|prioriz|prefer|que\s+ten|e\s+(?:adicione|salve|coloque|jogue|mostre|liste|priorize)|para\s+(?:vender|prospec))\b|[,.;!?]|$)/i,
  );
  return match?.[1]?.trim() || null;
}

function parseConstraints(message: string): SearchConstraints {
  const text = normalize(message);
  const noWebsite = /\bsem (?:site|website)\b|\bnao (?:tem|possui) (?:site|website)\b|\bsite inexistente\b/.test(text);
  const hasWebsite = !noWebsite && /\bcom (?:site|website)\b|\bque (?:tem|tenham|possui|possuam) (?:site|website)\b/.test(text);

  const phoneMention = /telefone|whatsapp|contato/.test(text);
  const prioritizePhone =
    phoneMention &&
    (/prioriz/.test(text) || /prefer/.test(text) || /primeiro/.test(text) || /melhor.*contato/.test(text));
  const requirePhone =
    phoneMention &&
    !prioritizePhone &&
    (/\bcom (?:telefone|whatsapp|contato)\b|\bque (?:tem|tenham|possui|possuam) (?:telefone|whatsapp|contato)\b/.test(text));

  const noSocial = /\bsem (?:instagram|rede social|redes sociais)\b/.test(text);
  const hasSocial = !noSocial && /\bcom (?:instagram|rede social|redes sociais)\b/.test(text);
  const requestedPipelineAdd = /(adicione|adicionar|salve|salvar|coloque|jogue).{0,45}\bpipeline\b/.test(text);

  return { noWebsite, hasWebsite, requirePhone, prioritizePhone, noSocial, hasSocial, requestedPipelineAdd };
}

function hasPhone(business: BusinessSummary) {
  return Boolean(business.phone || business.phones?.some(Boolean));
}

function hasSocial(business: BusinessSummary) {
  return Boolean(business.socials?.some(Boolean));
}

function businessIdentity(business: BusinessSummary): string {
  const phone = String(business.phone || business.phones?.[0] || '').replace(/\D/g, '');
  if (phone) return `phone:${phone}`;

  const name = normalize(business.name || '');
  const address = normalize(business.address || '');
  return `name:${name}|address:${address}`;
}

function mergeBusinesses(...groups: BusinessSummary[][]): BusinessSummary[] {
  const seen = new Set<string>();
  const merged: BusinessSummary[] = [];

  for (const business of groups.flat()) {
    const key = businessIdentity(business);
    if (!business?.id || !key || seen.has(key)) continue;
    seen.add(key);
    merged.push(business);
    if (merged.length >= 300) break;
  }

  return merged;
}

function applyConstraints(results: BusinessSummary[], constraints: SearchConstraints): BusinessSummary[] {
  return results.filter((business) => {
    if (constraints.noWebsite && business.website) return false;
    if (constraints.hasWebsite && !business.website) return false;
    if (constraints.requirePhone && !hasPhone(business)) return false;
    if (constraints.noSocial && hasSocial(business)) return false;
    if (constraints.hasSocial && !hasSocial(business)) return false;
    return true;
  });
}

function rankResults(results: BusinessSummary[], constraints: SearchConstraints): BusinessSummary[] {
  return [...results].sort((a, b) => {
    const score = (business: BusinessSummary) => {
      let total = 0;
      if (constraints.prioritizePhone && hasPhone(business)) total += 100;
      if (hasPhone(business)) total += 18;
      if (business.website) total += 3;
      else total += 8;
      if (business.sources?.includes('serper')) total += 10;
      if (business.cnpj) total += 5;
      total += Math.round(Math.max(0, Math.min(1, Number(business.confidence || 0))) * 10);
      return total;
    };
    return score(b) - score(a);
  });
}

function buildAppliedFilters(constraints: SearchConstraints): string[] {
  const filters: string[] = [];
  if (constraints.noWebsite) filters.push('sem site');
  if (constraints.hasWebsite) filters.push('com site');
  if (constraints.requirePhone) filters.push('com telefone/WhatsApp');
  if (constraints.noSocial) filters.push('sem redes sociais');
  if (constraints.hasSocial) filters.push('com redes sociais');
  if (constraints.prioritizePhone) filters.push('prioridade para contato disponível');
  return filters;
}

function buildCleanQuery(message: string, currentRegionName: string) {
  const intent = interpretSearchIntent(message, currentRegionName);
  const location = extractLocation(message);
  const businessType = String(intent.businessType || '').trim() || 'negócios locais';
  const query = location ? `${businessType} em ${location}` : businessType;
  return { businessType, location, query, intent };
}

function isFollowUpWithoutSegment(message: string) {
  const text = normalize(message);
  return /^(quais|qual|desses|dessas|agora|e os|e as|mostre os|mostre as|filtre|so os|so as)\b/.test(text);
}

async function generateCopilotText(args: {
  message: string;
  businessType: string;
  regionName: string;
  availableCount: number;
  matchingCount: number;
  shownCount: number;
  requestedCount: number;
  appliedFilters: string[];
  history: AIChatRequest['history'];
}): Promise<{ text: string; modelUsed?: string }> {
  const {
    message,
    businessType,
    regionName,
    availableCount,
    matchingCount,
    shownCount,
    requestedCount,
    appliedFilters,
    history = [],
  } = args;

  const criteria = appliedFilters.length ? appliedFilters.join(', ') : 'sem filtros adicionais';
  const shortage = shownCount < requestedCount;

  const systemPrompt = `Você é a Scoutly AI, copiloto de prospecção B2B local.
O motor de dados da Scoutly já executou a busca. Você NÃO inventa empresas e NÃO escolhe os cards.
Pedido: "${message}"
Segmento: "${businessType}"
Região resolvida: "${regionName}"
Empresas encontradas antes dos critérios: ${availableCount}
Empresas que atendem aos critérios: ${matchingCount}
Meta pedida: ${requestedCount}
Cards exibidos: ${shownCount}
Critérios aplicados: ${criteria}

REGRAS:
- Responda em português do Brasil, curto e comercialmente útil.
- Nunca invente nomes, contatos ou quantidades.
- Não liste nomes de empresas no texto: os cards aparecem abaixo.
- Se foram encontrados menos resultados que a meta, diga claramente que encontrou ${shownCount} de ${requestedCount}; não trate isso como erro.
- Se houver zero resultados, sugira uma forma objetiva de ampliar ou relaxar o critério.
- Não exponha APIs, coordenadas, logs, CNPJ ou detalhes internos.
- No máximo 2 parágrafos curtos e, quando útil, uma sugestão de próxima ação.`;

  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (openRouterKey) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openRouterKey}`,
          'HTTP-Referer': process.env.APP_URL || 'https://scoutly.pro',
          'X-Title': 'Scoutly AI',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openrouter/auto',
          temperature: 0.15,
          max_tokens: 500,
          messages: [
            { role: 'system', content: systemPrompt },
            ...history.slice(-4).map((item) => ({ role: item.role, content: item.content })),
            { role: 'user', content: message },
          ],
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const data = await response.json();
        const text = String(data?.choices?.[0]?.message?.content || '').trim();
        if (text) return { text, modelUsed: 'openrouter/auto' };
      }
    } catch (error: any) {
      console.warn('[Scoutly AI] OpenRouter fallback:', error?.message || error);
    }
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `${systemPrompt}\n\nUsuário: ${message}`,
      });
      const text = (response.text || '').trim();
      if (text) return { text, modelUsed: 'gemini-2.5-flash' };
    } catch (error: any) {
      console.warn('[Scoutly AI] Gemini fallback:', error?.message || error);
    }
  }

  if (shownCount === 0) {
    return {
      text: `Não encontrei empresas que atendam a **todos os critérios** em **${regionName}**. Posso ampliar a região ou relaxar um dos filtros sem misturar resultados irrelevantes.`,
      modelUsed: 'local-fallback',
    };
  }

  const countText = shortage
    ? `Encontrei **${shownCount} de ${requestedCount}** oportunidades que realmente atendem aos critérios.`
    : `Encontrei **${shownCount} oportunidades** que atendem ao pedido.`;
  const moreText = availableCount > matchingCount
    ? ` Analisei ${availableCount} empresas antes de aplicar os filtros.`
    : '';

  return {
    text: `${countText} Os resultados estão nos cards abaixo.${moreText}`,
    modelUsed: 'local-fallback',
  };
}

export async function handleScoutlyCopilotChat({
  message,
  history = [],
  businesses = [],
  currentRegionName = 'São Paulo - SP',
  searchMode = 'default',
}: AIChatRequest): Promise<AIChatResponse> {
  const requestedCount = extractRequestedCount(message) ?? 10;
  const constraints = parseConstraints(message);
  const clean = buildCleanQuery(message, currentRegionName);

  let regionName = currentRegionName || 'São Paulo - SP';
  let regionCenter = { lat: -23.5505, lng: -46.6333 };
  let rawResults: BusinessSummary[] = [];
  let usedCurrentContext = false;

  // Natural follow-ups such as "quais desses têm telefone?" should operate on
  // the already-visible result set instead of launching an unrelated new search.
  if (businesses.length > 0 && isFollowUpWithoutSegment(message)) {
    rawResults = mergeBusinesses(businesses);
    usedCurrentContext = true;
  } else {
    const search = await searchBusinessesAdaptive(clean.query, currentRegionName || 'São Paulo - SP');
    rawResults = mergeBusinesses(search.businesses);
    regionName = search.region.name;
    regionCenter = search.region.center;

    let matching = applyConstraints(rawResults, constraints);

    // If the canonical index is sparse for the requested criteria, enrich it
    // with local web results. Deep Search always performs this augmentation.
    if (searchMode === 'deep' || matching.length < requestedCount) {
      try {
        const external = await fetchBusinessesFromSerper(
          `${clean.businessType} em ${regionName}`,
          regionCenter.lat,
          regionCenter.lng,
        );
        rawResults = mergeBusinesses(rawResults, external);
        matching = applyConstraints(rawResults, constraints);
      } catch (error: any) {
        console.warn('[Scoutly AI] External augmentation unavailable:', error?.message || error);
      }
    }

    // One synonym retry gives sparse niches (e.g. despachante/documentalista)
    // better recall without turning a normal chat request into a long agent job.
    if (matching.length < requestedCount) {
      const profile = resolveSearchProfile(clean.businessType, message);
      const alias = profile?.aliases
        .map((value) => value.trim())
        .find((value) => normalize(value) !== normalize(clean.businessType));

      if (alias) {
        try {
          const retryQuery = clean.location ? `${alias} em ${clean.location}` : alias;
          const retry = await searchBusinessesAdaptive(retryQuery, currentRegionName || 'São Paulo - SP');
          rawResults = mergeBusinesses(rawResults, retry.businesses);
          regionName = retry.region.name || regionName;
          regionCenter = retry.region.center || regionCenter;
        } catch (error: any) {
          console.warn('[Scoutly AI] Synonym retry unavailable:', error?.message || error);
        }
      }
    }
  }

  const availableCount = rawResults.length;
  const constrained = applyConstraints(rawResults, constraints);
  const ranked = rankResults(constrained, constraints);
  const shown = ranked.slice(0, Math.min(requestedCount, ranked.length));
  const matchedBusinessIds = shown.map((business) => business.id);
  const appliedFilters = buildAppliedFilters(constraints);

  const generated = await generateCopilotText({
    message,
    businessType: clean.businessType,
    regionName,
    availableCount,
    matchingCount: ranked.length,
    shownCount: shown.length,
    requestedCount,
    appliedFilters,
    history,
  });

  return {
    text: generated.text,
    matchedBusinessIds,
    modelUsed: generated.modelUsed,
    searchSummary: {
      requestedCount,
      availableCount,
      matchingCount: ranked.length,
      shownCount: shown.length,
      businessType: clean.businessType,
      regionName,
      appliedFilters,
      usedCurrentContext,
    },
    suggestedAction:
      constraints.requestedPipelineAdd && matchedBusinessIds.length > 0
        ? { type: 'add_to_pipeline', businessIds: matchedBusinessIds }
        : undefined,
    newRegion: usedCurrentContext
      ? undefined
      : {
          name: regionName,
          center: regionCenter,
          businesses: rawResults,
        },
  };
}
