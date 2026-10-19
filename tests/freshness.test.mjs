import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assess, LIMITS } from '../src/freshness.mjs';
import { onRequest } from '../functions/freshness.json.js';

const now = new Date('2026-10-19T12:00:00Z');
const cities = (denver, other = 200) => [...Array(denver).fill('Denver'), ...Array(other).fill('Chicago')];

test('freshness flags a stopped sync, a thin week and an empty home market', () => {
  const fresh = assess({ newestCreatedAt: '2026-10-19T02:00:00Z', next7Days: 300, cities: cities(40) }, now);
  assert.equal(fresh.status, 'ok');
  assert.equal(fresh.hoursSinceNewestShow, 10);
  assert.equal(fresh.marketShowsNext7Days.Denver, 40);
  const stale = assess({ newestCreatedAt: '2026-10-15T12:00:00Z', next7Days: 40, cities: cities(2, 38) }, now);
  assert.equal(stale.status, 'stale');
  assert.equal(stale.problems.length, 3);
  assert.match(stale.problems[0], /no new shows for 96 h \(limit 72 h\)/);
  assert.equal(assess({ newestCreatedAt: null, next7Days: 300, cities: cities(40) }, now).status, 'stale');
  assert.equal(LIMITS.maxHoursSinceNewest, 72);
});

test('endpoint answers 503 when stale or unreachable so monitors can alert on status', async () => {
  const real = globalThis.fetch;
  const call = () => onRequest({ request: new Request('https://trydropapp.com/freshness.json') });
  try {
    globalThis.fetch = async (url) => new Response(JSON.stringify(String(url).includes('order=created_at') ? [{ created_at: new Date().toISOString() }] : Array(150).fill({ city: 'Denver' })), { headers: { 'Content-Range': '0-149/150' } });
    const ok = await call();
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).status, 'ok');
    assert.equal(ok.headers.get('x-robots-tag'), 'noindex');
    globalThis.fetch = async () => { throw new Error('down'); };
    const down = await call();
    assert.equal(down.status, 503);
    assert.deepEqual((await down.json()).problems, ['catalog unreachable']);
  } finally { globalThis.fetch = real; }
  assert.match(readFileSync(new URL('../_routes.json', import.meta.url), 'utf8'), /"\/freshness\.json"/);
});
