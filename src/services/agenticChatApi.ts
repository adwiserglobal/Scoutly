import type { Business } from '../types';

export interface AgenticConversationContext {
  businessType?: string;
  canonicalSegment?: string;
  location?: string | null;
  regionName?: string;
  requestedCount?: number;
  appliedFilters?: string[];
}

export interface AgenticChatPayload {
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  businesses: Business[];
  currentRegionName?: string;
  conversationContext?: AgenticConversationContext | null;
}

export interface AgenticChatResult {
  text: string;
  matchedBusinessIds: string[];
  modelUsed?: string;
  searchSummary?: {
    requestedCount: number;
    availableCount: number;
    matchingCount: number;
    shownCount: number;
    businessType: string;
    regionName: string;
    appliedFilters: string[];
    usedCurrentContext?: boolean;
  };
  conversationContext?: AgenticConversationContext;
  suggestedAction?: {
    type: 'add_to_pipeline';
    businessIds: string[];
  };
  newRegion?: {
    name: string;
    center: { lat: number; lng: number };
    businesses?: Business[];
  };
}

async function readJsonResponse<T = any>(response: Response, fallbackMessage: string): Promise<T> {
  const raw = await response.text();
  if (!raw.trim()) throw new Error(fallbackMessage);
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(fallbackMessage);
  }
}

export async function sendAgenticChatMessage(payload: AgenticChatPayload): Promise<AgenticChatResult> {
  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: payload.message,
      history: payload.history || [],
      conversationContext: payload.conversationContext || null,
      businesses: payload.businesses.slice(0, 120).map((business) => ({
        id: business.id,
        name: business.name,
        category: business.category,
        address: business.address,
        lat: business.coordinates.lat,
        lng: business.coordinates.lng,
        coordinates: business.coordinates,
        website: business.website,
        phone: business.phone,
        phones: business.phones,
        emails: business.emails,
        socials: business.socials,
        leadStatus: business.leadStatus,
        confidence: business.confidence,
      })),
      currentRegionName: payload.currentRegionName,
    }),
  });

  const data = await readJsonResponse<AgenticChatResult>(
    res,
    'A Scoutly Agentic recebeu uma resposta inválida do servidor.',
  );

  if (!res.ok) {
    throw new Error((data as any)?.error || 'Erro ao comunicar com o Scoutly Agentic.');
  }

  return data;
}
