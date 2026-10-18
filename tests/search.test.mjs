import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cleanQuery, renderSearchPage, searchBody, searchCatalog } from '../src/search.mjs';

const template = readFileSync(new URL('../search.html', import.meta.url), 'utf8');
const venueId = '33333333-3333-4333-8333-333333333333';
const show = (over = {}) => ({ id: '11111111-1111-4111-8111-111111111111', title: 'Mission <Night>', date: '2099-11-07T04:00:00Z', timezone: 'America/Denver',
  venue_id: venueId, venue_name: 'Mission Ballroom', venue_address: '4242 Wynkoop St', city: 'Denver', state: 'CO', lifecycle_status: 'scheduled', ...over });

test('query cleaning drops PostgREST syntax and keeps names', () => {
  assert.equal(cleanQuery('  Mr. Bill  '), 'Mr. Bill');
  assert.equal(cleanQuery('a"),title.eq.(x*%\\'), 'a title.eq. x');
  assert.equal(cleanQuery("Cervantes' Masterpiece"), "Cervantes' Masterpiece");
  assert.equal(cleanQuery('Rüfüs Du Sol'), 'Rüfüs Du Sol');
  assert.equal(cleanQuery('x'), '');
  assert.equal(cleanQuery('a'.repeat(80)).length, 60);
});

test('catalog search asks for upcoming published shows by title or venue, plus artists', async () => {
  const urls = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => { urls.push(decodeURIComponent(String(url))); return new Response(JSON.stringify([show()]), { headers: { 'Content-Range': '0-0/1' } }); };
  try {
    const out = await searchCatalog('Mission', new Date('2026-10-18T20:00:00Z'));
    assert.equal(out.events.length, 1);
  } finally { globalThis.fetch = real; }
  const events = urls.find((u) => u.includes('/events?'));
  assert.match(events, /or=\(title\.ilike\."\*Mission\*",venue_name\.ilike\."\*Mission\*"\)/);
  assert.match(events, /status=eq\.published/);
  assert.match(events, /date=gte\.2026-10-18T00:00:00\.000Z/);
  assert.match(urls.find((u) => u.includes('/artists?')), /name=ilike\."\*Mission\*"/);
});

test('results page lists shows, artists and venues, escaped and noindex', () => {
  const html = renderSearchPage(template, 'Mission', { events: [show(), show({ id: '22222222-2222-4222-8222-222222222222', title: 'Other', venue_name: 'Ogden' })], artists: [{ id: '44444444-4444-4444-8444-444444444444', name: 'Mission <X>', genres: ['house'] }] });
  assert.match(html, /<meta name="robots" content="noindex, follow"/);
  assert.match(html, /<link rel="canonical" href="https:\/\/trydropapp\.com\/search"/);
  assert.match(html, /<title>Search: Mission \| Drop<\/title>/);
  assert.match(html, /value="Mission"/);
  assert.match(html, /Results for “Mission”: 2 shows, 1 artist, 1 venue\./);
  assert.match(html, /Mission &lt;Night&gt;<\/strong><\/a><br>Nov 6 · Mission Ballroom · Denver/);
  assert.match(html, /<a href="\/artist\/44444444-4444-4444-8444-444444444444\/mission-x"><strong>Mission &lt;X&gt;/);
  assert.match(html, new RegExp(`<a href="/venue/${venueId}/mission-ballroom-denver"><strong>Mission Ballroom</strong></a><br>Denver · 1 upcoming show<`));
  assert.doesNotMatch(html, /Ogden<\/strong>/, 'venues only when the venue name matches');
  assert.match(html, /href="\/events\?q=Mission">Filter all shows/);
  assert.match(renderSearchPage(template, '"><script>', { events: [], artists: [] }), /value="&quot;&gt;&lt;script&gt;"/);
  assert.match(searchBody('', { events: [], artists: [] }), /at least two letters/);
  assert.match(template, /<form class="search-page-form" role="search" action="\/search" method="get"/);
  assert.match(readFileSync(new URL('../_routes.json', import.meta.url), 'utf8'), /"\/search"/);
  assert.match(readFileSync(new URL('../site.js', import.meta.url), 'utf8'), /'\/search\?q=' \+ encodeURIComponent\(q\)/);
});
