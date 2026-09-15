// Search Interpreter for Scoutly AI Search
// Validates candidate categories against the official Overture Maps taxonomy (in snake_case)
// Parses user query into businessType, locationName, filters, valid categories & rejected categories.

export interface ParsedSearchIntent {
  rawMessage: string;
  businessType: string;         // e.g. "mecânica", "hospital", "dentista", "oficina de moto"
  locationName: string;         // e.g. "Centro, São Paulo", "Paulista", "Moema", "Mooca"
  filters: {
    noWebsite?: boolean;
    hasWebsite?: boolean;
    hasPhone?: boolean;
  };
  validCategories: string[];    // Valid Overture categories in snake_case
  rejectedCategories: string[]; // Rejected candidate categories (not in official taxonomy)
  keywords: string[];            // Term variants for fallback matching
}

export interface InterpretedLocation {
  bairro: string;
  cidade: string;
  uf: string;
  pais: string;
  query: string;
  rawName: string;
  center?: { lat: number; lng: number };
  bbox?: { west: number; south: number; east: number; north: number };
}

// Preset Locations Map for instant & accurate coordinate and bounding box lookup
export const PRESET_LOCATIONS_EXACT: Record<
  string,
  {
    bairro: string;
    cidade: string;
    uf: string;
    pais: string;
    name: string;
    center: { lat: number; lng: number };
    bbox: { west: number; south: number; east: number; north: number };
  }
> = {
  'bela vista, são paulo': {
    bairro: 'Bela Vista',
    cidade: 'São Paulo',
    uf: 'SP',
    pais: 'Brasil',
    name: 'Bela Vista, São Paulo - SP',
    center: { lat: -23.5601219, lng: -46.6500338 },
    bbox: { west: -46.6589080, south: -23.5733169, east: -46.6375568, north: -23.5508310 },
  },
  'bela vista, sao paulo': {
    bairro: 'Bela Vista',
    cidade: 'São Paulo',
    uf: 'SP',
    pais: 'Brasil',
    name: 'Bela Vista, São Paulo - SP',
    center: { lat: -23.5601219, lng: -46.6500338 },
    bbox: { west: -46.6589080, south: -23.5733169, east: -46.6375568, north: -23.5508310 },
  },
  'bela vista': {
    bairro: 'Bela Vista',
    cidade: 'São Paulo',
    uf: 'SP',
    pais: 'Brasil',
    name: 'Bela Vista, São Paulo - SP',
    center: { lat: -23.5601219, lng: -46.6500338 },
    bbox: { west: -46.6589080, south: -23.5733169, east: -46.6375568, north: -23.5508310 },
  },
  'vila sonia': {
    bairro: 'Vila Sônia',
    cidade: 'São Paulo',
    uf: 'SP',
    pais: 'Brasil',
    name: 'Vila Sônia, São Paulo - SP',
    center: { lat: -23.5939, lng: -46.7328 },
    bbox: { west: -46.7450, south: -23.6050, east: -46.7200, north: -23.5820 },
  },
  'vila sônia': {
    bairro: 'Vila Sônia',
    cidade: 'São Paulo',
    uf: 'SP',
    pais: 'Brasil',
    name: 'Vila Sônia, São Paulo - SP',
    center: { lat: -23.5939, lng: -46.7328 },
    bbox: { west: -46.7450, south: -23.6050, east: -46.7200, north: -23.5820 },
  },
  'moema': {
    bairro: 'Moema',
    cidade: 'São Paulo',
    uf: 'SP',
    pais: 'Brasil',
    name: 'Moema, São Paulo - SP',
    center: { lat: -23.6038, lng: -46.6639 },
    bbox: { west: -46.6750, south: -23.6150, east: -46.6520, north: -23.5920 },
  },
  'sao paulo': {
    bairro: '',
    cidade: 'São Paulo',
    uf: 'SP',
    pais: 'Brasil',
    name: 'São Paulo - SP',
    center: { lat: -23.5505, lng: -46.6333 },
    bbox: { west: -46.6855, south: -23.5855, east: -46.5811, north: -23.5155 },
  },
  'são paulo': {
    bairro: '',
    cidade: 'São Paulo',
    uf: 'SP',
    pais: 'Brasil',
    name: 'São Paulo - SP',
    center: { lat: -23.5505, lng: -46.6333 },
    bbox: { west: -46.6855, south: -23.5855, east: -46.5811, north: -23.5155 },
  },
};

export const PRESET_LOCATIONS: Record<string, { name: string; lat: number; lng: number }> = {
  'bela vista': { name: 'Bela Vista, São Paulo - SP', lat: -23.5601219, lng: -46.6500338 },
  'sao paulo': { name: 'São Paulo - SP', lat: -23.5505, lng: -46.6333 },
  'são paulo': { name: 'São Paulo - SP', lat: -23.5505, lng: -46.6333 },
  'sp': { name: 'São Paulo - SP', lat: -23.5505, lng: -46.6333 },
  'centro de são paulo': { name: 'São Paulo - Centro', lat: -23.5489, lng: -46.6388 },
  'centro de sao paulo': { name: 'São Paulo - Centro', lat: -23.5489, lng: -46.6388 },
  'centro sp': { name: 'São Paulo - Centro', lat: -23.5489, lng: -46.6388 },
  'centro, são paulo': { name: 'São Paulo - Centro', lat: -23.5489, lng: -46.6388 },
  'centro, sao paulo': { name: 'São Paulo - Centro', lat: -23.5489, lng: -46.6388 },
  'centro': { name: 'São Paulo - Centro', lat: -23.5489, lng: -46.6388 },
  'paulista': { name: 'São Paulo - Av. Paulista', lat: -23.5615, lng: -46.6559 },
  'av paulista': { name: 'São Paulo - Av. Paulista', lat: -23.5615, lng: -46.6559 },
  'avenida paulista': { name: 'São Paulo - Av. Paulista', lat: -23.5615, lng: -46.6559 },
  'moema': { name: 'São Paulo - Moema', lat: -23.6038, lng: -46.6639 },
  'mooca': { name: 'São Paulo - Mooca', lat: -23.5594, lng: -46.5983 },
  'pinheiros': { name: 'São Paulo - Pinheiros', lat: -23.5658, lng: -46.6872 },
  'itaim bibi': { name: 'São Paulo - Itaim Bibi', lat: -23.5847, lng: -46.6778 },
  'itaim': { name: 'São Paulo - Itaim Bibi', lat: -23.5847, lng: -46.6778 },
  'vila mariana': { name: 'São Paulo - Vila Mariana', lat: -23.5815, lng: -46.6381 },
  'tatuape': { name: 'São Paulo - Tatuapé', lat: -23.5385, lng: -46.5765 },
  'tatuapé': { name: 'São Paulo - Tatuapé', lat: -23.5385, lng: -46.5765 },
  'santana': { name: 'São Paulo - Santana', lat: -23.5042, lng: -46.6267 },
  'brooklin': { name: 'São Paulo - Brooklin', lat: -23.6125, lng: -46.6908 },
  'jardins': { name: 'São Paulo - Jardins', lat: -23.5667, lng: -46.6667 },
  'barra funda': { name: 'São Paulo - Barra Funda', lat: -23.5262, lng: -46.6672 },
  'ipiranga': { name: 'São Paulo - Ipiranga', lat: -23.5878, lng: -46.6083 },
  'perdizes': { name: 'São Paulo - Perdizes', lat: -23.5367, lng: -46.6717 },
  'lapa': { name: 'São Paulo - Lapa', lat: -23.5218, lng: -46.7028 },
  'vila madalena': { name: 'São Paulo - Vila Madalena', lat: -23.5550, lng: -46.6917 },
  'vila sonia': { name: 'Vila Sônia, São Paulo - SP', lat: -23.5939, lng: -46.7328 },
  'vila sônia': { name: 'Vila Sônia, São Paulo - SP', lat: -23.5939, lng: -46.7328 },
  'morumbi': { name: 'São Paulo - Morumbi', lat: -23.6111, lng: -46.7083 },
  'campinas': { name: 'Campinas - SP', lat: -22.9056, lng: -47.0608 },
  'rio de janeiro': { name: 'Rio de Janeiro - RJ', lat: -22.9068, lng: -43.1729 },
  'rj': { name: 'Rio de Janeiro - RJ', lat: -22.9068, lng: -43.1729 },
  'copacabana': { name: 'Rio de Janeiro - Copacabana', lat: -22.9694, lng: -43.1868 },
  'barra da tijuca': { name: 'Rio de Janeiro - Barra da Tijuca', lat: -23.0003, lng: -43.3659 },
  'curitiba': { name: 'Curitiba - PR', lat: -25.4290, lng: -49.2671 },
  'batel': { name: 'Curitiba - Batel', lat: -25.4428, lng: -49.2887 },
  'florianopolis': { name: 'Florianópolis - SC', lat: -27.5954, lng: -48.5480 },
  'florianópolis': { name: 'Florianópolis - SC', lat: -27.5954, lng: -48.5480 },
  'belo horizonte': { name: 'Belo Horizonte - MG', lat: -19.9217, lng: -43.9378 },
  'savassi': { name: 'Belo Horizonte - Savassi', lat: -19.9388, lng: -43.9329 },
  'porto alegre': { name: 'Porto Alegre - RS', lat: -30.0346, lng: -51.2177 },
  'brasilia': { name: 'Brasília - DF', lat: -15.7975, lng: -47.8919 },
  'brasília': { name: 'Brasília - DF', lat: -15.7975, lng: -47.8919 },
  'salvador': { name: 'Salvador - BA', lat: -12.9777, lng: -38.5016 },
  'recife': { name: 'Recife - PE', lat: -8.0476, lng: -34.8770 },
  'fortaleza': { name: 'Fortaleza - CE', lat: -3.7319, lng: -38.5267 },
  'goiania': { name: 'Goiânia - GO', lat: -16.6869, lng: -49.2648 },
  'goiânia': { name: 'Goiânia - GO', lat: -16.6869, lng: -49.2648 },
};

// Official valid Overture Places category taxonomy (in snake_case)
export const OFFICIAL_OVERTURE_TAXONOMY = new Set<string>([
  // Automotive & Repairs
  'auto_repair',
  'car_repair',
  'automotive_service',
  'auto_parts_store',
  'car_dealer',
  'oil_change_station',
  'tire_shop_and_repair',
  'auto_body_shop',
  'car_wash',

  // Motorcycles
  'motorcycle_repair',
  'motorcycle_dealer',
  'motorcycle_parts_store',
  'motorcycle_shop',

  // Health & Hospitals
  'hospital',
  'medical_center',
  'emergency_room',
  'urgent_care_center',
  'outpatient_care_facility',
  'medical_clinic',
  'doctor',
  'health_and_medical',

  // Dentistry
  'dentist',
  'dental_clinic',
  'orthodontist',
  'pediatric_dentist',

  // Fitness & Gyms
  'gym',
  'fitness_center',
  'sports_club',
  'yoga_studio',
  'pilates_studio',
  'crossfit_box',

  // Food & Dining
  'restaurant',
  'pizzeria',
  'fast_food_restaurant',
  'bakery',
  'cafe',
  'bar',
  'food_and_beverage',

  // Services & Business
  'pharmacy',
  'drugstore',
  'grocery_store',
  'supermarket',
  'real_estate_agency',
  'real_estate_agent',
  'real_estate_service',
  'law_firm',
  'attorney',
  'veterinarian',
  'pet_store',
  'pet_grooming',
  'beauty_salon',
  'barbershop',
  'driving_school',
  'professional_service',
  'corporate_office',
]);

/**
 * Validates candidate category strings against the official Overture taxonomy.
 * Returns valid snake_case categories and rejected candidate strings.
 */
export function getValidOvertureCategories(candidateCategories: string[]): {
  valid: string[];
  rejected: string[];
} {
  const valid: string[] = [];
  const rejected: string[] = [];

  for (const cat of candidateCategories) {
    const formattedCat = cat.toLowerCase().trim().replace(/\s+/g, '_');
    if (OFFICIAL_OVERTURE_TAXONOMY.has(formattedCat)) {
      if (!valid.includes(formattedCat)) {
        valid.push(formattedCat);
      }
    } else {
      if (!rejected.includes(cat)) {
        rejected.push(cat);
      }
    }
  }

  return { valid, rejected };
}

// Map user intents to candidate categories (including invalid candidates to test rejection mechanism)
const CATEGORY_TAXONOMY_MAP: Array<{
  match: (q: string) => boolean;
  businessType: string;
  candidateCategories: string[];
  keywords: string[];
}> = [
  {
    // Oficina de Moto
    match: (q) => /oficina.*moto|moto.*oficina|motope[çc]a|mecanica.*moto|mec[âa]nica.*moto|motos\b/i.test(q),
    businessType: 'oficina de moto',
    candidateCategories: [
      'motorcycle_repair',
      'motorcycle_dealer',
      'motorcycle_parts_store',
      'motorcycle_shop',
      'oficina_de_moto_fake',
      'motopeças_invalid',
    ],
    keywords: ['moto', 'motopeça', 'motopeças', 'oficina', 'mecânica', 'mecanica', 'motos', 'motocicleta', 'scooter'],
  },
  {
    // Mecânica / Oficina Mecânica / Auto Repair
    match: (q) => /mec[âa]nica|mec[âa]nicas|oficina|oficinas|auto repair|centro automotivo|repara[çc][ãa]o automotiva/i.test(q),
    businessType: 'mecânica',
    candidateCategories: [
      'auto_repair',
      'car_repair',
      'automotive_service',
      'oficina_mecanica_fake',
      'oficinas_auto_invalid',
    ],
    keywords: ['mecânica', 'mecanica', 'oficina', 'auto', 'repar', 'garage', 'automotivo', 'mecanico', 'mecânico'],
  },
  {
    // Hospital / Hospitais
    match: (q) => /hospital|hospitais|pronto socorro|pronto-socorro|sanat[óo]rio/i.test(q),
    businessType: 'hospital',
    candidateCategories: [
      'hospital',
      'medical_center',
      'emergency_room',
      'urgent_care_center',
      'hospitais_br_fake',
      'sanatorio_invalid',
    ],
    keywords: ['hospital', 'hosp', 'pronto socorro', 'pronto-socorro', 'sanatorio', 'clínica', 'clinica', 'médic', 'medic'],
  },
  {
    // Dentista / Dentistas / Odontologia
    match: (q) => /dentista|dentistas|odontologia|odonto|cl[íi]nica odontol[óo]gica|dentaria/i.test(q),
    businessType: 'dentista',
    candidateCategories: [
      'dentist',
      'dental_clinic',
      'orthodontist',
      'dentista_odontologia_fake',
      'clinica_odonto_invalid',
    ],
    keywords: ['dentist', 'odonto', 'dent', 'sorris', 'implant', 'ortodon'],
  },
  {
    // Despachante
    match: (q) => /despachante|despachantes|cnh|documento|detran|licenciamento/i.test(q),
    businessType: 'despachante',
    candidateCategories: ['professional_service', 'corporate_office', 'despachante_fake'],
    keywords: ['despachante', 'cnh', 'documentos', 'veículos', 'autoescola', 'detran', 'licenciamento'],
  },
  {
    // Clínica Médica
    match: (q) => /cl[íi]nica|cl[íi]nicas|consult[óo]rio|m[ée]dico|m[ée]dicos|sa[úu]de/i.test(q),
    businessType: 'clínica médica',
    candidateCategories: [
      'medical_clinic',
      'doctor',
      'outpatient_care_facility',
      'health_and_medical',
      'clinica_medica_fake',
    ],
    keywords: ['clínica', 'clinica', 'médic', 'medic', 'consultorio', 'saúde', 'saude', 'doutor'],
  },
  {
    // Restaurante / Alimentação
    match: (q) => /restaurante|restaurantes|comida|pizzaria|pizzarias|hamburgueria|lancheira|bistro|gastronomia/i.test(q),
    businessType: 'restaurante',
    candidateCategories: [
      'restaurant',
      'pizzeria',
      'fast_food_restaurant',
      'food_and_beverage',
      'bistro_fake',
    ],
    keywords: ['restaurante', 'comida', 'pizzaria', 'bistro', 'gourmet', 'grill', 'lanches', 'massa', 'sushi'],
  },
  {
    // Academia / Fitness
    match: (q) => /academia|academias|fitness|crossfit|pilates|gin[áa]sio/i.test(q),
    businessType: 'academia',
    candidateCategories: [
      'gym',
      'fitness_center',
      'sports_club',
      'crossfit_box',
      'academia_fit_fake',
    ],
    keywords: ['academia', 'fitness', 'crossfit', 'pilates', 'gym', 'treino', 'musculação'],
  },
  {
    // Padaria
    match: (q) => /padaria|padarias|confeitaria|panificadora/i.test(q),
    businessType: 'padaria',
    candidateCategories: ['bakery', 'cafe', 'padaria_fake'],
    keywords: ['padaria', 'panificadora', 'confeitaria', 'pão', 'pao', 'doce'],
  },
  {
    // Farmácia
    match: (q) => /farm[áa]cia|farm[áa]cias|drogaria|drogarias/i.test(q),
    businessType: 'farmácia',
    candidateCategories: ['pharmacy', 'drugstore', 'farmacia_fake'],
    keywords: ['farmácia', 'farmacia', 'drogaria', 'farma', 'remédio'],
  },
  {
    // Agência de Marketing / Publicidade
    match: (q) => /ag[êe]ncia|ag[êe]ncias|marketing|publicidade|propaganda|m[ée]dia|digital/i.test(q),
    businessType: 'agência de marketing',
    candidateCategories: ['professional_service', 'corporate_office', 'marketing_agency_fake'],
    keywords: ['agência', 'agencia', 'marketing', 'publicidade', 'propaganda', 'digital', 'mídia', 'midia'],
  },
];

export function parseSearchLocation(message: string): InterpretedLocation {
  const lowerMsg = message.toLowerCase().trim();

  // 1. Check exact presets (sorted by key length descending so specific neighborhoods match first)
  const sortedPresets = Object.entries(PRESET_LOCATIONS_EXACT).sort(([a], [b]) => b.length - a.length);

  for (const [key, preset] of sortedPresets) {
    if (lowerMsg.includes(key)) {
      return {
        bairro: preset.bairro,
        cidade: preset.cidade,
        uf: preset.uf,
        pais: preset.pais,
        query: `${preset.bairro ? preset.bairro + ', ' : ''}${preset.cidade}, ${preset.uf}, ${preset.pais}`,
        rawName: preset.name,
        center: preset.center,
        bbox: preset.bbox,
      };
    }
  }

  // 2. Extract location using prepositions em/no/na/de/para/perto de/região de
  const locRegex = /\b(?:em|no|na|de|para|perto d[eo]|regi[ãa]o d[eo])\s+([A-Za-zÀ-ÖØ-öø-ÿ\s,-]{3,50})/i;
  const match = message.match(locRegex);
  let rawLocStr = match && match[1] ? match[1].trim().replace(/[.,?!]$/, '') : '';

  const ignoreWords = ['alta conversao', 'whatsapp', 'site', 'uma lista', 'contato', 'vendas', 'prospeccao', 'empresas', 'negocios'];
  if (ignoreWords.some((w) => rawLocStr.toLowerCase().includes(w))) {
    rawLocStr = '';
  }

  let bairro = '';
  let cidade = 'São Paulo';
  let uf = 'SP';
  let pais = 'Brasil';

  if (rawLocStr.includes(',')) {
    const parts = rawLocStr.split(',').map((p) => p.trim());
    bairro = parts[0];
    cidade = parts[1] || 'São Paulo';
  } else if (rawLocStr.includes('-')) {
    const parts = rawLocStr.split('-').map((p) => p.trim());
    bairro = parts[0];
    cidade = parts[1] || 'São Paulo';
  } else if (rawLocStr) {
    bairro = rawLocStr;
  }

  return {
    bairro,
    cidade,
    uf,
    pais,
    query: `${bairro ? bairro + ', ' : ''}${cidade}, ${uf}, ${pais}`,
    rawName: rawLocStr || `${cidade} - ${uf}`,
  };
}

export function interpretSearchIntent(
  message: string,
  currentRegionName: string
): ParsedSearchIntent {
  const lowerMsg = message.toLowerCase().trim();

  // 1. Extract Filters
  const noWebsite = /sem\s+(website|site|pagina|página)/i.test(lowerMsg);
  const hasWebsite = /com\s+(website|site|pagina|página)|tem\s+site/i.test(lowerMsg);
  const hasPhone = /com\s+(whatsapp|zap|telefone|contato)/i.test(lowerMsg);

  // 2. Extract Location via parseSearchLocation
  const loc = parseSearchLocation(message);
  const locationName = loc.rawName || currentRegionName;

  // 3. Extract Business Type & Validate Candidates against official Overture taxonomy
  let matchedTaxonomy = CATEGORY_TAXONOMY_MAP.find((item) => item.match(lowerMsg));

  let candidateCategories: string[] = [];
  let businessType = 'estabelecimento';
  let keywords: string[] = [];

  if (matchedTaxonomy) {
    businessType = matchedTaxonomy.businessType;
    candidateCategories = matchedTaxonomy.candidateCategories;
    keywords = matchedTaxonomy.keywords;
  } else {
    const words = lowerMsg
      .replace(/[.,?!]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !['onde', 'quais', 'buscar', 'encontrar', 'ache', 'para', 'com', 'sem', 'perto', 'regiao'].includes(w));

    businessType = words.length > 0 ? words[0] : 'estabelecimento';
    candidateCategories = [businessType, 'professional_service', 'corporate_office', `${businessType}_invalid_category`];
    keywords = words;
  }

  // 4. Central Validation: getValidOvertureCategories
  const { valid, rejected } = getValidOvertureCategories(candidateCategories);

  return {
    rawMessage: message,
    businessType,
    locationName: locationName || currentRegionName,
    filters: {
      noWebsite,
      hasWebsite,
      hasPhone,
    },
    validCategories: valid,
    rejectedCategories: rejected,
    keywords,
  };
}
