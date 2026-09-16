export interface SearchProfile {
  id: string;
  label: string;
  aliases: string[];
  exactCategories: string[];
  exactTaxonomies: string[];
  broadCategories: string[];
  nameTerms: string[];
}

export function normalizeSearchText(value: string): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const p = (
  id: string,
  label: string,
  aliases: string[],
  exactCategories: string[],
  exactTaxonomies: string[],
  broadCategories: string[],
  nameTerms: string[]
): SearchProfile => ({ id, label, aliases, exactCategories, exactTaxonomies, broadCategories, nameTerms });

/**
 * High precision profiles for the most common local-business searches in Brazil.
 * Exact category/taxonomy matches are preferred. Broad categories only qualify
 * when the business name also contains a strong term for the requested segment.
 */
export const SEARCH_PROFILES: SearchProfile[] = [
  p('despachante', 'Despachante',
    ['despachante', 'despachantes', 'despachante veicular', 'despachante documentalista', 'documentalista'],
    [], [],
    ['professional_service', 'financial_service', 'legal_service', 'automotive_service', 'government_department', 'corporate_or_business_office', 'automobile_registration_service', 'customs_broker'],
    ['despachante', 'despachantes', 'documentalista', 'documentacao veicular', 'documentação veicular', 'documentos veiculares']),

  p('hospital', 'Hospital',
    ['hospital', 'hospitais', 'hospital geral'],
    ['hospital'], ['hospital', 'general_hospital', 'emergency_hospital'],
    ['health_care', 'medical_service'], ['hospital']),

  p('borracharia', 'Borracharia',
    ['borracharia', 'borracharias', 'loja de pneus', 'pneus', 'pneu'],
    [], ['tire_dealer_and_repair', 'tire_shop', 'tire_repair'],
    ['automotive_service', 'vehicle_parts_store'], ['borracharia', 'borrachas', 'pneus', 'pneu']),

  p('banco', 'Banco',
    ['banco', 'bancos', 'agencia bancaria', 'agência bancária'],
    ['bank_or_credit_union'], ['bank', 'bank_or_credit_union', 'credit_union'],
    ['financial_service'], ['banco', 'bank']),

  p('farmacia', 'Farmácia',
    ['farmacia', 'farmácia', 'farmacias', 'farmácias', 'drogaria', 'drogarias'],
    ['pharmacy_and_drug_store'], ['pharmacy', 'drugstore'],
    [], ['farmacia', 'farmácia', 'drogaria']),

  p('dentista', 'Dentista',
    ['dentista', 'dentistas', 'odontologia', 'clinica odontologica', 'clínica odontológica'],
    ['dental_clinic'], ['dental_clinic', 'general_dentistry', 'cosmetic_dentistry', 'orthodontics', 'pediatric_dentistry', 'prosthodontics'],
    ['health_care'], ['dentista', 'odontologia', 'odonto', 'dental']),

  p('clinica_medica', 'Clínica médica',
    ['clinica medica', 'clínica médica', 'clinica', 'clínica', 'consultorio medico', 'consultório médico'],
    ['outpatient_care_facility'], ['medical_clinic', 'outpatient_care_facility', 'primary_care_clinic'],
    ['medical_service', 'health_care'], ['clinica', 'clínica', 'consultorio', 'consultório']),

  p('mecanica', 'Oficina mecânica',
    ['mecanica', 'mecânica', 'oficina mecanica', 'oficina mecânica', 'auto center', 'autocenter'],
    [], ['automotive_repair', 'auto_repair', 'mechanic'],
    ['automotive_service', 'vehicle_service'], ['mecanica', 'mecânica', 'oficina', 'auto center', 'autocenter']),

  p('autoescola', 'Autoescola',
    ['autoescola', 'auto escola', 'escola de conducao', 'escola de condução'],
    [], ['driving_school', 'traffic_school'],
    ['specialty_school'], ['autoescola', 'auto escola']),

  p('restaurante', 'Restaurante',
    ['restaurante', 'restaurantes'],
    ['restaurant'], ['restaurant'],
    ['casual_eatery', 'fine_dining'], ['restaurante', 'restaurant']),

  p('pizzaria', 'Pizzaria',
    ['pizzaria', 'pizzarias', 'pizza'],
    ['pizza_restaurant'], ['pizzeria', 'pizza_restaurant'],
    ['restaurant', 'casual_eatery'], ['pizzaria', 'pizza']),

  p('padaria', 'Padaria',
    ['padaria', 'padarias', 'panificadora', 'panificadoras'],
    [], ['bakery'],
    ['casual_eatery', 'food_and_beverage_store'], ['padaria', 'panificadora', 'bakery']),

  p('academia', 'Academia',
    ['academia', 'academias', 'gym', 'fitness', 'centro fitness'],
    ['fitness_center'], ['gym', 'fitness_center'],
    ['sports_and_recreation'], ['academia', 'fitness', 'gym']),

  p('barbearia', 'Barbearia',
    ['barbearia', 'barbearias', 'barber shop', 'barbershop'],
    ['barber_shop'], ['barber_shop', 'barbershop'],
    ['personal_or_beauty_service'], ['barbearia', 'barber']),

  p('salao_beleza', 'Salão de beleza',
    ['salao de beleza', 'salão de beleza', 'salao', 'salão', 'cabeleireiro', 'cabeleireira'],
    ['beauty_salon'], ['beauty_salon', 'hair_salon'],
    ['personal_or_beauty_service'], ['salao', 'salão', 'cabeleireiro', 'cabeleireira']),

  p('pet_shop', 'Pet shop',
    ['pet shop', 'petshop', 'loja de animais'],
    ['pet_store'], ['pet_store'],
    ['animal_or_pet_service'], ['pet shop', 'petshop']),

  p('veterinario', 'Veterinário',
    ['veterinario', 'veterinário', 'veterinaria', 'veterinária', 'clinica veterinaria', 'clínica veterinária'],
    [], ['veterinarian', 'veterinary_clinic'],
    ['animal_or_pet_service'], ['veterin', 'vet ']),

  p('supermercado', 'Supermercado',
    ['supermercado', 'supermercados', 'mercado', 'mercados', 'hipermercado'],
    ['grocery_store'], ['supermarket', 'grocery_store'],
    ['food_and_beverage_store'], ['supermercado', 'mercado', 'hipermercado']),

  p('imobiliaria', 'Imobiliária',
    ['imobiliaria', 'imobiliária', 'imobiliarias', 'imobiliárias', 'imoveis', 'imóveis'],
    ['real_estate_service'], ['real_estate_agent', 'real_estate_agency', 'commercial_real_estate'],
    [], ['imobiliaria', 'imobiliária', 'imoveis', 'imóveis']),

  p('contabilidade', 'Contabilidade',
    ['contabilidade', 'contador', 'contadores', 'escritorio contabil', 'escritório contábil'],
    [], ['accountant', 'accounting_firm', 'tax_preparation'],
    ['financial_service', 'professional_service'], ['contabilidade', 'contador', 'contabil', 'contábil']),

  p('advocacia', 'Advocacia',
    ['advocacia', 'advogado', 'advogados', 'escritorio de advocacia', 'escritório de advocacia'],
    ['attorney_or_law_firm'], ['attorney_or_law_firm', 'law_firm', 'attorney'],
    ['legal_service'], ['advocacia', 'advogado', 'advogados']),

  p('marketing', 'Agência de marketing',
    ['agencia de marketing', 'agência de marketing', 'marketing digital', 'agencia de publicidade', 'agência de publicidade', 'publicidade'],
    [], ['marketing_agency', 'advertising_agency', 'social_media_agency'],
    ['professional_service'], ['marketing', 'publicidade', 'propaganda']),

  p('posto_combustivel', 'Posto de combustível',
    ['posto de gasolina', 'posto de combustivel', 'posto de combustível', 'gasolina'],
    ['fueling_station'], ['gas_station', 'fueling_station'],
    [], ['posto', 'gasolina', 'combustivel', 'combustível']),

  p('hotel', 'Hotel',
    ['hotel', 'hoteis', 'hotéis', 'pousada', 'pousadas'],
    ['hotel'], ['hotel', 'inn'],
    ['lodging'], ['hotel', 'pousada']),

  p('escola', 'Escola',
    ['escola', 'escolas', 'colegio', 'colégio'],
    [], ['school', 'private_school', 'public_school'],
    ['place_of_learning', 'education'], ['escola', 'colegio', 'colégio']),

  p('laboratorio', 'Laboratório',
    ['laboratorio', 'laboratório', 'laboratorios', 'laboratórios', 'laboratorio de analises', 'laboratório de análises'],
    ['diagnostics_imaging_or_lab_service'], ['laboratory_testing', 'medical_laboratory'],
    ['medical_service', 'technical_service'], ['laboratorio', 'laboratório']),

  p('otica', 'Ótica',
    ['otica', 'ótica', 'oticas', 'óticas', 'oculos', 'óculos'],
    ['eyewear_store'], ['optician', 'eyewear_store'],
    ['vision_or_eye_care_clinic'], ['otica', 'ótica', 'oculos', 'óculos']),

  p('autopecas', 'Autopeças',
    ['autopecas', 'autopeças', 'auto pecas', 'auto peças', 'pecas automotivas', 'peças automotivas'],
    ['vehicle_parts_store'], ['auto_parts_store'],
    [], ['autopecas', 'autopeças', 'auto pecas', 'auto peças']),

  p('lava_rapido', 'Lava-rápido',
    ['lava rapido', 'lava-rápido', 'lavagem automotiva', 'car wash'],
    [], ['car_wash'],
    ['automotive_service'], ['lava rapido', 'lava-rápido', 'lavagem', 'car wash']),

  p('estacionamento', 'Estacionamento',
    ['estacionamento', 'estacionamentos', 'parking'],
    ['parking'], ['parking'],
    [], ['estacionamento', 'parking']),
];

const NORMALIZED_ALIASES = SEARCH_PROFILES.flatMap((profile) =>
  profile.aliases.map((alias) => ({ profile, alias: normalizeSearchText(alias) }))
).sort((a, b) => b.alias.length - a.alias.length);

export function resolveSearchProfile(...values: string[]): SearchProfile | null {
  const haystack = normalizeSearchText(values.filter(Boolean).join(' '));
  if (!haystack) return null;

  for (const item of NORMALIZED_ALIASES) {
    const escaped = item.alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`(^|\\s)${escaped}(\\s|$)`).test(haystack)) return item.profile;
  }
  return null;
}

export function scoreAgainstProfile(
  business: { name?: string | null; category?: string | null; basicCategory?: string | null; taxonomyPrimary?: string | null },
  profile: SearchProfile
): number {
  const category = business.category || '';
  const basic = business.basicCategory || '';
  const taxonomy = business.taxonomyPrimary || '';

  if (profile.exactTaxonomies.includes(taxonomy)) return 120;
  if (profile.exactCategories.includes(category) || profile.exactCategories.includes(basic)) return 110;

  const normalizedName = normalizeSearchText(business.name || '');
  const hasStrongName = profile.nameTerms.some((term) => normalizedName.includes(normalizeSearchText(term)));
  if (!hasStrongName) return 0;

  if (profile.broadCategories.length === 0) return 90;
  if (
    profile.broadCategories.includes(category) ||
    profile.broadCategories.includes(basic) ||
    profile.broadCategories.includes(taxonomy)
  ) return 90;

  return 0;
}
