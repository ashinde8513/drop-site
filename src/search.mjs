// /search?q= — server-rendered results for shows, artists and venues (noindex).
import { artistPath, escapeHtml, eventPath, isIndexableEvent, renderTemplate, rest, routeId, venuePath } from './entity-seo.mjs';

// Values are double-quoted inside the or=() logic tree; a plain filter takes
// quotes literally, so it gets the bare pattern (its , ( ) are not syntax).
// Either way quotes, backslashes, * and % never survive cleaning.
export function cleanQuery(value) {
  const q = String(value || '').replace(/[^\p{L}\p{N}\p{M} &'.!?-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  return q.length >= 2 ? q : '';
}

export async function searchCatalog(q, now = new Date()) {
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const like = '"*' + q + '*"';
  const [events, artists] = await Promise.all([
    rest('events', {
      select: 'id,title,date,timezone,time_tbd,lifecycle_status,venue_id,venue_name,venue_address,city,state',
      status: 'eq.published', date: 'gte.' + today.toISOString(),
      or: '(title.ilike.' + like + ',venue_name.ilike.' + like + ')',
      order: 'date.asc,id.asc', limit: 200,
    }),
    // Only artists linked to shows; duplicates by name collapse to one row.
    rest('artists', { select: 'id,name,genres,event_artists!inner(event_id)', name: 'ilike.*' + q + '*', 'event_artists.limit': 1, order: 'name.asc', limit: 30 }),
  ]);
  const seen = new Set();
  const linked = artists.filter((artist) => {
    const key = String(artist.name || '').trim().toLowerCase();
    // Ids the artist route rejects would link to a 404.
    if (!key || !routeId(artist.id) || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 12);
  return { events: events.filter(isIndexableEvent), artists: linked };
}

function when(event) {
  const zone = event.time_tbd ? 'UTC' : event.timezone || 'UTC';
  try { return new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: zone }); }
  catch { return new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }); }
}

function section(title, items, empty) {
  return '<h2>' + escapeHtml(title) + '</h2>' + (items.length ? '<ul class="guide-list">' + items.join('') + '</ul>' : '<p>' + escapeHtml(empty) + '</p>');
}

export function searchBody(q, { events, artists }) {
  if (!q) return '<p>Type at least two letters to search shows, artists and venues.</p>';
  const needle = q.toLowerCase();
  const venues = new Map();
  for (const event of events) {
    if (!event.venue_id || !String(event.venue_name || '').toLowerCase().includes(needle)) continue;
    const venue = venues.get(event.venue_id) || { id: event.venue_id, name: event.venue_name, city: event.city, count: 0 };
    venue.count++;
    venues.set(event.venue_id, venue);
  }
  const shows = events.slice(0, 30).map((event) => '<li><a href="' + eventPath(event) + '"><strong>' + escapeHtml(event.title) + '</strong></a><br>' +
    escapeHtml([when(event), event.venue_name, event.city].filter(Boolean).join(' · ')) + '</li>');
  const artistItems = artists.map((artist) => '<li><a href="' + artistPath(artist) + '"><strong>' + escapeHtml(artist.name) + '</strong></a>' +
    ((artist.genres || []).length ? '<br>' + escapeHtml(artist.genres.slice(0, 3).join(', ')) : '') + '</li>');
  const venueItems = [...venues.values()].slice(0, 12).map((venue) => '<li><a href="' + venuePath(venue) + '"><strong>' + escapeHtml(venue.name) + '</strong></a><br>' +
    escapeHtml([venue.city, venue.count + ' upcoming show' + (venue.count === 1 ? '' : 's')].filter(Boolean).join(' · ')) + '</li>');
  return '<p role="status">Results for “' + escapeHtml(q) + '”: ' + events.length + ' show' + (events.length === 1 ? '' : 's') + ', ' +
    artists.length + ' artist' + (artists.length === 1 ? '' : 's') + ', ' + venues.size + ' venue' + (venues.size === 1 ? '' : 's') + '.</p>' +
    section('Shows', shows, 'No upcoming shows match.') + section('Artists', artistItems, 'No artists match.') + section('Venues', venueItems, 'No venues match.') +
    '<p><a href="/events?q=' + escapeHtml(encodeURIComponent(q)) + '">Filter all shows by “' + escapeHtml(q) + '”</a></p>';
}

export function renderSearchPage(template, q, results) {
  const title = q ? 'Search: ' + q + ' | Drop' : 'Search shows, artists and venues | Drop';
  let html = renderTemplate(template, {
    title, description: 'Search upcoming EDM shows, artists and venues on Drop.', canonical: 'https://trydropapp.com/search',
    image: 'https://trydropapp.com/og-image.png', rootId: 'search-results', body: searchBody(q, results),
    jsonLd: { '@context': 'https://schema.org', '@type': 'SearchResultsPage', name: title }, indexable: false,
  });
  // Keep the query in the box so people can refine it.
  html = html.replace('<input id="search-q" name="q" type="search"', () => '<input id="search-q" name="q" type="search" value="' + escapeHtml(q) + '"');
  return html;
}
