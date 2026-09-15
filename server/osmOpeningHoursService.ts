import openingHours from 'opening_hours';

export interface OpenStatusResult {
  openStatus: 'ABERTO_AGORA' | 'FECHADO_AGORA' | 'DESCONHECIDO';
  openStatusText: string;
  openingHoursRaw?: string | null;
  source?: 'osm' | 'schema_jsonld' | 'unknown';
}

interface OsmNode {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: {
    name?: string;
    opening_hours?: string;
    [key: string]: string | undefined;
  };
}

// Distance calculation between 2 lat/lng points in meters
function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Normalize strings for matching
function normalizeName(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\b(restaurante|bar|loja|clinica|despachante|oficina|estudio|empresa|ltda|me|eireli)\b/g, '')
    .trim();
}

// Calculate similarity ratio between 2 string names (0 to 1)
function calculateNameSimilarity(name1: string, name2: string): number {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);

  if (!n1 || !n2) return 0;
  if (n1 === n2) return 1.0;
  if (n1.includes(n2) || n2.includes(n1)) return 0.85;

  const words1 = n1.split(/\s+/).filter((w) => w.length > 2);
  const words2 = n2.split(/\s+/).filter((w) => w.length > 2);

  if (words1.length === 0 || words2.length === 0) return 0;

  let matches = 0;
  for (const w1 of words1) {
    if (words2.some((w2) => w2.includes(w1) || w1.includes(w2))) {
      matches++;
    }
  }

  return (2 * matches) / (words1.length + words2.length);
}

/**
 * Fetches OSM nodes/ways with opening_hours tag in a bounding box via Overpass API
 */
export async function fetchOsmOpeningHoursInBBox(
  west: number,
  south: number,
  east: number,
  north: number
): Promise<OsmNode[]> {
  try {
    const query = `[out:json][timeout:3];(node["opening_hours"](${south},${west},${north},${east});way["opening_hours"](${south},${west},${north},${east}););out center;`;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'ScoutlyB2BRadar/1.5',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return [];
    }

    const json = await res.json();
    return json.elements || [];
  } catch (err) {
    console.warn('[OSM OpeningHours Fetch Warning]:', (err as any)?.message || err);
    return [];
  }
}

/**
 * Evaluate string opening_hours using `opening_hours` library
 */
export function evaluateOpeningHours(
  openingHoursStr: string | null | undefined,
  lat: number,
  lng: number,
  targetDate: Date = new Date()
): OpenStatusResult {
  if (!openingHoursStr || typeof openingHoursStr !== 'string' || !openingHoursStr.trim()) {
    return {
      openStatus: 'DESCONHECIDO',
      openStatusText: 'Horário não identificado',
      openingHoursRaw: null,
      source: 'unknown',
    };
  }

  const rawStr = openingHoursStr.trim();

  // Quick 24/7 check
  if (rawStr.toLowerCase() === '24/7' || rawStr.toLowerCase() === '24/7 open') {
    return {
      openStatus: 'ABERTO_AGORA',
      openStatusText: 'Aberto agora (24h)',
      openingHoursRaw: rawStr,
      source: 'osm',
    };
  }

  try {
    // Instantiate opening_hours constructor
    // Note: opening_hours constructor accepts (string, optional location object/options, optional flags)
    const ohConstructor: any = typeof openingHours === 'function' ? openingHours : (openingHours as any).default || openingHours;
    const oh = new ohConstructor(rawStr, {
      lat: lat,
      lon: lng,
      address: {
        country_code: 'br',
      },
    });

    const isOpen = oh.getState(targetDate);
    const nextChange = oh.getNextChange(targetDate);

    if (isOpen) {
      let changeText = '';
      if (nextChange) {
        const isSameDay = nextChange.getDate() === targetDate.getDate();
        const hours = String(nextChange.getHours()).padStart(2, '0');
        const mins = String(nextChange.getMinutes()).padStart(2, '0');
        if (isSameDay) {
          changeText = ` • Fecha às ${hours}:${mins}`;
        } else {
          changeText = ` • Fecha às ${hours}:${mins} (amanhã)`;
        }
      }

      return {
        openStatus: 'ABERTO_AGORA',
        openStatusText: `Aberto agora${changeText}`,
        openingHoursRaw: rawStr,
        source: 'osm',
      };
    } else {
      let changeText = '';
      if (nextChange) {
        const isSameDay = nextChange.getDate() === targetDate.getDate();
        const hours = String(nextChange.getHours()).padStart(2, '0');
        const mins = String(nextChange.getMinutes()).padStart(2, '0');
        if (isSameDay) {
          changeText = ` • Abre às ${hours}:${mins}`;
        } else {
          changeText = ` • Abre amanhã às ${hours}:${mins}`;
        }
      }

      return {
        openStatus: 'FECHADO_AGORA',
        openStatusText: `Fechado agora${changeText}`,
        openingHoursRaw: rawStr,
        source: 'osm',
      };
    }
  } catch (err) {
    // If parsing fails due to non-standard OSM format string, perform simple regex fallback evaluation
    return evaluateOpeningHoursRegexFallback(rawStr, targetDate);
  }
}

/**
 * Regex fallback for simple formats like "Mo-Fr 08:00-18:00"
 */
function evaluateOpeningHoursRegexFallback(
  rawStr: string,
  targetDate: Date
): OpenStatusResult {
  const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const currentDay = dayNames[targetDate.getDay()];
  const currentHourMins = targetDate.getHours() * 60 + targetDate.getMinutes();

  // Try matching simple HH:MM-HH:MM pattern
  const timeMatch = rawStr.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    const startMins = parseInt(timeMatch[1], 10) * 60 + parseInt(timeMatch[2], 10);
    const endMins = parseInt(timeMatch[3], 10) * 60 + parseInt(timeMatch[4], 10);

    if (currentHourMins >= startMins && currentHourMins <= endMins) {
      const endH = String(Math.floor(endMins / 60)).padStart(2, '0');
      const endM = String(endMins % 60).padStart(2, '0');
      return {
        openStatus: 'ABERTO_AGORA',
        openStatusText: `Aberto agora • Fecha às ${endH}:${endM}`,
        openingHoursRaw: rawStr,
        source: 'osm',
      };
    } else {
      const startH = String(Math.floor(startMins / 60)).padStart(2, '0');
      const startM = String(startMins % 60).padStart(2, '0');
      return {
        openStatus: 'FECHADO_AGORA',
        openStatusText: `Fechado agora • Abre às ${startH}:${startM}`,
        openingHoursRaw: rawStr,
        source: 'osm',
      };
    }
  }

  return {
    openStatus: 'DESCONHECIDO',
    openStatusText: 'Horário não identificado',
    openingHoursRaw: rawStr,
    source: 'unknown',
  };
}

/**
 * Matches Overture places list with OSM opening_hours nodes/ways
 */
export function matchOverturePlacesWithOsmHours<T extends { id: string; name: string; latitude: number; longitude: number }>(
  overturePlaces: T[],
  osmElements: OsmNode[]
): Map<string, OpenStatusResult> {
  const resultMap = new Map<string, OpenStatusResult>();

  if (!osmElements || osmElements.length === 0 || !overturePlaces || overturePlaces.length === 0) {
    return resultMap;
  }

  for (const place of overturePlaces) {
    let bestMatch: OsmNode | null = null;
    let highestScore = 0;

    for (const osmEl of osmElements) {
      const openingHoursTag = osmEl.tags?.opening_hours;
      if (!openingHoursTag) continue;

      const osmLat = osmEl.lat ?? osmEl.center?.lat;
      const osmLon = osmEl.lon ?? osmEl.center?.lon;

      if (osmLat === undefined || osmLon === undefined) continue;

      const dist = haversineDistanceMeters(place.latitude, place.longitude, osmLat, osmLon);

      // Only consider OSM items within 200 meters
      if (dist > 200) continue;

      const osmName = osmEl.tags?.name || '';
      const nameSim = calculateNameSimilarity(place.name, osmName);

      // Score formula: balance distance & name similarity
      let score = 0;
      if (nameSim >= 0.5) {
        score = nameSim * 0.7 + (1 - dist / 200) * 0.3;
      } else if (dist <= 30) {
        score = 0.6 + (1 - dist / 30) * 0.4;
      }

      if (score > 0.45 && score > highestScore) {
        highestScore = score;
        bestMatch = osmEl;
      }
    }

    if (bestMatch && bestMatch.tags?.opening_hours) {
      const evalResult = evaluateOpeningHours(
        bestMatch.tags.opening_hours,
        place.latitude,
        place.longitude
      );
      resultMap.set(place.id, evalResult);
    }
  }

  return resultMap;
}

/**
 * Helper for extracting Schema.org / JSON-LD openingHours from HTML (Prepared for future fallback)
 */
export function parseSchemaJsonLdOpeningHours(html: string): string | null {
  try {
    const jsonLdRegex = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match: RegExpExecArray | null;

    while ((match = jsonLdRegex.exec(html)) !== null) {
      if (match[1]) {
        try {
          const parsed = JSON.parse(match[1]);
          const items = Array.isArray(parsed) ? parsed : [parsed];
          for (const item of items) {
            if (item.openingHours) {
              return Array.isArray(item.openingHours) ? item.openingHours.join('; ') : String(item.openingHours);
            }
            if (item.openingHoursSpecification) {
              const specs = Array.isArray(item.openingHoursSpecification)
                ? item.openingHoursSpecification
                : [item.openingHoursSpecification];
              const formatted = specs
                .map((s: any) => `${s.dayOfWeek || ''} ${s.opens || ''}-${s.closes || ''}`)
                .join('; ');
              if (formatted.trim()) return formatted;
            }
          }
        } catch {
          // Ignore JSON parse errors in individual tags
        }
      }
    }
  } catch {
    // Ignore regex errors
  }
  return null;
}
