// Portuguese Translation Dictionary for Overture/OSM Categories

const CATEGORY_TRANSLATIONS: Record<string, string> = {
  // Gastronomia
  restaurant: 'Restaurantes',
  restaurants: 'Restaurantes',
  food: 'Alimentação & Gastronomia',
  cafe: 'Cafeterias & Cafés',
  coffee_shop: 'Cafeterias & Cafés',
  bakery: 'Padarias & Confeitarias',
  bar: 'Bares & Pubs',
  pub: 'Bares & Pubs',
  nightclub: 'Casas Noturnas & Baladas',
  brewery: 'Cervejarias',
  pizzeria: 'Pizzarias',
  fast_food: 'Fast Food & Lanches',
  ice_cream_shop: 'Sorveterias',
  meal_takeaway: 'Comida para Viagem',
  meal_delivery: 'Delivery & Entregas',

  // Beleza & Bem-estar
  beauty_salon: 'Salões de Beleza & Estética',
  hair_salon: 'Salões de Beleza & Cabelo',
  barber_shop: 'Barbearias',
  spa: 'Spas & Massoterapia',
  nail_salon: 'Esmalterias & Unhas',

  // Saúde & Medicina
  health: 'Saúde & Cuidados Médicos',
  doctor: 'Médicos & Clínicas',
  hospital: 'Hospitais',
  medical_clinic: 'Clínicas Médicas',
  dentist: 'Odontologia & Dentistas',
  pharmacy: 'Farmácias & Drogarias',
  drugstore: 'Farmácias & Drogarias',
  physiotherapist: 'Fisioterapia & Reabilitação',
  psychologist: 'Psicologia & Terapia',
  optician: 'Óticas',

  // Fitness & Esportes
  gym: 'Academias & Fitness',
  fitness_center: 'Academias & Centros Esportivos',
  sports_club: 'Clubes Esportivos',
  martial_arts_school: 'Artes Marciais',
  swimming_pool: 'Escolas de Natação',
  yoga_studio: 'Estúdios de Yoga & Pilates',

  // Animais & Pets
  pet_store: 'Pet Shops',
  veterinary_care: 'Clínicas Veterinárias',
  pet_groomer: 'Banho & Tosa',

  // Automotivo
  car_repair: 'Oficinas Mecânicas & Auto',
  auto_repair: 'Oficinas Mecânicas',
  car_dealer: 'Concessionárias & Revenda de Veículos',
  gas_station: 'Postos de Combustível',
  car_wash: 'Lava-rápidos',
  auto_parts_store: 'Autopeças & Acessórios',

  // Moda & Varejo
  clothing_store: 'Lojas de Roupas & Moda',
  shoe_store: 'Calçados',
  jewelry_store: 'Joalherias & Relojoarias',
  shopping_mall: 'Shopping Centers',
  department_store: 'Lojas de Departamento',
  supermarket: 'Supermercados & Mercados',
  grocery_store: 'Mercearias & Mercados',
  convenience_store: 'Lojas de Conveniência',
  liquor_store: 'Distribuidoras de Bebidas',
  electronics_store: 'Eletrônicos & Celulares',
  computer_store: 'Informática & Computadores',
  furniture_store: 'Móveis & Decoração',
  home_goods_store: 'Artigos para o Lar',
  hardware_store: 'Materiais de Construção',
  book_store: 'Livrarias',
  stationery_store: 'Papelarias',
  florist: 'Floriculturas',
  toy_store: 'Lojas de Brinquedos',

  // Imobiliárias & Construção
  real_estate_agency: 'Imobiliárias & Corretores',
  construction_company: 'Construção Civil & Reformas',
  architect: 'Arquitetura & Urbanismo',
  contractor: 'Empreiteiras & Reformas',

  // Serviços Profissionais & B2B
  lawyer: 'Advocacia & Serviços Jurídicos',
  legal_services: 'Serviços Jurídicos',
  accounting: 'Contabilidade & Escritórios Fiscais',
  financial_services: 'Serviços Financeiros & Crédito',
  insurance_agency: 'Corretoras de Seguros',
  advertising_agency: 'Agências de Publicidade & Marketing',
  marketing_agency: 'Marketing & Design',
  consulting_service: 'Consultorias Empresariais',
  coworking_space: 'Espaços de Coworking',
  photography_studio: 'Estúdios de Fotografia',
  printing_service: 'Gráficas & Impressões',
  laundry: 'Lavanderias',
  dry_cleaner: 'Lavanderias a Seco',

  // Educação & Cursos
  school: 'Escolas & Colégios',
  language_school: 'Escolas de Idiomas',
  driving_school: 'Autoescolas',
  preschool: 'Escolas Infantis & Creches',
  university: 'Universidades & Faculdades',
  music_school: 'Escolas de Música',
  dance_school: 'Escolas de Dança',
  training_centre: 'Centros de Treinamento & Cursos',

  // Hospedagem & Turismo
  hotel: 'Hotéis & Pousadas',
  motel: 'Motéis',
  hostel: 'Hostels & Albergues',
  guest_house: 'Pousadas',
  travel_agency: 'Agências de Viagens & Turismo',

  // Outros
  establishment: 'Comércio & Serviços',
  service: 'Serviços Gerais',
  store: 'Lojas & Comércio',
  event_venue: 'Espaços de Eventos',
  place_of_worship: 'Templos & Igrejas',
};

/**
 * Translates any category string into clean, professional Brazilian Portuguese.
 */
export function translateCategory(rawCategory?: string | null): string {
  if (!rawCategory) return 'Comércio & Serviços';

  // Clean and normalize input
  const normalized = rawCategory
    .toLowerCase()
    .trim()
    .replace(/[- /]+/g, '_');

  // Direct map check
  if (CATEGORY_TRANSLATIONS[normalized]) {
    return CATEGORY_TRANSLATIONS[normalized];
  }

  // Partial match checks
  for (const [key, translated] of Object.entries(CATEGORY_TRANSLATIONS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return translated;
    }
  }

  // Check words individually
  const words = normalized.split('_');
  for (const w of words) {
    if (w.length > 2 && CATEGORY_TRANSLATIONS[w]) {
      return CATEGORY_TRANSLATIONS[w];
    }
  }

  // Format nicely if unknown
  return rawCategory
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
