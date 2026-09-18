import { GoogleGenAI } from '@google/genai';
import type { OverturePlace } from './overtureService.js';
import { hasBrazilPlacesDatabase, queryBrazilPlaces } from './brazilPlacesService.js';
import {
  interpretSearchIntent,
  parseSearchLocation,
  ParsedSearchIntent,
  PRESET_LOCATIONS,
  InterpretedLocation,
} from './searchInterpreter.js';
import {
  getCNAEsForBusinessType,
  fetchCompaniesFromMinhaReceita,
  processMinhaReceitaBusiness,
  isCompanyActive,
  isCNPJInRequestedRegion,
  MinhaReceitaCompany,
} from './cnpjService.js';
import { fetchBusinessesFromSerper } from './serperService.js';

export async function resolveGeographicArea(loc: InterpretedLocation): Promise<{
  bairro: string;
  cidade: string;
  uf: string;
  pais: string;
  query: string;
  rawName: string;
  center: { lat: number; lng: number };
  bbox: { west: number; south: number; east: number; north: number };
}> {
  if (loc.center && loc.bbox) {
    return loc as Required<InterpretedLocation>;
  }

  const geocoded = await geocodeWithNominatimFull(loc.query || `${loc.cidade}, ${loc.uf}, ${loc.pais}`);
  if (geocoded) {
    return {
      ...loc,
      center: geocoded.center,
      bbox: geocoded.bbox,
    };
  }

  const center = { lat: -23.5505, lng: -46.6333 };
  const delta = loc.bairro ? 0.015 : 0.035;
  return {
    ...loc,
    center,
    bbox: {
      west: center.lng - delta,
      south: center.lat - delta,
      east: center.lng + delta,
      north: center.lat + delta,
    },
  };
}

async function geocodeWithNominatimFull(query: string): Promise<{ center: { lat: number; lng: number }; bbox: { west: number; south: number; east: number; north: number } } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=br&limit=1`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Scoutly-Prospect-Bot/1.0',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      const bb = data[0].boundingbox;
      let bbox: { west: number; south: number; east: number; north: number };

      if (Array.isArray(bb) && bb.length === 4) {
        bbox = {
          south: parseFloat(bb[0]),
          north: parseFloat(bb[1]),
          west: parseFloat(bb[2]),
          east: parseFloat(bb[3]),
        };
      } else {
        const delta = 0.015;
        bbox = {
          west: lng - delta,
          south: lat - delta,
          east: lng + delta,
          north: lat + delta,
        };
      }

      return {
        center: { lat, lng },
        bbox,
      };
    }
  } catch (err) {
    console.warn('[Geocode Error]:', err);
  }
  return null;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface BusinessSummary {
  id: string;
  name: string;
  category: string;
  basicCategory?: string;
  taxonomyPrimary?: string;
  taxonomyHierarchy?: string[];
  taxonomyAlternates?: string[];
  address: string;
  lat: number;
  lng: number;
  coordinates?: { lat: number; lng: number };
  website?: string | null;
  phone?: string | null;
  phones?: string[];
  emails?: string[];
  socials?: string[];
  leadStatus?: string;
  confidence?: number;
  notes?: string;

  // CNPJ / Minha Receita Integration Fields
  cnpj?: string | null;
  razaoSocial?: string | null;
  nomeFantasia?: string | null;
  cnaePrincipal?: string | null;
  cnaesSecundarios?: string[];
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cep?: string | null;
  municipio?: string | null;
  uf?: string | null;
  porte?: string | null;
  dataInicioAtividade?: string | null;
  situacaoCadastral?: string | null;
  sources?: string[];
  hasCoordinates?: boolean;
}

export interface AIChatRequest {
  message: string;
  history?: ChatMessage[];
  businesses?: BusinessSummary[];
  currentRegionName?: string;
  searchMode?: 'default' | 'deep';
}

export interface AIChatResponse {
  text: string;
  matchedBusinessIds: string[];
  modelUsed?: string;
  newRegion?: {
    name: string;
    center: { lat: number; lng: number };
    businesses?: BusinessSummary[];
  };
}

function matchesValidOvertureCategory(b: BusinessSummary, validCat: string): boolean {
  const catKey = validCat.toLowerCase().trim();

  if (b.basicCategory && (b.basicCategory.toLowerCase() === catKey || b.basicCategory.toLowerCase().includes(catKey))) {
    return true;
  }
  if (b.taxonomyPrimary && (b.taxonomyPrimary.toLowerCase() === catKey || b.taxonomyPrimary.toLowerCase().includes(catKey))) {
    return true;
  }
  if (b.taxonomyHierarchy && b.taxonomyHierarchy.some((h) => h.toLowerCase() === catKey || h.toLowerCase().includes(catKey))) {
    return true;
  }
  if (b.taxonomyAlternates && b.taxonomyAlternates.some((a) => a.toLowerCase() === catKey || a.toLowerCase().includes(catKey))) {
    return true;
  }
  if (b.category) {
    const snakeDisplayCat = b.category.toLowerCase().trim().replace(/\s+/g, '_');
    if (snakeDisplayCat === catKey || snakeDisplayCat.includes(catKey)) {
      return true;
    }
  }
  return false;
}

export async function handleAIChat({
  message,
  history = [],
  businesses = [],
  currentRegionName = 'São Paulo - SP',
  searchMode = 'default',
}: AIChatRequest): Promise<AIChatResponse> {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  const intent = interpretSearchIntent(message, currentRegionName);
  const locDetails = parseSearchLocation(message);
  const resolvedArea = await resolveGeographicArea(locDetails);

  const activeRegionName = `${resolvedArea.bairro ? resolvedArea.bairro + ', ' : ''}${resolvedArea.cidade} - ${resolvedArea.uf}`;

  let rawOvertureCount = 0;
  let filteredOvertureCount = 0;
  let rawCNPJCount = 0;
  let filteredCNPJCount = 0;
  let serperCount = 0;
  let deduplicatedResults: BusinessSummary[] = [];
  const seenIds = new Set<string>();

  if (searchMode === 'deep') {
    // Deep Search: Use EXCLUSIVELY Serper results with the exact user message
    try {
      const serperQuery = message.trim();
      const serperBusinesses = await fetchBusinessesFromSerper(serperQuery, resolvedArea.center.lat, resolvedArea.center.lng);
      serperCount = serperBusinesses.length;
      for (const sb of serperBusinesses) {
        if (!seenIds.has(sb.id)) {
          seenIds.add(sb.id);
          deduplicatedResults.push(sb);
        }
      }
      console.log(`[Deep Search Mode] Using exclusively Serper results for query "${serperQuery}": found ${serperCount} businesses.`);
    } catch (err: any) {
      console.warn('[Deep Search Serper Error]:', err.message);
    }
  } else {
    // Standard Search: Overture + CNPJ + Serper merged
    let overtureSummaries: BusinessSummary[] = [];
    try {
      const rawPlaces = hasBrazilPlacesDatabase()
        ? (
            await queryBrazilPlaces(
              resolvedArea.bbox.west,
              resolvedArea.bbox.south,
              resolvedArea.bbox.east,
              resolvedArea.bbox.north,
              300
            )
          ).places
        : [];
      rawOvertureCount = rawPlaces.length;

      const inBBoxPlaces = rawPlaces.filter(
        (p) =>
          p.latitude >= resolvedArea.bbox.south &&
          p.latitude <= resolvedArea.bbox.north &&
          p.longitude >= resolvedArea.bbox.west &&
          p.longitude <= resolvedArea.bbox.east
      );
      filteredOvertureCount = inBBoxPlaces.length;

      overtureSummaries = inBBoxPlaces.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        basicCategory: p.basicCategory,
        taxonomyPrimary: p.taxonomyPrimary,
        taxonomyHierarchy: p.taxonomyHierarchy,
        taxonomyAlternates: p.taxonomyAlternates,
        address: p.address,
        lat: p.latitude,
        lng: p.longitude,
        coordinates: { lat: p.latitude, lng: p.longitude },
        website: p.website || null,
        phone: p.phone || (p.phones && p.phones[0]) || null,
        phones: Array.isArray(p.phones) ? p.phones : p.phone ? [p.phone] : [],
        emails: Array.isArray(p.emails) ? p.emails : [],
        socials: Array.isArray(p.socials) ? p.socials : [],
        confidence: typeof p.confidence === 'number' ? p.confidence : 0.85,
        leadStatus: 'NOVO',
        notes: '',
        sources: ['overture'],
        hasCoordinates: true,
      }));
    } catch (err) {
      console.warn('[Overture bbox query error]:', err);
    }

    if (intent.validCategories.length > 0) {
      for (const cat of intent.validCategories) {
        const matches = overtureSummaries.filter((b) => matchesValidOvertureCategory(b, cat));
        for (const m of matches) {
          if (!seenIds.has(m.id)) {
            seenIds.add(m.id);
            deduplicatedResults.push(m);
          }
        }
      }
    } else {
      for (const m of overtureSummaries) {
        if (!seenIds.has(m.id)) {
          seenIds.add(m.id);
          deduplicatedResults.push(m);
        }
      }
    }

    const cnaesUsed = getCNAEsForBusinessType(intent.businessType, intent.keywords);
    let rawCNPJCompanies: MinhaReceitaCompany[] = [];
    try {
      rawCNPJCompanies = await fetchCompaniesFromMinhaReceita(cnaesUsed, resolvedArea.query);
    } catch (err: any) {
      console.warn('[Minha Receita fetch error]:', err);
    }

    rawCNPJCount = rawCNPJCompanies.length;
    const activeCNPJCompanies = rawCNPJCompanies
      .filter(isCompanyActive)
      .filter((comp) => isCNPJInRequestedRegion(comp, resolvedArea));

    filteredCNPJCount = activeCNPJCompanies.length;

    for (const company of activeCNPJCompanies) {
      const { business, matchedOvertureId } = processMinhaReceitaBusiness(company, deduplicatedResults, intent.businessType);
      if (matchedOvertureId) {
        const idx = deduplicatedResults.findIndex((b) => b.id === matchedOvertureId);
        if (idx !== -1) {
          deduplicatedResults[idx] = {
            ...deduplicatedResults[idx],
            cnpj: business.cnpj,
            razaoSocial: business.razaoSocial,
            nomeFantasia: business.nomeFantasia,
            cnaePrincipal: business.cnaePrincipal,
            cnaesSecundarios: business.cnaesSecundarios,
            logradouro: business.logradouro,
            numero: business.numero,
            bairro: business.bairro || resolvedArea.bairro,
            cep: business.cep,
            municipio: business.municipio || resolvedArea.cidade,
            uf: business.uf || resolvedArea.uf,
            porte: business.porte,
            dataInicioAtividade: business.dataInicioAtividade,
            situacaoCadastral: 'ATIVA',
            sources: ['overture', 'cnpj'],
          };
        }
      } else {
        if (!deduplicatedResults.some((d) => d.cnpj && d.cnpj === business.cnpj)) {
          deduplicatedResults.push(business);
        }
      }
    }

    try {
      const serperQuery = `${intent.businessType} em ${activeRegionName}`;
      const serperBusinesses = await fetchBusinessesFromSerper(serperQuery, resolvedArea.center.lat, resolvedArea.center.lng);
      serperCount = serperBusinesses.length;
      for (const sb of serperBusinesses) {
        if (!seenIds.has(sb.id)) {
          seenIds.add(sb.id);
          deduplicatedResults.push(sb);
        }
      }
    } catch (serperErr: any) {
      console.warn('[Serper Integration Error]:', serperErr.message);
    }
  }

  if (intent.filters.noWebsite) {
    deduplicatedResults = deduplicatedResults.filter((b) => !b.website);
  } else if (intent.filters.hasWebsite) {
    deduplicatedResults = deduplicatedResults.filter((b) => Boolean(b.website));
  }
  if (intent.filters.hasPhone) {
    deduplicatedResults = deduplicatedResults.filter((b) => Boolean(b.phone || (b.phones && b.phones.length > 0)));
  }

  // Prioritize high-quality sources: Serper (Google Places) > CNPJ > Overture
  deduplicatedResults.sort((a, b) => {
    const aIsSerper = a.sources?.includes('serper') ? 1 : 0;
    const bIsSerper = b.sources?.includes('serper') ? 1 : 0;
    if (aIsSerper !== bIsSerper) return bIsSerper - aIsSerper;

    const aHasCnpj = a.cnpj ? 1 : 0;
    const bHasCnpj = b.cnpj ? 1 : 0;
    if (aHasCnpj !== bHasCnpj) return bHasCnpj - aHasCnpj;

    return (b.confidence || 0) - (a.confidence || 0);
  });

  console.log(`
=== [SCOUTLY GEOGRAPHIC RESOLUTION LOG] ===
- Localização interpretada: Bairro="${resolvedArea.bairro}", Cidade="${resolvedArea.cidade}", UF="${resolvedArea.uf}", País="${resolvedArea.pais}"
- Latitude/Longitude resolvidas: [${resolvedArea.center.lat}, ${resolvedArea.center.lng}]
- Bbox utilizado: west=${resolvedArea.bbox.west}, south=${resolvedArea.bbox.south}, east=${resolvedArea.bbox.east}, north=${resolvedArea.bbox.north}
- Cidade: "${resolvedArea.cidade}"
- Bairro: "${resolvedArea.bairro}"
- Quantidade de resultados antes do filtro: Overture=${rawOvertureCount}, CNPJ=${rawCNPJCount}
- Quantidade depois do filtro: Overture=${filteredOvertureCount}, CNPJ=${filteredCNPJCount}, Serper=${serperCount} (Total unificados=${deduplicatedResults.length})
===========================================
  `);

  const newRegionData: AIChatResponse['newRegion'] = {
    name: activeRegionName,
    center: resolvedArea.center,
    businesses: deduplicatedResults,
  };

  const businessCatalog = deduplicatedResults.slice(0, 30).map((b) => ({
    id: b.id,
    name: b.name,
    category: b.category,
    basicCategory: b.basicCategory,
    address: b.address,
    hasWebsite: Boolean(b.website),
    website: b.website || null,
    phone: b.phone || (b.phones && b.phones[0]) || null,
    cnpj: b.cnpj || null,
    razaoSocial: b.razaoSocial || null,
    cnaePrincipal: b.cnaePrincipal || null,
    sources: b.sources || ['overture'],
    leadStatus: b.leadStatus || 'NOVO',
  }));

  const systemPrompt = `Você é o Scoutly Copilot, um assistente especialista em prospecção B2B de negócios locais.
O usuário buscou por "${intent.businessType}" em "${activeRegionName}".
Foram encontrados ${deduplicatedResults.length} estabelecimentos reais na região confirmada (Bairro: ${resolvedArea.bairro || 'Geral'}, Cidade: ${resolvedArea.cidade}).

DIRETRIZES DE RESPOSTA OBRIGATÓRIAS:
1. Aja de forma consultiva e direta. Responda de forma humanizada e sem jargões técnicos.
2. NUNCA mostre coordenadas, "bboxes", quantidades exatas de APIs, CNPJs, ou qualquer log de sistema.
3. NUNCA liste o nome, endereço ou contato das empresas no corpo do texto da sua resposta. O sistema já exibe os cards detalhados visualmente logo abaixo do chat. Apenas mencione que "os resultados estão listados nos cards abaixo".
4. Forneça uma breve análise comercial sobre prospectar esse tipo de negócio na região (ex: "Oficinas na Vila Leopoldina costumam ter boa demanda...") e sugira um "Script de Abordagem (WhatsApp)" para o usuário enviar.
5. Ao final da sua resposta, você DEVE incluir a seguinte tag exata para que a interface renderize os cards corretamente:
<<<MATCHED_BUSINESSES:[${deduplicatedResults.slice(0, 10).map((b) => `"${b.id}"`).join(', ')}]>>>`;

  if (openRouterKey) {
    const candidateModels = [
      'meta-llama/llama-3.3-70b-instruct:free',
      'google/gemini-2.0-flash-exp:free',
      'mistralai/mistral-7b-instruct:free',
      'openrouter/auto',
    ];

    const messagesPayload = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-6).map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: message },
    ];

    for (const modelCandidate of candidateModels) {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${openRouterKey}`,
            'HTTP-Referer': process.env.APP_URL || 'https://scoutly.app',
            'X-Title': 'Scoutly Radar',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelCandidate,
            messages: messagesPayload,
            temperature: 0.2,
            max_tokens: 1500,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const rawText = data.choices?.[0]?.message?.content || '';
          if (rawText.trim()) {
            const { cleanText, matchedIds } = extractMatchedIds(rawText, deduplicatedResults);
            return {
              text: cleanText,
              matchedBusinessIds: matchedIds.length > 0 ? matchedIds : deduplicatedResults.slice(0, 6).map((b) => b.id),
              newRegion: newRegionData,
            };
          }
        }
      } catch (err: any) {
        console.warn(`[OpenRouter ${modelCandidate} Error]:`, err.message);
      }
    }
  }

  if (geminiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const res = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `${systemPrompt}\n\nUsuário: ${message}`,
      });
      const rawText = res.text || '';
      if (rawText.trim()) {
        const { cleanText, matchedIds } = extractMatchedIds(rawText, deduplicatedResults);
        return {
          text: cleanText,
          matchedBusinessIds: matchedIds.length > 0 ? matchedIds : deduplicatedResults.slice(0, 6).map((b) => b.id),
          newRegion: newRegionData,
        };
      }
    } catch (gErr: any) {
      console.warn('[Gemini Error]:', gErr.message);
    }
  }

  const categoryCounts: Record<string, number> = {};
  for (const b of deduplicatedResults) {
    const cat = b.category || 'Outros';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  }

  const localRes = generateLocalSmartResponse(
    intent,
    categoryCounts,
    deduplicatedResults,
    resolvedArea,
    filteredOvertureCount,
    filteredCNPJCount
  );
  return {
    ...localRes,
    newRegion: newRegionData,
  };
}

function extractMatchedIds(
  rawText: string,
  availableBusinesses: BusinessSummary[]
): { cleanText: string; matchedIds: string[] } {
  let matchedIds: string[] = [];
  const regex = /<<<MATCHED_BUSINESSES:\s*(\[[^\]]*\])\s*>>>/i;
  const match = rawText.match(regex);

  if (match && match[1]) {
    try {
      matchedIds = JSON.parse(match[1]);
    } catch {
      matchedIds = [];
    }
  }

  let cleanText = rawText.replace(regex, '').trim();

  if (matchedIds.length === 0 && availableBusinesses.length > 0) {
    for (const b of availableBusinesses.slice(0, 30)) {
      if (b.name && cleanText.toLowerCase().includes(b.name.toLowerCase())) {
        if (!matchedIds.includes(b.id)) {
          matchedIds.push(b.id);
        }
      }
    }
  }

  return {
    cleanText,
    matchedIds: matchedIds.slice(0, 8),
  };
}

function generateLocalSmartResponse(
  intent: ParsedSearchIntent,
  categoryCounts: Record<string, number>,
  deduplicatedResults: BusinessSummary[],
  resolvedArea: {
    bairro: string;
    cidade: string;
    uf: string;
    pais: string;
    query: string;
    center: { lat: number; lng: number };
    bbox: { west: number; south: number; east: number; north: number };
  },
  filteredOvertureCount: number,
  filteredCNPJCount: number
): { text: string; matchedBusinessIds: string[] } {
  const displayResults = deduplicatedResults.slice(0, 20); // Keep IDs for UI cards
  const matchedIds = displayResults.map((b) => b.id);
  const locationLabel = `${resolvedArea.bairro ? resolvedArea.bairro + ', ' : ''}${resolvedArea.cidade}`;

  let responseText = `Encontramos **${deduplicatedResults.length} estabelecimentos** relacionados a "${intent.businessType}" na região de ${locationLabel}.\n\n`;
  responseText += `Os resultados detalhados (incluindo telefones, endereços e CNPJ quando disponíveis) já estão listados nos **cards abaixo** para você avaliar e prospectar.\n\n`;

  responseText += `### 💬 Sugestão de Abordagem Comercial (WhatsApp):\n\n`;
  const sample = displayResults[0];
  if (sample && !sample.website) {
    responseText += `> *"Olá! Tudo bem? Estava pesquisando ${intent.businessType} na região de ${locationLabel} e vi que vocês ainda não possuem um site ou catálogo online próprio. Desenvolvemos páginas comerciais de alta conversão para captar clientes locais. Gostariam de ver uma demonstração rápida para o negócio de vocês?"*\n`;
  } else if (sample) {
    responseText += `> *"Olá! Tudo bem? Estava analisando estabelecimentos do segmento de ${intent.businessType} em ${locationLabel} e identifiquei alguns pontos que podem otimizar o fluxo de agendamentos e vendas via WhatsApp. Posso compartilhar um diagnóstico rápido com vocês?"*\n`;
  } else {
    responseText += `> *"Olá! Tudo bem? Atendemos empresas do segmento de ${intent.businessType} e ajudamos a otimizar vendas locais. Teria interesse em bater um papo rápido sobre o seu negócio?"*\n`;
  }

  return {
    text: responseText,
    matchedBusinessIds: matchedIds,
  };
}

export async function generateContextualSuggestions(
  recentSearches: string[] = [],
  currentRegionName: string = 'São Paulo'
): Promise<string[]> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openRouterKey = process.env.OPENROUTER_API_KEY;

  const cleanRegion = currentRegionName.split('-')[0].trim() || 'São Paulo';
  const historyText = recentSearches.length > 0 ? recentSearches.join('; ') : 'Nenhuma pesquisa prévia';

  const prompt = `Você é um copiloto de inteligência comercial B2B.
Pesquisas recentes do usuário: "${historyText}".
Região/Cidade atual: "${cleanRegion}".

Com base nessas pesquisas recentes e na região, gere 4 sugestões de prospecção comercial curtas, variadas, diretas e extremamente úteis em português.
Exemplos de formato:
"Ache restaurantes sem site em ${cleanRegion}"
"Busque clínicas odontológicas em ${cleanRegion}"
"Oficinas mecânicas com WhatsApp em ${cleanRegion}"
"Agências de publicidade e marketing em ${cleanRegion}"

Responda EXCLUSIVAMENTE em formato JSON (array de 4 strings):
["sugestão 1", "sugestão 2", "sugestão 3", "sugestão 4"]`;

  if (geminiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const res = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      const text = res.text?.trim() || '';
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed) && parsed.length >= 3) {
          return parsed.slice(0, 4);
        }
      }
    } catch (err: any) {
      console.warn('[AI Suggestions Gemini Error]:', err.message);
    }
  }

  if (openRouterKey) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openRouterKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-exp:free',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        const raw = data.choices?.[0]?.message?.content || '';
        const match = raw.match(/\[[\s\S]*\]/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (Array.isArray(parsed) && parsed.length >= 3) {
            return parsed.slice(0, 4);
          }
        }
      }
    } catch (err: any) {
      console.warn('[AI Suggestions OpenRouter Error]:', err.message);
    }
  }

  const lastSearch = recentSearches[recentSearches.length - 1] || '';

  if (/marketing|ag[êe]ncia|b2b/i.test(lastSearch)) {
    return [
      `Oficinas mecânicas em ${cleanRegion}`,
      `Agências de marketing sem site em ${cleanRegion}`,
      `Clínicas e consultórios em ${cleanRegion}`,
      `Restaurantes e bares na ${cleanRegion}`,
    ];
  }
  if (/mec[âa]nic|oficina|auto/i.test(lastSearch)) {
    return [
      `Oficinas de moto em ${cleanRegion}`,
      `Auto peças sem site em ${cleanRegion}`,
      `Lava-rápidos e estéticas em ${cleanRegion}`,
      `Concessionárias e garagens em ${cleanRegion}`,
    ];
  }
  if (/dentist|odonto|cl[íi]nica|m[ée]dic/i.test(lastSearch)) {
    return [
      `Clínicas odontológicas sem site em ${cleanRegion}`,
      `Laboratórios de prótese em ${cleanRegion}`,
      `Consultórios médicos com WhatsApp em ${cleanRegion}`,
      `Farmácias de manipulação em ${cleanRegion}`,
    ];
  }

  return [
    `Ache restaurantes sem site em ${cleanRegion}`,
    `Busque clínicas e consultórios em ${cleanRegion}`,
    `Oficinas mecânicas com WhatsApp em ${cleanRegion}`,
    `Agências de marketing e publicidade em ${cleanRegion}`,
  ];
}
