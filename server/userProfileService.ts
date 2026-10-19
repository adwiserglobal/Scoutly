import { appDataRequest, dbValue } from './appDataService.js';

export type OutreachObjective = 'services' | 'job' | 'partnership' | 'other';
export type OutreachTone = 'consultivo' | 'direto' | 'amigavel' | 'formal';

export interface OutreachProfile {
  objective: OutreachObjective;
  senderName: string;
  companyName: string;
  offer: string;
  audience: string;
  differentials: string;
  tone: OutreachTone;
  cta: string;
  avoid: string;
}

export interface BrandProfile {
  name: string;
  tagline: string;
  accentColor: string;
  coverColor: string;
  contactEmail: string;
  contactPhone: string;
  contactWebsite: string;
  logoWidth: number;
  logoHeight: number;
}

export interface UserProfile {
  outreach: OutreachProfile;
  brand: BrandProfile;
  logo: string | null;
}

export const DEFAULT_ACCENT = '#FF5A12';
export const DEFAULT_COVER = '#0F1115';

const OBJECTIVES: OutreachObjective[] = ['services', 'job', 'partnership', 'other'];
const TONES: OutreachTone[] = ['consultivo', 'direto', 'amigavel', 'formal'];
const MAX_LOGO_CHARS = 380_000; // ~280 KB of binary data once base64-decoded

function clean(value: unknown, max: number): string {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim()
    .slice(0, max);
}

function hex(value: unknown, fallback: string): string {
  const v = String(value ?? '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v.toUpperCase() : fallback;
}

export function sanitizeOutreach(input: any): OutreachProfile {
  const source = input && typeof input === 'object' ? input : {};
  return {
    objective: OBJECTIVES.includes(source.objective) ? source.objective : 'services',
    senderName: clean(source.senderName, 80),
    companyName: clean(source.companyName, 80),
    offer: clean(source.offer, 1200),
    audience: clean(source.audience, 400),
    differentials: clean(source.differentials, 600),
    tone: TONES.includes(source.tone) ? source.tone : 'consultivo',
    cta: clean(source.cta, 200),
    avoid: clean(source.avoid, 400),
  };
}

export function sanitizeBrand(input: any): BrandProfile {
  const source = input && typeof input === 'object' ? input : {};
  const dim = (value: unknown) => {
    const n = Math.round(Number(value));
    return Number.isFinite(n) && n > 0 && n <= 4000 ? n : 0;
  };
  return {
    name: clean(source.name, 60),
    tagline: clean(source.tagline, 80),
    accentColor: hex(source.accentColor, DEFAULT_ACCENT),
    coverColor: hex(source.coverColor, DEFAULT_COVER),
    contactEmail: clean(source.contactEmail, 80),
    contactPhone: clean(source.contactPhone, 40),
    contactWebsite: clean(source.contactWebsite, 80),
    logoWidth: dim(source.logoWidth),
    logoHeight: dim(source.logoHeight),
  };
}

/** Returns a safe PNG/JPEG data URL, null to clear, or throws on invalid input. */
export function sanitizeLogo(value: unknown): string | null {
  if (value === null || value === '') return null;
  const logo = String(value);
  if (logo.length > MAX_LOGO_CHARS) {
    throw Object.assign(new Error('A logo é muito grande. Use uma imagem menor.'), { statusCode: 413 });
  }
  if (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(logo)) {
    throw Object.assign(new Error('Formato de logo inválido. Envie PNG ou JPG.'), { statusCode: 400 });
  }
  return logo;
}

function profileError(error: any) {
  // PostgREST answers 400/42703 (unknown column) or PGRST204 (stale schema cache) when the
  // migration has not been applied to this database yet.
  const message = String(error?.message || '');
  if (/outreach_profile|brand_profile|brand_logo|42703|PGRST204/i.test(message)) {
    return Object.assign(
      new Error('O perfil comercial ainda não foi ativado neste ambiente: falta aplicar a migration 013 no banco do app (ou recarregar o schema do Supabase).'),
      { statusCode: 503, code: 'PROFILE_MIGRATION_PENDING' }
    );
  }
  return error;
}

export async function getUserProfile(userUid: string, includeLogo = true): Promise<UserProfile> {
  try {
    const columns = `outreach_profile,brand_profile${includeLogo ? ',brand_logo' : ''}`;
    const rows = await appDataRequest<any[]>(
      `user_settings?user_uid=eq.${dbValue(userUid)}&select=${columns}&limit=1`
    );
    const row = rows[0] || {};
    return {
      outreach: sanitizeOutreach(row.outreach_profile),
      brand: sanitizeBrand(row.brand_profile),
      logo: includeLogo && typeof row.brand_logo === 'string' ? row.brand_logo : null,
    };
  } catch (error) {
    throw profileError(error);
  }
}

/** Never throws: callers such as message generation must work without a profile. */
export async function getOutreachProfileSafe(userUid: string): Promise<OutreachProfile | null> {
  try {
    const rows = await appDataRequest<any[]>(
      `user_settings?user_uid=eq.${dbValue(userUid)}&select=outreach_profile&limit=1`
    );
    const raw = rows[0]?.outreach_profile;
    if (!raw || typeof raw !== 'object' || Object.keys(raw).length === 0) return null;
    return sanitizeOutreach(raw);
  } catch (error: any) {
    console.warn('[Scoutly Profile] outreach profile unavailable:', error?.message || error);
    return null;
  }
}

export async function saveUserProfileData(
  userUid: string,
  input: { outreach?: unknown; brand?: unknown; logo?: unknown; hasLogo: boolean }
) {
  const body: Record<string, unknown> = { user_uid: userUid };
  if (input.outreach !== undefined) body.outreach_profile = sanitizeOutreach(input.outreach);
  if (input.brand !== undefined) body.brand_profile = sanitizeBrand(input.brand);
  if (input.hasLogo) body.brand_logo = sanitizeLogo(input.logo);

  try {
    await appDataRequest('user_settings?on_conflict=user_uid', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw profileError(error);
  }
}

const OBJECTIVE_BRIEFING: Record<OutreachObjective, string> = {
  services:
    'Objetivo: oferecer os serviços do remetente a uma empresa. Mostre que houve uma análise real e conecte a oferta a uma oportunidade concreta observada.',
  job:
    'Objetivo: o remetente busca uma oportunidade de trabalho nesta empresa. Não venda serviços nem prometa análises; apresente-se com respeito, destaque o que sabe fazer e peça uma conversa ou a indicação da pessoa certa.',
  partnership:
    'Objetivo: propor uma parceria. Seja claro sobre o benefício mútuo e proponha um próximo passo simples.',
  other: 'Objetivo: iniciar uma conversa comercial de forma respeitosa, seguindo o contexto informado pelo remetente.',
};

const TONE_BRIEFING: Record<OutreachTone, string> = {
  consultivo: 'consultivo, humano e profissional',
  direto: 'direto, objetivo e curto',
  amigavel: 'amigável, leve e próximo, sem perder o respeito',
  formal: 'formal e corporativo',
};

/** Prompt block describing who is writing and what they offer; empty string when there is no profile. */
export function outreachPromptBlock(profile: OutreachProfile | null): string {
  if (!profile) return '';
  const hasContent = Boolean(profile.offer || profile.senderName || profile.companyName || profile.cta);
  if (!hasContent) return '';

  const lines: string[] = ['SOBRE QUEM ESTÁ ESCREVENDO (use estas informações; não invente nada além delas):'];
  if (profile.senderName) lines.push(`- Nome do remetente: ${profile.senderName}`);
  if (profile.companyName) lines.push(`- Empresa / marca: ${profile.companyName}`);
  if (profile.offer) lines.push(`- O que faz / oferece: ${profile.offer}`);
  if (profile.audience) lines.push(`- Cliente ideal: ${profile.audience}`);
  if (profile.differentials) lines.push(`- Diferenciais e provas: ${profile.differentials}`);
  if (profile.cta) lines.push(`- Ação desejada ao final: ${profile.cta}`);
  if (profile.avoid) lines.push(`- Evitar: ${profile.avoid}`);
  lines.push(`- Tom de voz: ${TONE_BRIEFING[profile.tone]}`);
  lines.push(OBJECTIVE_BRIEFING[profile.objective]);
  lines.push(
    'Apresente o remetente e sua oferta de forma natural, usando apenas os serviços descritos acima. Assine com o nome do remetente quando for e-mail.'
  );
  return lines.join('\n');
}
