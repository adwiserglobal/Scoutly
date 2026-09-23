import { GoogleGenAI } from '@google/genai';
import { searchBusinessesAdaptive } from './adaptiveBusinessSearchService.js';
import { fetchBusinessesFromSerper } from './serperService.js';
import type { AIChatRequest, AIChatResponse, BusinessSummary } from './aiService.js';

const NUMBER_WORDS: Record<string, number> = {
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  três: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  quatorze: 14,
  catorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezassete: 17,
  dezessete: 17,
  dezoito: 18,
  dezenove: 19,
  vinte: 20,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
};

function normalize(value: string): string {
  return (value || '').toLowerCase().replace(/[^a-záàâãéêíóôõúç0-9\s-]/gi, ' ').replace(/\s+/g, ' ').trim();
}

function extractRequestedCount(message: string): number | null {
  const text = normalize(message);

  // Prefer an explicit number close to a result-oriented noun/verb.
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

function businessIdentity(business: BusinessSummary): string {
  const name = normalize(business.name || '');
  const address = normalize(business.address || '');
  const phone = String(business.phone || business.phones?.[0] || '').replace(/\D/g, '');
  if (phone) return `phone:${phone}`;
  return `name:${name}|address:${address}`;
}

function mergeBusinesses(primary: BusinessSummary[], secondary: BusinessSummary[]): BusinessSummary[] {
  const seen = new Set<string>();
  const merged: BusinessSummary[] = [];

  for (const business of [...primary, ...secondary]) {
    const key = businessIdentity(business);
    if (!business.id || seen.has(key)) continue;
    seen.add(key);
    merged.push(business);
    if (merged.length >= 300) break;
  }

  return merged;
}

async function generateCopilotText(args: {
  message: string;
  businessType: string;
  regionName: string;
  availableCount: number;
  shownCount: number;
  history: AIChatRequest['history'];
}): Promise<{ text: string; modelUsed?: string }> {
  const { message, businessType, regionName, availableCount, shownCount, history = [] } = args;

  const systemPrompt = `Você é o Scoutly AI, copiloto de prospecção B2B local.
A busca já foi executada pelo motor de dados da Scoutly. Não invente empresas e não decida quais cards serão exibidos.
Consulta: "${message}"
Segmento interpretado: "${businessType}"
Região: "${regionName}"
Resultados reais disponíveis: ${availableCount}
Cards que a interface vai exibir agora: ${shownCount}

Responda de forma curta e útil em português do Brasil. Diga que os ${shownCount} resultados estão nos cards abaixo. Se houver mais resultados disponíveis, mencione que a busca encontrou mais opções na região. Não liste nomes de empresas no texto. Não exponha coordenadas, CNPJ, logs, APIs ou detalhes internos. Se fizer sentido, acrescente uma sugestão breve de abordagem comercial.`;

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
      console.warn('[Scoutly Copilot] Gemini failed:', error?.message || error);
    }
  }

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
          temperature: 0.2,
          max_tokens: 700,
          messages: [
            { role: 'system', content: systemPrompt },
            ...history.slice(-4).map((item) => ({ role: item.role, content: item.content })),
            { role: 'user', content: message },
          ],
        }),
        signal: AbortSignal.timeout(12000),
      });

      if (response.ok) {
        const data = await response.json();
        const text = String(data?.choices?.[0]?.message?.content || '').trim();
        if (text) return { text, modelUsed: 'openrouter/auto' };
      }
    } catch (error: any) {
      console.warn('[Scoutly Copilot] OpenRouter failed:', error?.message || error);
    }
  }

  const suffix = availableCount > shownCount
    ? ` A busca encontrou ${availableCount} opções no total nessa região.`
    : '';

  return {
    text: `Encontrei **${shownCount} ${businessType.toLowerCase()}** para você. Os resultados estão nos cards abaixo.${suffix}`,
    modelUsed: 'local-fallback',
  };
}

export async function handleScoutlyCopilotChat({
  message,
  history = [],
  currentRegionName = 'São Paulo - SP',
  searchMode = 'default',
}: AIChatRequest): Promise<AIChatResponse> {
  const requestedCount = extractRequestedCount(message);
  const desiredCount = requestedCount ?? 10;

  const search = await searchBusinessesAdaptive(message, currentRegionName || 'São Paulo - SP');
  let results: BusinessSummary[] = search.businesses;

  // Deep mode augments the canonical Scoutly index instead of replacing it. This
  // keeps the search reliable even when an external provider is unavailable.
  if (searchMode === 'deep') {
    try {
      const external = await fetchBusinessesFromSerper(
        `${search.businessType} em ${search.region.name}`,
        search.region.center.lat,
        search.region.center.lng
      );
      results = mergeBusinesses(results, external);
    } catch (error: any) {
      console.warn('[Scoutly Copilot] Deep-search augmentation failed:', error?.message || error);
    }
  }

  const shown = results.slice(0, Math.min(desiredCount, results.length));
  const matchedBusinessIds = shown.map((business) => business.id);

  if (results.length === 0) {
    return {
      text: `Não encontrei resultados confiáveis para **${search.businessType}** em **${search.region.name}**. Tente ampliar a região ou usar um termo relacionado.`,
      matchedBusinessIds: [],
      modelUsed: 'local-fallback',
      newRegion: {
        name: search.region.name,
        center: search.region.center,
        businesses: [],
      },
    };
  }

  const generated = await generateCopilotText({
    message,
    businessType: search.businessType,
    regionName: search.region.name,
    availableCount: results.length,
    shownCount: shown.length,
    history,
  });

  return {
    text: generated.text,
    matchedBusinessIds,
    modelUsed: generated.modelUsed,
    newRegion: {
      name: search.region.name,
      center: search.region.center,
      businesses: results,
    },
  };
}
