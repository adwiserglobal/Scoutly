import { Business, PageSpeedData } from '../types';
import { translateCategory } from '../utils/categories';

export async function fetchPlacesFromOverture(
  west: number,
  south: number,
  east: number,
  north: number,
  limit: number = 5000,
  signal?: AbortSignal,
  zoom?: number
): Promise<{ places: Business[]; cached: boolean; durationMs: number }> {
  const params = new URLSearchParams({
    west: west.toFixed(6),
    south: south.toFixed(6),
    east: east.toFixed(6),
    north: north.toFixed(6),
    limit: limit.toString(),
  });
  if (zoom !== undefined) {
    params.set('zoom', zoom.toString());
  }

  const res = await fetch(`/api/places?${params.toString()}`, {
    method: 'GET',
    signal,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Erro ao carregar dados do Overture Maps.');
  }

  const data = await res.json();
  const places = (data.places || []).map((p: any) => ({
    ...p,
    category: translateCategory(p.category),
    coordinates: {
      lat: p.latitude,
      lng: p.longitude,
    },
    leadStatus: 'NOVO' as const,
  }));

  return {
    places,
    cached: !!data.cached,
    durationMs: data.durationMs || 0,
  };
}

export async function enrichBusinessData(url: string) {
  const res = await fetch(`/api/enrich?url=${encodeURIComponent(url)}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Erro ao enriquecer dados.');
  }
  return res.json();
}

export interface UserUserData {
  leads: Record<string, { status: any; notes: string }>;
  favorites: Record<string, boolean>;
}

export async function fetchUserLeads(): Promise<UserUserData> {
  try {
    const res = await fetch('/api/leads');
    if (!res.ok) return { leads: {}, favorites: {} };
    const data = await res.json();
    return {
      leads: data.leads || {},
      favorites: data.favorites || {},
    };
  } catch (err) {
    console.warn('[API] Error fetching saved user leads:', err);
    return { leads: {}, favorites: {} };
  }
}

export async function saveUserLead(
  businessId: string,
  status?: string,
  notes?: string,
  isFavorite?: boolean
) {
  try {
    const body: Record<string, any> = { businessId };
    if (status !== undefined) body.status = status;
    if (notes !== undefined) body.notes = notes;
    if (isFavorite !== undefined) body.isFavorite = isFavorite;

    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch (err) {
    console.warn('[API] Error saving user lead:', err);
    return false;
  }
}

export function getWhatsAppLink(phoneOrUrl?: string | null): string | null {
  if (!phoneOrUrl) return null;
  
  const trimmed = phoneOrUrl.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    if (trimmed.includes('wa.me') || trimmed.includes('whatsapp.com')) {
      return trimmed;
    }
  }

  // Remove non-digit characters
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 8) return null;

  // If Brazilian format (10 or 11 digits without 55), prepend 55
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) {
    return `https://wa.me/55${digits}`;
  }

  // If already starts with country code or other length >= 10
  if (digits.length >= 10) {
    return `https://wa.me/${digits}`;
  }

  return `https://wa.me/55${digits}`;
}

export function getTrustIcon(confidence?: number): string {
  const val = typeof confidence === 'number' ? confidence : 0.8;
  if (val >= 0.85) return '/high_trust.png';
  if (val >= 0.70) return '/medium_trust.png';
  return '/low_trust.png';
}


export interface AIChatPayload {
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  businesses: Business[];
  currentRegionName?: string;
  searchMode?: 'default' | 'deep';
}

export interface AIChatResult {
  text: string;
  matchedBusinessIds: string[];
  modelUsed?: string;
  newRegion?: {
    name: string;
    center: { lat: number; lng: number };
    businesses?: Business[];
  };
}

export async function sendAIChatMessage(payload: AIChatPayload): Promise<AIChatResult> {
  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: payload.message,
      history: payload.history || [],
      businesses: payload.businesses.slice(0, 80).map((b) => ({
        id: b.id,
        name: b.name,
        category: b.category,
        address: b.address,
        lat: b.coordinates.lat,
        lng: b.coordinates.lng,
        website: b.website,
        phone: b.phone,
        phones: b.phones,
        socials: b.socials,
        leadStatus: b.leadStatus,
        confidence: b.confidence,
      })),
      currentRegionName: payload.currentRegionName,
      searchMode: payload.searchMode || 'default',
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Erro ao comunicar com a IA');
  }

  return res.json();
}

export async function fetchContextualSuggestions(
  recentSearches: string[],
  currentRegionName?: string
): Promise<string[]> {
  try {
    const res = await fetch('/api/ai/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recentSearches, currentRegionName }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.suggestions || [];
  } catch (err) {
    console.warn('[API] Error fetching contextual suggestions:', err);
    return [];
  }
}

export async function fetchPageSpeed(url: string): Promise<PageSpeedData> {
  const res = await fetch(`/api/pagespeed?url=${encodeURIComponent(url)}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Erro ao carregar métricas do PageSpeed.');
  }
  return res.json();
}

export async function generateMessage(business: any): Promise<string> {
  try {
    const res = await fetch('/api/ai/generate-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business })
    });
    if (!res.ok) {
      throw new Error('Falha ao gerar mensagem com a API');
    }
    const data = await res.json();
    return data.message || '';
  } catch (error) {
    console.error('Failed to generate message:', error);
    throw error;
  }
}


