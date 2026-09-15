import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import duckdb from 'duckdb';
import { getDuckDB, queryPlacesInBBox } from '../server/overtureService';

test('server cache stores exact query results and never caches upstream failures', async () => {
  const previousDir = process.cwd();
  const temporaryDir = mkdtempSync(path.join(tmpdir(), 'scoutly-cache-test-'));
  process.chdir(temporaryDir);
  let remoteCalls = 0;
  let remoteError = false;
  const originalAll = duckdb.Database.prototype.all;
  // Use a real local DuckDB for SQL/cache persistence. Only external extensions
  // and the S3 query are replaced, so this test requires no network access.
  const allMock = mock.method(duckdb.Database.prototype, 'all', function (sql: string, ...args: any[]) {
    const callback = args.at(-1);
    if (sql.includes('INSTALL ')) {
      queueMicrotask(() => callback(null, []));
      return this;
    }
    if (sql.includes('SET s3_region')) sql = sql.slice(sql.indexOf('CREATE TABLE'));
    if (sql.includes('read_parquet')) {
      remoteCalls++;
      queueMicrotask(() => callback(remoteError ? new Error('upstream unavailable') : null, []));
      return this;
    }
    return originalAll.call(this, sql, ...args);
  });
  let db: duckdb.Database | undefined;
  try {
    db = await getDuckDB();
    const first = await queryPlacesInBBox(-46.69, -23.57, -46.68, -23.56, 2500);
    assert.deepEqual(first.places, []);
    await queryPlacesInBBox(-46.69, -23.57, -46.68, -23.56, 2500);
    assert.equal(remoteCalls, 1, 'successful empty queries must be cached');
    await queryPlacesInBBox(-46.6899, -23.57, -46.68, -23.56, 2500);
    assert.equal(remoteCalls, 2, 'nearby bounds must not collide due to rounding');

    remoteError = true;
    await assert.rejects(queryPlacesInBBox(-46.68, -23.57, -46.67, -23.56), /Tente novamente/);
    remoteError = false;
    await queryPlacesInBBox(-46.68, -23.57, -46.67, -23.56);
    assert.equal(remoteCalls, 4, 'failed areas must be fetched again');

    // Seed a persisted successful response, exercising the disk read path.
    const key = '-46.67_-23.57_-46.66_-23.56_2500';
    await new Promise<void>((resolve, reject) => db!.run(
      'INSERT INTO overture_bbox_cache VALUES (?, ?, CURRENT_TIMESTAMP)', key, '[]',
      (err) => err ? reject(err) : resolve()
    ));
    await queryPlacesInBBox(-46.67, -23.57, -46.66, -23.56, 2500);
    assert.equal(remoteCalls, 4, 'an empty persisted response must avoid another remote query');
    await assert.rejects(queryPlacesInBBox(NaN, -23, -46, -22), /inválidos/);
    assert.equal(remoteCalls, 4);
  } finally {
    if (db) await new Promise<void>((resolve) => db!.close(() => resolve()));
    allMock.mock.restore();
    process.chdir(previousDir);
    rmSync(temporaryDir, { recursive: true, force: true });
  }
});
