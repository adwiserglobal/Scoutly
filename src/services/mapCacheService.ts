import { Business, MapBounds } from '../types';
import { fetchPlacesFromOverture } from './api';

export function lon2tile(lon: number, zoom: number = 13): number {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

export function lat2tile(lat: number, zoom: number = 13): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
      Math.pow(2, zoom)
  );
}

export function getTilesForBounds(
  bounds: MapBounds,
  zoom: number = 13
): string[] {
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
    for (let y = startY; y <= endY; y++) {
      tiles.push(`${zoom}/${x}/${y}`);
    }
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

  /**
   * Check if all tiles covering the specified bounds have already been loaded
   */
  public isBoundsCovered(bounds: MapBounds, zoom: number = 13): boolean {
    const tiles = getTilesForBounds(bounds, zoom);
    if (tiles.length === 0) return false;
    return tiles.every((tile) => this.loadedTiles.has(tile));
  }

  /**
   * Retrieve all cached places that fall within the specified bounds
   */
  public getPlacesInBounds(bounds: MapBounds): Business[] {
    const result: Business[] = [];
    for (const b of this.placesMap.values()) {
      const lat = b.coordinates.lat;
      const lng = b.coordinates.lng;
      if (
        lat >= bounds.south &&
        lat <= bounds.north &&
        lng >= bounds.west &&
        lng <= bounds.east
      ) {
        result.push(b);
      }
    }
    return result;
  }

  /**
   * Retrieve all cached places currently stored in memory
   */
  public getAllPlaces(): Business[] {
    return Array.from(this.placesMap.values());
  }

  /**
   * Add places and optionally mark tiles as loaded
   */
  public addPlaces(places: Business[], tileKeys?: string[]): void {
    for (const p of places) {
      if (!this.placesMap.has(p.id)) {
        this.placesMap.set(p.id, p);
      } else {
        // Keep existing user modifications (leadStatus, notes, etc.)
        const existing = this.placesMap.get(p.id)!;
        this.placesMap.set(p.id, {
          ...p,
          leadStatus: existing.leadStatus || p.leadStatus,
          isFavorite: existing.isFavorite ?? p.isFavorite,
          notes: existing.notes || p.notes,
        });
      }
    }

    if (tileKeys) {
      for (const t of tileKeys) {
        this.loadedTiles.add(t);
      }
    }

    // Memory guard: if memory contains over 30,000 places, prune oldest
    if (this.placesMap.size > 30000) {
      const keysToDelete = Array.from(this.placesMap.keys()).slice(0, 5000);
      for (const k of keysToDelete) {
        this.placesMap.delete(k);
      }
    }
  }

  /**
   * Dedicated Pin Radar Search - Does NOT get aborted by casual viewport panning
   */
  public async fetchPinRadius(
    lat: number,
    lng: number,
    radiusMeters: number,
    onPlacesUpdated: (allPlaces: Business[], fromCache: boolean) => void
  ): Promise<void> {
    if (this.pinInFlightController) {
      this.pinInFlightController.abort();
    }
    this.pinInFlightController = new AbortController();
    const signal = this.pinInFlightController.signal;

    // Calculate bounding box encompassing the radius with 20% margin
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
      // Fetch up to 3000 places for the pin area
      const { places, cached, durationMs } = await fetchPlacesFromOverture(
        bounds.west,
        bounds.south,
        bounds.east,
        bounds.north,
        3000,
        signal,
        15
      );

      this.addPlaces(places, requiredTiles);

      if (import.meta.env.DEV) {
        console.log(
          `%c[Scoutly Pin Radar] ${cached ? 'Cache HIT' : 'Fetched'}%c | ${places.length} places in ${durationMs}ms for radius ${radiusMeters}m | Total in memory: ${this.placesMap.size}`,
          cached ? 'color: #3B82F6; font-weight: bold;' : 'color: #FF4D00; font-weight: bold;',
          'color: inherit;'
        );
      }

      onPlacesUpdated(this.getAllPlaces(), cached);
      this.pinInFlightController = null;
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      this.pinInFlightController = null;
      throw err;
    }
  }

  /**
   * Cancel any pending active requests or prefetches
   */
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

  /**
   * Load places for a viewport with intelligent geographic caching
   */
  public async loadViewport(
    bounds: MapBounds,
    zoom: number,
    onPlacesUpdated: (allPlaces: Business[], fromCache: boolean) => void
  ): Promise<void> {
    const t0 = performance.now();
    const requiredTiles = getTilesForBounds(bounds, 13);
    const isCovered = requiredTiles.length > 0 && requiredTiles.every((t) => this.loadedTiles.has(t));

    // Instant local memory cache HIT
    if (isCovered && this.placesMap.size > 0) {
      const duration = performance.now() - t0;
      if (import.meta.env.DEV) {
        console.log(
          `%c[Scoutly Map Perf] Memory Cache HIT%c in ${duration.toFixed(1)}ms | Zoom: ${zoom.toFixed(1)} | Total Places: ${this.placesMap.size}`,
          'color: #10B981; font-weight: bold;',
          'color: inherit;'
        );
      }
      onPlacesUpdated(this.getAllPlaces(), true);
      this.scheduleSilentPrefetch(bounds, zoom);
      return;
    }

    // Abort previous in-flight request if user moved again
    if (this.inFlightController) {
      this.inFlightController.abort();
    }
    this.inFlightController = new AbortController();
    const signal = this.inFlightController.signal;

    try {
      // Allow higher limits (e.g. 2500 per fetch) to eliminate the 500 limit
      const queryLimit = zoom >= 14 ? 2500 : 1500;
      const { places, cached, durationMs } = await fetchPlacesFromOverture(
        bounds.west,
        bounds.south,
        bounds.east,
        bounds.north,
        queryLimit,
        signal,
        zoom
      );

      // Merge into progressive spatial store
      this.addPlaces(places, requiredTiles);

      const totalTime = performance.now() - t0;
      if (import.meta.env.DEV) {
        console.log(
          `%c[Scoutly Map Perf] ${cached ? 'DuckDB Cache HIT' : 'Network Fetch'}%c | Places returned: ${places.length} | API: ${durationMs}ms | Total: ${totalTime.toFixed(1)}ms | Total in Map: ${this.placesMap.size}`,
          cached ? 'color: #3B82F6; font-weight: bold;' : 'color: #FF4D00; font-weight: bold;',
          'color: inherit;'
        );
      }

      onPlacesUpdated(this.getAllPlaces(), false);
      this.inFlightController = null;

      // Schedule low-priority silent prefetch of neighboring tiles
      this.scheduleSilentPrefetch(bounds, zoom);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Normal cancellation on rapid pan, ignore
        return;
      }
      this.inFlightController = null;
      throw err;
    }
  }

  /**
   * Schedule silent background prefetch for surrounding geographic tiles
   */
  public scheduleSilentPrefetch(bounds: MapBounds, zoom: number): void {
    if (this.prefetchTimer) {
      clearTimeout(this.prefetchTimer);
    }
    if (this.prefetchController) {
      this.prefetchController.abort();
      this.prefetchController = null;
    }

    // Wait 350ms idle before prefetching surrounding area
    this.prefetchTimer = setTimeout(async () => {
      // Expand bounds by 30% in each direction
      const dx = Math.max((bounds.east - bounds.west) * 0.3, 0.02);
      const dy = Math.max((bounds.north - bounds.south) * 0.3, 0.02);
      const expandedBounds: MapBounds = {
        west: bounds.west - dx,
        south: bounds.south - dy,
        east: bounds.east + dx,
        north: bounds.north + dy,
      };

      const surroundingTiles = getTilesForBounds(expandedBounds, 13);
      const missingTiles = surroundingTiles.filter((t) => !this.loadedTiles.has(t));

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

        if (places.length > 0) {
          this.addPlaces(places, surroundingTiles);
          if (import.meta.env.DEV) {
            console.log(
              `%c[Scoutly Prefetch] Silently prefetched ${places.length} surrounding places into cache%c | Total cached: ${this.placesMap.size}`,
              'color: #8B5CF6; font-weight: bold;',
              'color: inherit;'
            );
          }
        }
      } catch (err: any) {
        // Silently ignore prefetch abort or failure
      } finally {
        this.prefetchController = null;
      }
    }, 350);
  }

  /**
   * Clear the in-memory cache
   */
  public clear(): void {
    this.cancelOngoingRequests();
    this.placesMap.clear();
    this.loadedTiles.clear();
  }
}

export const mapCacheService = new MapCacheService();
