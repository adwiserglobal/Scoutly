export interface GeocodedLocation {
  name: string;
  lat: number;
  lng: number;
}

export const PRESET_REGIONS: GeocodedLocation[] = [
  { name: 'São Paulo - Pinheiros', lat: -23.5658, lng: -46.6872 },
  { name: 'São Paulo - Itaim Bibi', lat: -23.5847, lng: -46.6778 },
  { name: 'Rio de Janeiro - Barra da Tijuca', lat: -23.0003, lng: -43.3659 },
  { name: 'Belo Horizonte - Savassi', lat: -19.9388, lng: -43.9329 },
  { name: 'Curitiba - Batel', lat: -25.4428, lng: -49.2887 },
  { name: 'Porto Alegre - Moinhos de Vento', lat: -30.0277, lng: -51.2005 },
];

export async function searchAddressOrCity(query: string): Promise<GeocodedLocation | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  // Check preset first
  const matchedPreset = PRESET_REGIONS.find((p) =>
    p.name.toLowerCase().includes(trimmed.toLowerCase())
  );
  if (matchedPreset) return matchedPreset;

  try {
    const encoded = encodeURIComponent(trimmed);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&countrycodes=br&limit=1`;
    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.length > 0) {
      return {
        name: data[0].display_name.split(',').slice(0, 2).join(','),
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      };
    }
  } catch (err) {
    console.warn('Falha na geocodificação externa:', err);
  }

  return null;
}
