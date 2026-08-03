import test from 'node:test';
import assert from 'node:assert/strict';
import {
  artistPath, escapeHtml, eventAvailabilityText, eventPath, eventView, indexableEntities,
  isIndexableArtist, isIndexableEvent, isIndexableVenue, renderTemplate, routeId,
  schemaEventStatus, schemaOfferAvailability, sitemapXml, slugify, ticketActionText, venuePath,
} from '../src/entity-seo.mjs';

const id = '11111111-1111-4111-8111-111111111111';
const id2 = '22222222-2222-4222-8222-222222222222';
const venueId = '33333333-3333-4333-8333-333333333333';
const venueId2 = '44444444-4444-4444-8444-444444444444';
const artistId = '55555555-5555-4555-8555-555555555555';
const artistId2 = '66666666-6666-4666-8666-666666666666';

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
  assert.equal(view.jsonLd['@type'], 'Event');
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
