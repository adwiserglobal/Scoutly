import { Business, MapBounds } from '../types';
import { fetchPlacesFromOverture } from './api';
import { getBoundsForRadius } from '../utils/geoUtils';

const CACHE_TTL_MS = 15 * 60 * 1000;
type Coverage = { bounds: MapBounds; limit: number; complete: boolean; timestamp: number };
type PlacesListener = (allPlaces: Business[], fromCache: boolean) => void;

export class MapCacheService {
  private placesMap = new Map<string, Business>();
  private coverage: Coverage[] = [];
  private inFlightController: AbortController | null = null;
  private pinInFlightController: AbortController | null = null;

  constructor(private fetchPlaces = fetchPlacesFromOverture) {}

  public isBoundsCovered(bounds: MapBounds, limit = 2500): boolean {
    return this.coverage.some((entry) => {
      if (Date.now() - entry.timestamp >= CACHE_TTL_MS) return false;
      const b = entry.bounds;
      // A capped result only covers the exact query, never neighboring areas.
      const exact = b.west === bounds.west && b.east === bounds.east &&
        b.south === bounds.south && b.north === bounds.north;
      return (exact && entry.limit >= limit) || (entry.complete &&
        b.west <= bounds.west && b.east >= bounds.east &&
        b.south <= bounds.south && b.north >= bounds.north);
    });
  }

  public getPlacesInBounds(bounds: MapBounds): Business[] {
    return this.getAllPlaces().filter(({ coordinates: { lat, lng } }) =>
      lat >= bounds.south && lat <= bounds.north && lng >= bounds.west && lng <= bounds.east);
  }

  public getAllPlaces(): Business[] {
    return Array.from(this.placesMap.values());
  }

  public addPlaces(places: Business[]): void {
    for (const p of places) {
      const existing = this.placesMap.get(p.id);
      this.placesMap.set(p.id, existing ? {
        ...p,
        leadStatus: existing.leadStatus ?? p.leadStatus,
        isFavorite: existing.isFavorite ?? p.isFavorite,
        notes: existing.notes ?? p.notes,
      } : p);
    }
    if (this.placesMap.size > 30000) {
      for (const key of Array.from(this.placesMap.keys()).slice(0, this.placesMap.size - 25000)) {
        this.placesMap.delete(key);
      }
      // Evicted points must be fetchable again.
      this.coverage = [];
    }
  }

  public cancelOngoingRequests(): void {
    this.inFlightController?.abort();
    this.inFlightController = null;
  }

  public cancelPinRequest(): void {
    this.pinInFlightController?.abort();
    this.pinInFlightController = null;
  }

  private async load(
    bounds: MapBounds, limit: number, zoom: number,
    onPlacesUpdated: PlacesListener, kind: 'viewport' | 'pin'
  ): Promise<void> {
    const field = kind === 'pin' ? 'pinInFlightController' : 'inFlightController';
    this[field]?.abort();
    const controller = new AbortController();
    this[field] = controller;
    try {
      if (this.isBoundsCovered(bounds, limit)) {
        onPlacesUpdated(this.getAllPlaces(), true);
        return;
      }
      // Keep known points visible while the new area loads.
      if (this.placesMap.size) onPlacesUpdated(this.getAllPlaces(), true);
      const { places, cached } = await this.fetchPlaces(
        bounds.west, bounds.south, bounds.east, bounds.north, limit, controller.signal, zoom
      );
      if (controller.signal.aborted) return;
      this.addPlaces(places);
      this.coverage = this.coverage.filter((entry) => Date.now() - entry.timestamp < CACHE_TTL_MS).slice(-199);
      this.coverage.push({ bounds: { ...bounds }, limit, complete: places.length < limit, timestamp: Date.now() });
      onPlacesUpdated(this.getAllPlaces(), cached);
    } catch (err) {
      if (!controller.signal.aborted) throw err;
    } finally {
      // An older request must never clear the newer request's controller.
      if (this[field] === controller) this[field] = null;
    }
  }

  public loadViewport(bounds: MapBounds, zoom: number, onPlacesUpdated: PlacesListener): Promise<void> {
    return this.load(bounds, zoom >= 14 ? 2500 : 1500, zoom, onPlacesUpdated, 'viewport');
  }

  public fetchPinRadius(lat: number, lng: number, radiusMeters: number, onPlacesUpdated: PlacesListener): Promise<void> {
    return this.load(getBoundsForRadius(lat, lng, radiusMeters), 3000, 15, onPlacesUpdated, 'pin');
  }

  public clear(): void {
    this.cancelOngoingRequests();
    this.cancelPinRequest();
    this.placesMap.clear();
    this.coverage = [];
  }
}

export const mapCacheService = new MapCacheService();
