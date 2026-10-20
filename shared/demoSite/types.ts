export const STYLE_IDS = ['clean', 'warm', 'bold', 'elegant', 'fresh', 'noir'] as const;
export type StyleId = (typeof STYLE_IDS)[number];

export const LAYOUT_IDS = ['classic', 'editorial', 'immersive', 'centered', 'magazine', 'bento'] as const;
export type LayoutId = (typeof LAYOUT_IDS)[number];

export const ICON_IDS = [
  'check', 'star', 'heart', 'tool', 'scissors', 'tooth', 'cutlery', 'car', 'home', 'shield', 'clock',
  'phone', 'pin', 'sparkle', 'leaf', 'dumbbell', 'book', 'camera', 'key', 'bag',
] as const;
export type IconId = (typeof ICON_IDS)[number];

/** Fonts offered in the editor (all from Google Fonts). Value = css2 family query. */
export const FONT_OPTIONS = {
  'Plus Jakarta Sans': { query: 'Plus+Jakarta+Sans:wght@400;500;600;700;800', kind: 'sans' },
  Inter: { query: 'Inter:wght@400;500;600;700', kind: 'sans' },
  Manrope: { query: 'Manrope:wght@400;500;600;700;800', kind: 'sans' },
  Poppins: { query: 'Poppins:wght@400;500;600;700', kind: 'sans' },
  Montserrat: { query: 'Montserrat:wght@400;500;600;700;800', kind: 'sans' },
  Outfit: { query: 'Outfit:wght@400;500;600;700;800', kind: 'sans' },
  Sora: { query: 'Sora:wght@400;500;600;700', kind: 'sans' },
  'Space Grotesk': { query: 'Space+Grotesk:wght@400;500;600;700', kind: 'sans' },
  'Barlow Condensed': { query: 'Barlow+Condensed:wght@600;700;800', kind: 'sans' },
  Jost: { query: 'Jost:wght@400;500;600', kind: 'sans' },
  Fraunces: { query: 'Fraunces:opsz,wght@9..144,500;9..144,700', kind: 'serif' },
  'Playfair Display': { query: 'Playfair+Display:wght@500;600;700;800', kind: 'serif' },
  'Cormorant Garamond': { query: 'Cormorant+Garamond:wght@500;600;700', kind: 'serif' },
  Lora: { query: 'Lora:wght@500;600;700', kind: 'serif' },
  'DM Serif Display': { query: 'DM+Serif+Display', kind: 'serif' },
} as const;
export type FontName = keyof typeof FONT_OPTIONS;
export const FONT_NAMES = Object.keys(FONT_OPTIONS) as FontName[];

export type Radius = 'sharp' | 'soft' | 'round';

/** Owner-chosen look that overrides the preset style. Every field is optional. */
export interface DemoDesign {
  accent?: string;
  bg?: string;
  ink?: string;
  fontHeading?: FontName;
  fontBody?: FontName;
  radius?: Radius;
}

export const CORE_SECTIONS = ['servicos', 'sobre', 'galeria', 'como-funciona', 'perguntas', 'cta', 'contato'] as const;
export type CoreSectionId = (typeof CORE_SECTIONS)[number];
export const EXTRA_TYPES = ['text', 'stats', 'testimonials', 'pricing', 'banner'] as const;
export type ExtraType = (typeof EXTRA_TYPES)[number];

export interface ExtraProps {
  title?: string;
  body?: string; // text, banner
  button?: string; // banner
  items?: Array<{ a?: string; b?: string; c?: string; d?: string }>; // stats: value/label, testimonials: text/author, pricing: name/price/description/features
}

/** One block of the page below the hero, in display order. */
export interface SectionRef {
  id: string; // a CoreSectionId or "x-<random>" for extra blocks
  type: 'core' | ExtraType;
  hidden?: boolean;
  props?: ExtraProps;
}

export interface DemoCopy {
  style: StyleId;
  layout?: LayoutId;
  variant: 0 | 1;
  eyebrow: string;
  headline: string;
  subheadline: string;
  primaryCta: string;
  secondaryCta: string;
  aboutTitle: string;
  aboutParagraphs: string[];
  services: Array<{ title: string; text: string; icon: IconId }>;
  highlights: Array<{ title: string; text: string }>;
  process: Array<{ title: string; text: string }>;
  faq: Array<{ q: string; a: string }>;
  ctaTitle: string;
  ctaText: string;
  imageQueries: { hero: string; about: string; gallery: string[] };
}

export interface DemoImage {
  src: string; // base url, sized with width params at render time
  width: number;
  height: number;
  alt: string;
  credit: string;
  creditUrl?: string;
  downloadLocation?: string;
}

export interface DemoImages {
  hero: DemoImage | null;
  about: DemoImage | null;
  gallery: DemoImage[];
  /** Optional full-bleed background for the top of the page (any layout). */
  heroBg?: DemoImage | null;
  /** Why there are no photos (shown to the owner of the site, never on the public page). */
  note?: string;
}

export interface DemoBusinessFacts {
  name: string;
  category: string;
  address: string;
  neighborhood: string;
  city: string;
  phoneDigits: string; // empty when locked/unknown
  rating: number | null;
  reviewCount: number | null;
  hours: string; // raw opening hours, may be empty
  mapsUrl: string;
}

export interface DemoBrand {
  name: string;
  contactPhone: string;
  contactEmail: string;
  contactWebsite: string;
}

export interface DemoSiteData {
  /** Client logo as a small data URL (PNG/JPEG/WebP). */
  logo?: string | null;
  design?: DemoDesign;
  /** Display order of the sections below the hero. Missing = default order of the layout. */
  sections?: SectionRef[];
  business: DemoBusinessFacts;
  copy: DemoCopy;
  images: DemoImages;
  brand: DemoBrand;
  generatedAt: string;
}
