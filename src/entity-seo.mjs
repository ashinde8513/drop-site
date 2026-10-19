const DEFAULT_IMAGE = 'https://trydropapp.com/og-image.png';
const REST = 'https://ebccwnkmsnhbljxxxdej.supabase.co/rest/v1/';
const PUBLIC_KEY = 'sb_publishable_ZMsNcfhfqsGgyvsdBDTKHg__h8SDZyd';
const EVENT_SELECT = 'id,title,description,date,end_date,venue_id,venue_name,venue_address,city,state,image_url,ticket_url,price_min,price_max,currency,time_tbd,timezone,lifecycle_status,ticket_status,age_restriction,created_at,event_artists(artists(id,name,genres,image_url))';

export function slugify(value) {
  return String(value || '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'drop';
}

export function eventPath(event) {
  return '/event/' + encodeURIComponent(event.id) + '/' + slugify(event.title);
}

export function venuePath(venue) {
  return '/venue/' + encodeURIComponent(venue.venue_id || venue.id) + '/' + slugify([venue.name || venue.venue_name, venue.city].filter(Boolean).join(' '));
}

export function artistPath(artist) {
  return '/artist/' + encodeURIComponent(artist.id) + '/' + slugify(artist.name);
}

export function routeId(value) {
  const segment = Array.isArray(value) ? value[0] : value;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(segment || '') ? segment : null;
}

const ATTRIBUTION_SOURCES = new Set([
  'creator', 'crew_invite', 'event_invite', 'event_share', 'friend_invite',
  'invite_screen', 'plan_share', 'qr', 'recap_share', 'seen_history',
  'show_memories', 'wrapped',
]);

export function safeAttributionQuery(value) {
  let params;
  try { params = new URL(value, 'https://trydropapp.com').searchParams; }
  catch { return ''; }
  const safe = new URLSearchParams();
  const ref = routeId([params.get('ref')]);
  const source = params.get('src');
  if (ref) safe.set('ref', ref);
  if (ATTRIBUTION_SOURCES.has(source)) safe.set('src', source);
  const query = safe.toString();
  return query ? '?' + query : '';
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

// Logistics listings (party-bus pickup spots) are not shows: keep them out of
// the index, sitemaps and crawlable lists.
const NOT_A_SHOW = /\bpick-?up spot\b/i;

export function isIndexableEvent(event) {
  return Boolean(event && routeId([event.id]) && hasText(event.title) && !NOT_A_SHOW.test(event.title) && hasText(event.date) && Number.isFinite(Date.parse(event.date)) &&
    routeId([event.venue_id]) && hasText(event.venue_name) &&
    (hasText(event.venue_address) || (hasText(event.city) && hasText(event.state))));
}

function indexableEventCount(events) {
  return new Set(events.filter(isIndexableEvent).map((event) => event.id)).size;
}

export function isIndexableVenue(data) {
  const venue = data?.venue || data;
  const events = data?.events || venue?.events || [];
  return Boolean(venue && routeId([venue.id || venue.venue_id]) && hasText(venue.name || venue.venue_name) &&
    (hasText(venue.address || venue.venue_address) || (hasText(venue.city) && hasText(venue.state))) &&
    indexableEventCount(events) >= 2);
}

// Thin aggregate policy: venues need two valid shows; artists need two valid
// shows, or one plus real profile material. Direct pages stay available.
export function isIndexableArtist(data) {
  const artist = data?.artist || data;
  const events = data?.events || artist?.events || [];
  const eventCount = indexableEventCount(events);
  // Catalog genres are auto-filled, so a one-show artist needs a real image or
  // website to be more than a thin page (2026-10-19 audit: 89 genre-only pages).
  const hasProfile = Boolean(safeHttpUrl(artist?.image_url) || safeHttpUrl(artist?.website_url));
  return Boolean(artist && routeId([artist.id]) && hasText(artist.name) &&
    (eventCount >= 2 || (eventCount >= 1 && hasProfile)));
}

export function schemaEventStatus(value) {
  return ({
    scheduled: 'https://schema.org/EventScheduled',
    cancelled: 'https://schema.org/EventCancelled',
    postponed: 'https://schema.org/EventPostponed',
  })[String(value || '').toLowerCase()];
}

export function schemaOfferAvailability(value) {
  return ({
    available: 'https://schema.org/InStock',
    sold_out: 'https://schema.org/SoldOut',
    unavailable: 'https://schema.org/OutOfStock',
  })[String(value || '').toLowerCase()];
}

export function eventAvailabilityText(event) {
  if (event?.lifecycle_status === 'cancelled') return 'Event canceled';
  if (event?.lifecycle_status === 'postponed') return 'Event postponed';
  return ({
    available: 'Tickets available now',
    sold_out: 'Tickets sold out',
    unavailable: 'Tickets currently unavailable',
    rsvp: 'RSVP required',
  })[event?.ticket_status] || (safeHttpUrl(event?.ticket_url) ? 'Check ticket availability' : 'Ticket availability not listed');
}

export function ticketActionText(event) {
  if (event?.lifecycle_status === 'cancelled' || event?.lifecycle_status === 'postponed') return 'View ticket details';
  if (event?.ticket_status === 'available') return 'Get tickets';
  if (event?.ticket_status === 'rsvp') return 'RSVP';
  return 'View ticket details';
}

function query(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  });
  return search.toString();
}

export async function rest(table, params) {
  return (await restWithCount(table, params, false)).rows;
}

// Same request plus PostgREST's exact total (Content-Range "0-23/1234"), like
// data.js get(path, { count: true }).
export async function restWithCount(table, params, count = true) {
  const headers = { apikey: PUBLIC_KEY, Authorization: 'Bearer ' + PUBLIC_KEY };
  if (count) headers.Prefer = 'count=exact';
  const response = await fetch(REST + table + '?' + query(params), { headers });
  if (!response.ok) throw new Error('Supabase HTTP ' + response.status);
  const rows = await response.json();
  const total = parseInt((response.headers.get('content-range') || '').split('/')[1], 10);
  return { rows, total: Number.isNaN(total) ? null : total };
}

function upcomingFilter() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return '(date.gte.' + today.toISOString() + ',end_date.gte.' + today.toISOString() + ')';
}

export async function getEvent(id) {
  const rows = await rest('events', { select: EVENT_SELECT, id: 'eq.' + id, status: 'eq.published', limit: 1 });
  return rows[0] || null;
}

// The next indexable shows in the same city after this one (for crawl links).
// Never throws: the page still renders without the block.
export async function getNextShows(event, limit = 6) {
  if (!hasText(event?.city) || !hasText(event?.date)) return [];
  try {
    const rows = await rest('events', {
      select: 'id,title,date,timezone,time_tbd,venue_id,venue_name,venue_address,city,state',
      status: 'eq.published', city: 'ilike.' + event.city, date: 'gte.' + event.date, id: 'neq.' + event.id,
      order: 'date.asc,id.asc', limit: limit * 2,
    });
    return rows.filter(isIndexableEvent).slice(0, limit);
  } catch { return []; }
}

export async function getVenue(id) {
  const events = await rest('events', {
    select: EVENT_SELECT,
    venue_id: 'eq.' + id,
    status: 'eq.published',
    or: upcomingFilter(),
    order: 'date.asc',
    limit: 1000,
  });
  if (!events.length) return null;
  const first = events[0];
  return {
    venue: { id, name: first.venue_name, city: first.city, state: first.state, address: first.venue_address },
    events,
  };
}

export async function getArtist(id) {
  const [artists, events] = await Promise.all([
    rest('artists', { select: 'id,name,genres,image_url,website_url,verified', id: 'eq.' + id, limit: 1 }),
    rest('events', {
      select: EVENT_SELECT.replace('event_artists(', 'event_artists!inner('),
      status: 'eq.published',
      or: upcomingFilter(),
      'event_artists.artist_id': 'eq.' + id,
      order: 'date.asc',
      limit: 1000,
    }),
  ]);
  return artists.length ? { artist: artists[0], events } : null;
}

export function indexableEntities(rows) {
  const events = (rows || []).filter(isIndexableEvent);
  const venues = new Map();
  const artists = new Map();
  events.forEach((event) => {
    if (!venues.has(event.venue_id)) {
      venues.set(event.venue_id, {
        venue: { id: event.venue_id, name: event.venue_name, address: event.venue_address, city: event.city, state: event.state },
        events: [],
      });
    }
    venues.get(event.venue_id).events.push(event);
    (event.event_artists || []).forEach((entry) => {
      const artist = entry.artists;
      if (!artist?.id) return;
      if (!artists.has(artist.id)) artists.set(artist.id, { artist, events: [] });
      artists.get(artist.id).events.push(event);
    });
  });
  return {
    events,
    venues: [...venues.values()].filter(isIndexableVenue).map((data) => data.venue),
    artists: [...artists.values()].filter(isIndexableArtist).map((data) => data.artist),
  };
}

export async function getEntityUrls() {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await rest('events', {
      select: 'id,title,date,is_festival,venue_id,venue_name,venue_address,city,state,created_at,event_artists(artists(id,name,genres,image_url,website_url))',
      status: 'eq.published',
      or: upcomingFilter(),
      order: 'date.asc,id.asc',
      limit: 1000,
      offset,
    });
    rows.push(...page);
    if (page.length < 1000) break;
  }

  return indexableEntities(rows);
}

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => {
    if (code[0] !== '#') return NAMED_ENTITIES[code.toLowerCase()] ?? match;
    const point = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : match;
  });
}

// Catalog descriptions arrive from providers as HTML fragments (sometimes
// entity-encoded twice). Reduce them to one line of plain text.
export function plainText(value) {
  // Only real tags/comments: a bare '<' ("<3", "under <21") is text.
  const stripTags = (text) => text.replace(/<!--[\s\S]*?-->|<(script|style)\b[\s\S]*?<\/\1\s*>/gi, ' ').replace(/<\/?[a-z][^>]*>|<![^>]*>/gi, ' ');
  return stripTags(decodeEntities(stripTags(String(value || '')))).replace(/\s+/g, ' ').trim();
}

// Cut at a word boundary so meta descriptions never end mid-word.
export function clipText(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return (space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s.,;:\-–—]+$/, '') + '…';
}

export function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function replaceContentAttribute(html, marker, value) {
  const pattern = new RegExp('(<meta[^>]+' + marker + '[^>]+content=")[^"]*(")', 'i');
  return html.replace(pattern, (_match, before, after) => before + escapeHtml(value) + after);
}

export function renderTemplate(template, { title, description, canonical, image, rootId, body, jsonLd, indexable = true, appArgument = canonical }) {
  let html = template.replace(/<title([^>]*)>[^<]*<\/title>/i, (_match, attributes) => '<title' + attributes + '>' + escapeHtml(title) + '</title>');
  html = html.replace(/(<link[^>]+rel="canonical"[^>]+href=")[^"]*(")/i, (_match, before, after) => before + escapeHtml(canonical) + after);
  html = replaceContentAttribute(html, 'name="description"', description);
  html = replaceContentAttribute(html, 'property="og:title"', title);
  html = replaceContentAttribute(html, 'property="og:description"', description);
  html = replaceContentAttribute(html, 'property="og:url"', canonical);
  html = replaceContentAttribute(html, 'property="og:image"', image);
  html = replaceContentAttribute(html, 'name="twitter:title"', title);
  html = replaceContentAttribute(html, 'name="twitter:description"', description);
  html = replaceContentAttribute(html, 'name="twitter:image"', image);
  // Smart App Banner "Open" hands the app this page's canonical URL.
  html = replaceContentAttribute(html, 'name="apple-itunes-app"', 'app-id=6790662825, app-argument=' + appArgument);
  if (image !== DEFAULT_IMAGE) {
    html = html.replace(/\s*<meta[^>]+property="og:image:(?:type|width|height)"[^>]*>/gi, '');
    html = replaceContentAttribute(html, 'property="og:image:alt"', title);
  }
  if (!indexable) {
    if (/<meta[^>]+name="robots"/i.test(html)) html = replaceContentAttribute(html, 'name="robots"', 'noindex, follow');
    else html = html.replace('</head>', '<meta name="robots" content="noindex, follow">\n</head>');
  }
  const safeJson = JSON.stringify(jsonLd).replace(/</g, '\\u003c');
  // Function replacers: catalog text may contain $' / $` / $& patterns.
  html = html.replace('</head>', () => '<script type="application/ld+json" data-server-ldjson>' + safeJson + '</script>\n</head>');
  html = html.replace(new RegExp('(<div[^>]+id="' + rootId + '"[^>]*>)', 'i'), (match) => match + '<div data-server-entity>' + body + '</div>');
  return html;
}

function safeHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch { return null; }
}

function formatEventDate(value, timeTbd, timezone) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date TBA';
  const options = { dateStyle: 'long', timeStyle: timeTbd ? undefined : 'short', timeZone: timezone || 'UTC' };
  try { return date.toLocaleString('en-US', options); }
  catch { options.timeZone = 'UTC'; return date.toLocaleString('en-US', options); }
}

function shortEventDate(value, timezone) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const options = { month: 'short', day: 'numeric', timeZone: timezone || 'UTC' };
  try { return date.toLocaleDateString('en-US', options); }
  catch { options.timeZone = 'UTC'; return date.toLocaleDateString('en-US', options); }
}

// Recurring shows share a title and venue; the date keeps each page distinct.
export function eventTitle(event) {
  // TBA times are stored as a midnight-UTC placeholder; the venue zone would show the day before.
  const when = shortEventDate(event.date, event.time_tbd ? 'UTC' : event.timezone);
  return event.title + (event.venue_name ? ' at ' + event.venue_name : '') + (when ? ' · ' + when : '') + ' | Drop';
}

export function eventView(event, { nearby = [], cityPath = null } = {}) {
  const canonical = 'https://trydropapp.com' + eventPath(event);
  const location = [event.venue_name, event.city, event.state].filter(Boolean).join(', ');
  const about = plainText(event.description);
  const description = clipText(about || (event.title + ' at ' + location + '. See event details and tickets on Drop.'), 155);
  const performers = (event.event_artists || []).map((entry) => entry.artists).filter(Boolean);
  const art = safeHttpUrl(event.image_url) || safeHttpUrl(performers.find((artist) => artist.image_url)?.image_url);
  // Share cards use our own image endpoint (byte-checked, correct type, brand fallback).
  // No usable art: the branded per-event card (/og/card, D20) instead of the generic brand image.
  const image = 'https://trydropapp.com/og/' + (art ? 'event/' : 'card/') + encodeURIComponent(event.id);
  const ticketUrl = safeHttpUrl(event.ticket_url);
  const dateText = formatEventDate(event.date, event.time_tbd, event.timezone);
  const lineup = performers.length ? '<p><strong>Lineup:</strong> ' + performers.map((artist) => '<a href="' + artistPath(artist) + '">' + escapeHtml(artist.name) + '</a>').join(', ') + '</p>' : '';
  const statusText = eventAvailabilityText(event);
  const ticket = ticketUrl ? '<p><a href="' + escapeHtml(ticketUrl) + '" rel="nofollow sponsored">' + escapeHtml(ticketActionText(event)) + '</a></p>' : '';
  // Crawlable links out: the venue, the city page, and the next shows in the
  // same city. The chronological "next shows" chain gives every show an
  // inbound link (2026-10-19 audit: 308 orphaned event pages, 43 venues).
  const venueLink = event.venue_id && event.venue_name
    ? '<a href="' + venuePath({ id: event.venue_id, name: event.venue_name, city: event.city }) + '">' + escapeHtml(event.venue_name) + '</a>'
    : escapeHtml(event.venue_name || '');
  const where = [venueLink, escapeHtml([event.city, event.state].filter(Boolean).join(', '))].filter(Boolean).join(', ');
  const more = nearby.length
    ? '<h2>More shows in ' + escapeHtml(event.city) + '</h2><ul>' + nearby.map((next) => '<li><a href="' + eventPath(next) + '">' + escapeHtml(next.title) + '</a> · ' +
      escapeHtml(shortEventDate(next.date, next.time_tbd ? 'UTC' : next.timezone)) + (next.venue_name ? ' · ' + escapeHtml(next.venue_name) : '') + '</li>').join('') + '</ul>'
    : '';
  const cityLink = cityPath ? '<p><a href="' + escapeHtml(cityPath) + '">All EDM shows in ' + escapeHtml(event.city) + '</a></p>' : '';
  const body = '<article class="wrap" style="padding:32px 0"><h1>' + escapeHtml(event.title) + '</h1><p>' + escapeHtml(dateText) + ' · ' + where + '</p>' + lineup + '<p>' + escapeHtml(about) + '</p><p><strong>Status:</strong> ' + escapeHtml(statusText) + '</p>' + ticket + more + cityLink + '</article>';
  const jsonLd = { '@context': 'https://schema.org', ...eventLd(event, { canonical, image, description }) };
  return { title: eventTitle(event), description, canonical, image, body, jsonLd, indexable: isIndexableEvent(event) };
}

// One MusicEvent shape for event pages and the shows listed on venue/artist pages.
export function eventLd(event, { canonical = 'https://trydropapp.com' + eventPath(event), image, description } = {}) {
  const performers = (event.event_artists || []).map((entry) => entry.artists).filter(Boolean);
  const art = image ?? (safeHttpUrl(event.image_url) || safeHttpUrl(performers.find((artist) => artist.image_url)?.image_url));
  const ticketUrl = safeHttpUrl(event.ticket_url);
  return {
    '@type': 'MusicEvent', name: event.title,
    startDate: event.date, endDate: event.end_date && event.end_date !== event.date ? event.end_date : undefined,
    eventStatus: schemaEventStatus(event.lifecycle_status), eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    url: canonical, image: art ? [art] : undefined, description,
    location: { '@type': 'Place', name: event.venue_name, address: { '@type': 'PostalAddress', streetAddress: event.venue_address || undefined, addressLocality: event.city, addressRegion: event.state } },
    performer: performers.map((artist) => ({ '@type': 'MusicGroup', name: artist.name, url: 'https://trydropapp.com' + artistPath(artist) })),
    offers: ticketUrl ? { '@type': 'Offer', url: ticketUrl, price: event.price_min ?? undefined, priceCurrency: event.currency || 'USD', availability: schemaOfferAvailability(event.ticket_status) } : undefined,
  };
}

function breadcrumbLd(trail) {
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: trail.map(([name, url], i) => ({ '@type': 'ListItem', position: i + 1, name, item: url })) };
}

// Shared venue/artist body: breadcrumb, follow (signed-in action, same login gate
// the page's Follow button uses), dated show list. Clients replace it on render.
// ponytail: first 50 shows in body + schema keeps big rooms' pages light.
const LISTED_SHOWS = 50;
function showItem(event, withVenue) {
  const when = formatEventDate(event.date, event.time_tbd, event.time_tbd ? 'UTC' : event.timezone);
  const where = withVenue && event.venue_id
    ? ' — <a href="' + venuePath({ id: event.venue_id, name: event.venue_name, city: event.city }) + '">' + escapeHtml(event.venue_name || 'Venue') + '</a>' + (event.city ? ', ' + escapeHtml(event.city) : '')
    : '';
  return '<li><a href="' + eventPath(event) + '">' + escapeHtml(event.title) + '</a>' + where + ' · ' + escapeHtml(when) + '</li>';
}
function entityBody({ section, sectionHref, name, path, lead, events, withVenue, extra = '' }) {
  const shown = events.slice(0, LISTED_SHOWS);
  const more = events.length > shown.length ? '<p>And ' + (events.length - shown.length) + ' more upcoming shows.</p>' : '';
  const follow = 'https://app.trydropapp.com/?mode=login&next=' + encodeURIComponent(path);
  return '<article class="wrap" style="padding:32px 0"><nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="' + sectionHref + '">' + section + '</a> / ' + escapeHtml(name) + '</nav>' +
    '<h1>' + escapeHtml(name) + '</h1><p>' + escapeHtml(lead) + '</p>' +
    '<p><a href="' + escapeHtml(follow) + '">Follow ' + escapeHtml(name) + ' on Drop</a> · <a href="/download">Get the Drop app</a></p>' + extra +
    '<h2>Upcoming shows</h2>' + (shown.length ? '<ul>' + shown.map((event) => showItem(event, withVenue)).join('') + '</ul>' + more : '<p>No upcoming shows listed right now.</p>') + '</article>';
}
function nextShowText(events, withVenue) {
  const next = events[0];
  if (!next) return '';
  const when = shortEventDate(next.date, next.time_tbd ? 'UTC' : next.timezone);
  return ' Next: ' + next.title + (withVenue && next.venue_name ? ' at ' + next.venue_name : '') + (when ? ' on ' + when : '') + '.';
}

export function venueView(data, { knowBeforeYouGo = '' } = {}) {
  const { venue, events } = data;
  const path = venuePath(venue);
  const canonical = 'https://trydropapp.com' + path;
  const place = [venue.city, venue.state].filter(Boolean).join(', ');
  const count = events.length + ' upcoming show' + (events.length === 1 ? '' : 's');
  const description = clipText(count + ' at ' + venue.name + (place ? ' in ' + place : '') + '.' + nextShowText(events, false) + ' Lineups and ticket links on Drop.', 155);
  const address = { '@type': 'PostalAddress', streetAddress: venue.address || undefined, addressLocality: venue.city, addressRegion: venue.state };
  const lead = [venue.address, place].filter(Boolean).join(' · ') + ' — ' + count + '.';
  const body = entityBody({ section: 'Venues', sectionHref: '/venues', name: venue.name, path, lead, events, withVenue: false, extra: knowBeforeYouGo });
  const jsonLd = [
    { '@context': 'https://schema.org', '@type': 'MusicVenue', name: venue.name, url: canonical, address,
      event: events.slice(0, LISTED_SHOWS).map((event) => eventLd(event)) },
    breadcrumbLd([['Home', 'https://trydropapp.com/'], ['Venues', 'https://trydropapp.com/venues'], [venue.name, canonical]]),
  ];
  return { title: venue.name + (venue.city ? ', ' + venue.city : '') + ': Upcoming Shows | Drop', description, canonical, image: DEFAULT_IMAGE, body, jsonLd, indexable: isIndexableVenue(data) };
}

export function artistView(data) {
  const { artist, events } = data;
  const path = artistPath(artist);
  const canonical = 'https://trydropapp.com' + path;
  const image = safeHttpUrl(artist.image_url);
  const genres = (artist.genres || []).filter(hasText);
  const count = events.length + ' upcoming show' + (events.length === 1 ? '' : 's');
  const description = clipText(artist.name + ': ' + count + '.' + nextShowText(events, true) + ' Dates, venues and ticket links on Drop.', 155);
  const lead = (genres.length ? genres.slice(0, 3).join(', ') + ' · ' : '') + count + '.';
  const body = entityBody({ section: 'Artists', sectionHref: '/artists', name: artist.name, path, lead, events, withVenue: true });
  const website = safeHttpUrl(artist.website_url);
  const jsonLd = [
    { '@context': 'https://schema.org', '@type': 'MusicGroup', name: artist.name, url: canonical,
      genre: genres, image: image || undefined, sameAs: website ? [website] : undefined,
      event: events.slice(0, LISTED_SHOWS).map((event) => eventLd(event)) },
    breadcrumbLd([['Home', 'https://trydropapp.com/'], ['Artists', 'https://trydropapp.com/artists'], [artist.name, canonical]]),
  ];
  return { title: artist.name + ': Upcoming Shows & Tour Dates | Drop', description, canonical, image: image || DEFAULT_IMAGE, body, jsonLd, indexable: isIndexableArtist(data) };
}

// Function HTML is public and already declares s-maxage=3600, but Pages does
// not edge-cache Function responses by itself: keep 200s in the colo cache so
// repeat hits skip the Supabase round trip (Lighthouse: ~750 ms server time).
const CACHE_PARAMS = ['city', 'genre', 'q', 'ref', 'src'];
export async function edgeCached(context, render) {
  const cache = globalThis.caches?.default;
  const { request } = context;
  if (!cache || request.method !== 'GET') return render();
  // Key on path + the params the handlers read (junk params must not mint new
  // keys), plus the deploy so a release never serves the previous build's HTML.
  const url = new URL(request.url);
  const key = new URL(url.pathname, url);
  for (const name of CACHE_PARAMS) if (url.searchParams.has(name)) key.searchParams.set(name, url.searchParams.get(name).slice(0, 128));
  key.searchParams.set('__deploy', context.env?.CF_PAGES_COMMIT_SHA || 'local');
  const hit = await cache.match(key.href);
  if (hit) {
    // Browsers get the page's own policy back, not the edge TTL below.
    const served = new Response(hit.body, hit);
    served.headers.set('Cache-Control', hit.headers.get('X-Drop-Cache-Control') || 'no-cache');
    served.headers.delete('X-Drop-Cache-Control');
    return served;
  }
  const response = await render();
  if (response.status === 200) {
    // ponytail: edge copy capped at 10 min, so a deploy is live within that
    // window even if CF_PAGES_COMMIT_SHA is absent at runtime.
    const copy = new Response(response.clone().body, response);
    copy.headers.set('X-Drop-Cache-Control', response.headers.get('Cache-Control') || 'no-cache');
    copy.headers.set('Cache-Control', 'public, max-age=600');
    context.waitUntil(cache.put(key.href, copy));
  }
  return response;
}

// Mirrors the `/*` block in _headers, which Function responses bypass.
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), payment=(), usb=(), geolocation=(self)',
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  'Content-Security-Policy': "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  'Content-Security-Policy-Report-Only': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' https: data:; connect-src 'self' https://ebccwnkmsnhbljxxxdej.supabase.co wss://ebccwnkmsnhbljxxxdej.supabase.co https://app.trydropapp.com https://trydropapp.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
};

export function htmlResponse(html, status = 200, cacheControl = 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400') {
  return new Response(html, { status, headers: { ...SECURITY_HEADERS, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': cacheControl } });
}

export function redirectResponse(path, requestUrl) {
  return new Response(null, { status: 301, headers: { Location: path + safeAttributionQuery(requestUrl), 'Cache-Control': 'public, max-age=3600' } });
}

export function sitemapXml(entities, extraPaths = []) {
  const urls = [
    ...extraPaths.map((loc) => ({ loc })),
    ...entities.events.map((event) => ({ loc: eventPath(event), lastmod: event.created_at })),
    ...entities.venues.map((venue) => ({ loc: venuePath(venue) })),
    ...entities.artists.map((artist) => ({ loc: artistPath(artist) })),
  ];
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.map(({ loc, lastmod }) => '  <url><loc>https://trydropapp.com' + escapeHtml(loc) + '</loc>' + (lastmod ? '<lastmod>' + escapeHtml(String(lastmod).slice(0, 10)) + '</lastmod>' : '') + '</url>').join('\n') + '\n</urlset>\n';
}
