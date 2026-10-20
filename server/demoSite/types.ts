export const STYLE_IDS = ['clean', 'warm', 'bold', 'elegant', 'fresh', 'noir'] as const;
export type StyleId = (typeof STYLE_IDS)[number];

export const LAYOUT_IDS = ['classic', 'editorial', 'immersive', 'centered', 'magazine', 'bento'] as const;
export type LayoutId = (typeof LAYOUT_IDS)[number];

export const ICON_IDS = [
  'check', 'star', 'heart', 'tool', 'scissors', 'tooth', 'cutlery', 'car', 'home', 'shield', 'clock',
  'phone', 'pin', 'sparkle', 'leaf', 'dumbbell', 'book', 'camera', 'key', 'bag',
] as const;
export type IconId = (typeof ICON_IDS)[number];

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
  business: DemoBusinessFacts;
  copy: DemoCopy;
  images: DemoImages;
  brand: DemoBrand;
  generatedAt: string;
}
