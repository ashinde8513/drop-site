import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { rest, restWithCount } from '../src/entity-seo.mjs';

const KEY = /sb_publishable_/;
function fakeCache() {
  const store = new Map();
  return {
    store,
    async match(key) { const hit = store.get(key); return hit && new Response(hit); },
    async put(key, response) { store.set(key, await response.text()); this.lastTtl = response.headers.get('Cache-Control'); },
  };
}
function stubFetch(body = [{ id: 'a' }], status = 200, headers = {}) {
  const calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return new Response(JSON.stringify(body), { status, headers }); };
  return calls;
}

test('REST reads repeat from the colo cache, with the public key only', async () => {
  const cache = fakeCache();
  globalThis.caches = { default: cache };
  const calls = stubFetch();
  try {
    const params = { select: 'id', id: 'eq.cache-1', limit: 1 };
    assert.deepEqual(await rest('events', params), [{ id: 'a' }]);
    assert.deepEqual(await rest('events', params), [{ id: 'a' }]);
    assert.equal(calls.length, 1, 'second identical read is served from cache');
    assert.match(calls[0].init.headers.apikey, KEY);
    assert.match(calls[0].init.headers.Authorization, /^Bearer sb_publishable_/);
    assert.equal(cache.store.size, 1);
    assert.equal(cache.lastTtl, 'public, max-age=600');
    // a different query is a different key
    await rest('events', { ...params, id: 'eq.cache-2' });
    assert.equal(calls.length, 2);
  } finally { delete globalThis.caches; }
});

test('counted and uncounted reads of one query are cached separately', async () => {
  globalThis.caches = { default: fakeCache() };
  const calls = stubFetch([{ id: 'a' }], 200, { 'content-range': '0-0/7' });
  try {
    const params = { select: 'id', id: 'eq.cache-3' };
    assert.equal((await restWithCount('events', params)).total, 7);
    assert.equal((await restWithCount('events', params)).total, 7);
    assert.equal((await restWithCount('events', params, false)).rows.length, 1);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].init.headers.Prefer, 'count=exact');
    assert.equal(calls[1].init.headers.Prefer, undefined);
  } finally { delete globalThis.caches; }
});

test('errors and empty answers are not cached; the same key recovers after a failure', async () => {
  const cache = fakeCache();
  globalThis.caches = { default: cache };
  try {
    stubFetch({}, 500);
    await assert.rejects(rest('events', { id: 'eq.cache-4' }), /HTTP 500/);
    assert.equal(cache.store.size, 0);
    let calls = stubFetch([]);
    assert.deepEqual(await rest('events', { id: 'eq.cache-4' }), []);
    assert.equal(cache.store.size, 0, 'an unpublished id must not be remembered as missing');
    calls = stubFetch([{ id: 'ok' }]);
    assert.deepEqual(await rest('events', { id: 'eq.cache-4' }), [{ id: 'ok' }]);
    assert.equal(cache.store.size, 1);
  } finally { delete globalThis.caches; }
});

test('fresh reads bypass the cache both ways (health monitors)', async () => {
  const cache = fakeCache();
  globalThis.caches = { default: cache };
  const calls = stubFetch();
  try {
    await rest('events', { id: 'eq.cache-7' });
    await rest('events', { id: 'eq.cache-7' }, true);
    assert.equal(calls.length, 2);
    assert.equal(cache.store.size, 1);
    await rest('events', { id: 'eq.cache-8' }, true);
    assert.equal(cache.store.size, 1, 'fresh reads are not stored');
  } finally { delete globalThis.caches; }
});

test('festival end_date steps in 10 minutes so the query repeats', async () => {
  const { upcomingFestivals } = await import('../src/editorial.mjs');
  const urls = [];
  globalThis.fetch = async (url) => { urls.push(String(url)); return new Response('[]'); };
  await upcomingFestivals(new Date('2030-01-01T10:01:10Z'));
  await upcomingFestivals(new Date('2030-01-01T10:09:59Z'));
  const ended = urls.filter((url) => url.includes('end_date=gte.'));
  assert.equal(ended.length, 2);
  assert.equal(ended[0], ended[1]);
  assert.match(ended[0], /end_date=gte\.2030-01-01T10%3A00%3A00\.000Z/);
});

test('no Cache API (local, tests): reads still work', async () => {
  delete globalThis.caches;
  const calls = stubFetch();
  assert.equal((await rest('events', { id: 'eq.cache-6' })).length, 1);
  assert.equal(calls.length, 1);
});

test('robots.txt keeps search engines in and turns SEO-tool crawlers away', () => {
  const robots = readFileSync(new URL('../robots.txt', import.meta.url), 'utf8');
  assert.match(robots, /User-agent: \*\r?\nAllow: \//);
  for (const bot of ['AhrefsBot', 'SemrushBot', 'Amazonbot', 'PetalBot']) assert.match(robots, new RegExp('User-agent: ' + bot));
  assert.doesNotMatch(robots, /User-agent: (Googlebot|Bingbot|OAI-SearchBot|GPTBot)/);
});
