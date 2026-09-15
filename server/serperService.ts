import { BusinessSummary } from './aiService';

export interface SerperPlace {
  title: string;
  address?: string;
  phoneNumber?: string;
  website?: string;
  rating?: number;
  latitude?: number;
  longitude?: number;
  category?: string;
}

export interface SerperOrganic {
  title: string;
  link: string;
  snippet?: string;
}

export interface SerperResponse {
  places?: SerperPlace[];
  organic?: SerperOrganic[];
}

export async function fetchBusinessesFromSerper(
  query: string,
  centerLat?: number,
  centerLng?: number
): Promise<BusinessSummary[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    console.warn('[Serper API] SERPER_API_KEY is not configured');
    return [];
  }

  try {
    console.log(`[Serper API] Fetching Google Search results for: "${query}"...`);
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        gl: 'br',
        hl: 'pt-br',
        num: 20,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[Serper API Error] Status ${response.status}: ${errText}`);
      return [];
    }

    const data: SerperResponse = await response.json();
    const businesses: BusinessSummary[] = [];
    const seenNames = new Set<string>();

    // 1. Process Serper Places (Google Maps local results)
    if (Array.isArray(data.places)) {
      for (const p of data.places) {
        if (!p.title) continue;
        const normalizedName = p.title.toLowerCase().trim();
        if (seenNames.has(normalizedName)) continue;
        seenNames.add(normalizedName);

        const lat = p.latitude || centerLat || -23.5505;
        const lng = p.longitude || centerLng || -46.6333;

        businesses.push({
          id: `serper_place_${Math.random().toString(36).substring(2, 9)}`,
          name: p.title,
          category: p.category || 'Empresa Local',
          basicCategory: 'business_service',
          address: p.address || query,
          lat,
          lng,
          coordinates: { lat, lng },
          website: p.website || null,
          phone: p.phoneNumber || null,
          phones: p.phoneNumber ? [p.phoneNumber] : [],
          emails: [],
          socials: [],
          leadStatus: 'NOVO',
          confidence: 0.92,
          notes: `Encontrado via Serper Google Maps (${p.rating ? `Nota: ${p.rating}` : ''})`,
          sources: ['serper'],
          hasCoordinates: Boolean(p.latitude && p.longitude),
        });
      }
    }

    // 2. Process Serper Organic Results if we need more or extract business leads
    if (Array.isArray(data.organic) && businesses.length < 15) {
      for (const org of data.organic) {
        if (!org.title || !org.link) continue;
        if (/wikipedia|facebook|instagram|linkedin|yelp|tripadvisor|jusbrasil/i.test(org.link)) {
          continue;
        }

        const titleClean = org.title.split(/[-–|]/)[0].trim();
        if (!titleClean || seenNames.has(titleClean.toLowerCase())) continue;
        seenNames.add(titleClean.toLowerCase());

        const lat = centerLat || -23.5505;
        const lng = centerLng || -46.6333;

        businesses.push({
          id: `serper_org_${Math.random().toString(36).substring(2, 9)}`,
          name: titleClean,
          category: 'Empresa / Prestador de Serviço',
          basicCategory: 'business_service',
          address: query,
          lat,
          lng,
          coordinates: { lat, lng },
          website: org.link,
          phone: null,
          phones: [],
          emails: [],
          socials: [],
          leadStatus: 'NOVO',
          confidence: 0.80,
          notes: `Snippet: ${org.snippet || org.title}`,
          sources: ['serper'],
          hasCoordinates: false,
        });
      }
    }

    console.log(`[Serper API] Successfully fetched ${businesses.length} businesses for query "${query}"`);
    return businesses;
  } catch (err: any) {
    console.error('[Serper API Exception]:', err.message || err);
    return [];
  }
}
