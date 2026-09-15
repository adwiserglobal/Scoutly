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
}

export type WebsiteFilter =
  | 'TODOS'
  | 'SITE_ENCONTRADO'
  | 'SITE_NAO_IDENTIFICADO'
  | 'COM_WHATSAPP'
  | 'COM_REDE_SOCIAL';

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
}

export interface FilterOptions {
  searchQuery: string;
  websiteFilter: WebsiteFilter;
  category: string; // 'TODAS' or specific category
  sortBy: 'CONFIDENCE' | 'NOME' | 'COM_CONTATO';
}
