// Editorial views of the events page, rebuilt from the live catalog on each
// (edge-cached) request: "This weekend in <city>" (/events?when=weekend&city=X)
// and "Upcoming festivals" (/events?festival=1). Same template and client JS as
// /events; the server adds real listings, schema and its own canonical. Copy is
// templated from catalog data only.
import { CITIES, knownCity, MIN_GENRE_SHOWS } from './acquisition-seo.mjs';
import { escapeHtml, eventPath, isIndexableEvent, rest, schemaEventStatus, venuePath } from './entity-seo.mjs';

export const CITY_TIME_ZONES = {
  Denver: 'America/Denver', 'Los Angeles': 'America/Los_Angeles', Seattle: 'America/Los_Angeles',
  Portland: 'America/Los_Angeles', 'San Diego': 'America/Los_Angeles', Brooklyn: 'America/New_York',
  'New York': 'America/New_York', Chicago: 'America/Chicago', Dallas: 'America/Chicago',
  Austin: 'America/Chicago', Boston: 'America/New_York',
};
const SELECT = 'id,title,date,end_date,timezone,time_tbd,is_festival,lifecycle_status,venue_id,venue_name,venue_address,city,state,image_url';

function zonedParts(date, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map((p) => [p.type, p.value]));
  return { y: +parts.year, m: +parts.month, d: +parts.day, wall: Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second) };
}

// Wall-clock time in `timeZone` → UTC ISO (offset taken at that instant's noon).
function zonedIso(y, m, d, h, min, s, timeZone) {
  const noon = new Date(Date.UTC(y, m - 1, d, 12));
  const offset = zonedParts(noon, timeZone).wall - noon.getTime();
  return new Date(Date.UTC(y, m - 1, d, h, min, s) - offset).toISOString();
}

// Same window as events.html whenRange('weekend'), in the city's own time zone:
// Friday 00:00 → Sunday 23:59:59 of this (or the coming) weekend.
export function weekendRange(timeZone, now = new Date()) {
  const { y, m, d } = zonedParts(now, timeZone);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const shift = day === 6 ? -1 : day === 0 ? -2 : (5 - day + 7) % 7;
  const fri = new Date(Date.UTC(y, m - 1, d + shift));
  const sun = new Date(Date.UTC(y, m - 1, d + shift + 2));
  return {
    from: zonedIso(fri.getUTCFullYear(), fri.getUTCMonth() + 1, fri.getUTCDate(), 0, 0, 0, timeZone),
    to: zonedIso(sun.getUTCFullYear(), sun.getUTCMonth() + 1, sun.getUTCDate(), 23, 59, 59, timeZone),
  };
}

export function inWeekend(event, range) {
  const t = Date.parse(event.date);
  return t >= Date.parse(range.from) && t <= Date.parse(range.to);
}

// null = catalog unreachable (callers keep the static page).
export async function weekendEvents(city, now = new Date()) {
  const range = weekendRange(CITY_TIME_ZONES[city], now);
  try {
    const rows = await rest('events', {
      select: SELECT, status: 'eq.published', city: 'ilike.' + city,
      and: '(date.gte.' + range.from + ',date.lte.' + range.to + ')', order: 'date.asc,id.asc', limit: 300,
    });
    return rows.filter(isIndexableEvent);
  } catch {
    return null;
  }
}

// Mirrors Drop.fetchFestivals: upcoming plus still-running festivals.
export async function upcomingFestivals(now = new Date()) {
  const startOfToday = new Date(now);
  startOfToday.setUTCHours(0, 0, 0, 0);
  const common = { select: SELECT, status: 'eq.published', is_festival: 'is.true', order: 'date.asc,id.asc', limit: 300 };
  try {
    const [future, ongoing] = await Promise.all([
      rest('events', { ...common, date: 'gte.' + startOfToday.toISOString() }),
      rest('events', { ...common, date: 'lt.' + startOfToday.toISOString(), end_date: 'gte.' + now.toISOString() }),
    ]);
    const byId = new Map([...future, ...ongoing].map((event) => [event.id, event]));
    return [...byId.values()].filter(isIndexableEvent)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id)));
  } catch {
    return null;
  }
}

function dateText(event) {
  const options = { weekday: 'short', month: 'short', day: 'numeric', timeZone: event.time_tbd ? 'UTC' : (event.timezone || 'UTC') };
  const fmt = (value) => {
    try { return new Date(value).toLocaleDateString('en-US', options); }
    catch { return new Date(value).toLocaleDateString('en-US', { ...options, timeZone: 'UTC' }); }
  };
  return event.end_date && event.end_date !== event.date ? fmt(event.date) + ' – ' + fmt(event.end_date) : fmt(event.date);
}

function listHtml(heading, events) {
  if (!events.length) return '';
  const items = events.map((event) => '<li><a href="' + escapeHtml(eventPath(event)) + '">' + escapeHtml(event.title) + '</a> — ' +
    (event.venue_id ? '<a href="' + escapeHtml(venuePath(event)) + '">' + escapeHtml(event.venue_name) + '</a>' : escapeHtml(event.venue_name || '')) +
    ', ' + escapeHtml([event.city, event.state].filter(Boolean).join(', ')) + ', ' + escapeHtml(dateText(event)) + '</li>');
  return '<div data-server-entity><h2>' + escapeHtml(heading) + '</h2><ul>' + items.join('') + '</ul></div>';
}

function itemList(name, events, type) {
  return {
    '@context': 'https://schema.org', '@type': 'ItemList', name, numberOfItems: events.length,
    itemListElement: events.map((event, index) => ({
      '@type': 'ListItem', position: index + 1,
      item: {
        '@type': type, name: event.title, startDate: event.date, endDate: event.end_date && event.end_date !== event.date ? event.end_date : undefined,
        url: 'https://trydropapp.com' + eventPath(event), eventStatus: schemaEventStatus(event.lifecycle_status),
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode', image: event.image_url || undefined,
        location: { '@type': 'Place', name: event.venue_name, address: { '@type': 'PostalAddress', streetAddress: event.venue_address || undefined, addressLocality: event.city, addressRegion: event.state } },
      },
    })),
  };
}

function preview(events) {
  return events.slice(0, 3).map((event) => event.title).join(', ');
}

function render(template, { title, description, canonical, heading, events, ld, indexable }) {
  const meta = (html, marker, value) => html.replace(new RegExp('(<meta[^>]*' + marker + '[^>]*content=")[^"]*(")'), (_m, a, b) => a + escapeHtml(value) + b);
  let html = template.replace(/<title>[^<]*<\/title>/, '<title>' + escapeHtml(title) + '</title>');
  html = meta(html, 'name="description"', description);
  html = meta(html, 'property="og:title"', title);
  html = meta(html, 'property="og:description"', description);
  html = meta(html, 'property="og:url"', canonical);
  html = meta(html, 'name="twitter:title"', title);
  html = meta(html, 'name="twitter:description"', description);
  html = html.replace(/(<link rel="canonical" href=")[^"]*(")/, (_m, a, b) => a + escapeHtml(canonical) + b);
  html = html.replace(/<h1 class="wsh__title">[^<]*<\/h1>/, '<h1 class="wsh__title">' + escapeHtml(heading) + '</h1>');
  // Same CollectionPage block, now naming this view.
  html = html.replace(/("@type": "CollectionPage",\s*"name": )"[^"]*"(,\s*"description": )"[^"]*"(,\s*"url": )"[^"]*"/,
    (_m, a, b, c) => a + JSON.stringify(heading) + b + JSON.stringify(description) + c + JSON.stringify(canonical));
  html = html.replace(/(<div class="grid-events" id="grid"[^>]*>)/, (match) => match + listHtml(heading, events));
  if (events.length) html = html.replace('</head>', '<script type="application/ld+json" data-server-ldjson>' + JSON.stringify(ld).replace(/</g, '\\u003c') + '</script>\n</head>');
  if (!indexable) html = html.replace('</head>', '<meta name="robots" content="noindex, follow" />\n</head>');
  return html;
}

export function weekendPath(city) {
  return '/events?when=weekend&city=' + encodeURIComponent(city);
}
export const FESTIVALS_PATH = '/events?festival=1';

export function renderWeekendPage(template, city, events) {
  const heading = 'This weekend in ' + city;
  const description = events.length
    ? events.length + ' show' + (events.length === 1 ? '' : 's') + ' this weekend in ' + city + ' on Drop: ' + preview(events) + '.'
    : 'Shows this weekend in ' + city + ' on Drop.';
  return render(template, {
    title: 'EDM Shows This Weekend in ' + city + ' | Drop', description, canonical: 'https://trydropapp.com' + weekendPath(city),
    heading, events, ld: itemList(heading, events, 'MusicEvent'), indexable: events.length >= MIN_GENRE_SHOWS,
  });
}

export function renderFestivalsPage(template, events) {
  const heading = 'Upcoming festivals';
  const description = events.length
    ? events.length + ' upcoming festival' + (events.length === 1 ? '' : 's') + ' on Drop: ' + preview(events) + '.'
    : 'Upcoming festivals on Drop.';
  return render(template, {
    title: 'Upcoming EDM Festivals | Drop', description, canonical: 'https://trydropapp.com' + FESTIVALS_PATH,
    heading, events, ld: itemList(heading, events, 'Festival'), indexable: events.length > 0,
  });
}

// Which editorial view (if any) a request is: exact parameter sets only.
export function editorialView(url) {
  const params = new URL(url).searchParams;
  const keys = [...params.keys()].sort().join(',');
  if (keys === 'festival' && params.get('festival') === '1') return { kind: 'festivals' };
  const city = knownCity(params.get('city'));
  if (keys === 'city,when' && params.get('when') === 'weekend' && city) return { kind: 'weekend', city };
  return null;
}

// Sitemap: weekend pages that clear the show gate, plus festivals when any exist.
export function editorialPaths(events, now = new Date()) {
  const weekend = CITIES.filter((city) => {
    const range = weekendRange(CITY_TIME_ZONES[city], now);
    return events.filter((event) => String(event.city || '').toLowerCase() === city.toLowerCase() && inWeekend(event, range)).length >= MIN_GENRE_SHOWS;
  }).map(weekendPath);
  return events.some((event) => event.is_festival) ? [...weekend, FESTIVALS_PATH] : weekend;
}
