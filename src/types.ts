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
  | 'CONFIGURACOES';

export interface Business {
  id: string;
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
  source: string;
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
  // Freemium prospect protection. Protected contact values are never sent while locked.
  isLocked?: boolean;
  previouslyUnlocked?: boolean;
  unlockToken?: string;
  hasProtectedWebsite?: boolean;
  hasProtectedEmail?: boolean;
  hasProtectedPhone?: boolean;
  hasProtectedSocials?: boolean;
}

export type VisitStatus = 'PENDENTE' | 'VISITADO' | 'PULADO';

export interface VisitRouteStop {
  business: Business;
  visitStatus: VisitStatus;
  addedAt: number;
}

export interface PageSpeedData {
  url: string;
  score: number;
  fcp?: string;
  lcp?: string;
  tbt?: string;
  cls?: string;
  speedIndex?: string;
  rating: 'FAST' | 'AVERAGE' | 'SLOW';
  opportunityTitle?: string;
  opportunityDescription?: string;
  diagnostics?: Array<{ title: string; impact: string }>;
  fetchedAt?: string;
}

export interface FilterOptions {
  searchQuery: string;
  websiteFilter: WebsiteFilter;
  category: string;
  sortBy: 'CONFIDENCE' | 'NOME' | 'COM_CONTATO';
}
