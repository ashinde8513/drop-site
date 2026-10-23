import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

// Spec 01 seller rules. Matching and collapse vectors are the native ones
// (DropApp src/lib/eventOfferMatch.test.ts, mobileJourneyPricing.test.ts);
// the tag drops ticket_class, which does not exist live.
const O = createRequire(import.meta.url)('../app/offers.js');

const bonnie = { id: 'tm', title: 'Bonnie X Clyde', date: '2026-07-26T04:00:00+00:00', city: 'Denver', venue_name: 'The Church Nightclub', source: 'ticketmaster', event_artists: [{ artist_id: 'bonnie' }] };
const ids = (anchor, rows) => O.comparableOfferEventIds(anchor, rows).join(',');

test('same show joins across sources only with venue proof', () => {
  assert.equal(ids('tm', [bonnie, { ...bonnie, id: 'sg', venue_name: 'The Church Nightclub - Denver', source: 'seatgeek' }]), 'tm,sg');
  assert.equal(ids('tm', [bonnie, { ...bonnie, id: 'sg', source: 'seatgeek' }, { ...bonnie, id: 'etix', source: 'etix' }]), 'tm,sg,etix');
  assert.equal(ids('tm', [bonnie, { ...bonnie, id: 'tm2' }]), 'tm,tm2');
  assert.equal(ids('tm', [bonnie, { ...bonnie, id: 'sg', source: 'seatgeek', venue_name: 'Mission Ballroom' }]), 'tm');
  const mirage = { ...bonnie, venue_name: 'Brooklyn Mirage', city: 'New York' };
  assert.equal(ids('tm', [mirage, { ...mirage, id: 'sg', source: 'seatgeek', venue_name: 'Brooklyn Steel' }]), 'tm');
  const accented = { ...bonnie, venue_name: 'Théâtre Rialto', city: 'Montréal' };
  assert.equal(ids('tm', [accented, { ...accented, id: 'sg', source: 'seatgeek', venue_name: 'Theatre Rialto', city: 'Montreal' }]), 'tm,sg');
});

test('canonical venue ids are authoritative; title alone never joins', () => {
  const anchor = { ...bonnie, venue_id: 'church' };
  assert.equal(ids('tm', [anchor, { ...anchor, id: 'sg', source: 'seatgeek', venue_id: 'mission', venue_name: 'Mission Ballroom' }]), 'tm');
  assert.equal(ids('tm', [anchor, { ...anchor, id: 'sg', source: 'seatgeek', venue_id: 'church-afterparty' }]), 'tm');
  const trees = { ...bonnie, id: 'tm-trees', title: 'Of The Trees', venue_id: 'armory', venue_name: 'The Armory - Minneapolis', event_artists: [{ artist_id: 'trees', position: 0 }] };
  assert.equal(ids('tm-trees', [trees, { ...trees, id: 'sg-trees', source: 'seatgeek', title: 'Of The Trees with Eazybaked', venue_name: 'Armory' }]), 'tm-trees,sg-trees');
  const opener = { ...bonnie, event_artists: [{ artist_id: 'bonnie', position: 0 }, { artist_id: 'opener', position: 1 }] };
  assert.equal(ids('tm', [opener, { ...opener, id: 'sg', source: 'seatgeek', title: 'Different headliner', event_artists: [{ artist_id: 'other', position: 0 }, { artist_id: 'opener', position: 1 }] }]), 'tm');
});

test('three-hour drift only when exactly one side is time-TBD in the same zone', () => {
  const anchor = { ...bonnie, time_tbd: true, timezone: 'America/Denver' };
  const shifted = { ...bonnie, id: 'sg', source: 'seatgeek', date: '2026-07-26T05:00:00+00:00', time_tbd: false, timezone: 'America/Denver' };
  assert.equal(ids('tm', [anchor, shifted, { ...bonnie, id: 'later', source: 'etix', date: '2026-07-26T12:01:00+00:00' }]), 'tm,sg');
  assert.equal(ids('tm', [anchor, { ...shifted, timezone: 'America/Chicago' }]), 'tm');
  assert.equal(ids('tm', [bonnie, shifted]), 'tm');
  const late = { ...bonnie, venue_id: 'church' };
  assert.equal(ids('tm', [late, { ...late, id: 'tm-late', date: '2026-07-26T08:00:00+00:00' }, { ...late, id: 'sg', source: 'seatgeek' }]), 'tm,sg');
});

test('link vetting keeps price-only rows and Etix only via the owned link', () => {
  const owned = 'https://etix.prf.hn/click/camref:1100l5NLJm/pubref:123/destination:' + encodeURIComponent('https://www.etix.com/ticket/p/123/show');
  const rows = O.usableTicketOffers([
    { vendor: 'Etix', url: owned }, { vendor: 'Etix', url: 'https://www.etix.com/ticket/p/123' },
    { vendor: 'AXS', url: null }, { vendor: 'Tixr', url: 'javascript:alert(1)' }, { vendor: 'DICE', url: 'https://u:p@dice.fm/x' },
    { vendor: 'Other', url: 'https://etix.prf.hn/click/camref:OTHER/pubref:123/destination:x' }, { vendor: 'AXS', url: 'https://www.axs.com/e/1' },
  ]);
  assert.deepEqual(rows.map((r) => r.url), [owned, null, 'https://www.axs.com/e/1']);
});

test('duplicate same-seller rows collapse; distinct channels stay', () => {
  const one = O.bestOfferPerVendor([
    { id: 'old', vendor: 'SeatGeek', url: 'https://seatgeek.example/old', price_min: 30, fetched_at: '2026-07-01T00:00:00Z' },
    { id: 'new-empty', vendor: 'seatgeek', url: 'https://seatgeek.example/new', price_min: null, fetched_at: '2026-07-03T00:00:00Z' },
    { id: 'new-priced', vendor: 'SEATGEEK', url: 'https://seatgeek.example/newer', price_min: 28, fetched_at: '2026-07-04T00:00:00Z' },
  ]);
  assert.deepEqual(one.map((o) => o.id), ['new-priced']);
  const split = O.bestOfferPerVendor([
    { id: 'priced', vendor: 'SeatGeek', url: null, price_min: null, price_max: 42, fetched_at: '2026-07-01T00:00:00Z' },
    { id: 'linked', vendor: 'seatgeek', url: 'https://seatgeek.example', price_min: null, price_max: null, fetched_at: '2026-07-03T00:00:00Z' },
  ]);
  assert.equal(split[0].url, 'https://seatgeek.example');
  assert.equal(split[0].price_max, 42);
  const two = O.bestOfferPerVendor([
    { id: 'affiliate', vendor: 'Eventim', url: 'https://wl.eventim.us/event/one', price_min: 35 },
    { id: 'see', vendor: 'Eventim', url: 'https://prod-nts-api.seeticketsusa.us/event/two', price_min: 30 },
    { id: 'see-new', vendor: 'eventim', url: 'https://prod-nts-api.seeticketsusa.us/event/two-new', price_min: 28 },
  ]);
  assert.deepEqual(two.map((o) => o.id).sort(), ['affiliate', 'see']);
});

test('A50 price format', () => {
  assert.equal(O.formatAmount(89, 'USD'), '$89');
  assert.equal(O.formatAmount(89.5, 'USD'), '$89.50');
  assert.equal(O.formatAmount(1250, 'USD'), '$1,250');
  assert.equal(O.formatAmount(80, 'EUR'), '€80');
  assert.equal(O.formatAmount(80, 'GBP'), '£80');
  assert.equal(O.formatAmount(95, 'CAD'), 'CAD 95');
  assert.equal(O.formatAmount(95.5, 'CAD'), 'CAD 95.50');
});

const now = Date.parse('2026-09-10T12:00:00Z');
const a = { id: 'a', vendor: 'AXS', url: 'https://a.example/a', price_min: 45, price_max: null, currency: 'USD', price_includes_fees: false, kind: 'primary', last_seen_at: '2026-09-10T10:00:00Z' };
const b = { ...a, id: 'b', vendor: 'Ticketmaster', url: 'https://b.example/b', price_min: 90 };
const card = (offers) => O.ticketRows(offers, now);

test('tag only when comparable; cheapest-first only then', () => {
  let c = card([b, a]);
  assert.deepEqual(c.tag, { id: 'a', text: 'Lowest listed' });
  assert.deepEqual(c.rows.map((r) => [r.seller, r.amount, r.tag]), [['AXS', '$45', 'Lowest listed'], ['Ticketmaster', '$90', '']]);
  c = card([b, { ...a, last_seen_at: '2026-08-01T00:00:00Z' }]);
  assert.deepEqual(c.tag, { id: 'b', text: 'Lowest known' });
  assert.deepEqual(c.rows.map((r) => [r.seller, r.amount, r.line]), [['Ticketmaster', '$90', ''], ['AXS', null, 'Previous quote expired']]);
  // Not comparable: no tag, A–Z.
  for (const other of [{ ...a, currency: 'CAD' }, { ...a, price_includes_fees: true }, { ...a, kind: 'resale' }, { ...a, price_min: 90 }]) {
    c = card([{ ...b, vendor: 'Zed' }, other]);
    assert.equal(c.tag, null);
    assert.deepEqual(c.rows.map((r) => r.seller), ['AXS', 'Zed']);
  }
  assert.equal(card([a]).tag, null);
  assert.equal(card([{ ...a, last_seen_at: null }, b]).tag.id, 'b', 'unknown freshness never wins the tag');
});

test('unknown, stale and unverified prices read Live price; captions only from data', () => {
  const rows = card([
    { ...a, id: 'n', vendor: 'Etix', price_min: null },
    { ...a, id: 'cur', vendor: 'DICE', currency: null },
    { ...a, id: 'fees', vendor: 'Tixr', price_min: 98.5, price_includes_fees: true },
    { ...a, id: 'max', vendor: 'AXS', price_min: 92, price_max: 140 },
  ]).rows;
  const by = Object.fromEntries(rows.map((r) => [r.id, r]));
  assert.equal(by.n.amount, null); assert.equal(by.n.line, 'See current total on seller site');
  assert.equal(by.cur.amount, null);
  assert.equal(by.fees.amount, '$98.50'); assert.equal(by.fees.caption, 'Fees included');
  assert.equal(by.max.caption, 'up to $140');
  assert.equal(O.freshness(null, now), 'unknown');
  assert.equal(O.freshness('bad', now), 'unknown');
  assert.equal(O.freshness('2099-01-01', now), 'unknown');
});
