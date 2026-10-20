import {
  CORE_SECTIONS, EXTRA_TYPES, FONT_NAMES, ICON_IDS, LAYOUT_IDS, STYLE_IDS,
  type DemoDesign, type DemoImage, type DemoSiteData, type ExtraProps, type FontName, type IconId,
  type LayoutId, type SectionRef, type StyleId,
} from '../../shared/demoSite/types.js';

/**
 * Everything the editor sends is untrusted. This rebuilds a clean DemoSiteData from it:
 * bounded strings, allow-listed enums/fonts/icons, validated colors and data-URL images.
 * Facts that the owner must not forge (Google rating, brand profile, stock-photo credits)
 * always come from the previous version.
 */

const MAX_TOTAL_BYTES = 2_400_000;
const MAX_LOGO_CHARS = 260_000;
const MAX_IMAGE_CHARS = 450_000;
const DATA_IMAGE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;

const text = (value: unknown, max: number) =>
  String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/[ \t]+/g, ' ').trim().slice(0, max);
const oneLine = (value: unknown, max: number) => text(value, max).replace(/\s*\n\s*/g, ' ');
const hex = (value: unknown) => (typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : undefined);
const int = (value: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
};

function cleanImage(input: any, pool: DemoImage[]): DemoImage | null {
  if (!input || typeof input !== 'object') return null;
  const src = String(input.src || '');
  const known = pool.find((image) => image.src === src);
  if (known) return known;
  if (src.length <= MAX_IMAGE_CHARS && DATA_IMAGE.test(src)) {
    return { src, width: int(input.width, 1, 6000, 1200), height: int(input.height, 1, 6000, 800), alt: oneLine(input.alt, 140), credit: '' };
  }
  return null;
}

export function cleanLogo(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const logo = String(value);
  if (logo.length > MAX_LOGO_CHARS) {
    throw Object.assign(new Error('A logo é muito grande. Use uma imagem menor.'), { statusCode: 413, code: 'DEMO_INVALID' });
  }
  if (!DATA_IMAGE.test(logo)) {
    throw Object.assign(new Error('Formato de logo inválido. Envie PNG, JPG ou WebP.'), { statusCode: 400, code: 'DEMO_INVALID' });
  }
  return logo;
}

function cleanProps(input: any): ExtraProps {
  const source = input && typeof input === 'object' ? input : {};
  const items = (Array.isArray(source.items) ? source.items : []).slice(0, 8).map((item: any) => ({
    a: oneLine(item?.a, 120), b: oneLine(item?.b, 120), c: oneLine(item?.c, 240), d: text(item?.d, 500),
  }));
  return { title: oneLine(source.title, 90), body: text(source.body, 1200), button: oneLine(source.button, 30), items };
}

function cleanSections(input: unknown, fallback: SectionRef[] | undefined): SectionRef[] | undefined {
  if (!Array.isArray(input)) return fallback;
  const seen = new Set<string>();
  const result: SectionRef[] = [];
  for (const raw of input.slice(0, 30)) {
    const id = String(raw?.id || '');
    if (seen.has(id)) continue;
    if ((CORE_SECTIONS as readonly string[]).includes(id)) {
      seen.add(id);
      result.push({ id, type: 'core', hidden: Boolean(raw?.hidden) });
    } else if (/^x-[a-z0-9]{3,14}$/.test(id) && (EXTRA_TYPES as readonly string[]).includes(raw?.type)) {
      seen.add(id);
      result.push({ id, type: raw.type, hidden: Boolean(raw?.hidden), props: cleanProps(raw?.props) });
    }
  }
  for (const id of CORE_SECTIONS) if (!seen.has(id)) result.push({ id, type: 'core' });
  return result;
}

function cleanDesign(input: any): DemoDesign | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const design: DemoDesign = {};
  const accent = hex(input.accent); if (accent) design.accent = accent;
  const bg = hex(input.bg); if (bg) design.bg = bg;
  const ink = hex(input.ink); if (ink) design.ink = ink;
  if ((FONT_NAMES as string[]).includes(input.fontHeading)) design.fontHeading = input.fontHeading as FontName;
  if ((FONT_NAMES as string[]).includes(input.fontBody)) design.fontBody = input.fontBody as FontName;
  if (input.radius === 'sharp' || input.radius === 'soft' || input.radius === 'round') design.radius = input.radius;
  return Object.keys(design).length ? design : undefined;
}

export function sanitizeDemoData(input: any, prev: DemoSiteData): DemoSiteData {
  const src = input && typeof input === 'object' ? input : {};
  const biz = src.business && typeof src.business === 'object' ? src.business : {};
  const copy = src.copy && typeof src.copy === 'object' ? src.copy : {};
  const icon = (value: unknown): IconId => ((ICON_IDS as readonly string[]).includes(String(value)) ? value as IconId : 'check');
  const list = <T>(value: unknown, max: number, map: (item: any) => T): T[] =>
    (Array.isArray(value) ? value : []).slice(0, max).map(map);

  const phoneDigits = String(biz.phoneDigits ?? '').replace(/\D/g, '');
  const style = (STYLE_IDS as readonly string[]).includes(copy.style) ? copy.style as StyleId : prev.copy.style;
  const layout = (LAYOUT_IDS as readonly string[]).includes(copy.layout) ? copy.layout as LayoutId : prev.copy.layout;

  const pool: DemoImage[] = [prev.images.hero, prev.images.about, ...prev.images.gallery].filter((image): image is DemoImage => Boolean(image));
  const imagesIn = src.images && typeof src.images === 'object' ? src.images : {};

  const result: DemoSiteData = {
    logo: 'logo' in src ? cleanLogo(src.logo) : (prev.logo ?? null),
    design: 'design' in src ? cleanDesign(src.design) : prev.design,
    sections: cleanSections(src.sections, prev.sections),
    business: {
      ...prev.business,
      name: oneLine(biz.name, 90) || prev.business.name,
      category: oneLine(biz.category, 80) || prev.business.category,
      address: oneLine(biz.address, 180),
      neighborhood: oneLine(biz.neighborhood, 60),
      city: oneLine(biz.city, 60),
      phoneDigits: phoneDigits.length >= 10 && phoneDigits.length <= 13 ? phoneDigits : '',
      hours: oneLine(biz.hours, 240),
      // rating, reviewCount and mapsUrl are facts from Google: not editable
    },
    copy: {
      ...prev.copy,
      style,
      layout,
      variant: Number(copy.variant) === 1 ? 1 : 0,
      eyebrow: oneLine(copy.eyebrow, 60),
      headline: oneLine(copy.headline, 120) || prev.copy.headline,
      subheadline: oneLine(copy.subheadline, 300),
      primaryCta: oneLine(copy.primaryCta, 32) || prev.copy.primaryCta,
      secondaryCta: oneLine(copy.secondaryCta, 32) || prev.copy.secondaryCta,
      aboutTitle: oneLine(copy.aboutTitle, 90),
      aboutParagraphs: list(copy.aboutParagraphs, 4, (p) => text(p, 700)).filter(Boolean),
      services: list(copy.services, 8, (item) => ({ title: oneLine(item?.title, 60), text: oneLine(item?.text, 260), icon: icon(item?.icon) })).filter((item) => item.title),
      highlights: list(copy.highlights, 4, (item) => ({ title: oneLine(item?.title, 70), text: oneLine(item?.text, 260) })).filter((item) => item.title),
      process: list(copy.process, 5, (item) => ({ title: oneLine(item?.title, 70), text: oneLine(item?.text, 260) })).filter((item) => item.title),
      faq: list(copy.faq, 8, (item) => ({ q: oneLine(item?.q, 140), a: text(item?.a, 500) })).filter((item) => item.q),
      ctaTitle: oneLine(copy.ctaTitle, 90),
      ctaText: oneLine(copy.ctaText, 240),
    },
    images: {
      hero: cleanImage(imagesIn.hero, pool),
      about: cleanImage(imagesIn.about, pool),
      gallery: list(imagesIn.gallery, 6, (image) => cleanImage(image, pool)).filter((image): image is DemoImage => Boolean(image)),
      note: prev.images.note,
    },
    brand: prev.brand,
    generatedAt: prev.generatedAt,
  };

  if (JSON.stringify(result).length > MAX_TOTAL_BYTES) {
    throw Object.assign(new Error('O site ficou grande demais. Reduza o tamanho das imagens enviadas.'), { statusCode: 413, code: 'DEMO_INVALID' });
  }
  return result;
}
