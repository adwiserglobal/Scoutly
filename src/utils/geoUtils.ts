import { MapBounds } from '../types';

/**
 * Creates a GeoJSON Polygon Feature representing a circular radar area around a coordinate.
 * @param center [longitude, latitude]
 * @param radiusInMeters Radius of the circle in meters
 * @param points Number of vertices used to approximate the circle
 */
export function createGeoJSONCircle(
  center: [number, number],
  radiusInMeters: number,
  points: number = 64
): GeoJSON.Feature<GeoJSON.Polygon> {
  const [lng, lat] = center;
  const coords: [number, number][] = [];
  const distanceX = radiusInMeters / (111320 * Math.cos((lat * Math.PI) / 180));
  const distanceY = radiusInMeters / 110540;

  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    coords.push([lng + x, lat + y]);
  }
  coords.push(coords[0]); // Close polygon loop

  return {
    type: 'Feature',
    properties: {
      radius: radiusInMeters,
    },
    geometry: {
      type: 'Polygon',
      coordinates: [coords],
    },
  };
}

/**
 * Calculates a bounding box encompassing a center coordinate and a radius in meters.
 */
export function getBoundsForRadius(
  lat: number,
  lng: number,
  radiusInMeters: number
): MapBounds {
  const deltaLat = radiusInMeters / 110540;
  const deltaLng = radiusInMeters / (111320 * Math.cos((lat * Math.PI) / 180));

  return {
    north: lat + deltaLat * 1.15,
    south: lat - deltaLat * 1.15,
    east: lng + deltaLng * 1.15,
    west: lng - deltaLng * 1.15,
  };
}

/**
 * Calculates Great-Circle distance between two coordinates in meters (Haversine formula).
 */
export function calculateDistanceInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Formats a distance in meters to a human readable format (e.g. 450 m or 1.2 km).
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}
