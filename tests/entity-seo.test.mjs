import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CITIES, cityPaths, cleanCity, genreCitiesBlock, genreCityPaths, genreOtherCities, knownCity, MIN_GENRE_SHOWS, renderCityPage, renderGenrePage } from '../src/acquisition-seo.mjs';
import { GENERIC_KEYS, GENRE_MAP, genreOf, matchesGenre } from '../src/genres.mjs';
import vm from 'node:vm';
import {
  artistPath, escapeHtml, eventAvailabilityText, eventPath, eventView, indexableEntities,
  isIndexableArtist, isIndexableEvent, isIndexableVenue, renderTemplate, routeId,
  safeAttributionQuery, schemaEventStatus, schemaOfferAvailability, sitemapXml, slugify,
  ticketActionText, venuePath, redirectResponse, plainText, clipText, eventTitle, countryOf, getArtist, sitemapEntities, venueDirectoryHtml, withVenueDirectory,
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
  assert.equal(isIndexableArtist({ artist: { ...artist, genres: ['House'] }, events: [valid] }), false, 'auto-filled genres alone are thin');
  assert.equal(isIndexableArtist({ artist: { ...artist, image_url: 'https://img.test/a.jpg' }, events: [valid] }), true);
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

test('sitemap lists shows in the next 30 days and artists with 3+ shows; pages stay indexable', () => {
  const now = new Date('2026-10-21T12:00:00Z');
  const big = { id: artistId, name: 'Headliner' }, small = { id: artistId2, name: 'Opener', image_url: 'https://x.test/a.jpg' };
  const ev = (n, date, artists) => catalogEvent({ id: `1111111${n}-1111-4111-8111-111111111111`, title: 'Show ' + n, date, event_artists: artists.map((a) => ({ artists: a })) });
  const rows = [ev(1, '2026-10-25T02:00:00Z', [big, small]), ev(2, '2026-11-15T02:00:00Z', [big, small]), ev(3, '2027-01-10T02:00:00Z', [big])];
  const entities = indexableEntities(rows);
  assert.deepEqual(entities.artists.map((a) => [a.name, a.count]), [['Headliner', 3], ['Opener', 2]]);
  assert.equal(entities.venues[0].count, 3);
  const trimmed = sitemapEntities(entities, now);
  assert.deepEqual(trimmed.events.map((e) => e.title), ['Show 1', 'Show 2']);
  assert.deepEqual(trimmed.artists.map((a) => a.name), ['Headliner']);
  assert.equal(trimmed.venues.length, 1);
  assert.equal(entities.events.length, 3, 'the trim never drops pages from the index gate');
  assert.match(readFileSync(new URL('../functions/sitemap-entities.xml.js', import.meta.url), 'utf8'), /sitemapXml\(sitemapEntities\(entities\), \[\.\.\.cityPaths\(entities\.events\)/);
});

test('/venues server-renders crawlable directory rows the page script then replaces', () => {
  const html = venueDirectoryHtml([
    { id: venueId, name: 'Red <Rocks>', city: 'Morrison', state: 'CO', count: 9 },
    { id: venueId2, name: 'Ogden', city: 'Denver', state: 'CO', count: 12 },
    { id: id2, name: 'Fillmore SF', city: 'San Francisco', state: 'CA', count: 1 },
  ]);
  assert.ok(html.indexOf('>CO<') < html.indexOf('>CA<'), 'bigger state first');
  assert.ok(html.indexOf('Ogden') < html.indexOf('Red &lt;Rocks&gt;'), 'busiest venue first');
  assert.match(html, new RegExp(`<a class="v-row" href="/venue/${venueId}/red-rocks-morrison" aria-label="Red &lt;Rocks&gt; — 9 upcoming shows">`));
  assert.match(html, /Denver · 12 upcoming shows/);
  assert.match(html, /San Francisco · 1 upcoming show</);
  assert.doesNotMatch(html, /<Rocks>/);
  const template = readFileSync(new URL('../venues.html', import.meta.url), 'utf8');
  const page = withVenueDirectory(template, [{ id: venueId, name: '$& Hall', city: 'Denver', state: 'CO', count: 2 }]);
  assert.match(page, /<div id="grid-venues"><div class="v-group" data-ssr>.*\$&amp; Hall/s);
  assert.match(readFileSync(new URL('../functions/venues.js', import.meta.url), 'utf8'), /htmlResponse\(withVenueDirectory\(template, venues\)/);
  assert.match(template, /if \(!host\.querySelector\('\[data-ssr\]'\)\) D\.skeletonGrid\(host, 6\);/);
  assert.ok(JSON.parse(readFileSync(new URL('../_routes.json', import.meta.url), 'utf8')).include.includes('/venues'));
});

test('home lists every city hub plus /venues and /artists as crawlable links', () => {
  const home = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const nav = home.match(/<nav aria-label="Explore Drop by city">([\s\S]*?)<\/nav>/)[1];
  assert.deepEqual([...nav.matchAll(/href="([^"]+)"/g)].map((m) => m[1]), CITIES.map((city) => '/city?city=' + encodeURIComponent(city)));
  assert.match(home, /<a class="link-more" href="\/venues">All venues →<\/a>/);
  assert.match(home, /<a class="link-more" href="\/artists">All artists →<\/a>/);
  assert.match(readFileSync(new URL('../site.css', import.meta.url), 'utf8'), /ul\.chip-row \{ list-style: none; padding: 0; \}/);
});

test('genre pages server-render "<Genre> in other cities" from the sitemap rule', () => {
  const house = { id: artistId, name: 'DJ', genres: ['house'] };
  const ev = (n, city) => catalogEvent({ id: `2222222${n}-2222-4222-8222-22222222222${n}`, title: 'Show ' + n, city, event_artists: [{ artists: house }] });
  const catalog = [ev(1, 'Denver'), ev(2, 'Denver'), ev(3, 'Denver'), ev(4, 'Seattle'), ev(5, 'Seattle'), ev(6, 'Seattle'), ev(7, 'Austin')];
  assert.deepEqual(genreOtherCities('House', 'Seattle', catalog), ['Denver']);
  assert.deepEqual(genreOtherCities('House', 'Austin', catalog), ['Denver', 'Seattle']);
  const block = genreCitiesBlock('House', 'Austin', catalog);
  assert.match(block, /<nav aria-label="House in other cities"><ul class="chip-row"><li><a class="chip" href="\/genre\?genre=House">Denver<\/a><\/li><li><a class="chip" href="\/genre\?genre=House&amp;city=Seattle">Seattle<\/a>/);
  assert.equal(genreCitiesBlock('House', 'Austin', null), '');
  assert.equal(genreCitiesBlock('House', 'Seattle', [ev(1, 'Denver')]), '');
  const template = readFileSync(new URL('../genre.html', import.meta.url), 'utf8');
  assert.match(template, /<!--genre-cities-->\n  <\/main>/);
  assert.doesNotMatch(renderGenrePage(template, 'House', 'Seattle', true, true, [], null), /genre-cities|in other cities/);
  assert.match(renderGenrePage(template, 'House', 'Austin', true, true, [], catalog), /House in other cities/);
  const fn = readFileSync(new URL('../functions/genre.js', import.meta.url), 'utf8');
  assert.match(fn, /Promise\.all\(\[upcomingEvents\(\{ city: indexableCity, genre \}\), catalog\(\)\]\)/);
  assert.match(fn, /> 36e5/);
});

test('artist page reads upcoming shows event_artists-first and returns plain event rows', async () => {
  const seen = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    seen.push(String(url));
    const body = String(url).includes('/artists?') ? [{ id: artistId, name: 'A' }] : [{ events: { id, title: 'Show', date: '2026-11-01T02:00:00Z' } }];
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const data = await getArtist(artistId);
    assert.deepEqual(data.events, [{ id, title: 'Show', date: '2026-11-01T02:00:00Z' }]);
    const q = decodeURIComponent(seen.find((u) => u.includes('/event_artists?')));
    assert.match(q, new RegExp(`artist_id=eq\\.${artistId}`));
    assert.match(q, /select=events!inner\(id,title,/);
    assert.match(q, /events\.status=eq\.published/);
    assert.match(q, new RegExp(`events\\.event_artists\\.artist_id=eq\\.${artistId}`));
    assert.match(q, /order=events\(date\)\.asc,events\(id\)\.asc/);
    assert.ok(!seen.some((u) => u.includes('/rest/v1/events?')), 'no events-first scan');
  } finally {
    globalThis.fetch = original;
  }
  assert.match(readFileSync(new URL('../data.js', import.meta.url), 'utf8'), /get\('event_artists\?' \+ q\(\{\n\s+select: 'events!inner\(' \+ EVENT_COLS/);
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

test('long lineup titles are clipped so venue and date survive the SERP cut-off', () => {
  const long = catalogEvent({ title: 'Bttrfly Ft. Eric Benny Bloom, Dominic Lalli, Adam Deitch, Borahm Lee, Hunter Roberts', venue_name: 'Cervantes Masterpiece Ballroom', date: '2026-12-11T02:00:00Z', timezone: 'America/Denver' });
  const title = eventTitle(long);
  assert.equal(title, 'Bttrfly Ft. Eric Benny… at Cervantes Masterpiece Ballroom · Dec 10 | Drop');
  assert.ok(title.endsWith(' at Cervantes Masterpiece Ballroom · Dec 10 | Drop'));
  // The client (event.html via data.js) builds the same title.
  const window = {};
  vm.runInNewContext(readFileSync(new URL('../data.js', import.meta.url), 'utf8'), { window, document: { addEventListener() {} }, navigator: { userAgent: '' }, location: { search: '', hostname: 'localhost' }, localStorage: { getItem() { return null; }, setItem() {} }, console, URL, URLSearchParams, fetch: () => Promise.reject(new Error('offline')) });
  for (const [t, n] of [[long.title, 30], ['alpha beta gamma delta', 15], ['short', 155], ['aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 30]]) assert.equal(window.Drop.clipText(t, n), clipText(t, n), t);
  assert.match(readFileSync(new URL('../event.html', import.meta.url), 'utf8'), /var title = D\.clipText\(ev\.title, Math\.max\(30, 65 - suffix\.length\)\) \+ suffix;/);
});

test('event JSON-LD names the country and omits an empty performer list', () => {
  assert.equal(countryOf('CO'), 'US');
  assert.equal(countryOf('on'), 'CA');
  assert.equal(countryOf('BC'), 'CA');
  assert.equal(countryOf('California'), undefined);
  assert.equal(countryOf(null), undefined);
  const ld = eventView(catalogEvent({ state: 'ON', event_artists: [] })).jsonLd;
  assert.equal(ld.location.address.addressCountry, 'CA');
  assert.equal(ld.performer, undefined);
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
  const empty = renderCityPage(template, 'Denver');
  assert.doesNotMatch(empty, /Upcoming shows in Denver|"@type":"ItemList"/);
  assert.match(empty, /<h3>More in Denver<\/h3>/);
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
  const [place] = view.jsonLd;
  assert.equal(place.event[0]['@type'], 'MusicEvent');
  assert.equal(place.event[0].location['@type'], 'Place');
  assert.equal(place.event[0].location.address.streetAddress, '1 Main St');
});

test('venue and artist pages reach event-page SEO parity', async () => {
  const { venueView, artistView } = await import('../src/entity-seo.mjs');
  const artist = { id: artistId, name: 'Subtronics', genres: ['dubstep'], image_url: 'https://img.test/s.jpg', website_url: 'https://subtronics.test' };
  const show = catalogEvent({ title: 'Cyclops <Cave>', date: '2026-11-07T04:00:00Z', timezone: 'America/Denver', ticket_url: 'https://tix.test/1', price_min: 45, image_url: 'https://img.test/e.jpg', event_artists: [{ artists: artist }] });
  const events = [show, { ...show, id: id2, date: '2026-11-08T04:00:00Z' }];

  const venue = venueView({ venue: { id: venueId, name: 'Red Rocks', city: 'Morrison', state: 'CO', address: '1 Main St' }, events });
  assert.equal(venue.title, 'Red Rocks, Morrison: Upcoming Shows | Drop');
  assert.match(venue.description, /^2 upcoming shows at Red Rocks in Morrison, CO\. Next: Cyclops <Cave> on Nov 6\./);
  const [place, crumbs] = venue.jsonLd;
  assert.equal(place.event[0].offers.price, 45);
  assert.deepEqual(place.event[0].image, ['https://img.test/e.jpg']);
  assert.equal(place.event[0].performer[0].name, 'Subtronics');
  assert.equal(crumbs['@type'], 'BreadcrumbList');
  assert.deepEqual(crumbs.itemListElement.map((item) => item.name), ['Home', 'Venues', 'Red Rocks']);
  assert.match(venue.body, /<a href="https:\/\/app\.trydropapp\.com\/\?mode=login&amp;next=%2Fvenue%2F[^"]+">Follow Red Rocks on Drop<\/a>/);
  assert.match(venue.body, /Cyclops &lt;Cave&gt;<\/a> · November 6, 2026 at 9:00 PM/);

  const page = artistView({ artist, events });
  assert.equal(page.title, 'Subtronics: Upcoming Shows & Tour Dates | Drop');
  assert.match(page.description, /Next: Cyclops <Cave> at Red Rocks on Nov 6\./);
  const [group, artistCrumbs] = page.jsonLd;
  assert.deepEqual(group.sameAs, ['https://subtronics.test/']);
  assert.equal(group.image, 'https://img.test/s.jpg');
  assert.equal(group.event.length, 2);
  assert.deepEqual(artistCrumbs.itemListElement.map((item) => item.item), ['https://trydropapp.com/', 'https://trydropapp.com/artists', page.canonical]);
  assert.match(page.body, new RegExp(`Cyclops &lt;Cave&gt;</a> — <a href="/venue/${venueId}/red-rocks-morrison">Red Rocks</a>, Morrison`));

  const many = Array.from({ length: 60 }, (_, n) => ({ ...show, id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}` }));
  const big = venueView({ venue: { id: venueId, name: 'Red Rocks', city: 'Morrison', state: 'CO' }, events: many });
  assert.equal(big.jsonLd[0].event.length, 50);
  assert.match(big.body, /And 10 more upcoming shows\./);
  assert.match(artistView({ artist, events: [] }).body, /No upcoming shows listed right now\./);
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
    assert.ok([...store.values()].every((r) => r.headers.get('Cache-Control') === 'public, max-age=600'), 'edge copy capped at 10 min');
    const pageWithPolicy = () => new Response('home', { status: 200, headers: { 'Cache-Control': 'no-cache' } });
    await edgeCached(ctx('https://trydropapp.com/'), pageWithPolicy);
    await Promise.all(pending);
    const hit = await edgeCached(ctx('https://trydropapp.com/'), pageWithPolicy);
    assert.equal(hit.headers.get('Cache-Control'), 'no-cache', 'hits restore the page policy');
    assert.equal(hit.headers.get('X-Drop-Cache-Control'), null);
    const before = renders;
    await edgeCached(ctx('https://trydropapp.com/events?junk=1'), page);
    await Promise.all(pending);
    await edgeCached(ctx('https://trydropapp.com/events?junk=2&x=y'), page);
    assert.equal(renders, before + 1, 'junk params share one cache key');
    await edgeCached(ctx('https://trydropapp.com/events?ref=abc'), page);
    assert.equal(renders, before + 2, 'ref differs');
    await edgeCached(ctx('https://trydropapp.com/event/x'), () => new Response('gone', { status: 404 }));
    await Promise.all(pending);
    assert.ok(![...store.keys()].some((k) => k.includes('/event/x')), '404s are not cached');
  } finally {
    delete globalThis.caches;
  }
});

test('homepage LCP hint names the exact first card a Denver visitor sees', async () => {
  const { homeLcpImage, isRealArtUrl, sizedArtUrl, startOfDayIn, withLcpHint } = await import('../src/home-lcp.mjs');
  const window = {};
  vm.runInNewContext(readFileSync(new URL('../data.js', import.meta.url), 'utf8'), { window, document: { addEventListener() {} }, navigator: { userAgent: '' }, location: { search: '', hostname: 'localhost' }, localStorage: { getItem() { return null; }, setItem() {} }, console, URL, URLSearchParams, fetch: () => Promise.reject(new Error('offline')) });
  for (const url of [null, '', 'http://x.test/a.jpg', 'https://u:p@x.test/a.jpg', 'https://s1.ticketm.net/dam/c/abc.jpg', 'https://s1.ticketm.net/dam/a/abc.jpg', 'https://cdn.example/a.jpg', 'not a url']) {
    assert.equal(isRealArtUrl(url), window.Drop.isRealArtUrl(url), String(url));
  }
  // Full-size uploads swap to a ~800px rendition, identically on both sides,
  // so the preload is the URL the grid then requests.
  const sized = {
    'https://s1.ticketm.net/dam/a/1eb/c274_SOURCE': 'https://s1.ticketm.net/dam/a/1eb/c274_RETINA_LANDSCAPE_16_9.jpg',
    'https://s1.ticketm.net/dam/a/464/d432_TABLET_LANDSCAPE_LARGE_16_9.jpg': 'https://s1.ticketm.net/dam/a/464/d432_RETINA_LANDSCAPE_16_9.jpg',
    'https://s1.ticketm.net/dam/a/464/d432_EVENT_DETAIL_PAGE_16_9.jpg': 'https://s1.ticketm.net/dam/a/464/d432_EVENT_DETAIL_PAGE_16_9.jpg',
    'https://res.cloudinary.com/x/image/upload/q_auto,f_auto/v1/a.webp': 'https://res.cloudinary.com/x/image/upload/c_limit,w_800/q_auto,f_auto/v1/a.webp',
    'https://res.cloudinary.com/x/image/upload/c_limit,w_800/v1/a.webp': 'https://res.cloudinary.com/x/image/upload/c_limit,w_800/v1/a.webp',
    'https://cdn.test/c.jpg': 'https://cdn.test/c.jpg',
  };
  for (const [from, to] of Object.entries(sized)) {
    assert.equal(sizedArtUrl(from), to, from);
    assert.equal(window.Drop.sizedArtUrl(from), to, 'client ' + from);
  }
  assert.equal(sizedArtUrl(null), null);
  assert.deepEqual([...window.Drop.eventArtCandidates({ image_url: 'https://s1.ticketm.net/dam/a/1eb/c274_SOURCE', event_artists: [{ artists: { image_url: 'https://artist.test/a.jpg' } }] })],
    ['https://s1.ticketm.net/dam/a/1eb/c274_RETINA_LANDSCAPE_16_9.jpg', 'https://s1.ticketm.net/dam/a/1eb/c274_SOURCE', 'https://artist.test/a.jpg']);
  assert.equal(homeLcpImage([{ id: 'd', image_url: 'https://s1.ticketm.net/dam/a/1eb/c274_SOURCE', event_artists: [] }]), 'https://s1.ticketm.net/dam/a/1eb/c274_RETINA_LANDSCAPE_16_9.jpg');
  const rows = [
    { id: 'a', image_url: null, event_artists: [{ artists: { image_url: 'https://artist.test/a.jpg' } }] },
    { id: 'b', image_url: 'https://s1.ticketm.net/dam/c/cat.jpg', event_artists: [] },
    { id: 'c', image_url: 'https://cdn.test/c.jpg', event_artists: [] },
  ];
  // Pickup-spot listings are filtered in the query on both sides.
  const pickup = "'not.ilike.*pick*up spot*'";
  assert.ok(readFileSync(new URL('../data.js', import.meta.url), 'utf8').includes('var NOT_A_SHOW = ' + pickup));
  assert.match(readFileSync(new URL('../src/home-lcp.mjs', import.meta.url), 'utf8'), /status: 'eq\.published', title: 'not\.ilike\.\*pick\*up spot\*'/);
  assert.equal(homeLcpImage(rows), 'https://cdn.test/c.jpg');
  assert.equal(homeLcpImage([rows[0]]), 'https://artist.test/a.jpg');
  assert.equal(homeLcpImage([]), null);
  assert.equal(startOfDayIn('America/Denver', new Date('2026-10-18T04:00:00Z')), '2026-10-17T06:00:00.000Z');
  assert.equal(startOfDayIn('America/Denver', new Date('2026-01-10T12:00:00Z')), '2026-01-10T07:00:00.000Z');
  const template = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const html = withLcpHint(template, 'https://cdn.test/c.jpg?a=1&b="2"');
  assert.match(html, /<meta name="drop-lcp" data-city="Denver" content="https:\/\/cdn\.test\/c\.jpg\?a=1&amp;b=&quot;2&quot;" \/>\n  <script data-lcp-hint>/);
  assert.equal(withLcpHint(template, null), template);
  assert.ok(JSON.parse(readFileSync(new URL('../_routes.json', import.meta.url), 'utf8')).include.includes('/'));
  // The hint mirrors the grid's first page: 24 rows, date order, real art first.
  assert.match(template, /var PAGE = 24, page = 0/);
  assert.match(template, /evs\.sort\(function \(a, b\) \{ return \(D\.hasRealArt\(b\) \? 1 : 0\) - \(D\.hasRealArt\(a\) \? 1 : 0\); \}\);/);
  assert.match(readFileSync(new URL('../data.js', import.meta.url), 'utf8'), /order: opts\.sort === 'new' \? 'created_at\.desc' : 'date\.asc'/);
});

test('editorial weekend and festival views: windows, routing, schema, gates, sitemap', async () => {
  const { CITY_TIME_ZONES, editorialPaths, editorialView, renderFestivalsPage, renderWeekendPage, weekendRange } = await import('../src/editorial.mjs');
  assert.deepEqual(Object.keys(CITY_TIME_ZONES).sort(), [...CITIES].sort());
  // Wed 2026-10-14 noon Denver → Fri 16 00:00 MDT .. Sun 18 23:59:59 MDT.
  assert.deepEqual(weekendRange('America/Denver', new Date('2026-10-14T18:00:00Z')), { from: '2026-10-16T06:00:00.000Z', to: '2026-10-19T05:59:59.000Z' });
  // Saturday and Sunday look back to that Friday; Friday is itself.
  assert.equal(weekendRange('America/Denver', new Date('2026-10-17T18:00:00Z')).from, '2026-10-16T06:00:00.000Z');
  assert.equal(weekendRange('America/Denver', new Date('2026-10-18T18:00:00Z')).from, '2026-10-16T06:00:00.000Z');
  assert.equal(weekendRange('America/New_York', new Date('2026-10-16T12:00:00Z')).from, '2026-10-16T04:00:00.000Z');
  // DST ends Nov 1: Sunday evening uses MST.
  assert.equal(weekendRange('America/Denver', new Date('2026-10-30T18:00:00Z')).to, '2026-11-02T06:59:59.000Z');

  assert.deepEqual(editorialView('https://trydropapp.com/events?when=weekend&city=chicago'), { kind: 'weekend', city: 'Chicago' });
  assert.deepEqual(editorialView('https://trydropapp.com/events?festival=1'), { kind: 'festivals' });
  assert.deepEqual(editorialView('https://trydropapp.com/events?when=weekend&city=Denver&utm_source=ig'), { kind: 'weekend', city: 'Denver' });
  for (const url of ['https://trydropapp.com/events', 'https://trydropapp.com/events?when=weekend', 'https://trydropapp.com/events?when=weekend&city=Atlantis', 'https://trydropapp.com/events?festival=1&q=x', 'https://trydropapp.com/events?when=tonight&city=Denver']) {
    assert.equal(editorialView(url), null, url);
  }

  const template = readFileSync(new URL('../events.html', import.meta.url), 'utf8');
  const shows = Array.from({ length: 3 }, (_, i) => catalogEvent({ id: `00000000-0000-4000-8000-00000000002${i}`, title: `Show <${i}>`, city: 'Chicago', state: 'IL', date: '2026-10-17T03:00:00Z' }));
  const page = renderWeekendPage(template, 'Chicago', shows);
  assert.match(page, /<title>EDM Shows This Weekend in Chicago \| Drop<\/title>/);
  assert.match(page, /<h1 class="wsh__title">This weekend in Chicago<\/h1>/);
  assert.match(page, /<link rel="canonical" href="https:\/\/trydropapp\.com\/events\?when=weekend&amp;city=Chicago"/);
  assert.match(page, /name="description" content="3 shows this weekend in Chicago on Drop: Show &lt;0&gt;, Show &lt;1&gt;, Show &lt;2&gt;\."/);
  assert.match(page, /<div class="grid-events" id="grid"[^>]*><div data-server-entity><h2>This weekend in Chicago<\/h2><ul><li><a href="\/event\//);
  assert.doesNotMatch(page, /name="robots"/);
  const ld = JSON.parse(page.match(/data-server-ldjson>([\s\S]*?)<\/script>/)[1]);
  assert.equal(ld.itemListElement[0].item['@type'], 'MusicEvent');
  assert.match(page, /"@type": "CollectionPage",\s*"name": "This weekend in Chicago"/);
  assert.match(renderWeekendPage(template, 'Chicago', shows.slice(1)), /name="robots" content="noindex, follow"/);
  const hostile = renderWeekendPage(template, 'Chicago', shows.map((e, i) => ({ ...e, title: i ? e.title : '</script><script>alert(1)</script>\u2028' })));
  const scripts = [...hostile.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.ok(scripts.length >= 2);
  for (const body of scripts) { assert.doesNotMatch(body, /<\/script|<script|\u2028/); JSON.parse(body); }
  assert.doesNotMatch(hostile, /<script>alert\(1\)/);

  const fests = [catalogEvent({ is_festival: true, title: 'Big Fest', end_date: '2026-11-02T06:00:00Z' })];
  const fest = renderFestivalsPage(template, fests);
  assert.match(fest, /<h1 class="wsh__title">Upcoming festivals<\/h1>/);
  assert.equal(JSON.parse(fest.match(/data-server-ldjson>([\s\S]*?)<\/script>/)[1]).itemListElement[0].item['@type'], 'Festival');
  assert.match(renderFestivalsPage(template, []), /name="robots" content="noindex, follow"/);

  const now = new Date('2026-10-15T18:00:00Z');
  const chicago = Array.from({ length: 3 }, () => catalogEvent({ city: 'Chicago', date: '2026-10-17T03:00:00Z' }));
  assert.deepEqual(editorialPaths([...chicago, catalogEvent({ city: 'Denver', date: '2026-10-17T03:00:00Z' })], now), ['/events?when=weekend&city=Chicago']);
  assert.deepEqual(editorialPaths([...chicago, catalogEvent({ is_festival: true })], now), ['/events?when=weekend&city=Chicago', '/events?festival=1']);
  // Sunday evening: Friday-night shows are over and no longer count.
  assert.deepEqual(editorialPaths(chicago, new Date('2026-10-19T02:00:00Z')), []);

  const city = renderCityPage(readFileSync(new URL('../city.html', import.meta.url), 'utf8'), 'Chicago', [withGenres(['techno'], { city: 'Chicago' })]);
  assert.match(city, /<a href="\/events\?when=weekend&amp;city=Chicago">This weekend in Chicago<\/a>/);
  assert.match(city, /<a href="\/events\?festival=1">Upcoming festivals<\/a>/);
  assert.ok(JSON.parse(readFileSync(new URL('../_routes.json', import.meta.url), 'utf8')).include.includes('/events'));
});

test('catalog text with $-substitution patterns is inserted literally everywhere', async () => {
  const { renderWeekendPage } = await import('../src/editorial.mjs');
  const { withLcpHint } = await import('../src/home-lcp.mjs');
  const nasty = "A $' B $` C $& D";
  const event = catalogEvent({ title: nasty, description: nasty });
  const view = eventView(event);
  const page = renderTemplate(readFileSync(new URL('../event.html', import.meta.url), 'utf8'), { ...view, rootId: 'event-root' });
  assert.ok(page.includes(JSON.stringify(nasty).slice(1, -1)), 'event JSON-LD keeps the literal text');
  const weekend = renderWeekendPage(readFileSync(new URL('../events.html', import.meta.url), 'utf8'), 'Chicago', [event, { ...event, id: id2 }, { ...event, id: venueId }]);
  const ld = weekend.match(/data-server-ldjson>([\s\S]*?)<\/script>/)[1];
  assert.equal(JSON.parse(ld).itemListElement[0].item.name, nasty);
  assert.equal((weekend.match(/<\/head>/g) || []).length, 1);
  const hint = withLcpHint(readFileSync(new URL('../index.html', import.meta.url), 'utf8'), "https://x.test/$'.jpg");
  assert.match(hint, /content="https:\/\/x\.test\/\$&#39;\.jpg"/);
});

test('homepage seed mirrors the grid query, drops descriptions, and is script-safe', async () => {
  const { fetchHomeSeed, withHomeSeed } = await import('../src/home-lcp.mjs');
  const realFetch = globalThis.fetch;
  let requested;
  globalThis.fetch = async (url, init) => {
    requested = { url: new URL(url), init };
    return new Response(JSON.stringify([{ id: 'a', title: '</script><b>x', description: 'long html', image_url: 'https://cdn.test/a.jpg' }]), { headers: { 'content-range': '0-0/1234' } });
  };
  try {
    const seed = await fetchHomeSeed(new Date('2026-10-18T04:00:00Z'));
    const p = requested.url.searchParams;
    assert.equal(p.get('order'), 'date.asc');
    assert.equal(p.get('limit'), '24');
    assert.equal(p.get('city'), 'ilike.Denver');
    assert.equal(p.get('date'), 'gte.2026-10-17T06:00:00.000Z');
    assert.equal(requested.init.headers.Prefer, 'count=exact');
    assert.deepEqual(seed, { city: 'Denver', total: 1234, rows: [{ id: 'a', title: '</script><b>x', image_url: 'https://cdn.test/a.jpg' }] });
    const html = withHomeSeed(readFileSync(new URL('../index.html', import.meta.url), 'utf8'), seed);
    const body = html.match(/<script type="application\/json" id="home-seed">([\s\S]*?)<\/script>/)[1];
    assert.doesNotMatch(body, /<\/script|<b>/);
    assert.deepEqual(JSON.parse(body), seed);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('homepage renders exactly one leading card in the HTML by default', async () => {
  const { homeCardsHtml, withHomeCards } = await import('../src/home-lcp.mjs');
  const rows = [
    { id: '00000000-0000-4000-8000-000000000051', title: 'A', date: '2026-10-20T03:00:00Z', venue_name: 'V', city: 'Denver', image_url: 'https://cdn.test/a.jpg', event_artists: [] },
    { id: '00000000-0000-4000-8000-000000000052', title: 'B', date: '2026-10-20T03:00:00Z', venue_name: 'V', city: 'Denver', image_url: 'https://cdn.test/b.jpg', event_artists: [] },
  ];
  assert.equal((homeCardsHtml(rows).match(/class="wsc-card"/g) || []).length, 1);
  assert.match(homeCardsHtml(rows), /loading="eager" fetchpriority="high" referrerpolicy="no-referrer"/);
  assert.equal(homeCardsHtml([{ ...rows[0], image_url: null }]), '');
  const html = withHomeCards(readFileSync(new URL('../index.html', import.meta.url), 'utf8'), { city: 'Denver', total: 2, rows });
  assert.match(html, /<div class="grid-events" id="home-grid" aria-label="Upcoming shows"><a class="wsc-card"/);
});

test('markets: city pages are gated on real shows and cross-link every market', async () => {
  const template = readFileSync(new URL('../city.html', import.meta.url), 'utf8');
  const three = [0, 1, 2].map((n) => catalogEvent({ id: `00000000-0000-4000-8000-00000000000${n}`, city: 'Las Vegas' }));
  assert.deepEqual(cityPaths([...three, ...three.map((e) => ({ ...e, city: 'Denver' })), catalogEvent({ city: 'Miami' })]), ['/city?city=Las%20Vegas'], 'Denver stays static');
  assert.doesNotMatch(renderCityPage(template, 'Las Vegas', three), /name="robots"/);
  assert.match(renderCityPage(template, 'Miami', [catalogEvent({ city: 'Miami' })]), /name="robots" content="noindex, follow"/);
  assert.doesNotMatch(renderCityPage(template, 'Miami', null), /name="robots"/, 'catalog outage keeps the page indexable');
  const others = renderCityPage(template, 'Denver', three).match(/<h3>Other cities<\/h3>([\s\S]*?)<\/ul>/)[1];
  assert.equal([...others.matchAll(/href="\/city\?city=/g)].length, CITIES.length - 1);
  assert.match(others, /href="\/city\?city=San%20Francisco">EDM shows in San Francisco</);
  const { CITY_TIME_ZONES } = await import('../src/editorial.mjs');
  for (const zone of Object.values(CITY_TIME_ZONES)) assert.doesNotThrow(() => new Intl.DateTimeFormat('en-US', { timeZone: zone }), zone);
});

test('ItemList entries carry the same MusicEvent as the event page', async () => {
  const { renderFestivalsPage } = await import('../src/editorial.mjs');
  const rich = catalogEvent({ ticket_url: 'https://tix.test/1', price_min: 30, ticket_status: 'on_sale', image_url: 'https://img.test/e.jpg', end_date: '2026-09-01T08:00:00Z',
    event_artists: [{ artists: { id: artistId, name: 'Subtronics', genres: ['dubstep'] } }] });
  const ld = (html) => [...html.matchAll(/<script type="application\/ld\+json" data-server-ldjson>([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1])).flat().find((d) => d['@type'] === 'ItemList');
  const city = ld(renderCityPage(readFileSync(new URL('../city.html', import.meta.url), 'utf8'), 'Denver', [rich, { ...rich, id: id2 }, { ...rich, id: '00000000-0000-4000-8000-000000000009' }]));
  const fest = ld(renderFestivalsPage(readFileSync(new URL('../events.html', import.meta.url), 'utf8'), [{ ...rich, is_festival: true }]));
  for (const [list, type] of [[city, 'MusicEvent'], [fest, 'Festival']]) {
    const item = list.itemListElement[0].item;
    assert.equal(item['@type'], type);
    for (const key of ['name', 'startDate', 'location', 'image', 'offers', 'performer', 'eventStatus', 'endDate']) assert.ok(item[key], `${type} ${key}`);
    assert.equal(item.offers.price, 30);
    assert.ok(item.location.address.addressLocality);
  }
  assert.match(readFileSync(new URL('../index.html', import.meta.url), 'utf8'), /"urlTemplate": "https:\/\/trydropapp\.com\/search\?q=\{query\}"/);
});

test('link graph: junk listings are out, every show links its venue, city and next shows', async () => {
  const { eventView, isIndexableEvent } = await import('../src/entity-seo.mjs');
  assert.equal(isIndexableEvent(catalogEvent({ title: 'Deadmau5 Bus To Show Pickup Spot (FREE EVENT)' })), false);
  assert.equal(isIndexableEvent(catalogEvent({ title: 'Pretty Lights - Soundship Space Bus Tour' })), true, 'a tour named "bus" is still a show');
  const next = catalogEvent({ id: id2, title: 'Next <Night>', date: '2026-09-02T03:00:00Z', timezone: 'America/Denver', venue_name: 'Ogden' });
  const view = eventView(catalogEvent({ city: 'Denver' }), { nearby: [next], cityPath: '/city?city=Denver' });
  assert.match(view.body, new RegExp(`<a href="/venue/${venueId}/red-rocks-denver">Red Rocks</a>, Denver, CO`));
  assert.match(view.body, new RegExp(`<h2>More shows in Denver</h2><ul><li><a href="/event/${id2}/next-night">Next &lt;Night&gt;</a> · Sep 1 · Ogden</li></ul>`));
  assert.match(view.body, /<a href="\/city\?city=Denver">All EDM shows in Denver<\/a>/);
  assert.doesNotMatch(eventView(catalogEvent()).body, /More shows in|All EDM shows/, 'nothing to link stays empty');
});

test('city pages link small-town shows in their state and bordering non-market states', async () => {
  const { NEARBY_STATES, smallTownShows, stateOf } = await import('../src/acquisition-seo.mjs');
  const template = readFileSync(new URL('../city.html', import.meta.url), 'utf8');
  assert.equal(stateOf([catalogEvent({ state: 'WA' }), catalogEvent({ state: 'WA' }), catalogEvent({ state: 'OR' })]), 'WA');
  const town = catalogEvent({ id: id2, title: 'Tulsa <Night>', city: 'Tulsa', state: 'OK' });
  const html = renderCityPage(template, 'Dallas', [catalogEvent({ city: 'Dallas', state: 'TX' })], [town]);
  assert.match(html, new RegExp(`<h3>More shows nearby, outside the big cities</h3><ul><li><a href="/event/${id2}/tulsa-night">Tulsa &lt;Night&gt;</a> — Red Rocks, Tulsa, `));
  assert.ok(NEARBY_STATES.TX.includes('OK') && NEARBY_STATES.WA.includes('BC') && NEARBY_STATES.MI.includes('ON'));
  const urls = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => { urls.push(decodeURIComponent(String(url))); return new Response(JSON.stringify([town, catalogEvent({ city: 'Dallas', state: 'TX' })]), { headers: { 'Content-Range': '0-1/2' } }); };
  try {
    assert.deepEqual((await smallTownShows('TX')).map((e) => e.city), ['Tulsa'], 'market cities are excluded');
  } finally { globalThis.fetch = real; }
  assert.match(urls[0], /state=in\.\(TX,OK,LA,AR\)/);
  assert.match(urls[0], /or=\(date\.gte\.[^,]+,end_date\.gte\.[^)]+\)/, 'ongoing runs count, like the sitemap');
  assert.deepEqual(await smallTownShows(null), []);
});

test('share images: event art through /og/event, art-less events get the branded card', () => {
  assert.equal(eventView(catalogEvent({ image_url: 'https://img.test/a.jpg' })).image, `https://trydropapp.com/og/event/${id}`);
  assert.equal(eventView(catalogEvent({ image_url: null, event_artists: [] })).image, `https://trydropapp.com/og/card/${id}`);
});
