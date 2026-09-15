import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MapCacheService } from '../src/services/mapCacheService';
import type { Business, MapBounds } from '../src/types';

const area: MapBounds = { west: -46.70, east: -46.60, south: -23.60, north: -23.50 };
const business = (id: string): Business => ({
  id,
  name: `Despachante ${id}`,
  latitude: -23.55,
  longitude: -46.65,
  coordinates: { lat: -23.55, lng: -46.65 },
  category: 'Despachante',
  confidence: 0.9,
  operatingStatus: 'OPERATIONAL',
  website: null,
  websites: [],
  email: null,
  emails: [],
  phone: null,
  phones: [],
  socials: [],
  address: 'São Paulo - SP',
  source: 'Scoutly Search',
  leadStatus: 'NOVO',
});

test('targeted business results are not overwritten by a generic viewport refresh', async () => {
  let genericRequests = 0;
  const cache = new MapCacheService(async () => {
    genericRequests++;
    return { places: [business('generic')], cached: false, durationMs: 1 };
  });

  cache.setTargetedSearchResults([business('1'), business('2')], 'despachante em sp');
  const updates: string[][] = [];
  await cache.loadViewport(area, 14, (places) => updates.push(places.map((place) => place.id)));

  assert.equal(genericRequests, 0);
  assert.deepEqual(updates, [['1', '2']]);
});

test('clearing targeted mode restores normal viewport loading', async () => {
  let genericRequests = 0;
  const cache = new MapCacheService(async () => {
    genericRequests++;
    return { places: [business('generic')], cached: false, durationMs: 1 };
  });

  cache.setTargetedSearchResults([business('1')], 'despachante em sp');
  cache.clearTargetedSearch();
  await cache.loadViewport(area, 14, () => {});

  assert.equal(genericRequests, 1);
});

test('an empty targeted search remains targeted instead of showing unrelated businesses', async () => {
  let genericRequests = 0;
  const cache = new MapCacheService(async () => {
    genericRequests++;
    return { places: [business('generic')], cached: false, durationMs: 1 };
  });

  cache.setTargetedSearchResults([], 'segmento inexistente em sp');
  const updates: string[][] = [];
  await cache.loadViewport(area, 14, (places) => updates.push(places.map((place) => place.id)));

  assert.equal(genericRequests, 0);
  assert.deepEqual(updates, [[]]);
});
