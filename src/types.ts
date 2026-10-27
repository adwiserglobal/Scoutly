export interface MapBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface ActiveFilters {
  semSite: boolean;
  comSite: boolean;
  comWhatsapp: boolean;
  comRedeSocial: boolean;
  semRedeSocial: boolean;
  contratando: boolean;
}

export type WebsiteFilter =
  | 'TODOS'
  | 'SITE_ENCONTRADO'
  | 'SITE_NAO_IDENTIFICADO'
  | 'COM_WHATSAPP'
  | 'COM_REDE_SOCIAL'
  | 'SEM_REDE_SOCIAL';

export type LeadStatus =
  | 'NOVO'
  | 'CONTATADO'
  | 'EM_NEGOCIACAO'
  | 'FECHADO'
  | 'PERDIDO'
  | 'ARQUIVADO';

export type NavigationTab =
  | 'INICIO'
  | 'FAVORITOS'
  | 'PIPELINE'
  | 'WORKSPACE'
  | 'CONFIGURACOES';

/** Hiring signal found for a business (website, public job boards, or Jooble). */
export interface HiringInfo {
  status: 'hiring' | 'careers' | 'none' | 'unreachable';
  jobsCount: number;
  careersUrl: string | null;
}

export interface JobPosting {
  title: string;
  location: string | null;
  url: string | null;
  postedAt: string | null;
  department: string | null;
  source: string;
}

export interface BusinessJobs extends HiringInfo {
  jobs: JobPosting[];
  sources: string[];
  checkedAt: string;
  aggregatorAvailable?: boolean;
}

export interface Business {
  id: string;
  /** Filled client-side once the company's hiring signals were checked. */
  hiring?: HiringInfo;
  name: string;
  latitude: number;
  longitude: number;
  category: string;
  confidence: number;
  operatingStatus: string | null;
  website: string | null;
  websites: string[];
  email: string | null;
  emails: string[];
  phone: string | null;
  phones: string[];
  socials: string[];
  address: string;
  source: string; // 'Overture Maps' or 'CNPJ / Minha Receita'
  sources?: string[];
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
  hasCoordinates?: boolean;
  contactLocked?: boolean;
  emailLocked?: boolean;
  hasProtectedPhone?: boolean;
  hasProtectedEmail?: boolean;
  sealedContactToken?: string | null;
  // Helpers for UI/Map compatibility
  coordinates: {
    lat: number;
    lng: number;
  };
  leadStatus: LeadStatus;
  isFavorite?: boolean;
  notes?: string;
  openStatus?: 'ABERTO_AGORA' | 'FECHADO_AGORA' | 'DESCONHECIDO';
  openStatusText?: string;
  openingHoursRaw?: string | null;
  pageSpeed?: PageSpeedData;

  // Optional Google Maps enrichment (Omkar worker).
  googleMapsUrl?: string | null;
  googlePlaceId?: string | null;
  googleKgmid?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  owner?: string | null;
  canClaim?: boolean;
  isSpendingOnAds?: boolean;
  featuredImage?: string | null;
  priceRange?: string | null;
  googleStatus?: string | null;
  googleMapsVerification?: {
    status: 'checking' | 'confirmed' | 'probable' | 'ambiguous' | 'not_found' | 'failed';
    confidence?: number;
    matchedFields?: string[];
    distanceMeters?: number | null;
    checkedAt?: string;
  };
}

export type VisitStatus = 'PENDENTE' | 'VISITADO' | 'PULADO';

export interface VisitRouteStop {
  business: Business;
  visitStatus: VisitStatus;
  addedAt: number;
}

export interface PageSpeedData {
  url: string;
  score: number; // 0 - 100
  fcp?: string; // e.g. "1.2 s"
  lcp?: string; // e.g. "2.4 s"
  tbt?: string; // e.g. "120 ms"
  cls?: string; // e.g. "0.02"
  speedIndex?: string; // e.g. "1.8 s"
  rating: 'FAST' | 'AVERAGE' | 'SLOW';
  opportunityTitle?: string;
  opportunityDescription?: string;
  diagnostics?: Array<{ title: string; impact: string }>;
  fetchedAt?: string;
  /** 'google_pagespeed_api' = real Google measurement; 'live_audit' = Scoutly's own estimate. */
  source?: 'google_pagespeed_api' | 'live_audit';
}

export interface FilterOptions {
  searchQuery: string;
  websiteFilter: WebsiteFilter;
  category: string; // 'TODAS' or specific category
  sortBy: 'CONFIDENCE' | 'NOME' | 'COM_CONTATO';
}
