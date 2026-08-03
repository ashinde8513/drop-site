import test from 'node:test';
import assert from 'node:assert/strict';
import {
  artistPath, escapeHtml, eventPath, eventView, renderTemplate, routeId,
  sitemapXml, slugify, venuePath,
} from '../src/entity-seo.mjs';

const id = '11111111-1111-4111-8111-111111111111';

test('stable entity paths keep UUID identity and readable slugs', () => {
  assert.equal(slugify('Red Rocks Amphitheatre & Café'), 'red-rocks-amphitheatre-and-cafe');
  assert.equal(eventPath({ id, title: 'BASS BINGO AFTERS' }), `/event/${id}/bass-bingo-afters`);
  assert.equal(venuePath({ id, name: 'Red Rocks', city: 'Morrison' }), `/venue/${id}/red-rocks-morrison`);
  assert.equal(artistPath({ id, name: 'RL Grime' }), `/artist/${id}/rl-grime`);
  assert.equal(routeId([id, 'ignored']), id);
  assert.equal(routeId(['not-a-uuid']), null);
});

test('server render adds crawlable metadata, content, and safe JSON-LD', () => {
  const template = '<html><head><title>Old</title><meta name="description" content="Old"><meta property="og:title" content="Old"><meta property="og:description" content="Old"><meta property="og:url" content="old"><meta property="og:image" content="old"><meta name="twitter:title" content="Old"><meta name="twitter:description" content="Old"><meta name="twitter:image" content="old"><link rel="canonical" href="old"></head><body><div class="root" id="event-root"></div></body></html>';
  const html = renderTemplate(template, {
    title: 'Show $& | Drop', description: 'Real $& listing', canonical: 'https://trydropapp.com/event/x', image: 'https://example.com/a.jpg',
    rootId: 'event-root', body: '<h1>Show $&</h1>', jsonLd: { name: '</script><script>alert(1)</script>' },
  });
  assert.match(html, /<title>Show \$&amp; \| Drop<\/title>/);
  assert.match(html, /rel="canonical" href="https:\/\/trydropapp.com\/event\/x"/);
  assert.match(html, /data-server-entity><h1>Show \$&<\/h1>/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /\\u003c\/script>/);
});

test('event view emits useful Event data without trusting catalog HTML', () => {
  const view = eventView({
    id, title: '<Main Event>', description: '<b>official</b>', date: '2026-09-01T02:00:00Z',
    venue_id: id, venue_name: 'Red Rocks', city: 'Morrison', state: 'CO', currency: 'USD',
    timezone: 'America/Denver', ticket_url: 'javascript:alert(1)', image_url: 'javascript:alert(2)',
    event_artists: [{ artists: { id, name: 'Artist & Co' } }],
  });
  assert.match(view.body, /&lt;Main Event&gt;/);
  assert.doesNotMatch(view.body, /<b>official<\/b>/);
  assert.equal(view.jsonLd['@type'], 'Event');
  assert.equal(view.jsonLd.url, `https://trydropapp.com/event/${id}/main-event`);
  assert.equal(view.jsonLd.offers, undefined);
  assert.doesNotMatch(view.body, /javascript:/);
});

test('entity sitemap escapes XML and includes every entity class', () => {
  const xml = sitemapXml({
    events: [{ id, title: 'A & B', created_at: '2026-08-02T00:00:00Z' }],
    venues: [{ id, name: 'Red Rocks', city: 'Morrison' }],
    artists: [{ id, name: 'Artist' }],
  });
  assert.equal((xml.match(/<url>/g) || []).length, 3);
  assert.match(xml, /a-and-b/);
  assert.match(xml, /<lastmod>2026-08-02<\/lastmod>/);
  assert.equal(escapeHtml('A&B'), 'A&amp;B');
});
