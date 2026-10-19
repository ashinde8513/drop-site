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
  } finally { globalThis.fetch = real; }
});
