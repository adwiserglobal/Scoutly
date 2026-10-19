import type { Business, PageSpeedData } from '../types';
import { hexToRgb, isHexColor } from '../lib/userProfile';

/** Subset of the tracking audit (static public HTML scan) used by the report. */
export interface DiagnosticTracking {
  status?: string;
  ga4?: { detected?: boolean };
  gtm?: { detected?: boolean };
  metaPixel?: { detected?: boolean };
  googleAds?: { detected?: boolean };
}

export interface DiagnosticPdfOptions {
  business: Business;
  /** Website URL resolved by the app (dataset or discovered on the web). */
  websiteUrl?: string | null;
  /** PageSpeed result for the website, when available. */
  pageSpeed?: PageSpeedData | null;
  tracking?: DiagnosticTracking | null;
  /**
   * Contact availability only. The report is sent to the business itself and must
   * never carry phone/e-mail values, so locked (credit-gated) contacts cannot leak.
   */
  contact: { hasPhone: boolean; hasWhatsApp: boolean; hasEmail: boolean };
  /** Name shown as the author of the report (agency / consultant). */
  preparedBy?: string | null;
  /** White-label settings saved by the user (colors, logo, name, contact lines). */
  brand?: DiagnosticBrand | null;
}

export interface DiagnosticBrand {
  name?: string;
  tagline?: string;
  accentColor?: string;
  coverColor?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactWebsite?: string;
  /** PNG/JPEG data URL. */
  logo?: string | null;
  logoWidth?: number;
  logoHeight?: number;
}

type RGB = [number, number, number];

const INK: RGB = [15, 17, 21];
const TEXT: RGB = [34, 38, 45];
const MUTED: RGB = [105, 112, 124];
const LINE: RGB = [227, 222, 213];
const SOFT: RGB = [247, 244, 239];
const WHITE: RGB = [255, 255, 255];
const ACCENT_DEFAULT: RGB = [255, 90, 18];
const COVER_DEFAULT: RGB = [15, 17, 21];
const GOOD: RGB = [28, 150, 100];
const MID: RGB = [222, 154, 8];
const BAD: RGB = [208, 66, 58];
const GREY: RGB = [150, 156, 166];

const PAGE_W = 210;
const PAGE_H = 297;
const M = 18;
const W = PAGE_W - M * 2;

// ---------------------------------------------------------------------------
// Report model (pure: no drawing)
// ---------------------------------------------------------------------------

type Level = 'strong' | 'mid' | 'weak' | 'unknown';

interface Pillar {
  key: 'found' | 'speed' | 'contact' | 'trust';
  title: string;
  score: number | null;
  level: Level;
  headline: string;
}

interface JourneyNode {
  title: string;
  caption: string;
  level: Level;
}

interface Action {
  title: string;
  why: string;
  what: string;
  impact: 'Alto' | 'Médio';
  effort: 'Baixo' | 'Médio';
}

interface Speed {
  score: number;
  lcpSec: number | null;
  lcpLabel: string;
  cls: number | null;
  tbtMs: number | null;
  fetchedAt: Date;
}

interface Report {
  name: string;
  category: string;
  place: string;
  domain: string | null;
  hasWebsite: boolean;
  isHttps: boolean | null;
  speed: Speed | null;
  speedState: 'none' | 'unmeasured' | 'measured';
  rating: number | null;
  reviewCount: number | null;
  socials: string[];
  contact: DiagnosticPdfOptions['contact'];
  trackers: string[] | null;
  openSince: number | null;
  pillars: Pillar[];
  index: number;
  indexLevel: Level;
  verdict: string;
  journey: JourneyNode[];
  actions: Action[];
  strength: { title: string; body: string };
  opportunity: { title: string; body: string };
}

function levelOf(score: number | null): Level {
  if (score === null) return 'unknown';
  return score >= 75 ? 'strong' : score >= 45 ? 'mid' : 'weak';
}

function levelColor(level: Level): RGB {
  return level === 'strong' ? GOOD : level === 'mid' ? MID : level === 'weak' ? BAD : GREY;
}

function levelWord(level: Level): string {
  return level === 'strong' ? 'Forte' : level === 'mid' ? 'Em evolução' : level === 'weak' ? 'A construir' : 'Não medido';
}

function hostOf(url: string): string {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function socialName(url: string): string {
  const host = hostOf(url).toLowerCase();
  if (host.includes('instagram')) return 'Instagram';
  if (host.includes('facebook') || host.includes('fb.com')) return 'Facebook';
  if (host.includes('tiktok')) return 'TikTok';
  if (host.includes('youtube') || host.includes('youtu.be')) return 'YouTube';
  if (host.includes('linkedin')) return 'LinkedIn';
  if (host.includes('wa.me') || host.includes('whatsapp')) return 'WhatsApp';
  return host;
}

function parseNumber(value?: string | null): number | null {
  if (!value) return null;
  const match = String(value).replace(',', '.').match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function parseSeconds(value?: string | null): number | null {
  if (!value) return null;
  const n = parseNumber(value);
  if (n === null) return null;
  return /ms/i.test(value) ? n / 1000 : n;
}

function formatSeconds(seconds: number): string {
  return `${seconds.toFixed(1).replace('.', ',')} s`;
}

function placeOf(business: Business): string {
  if (business.municipio) return business.uf ? `${business.municipio} - ${business.uf}` : business.municipio;
  const parts = String(business.address || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const cityPart = [...parts].reverse().find((part) => /[A-Za-zÀ-ú]{3,}/.test(part) && !/^\d/.test(part) && !/^[A-Z]{2}$/.test(part));
  return cityPart || '';
}

function buildReport(opts: DiagnosticPdfOptions): Report {
  const { business, pageSpeed, tracking, contact } = opts;
  const website = opts.websiteUrl || business.website || null;
  const googleSpeed = pageSpeed && pageSpeed.source === 'google_pagespeed_api' ? pageSpeed : null;
  const socials = Array.from(new Set((business.socials || []).map(socialName)));
  const rating = typeof business.rating === 'number' ? business.rating : null;
  const reviewCount = typeof business.reviewCount === 'number' ? business.reviewCount : null;
  const hasPhone = contact.hasPhone || contact.hasWhatsApp;

  const trackingVerified = Boolean(tracking && tracking.status === 'verified');
  const trackers = trackingVerified
    ? ([
        tracking?.ga4?.detected && 'Google Analytics',
        tracking?.gtm?.detected && 'Google Tag Manager',
        tracking?.metaPixel?.detected && 'Meta Pixel',
        tracking?.googleAds?.detected && 'Google Ads',
      ].filter(Boolean) as string[])
    : null;

  const speed: Speed | null = googleSpeed
    ? {
        score: googleSpeed.score,
        lcpSec: parseSeconds(googleSpeed.lcp),
        lcpLabel: googleSpeed.lcp || '-',
        cls: parseNumber(googleSpeed.cls),
        tbtMs: parseNumber(googleSpeed.tbt),
        fetchedAt: googleSpeed.fetchedAt ? new Date(googleSpeed.fetchedAt) : new Date(),
      }
    : null;
  const speedState: Report['speedState'] = !website ? 'none' : speed ? 'measured' : 'unmeasured';

  const openSince = (() => {
    if (!business.dataInicioAtividade) return null;
    const year = new Date(business.dataInicioAtividade).getFullYear();
    return Number.isFinite(year) ? year : null;
  })();

  // --- pillar scores (share of the points that could be verified) ---
  const share = (parts: Array<{ earned: number; max: number }>) => {
    const max = parts.reduce((sum, p) => sum + p.max, 0);
    return max === 0 ? null : Math.round((parts.reduce((sum, p) => sum + p.earned, 0) / max) * 100);
  };

  const foundParts = [{ earned: website ? 60 : 0, max: 60 }];
  if (rating !== null) foundParts.push({ earned: 40 * Math.min(1, rating / 5), max: 40 });
  const foundScore = share(foundParts);

  const speedScore = speedState === 'none' ? 0 : speed ? speed.score : null;

  const contactScore = share([
    { earned: hasPhone ? 60 : 0, max: 60 },
    { earned: contact.hasEmail ? 20 : 0, max: 20 },
    { earned: contact.hasWhatsApp ? 20 : 0, max: 20 },
  ]);

  const trustParts = [{ earned: socials.length >= 2 ? 50 : socials.length === 1 ? 30 : 0, max: 50 }];
  if (rating !== null) trustParts.push({ earned: 50 * Math.min(1, rating / 5), max: 50 });
  const trustScore = share(trustParts);

  const pillars: Pillar[] = [
    {
      key: 'found',
      title: 'Ser encontrado',
      score: foundScore,
      level: levelOf(foundScore),
      headline: website
        ? rating !== null
          ? `Site no ar e ficha no Google com nota ${rating.toFixed(1).replace('.', ',')}.`
          : 'A empresa tem site próprio para quem pesquisa.'
        : 'Sem site próprio: quem pesquisa não encontra um endereço oficial.',
    },
    {
      key: 'speed',
      title: 'Velocidade do site',
      score: speedScore,
      level: levelOf(speedScore),
      headline:
        speedState === 'none'
          ? 'Sem site, não há página para carregar no celular.'
          : speed
          ? speed.score >= 90
            ? `Nota ${speed.score}/100 no Google: o site abre rápido no celular.`
            : speed.score >= 50
            ? `Nota ${speed.score}/100 no Google: velocidade razoável, com ganhos possíveis.`
            : `Nota ${speed.score}/100 no Google: o site é lento no celular.`
          : 'Medição do Google indisponível no momento da emissão.',
    },
    {
      key: 'contact',
      title: 'Facilidade de contato',
      score: contactScore,
      level: levelOf(contactScore),
      headline: contact.hasWhatsApp
        ? 'WhatsApp identificado para atendimento rápido.'
        : hasPhone
        ? 'Telefone disponível, mas sem WhatsApp confirmado.'
        : 'Nenhum telefone ou WhatsApp público foi encontrado.',
    },
    {
      key: 'trust',
      title: 'Confiança e alcance',
      score: trustScore,
      level: levelOf(trustScore),
      headline:
        rating !== null
          ? `${reviewCount ? `${reviewCount} avaliações no Google` : 'Avaliações no Google'}${socials.length ? ` e presença em ${socials.length} ${socials.length === 1 ? 'rede' : 'redes'}` : ''}.`
          : socials.length
          ? `Presente em ${socials.join(' e ')}.`
          : 'Nenhuma rede social identificada.',
    },
  ];

  const weights: Record<Pillar['key'], number> = { found: 30, speed: 25, contact: 25, trust: 20 };
  const known = pillars.filter((p) => p.score !== null);
  const totalWeight = known.reduce((sum, p) => sum + weights[p.key], 0);
  const index = totalWeight
    ? Math.round(known.reduce((sum, p) => sum + (p.score as number) * weights[p.key], 0) / totalWeight)
    : 0;
  const indexLevel = levelOf(index);

  const verdict =
    indexLevel === 'strong'
      ? 'Uma presença digital sólida. O próximo passo é transformar essa base em mais pedidos e mais contatos.'
      : indexLevel === 'mid'
      ? 'Há uma boa base, mas alguns pontos ainda fazem clientes desistirem antes de entrar em contato.'
      : 'Há oportunidades claras para ser encontrado e escolhido por mais clientes da região.';

  // --- customer journey ---
  const journey: JourneyNode[] = [
    {
      title: 'Encontra a empresa',
      caption: rating !== null || website ? 'Aparece nas buscas e no mapa' : 'Pouca visibilidade online',
      level: rating !== null || website ? 'strong' : 'weak',
    },
    {
      title: 'Visita o site',
      caption: website ? 'Site próprio no ar' : 'Não há site para visitar',
      level: website ? 'strong' : 'weak',
    },
    {
      title: 'O site abre rápido',
      caption:
        speedState === 'none'
          ? 'Sem site para medir'
          : speed
          ? speed.score >= 90
            ? 'Carrega bem no celular'
            : speed.score >= 50
            ? 'Carregamento mediano'
            : 'Carrega devagar no celular'
          : 'Velocidade não medida',
      level: speedState === 'none' ? 'weak' : speed ? (speed.score >= 90 ? 'strong' : speed.score >= 50 ? 'mid' : 'weak') : 'unknown',
    },
    {
      title: 'Fala com a empresa',
      caption: contact.hasWhatsApp ? 'WhatsApp disponível' : hasPhone ? 'Telefone disponível' : 'Sem contato à vista',
      level: contact.hasWhatsApp ? 'strong' : hasPhone ? 'mid' : 'weak',
    },
  ];

  // --- action plan (rule based, highest impact first) ---
  const actions: Action[] = [];
  if (!website) {
    actions.push({
      title: 'Criar um site profissional',
      why: 'Hoje quem pesquisa o negócio não encontra um endereço próprio com produtos, serviços e contato.',
      what: 'Um site rápido e objetivo, com botão de WhatsApp, localização no mapa e prova social.',
      impact: 'Alto',
      effort: 'Médio',
    });
  } else if (speed && speed.score < 50) {
    actions.push({
      title: 'Acelerar o site no celular',
      why: `O Google dá ${speed.score}/100 ao site no celular${speed.lcpSec !== null ? `; o conteúdo principal leva ${formatSeconds(speed.lcpSec)} para aparecer` : ''}.`,
      what: 'Otimizar imagens, scripts e hospedagem para que a página abra em poucos segundos.',
      impact: 'Alto',
      effort: 'Médio',
    });
  } else if (speed && speed.score < 90) {
    actions.push({
      title: 'Ganhar velocidade no celular',
      why: `O site tem ${speed.score}/100 no Google; ainda há espaço para chegar à faixa considerada rápida.`,
      what: 'Ajustes técnicos de imagens e carregamento para reduzir o tempo de espera.',
      impact: 'Médio',
      effort: 'Baixo',
    });
  }
  if (!hasPhone || !contact.hasWhatsApp) {
    actions.push({
      title: hasPhone ? 'Colocar o WhatsApp à vista' : 'Tornar o contato imediato',
      why: hasPhone
        ? 'Há telefone, mas o WhatsApp não foi confirmado, e é o canal que a maioria dos clientes prefere.'
        : 'Sem telefone ou WhatsApp visíveis, o cliente interessado tende a escolher quem responde mais rápido.',
      what: 'Botão de WhatsApp no site, no Google e nas redes, com mensagem inicial já preenchida.',
      impact: 'Alto',
      effort: 'Baixo',
    });
  }
  if (website && trackers && trackers.length === 0) {
    actions.push({
      title: 'Medir de onde vêm os clientes',
      why: 'Não detectamos ferramentas de medição no código público da página inicial.',
      what: 'Instalar Google Analytics e metas de conversão para saber o que traz resultado.',
      impact: 'Médio',
      effort: 'Baixo',
    });
  }
  if (rating !== null && (rating < 4.5 || (reviewCount !== null && reviewCount < 50))) {
    actions.push({
      title: 'Reforçar a reputação no Google',
      why: `A ficha tem nota ${rating.toFixed(1).replace('.', ',')}${reviewCount !== null ? ` em ${reviewCount} avaliações` : ''}; mais avaliações positivas aumentam a confiança de quem compara opções.`,
      what: 'Rotina simples para pedir avaliações a clientes satisfeitos e responder a todas.',
      impact: 'Médio',
      effort: 'Baixo',
    });
  }
  if (socials.length === 0) {
    actions.push({
      title: 'Ativar a presença nas redes sociais',
      why: 'Não identificamos perfis da empresa em redes sociais.',
      what: 'Perfil comercial completo, com conteúdo regular e ligação direta com o WhatsApp.',
      impact: 'Médio',
      effort: 'Médio',
    });
  }
  if (website && /^http:\/\//i.test(website)) {
    actions.push({
      title: 'Proteger o site com HTTPS',
      why: 'O endereço cadastrado não usa conexão segura, e navegadores podem alertar os visitantes.',
      what: 'Instalar o certificado e redirecionar todo o tráfego para a versão segura.',
      impact: 'Médio',
      effort: 'Baixo',
    });
  }
  const generic: Action[] = [
    {
      title: 'Anunciar para quem procura perto',
      why: 'Quem busca o serviço na região já está pronto para contratar.',
      what: 'Campanhas locais no Google e nas redes, direcionadas ao raio de atendimento da empresa.',
      impact: 'Alto',
      effort: 'Médio',
    },
    {
      title: 'Fortalecer a busca local (SEO)',
      why: 'Aparecer entre os primeiros resultados da região reduz o custo de conquistar clientes.',
      what: 'Ficha do Google completa, palavras-chave locais e conteúdo que responde às dúvidas dos clientes.',
      impact: 'Médio',
      effort: 'Médio',
    },
    {
      title: 'Automatizar o primeiro atendimento',
      why: 'Respostas rápidas aumentam a chance de fechar negócio.',
      what: 'Mensagens automáticas e atalhos no WhatsApp Business para dúvidas frequentes.',
      impact: 'Médio',
      effort: 'Baixo',
    },
  ];
  for (const g of generic) if (actions.length < 3) actions.push(g);
  actions.sort((a, b) => (a.impact === b.impact ? 0 : a.impact === 'Alto' ? -1 : 1));

  const strongest = [...known].sort((a, b) => (b.score as number) - (a.score as number))[0];
  const weakest = [...known].sort((a, b) => (a.score as number) - (b.score as number))[0];
  const strength =
    strongest && (strongest.score as number) >= 45
      ? { title: strongest.title, body: strongest.headline }
      : { title: 'Ponto de partida', body: 'A empresa já existe no mapa e pode crescer a partir de uma base simples.' };
  const opportunity = weakest
    ? { title: weakest.title, body: weakest.headline }
    : { title: 'Estruturar a presença', body: 'Há espaço para organizar a presença digital da empresa.' };

  return {
    name: business.name,
    category: business.category || '',
    place: placeOf(business),
    domain: website ? hostOf(website) : null,
    hasWebsite: Boolean(website),
    isHttps: website ? (/^https:\/\//i.test(website) ? true : /^http:\/\//i.test(website) ? false : null) : null,
    speed,
    speedState,
    rating,
    reviewCount,
    socials,
    contact,
    trackers,
    openSince,
    pillars,
    index,
    indexLevel,
    verdict,
    journey,
    actions: actions.slice(0, 3),
    strength,
    opportunity,
  };
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

function slugify(value: string): string {
  return (
    value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'empresa'
  );
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function relLuminance([r, g, b]: RGB): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: RGB, b: RGB): number {
  const [hi, lo] = [relLuminance(a), relLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB;
}

/** Moves `color` toward `target` until it reaches the contrast ratio against `against`. */
function ensureContrast(color: RGB, against: RGB, target: RGB, min: number): RGB {
  let out = color;
  for (let step = 1; step <= 20 && contrast(out, against) < min; step++) out = mix(color, target, step / 20);
  return out;
}

function parseBrandColor(value: string | undefined, fallback: RGB): RGB {
  return value && isHexColor(value) ? (hexToRgb(value) as RGB) : fallback;
}

function logoFormat(dataUrl: string): 'PNG' | 'JPEG' | null {
  if (dataUrl.startsWith('data:image/png')) return 'PNG';
  if (dataUrl.startsWith('data:image/jpeg')) return 'JPEG';
  return null;
}

const INTER_FILES: Array<{ file: string; style: 'normal' | 'bold' | 'italic' }> = [
  { file: 'inter-regular.ttf', style: 'normal' },
  { file: 'inter-bold.ttf', style: 'bold' },
  { file: 'inter-italic.ttf', style: 'italic' },
];

let interFontsPromise: Promise<Array<{ file: string; style: 'normal' | 'bold' | 'italic'; base64: string }> | null> | null = null;

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/** Loads the subsetted Inter files once; returns null (built-in fonts are used) on any failure. */
function loadInterFonts() {
  interFontsPromise ??= (async () => {
    try {
      const loaded = await Promise.all(
        INTER_FILES.map(async ({ file, style }) => {
          const res = await fetch(`/fonts/${file}`);
          if (!res.ok) throw new Error(`font ${file}: ${res.status}`);
          const buffer = await res.arrayBuffer();
          const magic = new DataView(buffer).getUint32(0);
          // 0x00010000 = TrueType; anything else (e.g. an HTML fallback page) is rejected
          if (magic !== 0x00010000 && magic !== 0x74727565) throw new Error(`font ${file}: not a TrueType file`);
          return { file, style, base64: toBase64(buffer) };
        })
      );
      return loaded;
    } catch (error) {
      console.warn('[Diagnostic PDF] Inter font unavailable, using built-in fonts:', error);
      interFontsPromise = null;
      return null;
    }
  })();
  return interFontsPromise;
}

/**
 * Builds and downloads a client-ready, three-page commercial report about the
 * business's digital presence. Every figure comes from observed data; PageSpeed
 * numbers are only used when measured by the real Google PageSpeed Insights API.
 */
export async function downloadDiagnosticPdf(opts: DiagnosticPdfOptions): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const interFonts = await loadInterFonts();
  if (interFonts) {
    for (const { file, style, base64 } of interFonts) {
      doc.addFileToVFS(file, base64);
      doc.addFont(file, 'Inter', style);
    }
  }
  const r = buildReport(opts);
  const now = new Date();
  const brand = opts.brand || {};
  const preparedBy = brand.name?.trim() || opts.preparedBy?.trim() || '';
  const WHITE_RGB: RGB = [255, 255, 255];
  const BLACK_RGB: RGB = [0, 0, 0];
  // White cover text needs a dark cover; the accent sits on white pages as text/labels.
  const COVER = ensureContrast(parseBrandColor(brand.coverColor, COVER_DEFAULT), WHITE_RGB, BLACK_RGB, 7);
  const COVER_SOFT = mix(COVER, WHITE_RGB, 0.12);
  const ACCENT = ensureContrast(parseBrandColor(brand.accentColor, ACCENT_DEFAULT), WHITE_RGB, BLACK_RGB, 3);
  // Accent drawn on the dark cover must stay visible there
  const ACCENT_ON_COVER = ensureContrast(ACCENT, COVER, WHITE_RGB, 3);
  const logo =
    brand.logo && brand.logoWidth && brand.logoHeight && logoFormat(brand.logo)
      ? { data: brand.logo, format: logoFormat(brand.logo) as 'PNG' | 'JPEG', ratio: brand.logoWidth / brand.logoHeight }
      : null;
  const drawLogo = (x: number, y: number, maxW: number, maxH: number) => {
    if (!logo) return { w: 0, h: 0 };
    let h = maxH;
    let w = h * logo.ratio;
    if (w > maxW) {
      w = maxW;
      h = w / logo.ratio;
    }
    try {
      doc.addImage(logo.data, logo.format, x, y + (maxH - h) / 2, w, h, 'brand-logo', 'FAST');
    } catch (error) {
      console.warn('[Diagnostic PDF] Could not draw the logo:', error);
      return { w: 0, h: 0 };
    }
    return { w, h };
  };

  // ---- primitives ----
  const text = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const fill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const stroke = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);

  // Inter is used everywhere when available; otherwise the built-in families apply.
  const font = (family: 'helvetica' | 'times', style: 'normal' | 'bold' | 'italic', size: number, c: RGB) => {
    doc.setFont(interFonts ? 'Inter' : family, style);
    doc.setFontSize(size);
    text(c);
  };

  /** Baseline y that visually centers capitals/digits of `size` pt on `centerY` (mm). */
  const middleY = (centerY: number, size: number) => centerY + (size * 0.3528 * 0.72) / 2;

  const lines = (value: string, width: number, maxLines = 99): string[] => {
    const wrapped: string[] = doc.splitTextToSize(value, width);
    if (wrapped.length <= maxLines) return wrapped;
    const cut = wrapped.slice(0, maxLines);
    cut[maxLines - 1] = cut[maxLines - 1].replace(/[\s.,;:-]*$/, '') + '...';
    return cut;
  };

  /** Draws wrapped text; returns the y just below it. */
  const paragraph = (
    value: string,
    x: number,
    y: number,
    width: number,
    o: { size?: number; family?: 'helvetica' | 'times'; style?: 'normal' | 'bold' | 'italic'; c?: RGB; lh?: number; max?: number } = {}
  ): number => {
    const size = o.size ?? 9.5;
    font(o.family ?? 'helvetica', o.style ?? 'normal', size, o.c ?? TEXT);
    const wrapped = lines(value, width, o.max);
    const lh = o.lh ?? size * 0.4;
    doc.text(wrapped, x, y + size * 0.3, { lineHeightFactor: lh / (size * 0.3528) });
    return y + wrapped.length * lh;
  };

  const caps = (value: string, x: number, y: number, size: number, c: RGB, align: 'left' | 'center' | 'right' = 'left') => {
    font('helvetica', 'bold', size, c);
    doc.text(value.toUpperCase(), x, y, { align, charSpace: 0.5 });
  };

  const rrect = (x: number, y: number, w: number, h: number, radius: number, bg: RGB, border?: RGB) => {
    fill(bg);
    if (border) {
      stroke(border);
      doc.setLineWidth(0.25);
      doc.roundedRect(x, y, w, h, radius, radius, 'FD');
    } else {
      doc.roundedRect(x, y, w, h, radius, radius, 'F');
    }
  };

  const card = (x: number, y: number, w: number, h: number) => {
    rrect(x + 0.6, y + 0.9, w, h, 3, [236, 232, 225]);
    rrect(x, y, w, h, 3, WHITE, LINE);
  };

  const pill = (value: string, x: number, y: number, c: RGB, align: 'left' | 'right' = 'left') => {
    const upper = value.toUpperCase();
    font('helvetica', 'bold', 6.8, WHITE);
    const w = doc.getTextWidth(upper) + upper.length * 0.35 + 5.4;
    const px = align === 'right' ? x - w : x;
    fill(c);
    doc.roundedRect(px, y, w, 4.8, 2.4, 2.4, 'F');
    doc.text(upper, px + w / 2 + 0.17, middleY(y + 2.4, 6.8), { align: 'center', charSpace: 0.35 });
    return w;
  };

  const polygon = (points: Array<[number, number]>, style: 'F' | 'S' | 'FD') => {
    const [first, ...rest] = points;
    const rel = rest.map(([px, py], i) => {
      const [prevX, prevY] = i === 0 ? first : rest[i - 1];
      return [px - prevX, py - prevY];
    });
    doc.lines(rel, first[0], first[1], [1, 1], style, true);
  };

  const star = (cx: number, cy: number, outer: number, c: RGB, filled = true) => {
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < 10; i++) {
      const radius = i % 2 === 0 ? outer : outer * 0.42;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      pts.push([cx + radius * Math.cos(a), cy + radius * Math.sin(a)]);
    }
    fill(c);
    stroke(c);
    doc.setLineWidth(0.2);
    polygon(pts, filled ? 'F' : 'S');
  };

  const arc = (cx: number, cy: number, radius: number, from: number, to: number, width: number, c: RGB) => {
    stroke(c);
    doc.setLineWidth(width);
    doc.setLineCap('round');
    const steps = Math.max(2, Math.ceil(Math.abs(to - from) / 0.04));
    let px = cx + radius * Math.cos(from);
    let py = cy + radius * Math.sin(from);
    for (let i = 1; i <= steps; i++) {
      const a = from + ((to - from) * i) / steps;
      const nx = cx + radius * Math.cos(a);
      const ny = cy + radius * Math.sin(a);
      doc.line(px, py, nx, ny);
      px = nx;
      py = ny;
    }
    doc.setLineCap('butt');
  };

  const statusMark = (cx: number, cy: number, radius: number, level: Level) => {
    const c = levelColor(level);
    fill(c);
    doc.circle(cx, cy, radius, 'F');
    stroke(WHITE);
    doc.setLineWidth(radius * 0.26);
    doc.setLineCap('round');
    if (level === 'strong') {
      doc.line(cx - radius * 0.42, cy + radius * 0.02, cx - radius * 0.1, cy + radius * 0.34);
      doc.line(cx - radius * 0.1, cy + radius * 0.34, cx + radius * 0.46, cy - radius * 0.34);
    } else if (level === 'weak') {
      doc.line(cx - radius * 0.34, cy - radius * 0.34, cx + radius * 0.34, cy + radius * 0.34);
      doc.line(cx + radius * 0.34, cy - radius * 0.34, cx - radius * 0.34, cy + radius * 0.34);
    } else if (level === 'mid') {
      doc.line(cx, cy - radius * 0.46, cx, cy + radius * 0.12);
      doc.line(cx, cy + radius * 0.46, cx, cy + radius * 0.46);
    } else {
      doc.line(cx - radius * 0.34, cy, cx + radius * 0.34, cy);
    }
    doc.setLineCap('butt');
  };

  const icon = (kind: Pillar['key'], cx: number, cy: number) => {
    fill(SOFT);
    doc.circle(cx, cy, 5.2, 'F');
    stroke(ACCENT);
    doc.setLineWidth(0.55);
    doc.setLineCap('round');
    if (kind === 'found') {
      doc.circle(cx - 0.7, cy - 0.7, 2.3, 'S');
      doc.line(cx + 1, cy + 1, cx + 2.9, cy + 2.9);
    } else if (kind === 'speed') {
      arc(cx, cy + 1.6, 3, Math.PI, Math.PI * 2, 0.55, ACCENT);
      stroke(ACCENT);
      doc.setLineWidth(0.55);
      doc.line(cx, cy + 1.6, cx + 1.8, cy - 0.6);
    } else if (kind === 'contact') {
      doc.roundedRect(cx - 3, cy - 2.6, 6, 4.4, 1.1, 1.1, 'S');
      doc.line(cx - 1.4, cy + 1.8, cx - 2.2, cy + 3.2);
      doc.line(cx - 2.2, cy + 3.2, cx - 0.4, cy + 1.8);
    } else {
      star(cx, cy + 0.1, 3.1, ACCENT, false);
    }
    doc.setLineCap('butt');
  };

  const pageChrome = (page: number) => {
    if (page > 1) {
      font('helvetica', 'normal', 7.5, MUTED);
      const { w: headerLogoW } = drawLogo(M, 6.2, 24, 6.2);
      doc.text(`${r.name}  |  Relatório de presença digital`, M + (headerLogoW ? headerLogoW + 3.5 : 0), 12);
      doc.text(`${page}/3`, PAGE_W - M, 12, { align: 'right' });
      stroke(LINE);
      doc.setLineWidth(0.25);
      doc.line(M, 15, PAGE_W - M, 15);
    }
    stroke(LINE);
    doc.setLineWidth(0.25);
    doc.line(M, 281, PAGE_W - M, 281);
    font('helvetica', 'normal', 6.6, MUTED);
    const sources = r.speed
      ? 'Fontes: Google PageSpeed Insights, ficha pública do Google e dados abertos.'
      : 'Fontes: ficha pública do Google e dados abertos.';
    doc.text(sources, M, 286);
    doc.text(`Coletado em ${now.toLocaleDateString('pt-BR')}  |  Scoutly`, PAGE_W - M, 286, { align: 'right' });
  };

  // =========================================================================
  // PAGE 1 - cover and overview
  // =========================================================================
  fill(COVER);
  doc.rect(0, 0, PAGE_W, 132, 'F');
  fill(ACCENT_ON_COVER);
  doc.rect(0, 0, PAGE_W, 1.6, 'F');

  if (logo) {
    const maxLogoW = 40;
    const maxLogoH = 10;
    const probeH = Math.min(maxLogoH, maxLogoW / logo.ratio);
    const plateW = Math.min(maxLogoW, probeH * logo.ratio) + 7;
    rrect(M, 9, plateW, probeH + 6, 2.2, WHITE);
    drawLogo(M + 3.5, 12, maxLogoW, maxLogoH);
  } else {
    font('helvetica', 'bold', 8, [200, 204, 212]);
    doc.text((preparedBy || 'Relatório').toUpperCase(), M, 17, { charSpace: 0.9 });
  }
  font('helvetica', 'normal', 8, [150, 156, 166]);
  doc.text(formatDate(now), PAGE_W - M, 17, { align: 'right' });
  if (brand.tagline?.trim()) {
    font('helvetica', 'italic', 8.2, [176, 182, 192]);
    doc.text(lines(brand.tagline.trim(), 110, 1)[0], M, logo ? 31 : 24);
  }

  caps('Relatório de presença digital', M, 38, 7.6, ACCENT_ON_COVER);

  // Title: shrink until it fits in 3 lines
  let titleSize = 30;
  let titleLines: string[] = [];
  const titleW = 104;
  for (; titleSize >= 19; titleSize -= 1) {
    font('times', 'bold', titleSize, WHITE);
    titleLines = doc.splitTextToSize(r.name, titleW);
    if (titleLines.length <= (titleSize > 24 ? 2 : 3)) break;
  }
  font('times', 'bold', titleSize, WHITE);
  const titleLh = titleSize * 0.4;
  doc.text(titleLines, M, 50, { lineHeightFactor: titleLh / (titleSize * 0.3528), baseline: 'top', charSpace: -0.2 });
  let y = 50 + titleLines.length * titleLh + 3;

  const subtitle = [r.category, r.place].filter(Boolean).join('  |  ');
  if (subtitle) y = paragraph(subtitle, M, y, titleW, { size: 9.5, c: [176, 182, 192], max: 2 }) + 3;

  fill(ACCENT_ON_COVER);
  doc.rect(M, y + 1, 10, 0.8, 'F');
  paragraph(r.verdict, M, y + 6, 98, { size: 11, family: 'times', style: 'italic', c: [232, 234, 238], lh: 5.2, max: 5 });

  // Gauge
  const gx = 152;
  const gy = 84;
  const gr = 26;
  arc(gx, gy, gr, Math.PI, Math.PI * 2, 5.4, COVER_SOFT);
  if (r.index > 0) arc(gx, gy, gr, Math.PI, Math.PI + (Math.PI * r.index) / 100, 5.4, levelColor(r.indexLevel));
  font('helvetica', 'bold', 36, WHITE);
  doc.text(String(r.index), gx, gy - 1, { align: 'center' });
  font('helvetica', 'normal', 8, [170, 176, 186]);
  doc.text('de 100', gx, gy + 5.5, { align: 'center' });
  caps('Índice de presença digital', gx, gy + 16, 6.6, [200, 204, 212], 'center');
  const wordW = (() => {
    const upper = levelWord(r.indexLevel).toUpperCase();
    font('helvetica', 'bold', 6.8, WHITE);
    return doc.getTextWidth(upper) + upper.length * 0.35 + 5.4;
  })();
  pill(levelWord(r.indexLevel), gx - wordW / 2, gy + 20, levelColor(r.indexLevel));

  // Pillars
  const cardW = (W - 5) / 2;
  const cardH = 48;
  r.pillars.forEach((p, i) => {
    const cx = M + (i % 2) * (cardW + 5);
    const cy = 116 + Math.floor(i / 2) * (cardH + 5);
    card(cx, cy, cardW, cardH);
    icon(p.key, cx + 10, cy + 10.5);
    font('helvetica', 'bold', 10.5, INK);
    doc.text(p.title, cx + 18.5, cy + 11.6);
    pill(levelWord(p.level), cx + 18.5, cy + 14.6, levelColor(p.level));
    paragraph(p.headline, cx + 6, cy + 24, cardW - 12, { size: 8.8, c: TEXT, lh: 4.1, max: 3 });
    // progress
    const by = cy + cardH - 7;
    rrect(cx + 6, by, cardW - 12 - 14, 2, 1, [236, 232, 225]);
    if (p.score !== null && p.score > 0) rrect(cx + 6, by, Math.max(2, ((cardW - 26) * p.score) / 100), 2, 1, levelColor(p.level));
    font('helvetica', 'bold', 8.5, p.score === null ? MUTED : INK);
    doc.text(p.score === null ? '-' : `${p.score}`, cx + cardW - 6, by + 2.3, { align: 'right' });
  });

  // Strength / opportunity
  const hy = 228;
  const half = (W - 6) / 2;
  const highlight = (x: number, label: string, head: { title: string; body: string }, c: RGB) => {
    fill(c);
    doc.rect(x, hy, 1.1, 28, 'F');
    caps(label, x + 5, hy + 3.5, 6.8, c);
    font('helvetica', 'bold', 10, INK);
    doc.text(head.title, x + 5, hy + 10.2);
    paragraph(head.body, x + 5, hy + 13.2, half - 8, { size: 8.8, c: TEXT, lh: 4.1, max: 4 });
  };
  highlight(M, 'Ponto forte', r.strength, GOOD);
  highlight(M + half + 6, 'Principal oportunidade', r.opportunity, ACCENT);

  // Facts strip
  const fy = 266;
  stroke(LINE);
  doc.setLineWidth(0.25);
  doc.line(M, fy - 3, PAGE_W - M, fy - 3);
  const facts: Array<[string, string]> = [
    ['Site', r.domain || 'Não identificado'],
    ['Avaliação no Google', r.rating !== null ? `${r.rating.toFixed(1).replace('.', ',')}${r.reviewCount ? ` (${r.reviewCount})` : ''}` : 'Sem dados'],
    ['Redes sociais', r.socials.length ? r.socials.slice(0, 2).join(', ') : 'Não identificadas'],
    ['Atuação', r.openSince ? `Desde ${r.openSince}` : r.place || '-'],
  ];
  facts.forEach(([label, value], i) => {
    const fx = M + (i * W) / 4;
    caps(label, fx, fy + 1, 6.2, MUTED);
    font('helvetica', 'bold', 9, INK);
    doc.text(lines(value, W / 4 - 4, 1)[0], fx, fy + 6.5);
  });
  pageChrome(1);

  // =========================================================================
  // PAGE 2 - what it means
  // =========================================================================
  doc.addPage();
  pageChrome(2);
  font('times', 'bold', 22, INK);
  doc.text('O que isso significa na prática', M, 32, { charSpace: -0.2 });
  paragraph(
    'Cada ponto abaixo representa um momento em que um cliente decide continuar ou procurar outra empresa.',
    M,
    37,
    W,
    { size: 9.5, c: MUTED, max: 2 }
  );

  // --- journey ---
  const jy = 56;
  caps('A jornada do cliente', M, jy - 4, 7.4, ACCENT);
  const jH = 44;
  card(M, jy, W, jH);
  const colW = W / 4;
  const nodeY = jy + 13;
  stroke(LINE);
  doc.setLineWidth(0.7);
  doc.line(M + colW / 2, nodeY, M + colW * 3.5, nodeY);
  r.journey.forEach((node, i) => {
    const nx = M + colW * i + colW / 2;
    fill(WHITE);
    doc.circle(nx, nodeY, 7.4, 'F');
    statusMark(nx, nodeY, 6.2, node.level);
    font('helvetica', 'bold', 6.2, MUTED);
    doc.text(`ETAPA ${i + 1}`, nx, jy + 25, { align: 'center', charSpace: 0.4 });
    font('helvetica', 'bold', 9, INK);
    doc.text(lines(node.title, colW - 6, 2), nx, jy + 29.6, { align: 'center' });
    font('helvetica', 'normal', 8, levelColor(node.level) === GREY ? MUTED : levelColor(node.level));
    doc.text(lines(node.caption, colW - 6, 2), nx, jy + 36.4, { align: 'center' });
  });

  // --- speed / site block ---
  const sy = jy + jH + 14;
  caps(r.hasWebsite ? 'Velocidade do site no celular' : 'Presença na internet', M, sy - 4, 7.4, ACCENT);
  const blockH = 64;
  card(M, sy, W, blockH);

  if (r.speed && r.speed.lcpSec !== null) {
    const { lcpSec } = r.speed;
    paragraph('Tempo para o conteúdo principal aparecer', M + 7, sy + 7, W - 14, { size: 10.5, style: 'bold', c: INK });
    paragraph(
      'É o momento em que o visitante vê o que veio buscar. O Google considera ótimo até 2,5 segundos.',
      M + 7,
      sy + 13.5,
      W - 14,
      { size: 8.6, c: MUTED, max: 2 }
    );
    const bx = M + 7;
    const bw = W - 14;
    const by = sy + 30;
    const max = Math.max(6, Math.ceil(lcpSec * 1.15));
    const sx = (sec: number) => bx + (bw * Math.min(sec, max)) / max;
    fill([214, 238, 226]);
    doc.roundedRect(bx, by, sx(2.5) - bx + 3, 6, 3, 3, 'F');
    fill([250, 236, 200]);
    doc.rect(sx(2.5), by, sx(4) - sx(2.5), 6, 'F');
    fill([245, 213, 209]);
    doc.roundedRect(sx(4) - 3, by, bx + bw - sx(4) + 3, 6, 3, 3, 'F');
    fill([250, 236, 200]);
    doc.rect(sx(2.5), by, sx(4) - sx(2.5), 6, 'F');
    font('helvetica', 'normal', 6.8, MUTED);
    doc.text('Ótimo', bx + 2.5, by + 10.5);
    doc.text('A melhorar', sx(2.5) + 2, by + 10.5);
    doc.text('Lento', sx(4) + 2, by + 10.5);
    doc.text('0 s', bx, by + 15);
    doc.text('2,5 s', sx(2.5), by + 15, { align: 'center' });
    doc.text('4 s', sx(4), by + 15, { align: 'center' });
    const mx = sx(lcpSec);
    const markerColor = lcpSec <= 2.5 ? GOOD : lcpSec <= 4 ? MID : BAD;
    stroke(markerColor);
    doc.setLineWidth(0.9);
    doc.line(mx, by - 5, mx, by + 6);
    fill(markerColor);
    doc.circle(mx, by + 3, 2.4, 'F');
    fill(WHITE);
    doc.circle(mx, by + 3, 0.9, 'F');
    font('helvetica', 'bold', 9.5, markerColor);
    const rightAlign = mx > bx + bw - 34;
    doc.text(`Seu site: ${formatSeconds(lcpSec)}`, rightAlign ? mx + 1 : mx - 1, by - 7, { align: rightAlign ? 'right' : 'left' });

    const metrics: Array<{ label: string; value: string; level: Level; note: string }> = [];
    metrics.push({
      label: 'Nota geral do Google',
      value: `${r.speed.score}/100`,
      level: r.speed.score >= 90 ? 'strong' : r.speed.score >= 50 ? 'mid' : 'weak',
      note: 'Média de velocidade no celular',
    });
    if (r.speed.tbtMs !== null) {
      metrics.push({
        label: 'Tempo de resposta',
        value: `${Math.round(r.speed.tbtMs)} ms`,
        level: r.speed.tbtMs <= 200 ? 'strong' : r.speed.tbtMs <= 600 ? 'mid' : 'weak',
        note: 'Quanto a página trava ao abrir',
      });
    }
    if (r.speed.cls !== null) {
      metrics.push({
        label: 'Estabilidade visual',
        value: String(r.speed.cls).replace('.', ','),
        level: r.speed.cls <= 0.1 ? 'strong' : r.speed.cls <= 0.25 ? 'mid' : 'weak',
        note: 'Se o conteúdo "pula" na tela',
      });
    }
    const mw = (W - 14) / metrics.length;
    metrics.forEach((m, i) => {
      const mxx = bx + i * mw;
      const my = sy + blockH - 15;
      fill(levelColor(m.level));
      doc.rect(mxx, my, 1, 11, 'F');
      caps(m.label, mxx + 3.5, my + 2.4, 5.8, MUTED);
      font('helvetica', 'bold', 11.5, INK);
      doc.text(m.value, mxx + 3.5, my + 7.8);
      font('helvetica', 'normal', 6.8, MUTED);
      doc.text(lines(m.note, mw - 6, 1)[0], mxx + 3.5, my + 10.8);
    });
  } else if (!r.hasWebsite) {
    const wx = M + 8;
    const wy = sy + 9;
    rrect(wx, wy, 58, 44, 2.5, SOFT, LINE);
    fill([226, 220, 210]);
    doc.roundedRect(wx, wy, 58, 7, 2.5, 2.5, 'F');
    doc.rect(wx, wy + 4, 58, 3, 'F');
    [0, 1, 2].forEach((d) => {
      fill(WHITE);
      doc.circle(wx + 4 + d * 3.6, wy + 3.5, 1, 'F');
    });
    rrect(wx + 12, wy + 2, 40, 3.2, 1.6, WHITE);
    stroke(GREY);
    doc.setLineWidth(0.5);
    doc.setLineDashPattern([1.4, 1.2], 0);
    doc.roundedRect(wx + 7, wy + 12, 44, 26, 2, 2, 'S');
    doc.setLineDashPattern([], 0);
    font('helvetica', 'bold', 8, GREY);
    doc.text('Página não encontrada', wx + 29, wy + 26.5, { align: 'center' });
    paragraph('Hoje não existe um endereço próprio para conhecer a empresa', M + 74, sy + 11, W - 82, {
      size: 12,
      family: 'times',
      style: 'bold',
      c: INK,
      lh: 5.4,
      max: 3,
    });
    paragraph(
      'Quem pesquisa o nome ou o serviço no Google encontra apenas fichas e redes sociais, sem um lugar único para ver produtos, preços, horários e falar com a empresa. Um site rápido, pensado para o celular, concentra tudo isso e transforma buscas em contatos.',
      M + 74,
      sy + 28,
      W - 82,
      { size: 8.8, c: MUTED, lh: 4.2, max: 7 }
    );
  } else {
    paragraph('Velocidade do site não medida', M + 7, sy + 9, W - 14, { size: 11, style: 'bold', c: INK });
    paragraph(
      'A medição oficial do Google não estava disponível no momento da emissão deste relatório. Podemos refazer a análise a qualquer momento para trazer a nota e o tempo de carregamento do site.',
      M + 7,
      sy + 17,
      W - 14,
      { size: 9, c: MUTED, lh: 4.3, max: 4 }
    );
  }

  // --- reputation + channels ---
  const ry = sy + blockH + 14;
  caps('Reputação e canais', M, ry - 4, 7.4, ACCENT);
  const rcH = 46;
  const colHalf = (W - 5) / 2;
  card(M, ry, colHalf, rcH);
  card(M + colHalf + 5, ry, colHalf, rcH);

  if (r.rating !== null) {
    const ratingText = r.rating.toFixed(1).replace('.', ',');
    font('helvetica', 'bold', 30, INK);
    doc.text(ratingText, M + 7, ry + 17);
    const starX = M + 7 + doc.getTextWidth(ratingText) + 6;
    for (let i = 0; i < 5; i++) {
      star(starX + 2.7 + i * 6.4, ry + 10.6, 2.6, r.rating >= i + 0.5 ? MID : [225, 220, 210]);
    }
    font('helvetica', 'normal', 8, MUTED);
    doc.text(r.reviewCount ? `${r.reviewCount} avaliações no Google` : 'Avaliações no Google', starX, ry + 18);
    paragraph(
      r.rating >= 4.5
        ? 'Nota excelente: a reputação já é um argumento de venda e pode ser mais exposta no site e nas redes.'
        : 'A nota pode crescer com um processo simples para pedir avaliações a clientes satisfeitos.',
      M + 7,
      ry + 26,
      colHalf - 14,
      { size: 8.6, c: TEXT, lh: 4.1, max: 4 }
    );
  } else {
    paragraph('Reputação no Google', M + 7, ry + 7, colHalf - 14, { size: 10.5, style: 'bold', c: INK });
    paragraph(
      'Não encontramos avaliações públicas desta empresa. Avaliações são um dos principais fatores de confiança para quem compara opções na região.',
      M + 7,
      ry + 14,
      colHalf - 14,
      { size: 8.8, c: MUTED, lh: 4.2, max: 6 }
    );
  }

  const cx2 = M + colHalf + 5 + 7;
  const rows: Array<{ label: string; level: Level; note: string }> = [
    { label: 'WhatsApp', level: r.contact.hasWhatsApp ? 'strong' : 'weak', note: r.contact.hasWhatsApp ? 'Identificado' : 'Não confirmado' },
    {
      label: 'Telefone',
      level: r.contact.hasPhone || r.contact.hasWhatsApp ? 'strong' : 'weak',
      note: r.contact.hasPhone || r.contact.hasWhatsApp ? 'Disponível para os clientes' : 'Não encontrado',
    },
    {
      label: 'Redes sociais',
      level: r.socials.length ? 'strong' : 'weak',
      note: r.socials.length ? r.socials.slice(0, 3).join(', ') : 'Não identificadas',
    },
    r.trackers
      ? {
          label: 'Medição de resultados',
          level: r.trackers.length ? 'strong' : 'mid',
          note: r.trackers.length ? r.trackers.slice(0, 2).join(', ') : 'Não detectada na página inicial',
        }
      : { label: 'Medição de resultados', level: 'unknown', note: 'Não verificada' },
  ];
  rows.forEach((row, i) => {
    const ry2 = ry + 6 + i * 9.6;
    statusMark(cx2 + 2.4, ry2 + 3, 2.4, row.level);
    font('helvetica', 'bold', 8.6, INK);
    doc.text(row.label, cx2 + 8, ry2 + 2.4);
    font('helvetica', 'normal', 7.6, MUTED);
    doc.text(lines(row.note, colHalf - 28, 1)[0], cx2 + 8, ry2 + 6.2);
  });

  // --- methodology ---
  const my0 = ry + rcH + 12;
  caps('Como calculamos o índice', M, my0 - 4, 7.4, ACCENT);
  const mH = 281 - 4 - my0;
  rrect(M, my0, W, mH, 3, SOFT);
  const weights: Array<[string, number]> = [
    ['Ser encontrado', 30],
    ['Velocidade do site', 25],
    ['Facilidade de contato', 25],
    ['Confiança e alcance', 20],
  ];
  const wCol = (W - 14) / 4;
  weights.forEach(([label, weight], i) => {
    const wx2 = M + 7 + i * wCol;
    font('helvetica', 'bold', 8, INK);
    doc.text(label, wx2, my0 + 8);
    rrect(wx2, my0 + 11, wCol - 8, 2.2, 1.1, [229, 224, 215]);
    rrect(wx2, my0 + 11, ((wCol - 8) * weight) / 30, 2.2, 1.1, ACCENT);
    font('helvetica', 'normal', 7.4, MUTED);
    doc.text(`${weight}% do índice`, wx2, my0 + 17.2);
  });
  paragraph(
    'Cada pilar vai de 0 a 100 conforme sinais públicos observados; o índice é a média ponderada dos pilares medidos.',
    M + 7,
    my0 + 20.6,
    W - 14,
    { size: 7.6, c: MUTED, lh: 3.5, max: 2 }
  );

  // =========================================================================
  // PAGE 3 - action plan
  // =========================================================================
  doc.addPage();
  pageChrome(3);
  font('times', 'bold', 22, INK);
  doc.text('Plano de ação sugerido', M, 32, { charSpace: -0.2 });
  paragraph(
    'As ações abaixo foram priorizadas pelo que mais aproxima a empresa de novos clientes, começando pelo maior impacto.',
    M,
    37,
    W,
    { size: 9.5, c: MUTED, max: 2 }
  );

  const ay0 = 54;
  const aH = 41;
  r.actions.forEach((a, i) => {
    const ay = ay0 + i * (aH + 6);
    card(M, ay, W, aH);
    fill(COVER);
    doc.circle(M + 12, ay + 12, 6.2, 'F');
    font('times', 'bold', 14, WHITE);
    doc.text(String(i + 1), M + 12, middleY(ay + 12, 14), { align: 'center' });
    font('helvetica', 'bold', 12, INK);
    doc.text(lines(a.title, W - 100, 1)[0], M + 24, ay + 11.8);
    const wImpact = pill(`Impacto ${a.impact.toLowerCase()}`, PAGE_W - M - 6, ay + 7.4, a.impact === 'Alto' ? ACCENT : GREY, 'right');
    pill(`Esforço ${a.effort.toLowerCase()}`, PAGE_W - M - 6 - wImpact - 2.5, ay + 7.4, COVER, 'right');
    const colX = M + 24;
    const colWd = (W - 24 - 10) / 2;
    caps('Por que', colX, ay + 21, 6.2, MUTED);
    paragraph(a.why, colX, ay + 24, colWd, { size: 8.6, c: TEXT, lh: 4, max: 4 });
    caps('O que fazemos', colX + colWd + 6, ay + 21, 6.2, MUTED);
    paragraph(a.what, colX + colWd + 6, ay + 24, colWd, { size: 8.6, c: TEXT, lh: 4, max: 4 });
  });

  // CTA
  const ctaY = ay0 + 3 * (aH + 6) + 2;
  const ctaH = 38;
  rrect(M, ctaY, W, ctaH, 4, COVER);
  fill(ACCENT_ON_COVER);
  doc.roundedRect(M, ctaY, 3, ctaH, 1.5, 1.5, 'F');
  font('times', 'bold', 17, WHITE);
  doc.text('Vamos conversar sobre isso?', M + 12, ctaY + 13);
  paragraph(
    'Em uma conversa rápida apresentamos o plano completo, com prioridades, prazos e investimento, adaptado à realidade da empresa.',
    M + 12,
    ctaY + 18.5,
    W - 74,
    { size: 9, c: [205, 209, 217], lh: 4.3, max: 3 }
  );
  if (preparedBy) {
    caps('Preparado por', PAGE_W - M - 8, ctaY + 11, 6.2, [160, 166, 176], 'right');
    font('helvetica', 'bold', 10.5, WHITE);
    doc.text(lines(preparedBy, 56, 1)[0], PAGE_W - M - 8, ctaY + 17, { align: 'right' });
    const contacts = [brand.contactEmail, brand.contactPhone, brand.contactWebsite]
      .map((value) => (value || '').trim())
      .filter(Boolean)
      .slice(0, 3);
    font('helvetica', 'normal', 7.8, [205, 209, 217]);
    contacts.forEach((value, i) => {
      doc.text(lines(value, 58, 1)[0], PAGE_W - M - 8, ctaY + 22.6 + i * 4, { align: 'right' });
    });
  }

  // How we work together
  const py = ctaY + ctaH + 14;
  caps('Como podemos trabalhar juntos', M, py - 4, 7.4, ACCENT);
  const steps: Array<[string, string]> = [
    ['Reunião de alinhamento', 'Entendemos metas, público e prioridades da empresa.'],
    ['Proposta e cronograma', 'Definimos entregas, prazos e investimento.'],
    ['Execução e resultados', 'Implementamos, medimos e ajustamos a cada etapa.'],
  ];
  const sW = W / 3;
  stroke(LINE);
  doc.setLineWidth(0.7);
  doc.line(M + 5, py + 4.5, M + W - sW + 5, py + 4.5);
  steps.forEach(([title, body], i) => {
    const px = M + i * sW;
    fill(WHITE);
    doc.circle(px + 5, py + 4.5, 5.2, 'F');
    fill(i === 0 ? ACCENT : COVER);
    doc.circle(px + 5, py + 4.5, 4.2, 'F');
    font('helvetica', 'bold', 8.5, WHITE);
    doc.text(String(i + 1), px + 5, middleY(py + 4.5, 8.5), { align: 'center' });
    font('helvetica', 'bold', 9.2, INK);
    doc.text(title, px, py + 15);
    paragraph(body, px, py + 18, sW - 8, { size: 8, c: MUTED, lh: 3.8, max: 3 });
  });

  doc.setProperties({
    title: `Relatório de presença digital - ${r.name}`,
    subject: 'Análise da presença digital',
    author: preparedBy || 'Scoutly',
  });
  doc.save(`relatorio-presenca-digital-${slugify(r.name)}.pdf`);
}
