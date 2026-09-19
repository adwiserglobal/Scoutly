import type { OverturePlace } from './overtureService.js';

export interface OvertureHttpResult {
  places: OverturePlace[];
  cached: boolean;
  durationMs: number;
}

function getInternalBaseUrl(): string {
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}`;

  const appUrl = process.env.APP_URL?.trim();
  if (appUrl) return appUrl.replace(/\/$/, '');

  const port = process.env.PORT || '3000';
  return `http://localhost:${port}`;
}

export async function queryOvertureViaApi(
  west: number,
  south: number,
  east: number,
  north: number,
  limit = 1200,
  zoom?: number,
): Promise<OvertureHttpResult> {
  const safeLimit = Math.max(1, Math.min(Math.floor(limit), 5000));
  const url = new URL('/api/places', getInternalBaseUrl());

  url.searchParams.set('west', String(west));
  url.searchParams.set('south', String(south));
  url.searchParams.set('east', String(east));
  url.searchParams.set('north', String(north));
  url.searchParams.set('limit', String(safeLimit));
  if (Number.isFinite(zoom)) url.searchParams.set('zoom', String(zoom));

  const response = await fetch(url, {
    headers: {
      'x-scoutly-internal-fallback': '1',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Overture service returned HTTP ${response.status}`);
  }

  const data = await response.json();

  return {
    places: Array.isArray(data?.places) ? data.places : [],
    cached: Boolean(data?.cached),
    durationMs: Number(data?.durationMs || 0),
  };
}
