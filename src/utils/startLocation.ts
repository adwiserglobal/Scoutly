/**
 * Where the map opens: the user's own location when allowed, otherwise the center of their
 * city (approximate IP lookup), otherwise the center of São Paulo. The last known place is
 * remembered so the next visit opens there instantly.
 */
export interface StartLocation {
  lat: number;
  lng: number;
  name: string;
  source: 'gps' | 'ip' | 'saved' | 'default';
}

const STORAGE_KEY = 'scoutly-start-location';

export const DEFAULT_START: StartLocation = {
  lat: -23.5505,
  lng: -46.6333,
  name: 'São Paulo - Centro',
  source: 'default',
};

export function loadSavedStartLocation(): StartLocation | null {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (raw && Number.isFinite(raw.lat) && Number.isFinite(raw.lng) && typeof raw.name === 'string') {
      return { lat: raw.lat, lng: raw.lng, name: raw.name, source: 'saved' };
    }
  } catch { /* ignore */ }
  return null;
}

function saveStartLocation(location: StartLocation) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ lat: location.lat, lng: location.lng, name: location.name }));
  } catch { /* ignore */ }
}

function getGps(timeoutMs: number): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => resolve(null),
      { timeout: timeoutMs, maximumAge: 10 * 60 * 1000, enableHighAccuracy: false },
    );
  });
}

async function getCityByIp(): Promise<StartLocation | null> {
  try {
    const response = await fetch('https://ipwho.is/?fields=success,latitude,longitude,city,region_code,country_code', {
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data?.success || !Number.isFinite(data.latitude) || !Number.isFinite(data.longitude)) return null;
    const name = [data.city, data.region_code].filter(Boolean).join(' - ') || 'Sua cidade';
    return { lat: data.latitude, lng: data.longitude, name, source: 'ip' };
  } catch {
    return null;
  }
}

export async function resolveStartLocation(): Promise<StartLocation> {
  const gps = await getGps(8000);
  if (gps) {
    const location: StartLocation = { ...gps, name: 'Sua Localização Atual', source: 'gps' };
    saveStartLocation(location);
    return location;
  }
  const byIp = await getCityByIp();
  if (byIp) {
    saveStartLocation(byIp);
    return byIp;
  }
  return loadSavedStartLocation() || DEFAULT_START;
}
