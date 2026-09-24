import { runScoutlyBusinessSearch } from './searchFacade.js';
import { interpretSearchIntent } from './searchInterpreter.js';
import {
  SEARCH_PROFILES,
  normalizeSearchText,
  resolveSearchProfile,
  scoreAgainstProfile,
  type SearchProfile,
} from './searchProfiles.js';
import type { AIChatRequest, AIChatResponse, BusinessSummary, ChatMessage } from './aiService.js';

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

export type AgenticConversationContext = {
  businessType?: string;
  canonicalSegment?: string;
  location?: string | null;
  regionName?: string;
  requestedCount?: number;
  appliedFilters?: string[];
};

type AgenticChatRequest = AIChatRequest & {
  conversationContext?: AgenticConversationContext | null;
};

type AgenticChatResponse = AIChatResponse & {
  conversationContext?: AgenticConversationContext;
};

type SearchPlan = {
  profile: SearchProfile | null;
  directProfile: SearchProfile | null;
  explicitLocation: string | null;
  businessType: string;
  canonicalSegment: string;
  query: string;
  isContextualFollowUp: boolean;
};

function normalize(value: string): string {
  return normalizeSearchText(value || '').replace(/\s+/g, ' ').trim();
}

function canonicalizeLocation(value?: string | null): string | null {
  let clean = String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/^[,.;\s]+|[,.;\s]+$/g, '')
    .trim();

  if (!clean) return null;

  const normalized = normalize(clean);
  if (normalized === 'sp') return 'São Paulo - SP';
  if (normalized === 'rj') return 'Rio de Janeiro - RJ';

  const emParts = clean.split(/\s+em\s+/i).map((part) => part.trim()).filter(Boolean);
  if (emParts.length > 1) {
    const first = normalize(emParts[0]);
    if (first && emParts.slice(1).every((part) => normalize(part) === first)) {
      clean = emParts[0];
    }
  }

  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && words.length % 2 === 0) {
    const half = words.length / 2;
    if (normalize(words.slice(0, half).join(' ')) === normalize(words.slice(half).join(' '))) {
      clean = words.slice(0, half).join(' ');
    }
  }

  return clean.trim() || null;
}

function extractRequestedCount(message: string): number | null {
  const text = normalize(message);
  const digit = text.match(/\b(\d{1,3})\b/);
  if (digit) {
    const value = Number(digit[1]);
    if (Number.isFinite(value) && value > 0) return Math.min(value, 50);
  }

  for (const [word, value] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`(^|\\s)${word}(\\s|$)`, 'i').test(text)) return value;
  }
  return null;
}

function extractExplicitLocation(message: string): string | null {
  const match = message.match(
    /\b(?:em|no|na|nos|nas|perto\s+de|perto\s+do|perto\s+da|regi[aã]o\s+de)\s+(.+?)(?=\s+(?:sem|com|prioriz|prefer|que\s+ten|e\s+que\s+ten|para\s+(?:vender|prospec)|e\s+(?:adicione|salve|coloque|jogue|mostre|liste|priorize))\b|[,.;!?]|$)/i,
  );
  return canonicalizeLocation(match?.[1]);
}

function parseConstraints(message: string): SearchConstraints {
  const text = normalize(message);
  const noWebsite = /\bsem (?:site|website)\b|\bnao (?:tem|possui) (?:site|website)\b/.test(text);
  const hasWebsite = !noWebsite && /\bcom (?:site|website)\b|\bque (?:tem|tenham|possui|possuam) (?:site|website)\b/.test(text);
  const phoneMention = /telefone|whatsapp|contato/.test(text);
  const prioritizePhone = phoneMention && (/prioriz/.test(text) || /prefer/.test(text) || /primeiro/.test(text));
  const requirePhone = phoneMention && !prioritizePhone && /\bcom (?:telefone|whatsapp|contato)\b|\bque (?:tem|tenham|possui|possuam) (?:telefone|whatsapp|contato)\b/.test(text);
  const noSocial = /\bsem (?:instagram|rede social|redes sociais)\b/.test(text);
  const hasSocial = !noSocial && /\bcom (?:instagram|rede social|redes sociais)\b/.test(text);
  const requestedPipelineAdd = /(adicione|adicionar|salve|salvar|coloque|jogue).{0,45}\bpipeline\b/.test(text);
  return { noWebsite, hasWebsite, requirePhone, prioritizePhone, noSocial, hasSocial, requestedPipelineAdd };
}

function levenshtein(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    for (let j = 0; j < current.length; j += 1) previous[j] = current[j];
  }
  return previous[b.length];
}

function resolveProfileWithTypos(message: string): SearchProfile | null {
  const exact = resolveSearchProfile(message);
  if (exact) return exact;

  const text = normalize(message);
  const words = text.split(' ').filter((word) => word.length >= 4);
  let best: { profile: SearchProfile; distance: number; length: number } | null = null;

  for (const profile of SEARCH_PROFILES) {
    for (const rawAlias of profile.aliases) {
      const alias = normalize(rawAlias);
      if (!alias || alias.includes(' ')) continue;

      for (const word of words) {
        if (Math.abs(word.length - alias.length) > 2) continue;
        const distance = levenshtein(word, alias);
        const allowed = alias.length >= 9 ? 2 : 1;
        if (distance > allowed) continue;
        if (!best || distance < best.distance || (distance === best.distance && alias.length > best.length)) {
          best = { profile, distance, length: alias.length };
        }
      }
    }
  }

  return best?.profile || null;
}

function previousUserMessages(history: ChatMessage[] = [], currentMessage: string): string[] {
  const current = normalize(currentMessage);
  let skippedCurrent = false;
  const previous: string[] = [];

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const item = history[index];
    if (item?.role !== 'user' || !item.content?.trim()) continue;
    const content = item.content.trim();
    if (!skippedCurrent && normalize(content) === current) {
      skippedCurrent = true;
      continue;
    }
    previous.push(content);
  }

  return previous;
}

function profileFromContext(context?: AgenticConversationContext | null): SearchProfile | null {
  if (!context) return null;
  return resolveSearchProfile(context.canonicalSegment || context.businessType || '') || null;
}

function profileFromHistory(history: ChatMessage[] = [], currentMessage: string): SearchProfile | null {
  for (const previous of previousUserMessages(history, currentMessage)) {
    const profile = resolveProfileWithTypos(previous);
    if (profile) return profile;
  }
  return null;
}

function locationFromHistory(history: ChatMessage[] = [], currentMessage: string): string | null {
  for (const previous of previousUserMessages(history, currentMessage)) {
    const location = extractExplicitLocation(previous);
    if (location) return location;
  }
  return null;
}

function looksLikeFollowUp(message: string): boolean {
  const text = normalize(message);
  return /^(agora|e\b|mais\b|desses|dessas|dentre|so\b|somente|filtre|quais|mostre os|mostre as|entao|tambem|também|troque|mude)\b/.test(text)
    || text.split(' ').length <= 6;
}

function extractGenericBusinessPhrase(message: string, explicitLocation: string | null): string {
  let value = normalize(message)
    .replace(/^(?:por favor\s+)?(?:continue\s+(?:minha\s+)?busca\s+por\s+|(?:me\s+)?(?:liste|lista|encontre|encontrar|ache|buscar|busque|mostre|quero|procure)\s+)/i, '')
    .replace(/^(?:agora|entao|tambem|também)\s+/i, '')
    .replace(/^\d{1,3}\s+/, '')
    .replace(/\b(?:um|uma|dois|duas|tres|três|quatro|cinco|seis|sete|oito|nove|dez)\b\s*/i, '')
    .trim();

  if (explicitLocation) {
    const marker = normalize(explicitLocation);
    const index = value.indexOf(` em ${marker}`);
    if (index > 0) value = value.slice(0, index);
  }

  value = value
    .replace(/\s+(?:sem|com)\s+(?:site|website|telefone|whatsapp|contato|instagram|rede social|redes sociais).*$/i, '')
    .trim();

  return value || 'negócios locais';
}

function buildSearchPlan(
  message: string,
  currentRegionName: string,
  history: ChatMessage[] = [],
  conversationContext?: AgenticConversationContext | null,
): SearchPlan {
  const directProfile = resolveProfileWithTypos(message);
  const contextualProfile = profileFromContext(conversationContext);
  const historicalProfile = profileFromHistory(history, message);
  const explicitLocation = extractExplicitLocation(message);
  const contextualFollowUp = !directProfile && looksLikeFollowUp(message) && Boolean(contextualProfile || historicalProfile || conversationContext?.businessType);
  const profile = directProfile || (contextualFollowUp ? contextualProfile || historicalProfile : null);
  const interpreted = interpretSearchIntent(message, currentRegionName);
  const genericPhrase = extractGenericBusinessPhrase(message, explicitLocation);

  let businessType = directProfile?.label || '';
  if (!businessType && contextualFollowUp) {
    businessType = profile?.label || conversationContext?.businessType || '';
  }
  if (!businessType && interpreted.businessType && interpreted.businessType !== 'estabelecimento') {
    businessType = interpreted.businessType;
  }
  if (!businessType) businessType = genericPhrase;

  const canonicalSegment =
    directProfile?.aliases?.[0]
    || (contextualFollowUp ? profile?.aliases?.[0] || conversationContext?.canonicalSegment : undefined)
    || profile?.aliases?.[0]
    || businessType;

  const inheritedLocation = canonicalizeLocation(conversationContext?.location)
    || locationFromHistory(history, message)
    || canonicalizeLocation(conversationContext?.regionName);

  const effectiveLocation = explicitLocation || (contextualFollowUp ? inheritedLocation : null);
  const query = effectiveLocation ? `${canonicalSegment} em ${effectiveLocation}` : canonicalSegment;

  return {
    profile,
    directProfile,
    explicitLocation,
    businessType,
    canonicalSegment,
    query,
    isContextualFollowUp: contextualFollowUp,
  };
}

function locationMatches(requested: string, resolvedRegion: string): boolean {
  const canonicalRequested = canonicalizeLocation(requested);
  if (!canonicalRequested) return false;
  const requestedTokens = normalize(canonicalRequested).split(' ').filter((token) => token.length >= 2 && token !== 'brasil');
  const region = normalize(resolvedRegion);
  return requestedTokens.length > 0 && requestedTokens.every((token) => region.includes(token));
}

function hasPhone(business: BusinessSummary): boolean {
  return Boolean(business.phone || business.phones?.some(Boolean));
}

function hasSocial(business: BusinessSummary): boolean {
  return Boolean(business.socials?.some(Boolean));
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

function getAppliedFilters(constraints: SearchConstraints): string[] {
  const filters: string[] = [];
  if (constraints.noWebsite) filters.push('sem site identificado');
  if (constraints.hasWebsite) filters.push('com site');
  if (constraints.requirePhone) filters.push('com telefone/WhatsApp');
  if (constraints.noSocial) filters.push('sem redes sociais identificadas');
  if (constraints.hasSocial) filters.push('com redes sociais');
  if (constraints.prioritizePhone) filters.push('prioridade para contato disponível');
  return filters;
}

function isFilterOnlyFollowUp(message: string, hasDirectProfile: boolean, explicitLocation: string | null): boolean {
  if (hasDirectProfile || explicitLocation) return false;
  const text = normalize(message);
  return /^(agora|desses|dessas|dentre|so|somente|filtre|quais|mostre os|mostre as|mais)\b/.test(text);
}

function responseText(args: {
  businessType: string;
  regionName: string;
  requestedCount: number;
  searchCount: number;
  segmentCount: number;
  matchingCount: number;
  shownCount: number;
}): string {
  if (args.searchCount === 0) {
    return `A busca da Scoutly não retornou resultados para **${args.businessType} em ${args.regionName}** agora.`;
  }
  if (args.segmentCount === 0) {
    return `A busca retornou ${args.searchCount} registros, mas **nenhum deles foi validado como ${args.businessType}**. Descartei resultados de outros segmentos para não misturar empresas irrelevantes.`;
  }
  if (args.matchingCount === 0) {
    return `Encontrei **${args.segmentCount} ${args.businessType.toLowerCase()}** em **${args.regionName}**, mas nenhum atende aos filtros adicionais pedidos.`;
  }
  if (args.shownCount < args.requestedCount) {
    return `Encontrei **${args.shownCount} de ${args.requestedCount}** resultados que atendem ao pedido em **${args.regionName}**.`;
  }
  return `Encontrei **${args.shownCount} resultados** que atendem ao pedido em **${args.regionName}**.`;
}

export async function handleScoutlyAgenticChat({
  message,
  history = [],
  businesses = [],
  currentRegionName = 'São Paulo - SP',
  conversationContext = null,
}: AgenticChatRequest): Promise<AgenticChatResponse> {
  const requestedCount = extractRequestedCount(message) ?? conversationContext?.requestedCount ?? 10;
  const constraints = parseConstraints(message);
  const filters = getAppliedFilters(constraints);
  const plan = buildSearchPlan(message, currentRegionName, history, conversationContext);
  const useCurrentContext = businesses.length > 0 && isFilterOnlyFollowUp(
    message,
    Boolean(plan.directProfile),
    plan.explicitLocation,
  );

  let regionName = conversationContext?.regionName || currentRegionName;
  let regionCenter = { lat: -23.5505, lng: -46.6333 };
  let searched: BusinessSummary[] = [];

  if (useCurrentContext) {
    searched = [...businesses];
  } else {
    const result = await runScoutlyBusinessSearch(plan.query, currentRegionName);
    regionName = result.region?.name || currentRegionName;
    regionCenter = result.region?.center || regionCenter;
    searched = Array.isArray(result.businesses) ? result.businesses : [];

    if (plan.explicitLocation && !locationMatches(plan.explicitLocation, regionName)) {
      return {
        text: `Não consegui localizar **${plan.explicitLocation}** nesta busca. Tente informar também o estado.`,
        matchedBusinessIds: [],
        modelUsed: 'searchbar-orchestrator-v3',
        searchSummary: {
          requestedCount,
          availableCount: 0,
          matchingCount: 0,
          shownCount: 0,
          businessType: plan.businessType,
          regionName: plan.explicitLocation,
          appliedFilters: filters,
          usedCurrentContext: false,
        },
        conversationContext: conversationContext || {
          businessType: plan.businessType,
          canonicalSegment: plan.canonicalSegment,
          location: plan.explicitLocation,
          regionName: currentRegionName,
          requestedCount,
          appliedFilters: filters,
        },
      };
    }
  }

  const segmentSafe = plan.profile
    ? searched.filter((business) => scoreAgainstProfile({
        name: business.name,
        category: business.category,
        basicCategory: business.basicCategory,
        taxonomyPrimary: business.taxonomyPrimary,
      }, plan.profile!) > 0)
    : searched;

  let matching = applyConstraints(segmentSafe, constraints);
  if (constraints.prioritizePhone) {
    matching = [...matching].sort((a, b) => Number(hasPhone(b)) - Number(hasPhone(a)));
  }

  const shown = matching.slice(0, Math.min(requestedCount, matching.length));
  const matchedBusinessIds = shown.map((business) => business.id);
  const nextLocation = plan.explicitLocation
    || canonicalizeLocation(regionName)
    || conversationContext?.location
    || null;

  return {
    text: responseText({
      businessType: plan.businessType,
      regionName,
      requestedCount,
      searchCount: searched.length,
      segmentCount: segmentSafe.length,
      matchingCount: matching.length,
      shownCount: shown.length,
    }),
    matchedBusinessIds,
    modelUsed: 'searchbar-orchestrator-v3',
    searchSummary: {
      requestedCount,
      availableCount: segmentSafe.length,
      matchingCount: matching.length,
      shownCount: shown.length,
      businessType: plan.businessType,
      regionName,
      appliedFilters: filters,
      usedCurrentContext: useCurrentContext,
    },
    conversationContext: {
      businessType: plan.businessType,
      canonicalSegment: plan.canonicalSegment,
      location: nextLocation,
      regionName,
      requestedCount,
      appliedFilters: filters,
    },
    suggestedAction:
      constraints.requestedPipelineAdd && matchedBusinessIds.length > 0
        ? { type: 'add_to_pipeline', businessIds: matchedBusinessIds }
        : undefined,
    newRegion: useCurrentContext
      ? undefined
      : {
          name: regionName,
          center: regionCenter,
          businesses: segmentSafe,
        },
  };
}
