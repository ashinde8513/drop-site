import test from 'node:test';
import assert from 'node:assert/strict';
import { ageLabels, CATEGORIES, knowBeforeYouGo, normalizeIntel } from '../src/venue-facts.mjs';

const venue = '33333333-3333-4333-8333-333333333333';
const now = new Date('2026-10-19T12:00:00Z');
const row = (over = {}) => ({ venue_id: venue, category: 'bag_policy', status: 'fact', summary: 'Clear bags <12in>', source_kind: 'official_venue',
  source_label: 'Venue FAQ', source_url: 'https://venue.test/faq', last_verified_at: '2026-10-01T00:00:00Z', approved_at: '2026-10-02T00:00:00Z', ...over });

test('venue facts follow the native Venue Intel rule', () => {
  const pick = (rows) => normalizeIntel(rows, venue, now).find((item) => item.category === 'bag_policy');
  assert.equal(normalizeIntel([], venue, now).length, CATEGORIES.length);
  assert.ok(normalizeIntel([], venue, now).every((item) => item.status === 'unknown'));
  assert.equal(pick([row()]).status, 'fact');
  assert.equal(pick([row({ last_verified_at: '2026-06-01T00:00:00Z' })]).status, 'stale', 'older than 90 days is withheld');
  assert.equal(pick([row({ approved_at: '2026-11-01T00:00:00Z' })]).status, 'unknown', 'not yet approved');
  assert.equal(pick([row(), row()]).status, 'unknown', 'conflicting rows');
  assert.equal(pick([row({ venue_id: '44444444-4444-4444-8444-444444444444' })]).status, 'unknown');
  assert.equal(pick([row({ source_kind: 'blog' })]).status, 'unknown');
  assert.equal(pick([row({ access_key: 'wheelchair' })]).status, 'unknown', 'access-guide rows are not category facts');
  assert.deepEqual(pick([row({ status: 'unknown', summary: null })]).source, { label: 'Venue FAQ', url: 'https://venue.test/faq' });
  assert.equal(pick([row({ source_url: 'http://venue.test/faq' })]).source.url, null, 'https only');
});

test('know-before-you-go shows facts, withholds stale, and never invents capacity or ages', () => {
  const events = [{ age_restriction: '21+' }, { age_restriction: '21+' }, { age_restriction: 'All Ages' }, {}];
  assert.deepEqual(ageLabels(events), [['21+', 2], ['All ages', 1]]);
  const html = knowBeforeYouGo(normalizeIntel([row(), row({ category: 'water', last_verified_at: '2026-01-01T00:00:00Z' })], venue, now), events);
  assert.match(html, /<section class="ven-section kbyg" data-kbyg aria-labelledby="kbyg-h"><h2 class="sec-h2" id="kbyg-h">Know before you go<\/h2>/);
  const [known, hidden] = html.split('<details');
  assert.match(known, /<strong>Age policy:<\/strong> 21\+ \(2 shows\), All ages \(1 show\) <small>From 3 of 4 upcoming listings; ages are set per show\.<\/small>/);
  assert.match(known, /<strong>Bag policy:<\/strong> Clear bags &lt;12in&gt; <small>Verified 2026-10-01\.<\/small> <a class="kbyg-src" href="https:\/\/venue\.test\/faq" rel="noopener" target="_blank">Venue FAQ ↗<\/a>/);
  assert.match(hidden, /^ class="kbyg-unknown"><summary>Not verified yet \(6\)<\/summary>/, 'known rows exist, so the unknown list starts closed');
  assert.match(hidden, /<strong>Capacity:<\/strong> Unknown<\/li>/);
  assert.match(hidden, /<strong>Water &amp; refill:<\/strong> Needs rechecking — previous guidance is withheld\./);
  assert.match(hidden, /<strong>Lockers:<\/strong> Unknown<\/li>/);
  const none = knowBeforeYouGo(normalizeIntel([], venue, now), []);
  assert.match(none, /<details class="kbyg-unknown" open><summary>Not verified yet \(8\)<\/summary>/, 'nothing known: show the unknowns open');
  assert.match(none, /Age policy:<\/strong> Unknown — set per show; check each listing\./);
});
