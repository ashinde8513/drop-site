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
    async put(key, response) { store.set(key, await response.text()); },
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

test('errors are not cached and concurrent identical reads share one fetch', async () => {
  const cache = fakeCache();
  globalThis.caches = { default: cache };
  let calls = stubFetch({}, 500);
  try {
    await assert.rejects(rest('events', { id: 'eq.cache-4' }), /HTTP 500/);
    assert.equal(cache.store.size, 0);
    calls = stubFetch([{ id: 'ok' }]);
    const [a, b] = await Promise.all([rest('events', { id: 'eq.cache-5' }), rest('events', { id: 'eq.cache-5' })]);
    assert.deepEqual(a, b);
    assert.equal(calls.length, 1);
  } finally { delete globalThis.caches; }
});

test('no Cache API (local, tests): reads still work', async () => {
  delete globalThis.caches;
  const calls = stubFetch();
  assert.equal((await rest('events', { id: 'eq.cache-6' })).length, 1);
  assert.equal(calls.length, 1);
});

test('robots.txt keeps search engines in and turns SEO-tool crawlers away', () => {
  const robots = readFileSync(new URL('../robots.txt', import.meta.url), 'utf8');
  assert.match(robots, /User-agent: \*\nAllow: \//);
  for (const bot of ['AhrefsBot', 'SemrushBot', 'Amazonbot', 'PetalBot']) assert.match(robots, new RegExp('User-agent: ' + bot));
  assert.doesNotMatch(robots, /User-agent: (Googlebot|Bingbot|OAI-SearchBot|GPTBot)/);
});
