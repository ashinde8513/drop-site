import test from 'node:test';
import assert from 'node:assert/strict';
import { query, summarize, ZONE } from '../scripts/conversion-counts.mjs';

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
