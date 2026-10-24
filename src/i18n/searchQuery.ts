import { getActiveLanguage } from './language';

/**
 * The search engine and its category aliases are Portuguese. English users can type
 * "pharmacies in Pinheiros" and we hand the engine "farmácia em Pinheiros".
 * Place names and anything we don't recognise are left exactly as typed.
 */

const SEGMENTS: Array<[RegExp, string]> = [
  [/\b(?:marketing|advertising) agenc(?:y|ies)\b/gi, 'agência de marketing'],
  [/\b(?:dental clinics?|dentists?|orthodontists?)\b/gi, 'dentista'],
  [/\b(?:pharmac(?:y|ies)|drug ?stores?|chemists?)\b/gi, 'farmácia'],
  [/\b(?:bakery|bakeries)\b/gi, 'padaria'],
  [/\b(?:restaurants?)\b/gi, 'restaurante'],
  [/\b(?:pizzerias?|pizza (?:places?|shops?|restaurants?))\b/gi, 'pizzaria'],
  [/\b(?:gyms?|fitness (?:centers?|studios?))\b/gi, 'academia'],
  [/\b(?:auto repair(?: shops?)?|car repair(?: shops?)?|mechanics?|garages?|body shops?)\b/gi, 'oficina mecânica'],
  [/\b(?:auto parts?(?: stores?| shops?)?|car parts?)\b/gi, 'autopeças'],
  [/\b(?:car washes?)\b/gi, 'lava-rápido'],
  [/\b(?:hair salons?|beauty salons?|salons?)\b/gi, 'salão de beleza'],
  [/\b(?:barber ?shops?|barbers?)\b/gi, 'barbearia'],
  [/\b(?:law firms?|lawyers?|attorneys?)\b/gi, 'advogado'],
  [/\b(?:accountants?|accounting (?:firms?|services?))\b/gi, 'contador'],
  [/\b(?:real estate (?:agenc(?:y|ies)|agents?|companies)|realtors?|real estate)\b/gi, 'imobiliária'],
  [/\b(?:veterinar(?:y|ians?)(?: clinics?)?|vets?)\b/gi, 'veterinário'],
  [/\b(?:pet (?:shops?|stores?))\b/gi, 'pet shop'],
  [/\b(?:florists?|flower shops?)\b/gi, 'floricultura'],
  [/\b(?:supermarkets?)\b/gi, 'supermercado'],
  [/\b(?:groceries|grocery (?:stores?|shops?)|convenience stores?)\b/gi, 'mercado'],
  [/\b(?:gas stations?|petrol stations?|fuel stations?)\b/gi, 'posto de gasolina'],
  [/\b(?:opticians?|optical stores?|eyewear)\b/gi, 'ótica'],
  [/\b(?:driving schools?)\b/gi, 'autoescola'],
  [/\b(?:schools?)\b/gi, 'escola'],
  [/\b(?:hospitals?)\b/gi, 'hospital'],
  [/\b(?:clinics?)\b/gi, 'clínica'],
  [/\b(?:hotels?)\b/gi, 'hotel'],
  [/\b(?:inns?|guesthouses?)\b/gi, 'pousada'],
  [/\b(?:banks?)\b/gi, 'banco'],
  [/\b(?:laborator(?:y|ies)|labs?)\b/gi, 'laboratório'],
  [/\b(?:parking(?: lots?)?)\b/gi, 'estacionamento'],
  [/\b(?:laundr(?:y|ies)|dry cleaners?)\b/gi, 'lavanderia'],
  [/\b(?:coffee shops?|cafes?|cafés?)\b/gi, 'cafeteria'],
  [/\b(?:bars?|pubs?)\b/gi, 'bar'],
  [/\b(?:print shops?|printing)\b/gi, 'gráfica'],
  [/\b(?:construction compan(?:y|ies)|contractors?)\b/gi, 'construtora'],
  [/\b(?:travel agenc(?:y|ies))\b/gi, 'agência de viagens'],
];

const PHRASES: Array<[RegExp, string]> = [
  [/\b(?:without|with no|no|lacking)\s+(?:an?\s+)?(?:web ?sites?)\b/gi, 'sem site'],
  [/\b(?:with|having)\s+(?:an?\s+)?(?:web ?sites?)\b/gi, 'com site'],
  [/\b(?:without|with no|no)\s+(?:an?\s+)?(?:phone(?: numbers?)?|whatsapp)\b/gi, 'sem telefone'],
  [/\b(?:with|having)\s+(?:an?\s+)?phone(?: numbers?)?\b/gi, 'com telefone'],
  [/\b(?:with|having)\s+(?:a\s+)?whatsapp\b/gi, 'com whatsapp'],
  [/\b(?:without|with no|no)\s+(?:social media|instagram)\b/gi, 'sem redes sociais'],
  [/\b(?:with|having)\s+(?:social media|instagram)\b/gi, 'com redes sociais'],
  [/\b(?:near|nearby|close to|around|next to)\b/gi, 'perto de'],
];

export function localizeSearchQuery(query: string): string {
  if (getActiveLanguage() !== 'en') return query;
  let out = ` ${query} `;
  for (const [pattern, replacement] of PHRASES) out = out.replace(pattern, replacement);
  for (const [pattern, replacement] of SEGMENTS) out = out.replace(pattern, replacement);
  // "<segment> in <place>" -> "<segment> em <place>"
  out = out.replace(/\s(?:in|at)\s+(?=\S)/gi, ' em ');
  return out.replace(/\s+/g, ' ').trim();
}
