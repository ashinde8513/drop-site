import test from 'node:test';
import assert from 'node:assert/strict';
import { artCandidates, BRAND_IMAGE, fetchArt, imageType, MAX_BYTES } from '../src/og-image.mjs';
import { onRequest } from '../functions/og/event/[[path]].js';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const HTML = new TextEncoder().encode('<html>nope</html>');
const id = '11111111-1111-4111-8111-111111111111';

test('share images are byte-checked, size-capped and fall back in order', async () => {
  assert.equal(imageType(PNG), 'image/png');
  assert.equal(imageType(JPG), 'image/jpeg');
  assert.equal(imageType(HTML), null);
  assert.deepEqual(artCandidates({ image_url: 'http://insecure.test/a.png', event_artists: [{ artists: { image_url: 'https://img.test/b.jpg' } }, { artists: { image_url: 'nope' } }] }), ['https://img.test/b.jpg']);
  const served = { 'https://a.test/404.png': [404, PNG], 'https://a.test/page.png': [200, HTML], 'https://a.test/big.png': [200, PNG, MAX_BYTES + 1], 'https://a.test/ok.jpg': [200, JPG] };
  const fetcher = async (url) => { const [status, body, len] = served[url]; return new Response(body, { status, headers: len ? { 'content-length': String(len) } : {} }); };
  const art = await fetchArt(Object.keys(served), fetcher);
  assert.equal(art.type, 'image/jpeg', 'skips 404, non-image and oversized art');
  assert.equal(await fetchArt(['https://a.test/404.png'], fetcher), null);
  // No Content-Length (chunked): the stream is cut off at the cap instead of buffered.
  let cancelled = false;
  const endless = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(1024 * 1024)); }, cancel() { cancelled = true; } });
  assert.equal(await fetchArt(['https://a.test/stream'], async () => new Response(endless)), null);
  assert.ok(cancelled, 'oversized stream cancelled');
});

test('every redirect hop must stay https with no user@host', async () => {
  const hops = { 'https://a.test/ok': [302, 'https://cdn.test/a.png'], 'https://cdn.test/a.png': [200], 'https://a.test/down': [302, 'http://cdn.test/a.png'], 'https://a.test/creds': [301, 'https://u:p@cdn.test/a.png'], 'https://a.test/loop': [302, '/loop'], 'https://a.test/bare': [302] };
  const seen = [];
  const signals = [];
  const fetcher = async (url, init) => { seen.push(String(url)); signals.push(init.signal); assert.equal(init.redirect, 'manual'); const [status, location] = hops[url]; return new Response(status === 200 ? PNG : null, { status, headers: location ? { location } : {} }); };
  assert.equal((await fetchArt(['https://a.test/ok'], fetcher)).type, 'image/png', 'https redirect followed');
  assert.equal(await fetchArt(['https://a.test/down', 'https://a.test/creds', 'https://a.test/loop'], fetcher), null);
  assert.ok(!seen.includes('http://cdn.test/a.png') && !seen.some((url) => url.includes('u:p@')), 'unsafe hops never fetched');
  assert.equal(seen.filter((url) => url === 'https://a.test/loop').length, 3, 'redirect loops stop after three fetches');
  assert.equal(await fetchArt(['https://a.test/bare'], fetcher), null);
  assert.equal(seen.filter((url) => url === 'https://a.test/bare').length, 1, 'a redirect with no Location is a miss, not a refetch');
  assert.equal(new Set(signals).size, 5, 'one timeout budget per image, shared by its hops');
  assert.deepEqual(artCandidates({ image_url: 'https://u:p@img.test/a.png' }), []);
});

test('HEAD is answered from the GET cache entry instead of refetching the art', async () => {
  const real = globalThis.fetch;
  const store = new Map();
  const pending = [];
  globalThis.caches = { default: { match: async (k) => store.get(k)?.clone(), put: async (k, r) => { store.set(k, r); } } };
  let artFetches = 0;
  const call = (method) => onRequest({ params: { path: [id] }, request: new Request('https://trydropapp.com/og/event/' + id, { method }), env: {}, waitUntil: (p) => pending.push(p) });
  try {
    globalThis.fetch = async (url) => {
      if (String(url).includes('/rest/v1/events')) return new Response(JSON.stringify([{ id, title: 'x', image_url: 'https://img.test/a.png' }]), { headers: { 'Content-Range': '0-0/1' } });
      artFetches++;
      return new Response(PNG);
    };
    const first = await call('HEAD');
    assert.equal(first.status, 200);
    assert.equal(first.headers.get('content-type'), 'image/png');
    assert.equal((await first.arrayBuffer()).byteLength, 0, 'HEAD has no body');
    await Promise.all(pending);
    await call('HEAD');
    assert.equal((await (await call('GET')).arrayBuffer()).byteLength, PNG.byteLength, 'GET reuses the entry with its body');
    assert.equal(artFetches, 1, 'one upstream fetch for HEAD, HEAD, GET');
  } finally { globalThis.fetch = real; delete globalThis.caches; }
});

test('endpoint re-serves real art with the right type, else redirects to the brand card', async () => {
  const real = globalThis.fetch;
  const call = (path) => onRequest({ params: { path: [path] }, request: new Request('https://trydropapp.com/og/event/' + path), env: {}, waitUntil() {} });
  try {
    globalThis.fetch = async (url) => String(url).includes('/rest/v1/events')
      ? new Response(JSON.stringify([{ id, title: 'x', image_url: 'https://prod-images.seetickets.us/abc' }]), { headers: { 'Content-Range': '0-0/1' } })
      : new Response(PNG, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    const ok = await call(id);
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get('content-type'), 'image/png', 'wrong upstream type corrected');
    globalThis.fetch = async (url) => String(url).includes('/rest/v1/events')
      ? new Response(JSON.stringify([{ id, title: 'x', image_url: 'https://gone.test/a.png' }]), { headers: { 'Content-Range': '0-0/1' } })
      : new Response('missing', { status: 404 });
    const gone = await call(id);
    assert.equal(gone.status, 302);
    assert.equal(gone.headers.get('location'), BRAND_IMAGE);
    assert.equal((await call('not-a-uuid')).status, 302);
    const busted = await onRequest({ params: { path: [id] }, request: new Request('https://trydropapp.com/og/event/' + id + '?x=1'), env: {}, waitUntil() {} });
    assert.equal(busted.status, 301, 'query strings never reach the upstream fetch');
    assert.equal(busted.headers.get('location'), '/og/event/' + id);
  } finally { globalThis.fetch = real; }
});
