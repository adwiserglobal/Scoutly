import { searchBusinessesAdaptive } from './adaptiveBusinessSearchService.js';
import { fetchBusinessesFromSerper } from './serperService.js';
import { queryOsmPlacesInBBox } from './osmPlacesService.js';
import { interpretSearchIntent } from './searchInterpreter.js';
import { resolveSearchGeography, type ResolvedSearchGeography } from './geographyService.js';
import {
  normalizeSearchText,
  resolveSearchProfile,
  scoreAgainstProfile,
  type SearchProfile,
} from './searchProfiles.js';
import type { AIChatRequest, BusinessSummary } from './aiService.js';
import type { OverturePlace } from './overtureService.js';

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

type TraceEntry = {
  stage: string;
  status: 'completed' | 'warning';
  detail?: string;
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

function extractExplicitLocation(message: string): string | null {
  const match = message.match(
    /\b(?:em|no|na|nos|nas|perto\s+de|perto\s+do|perto\s+da|regi[aã]o\s+de)\s+(.+?)(?=\s+(?:sem|com|prioriz|prefer|que\s+ten|e\s+que\s+ten|para\s+(?:vender|prospec)|e\s+(?:adicione|salve|coloque|jogue|mostre|liste|priorize))\b|[,.;!?]|$)/i,
  );
  return match?.[1]?.trim().replace(/[.!?;]+$/, '').trim() || null;
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

function hasPhone(business: BusinessSummary): boolean {
  return Boolean(business.phone || business.phones?.some(Boolean));
}

function hasSocial(business: BusinessSummary): boolean {
  return Boolean(business.socials?.some(Boolean));
}

function withinBounds(business: BusinessSummary, bbox: ResolvedSearchGeography['bbox']): boolean {
  const lat = Number(business.lat ?? business.coordinates?.lat);
  const lng = Number(business.lng ?? business.coordinates?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  const tolerance = 0.0025;
  return lat >= bbox.south - tolerance && lat <= bbox.north + tolerance && lng >= bbox.west - tolerance && lng <= bbox.east + tolerance;
}

function explicitLocationMatches(explicitLocation: string, geography: ResolvedSearchGeography): boolean {
  const target = normalize(explicitLocation)
    .replace(/\bbrasil\b/g, '')
    .replace(/\b(?:ac|al|ap|am|ba|ce|df|es|go|ma|mt|ms|mg|pa|pb|pr|pe|pi|rj|rn|rs|ro|rr|sc|sp|se|to)\b$/g, '')
    .trim();
  if (!target) return false;

  const candidates = [geography.bairro, geography.cidade, geography.rawName, geography.query]
    .map(normalize)
    .filter(Boolean);
  if (candidates.some((candidate) => candidate === target || candidate.startsWith(`${target} `) || candidate.includes(target))) {
    return true;
  }

  const tokens = target.split(' ').filter((token) => token.length >= 3);
  return tokens.length > 0 && candidates.some((candidate) => tokens.every((token) => candidate.includes(token)));
}

function segmentScore(business: BusinessSummary, profile: SearchProfile | null): number {
  if (!profile) return 1;
  return scoreAgainstProfile({
    name: business.name,
    category: business.category,
    basicCategory: business.basicCategory,
    taxonomyPrimary: business.taxonomyPrimary,
  }, profile);
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

function businessIdentity(business: BusinessSummary): string {
  const phone = String(business.phone || business.phones?.[0] || '').replace(/\D/g, '');
  if (phone.length >= 8) return `phone:${phone}`;
  const name = normalize(business.name || '');
  const lat = Number(business.lat ?? business.coordinates?.lat);
  const lng = Number(business.lng ?? business.coordinates?.lng);
  const place = Number.isFinite(lat) && Number.isFinite(lng)
    ? `${lat.toFixed(3)}:${lng.toFixed(3)}`
    : normalize(business.address || '');
  return `name:${name}|place:${place}`;
}

function mergeBusinesses(...groups: BusinessSummary[][]): BusinessSummary[] {
  const merged = new Map<string, BusinessSummary>();
  for (const business of groups.flat()) {
    if (!business?.id || !business?.name) continue;
    const key = businessIdentity(business);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, business);
      continue;
    }
    merged.set(key, {
      ...existing,
      ...business,
      id: existing.id,
      website: existing.website || business.website || null,
      phone: existing.phone || business.phone || null,
      phones: Array.from(new Set([...(existing.phones || []), ...(business.phones || [])].filter(Boolean))),
      emails: Array.from(new Set([...(existing.emails || []), ...(business.emails || [])].filter(Boolean))),
      socials: Array.from(new Set([...(existing.socials || []), ...(business.socials || [])].filter(Boolean))),
      sources: Array.from(new Set([...(existing.sources || []), ...(business.sources || [])])),
      confidence: Math.max(Number(existing.confidence || 0), Number(business.confidence || 0)),
    });
  }
  return Array.from(merged.values()).slice(0, 400);
}

function osmPlaceToSummary(place: OverturePlace): BusinessSummary {
  return {
    id: place.id,
    name: place.name,
    category: place.category,
    basicCategory: place.basicCategory,
    taxonomyPrimary: place.taxonomyPrimary,
    taxonomyHierarchy: place.taxonomyHierarchy,
    taxonomyAlternates: place.taxonomyAlternates,
    address: place.address,
    lat: place.latitude,
    lng: place.longitude,
    coordinates: { lat: place.latitude, lng: place.longitude },
    website: place.website || null,
    phone: place.phone || place.phones?.[0] || null,
    phones: place.phones || [],
    emails: place.emails || [],
    socials: place.socials || [],
    confidence: Math.min(0.84, Number(place.confidence || 0.78)),
    leadStatus: 'NOVO',
    notes: '',
    sources: ['openstreetmap'],
    hasCoordinates: true,
  };
}

function rankResults(results: BusinessSummary[], constraints: SearchConstraints, profile: SearchProfile | null): BusinessSummary[] {
  const score = (business: BusinessSummary) => {
    let total = segmentScore(business, profile) * 2;
    total += Math.min(new Set(business.sources || []).size, 3) * 12;
    total += Math.round(Math.max(0, Math.min(1, Number(business.confidence || 0))) * 20);
    if (hasPhone(business)) total += constraints.prioritizePhone ? 80 : 18;
    if (business.website) total += constraints.hasWebsite ? 25 : 2;
    if (!business.website && constraints.noWebsite) total += 18;
    if (business.cnpj) total += 8;
    return total;
  };
  return [...results].sort((a, b) => score(b) - score(a));
}

function appliedFilters(constraints: SearchConstraints): string[] {
  const filters: string[] = [];
  if (constraints.noWebsite) filters.push('site não identificado');
  if (constraints.hasWebsite) filters.push('com site');
  if (constraints.requirePhone) filters.push('com telefone/WhatsApp');
  if (constraints.noSocial) filters.push('redes sociais não identificadas');
  if (constraints.hasSocial) filters.push('com redes sociais');
  if (constraints.prioritizePhone) filters.push('prioridade para contato disponível');
  return filters;
}

function isContextualFollowUp(message: string, hasProfile: boolean, explicitLocation: string | null): boolean {
  if (hasProfile || explicitLocation) return false;
  return /^(quais|qual|desses|dessas|agora|e os|e as|mostre os|mostre as|filtre|so os|so as|somente|dentre eles|dentre elas)\b/.test(normalize(message));
}

function responseText(args: {
  businessType: string;
  regionName: string;
  requestedCount: number;
  availableCount: number;
  matchingCount: number;
  shownCount: number;
  constraints: SearchConstraints;
  locationError?: string;
}): string {
  if (args.locationError) {
    return `Não consegui **validar ${args.locationError} com segurança** nesta execução. Para não misturar regiões, interrompi a busca em vez de usar a cidade que já estava aberta no mapa. Tente novamente ou informe cidade e UF.`;
  }
  if (args.availableCount === 0) {
    return `Não consegui **confirmar resultados de ${args.businessType} em ${args.regionName}** nas fontes consultadas agora. Isso não significa que essas empresas não existam; significa que a Scoutly não conseguiu validá-las sem arriscar dados incorretos.`;
  }
  if (args.matchingCount === 0) {
    return `Confirmei **${args.availableCount} empresas de ${args.businessType} em ${args.regionName}**, mas nenhuma passou por todos os critérios pedidos. Posso relaxar um critério sem trocar de região.`;
  }
  const count = args.shownCount < args.requestedCount
    ? `Encontrei **${args.shownCount} de ${args.requestedCount}** resultados que consegui validar`
    : `Encontrei **${args.shownCount} resultados validados**`;
  const evidence = args.constraints.noWebsite
    ? ' “Site não identificado” significa que nenhuma URL foi encontrada nas fontes consultadas, não uma garantia absoluta de inexistência.'
    : '';
  return `${count} para **${args.businessType} em ${args.regionName}**. Os cards abaixo passaram pela validação de segmento e região.${evidence}`;
}

export async function handleScoutlyAgenticChat({
  message,
  businesses = [],
  currentRegionName = 'São Paulo - SP',
}: AIChatRequest): Promise<any> {
  const requestedCount = extractRequestedCount(message) ?? 10;
  const constraints = parseConstraints(message);
  const filters = appliedFilters(constraints);
  const explicitLocation = extractExplicitLocation(message);
  const profile = resolveSearchProfile(message);
  const interpreted = interpretSearchIntent(message, currentRegionName);
  const businessType = profile?.label || String(interpreted.businessType || '').trim() || 'Negócios locais';
  const trace: TraceEntry[] = [{ stage: 'intent', status: 'completed', detail: `${businessType}${explicitLocation ? ` em ${explicitLocation}` : ''}` }];
  const useCurrentContext = businesses.length > 0 && isContextualFollowUp(message, Boolean(profile), explicitLocation);

  const geographyQuery = explicitLocation ? `${businessType} em ${explicitLocation}` : (useCurrentContext ? currentRegionName : businessType);
  const geography = await resolveSearchGeography(geographyQuery, currentRegionName);

  if (explicitLocation && !explicitLocationMatches(explicitLocation, geography)) {
    trace.push({ stage: 'location', status: 'warning', detail: `Não foi possível confirmar “${explicitLocation}” sem fallback.` });
    return {
      text: responseText({ businessType, regionName: explicitLocation, requestedCount, availableCount: 0, matchingCount: 0, shownCount: 0, constraints, locationError: explicitLocation }),
      matchedBusinessIds: [],
      modelUsed: 'agentic-deterministic-v2',
      searchSummary: {
        requestedCount, availableCount: 0, matchingCount: 0, shownCount: 0,
        businessType, regionName: explicitLocation, appliedFilters: filters, usedCurrentContext: false,
        sourceCount: 0, sourcesUsed: [], locationVerified: false, searchStatus: 'location_error',
      },
      executionTrace: trace,
    };
  }

  trace.push({ stage: 'location', status: 'completed', detail: `Região validada: ${geography.rawName}` });
  let candidates: BusinessSummary[] = [];
  const sourcesUsed = new Set<string>();

  if (useCurrentContext) {
    candidates = mergeBusinesses(businesses)
      .filter((business) => withinBounds(business, geography.bbox))
      .filter((business) => segmentScore(business, profile) > 0);
    sourcesUsed.add('contexto atual');
  } else {
    const searchQuery = explicitLocation ? `${businessType} em ${explicitLocation}` : businessType;
    try {
      const primary = await searchBusinessesAdaptive(searchQuery, geography.rawName);
      const valid = primary.businesses
        .filter((business) => withinBounds(business, geography.bbox))
        .filter((business) => segmentScore(business, profile) > 0);
      candidates = mergeBusinesses(candidates, valid);
      valid.forEach((business) => (business.sources || []).forEach((source) => sourcesUsed.add(source)));
      trace.push({ stage: 'primary_search', status: 'completed', detail: `${valid.length} resultados validados` });
    } catch (error: any) {
      trace.push({ stage: 'primary_search', status: 'warning', detail: error?.message || 'Busca principal indisponível' });
    }

    if (applyConstraints(candidates, constraints).length < requestedCount) {
      try {
        const osm = await queryOsmPlacesInBBox(geography.bbox.west, geography.bbox.south, geography.bbox.east, geography.bbox.north, 1800);
        const valid = osm.places
          .map(osmPlaceToSummary)
          .filter((business) => withinBounds(business, geography.bbox))
          .filter((business) => segmentScore(business, profile) > 0);
        candidates = mergeBusinesses(candidates, valid);
        if (valid.length) sourcesUsed.add('openstreetmap');
        trace.push({ stage: 'osm_fallback', status: 'completed', detail: `${valid.length} resultados adicionais` });
      } catch (error: any) {
        trace.push({ stage: 'osm_fallback', status: 'warning', detail: error?.message || 'OSM indisponível' });
      }
    }

    if (applyConstraints(candidates, constraints).length < requestedCount && profile) {
      const aliases = profile.aliases
        .filter((alias) => normalize(alias) !== normalize(businessType))
        .slice(0, 2);
      for (const alias of aliases) {
        if (applyConstraints(candidates, constraints).length >= requestedCount) break;
        try {
          const retry = await searchBusinessesAdaptive(`${alias} em ${geography.rawName}`, geography.rawName);
          const valid = retry.businesses
            .filter((business) => withinBounds(business, geography.bbox))
            .filter((business) => segmentScore(business, profile) > 0);
          candidates = mergeBusinesses(candidates, valid);
          valid.forEach((business) => (business.sources || []).forEach((source) => sourcesUsed.add(source)));
        } catch (error: any) {
          console.warn('[Scoutly Agentic] Alias retry unavailable:', alias, error?.message || error);
        }
      }
      trace.push({ stage: 'alias_recall', status: 'completed', detail: 'Variações do segmento verificadas' });
    }

    if (applyConstraints(candidates, constraints).length < requestedCount) {
      try {
        const external = await fetchBusinessesFromSerper(`${businessType} em ${geography.rawName}`, geography.center.lat, geography.center.lng);
        const valid = external
          .filter((business) => business.hasCoordinates !== false)
          .filter((business) => withinBounds(business, geography.bbox))
          .filter((business) => segmentScore(business, profile) > 0);
        candidates = mergeBusinesses(candidates, valid);
        if (valid.length) sourcesUsed.add('serper');
        trace.push({ stage: 'external_recall', status: 'completed', detail: `${valid.length} resultados adicionais` });
      } catch (error: any) {
        trace.push({ stage: 'external_recall', status: 'warning', detail: error?.message || 'Fonte externa indisponível' });
      }
    }
  }

  const verified = candidates
    .filter((business) => withinBounds(business, geography.bbox))
    .filter((business) => segmentScore(business, profile) > 0);
  const constrained = applyConstraints(verified, constraints);
  const ranked = rankResults(constrained, constraints, profile);
  const shown = ranked.slice(0, Math.min(requestedCount, ranked.length));
  const matchedBusinessIds = shown.map((business) => business.id);

  trace.push({ stage: 'validation', status: 'completed', detail: `${verified.length} no segmento/região; ${ranked.length} após filtros` });
  trace.push({ stage: 'ranking', status: 'completed', detail: `${shown.length} oportunidades priorizadas` });

  const sourceList = Array.from(sourcesUsed);
  const searchStatus = shown.length === 0 ? 'empty' : shown.length < requestedCount ? 'partial' : 'complete';

  return {
    text: responseText({ businessType, regionName: geography.rawName, requestedCount, availableCount: verified.length, matchingCount: ranked.length, shownCount: shown.length, constraints }),
    matchedBusinessIds,
    modelUsed: 'agentic-deterministic-v2',
    searchSummary: {
      requestedCount,
      availableCount: verified.length,
      matchingCount: ranked.length,
      shownCount: shown.length,
      businessType,
      regionName: geography.rawName,
      appliedFilters: filters,
      usedCurrentContext: useCurrentContext,
      sourceCount: sourceList.length,
      sourcesUsed: sourceList,
      locationVerified: true,
      searchStatus,
    },
    suggestedAction: constraints.requestedPipelineAdd && matchedBusinessIds.length > 0
      ? { type: 'add_to_pipeline', businessIds: matchedBusinessIds }
      : undefined,
    newRegion: useCurrentContext ? undefined : {
      name: geography.rawName,
      center: geography.center,
      businesses: verified,
    },
    executionTrace: trace,
  };
}
