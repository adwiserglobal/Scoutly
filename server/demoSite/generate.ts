import { generateText } from '../llmChain.js';
import {
  ICON_IDS, STYLE_IDS,
  type DemoBrand, type DemoBusinessFacts, type DemoCopy, type DemoImage, type DemoImages, type IconId, type StyleId,
} from './types.js';

const STYLE_GUIDE: Record<StyleId, string> = {
  clean: 'clean — claro, confiável e moderno (clínicas, consultórios, serviços profissionais, escolas)',
  warm: 'warm — acolhedor, editorial, tons quentes (restaurantes, padarias, cafés, hotéis, pousadas)',
  bold: 'bold — escuro, forte, direto (oficinas, autopeças, academias, construção, motos, funilaria)',
  elegant: 'elegant — sofisticado, serifado (salões, estética, barbearias, advogados, joalherias, moda)',
  fresh: 'fresh — leve, verde, saudável (pet, floricultura, nutrição, bem-estar, educação infantil, mercados)',
  noir: 'noir — azul-noite, tecnológico (tecnologia, contabilidade, imobiliárias, consultorias, escritórios)',
};

const STYLE_KEYWORDS: Array<[StyleId, RegExp]> = [
  ['warm', /restaurante|padaria|caf[eé]|lanchonete|pizza|bar\b|hotel|pousada|doceria|confeitaria|sorvet|churrasc|hamb[uú]rguer|gastronom|bistr/i],
  ['bold', /oficina|mec[aâ]nic|auto|carro|moto|funilaria|pneu|academia|crossfit|construção|constru[cç]|serralheria|vidra[cç]|marcenaria|lava[- ]?r[aá]pido|despachante/i],
  ['elegant', /sal[aã]o|beleza|est[eé]tica|barbearia|cabeleireiro|manicure|spa\b|advog|joalheria|moda|boutique|noiva|maquiagem|tatuagem/i],
  ['fresh', /pet|veterin|flor|nutri|pilates|yoga|ioga|escola infantil|creche|mercado|hortifruti|orgânic|natural|farm[aá]cia|bem-estar/i],
  ['noir', /tecnologia|software|inform[aá]tica|contab|imobili|consultoria|escrit[oó]rio|seguros|ag[eê]ncia|engenharia|arquitet|despach/i],
  ['clean', /cl[ií]nica|dent|odont|m[eé]dic|consult[oó]rio|psic|fisio|escola|curso|laborat|ótica|otica|hospital/i],
];

export function styleForCategory(category: string, name = ''): StyleId {
  const text = `${category} ${name}`;
  for (const [style, pattern] of STYLE_KEYWORDS) if (pattern.test(text)) return style;
  return 'clean';
}

function clip(value: unknown, max: number) {
  return String(value ?? '').replace(/[\u0000-\u001F]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function buildFacts(input: any): DemoBusinessFacts {
  const phone = String(input?.phone || '');
  // Locked contacts arrive masked (they contain "•"); never use those.
  const phoneDigits = phone.includes('•') ? '' : phone.replace(/\D/g, '');
  const rating = Number(input?.rating);
  const reviews = Number(input?.reviewCount);
  return {
    name: clip(input?.name, 90) || 'Seu negócio',
    category: clip(input?.category, 80) || 'Negócio local',
    address: clip(input?.address, 180),
    neighborhood: clip(input?.bairro, 60),
    city: clip(input?.municipio, 60),
    phoneDigits: phoneDigits.length >= 10 && phoneDigits.length <= 13 ? phoneDigits : '',
    rating: Number.isFinite(rating) && rating > 0 && rating <= 5 ? Math.round(rating * 10) / 10 : null,
    reviewCount: Number.isFinite(reviews) && reviews > 0 ? Math.round(reviews) : null,
    hours: clip(input?.openingHoursRaw, 240),
    mapsUrl: /^https:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(String(input?.googleMapsUrl || ''))
      ? String(input.googleMapsUrl).slice(0, 400) : '',
  };
}

function extractJson(raw: string): any | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = (fenced || raw).trim();
  const first = candidate.indexOf('{');
  const last = candidate.lastIndexOf('}');
  if (first < 0 || last <= first) return null;
  try { return JSON.parse(candidate.slice(first, last + 1)); } catch { return null; }
}

const list = <T>(value: unknown, map: (item: any) => T | null, min: number, max: number): T[] => {
  const items = (Array.isArray(value) ? value : []).map(map).filter((item): item is T => item !== null).slice(0, max);
  return items.length >= min ? items : [];
};

function normalizeCopy(raw: any, fallbackStyle: StyleId): DemoCopy | null {
  if (!raw || typeof raw !== 'object') return null;
  const style = (STYLE_IDS as readonly string[]).includes(raw.style) ? raw.style as StyleId : fallbackStyle;
  const icon = (value: unknown): IconId => ((ICON_IDS as readonly string[]).includes(String(value)) ? value as IconId : 'check');
  const pair = (item: any) => (item && clip(item.title, 70) && clip(item.text, 260)
    ? { title: clip(item.title, 70), text: clip(item.text, 260) } : null);

  const services = list(raw.services, (item) => (item && clip(item.title, 60) && clip(item.text, 240)
    ? { title: clip(item.title, 60), text: clip(item.text, 240), icon: icon(item.icon) } : null), 3, 6);
  const highlights = list(raw.highlights, pair, 3, 3);
  const process = list(raw.process, pair, 3, 3);
  const faq = list(raw.faq, (item) => (item && clip(item.q, 140) && clip(item.a, 420)
    ? { q: clip(item.q, 140), a: clip(item.a, 420) } : null), 3, 5);
  const aboutParagraphs = (Array.isArray(raw.aboutParagraphs) ? raw.aboutParagraphs : [])
    .map((paragraph: unknown) => clip(paragraph, 520)).filter(Boolean).slice(0, 3);
  const headline = clip(raw.headline, 110);
  if (!headline || services.length < 3 || highlights.length < 3 || process.length < 3 || faq.length < 3 || aboutParagraphs.length < 1) return null;

  const queries = raw.imageQueries && typeof raw.imageQueries === 'object' ? raw.imageQueries : {};
  return {
    style,
    variant: Number(raw.variant) === 1 ? 1 : 0,
    eyebrow: clip(raw.eyebrow, 60),
    headline,
    subheadline: clip(raw.subheadline, 260),
    primaryCta: clip(raw.primaryCta, 32) || 'Falar agora',
    secondaryCta: clip(raw.secondaryCta, 32) || 'Ver serviços',
    aboutTitle: clip(raw.aboutTitle, 90) || 'Quem somos',
    aboutParagraphs,
    services,
    highlights,
    process,
    faq,
    ctaTitle: clip(raw.ctaTitle, 90) || 'Vamos conversar?',
    ctaText: clip(raw.ctaText, 220),
    imageQueries: {
      hero: clip(queries.hero, 80),
      about: clip(queries.about, 80),
      gallery: (Array.isArray(queries.gallery) ? queries.gallery : []).map((q: unknown) => clip(q, 80)).filter(Boolean).slice(0, 3),
    },
  };
}

function promptFor(facts: DemoBusinessFacts, brand: DemoBrand, variation: number, styleHint: StyleId) {
  const place = [facts.neighborhood, facts.city].filter(Boolean).join(', ') || facts.address || 'a região';
  return `Você é diretor de arte e redator sênior de sites para pequenos negócios brasileiros. Escreva o conteúdo de UM site de página única, em português do Brasil, para o negócio abaixo. O site será mostrado ao dono como proposta, então precisa parecer feito sob medida, não genérico.

NEGÓCIO
- Nome: ${facts.name}
- Segmento: ${facts.category}
- Local: ${place}${facts.address ? ` (${facts.address})` : ''}
${facts.rating ? `- Nota pública no Google: ${facts.rating}/5${facts.reviewCount ? ` (${facts.reviewCount} avaliações)` : ''}\n` : ''}${brand.name ? `- Site criado por: ${brand.name}\n` : ''}
ESTILOS VISUAIS (escolha o que melhor combina; sugestão inicial: ${styleHint})
${STYLE_GUIDE.clean}
${STYLE_GUIDE.warm}
${STYLE_GUIDE.bold}
${STYLE_GUIDE.elegant}
${STYLE_GUIDE.fresh}
${STYLE_GUIDE.noir}

REGRAS DE CONTEÚDO (obrigatórias)
- NUNCA invente fatos verificáveis: anos de experiência, número de clientes, prêmios, certificações, preços, depoimentos, nomes de pessoas, convênios, marcas parceiras, telefone ou endereço.
- Pode descrever, de forma geral e plausível, os serviços típicos do segmento e os benefícios de contratar um profissional local. Use linguagem que o dono possa confirmar ou ajustar.
- Cite o bairro/cidade naturalmente em 2 ou 3 lugares (bom para busca local), sem exagero.
- Títulos curtos e concretos. Nada de clichês vazios ("excelência", "qualidade incomparável", "solução completa").
- Tom caloroso e profissional, frases curtas, voz de quem conhece o segmento.
- Variação ${variation}: ${variation > 0 ? 'escreva com outro ângulo, outra headline e outra organização de serviços em relação a versões anteriores.' : 'primeira versão.'}

ÍCONES PERMITIDOS: ${ICON_IDS.join(', ')}

IMAGENS: dê termos de busca em INGLÊS, concretos e fotográficos, sem texto e sem logos (ex.: "dentist smiling patient clinic", "auto mechanic engine repair garage"). hero = cena principal; about = cena do dia a dia; gallery = 3 cenas diferentes.

Responda SOMENTE com um JSON válido neste formato:
{
 "style": "clean|warm|bold|elegant|fresh|noir",
 "variant": 0 ou 1,
 "eyebrow": "até 5 palavras acima do título (ex.: segmento + bairro)",
 "headline": "título principal, até 12 palavras",
 "subheadline": "1 a 2 frases",
 "primaryCta": "botão principal, até 3 palavras",
 "secondaryCta": "botão secundário, até 3 palavras",
 "aboutTitle": "título da seção sobre",
 "aboutParagraphs": ["parágrafo 1", "parágrafo 2"],
 "services": [{"title": "", "text": "1 frase", "icon": "id"}] (de 4 a 6),
 "highlights": [{"title": "", "text": "1 frase"}] (exatamente 3, diferenciais de atendimento sem números),
 "process": [{"title": "", "text": "1 frase"}] (exatamente 3 passos de como funciona contratar/ser atendido),
 "faq": [{"q": "", "a": "2 frases, sem prometer nada específico"}] (4 itens),
 "ctaTitle": "chamada final",
 "ctaText": "1 frase",
 "imageQueries": {"hero": "", "about": "", "gallery": ["", "", ""]}
}`;
}

export async function generateCopy(
  facts: DemoBusinessFacts, brand: DemoBrand, options: { variation?: number; style?: StyleId | null } = {},
): Promise<DemoCopy> {
  const variation = options.variation || 0;
  const hint = options.style || styleForCategory(facts.category, facts.name);
  const prompt = promptFor(facts, brand, variation, hint);
  const result = await generateText({
    messages: [
      { role: 'system', content: 'Você responde exclusivamente com JSON válido, sem comentários e sem markdown.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.8,
    maxTokens: 2400,
    minLength: 400,
    json: true,
    providers: ['gateway'],
    // Long answer: let a slow model keep working while the next one starts in parallel.
    hedgeMs: 9_000,
    attemptMs: 32_000,
    budgetMs: 46_000,
    validate: (text) => normalizeCopy(extractJson(text), hint) !== null,
    title: 'Scoutly Demo Site',
  });
  const copy = normalizeCopy(extractJson(result.text), hint);
  if (!copy) throw Object.assign(new Error(`Resposta inválida de ${result.model}`), { statusCode: 503, code: 'LLM_UNAVAILABLE' });
  if (options.style) copy.style = options.style;
  return copy;
}

// ---------------------------------------------------------------------------
// Images (Unsplash API). Without UNSPLASH_ACCESS_KEY the page uses art-directed vector visuals.
// Guidelines followed: hotlink the Unsplash CDN urls, credit photographer + Unsplash with
// referral links, and ping the photo's download endpoint when a photo is used.
// ---------------------------------------------------------------------------

const UTM = 'utm_source=scoutly&utm_medium=referral';

async function searchUnsplash(query: string, key: string, perPage = 8): Promise<DemoImage[]> {
  if (!query) return [];
  try {
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&orientation=landscape&content_filter=high&per_page=${perPage}`,
      { headers: { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' }, signal: AbortSignal.timeout(6000) },
    );
    if (!response.ok) return [];
    const data = await response.json();
    return (Array.isArray(data?.results) ? data.results : [])
      .filter((photo: any) => photo?.urls?.raw && photo.width && photo.height)
      .map((photo: any) => ({
        src: String(photo.urls.raw),
        width: Number(photo.width),
        height: Number(photo.height),
        alt: clip(photo.alt_description || photo.description, 140),
        credit: clip(photo.user?.name, 60),
        creditUrl: `${String(photo.user?.links?.html || 'https://unsplash.com')}?${UTM}`,
        downloadLocation: String(photo.links?.download_location || ''),
      }))
      .filter((image: DemoImage) => /^https:\/\/images\.unsplash\.com\//.test(image.src));
  } catch {
    return [];
  }
}

/** Required by the Unsplash API guidelines whenever a photo is actually used. */
function trackDownloads(images: DemoImage[], key: string) {
  for (const image of images) {
    if (!/^https:\/\/api\.unsplash\.com\//.test(image.downloadLocation || '')) continue;
    void fetch(image.downloadLocation as string, { headers: { Authorization: `Client-ID ${key}` }, signal: AbortSignal.timeout(5000) }).catch(() => undefined);
  }
}

export async function fetchImages(copy: DemoCopy, facts: DemoBusinessFacts, variation = 0): Promise<DemoImages> {
  const key = String(process.env.UNSPLASH_ACCESS_KEY || '').trim();
  if (!key) return { hero: null, about: null, gallery: [] };

  const { hero, about, gallery } = copy.imageQueries;
  const fallback = `${facts.category} business`;
  const [heroHits, aboutHits, ...galleryHits] = await Promise.all([
    searchUnsplash(hero || fallback, key),
    searchUnsplash(about || `${facts.category} team working`, key),
    ...[0, 1, 2].map((index) => searchUnsplash(gallery[index] || `${facts.category} ${['detail', 'service', 'customer'][index]}`, key)),
  ]);

  const used = new Set<string>();
  const pick = (hits: DemoImage[]) => {
    const pool = hits.filter((image) => !used.has(image.src));
    if (!pool.length) return null;
    const chosen = pool[variation % pool.length];
    used.add(chosen.src);
    return chosen;
  };
  const heroImage = pick(heroHits);
  const aboutImage = pick(aboutHits);
  const galleryImages = galleryHits.map(pick).filter((image): image is DemoImage => Boolean(image));
  const chosen = [heroImage, aboutImage, ...galleryImages].filter((image): image is DemoImage => Boolean(image));
  trackDownloads(chosen, key);
  // The tracking endpoint is not needed afterwards; keep stored data lean.
  return {
    hero: heroImage ? { ...heroImage, downloadLocation: undefined } : null,
    about: aboutImage ? { ...aboutImage, downloadLocation: undefined } : null,
    gallery: galleryImages.map((image) => ({ ...image, downloadLocation: undefined })),
  };
}
