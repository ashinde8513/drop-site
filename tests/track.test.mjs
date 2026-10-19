import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { onRequest } from '../functions/e/[[path]].js';
import { EVENTS, SURFACES, validBeacon } from '../src/track.mjs';

const call = (path, method = 'POST') => onRequest({ request: new Request('https://trydropapp.com' + path, { method }) });

test('beacon sink accepts only allowlisted counts and stores nothing', async () => {
  assert.equal((await call('/e/ticket_click/etix/event')).status, 204);
  assert.equal((await call('/e/app_store_click/android/home')).status, 204);
  assert.equal((await call('/e/ticket_click/etix/event')).headers.get('cache-control'), 'no-store');
  for (const bad of ['/e/ticket_click/evil/event', '/e/ticket_click/etix/x', '/e/page_view/web/home', '/e/ticket_click/etix/event/extra', '/e/ticket_click/etix']) {
    assert.equal((await call(bad)).status, 404, bad);
  }
  assert.equal((await call('/e/ticket_click/etix/event', 'GET')).status, 405, 'GET is never counted (crawlers, prefetch)');
  assert.ok(validBeacon('/e/ticket_click/other/other'));
});

test('client vendor and surface names are all allowlisted at the edge', () => {
  const site = readFileSync(new URL('../site.js', import.meta.url), 'utf8');
  const vendors = [...site.match(/var VENDORS = \[([\s\S]*?)\];/)[1].matchAll(/\['[^']+', '([^']+)'\]/g)].map((m) => m[1]);
  for (const vendor of vendors) assert.ok(EVENTS.ticket_click.includes(vendor), vendor);
  const surfaces = [...site.match(/var SURFACES = \[([^\]]*)\]/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  for (const surface of [...surfaces, 'home', 'other']) assert.ok(SURFACES.includes(surface), surface);
  assert.match(site, /Drop\.TRACKING = true;/);
  const privacy = readFileSync(new URL('../privacy.html', import.meta.url), 'utf8');
  assert.match(privacy, /counts clicks on ticket links and app-store links/, '/privacy must describe the counts while they run');
  assert.match(readFileSync(new URL('../_routes.json', import.meta.url), 'utf8'), /"\/e\/\*"/);
  assert.match(readFileSync(new URL('../functions/event/[[path]].js', import.meta.url), 'utf8'), /\|\| '\?src=smart_banner'/);
});
