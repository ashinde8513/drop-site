import test from 'node:test';
import assert from 'node:assert/strict';
import { query, readout, summarize, surfaceOf, views, viewsQuery, ZONE } from '../scripts/conversion-counts.mjs';

test('conversion report queries only accepted /e/ beacons and rolls them up', () => {
  const q = query(7, new Date('2026-10-20T12:00:00Z'));
  assert.match(q, new RegExp(`zoneTag:"${ZONE}"`));
  assert.match(q, /datetime_geq:"2026-10-13T12:00:00Z"/);
  assert.match(q, /clientRequestPath_like:"\/e\/%"/);
  assert.match(q, /clientRequestHTTPMethodName:"POST"/);
  assert.match(q, /edgeResponseStatus:204/);
  const row = (path, count) => ({ count, dimensions: { clientRequestPath: path } });
  const out = summarize([row('/e/ticket_click/etix/event', 5), row('/e/ticket_click/axs/city', 2), row('/e/app_store_click/ios/home', 3), row('/e/ticket_click/evil/event', 9), row('/e/x', 1)]);
  assert.deepEqual(out.ticket_click, { total: 7, byDetail: { etix: 5, axs: 2 }, bySurface: { event: 5, city: 2 } });
  assert.deepEqual(out.app_store_click, { total: 3, byDetail: { ios: 3 }, bySurface: { home: 3 } });
});

test('readout counts public-site browser views per surface and prints click rates', () => {
  const q = viewsQuery(7, new Date('2026-10-20T12:00:00Z'));
  assert.match(q, /clientRequestHTTPHost:"trydropapp.com"/);
  assert.match(q, /userAgentBrowser_neq:"Unknown"/);
  assert.match(q, /edgeResponseContentTypeName:"html"/);
  assert.equal(surfaceOf('/'), 'home');
  assert.equal(surfaceOf('/index.html'), 'home');
  assert.equal(surfaceOf('/event/abc/slug'), 'event');
  assert.equal(surfaceOf('/genre.html'), 'genre');
  assert.equal(surfaceOf('/proc/self/environ'), 'other');
  const row = (path, count) => ({ count, dimensions: { clientRequestPath: path } });
  const pv = views([row('/event/a', 900), row('/event/b', 100), row('/', 50)]);
  assert.deepEqual(pv, { event: 1000, home: 50 });
  const md = readout(7, summarize([row('/e/ticket_click/etix/event', 5), row('/e/app_store_click/ios/home', 1)]), pv, new Date('2026-10-20T12:00:00Z'));
  assert.match(md, /\| event \| 1000 \| 5 \| 0\.50% \| 0 \| 0\.00% \|/);
  assert.match(md, /\| home \| 50 \| 0 \| 0\.00% \| 1 \| 2\.00% \|/);
  assert.match(md, /\| \*\*all\*\* \| 1050 \| 5 \| 0\.48% \| 1 \| 0\.10% \|/);
  assert.match(md, /Ticket clicks by seller: etix 5\./);
});
