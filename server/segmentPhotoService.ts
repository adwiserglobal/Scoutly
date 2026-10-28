import { appDataRequest, dbValue } from './appDataService.js';

/**
 * One cover photo per business segment (Unsplash). Each segment is looked up on the Unsplash API
 * once, stored in `segment_photos` and reused forever, so the chest never calls the API for a
 * segment it already knows. Without the table (migration 021 not applied yet) the photos are kept
 * in memory per server instance, still at most one API call per segment per instance.
 * Guidelines followed: hotlink the Unsplash CDN, credit photographer + Unsplash, ping the download
 * endpoint when a photo is first used.
 */

export interface SegmentPhoto {
  src: string;
  credit: string;
  creditUrl: string;
}

const UTM = 'utm_source=scoutly&utm_medium=referral';

// Ordered: the first rule that matches the category (or name) decides the segment.
const SEGMENTS: Array<{ key: string; match: RegExp; query: string }> = [
  { key: 'tattoo', match: /tatu|tattoo|piercing/, query: 'tattoo studio' },
  { key: 'barber', match: /barbe|barber/, query: 'barbershop' },
  { key: 'beauty', match: /sal[aã]o|beleza|beauty|hair|cabelei|nail|esmalt|spa\b|est[eé]tic|cosmet|manicure/, query: 'beauty salon' },
  { key: 'dentist', match: /dent|odonto/, query: 'dentist clinic' },
  { key: 'clinic', match: /m[eé]dic|clinic|cl[ií]nic|sa[uú]de|health|hospital|doctor|fisio|physio|psic|therap|terap|laborat/, query: 'medical clinic' },
  { key: 'pharmacy', match: /farm[aá]|pharm|drogaria/, query: 'pharmacy' },
  { key: 'restaurant', match: /restaur|pizza|churrasc|lanchon|hamb|burger|sushi|japon|food|comida|marmit|grill|steak|bistr/, query: 'restaurant interior' },
  { key: 'cafe', match: /caf[eé]|coffee|padaria|bakery|confeit|doceria|sorvet|ice cream|a[cç]a[ií]|dessert|pastelaria/, query: 'coffee shop bakery' },
  { key: 'bar', match: /\bbar\b|pub|boteco|cervej|brewery|nightclub|balada|lounge/, query: 'bar cocktails' },
  { key: 'hotel', match: /hotel|pousada|hostel|lodging|motel|resort/, query: 'hotel lobby' },
  { key: 'gym', match: /academia|gym|fitness|crossfit|pilates|muscula|yoga|esporte|sport/, query: 'gym fitness' },
  { key: 'school', match: /escola|school|colégio|colegio|curso|educa|ensino|idioma|language|universi|creche|faculdade/, query: 'classroom school' },
  { key: 'pet', match: /pet|veterin|animal|cachorro|dog/, query: 'veterinary pet' },
  { key: 'auto', match: /auto|carro|mec[aâ]nic|oficina|repair|veic|pneu|tire|car wash|lava|motor|moto/, query: 'auto repair shop' },
  { key: 'real_estate', match: /imobili|real estate|corretor|im[oó]vel|propert|constru|engenh|arquitet|architect|constructi|obra/, query: 'real estate architecture' },
  { key: 'law', match: /advoc|law|attorney|jur[ií]d|legal|notar|cart[oó]rio/, query: 'law office' },
  { key: 'accounting', match: /contab|account|despach|consult|assessoria|finance|financ|seguro|insurance|bank|banco|escrit[oó]rio|office|coworking/, query: 'office business meeting' },
  { key: 'photo', match: /fot[oó]g|photo|filmag|video|est[uú]dio|studio/, query: 'photography studio' },
  { key: 'store', match: /loja|store|shop|boutique|moda|fashion|roupa|cloth|var[eé]jo|retail|mercado|market|supermerc|grocery|presente|gift|joalh|jewel|[oó]tica|optic/, query: 'boutique store interior' },
  { key: 'home', match: /m[oó]vel|furniture|decora|casa|home|jardim|garden|limpeza|clean|reforma|pintur|marcen|eletric|encanad|plumb/, query: 'home improvement' },
  { key: 'tech', match: /tecnolog|software|inform[aá]t|computer|tech|ti\b|celular|phone|eletr[oô]n|ag[eê]ncia|marketing|agency|publicid/, query: 'technology workspace' },
  { key: 'logistics', match: /transport|log[ií]st|entrega|delivery|frete|courier|armaz|warehouse/, query: 'logistics warehouse' },
];

export function segmentFor(category: unknown, name?: unknown): { key: string; query: string } {
  const text = `${category || ''} ${name || ''}`.toLowerCase();
  const found = SEGMENTS.find((segment) => segment.match.test(text));
  return found ? { key: found.key, query: found.query } : { key: 'business', query: 'small business storefront' };
}

const memory = new Map<string, SegmentPhoto | null>();
let tableMissing = false;

async function readStored(keys: string[]): Promise<Map<string, SegmentPhoto>> {
  const found = new Map<string, SegmentPhoto>();
  if (!keys.length || tableMissing) return found;
  try {
    const rows = await appDataRequest<Array<{ segment: string; src: string; credit: string | null; credit_url: string | null }>>(
      `segment_photos?segment=in.(${keys.map((key) => dbValue(key)).join(',')})&select=segment,src,credit,credit_url`,
    );
    for (const row of rows) found.set(row.segment, { src: row.src, credit: row.credit || '', creditUrl: row.credit_url || `https://unsplash.com?${UTM}` });
  } catch (error: any) {
    if (/segment_photos|PGRST205|42P01/i.test(String(error?.message || ''))) tableMissing = true;
    else console.warn('[SegmentPhotos] read failed:', error?.message || error);
  }
  return found;
}

async function fetchFromUnsplash(query: string): Promise<{ photo: SegmentPhoto; width: number; height: number } | null> {
  const accessKey = String(process.env.UNSPLASH_ACCESS_KEY || '').trim();
  if (!accessKey) return null;
  try {
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&orientation=landscape&content_filter=high&per_page=3`,
      { headers: { Authorization: `Client-ID ${accessKey}`, 'Accept-Version': 'v1' }, signal: AbortSignal.timeout(6000) },
    );
    if (!response.ok) return null;
    const data = await response.json();
    const hit = (Array.isArray(data?.results) ? data.results : []).find(
      (item: any) => /^https:\/\/images\.unsplash\.com\//.test(String(item?.urls?.raw || '')),
    );
    if (!hit) return null;
    const download = String(hit.links?.download_location || '');
    if (/^https:\/\/api\.unsplash\.com\//.test(download)) {
      void fetch(download, { headers: { Authorization: `Client-ID ${accessKey}` }, signal: AbortSignal.timeout(5000) }).catch(() => undefined);
    }
    return {
      photo: {
        src: String(hit.urls.raw),
        credit: String(hit.user?.name || '').slice(0, 60),
        creditUrl: `${String(hit.user?.links?.html || 'https://unsplash.com')}?${UTM}`,
      },
      width: Number(hit.width) || 0,
      height: Number(hit.height) || 0,
    };
  } catch (error: any) {
    console.warn('[SegmentPhotos] Unsplash failed:', error?.message || error);
    return null;
  }
}

/** Photos for the given segments, fetching (once) and storing the ones not known yet. */
export async function getSegmentPhotos(segments: Array<{ key: string; query: string }>): Promise<Record<string, SegmentPhoto>> {
  const unique = new Map(segments.map((segment) => [segment.key, segment]));
  const result: Record<string, SegmentPhoto> = {};

  const unknown: string[] = [];
  for (const key of unique.keys()) {
    const cached = memory.get(key);
    if (cached) result[key] = cached;
    else if (cached === undefined) unknown.push(key);
  }

  const stored = await readStored(unknown);
  for (const [key, photo] of stored) {
    memory.set(key, photo);
    result[key] = photo;
  }

  const missing = unknown.filter((key) => !stored.has(key)).slice(0, 6);
  await Promise.all(missing.map(async (key) => {
    const fetched = await fetchFromUnsplash(unique.get(key)!.query);
    if (!fetched) return; // not cached as "none": the next open tries again
    memory.set(key, fetched.photo);
    result[key] = fetched.photo;
    if (tableMissing) return;
    try {
      await appDataRequest('segment_photos?on_conflict=segment', {
        method: 'POST',
        headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify({
          segment: key, src: fetched.photo.src, width: fetched.width, height: fetched.height,
          credit: fetched.photo.credit, credit_url: fetched.photo.creditUrl,
        }),
      });
    } catch (error: any) {
      if (/segment_photos|PGRST205|42P01/i.test(String(error?.message || ''))) tableMissing = true;
    }
  }));

  return result;
}
