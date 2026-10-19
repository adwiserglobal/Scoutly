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
  /** PNG/JPEG data URL, or null when no logo was uploaded. */
  logo: string | null;
}

export const DEFAULT_ACCENT = '#FF5A12';
export const DEFAULT_COVER = '#0F1115';

export const EMPTY_OUTREACH: OutreachProfile = {
  objective: 'services',
  senderName: '',
  companyName: '',
  offer: '',
  audience: '',
  differentials: '',
  tone: 'consultivo',
  cta: '',
  avoid: '',
};

export const EMPTY_BRAND: BrandProfile = {
  name: '',
  tagline: '',
  accentColor: DEFAULT_ACCENT,
  coverColor: DEFAULT_COVER,
  contactEmail: '',
  contactPhone: '',
  contactWebsite: '',
  logoWidth: 0,
  logoHeight: 0,
};

export const OUTREACH_LIMITS = {
  senderName: 80,
  companyName: 80,
  offer: 1200,
  audience: 400,
  differentials: 600,
  cta: 200,
  avoid: 400,
} as const;

export const COLOR_PRESETS: Array<{ label: string; accent: string; cover: string }> = [
  { label: 'Scoutly', accent: '#FF5A12', cover: '#0F1115' },
  { label: 'Oceano', accent: '#1E6FFF', cover: '#0B1626' },
  { label: 'Floresta', accent: '#14A06B', cover: '#0C1A15' },
  { label: 'Vinho', accent: '#C2255C', cover: '#1B0E14' },
  { label: 'Grafite', accent: '#7C5CFF', cover: '#16161C' },
  { label: 'Dourado', accent: '#C98A0B', cover: '#17140C' },
];

export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value.trim());
}

function channel(value: number) {
  const v = value / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance of a #RRGGBB color (0 = black, 1 = white). */
export function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Contrast ratio of a color against white (1 to 21). */
export function contrastWithWhite(hex: string): number {
  return 1.05 / (luminance(hex) + 0.05);
}

/** The cover carries white text, so it needs a dark background. */
export function isCoverReadable(hex: string): boolean {
  return isHexColor(hex) && contrastWithWhite(hex) >= 7;
}

/** The accent is used as text and as a fill behind white labels on white pages. */
export function isAccentReadable(hex: string): boolean {
  return isHexColor(hex) && contrastWithWhite(hex) >= 3;
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

const MAX_LOGO_BYTES = 280_000;
const LOGO_MAX_SIDE = 600;

/**
 * Reads an image file and returns a PNG data URL scaled down to a small, safe size.
 * Transparency is preserved. Rejects files that cannot be decoded or remain too large.
 */
export async function prepareLogo(file: File): Promise<{ dataUrl: string; width: number; height: number }> {
  if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) {
    throw new Error('Envie uma imagem PNG, JPG, WebP ou SVG.');
  }
  if (file.size > 8_000_000) throw new Error('A imagem é muito grande. Use um arquivo de até 8 MB.');

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Não foi possível ler esta imagem.'));
      img.src = objectUrl;
    });

    const naturalW = image.naturalWidth || 512;
    const naturalH = image.naturalHeight || 512;

    for (const maxSide of [LOGO_MAX_SIDE, 420, 300, 200]) {
      const scale = Math.min(1, maxSide / Math.max(naturalW, naturalH));
      // SVGs without intrinsic size are scaled up so they stay sharp in print
      const factor = file.type === 'image/svg+xml' && scale === 1 ? maxSide / Math.max(naturalW, naturalH) : scale;
      const width = Math.max(1, Math.round(naturalW * factor));
      const height = Math.max(1, Math.round(naturalH * factor));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Seu navegador não conseguiu processar a imagem.');
      ctx.drawImage(image, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/png');
      if (dataUrl.length <= MAX_LOGO_BYTES * 1.33) return { dataUrl, width, height };
    }
    throw new Error('A logo ficou muito pesada. Tente uma versão mais simples ou menor.');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
