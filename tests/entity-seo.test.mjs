import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CITIES, cleanCity, genreCityPaths, knownCity, MIN_GENRE_SHOWS, renderCityPage, renderGenrePage } from '../src/acquisition-seo.mjs';
import { GENERIC_KEYS, GENRE_MAP, genreOf, matchesGenre } from '../src/genres.mjs';
import vm from 'node:vm';
import {
  artistPath, escapeHtml, eventAvailabilityText, eventPath, eventView, indexableEntities,
  isIndexableArtist, isIndexableEvent, isIndexableVenue, renderTemplate, routeId,
  safeAttributionQuery, schemaEventStatus, schemaOfferAvailability, sitemapXml, slugify,
  ticketActionText, venuePath, redirectResponse, plainText, clipText, eventTitle,
} from '../src/entity-seo.mjs';

const id = '11111111-1111-4111-8111-111111111111';
const id2 = '22222222-2222-4222-8222-222222222222';
const venueId = '33333333-3333-4333-8333-333333333333';
const venueId2 = '44444444-4444-4444-8444-444444444444';
const artistId = '55555555-5555-4555-8555-555555555555';
const artistId2 = '66666666-6666-4666-8666-666666666666';

test('city and genre routes render query-specific crawl metadata in initial HTML', () => {
  const routes = JSON.parse(readFileSync(new URL('../_routes.json', import.meta.url), 'utf8'));
  assert.ok(routes.include.includes('/city'));
  assert.ok(routes.include.includes('/genre'));
  assert.equal(cleanCity('<script>'), null);
  assert.equal(cleanCity('Los Angeles'), 'Los Angeles');
  assert.equal(knownCity('los angeles'), 'Los Angeles');
  assert.equal(knownCity('Atlantis'), null);
  const data = readFileSync(new URL('../data.js', import.meta.url), 'utf8');
  const liveCities = [...data.match(/var CITIES = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
  assert.deepEqual(CITIES, liveCities, 'Keep acquisition cities aligned with Drop.CITIES');

  const city = renderCityPage(readFileSync(new URL('../city.html', import.meta.url), 'utf8'), 'Los Angeles');
  assert.match(city, /<title id="doc-title">EDM Shows in Los Angeles \| Drop<\/title>/);
  assert.match(city, /<h1 id="city-h1"[^>]*>EDM shows in Los Angeles<\/h1>/);
  assert.match(city, /<link rel="canonical" href="https:\/\/trydropapp\.com\/city\?city=Los%20Angeles"/);
  assert.match(city, /<meta property="og:url" content="https:\/\/trydropapp\.com\/city\?city=Los%20Angeles"/);
  assert.match(city, /"url":"https:\/\/trydropapp\.com\/city\?city=Los%20Angeles"/);

  const genre = renderGenrePage(readFileSync(new URL('../genre.html', import.meta.url), 'utf8'), 'Drum & Bass', 'Denver', false);
  assert.match(genre, /<title id="doc-title">Drum &amp; Bass Events Near Denver \| Drop<\/title>/);
  assert.match(genre, /<link rel="canonical" href="https:\/\/trydropapp\.com\/genre\?genre=Drum%20%26%20Bass"/);
  assert.match(genre, /<meta property="og:url" content="https:\/\/trydropapp\.com\/genre\?genre=Drum%20%26%20Bass"/);
  assert.match(genre, /"url":"https:\/\/trydropapp\.com\/genre\?genre=Drum%20%26%20Bass"/);
  assert.match(renderGenrePage(readFileSync(new URL('../genre.html', import.meta.url), 'utf8'), 'House', 'Miami', true, false), /name="robots" content="noindex, follow"/);
});

function catalogEvent(overrides = {}) {
  return {
    id, title: 'Main Event', date: '2026-09-01T02:00:00Z', venue_id: venueId,
    venue_name: 'Red Rocks', venue_address: null, city: 'Morrison', state: 'CO',
    lifecycle_status: 'scheduled', ticket_status: 'unknown', event_artists: [],
    ...overrides,
  };
}

test('stable entity paths keep UUID identity and readable slugs', () => {
  assert.equal(slugify('Red Rocks Amphitheatre & Café'), 'red-rocks-amphitheatre-and-cafe');
  assert.equal(eventPath({ id, title: 'BASS BINGO AFTERS' }), `/event/${id}/bass-bingo-afters`);
  assert.equal(venuePath({ id, name: 'Red Rocks', city: 'Morrison' }), `/venue/${id}/red-rocks-morrison`);
  assert.equal(venuePath(catalogEvent()), `/venue/${venueId}/red-rocks-morrison`);
  assert.equal(artistPath({ id, name: 'RL Grime' }), `/artist/${id}/rl-grime`);
  assert.equal(routeId([id, 'ignored']), id);
  assert.equal(routeId(['not-a-uuid']), null);
});

test('canonical redirects preserve only validated attribution query fields', () => {
  assert.equal(
    safeAttributionQuery(`https://trydropapp.com/event/${id}?ref=${id2}&src=event_share&friend=Maya&target=${venueId}`),
    `?ref=${id2}&src=event_share`,
  );
  assert.equal(safeAttributionQuery('https://trydropapp.com/event/x?ref=bad&src=campaign'), '');
  assert.equal(
    redirectResponse(`/event/${id}/main-event`, `https://trydropapp.com/event/${id}?ref=${id2}&src=crew_invite&token=secret`).headers.get('location'),
    `/event/${id}/main-event?ref=${id2}&src=crew_invite`,
  );
});

test('server render adds crawlable metadata, content, and safe JSON-LD', () => {
  const template = '<html><head><title id="doc-title">Old</title><meta name="description" content="Old"><meta property="og:title" content="Old"><meta property="og:description" content="Old"><meta property="og:url" content="old"><meta property="og:image" content="old"><meta name="twitter:title" content="Old"><meta name="twitter:description" content="Old"><meta name="twitter:image" content="old"><link rel="canonical" href="old"></head><body><div class="root" id="event-root"></div></body></html>';
  const html = renderTemplate(template, {
    title: 'Show $& | Drop', description: 'Real $& listing', canonical: 'https://trydropapp.com/event/x', image: 'https://example.com/a.jpg',
    rootId: 'event-root', body: '<h1>Show $&</h1>', jsonLd: { name: '</script><script>alert(1)</script>' }, indexable: false,
  });
  assert.match(html, /<title id="doc-title">Show \$&amp; \| Drop<\/title>/);
  assert.match(html, /rel="canonical" href="https:\/\/trydropapp.com\/event\/x"/);
  assert.match(html, /data-server-entity><h1>Show \$&<\/h1>/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /\\u003c\/script>/);
  assert.match(html, /<meta name="robots" content="noindex, follow">/);
  assert.doesNotMatch(renderTemplate(template, {
    title: 'Show', description: 'Listing', canonical: 'https://trydropapp.com/event/x', image: '',
    rootId: 'event-root', body: '', jsonLd: {},
  }), /name="robots"/);
});

test('index gate fails closed and requires useful aggregate content', () => {
  const valid = catalogEvent();
  assert.equal(isIndexableEvent(valid), true);
  for (const patch of [
    { id: 'bad' }, { title: ' ' }, { date: 'not-a-date' }, { venue_id: null },
    { venue_name: '' }, { venue_address: '', city: '', state: '' },
  ]) assert.equal(isIndexableEvent({ ...valid, ...patch }), false);
  assert.equal(isIndexableEvent({ ...valid, city: '', state: '', venue_address: '18300 W Alameda Pkwy' }), true);

  const second = catalogEvent({ id: id2, title: 'Second Event' });
  const venue = { id: venueId, name: 'Red Rocks', city: 'Morrison', state: 'CO' };
  assert.equal(isIndexableVenue({ venue, events: [valid] }), false);
  assert.equal(isIndexableVenue({ venue, events: [valid, valid] }), false);
  assert.equal(isIndexableVenue({ venue, events: [valid, second] }), true);
  assert.equal(isIndexableVenue({ venue: { ...venue, city: '', state: '' }, events: [valid, second] }), false);

  const artist = { id: artistId, name: 'Artist' };
  assert.equal(isIndexableArtist({ artist, events: [valid] }), false);
  assert.equal(isIndexableArtist({ artist, events: [valid, valid] }), false);
  assert.equal(isIndexableArtist({ artist: { ...artist, genres: ['House'] }, events: [valid] }), true);
  assert.equal(isIndexableArtist({ artist, events: [valid, second] }), true);
  assert.equal(isIndexableArtist({ artist: { ...artist, id: 'bad' }, events: [valid, second] }), false);
});

test('lifecycle and ticket mappings never infer availability from a URL', () => {
  assert.deepEqual(['scheduled', 'cancelled', 'postponed'].map(schemaEventStatus), [
    'https://schema.org/EventScheduled', 'https://schema.org/EventCancelled', 'https://schema.org/EventPostponed',
  ]);
  assert.equal(schemaEventStatus('unknown'), undefined);
  assert.deepEqual(['available', 'sold_out', 'unavailable'].map(schemaOfferAvailability), [
    'https://schema.org/InStock', 'https://schema.org/SoldOut', 'https://schema.org/OutOfStock',
  ]);
  assert.equal(schemaOfferAvailability('unknown'), undefined);
  assert.equal(schemaOfferAvailability('rsvp'), undefined);
  assert.equal(eventAvailabilityText({ lifecycle_status: 'cancelled', ticket_status: 'available' }), 'Event canceled');
  assert.equal(eventAvailabilityText({ lifecycle_status: 'postponed', ticket_status: 'available' }), 'Event postponed');
  assert.equal(eventAvailabilityText({ ticket_status: 'sold_out' }), 'Tickets sold out');
  assert.equal(eventAvailabilityText({ ticket_status: 'unavailable' }), 'Tickets currently unavailable');
  assert.equal(eventAvailabilityText({ ticket_status: 'rsvp' }), 'RSVP required');
  assert.equal(eventAvailabilityText({ ticket_status: 'unknown', ticket_url: 'https://tickets.example/show' }), 'Check ticket availability');
  assert.equal(ticketActionText({ lifecycle_status: 'scheduled', ticket_status: 'available' }), 'Get tickets');
  assert.equal(ticketActionText({ lifecycle_status: 'scheduled', ticket_status: 'rsvp' }), 'RSVP');
  assert.equal(ticketActionText({ lifecycle_status: 'cancelled', ticket_status: 'available' }), 'View ticket details');
});

test('event view emits useful Event data without trusting catalog HTML', () => {
  const view = eventView({
    id, title: '<Main Event>', description: '<b>official</b>', date: '2026-09-01T02:00:00Z',
    venue_id: id, venue_name: 'Red Rocks', city: 'Morrison', state: 'CO', currency: 'USD',
    timezone: 'America/Denver', lifecycle_status: 'scheduled', ticket_status: 'available',
    ticket_url: 'javascript:alert(1)', image_url: 'javascript:alert(2)',
    event_artists: [{ artists: { id, name: 'Artist & Co' } }],
  });
  assert.match(view.body, /&lt;Main Event&gt;/);
  assert.doesNotMatch(view.body, /<b>official<\/b>/);
  assert.equal(view.jsonLd['@type'], 'MusicEvent');
  assert.equal(view.jsonLd.url, `https://trydropapp.com/event/${id}/main-event`);
  assert.equal(view.jsonLd.eventStatus, 'https://schema.org/EventScheduled');
  assert.equal(view.jsonLd.offers, undefined);
  assert.equal(view.indexable, true);
  assert.doesNotMatch(view.body, /javascript:/);
});

test('event view keeps canceled/unknown ticket markup and visible status aligned', () => {
  const view = eventView(catalogEvent({
    lifecycle_status: 'cancelled', ticket_status: 'unknown', ticket_url: 'https://tickets.example/show',
  }));
  assert.equal(view.jsonLd.eventStatus, 'https://schema.org/EventCancelled');
  assert.equal(view.jsonLd.offers.url, 'https://tickets.example/show');
  assert.equal(view.jsonLd.offers.availability, undefined);
  assert.match(view.body, /Event canceled/);
  assert.match(view.body, /View ticket details/);
});

test('entity sitemap excludes malformed events and thin venue/artist pages', () => {
  const richArtist = { id: artistId, name: 'Artist' };
  const thinArtist = { id: artistId2, name: 'One-Off' };
  const rows = [
    catalogEvent({ title: 'A & B', created_at: '2026-08-02T00:00:00Z', event_artists: [{ artists: richArtist }] }),
    catalogEvent({ id: id2, title: 'Second Event', event_artists: [{ artists: richArtist }] }),
    catalogEvent({ id: '77777777-7777-4777-8777-777777777777', title: 'One-Off Event', venue_id: venueId2, venue_name: 'One-Off Hall', city: 'Denver', state: 'CO', event_artists: [{ artists: thinArtist }] }),
    catalogEvent({ id: 'bad', title: 'Malformed Event' }),
  ];
  const entities = indexableEntities(rows);
  const xml = sitemapXml(entities);
  assert.equal(entities.events.length, 3);
  assert.deepEqual(entities.venues.map((venue) => venue.id), [venueId]);
  assert.deepEqual(entities.artists.map((artist) => artist.id), [artistId]);
  assert.equal((xml.match(/<url>/g) || []).length, 5);
  assert.match(xml, /a-and-b/);
  assert.match(xml, /<lastmod>2026-08-02<\/lastmod>/);
  assert.doesNotMatch(xml, /malformed-event|one-off-hall|one-off<\/loc>/);
  assert.equal(escapeHtml('A&B'), 'A&amp;B');
});

test('catalog HTML descriptions become clean plain text everywhere', () => {
  assert.equal(plainText('<p style="margin:0;">Doors 8pm&nbsp;&amp; <b>18+</b></p><script>x()</script>'), 'Doors 8pm & 18+');
  assert.equal(plainText('&lt;p&gt;Double &amp;amp; encoded&lt;/p&gt;'), 'Double &amp; encoded');
  assert.equal(plainText('Caf&#233; &#x1F3B6;'), 'Caf\u00e9 \u{1F3B6}');
  assert.equal(plainText(null), '');
  assert.equal(plainText('Love <3 this crew. Doors > 9pm<!-- a > b -->'), 'Love <3 this crew. Doors > 9pm');
  assert.equal(plainText('&lt;3 &lt;b&gt;bold&lt;/b&gt;'), '<3 bold');
  const view = eventView(catalogEvent({ description: '<p style="margin:0;">' + 'Bass night '.repeat(30) + '</p>' }));
  assert.doesNotMatch(view.description + view.body + view.jsonLd.description, /&lt;p|margin:0|&quot;/);
  assert.ok(view.description.length <= 155);
  assert.match(view.description, /night…$/);
});

test('clipText cuts on a word boundary', () => {
  assert.equal(clipText('short', 155), 'short');
  assert.equal(clipText('alpha beta gamma delta', 15), 'alpha beta…');
});

test('event titles carry the local date and JSON-LD skips a zero-length endDate', () => {
  const event = catalogEvent({ date: '2026-09-01T02:00:00Z', end_date: '2026-09-01T02:00:00Z', timezone: 'America/Denver' });
  assert.equal(eventTitle(event), 'Main Event at Red Rocks · Aug 31 | Drop');
  assert.equal(eventView(event).title, eventTitle(event));
  assert.equal(eventView(event).jsonLd.endDate, undefined);
  assert.equal(eventView(catalogEvent({ end_date: '2026-09-02T06:00:00Z' })).jsonLd.endDate, '2026-09-02T06:00:00Z');
  assert.equal(eventTitle(catalogEvent({ date: 'bad', timezone: 'Not/AZone' })), 'Main Event at Red Rocks | Drop');
  assert.equal(eventTitle(catalogEvent({ date: '2026-10-18T00:00:00Z', time_tbd: true, timezone: 'America/Denver' })), 'Main Event at Red Rocks · Oct 18 | Drop');
});

test('og:image size tags are dropped for non-default event art', () => {
  const template = '<html><head><title>Old</title><meta property="og:image" content="old"><meta property="og:image:type" content="image/png" /><meta property="og:image:width" content="1200" /><meta property="og:image:height" content="630" /><meta property="og:image:alt" content="Drop" /></head><body><div id="r"></div></body></html>';
  const base = { title: 'Show | Drop', description: 'd', canonical: 'https://trydropapp.com/x', rootId: 'r', body: '', jsonLd: {} };
  const art = renderTemplate(template, { ...base, image: 'https://cdn.example/a.jpg' });
  assert.doesNotMatch(art, /og:image:(type|width|height)/);
  assert.match(art, /og:image:alt" content="Show \| Drop"/);
  const fallback = renderTemplate(template, { ...base, image: 'https://trydropapp.com/og-image.png' });
  assert.match(fallback, /og:image:width/);
});

test('city pages carry crawlable, escaped links to upcoming indexable shows', () => {
  const template = readFileSync(new URL('../city.html', import.meta.url), 'utf8');
  const events = [
    catalogEvent({ title: 'Bass <Night> & Co', date: '2026-11-07T04:00:00Z', timezone: 'America/Denver', venue_name: 'Mission Ballroom' }),
    catalogEvent({ id: id2, title: 'TBA Show', date: '2026-11-08T00:00:00Z', time_tbd: true, timezone: 'America/Denver' }),
  ];
  const html = renderCityPage(template, 'Denver', events);
  const rail = html.match(/<div class="rail" id="rail-city-weekend"[^>]*>([\s\S]*?)<\/ul>/)[1];
  assert.match(rail, /<h3>Upcoming shows in Denver<\/h3>/);
  assert.match(rail, new RegExp(`<a href="/event/${id}/bass-night-and-co">Bass &lt;Night&gt; &amp; Co</a> — <a href="/venue/${venueId}/mission-ballroom-morrison">Mission Ballroom</a>, Nov 6`));
  assert.match(rail, /TBA Show<\/a> — <a [^>]+>Red Rocks<\/a>, Nov 8/);
  assert.doesNotMatch(renderCityPage(template, 'Denver'), /data-server-entity/);
  assert.match(renderCityPage(template, 'Denver', [catalogEvent({ timezone: 'Not/AZone' })]), /Main Event<\/a> — <a [^>]+>Red Rocks<\/a>, Sep 1/);
});

const withGenres = (genres, extra = {}) => catalogEvent({ event_artists: [{ artists: { id: artistId, name: 'A', genres } }], ...extra });

test('server genre bucketing matches data.js exactly', () => {
  const window = {};
  vm.runInNewContext(readFileSync(new URL('../data.js', import.meta.url), 'utf8'), { window, document: { addEventListener() {} }, navigator: { userAgent: '' }, location: { search: '', hostname: 'localhost' }, localStorage: { getItem() { return null; }, setItem() {} }, console, URL, URLSearchParams, fetch: () => Promise.reject(new Error('offline')) });
  const Drop = window.Drop;
  const source = readFileSync(new URL('../data.js', import.meta.url), 'utf8');
  // JSON round-trip: VM-realm arrays fail strict deep equality on prototype.
  const clientMap = JSON.parse(vm.runInNewContext('JSON.stringify(' + source.match(/var GENRE_MAP = (\[[\s\S]*?\]);/)[1] + ')'));
  assert.deepEqual(clientMap.map(({ label, keys }) => ({ label, keys })), GENRE_MAP);
  assert.deepEqual(JSON.parse(vm.runInNewContext('JSON.stringify(' + source.match(/var GENERIC_KEYS = (\[[^\]]*\]);/)[1] + ')')), [...GENERIC_KEYS]);
  const samples = [[], ['edm'], ['edm', 'dubstep'], ['tech house'], ['Melodic Techno'], ['drum and bass'], ['indie pop'], ['pop'], ['rnb'], ['hardstyle'], ['jungle', 'electronic'], ['jazz']];
  for (const genres of samples) {
    const event = withGenres(genres);
    assert.equal(genreOf(event), Drop.genreOf(event), JSON.stringify(genres));
  }
  assert.equal(genreOf(withGenres(['house'], { is_festival: true })), Drop.genreOf(withGenres(['house'], { is_festival: true })));
  assert.equal(matchesGenre(withGenres(['edm', 'techno']), 'Techno'), true);
  assert.equal(matchesGenre(withGenres(['indie']), 'House'), false);
});

test('city × genre pages show real shows, ItemList schema, and gate indexing on show count', () => {
  const template = readFileSync(new URL('../genre.html', import.meta.url), 'utf8');
  const shows = Array.from({ length: MIN_GENRE_SHOWS }, (_, i) => withGenres(['tech house'], { id: `00000000-0000-4000-8000-00000000000${i}`, title: `House ${i}`, city: 'Chicago', state: 'IL' }));
  const live = renderGenrePage(template, 'House', 'Chicago', true, true, shows);
  assert.doesNotMatch(live, /name="robots"/);
  assert.match(live, /<h3>Upcoming House shows in Chicago<\/h3>/);
  assert.match(live, /href="\/event\/00000000-0000-4000-8000-000000000000\/house-0">House 0<\/a>/);
  const ld = JSON.parse(live.match(/<script type="application\/ld\+json" data-server-ldjson>([\s\S]*?)<\/script>/)[1]);
  assert.equal(ld['@type'], 'ItemList');
  assert.equal(ld.itemListElement.length, MIN_GENRE_SHOWS);
  assert.equal(ld.itemListElement[0].item['@type'], 'MusicEvent');
  assert.equal(ld.itemListElement[0].item.location['@type'], 'Place');
  assert.match(renderGenrePage(template, 'House', 'Chicago', true, true, shows.slice(1)), /name="robots" content="noindex, follow"/);
  assert.doesNotMatch(renderGenrePage(template, 'House', 'Chicago', true, true, null), /name="robots"|data-server-entity/);
});

test('city pages link their live genres and the sitemap lists qualifying city × genre pages', () => {
  const template = readFileSync(new URL('../city.html', import.meta.url), 'utf8');
  const chicago = Array.from({ length: MIN_GENRE_SHOWS }, (_, i) => withGenres(['dubstep'], { id: `00000000-0000-4000-8000-00000000001${i}`, city: 'Chicago', state: 'IL' }));
  const html = renderCityPage(template, 'Chicago', [...chicago, withGenres(['techno'], { city: 'Chicago' })]);
  assert.match(html, /<a href="\/genre\?genre=Bass&amp;city=Chicago">Bass in Chicago<\/a>/);
  assert.match(renderCityPage(template, 'Denver', chicago.map((e) => ({ ...e, city: 'Denver' }))), /<a href="\/genre\?genre=Bass">Bass in Denver<\/a>/);
  assert.doesNotMatch(html, /genre=Techno&amp;city=Chicago/);
  const denver = Array.from({ length: MIN_GENRE_SHOWS }, () => withGenres(['dubstep'], { city: 'Denver' }));
  assert.deepEqual(genreCityPaths([...chicago, ...denver]), ['/genre?genre=Bass&city=Chicago']);
  const xml = sitemapXml({ events: [], venues: [], artists: [] }, genreCityPaths(chicago));
  assert.match(xml, /<loc>https:\/\/trydropapp\.com\/genre\?genre=Bass&amp;city=Chicago<\/loc>/);
});

test('venue pages describe their shows as MusicEvent at a Place', async () => {
  const { venueView } = await import('../src/entity-seo.mjs');
  const event = catalogEvent({ venue_address: '1 Main St' });
  const view = venueView({ venue: { id: venueId, name: 'Red Rocks', city: 'Morrison', state: 'CO', address: '1 Main St' }, events: [event, { ...event, id: id2 }] });
  assert.equal(view.jsonLd.event[0]['@type'], 'MusicEvent');
  assert.equal(view.jsonLd.event[0].location['@type'], 'Place');
  assert.equal(view.jsonLd.event[0].location.address.streetAddress, '1 Main St');
});

test('event pages hand the Smart App Banner their canonical URL', () => {
  const template = readFileSync(new URL('../event.html', import.meta.url), 'utf8');
  assert.match(template, /<meta name="apple-itunes-app" content="app-id=6790662825" \/>/);
  const view = eventView(catalogEvent());
  const html = renderTemplate(template, { ...view, rootId: 'event-root' });
  assert.match(html, new RegExp(`<meta name="apple-itunes-app" content="app-id=6790662825, app-argument=https://trydropapp.com/event/${id}/main-event" />`));
  const attributed = renderTemplate(template, { ...view, rootId: 'event-root', appArgument: view.canonical + safeAttributionQuery(`https://trydropapp.com/x?ref=${id}&src=event_share&u=leak`) });
  assert.match(attributed, new RegExp(`app-argument=https://trydropapp.com/event/${id}/main-event\\?ref=${id}&amp;src=event_share" />`));
  assert.doesNotMatch(attributed, /leak/);
});

test('city FAQ ships server-rendered with matching FAQPage schema and client copy', async () => {
  const { cityFaq } = await import('../src/acquisition-seo.mjs');
  const template = readFileSync(new URL('../city.html', import.meta.url), 'utf8');
  const html = renderCityPage(template, 'Chicago');
  const faq = cityFaq('Chicago');
  const list = html.match(/<div class="faq-list" id="city-faq"[^>]*>([\s\S]*?)<\/div>/)[1];
  assert.equal((list.match(/<details class="faq-item">/g) || []).length, faq.length);
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json" data-server-faq>([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(ld.mainEntity.map((q) => [q.name, q.acceptedAnswer.text]), faq.map(({ q, a }) => [q, a]));
  const clientArray = template.match(/var faq = (\[[\s\S]*?\]);/)[1];
  const client = JSON.parse(vm.runInNewContext('JSON.stringify(' + clientArray + ')', { city: 'Chicago' }));
  assert.deepEqual(client, faq, 'server and client FAQ copy must match');
});

test('Function HTML is edge-cached per URL and deploy, 200s only', async () => {
  const { edgeCached } = await import('../src/entity-seo.mjs');
  const store = new Map();
  globalThis.caches = { default: { match: async (k) => store.get(k)?.clone(), put: async (k, r) => { store.set(k, r); } } };
  const pending = [];
  const ctx = (url, sha = 'abc', method = 'GET') => ({ request: new Request(url, { method }), env: { CF_PAGES_COMMIT_SHA: sha }, waitUntil: (p) => pending.push(p) });
  let renders = 0;
  const page = () => { renders++; return new Response('<p>' + renders + '</p>', { status: 200 }); };
  try {
    assert.equal(await (await edgeCached(ctx('https://trydropapp.com/city?city=Denver'), page)).text(), '<p>1</p>');
    await Promise.all(pending);
    assert.equal(await (await edgeCached(ctx('https://trydropapp.com/city?city=Denver'), page)).text(), '<p>1</p>');
    assert.equal(await (await edgeCached(ctx('https://trydropapp.com/city?city=Denver', 'def'), page)).text(), '<p>2</p>', 'new deploy misses');
    assert.equal(await (await edgeCached(ctx('https://trydropapp.com/city?city=Chicago'), page)).text(), '<p>3</p>');
    await edgeCached(ctx('https://trydropapp.com/city?city=Denver', 'abc', 'HEAD'), page);
    assert.equal(renders, 4, 'HEAD bypasses the cache');
    await edgeCached(ctx('https://trydropapp.com/event/x'), () => new Response('gone', { status: 404 }));
    await Promise.all(pending);
    assert.ok(![...store.keys()].some((k) => k.includes('/event/x')), '404s are not cached');
  } finally {
    delete globalThis.caches;
  }
});
