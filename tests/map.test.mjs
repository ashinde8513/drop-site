import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

// Spec 04 pin rules: labels fall back to the date, names carry status, pins
// closer than the 44px hit area cluster, the selected pin never does.
const require = createRequire(import.meta.url);
const M = require('../app/map.js');
const { formatAmount } = require('../app/offers.js');

const ev = { title: 'ODESZA (DJ Set)', venue_name: 'Red Rocks Amphitheatre', date: '2026-10-24T02:00:00Z', timezone: 'America/Denver', price_min: 89, currency: 'USD' };

test('price mode shows the lowest known price; anything else falls back to the date', () => {
  assert.equal(M.pinLabel(ev, 'price', formatAmount), '$89');
  assert.equal(M.pinLabel(ev, 'date', formatAmount), 'Fri 23');
  assert.equal(M.pinLabel({ ...ev, price_min: null, price_max: null }, 'price', formatAmount), 'Fri 23');
  assert.equal(M.pinLabel({ ...ev, price_min: 0 }, 'price', formatAmount), 'Fri 23', 'never "$0"');
  assert.equal(M.pinLabel({ ...ev, price_min: 95.5, currency: 'CAD' }, 'price', formatAmount), 'CAD 95.50');
});

test('pin names read like the board pattern', () => {
  assert.equal(M.pinName(ev, 'going', formatAmount), "Friday 23 Oct, ODESZA (DJ Set) at Red Rocks Amphitheatre, from $89, you're going");
  assert.equal(M.pinName({ ...ev, price_min: null }, null, formatAmount), 'Friday 23 Oct, ODESZA (DJ Set) at Red Rocks Amphitheatre');
  assert.equal(M.pinName(ev, 'interested', formatAmount).endsWith("you're interested"), true);
});

test('counts', () => {
  assert.equal(M.countLabel(0), '0 shows');
  assert.equal(M.countLabel(1), '1 show');
  assert.equal(M.countLabel(12), '12 shows');
});

test('pins inside one hit area cluster; the selected pin stays alone', () => {
  const pts = [{ id: 'a', x: 100, y: 100 }, { id: 'b', x: 120, y: 110 }, { id: 'c', x: 300, y: 300 }, { id: 'd', x: 110, y: 90 }];
  assert.deepEqual(M.cluster(pts, null).map((c) => c.ids), [['a', 'b', 'd'], ['c']]);
  assert.deepEqual(M.cluster(pts, 'b').map((c) => c.ids), [['a', 'd'], ['b'], ['c']]);
  assert.deepEqual(M.cluster([{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 44, y: 0 }], null).map((c) => c.ids), [['a'], ['b']]);
});
