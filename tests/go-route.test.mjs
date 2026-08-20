// The /go route is printed on physical business cards and can never change,
// so its contract is tested rather than trusted: one 302, no Supabase URL in
// the chain, and a correct destination even when attribution is unavailable.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { onRequest } from '../functions/go.js';
import { onRequest as onTicketRequest } from '../functions/t.js';

const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';
const APP_STORE = 'https://apps.apple.com/us/app/drop-edm-events/id6790662825';

function request(url, userAgent, method = 'GET') {
  return new Request(url, { method, headers: userAgent ? { 'user-agent': userAgent } : {} });
}

async function withFetch(stub, run) {
  const original = globalThis.fetch;
  globalThis.fetch = stub;
  try {
    return await run();
  } finally {
    globalThis.fetch = original;
  }
}

test('proxies the Edge Function destination as a single 302', async () => {
  const seen = {};
  const response = await withFetch(async (url, init) => {
    seen.url = url;
    seen.forwardedUa = init.headers['x-drop-user-agent'];
    return new Response(null, { status: 302, headers: { location: `${APP_STORE}?ct=camp_alderwild&mt=8` } });
  }, () => onRequest({ request: request('https://trydropapp.com/go', IOS_UA) }));

  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), `${APP_STORE}?ct=camp_alderwild&mt=8`);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(seen.forwardedUa, IOS_UA, 'scanner UA must reach the Edge Function, not Cloudflare’s');
  assert.match(seen.url, /drop-card\?k=drop-card-v1/);
});

test('never exposes a Supabase URL to the scanner', async () => {
  const response = await withFetch(
    async () => new Response(null, { status: 302, headers: { location: APP_STORE } }),
    () => onRequest({ request: request('https://trydropapp.com/go', IOS_UA) }),
  );
  assert.doesNotMatch(response.headers.get('location'), /supabase/i);
});

test('forwards optional campaign parameters', async () => {
  let target = '';
  await withFetch(async (url) => {
    target = url;
    return new Response(null, { status: 302, headers: { location: 'https://trydropapp.com/' } });
  }, () => onRequest({ request: request('https://trydropapp.com/go?distributor=arya&batch=002&placement=festival_handout&variant=b', ANDROID_UA) }));

  assert.match(target, /distributor=arya/);
  assert.match(target, /batch=002/);
  assert.match(target, /placement=festival_handout/);
  assert.match(target, /variant=b/);
});

test('still routes iOS to the App Store when tracking fails', async () => {
  const response = await withFetch(
    async () => { throw new Error('edge down'); },
    () => onRequest({ request: request('https://trydropapp.com/go', IOS_UA) }),
  );
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), APP_STORE);
});

test('still routes Android to the web when tracking fails', async () => {
  const response = await withFetch(
    async () => { throw new Error('edge down'); },
    () => onRequest({ request: request('https://trydropapp.com/go', ANDROID_UA) }),
  );
  assert.equal(response.headers.get('location'), 'https://trydropapp.com/');
});

test('Android is never sent to the Apple App Store', async () => {
  const response = await withFetch(
    async () => new Response(null, { status: 500 }),
    () => onRequest({ request: request('https://trydropapp.com/go', ANDROID_UA) }),
  );
  assert.doesNotMatch(response.headers.get('location'), /apps\.apple\.com/);
});

test('unknown and desktop agents land on the web', async () => {
  for (const ua of ['', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36']) {
    const response = await withFetch(
      async () => { throw new Error('edge down'); },
      () => onRequest({ request: request('https://trydropapp.com/go', ua) }),
    );
    assert.equal(response.headers.get('location'), 'https://trydropapp.com/');
  }
});

test('rejects non-GET methods', async () => {
  const response = await onRequest({ request: request('https://trydropapp.com/go', IOS_UA, 'POST') });
  assert.equal(response.status, 405);
});

test('/go is registered as a Pages Function route', () => {
  const routes = JSON.parse(readFileSync(new URL('../_routes.json', import.meta.url), 'utf8'));
  assert.ok(routes.include.includes('/go'), '_routes.json must invoke the Function for /go');
});

const EVENT_ID = '11111111-1111-4111-8111-111111111111';
const OWNED_ETIX = 'https://etix.prf.hn/click/camref:1100l5NLJm/pubref:123456-MAYA2026/destination:https%3A%2F%2Fwww.etix.com%2Fticket%2Fp%2F123456';

test('/t proxies bounded promoter attribution to the Edge Function', async () => {
  let target = '';
  const response = await withFetch(async (url, init) => {
    target = url;
    assert.equal(init.method, 'GET');
    return new Response(null, { status: 302, headers: { location: OWNED_ETIX } });
  }, () => onTicketRequest({ request: request(`https://trydropapp.com/t?event=${EVENT_ID}&creator=maya-2026&surface=native`) }));

  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), OWNED_ETIX);
  assert.match(target, new RegExp(`event=${EVENT_ID}`));
  assert.match(target, /creator=MAYA2026/);
  assert.match(target, /surface=native/);
});

test('/t omits an invalid creator so the Edge Function can return the original owned link', async () => {
  let target = '';
  await withFetch(async (url) => {
    target = url;
    return new Response(null, { status: 302, headers: { location: OWNED_ETIX } });
  }, () => onTicketRequest({ request: request(`https://trydropapp.com/t?event=${EVENT_ID}&creator=abc`) }));

  assert.doesNotMatch(target, /creator=/);
});

test('/t rejects an untrusted Edge destination and falls back to the public show', async () => {
  const response = await withFetch(
    async () => new Response(null, { status: 302, headers: { location: 'https://evil.example/ticket' } }),
    () => onTicketRequest({ request: request(`https://trydropapp.com/t?event=${EVENT_ID}&creator=MAYA2026`) }),
  );
  assert.equal(response.headers.get('location'), `https://trydropapp.com/event/${EVENT_ID}`);
});

test('/t rejects encoded non-Etix and mismatched-event destinations', async () => {
  const unsafeLocations = [
    'https://etix.prf.hn/click/camref:1100l5NLJm/pubref:123456-MAYA2026/destination:https%3A%2F%2Fevil.example%2Fticket%2Fp%2F123456',
    'https://etix.prf.hn/click/camref:1100l5NLJm/pubref:123456-MAYA2026/destination:https%3A%2F%2Fwww.etix.com%2Fticket%2Fp%2F999999',
  ];

  for (const location of unsafeLocations) {
    const response = await withFetch(
      async () => new Response(null, { status: 302, headers: { location } }),
      () => onTicketRequest({ request: request(`https://trydropapp.com/t?event=${EVENT_ID}&creator=MAYA2026`) }),
    );
    assert.equal(response.headers.get('location'), `https://trydropapp.com/event/${EVENT_ID}`);
  }
});

test('/t rejects malformed event IDs without calling the Edge Function', async () => {
  let called = false;
  const response = await withFetch(async () => {
    called = true;
    return new Response(null, { status: 302, headers: { location: OWNED_ETIX } });
  }, () => onTicketRequest({ request: request('https://trydropapp.com/t?event=not-a-uuid&creator=MAYA2026') }));

  assert.equal(called, false);
  assert.equal(response.headers.get('location'), 'https://trydropapp.com/');
});

test('/t has a no-store fallback and rejects non-GET methods', async () => {
  const fallback = await withFetch(
    async () => { throw new Error('edge down'); },
    () => onTicketRequest({ request: request(`https://trydropapp.com/t?event=${EVENT_ID}`) }),
  );
  assert.equal(fallback.headers.get('location'), `https://trydropapp.com/event/${EVENT_ID}`);
  assert.equal(fallback.headers.get('cache-control'), 'no-store');

  const rejected = await onTicketRequest({ request: request(`https://trydropapp.com/t?event=${EVENT_ID}`, '', 'POST') });
  assert.equal(rejected.status, 405);
});

test('all public event ticket CTAs use promoter attribution only when eligible', () => {
  const html = readFileSync(new URL('../event.html', import.meta.url), 'utf8');
  assert.equal((html.match(/buy\.href = promoterTicketUrl\(ev\)/g) || []).length, 3);
  assert.match(html, /hostname !== 'etix\.prf\.hn'/);
  assert.match(html, /if \(!ticketUrl \|\| !creatorCode\) return ticketUrl/);
  assert.match(html, /creatorCode \? '&creator=' \+ encodeURIComponent\(creatorCode\)/);
});

test('/t is registered as a Pages Function route', () => {
  const routes = JSON.parse(readFileSync(new URL('../_routes.json', import.meta.url), 'utf8'));
  assert.ok(routes.include.includes('/t'), '_routes.json must invoke the Function for /t');
});
