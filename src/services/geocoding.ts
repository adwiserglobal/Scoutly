import { Business } from '../types';
import { mapCacheService } from './mapCacheService';

export interface GeocodedLocation {
  name: string;
  lat: number;
  lng: number;
  businesses?: Business[];
  searchType?: 'location' | 'business';
}

interface BusinessSearchApiResponse {
  region?: {
    name: string;
    center: { lat: number; lng: number };
  };
  businesses?: any[];
}

export const PRESET_REGIONS: GeocodedLocation[] = [
  { name: 'São Paulo - Pinheiros', lat: -23.5658, lng: -46.6872 },
  { name: 'São Paulo - Itaim Bibi', lat: -23.5847, lng: -46.6778 },
  { name: 'Rio de Janeiro - Barra da Tijuca', lat: -23.0003, lng: -43.3659 },
  { name: 'Belo Horizonte - Savassi', lat: -19.9388, lng: -43.9329 },
  { name: 'Curitiba - Batel', lat: -25.4428, lng: -49.2887 },
  { name: 'Porto Alegre - Moinhos de Vento', lat: -30.0277, lng: -51.2005 },
];

const BUSINESS_TERMS = [
  'despachante', 'mecanica', 'mecânica', 'oficina', 'dentista', 'odontologia',
  'hospital', 'clinica', 'clínica', 'restaurante', 'pizzaria', 'academia', 'fitness',
  'padaria', 'farmacia', 'farmácia', 'drogaria', 'marketing', 'publicidade', 'agencia',
  'agência', 'contabilidade', 'contador', 'imobiliaria', 'imobiliária', 'advocacia',
  'advogado', 'floricultura', 'pet shop', 'veterinario', 'veterinário', 'barbearia',
  'salao', 'salão', 'autoescola', 'supermercado', 'mercado', 'loja',
];

const LOCATION_PREFIXES = ['rua ', 'r. ', 'avenida ', 'av. ', 'alameda ', 'rodovia ', 'estrada ', 'bairro '];

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeBusinessSearch(query: string): boolean {
  const normalized = normalizeText(query);
  if (BUSINESS_TERMS.some((term) => normalized.includes(normalizeText(term)))) return true;

  const hasLocationClause = /\s+(em|no|na|perto de|perto do|perto da)\s+/.test(normalized);
  const looksLikeAddress = LOCATION_PREFIXES.some((prefix) => normalized.startsWith(prefix));
  return hasLocationClause && !looksLikeAddress;
}

function toBusiness(raw: any): Business | null {
  const lat = Number(raw.latitude ?? raw.lat ?? raw.coordinates?.lat);
  const lng = Number(raw.longitude ?? raw.lng ?? raw.coordinates?.lng);
  if (!raw?.id || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return {
    id: String(raw.id),
    name: raw.name || raw.nomeFantasia || raw.razaoSocial || 'Estabelecimento Comercial',
    latitude: lat,
    longitude: lng,
    category: raw.category || raw.cnaePrincipal || 'Estabelecimento Comercial',
    confidence: typeof raw.confidence === 'number' ? raw.confidence : 0.85,
    operatingStatus: raw.operatingStatus || null,
    website: raw.website || null,
    websites: Array.isArray(raw.websites) ? raw.websites : raw.website ? [raw.website] : [],
    email: raw.email || (Array.isArray(raw.emails) ? raw.emails[0] : null) || null,
    emails: Array.isArray(raw.emails) ? raw.emails : raw.email ? [raw.email] : [],
    phone: raw.phone || (Array.isArray(raw.phones) ? raw.phones[0] : null) || null,
    phones: Array.isArray(raw.phones) ? raw.phones : raw.phone ? [raw.phone] : [],
    socials: Array.isArray(raw.socials) ? raw.socials : [],
    address: raw.address || [raw.logradouro, raw.numero, raw.bairro, raw.municipio, raw.uf].filter(Boolean).join(', ') || 'Endereço não identificado',
    source: raw.source || (Array.isArray(raw.sources) ? raw.sources.join(' + ') : 'Scoutly Search'),
    sources: Array.isArray(raw.sources) ? raw.sources : undefined,
    cnpj: raw.cnpj || null,
    razaoSocial: raw.razaoSocial || null,
    nomeFantasia: raw.nomeFantasia || null,
    cnaePrincipal: raw.cnaePrincipal || null,
    cnaesSecundarios: raw.cnaesSecundarios || [],
    logradouro: raw.logradouro || null,
    numero: raw.numero || null,
    bairro: raw.bairro || null,
    cep: raw.cep || null,
    municipio: raw.municipio || null,
    uf: raw.uf || null,
    porte: raw.porte || null,
    dataInicioAtividade: raw.dataInicioAtividade || null,
    situacaoCadastral: raw.situacaoCadastral || null,
    hasCoordinates: true,
    coordinates: { lat, lng },
    leadStatus: raw.leadStatus || 'NOVO',
    isFavorite: Boolean(raw.isFavorite),
    notes: raw.notes || '',
  };
}

async function searchBusinesses(query: string, currentRegionName?: string): Promise<GeocodedLocation | null> {
  try {
    const params = new URLSearchParams({ q: query });
    if (currentRegionName) params.set('currentRegionName', currentRegionName);
    const res = await fetch(`/api/search?${params.toString()}`);
    if (!res.ok) return null;

    const data: BusinessSearchApiResponse = await res.json();
    const businesses = (data.businesses || []).map(toBusiness).filter((b): b is Business => Boolean(b));

    mapCacheService.setTargetedSearchResults(businesses, query);

    if (data.region?.center) {
      return {
        name: data.region.name,
        lat: data.region.center.lat,
        lng: data.region.center.lng,
        businesses,
        searchType: 'business',
      };
    }
  } catch (err) {
    console.warn('[Scoutly Search] Falha na busca por empresas:', err);
  }
  return null;
}

export async function searchAddressOrCity(query: string, currentRegionName?: string): Promise<GeocodedLocation | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  if (looksLikeBusinessSearch(trimmed)) {
    const businessResult = await searchBusinesses(trimmed, currentRegionName);
    if (businessResult) return businessResult;
  }

  mapCacheService.clearTargetedSearch();

  const matchedPreset = PRESET_REGIONS.find((p) => p.name.toLowerCase().includes(trimmed.toLowerCase()));
  if (matchedPreset) return { ...matchedPreset, searchType: 'location' };

  try {
    const encoded = encodeURIComponent(trimmed);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&countrycodes=br&limit=1`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' } });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.length > 0) {
      return {
        name: data[0].display_name.split(',').slice(0, 2).join(','),
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        searchType: 'location',
      };
    }
  } catch (err) {
    console.warn('Falha na geocodificação externa:', err);
  }

  return null;
}
