const REST = 'https://ebccwnkmsnhbljxxxdej.supabase.co/rest/v1/';
const PUBLIC_KEY = 'sb_publishable_ZMsNcfhfqsGgyvsdBDTKHg__h8SDZyd';
const EVENT_SELECT = 'id,title,description,date,end_date,venue_id,venue_name,venue_address,city,state,image_url,ticket_url,price_min,price_max,currency,time_tbd,timezone,lifecycle_status,ticket_status,created_at,event_artists(artists(id,name,genres,image_url))';

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

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isIndexableEvent(event) {
  return Boolean(event && routeId([event.id]) && hasText(event.title) && hasText(event.date) && Number.isFinite(Date.parse(event.date)) &&
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
  const hasProfile = (Array.isArray(artist?.genres) && artist.genres.some(hasText)) ||
    Boolean(safeHttpUrl(artist?.image_url) || safeHttpUrl(artist?.website_url));
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
  const response = await fetch(REST + table + '?' + query(params), {
    headers: { apikey: PUBLIC_KEY, Authorization: 'Bearer ' + PUBLIC_KEY },
  });
  if (!response.ok) throw new Error('Supabase HTTP ' + response.status);
  return response.json();
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
      select: 'id,title,date,venue_id,venue_name,venue_address,city,state,created_at,event_artists(artists(id,name,genres,image_url,website_url))',
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

export function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function replaceContentAttribute(html, marker, value) {
  const pattern = new RegExp('(<meta[^>]+' + marker + '[^>]+content=")[^"]*(")', 'i');
  return html.replace(pattern, (_match, before, after) => before + escapeHtml(value) + after);
}

export function renderTemplate(template, { title, description, canonical, image, rootId, body, jsonLd, indexable = true }) {
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
  if (!indexable) {
    if (/<meta[^>]+name="robots"/i.test(html)) html = replaceContentAttribute(html, 'name="robots"', 'noindex, follow');
    else html = html.replace('</head>', '<meta name="robots" content="noindex, follow">\n</head>');
  }
  const safeJson = JSON.stringify(jsonLd).replace(/</g, '\\u003c');
  html = html.replace('</head>', '<script type="application/ld+json" data-server-ldjson>' + safeJson + '</script>\n</head>');
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

export function eventView(event) {
  const canonical = 'https://trydropapp.com' + eventPath(event);
  const location = [event.venue_name, event.city, event.state].filter(Boolean).join(', ');
  const description = String(event.description || (event.title + ' at ' + location + '. See event details and tickets on Drop.')).slice(0, 155);
  const performers = (event.event_artists || []).map((entry) => entry.artists).filter(Boolean);
  const image = safeHttpUrl(event.image_url) || safeHttpUrl(performers.find((artist) => artist.image_url)?.image_url) || 'https://trydropapp.com/og-image.png';
  const ticketUrl = safeHttpUrl(event.ticket_url);
  const dateText = formatEventDate(event.date, event.time_tbd, event.timezone);
  const lineup = performers.length ? '<p><strong>Lineup:</strong> ' + performers.map((artist) => '<a href="' + artistPath(artist) + '">' + escapeHtml(artist.name) + '</a>').join(', ') + '</p>' : '';
  const statusText = eventAvailabilityText(event);
  const ticket = ticketUrl ? '<p><a href="' + escapeHtml(ticketUrl) + '" rel="nofollow sponsored">' + escapeHtml(ticketActionText(event)) + '</a></p>' : '';
  const body = '<article class="wrap" style="padding:32px 0"><h1>' + escapeHtml(event.title) + '</h1><p>' + escapeHtml(dateText + ' · ' + location) + '</p>' + lineup + '<p>' + escapeHtml(event.description || '') + '</p><p><strong>Status:</strong> ' + escapeHtml(statusText) + '</p>' + ticket + '</article>';
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Event', name: event.title,
    startDate: event.date, endDate: event.end_date || undefined,
    eventStatus: schemaEventStatus(event.lifecycle_status), eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    url: canonical, image: image ? [image] : undefined, description,
    location: { '@type': 'Place', name: event.venue_name, address: { '@type': 'PostalAddress', streetAddress: event.venue_address || undefined, addressLocality: event.city, addressRegion: event.state } },
    performer: performers.map((artist) => ({ '@type': 'MusicGroup', name: artist.name, url: 'https://trydropapp.com' + artistPath(artist) })),
    offers: ticketUrl ? { '@type': 'Offer', url: ticketUrl, price: event.price_min ?? undefined, priceCurrency: event.currency || 'USD', availability: schemaOfferAvailability(event.ticket_status) } : undefined,
  };
  return { title: event.title + ' at ' + event.venue_name + ' | Drop', description, canonical, image, body, jsonLd, indexable: isIndexableEvent(event) };
}

export function venueView(data) {
  const { venue, events } = data;
  const canonical = 'https://trydropapp.com' + venuePath(venue);
  const description = ('See ' + events.length + ' upcoming events at ' + venue.name + ' in ' + [venue.city, venue.state].filter(Boolean).join(', ') + ' on Drop.').slice(0, 155);
  const items = events.map((event) => '<li><a href="' + eventPath(event) + '">' + escapeHtml(event.title) + '</a> — ' + escapeHtml(new Date(event.date).toLocaleDateString('en-US', { dateStyle: 'medium' })) + '</li>').join('');
  const body = '<article class="wrap" style="padding:32px 0"><h1>' + escapeHtml(venue.name) + '</h1><p>' + escapeHtml(description) + '</p><h2>Upcoming events</h2><ul>' + items + '</ul></article>';
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'MusicVenue', name: venue.name, url: canonical,
    address: { '@type': 'PostalAddress', streetAddress: venue.address || undefined, addressLocality: venue.city, addressRegion: venue.state },
    event: events.map((event) => ({ '@type': 'Event', name: event.title, startDate: event.date, url: 'https://trydropapp.com' + eventPath(event) })),
  };
  return { title: venue.name + ' Events | Drop', description, canonical, image: 'https://trydropapp.com/og-image.png', body, jsonLd, indexable: isIndexableVenue(data) };
}

export function artistView(data) {
  const { artist, events } = data;
  const canonical = 'https://trydropapp.com' + artistPath(artist);
  const description = ('See upcoming ' + artist.name + ' events, venues, and ticket details on Drop.').slice(0, 155);
  const items = events.map((event) => '<li><a href="' + eventPath(event) + '">' + escapeHtml(event.title) + '</a> at ' + escapeHtml(event.venue_name || '') + '</li>').join('');
  const body = '<article class="wrap" style="padding:32px 0"><h1>' + escapeHtml(artist.name) + '</h1><p>' + escapeHtml(description) + '</p><h2>Upcoming events</h2><ul>' + items + '</ul></article>';
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'MusicGroup', name: artist.name, url: canonical,
    genre: artist.genres || [], image: artist.image_url || undefined,
    event: events.map((event) => ({ '@type': 'Event', name: event.title, startDate: event.date, url: 'https://trydropapp.com' + eventPath(event) })),
  };
  return { title: artist.name + ' Events | Drop', description, canonical, image: artist.image_url || 'https://trydropapp.com/og-image.png', body, jsonLd, indexable: isIndexableArtist(data) };
}

export function htmlResponse(html, status = 200) {
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400', 'X-Content-Type-Options': 'nosniff' } });
}

export function redirectResponse(path) {
  return new Response(null, { status: 301, headers: { Location: path, 'Cache-Control': 'public, max-age=3600' } });
}

export function sitemapXml(entities) {
  const urls = [
    ...entities.events.map((event) => ({ loc: eventPath(event), lastmod: event.created_at })),
    ...entities.venues.map((venue) => ({ loc: venuePath(venue) })),
    ...entities.artists.map((artist) => ({ loc: artistPath(artist) })),
  ];
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.map(({ loc, lastmod }) => '  <url><loc>https://trydropapp.com' + escapeHtml(loc) + '</loc>' + (lastmod ? '<lastmod>' + escapeHtml(String(lastmod).slice(0, 10)) + '</lastmod>' : '') + '</url>').join('\n') + '\n</urlset>\n';
}
