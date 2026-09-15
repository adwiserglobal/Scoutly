import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MapCacheService } from '../src/services/mapCacheService';
import type { Business, MapBounds } from '../src/types';

const area: MapBounds = { west: -46.69, east: -46.68, south: -23.57, north: -23.56 };
const adjacent = { ...area, west: -46.685, east: -46.675 };
const business = (id: string): Business => ({ id, coordinates: { lat: -23.565, lng: -46.685 } } as Business);
const response = (places: Business[] = []) => ({ places, cached: false, durationMs: 1 });
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

test('panning into an unfetched part of the same tile makes another request', async () => {
  let requests = 0;
  const cache = new MapCacheService(async () => { requests++; return response([business('1')]); });
  await cache.loadViewport(area, 14, () => {});
  await cache.loadViewport(adjacent, 14, () => {});
  assert.equal(requests, 2);
});

test('a complete cached area serves revisits, contained areas and empty results', async () => {
  let requests = 0;
  const cache = new MapCacheService(async () => { requests++; return response(); });
  await cache.loadViewport(area, 14, () => {});
  await cache.loadViewport(area, 14, () => {});
  await cache.loadViewport({ ...area, west: -46.688 }, 14, () => {});
  assert.equal(requests, 1);
});

test('a capped response does not cover a smaller area or a higher result limit', async () => {
  let requests = 0;
  const cache = new MapCacheService(async () => {
    requests++;
    return response(Array.from({ length: 1500 }, (_, i) => business(String(i))));
  });
  await cache.loadViewport(area, 13, () => {});
  await cache.loadViewport(area, 13, () => {});
  assert.equal(requests, 1);
  await cache.loadViewport({ ...area, west: -46.688 }, 13, () => {});
  await cache.loadViewport(area, 14, () => {});
  assert.equal(requests, 3);
});

test('a failed fetch remains retryable and never marks the area as covered', async () => {
  let requests = 0;
  const cache = new MapCacheService(async () => {
    if (++requests === 1) throw new Error('offline');
    return response();
  });
  await assert.rejects(cache.loadViewport(area, 14, () => {}), /offline/);
  assert.equal(cache.isBoundsCovered(area), false);
  await cache.loadViewport(area, 14, () => {});
  assert.equal(requests, 2);
});

test('late viewport responses cannot overwrite newer results or clear their controller', async () => {
  const pending = [deferred<ReturnType<typeof response>>(), deferred<ReturnType<typeof response>>()];
  const signals: AbortSignal[] = [];
  let requests = 0;
  const cache = new MapCacheService(async (_w, _s, _e, _n, _l, signal) => {
    signals.push(signal!);
    return pending[requests++].promise;
  });
  const updates: string[][] = [];
  const first = cache.loadViewport(area, 14, (places) => updates.push(places.map(p => p.id)));
  const second = cache.loadViewport(adjacent, 14, (places) => updates.push(places.map(p => p.id)));
  pending[0].resolve(response([business('old')]));
  await first;
  assert.equal(signals[0].aborted, true);
  assert.deepEqual(updates, []);
  cache.cancelOngoingRequests();
  assert.equal(signals[1].aborted, true);
  pending[1].resolve(response([business('new')]));
  await second;
  assert.deepEqual(updates, []);
});

test('dropping a new pin supersedes the old search while panning preserves the pin request', async () => {
  const pending = Array.from({ length: 3 }, () => deferred<ReturnType<typeof response>>());
  const signals: AbortSignal[] = [];
  let requests = 0;
  const cache = new MapCacheService(async (_w, _s, _e, _n, _l, signal) => {
    signals.push(signal!);
    return pending[requests++].promise;
  });
  const updates: string[][] = [];
  const first = cache.fetchPinRadius(-23.56, -46.68, 1000, (places) => updates.push(places.map(p => p.id)));
  const second = cache.fetchPinRadius(-23.57, -46.69, 2000, (places) => updates.push(places.map(p => p.id)));
  const viewport = cache.loadViewport(area, 14, () => {});
  cache.cancelOngoingRequests();
  assert.equal(signals[0].aborted, true);
  assert.equal(signals[1].aborted, false);
  assert.equal(signals[2].aborted, true);
  pending[1].resolve(response([business('new-pin')]));
  await second;
  pending[0].resolve(response([business('old-pin')]));
  pending[2].resolve(response());
  await Promise.all([first, viewport]);
  assert.deepEqual(updates, [['new-pin']]);
  assert.deepEqual(cache.getAllPlaces().map(p => p.id), ['new-pin']);
});

test('removing the pin cancels its request and suppresses late callbacks', async () => {
  const pending = deferred<ReturnType<typeof response>>();
  const cache = new MapCacheService(async () => pending.promise);
  let updates = 0;
  const request = cache.fetchPinRadius(-23.56, -46.68, 1000, () => { updates++; });
  cache.cancelPinRequest();
  pending.resolve(response([business('removed')]));
  await request;
  assert.equal(updates, 0);
  assert.equal(cache.getAllPlaces().length, 0);
});

test('evicted places invalidate coverage so returning to that area fetches again', async () => {
  const cache = new MapCacheService(async () => response([business('first')]));
  await cache.loadViewport(area, 14, () => {});
  assert.equal(cache.isBoundsCovered(area), true);
  cache.addPlaces(Array.from({ length: 30001 }, (_, i) => business(String(i))));
  assert.equal(cache.isBoundsCovered(area), false);
});
