import { Business, MapBounds } from '../types';
import { fetchPlacesFromOverture } from './api';

export function lon2tile(lon: number, zoom: number = 13): number {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

export function lat2tile(lat: number, zoom: number = 13): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom)
  );
}

export function getTilesForBounds(bounds: MapBounds, zoom: number = 13): string[] {
  const minTileX = lon2tile(bounds.west, zoom);
  const maxTileX = lon2tile(bounds.east, zoom);
  const minTileY = lat2tile(bounds.north, zoom);
  const maxTileY = lat2tile(bounds.south, zoom);
  const startX = Math.min(minTileX, maxTileX);
  const endX = Math.max(minTileX, maxTileX);
  const startY = Math.min(minTileY, maxTileY);
  const endY = Math.max(minTileY, maxTileY);
  const tiles: string[] = [];
  for (let x = startX; x <= endX; x++) {
    for (let y = startY; y <= endY; y++) tiles.push(`${zoom}/${x}/${y}`);
  }
  return tiles;
}

class MapCacheService {
  private placesMap: Map<string, Business> = new Map();
  private loadedTiles: Set<string> = new Set();
  private inFlightController: AbortController | null = null;
  private pinInFlightController: AbortController | null = null;
  private prefetchController: AbortController | null = null;
  private prefetchTimer: any = null;
  private targetedSearchResults: Business[] | null = null;
  private targetedSearchQuery: string | null = null;

  public setTargetedSearchResults(places: Business[], query?: string): void {
    this.cancelOngoingRequests();
    this.targetedSearchResults = places;
    this.targetedSearchQuery = query || null;
  }

  public clearTargetedSearch(): void {
    this.targetedSearchResults = null;
    this.targetedSearchQuery = null;
  }

  public isTargetedSearchActive(): boolean {
    return this.targetedSearchResults !== null;
  }

  public isBoundsCovered(bounds: MapBounds, zoom: number = 13): boolean {
    const tiles = getTilesForBounds(bounds, zoom);
    return tiles.length > 0 && tiles.every((tile) => this.loadedTiles.has(tile));
  }

  public getPlacesInBounds(bounds: MapBounds): Business[] {
    const result: Business[] = [];
    for (const business of this.placesMap.values()) {
      const lat = Number(business.coordinates?.lat ?? business.latitude);
      const lng = Number(business.coordinates?.lng ?? business.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      if (lat >= bounds.south && lat <= bounds.north && lng >= bounds.west && lng <= bounds.east) {
        result.push(business);
      }
    }
    return result;
  }

  public getAllPlaces(): Business[] {
    return Array.from(this.placesMap.values());
  }

  public addPlaces(places: Business[], tileKeys?: string[]): void {
    for (const place of places) {
      const existing = this.placesMap.get(place.id);
      this.placesMap.set(place.id, existing ? {
        ...place,
        leadStatus: existing.leadStatus || place.leadStatus,
        isFavorite: existing.isFavorite ?? place.isFavorite,
        notes: existing.notes || place.notes,
      } : place);
    }
    if (tileKeys) for (const tile of tileKeys) this.loadedTiles.add(tile);
    if (this.placesMap.size > 30000) {
      for (const key of Array.from(this.placesMap.keys()).slice(0, 5000)) this.placesMap.delete(key);
    }
  }

  public async fetchPinRadius(
    lat: number,
    lng: number,
    radiusMeters: number,
    onPlacesUpdated: (allPlaces: Business[], fromCache: boolean) => void
  ): Promise<void> {
    if (this.pinInFlightController) this.pinInFlightController.abort();
    this.pinInFlightController = new AbortController();
    const signal = this.pinInFlightController.signal;
    const deltaLat = radiusMeters / 110540;
    const deltaLng = radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180));
    const bounds: MapBounds = {
      north: lat + deltaLat * 1.2,
      south: lat - deltaLat * 1.2,
      east: lng + deltaLng * 1.2,
      west: lng - deltaLng * 1.2,
    };
    const requiredTiles = getTilesForBounds(bounds, 14);

    try {
      const { places, cached, durationMs } = await fetchPlacesFromOverture(
        bounds.west, bounds.south, bounds.east, bounds.north, 3000, signal, 15
      );
      this.addPlaces(places, requiredTiles);
      if (import.meta.env.DEV) {
        console.log(`[Scoutly Pin Radar] ${places.length} places in ${durationMs}ms`);
      }
      onPlacesUpdated(this.getPlacesInBounds(bounds), cached);
      this.pinInFlightController = null;
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      this.pinInFlightController = null;
      throw err;
    }
  }

  public cancelOngoingRequests(): void {
    if (this.inFlightController) {
      this.inFlightController.abort();
      this.inFlightController = null;
    }
    if (this.prefetchController) {
      this.prefetchController.abort();
      this.prefetchController = null;
    }
    if (this.prefetchTimer) {
      clearTimeout(this.prefetchTimer);
      this.prefetchTimer = null;
    }
  }

  public async loadViewport(
    bounds: MapBounds,
    zoom: number,
    onPlacesUpdated: (allPlaces: Business[], fromCache: boolean) => void
  ): Promise<void> {
    if (this.targetedSearchResults !== null) {
      const visibleTargeted = this.targetedSearchResults.filter((business) => {
        const lat = Number(business.coordinates?.lat ?? business.latitude);
        const lng = Number(business.coordinates?.lng ?? business.longitude);
        return Number.isFinite(lat) && Number.isFinite(lng) &&
          lat >= bounds.south && lat <= bounds.north && lng >= bounds.west && lng <= bounds.east;
      });
      onPlacesUpdated(visibleTargeted, true);
      return;
    }

    const t0 = performance.now();
    const requiredTiles = getTilesForBounds(bounds, 13);
    const visibleCachedPlaces = this.getPlacesInBounds(bounds);
    const isCovered = requiredTiles.length > 0 && requiredTiles.every((tile) => this.loadedTiles.has(tile));

    // Immediately scope the UI to the new viewport. When crossing cities this
    // intentionally sends [] until the new fetch returns, preventing old São
    // Paulo businesses from remaining visible under another city's map.
    onPlacesUpdated(visibleCachedPlaces, true);

    if (isCovered && visibleCachedPlaces.length > 0) {
      if (import.meta.env.DEV) {
        console.log(`[Scoutly Map Perf] Memory Cache HIT in ${(performance.now() - t0).toFixed(1)}ms | Visible: ${visibleCachedPlaces.length}`);
      }
      this.scheduleSilentPrefetch(bounds, zoom);
      return;
    }

    if (this.inFlightController) this.inFlightController.abort();
    this.inFlightController = new AbortController();
    const signal = this.inFlightController.signal;

    try {
      const queryLimit = zoom >= 14 ? 2500 : 1500;
      const { places, cached, durationMs } = await fetchPlacesFromOverture(
        bounds.west, bounds.south, bounds.east, bounds.north, queryLimit, signal, zoom
      );
      this.addPlaces(places, requiredTiles);
      const visiblePlaces = this.getPlacesInBounds(bounds);
      if (import.meta.env.DEV) {
        console.log(`[Scoutly Map Perf] API: ${places.length} | Visible: ${visiblePlaces.length} | ${durationMs}ms`);
      }
      onPlacesUpdated(visiblePlaces, cached);
      this.inFlightController = null;
      this.scheduleSilentPrefetch(bounds, zoom);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      this.inFlightController = null;
      throw err;
    }
  }

  public scheduleSilentPrefetch(bounds: MapBounds, zoom: number): void {
    if (this.prefetchTimer) clearTimeout(this.prefetchTimer);
    if (this.prefetchController) {
      this.prefetchController.abort();
      this.prefetchController = null;
    }

    this.prefetchTimer = setTimeout(async () => {
      const dx = Math.max((bounds.east - bounds.west) * 0.3, 0.02);
      const dy = Math.max((bounds.north - bounds.south) * 0.3, 0.02);
      const expandedBounds: MapBounds = {
        west: bounds.west - dx,
        south: bounds.south - dy,
        east: bounds.east + dx,
        north: bounds.north + dy,
      };
      const surroundingTiles = getTilesForBounds(expandedBounds, 13);
      const missingTiles = surroundingTiles.filter((tile) => !this.loadedTiles.has(tile));
      if (missingTiles.length === 0) return;

      this.prefetchController = new AbortController();
      try {
        const { places } = await fetchPlacesFromOverture(
          expandedBounds.west,
          expandedBounds.south,
          expandedBounds.east,
          expandedBounds.north,
          1500,
          this.prefetchController.signal,
          zoom
        );
        if (places.length > 0) this.addPlaces(places, surroundingTiles);
      } catch {
        // Prefetch is intentionally best-effort.
      } finally {
        this.prefetchController = null;
      }
    }, 350);
  }

  public clear(): void {
    this.cancelOngoingRequests();
    this.clearTargetedSearch();
    this.placesMap.clear();
    this.loadedTiles.clear();
  }
}

export const mapCacheService = new MapCacheService();
