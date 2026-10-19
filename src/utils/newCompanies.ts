import { Business } from '../types';

/** Companies opened within this many months are treated as "new company" alerts. */
export const NEW_COMPANY_MONTHS = 6;

/** Whole months since the company started activity (CNPJ), or null when unknown. */
export function getMonthsOpen(business: Business, now = new Date()): number | null {
  if (!business.dataInicioAtividade) return null;
  const start = new Date(business.dataInicioAtividade);
  if (Number.isNaN(start.getTime())) return null;
  const months =
    (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  return months < 0 ? 0 : months;
}

export function formatMonthsOpen(months: number): string {
  if (months < 1) return 'menos de 1 mês';
  if (months < 12) return `${months} ${months === 1 ? 'mês' : 'meses'}`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? 'ano' : 'anos'}`;
}

/** Businesses with a known, recent CNPJ opening date, newest first. */
export function getNewCompanies(businesses: Business[], maxMonths = NEW_COMPANY_MONTHS): Business[] {
  const now = new Date();
  return businesses
    .map((business) => ({ business, months: getMonthsOpen(business, now) }))
    .filter((item): item is { business: Business; months: number } =>
      item.months !== null && item.months <= maxMonths
    )
    .sort((a, b) => a.months - b.months || a.business.name.localeCompare(b.business.name))
    .map((item) => item.business);
}
