// Helper to translate raw English Overture categories into friendly Portuguese

const CATEGORY_TRANSLATIONS: Record<string, string> = {
  'Attorney Or Law Firm': 'Advocacia / Escritório de Advocacia',
  'Law Firm': 'Escritório de Advocacia',
  'Attorney': 'Advogado(a)',
  'Financial Service': 'Serviço Financeiro',
  'Real Estate Service': 'Serviço Imobiliário / Imobiliária',
  'Real Estate Agency': 'Imobiliária',
  'Real Estate Agent': 'Corretor de Imóveis',
  'Estabelecimento': 'Estabelecimento',
  'Establishment': 'Estabelecimento',
  'Outpatient Care Facility': 'Atendimento Ambulatorial',
  'Professional Service': 'Serviço Profissional',
  'Dentista': 'Dentista / Odontologia',
  'Dentist': 'Dentista / Odontologia',
  'Dental Clinic': 'Clínica Odontológica',
  'Restaurant': 'Restaurante',
  'Fashion And Apparel Store': 'Loja de Moda e Vestuário',
  'Hardware Home And Garden Store': 'Materiais de Construção e Jardinagem',
  'Media Service': 'Serviço de Mídia e Comunicação',
  'Personal Or Beauty Service': 'Serviço Pessoal ou de Beleza',
  'Social Or Community Service': 'Serviço Social ou Comunitário',
  'Bank Or Credit Union': 'Banco / Cooperativa de Crédito',
  'Complementary And Alternative Medicine': 'Medicina Complementar e Alternativa',
  'Corporate Or Business Office': 'Escritório / Sede Corporativa',
  'Physical Medicine And Rehabilitation': 'Fisioterapia e Reabilitação',
  'Wellness Service': 'Serviço de Bem-Estar e Saúde',
  'Animal Or Pet Service': 'Pet Shop / Serviço Animal',
  'Beauty Salon': 'Salão de Beleza',
  'Bakery': 'Padaria / Confeitaria',
  'Medical Clinic': 'Clínica Médica',
  'Grocery Store': 'Supermercado / Mercearia',
  'Supermarket': 'Supermercado',
  'Bar': 'Bar / Pub',
  'Hotel': 'Hotel / Pousada',
  'School': 'Escola / Ensino',
  'Gym': 'Academia / Centro Esportivo',
  'Gas Station': 'Posto de Combustível',
  'Car Repair': 'Oficina Mecânica',
  'Auto Repair': 'Oficina Mecânica',
  'Shopping Mall': 'Shopping Center',
  'Church': 'Igreja / Templo',
  'Hospital': 'Hospital',
  'Pharmacy': 'Farmácia / Drogaria',
  'Veterinary Service': 'Clínica Veterinária',
  'Cafe': 'Cafeteria',
  'Coffee Shop': 'Cafeteria',
  'Travel Agency': 'Agência de Viagens',
  'Accounting Service': 'Contabilidade / Serviços Contábeis',
  'Software Company': 'Empresa de Tecnologia e Software',
  'Construction Company': 'Construtora / Engenharia',
  'Cleaning Service': 'Serviço de Limpeza',
  'Event Venue': 'Espaço de Eventos',
  'Laundry Service': 'Lavanderia',
  'Print Shop': 'Gráfica / Comunicação Visual',
  'Automotive Service': 'Serviço Automotivo',
  'Entertainment Service': 'Entretenimento e Lazer',
  'Education Service': 'Educação e Cursos',
  'Food And Beverage': 'Alimentação e Bebidas',
  'Health And Medical': 'Saúde e Medicina',
  'Home Improvement Store': 'Casa e Decoração',
  'Insurance Agency': 'Corretora de Seguros',
  'Marketing Service': 'Agência de Marketing',
  'Consulting Service': 'Consultoria Empresarial',
  'IT Service': 'Serviços de TI',
  'Photography Service': 'Estúdio de Fotografia',
  'Security Service': 'Segurança e Vigilância',
  'Sports Club': 'Clube Esportivo',
  'Nail Salon': 'Esmalteria / Unhas',
  'Barbershop': 'Barbearia',
  'Spa': 'Spa e Estética',
};

export function translateCategory(categoryName: string | undefined | null): string {
  if (!categoryName) return 'Estabelecimento';
  const trimmed = categoryName.trim();
  if (CATEGORY_TRANSLATIONS[trimmed]) {
    return CATEGORY_TRANSLATIONS[trimmed];
  }

  // Gracefully replace common English words if no exact dictionary match
  let translated = trimmed
    .replace(/\bAttorney Or Law Firm\b/gi, 'Advocacia')
    .replace(/\bLaw Firm\b/gi, 'Escritório de Advocacia')
    .replace(/\bReal Estate\b/gi, 'Imobiliária')
    .replace(/\bService\b/gi, 'Serviço')
    .replace(/\bServices\b/gi, 'Serviços')
    .replace(/\bStore\b/gi, 'Loja')
    .replace(/\bOffice\b/gi, 'Escritório')
    .replace(/\bFacility\b/gi, 'Instalação')
    .replace(/\bClinic\b/gi, 'Clínica')
    .replace(/\bOr\b/gi, 'ou')
    .replace(/\bAnd\b/gi, 'e')
    .replace(/\bBeauty\b/gi, 'Beleza')
    .replace(/\bCare\b/gi, 'Cuidados')
    .replace(/\bPersonal\b/gi, 'Pessoal')
    .replace(/\bSocial\b/gi, 'Social')
    .replace(/\bCommunity\b/gi, 'Comunitário')
    .replace(/\bCorporate\b/gi, 'Corporativo')
    .replace(/\bBusiness\b/gi, 'Negócios')
    .replace(/\bPhysical\b/gi, 'Físico')
    .replace(/\bMedicine\b/gi, 'Medicina')
    .replace(/\bWellness\b/gi, 'Bem-Estar')
    .replace(/\bAnimal\b/gi, 'Animal')
    .replace(/\bPet\b/gi, 'Pet')
    .replace(/\bFashion\b/gi, 'Moda')
    .replace(/\bApparel\b/gi, 'Vestuário')
    .replace(/\bHardware\b/gi, 'Materiais')
    .replace(/\bHome\b/gi, 'Casa')
    .replace(/\bGarden\b/gi, 'Jardim')
    .replace(/\bMedia\b/gi, 'Mídia')
    .replace(/\bBank\b/gi, 'Banco')
    .replace(/\bCredit Union\b/gi, 'Cooperativa de Crédito');

  return translated;
}
