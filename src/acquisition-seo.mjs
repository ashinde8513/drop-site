import { escapeHtml, eventPath, isIndexableEvent, rest, schemaEventStatus, venuePath } from './entity-seo.mjs';
import { matchesGenre } from './genres.mjs';

export const GENRES = ['House', 'Techno', 'Bass', 'Drum & Bass', 'Hip-Hop', 'Indie'];
export const CITIES = ['Denver', 'Los Angeles', 'Seattle', 'Portland', 'San Diego', 'Brooklyn', 'New York', 'Chicago', 'Dallas', 'Austin', 'Boston'];

export function cleanCity(value) {
  const city = typeof value === 'string' ? value.trim() : '';
  return /^[\p{L}\p{M} .'-]{1,60}$/u.test(city) ? city.charAt(0).toUpperCase() + city.slice(1) : null;
}

export function knownCity(value) {
  const city = cleanCity(value);
  return city ? CITIES.find((known) => known.toLowerCase() === city.toLowerCase()) || null : null;
}

function render(template, { title, description, canonical, heading, subheading, prefix, indexable = true }) {
  const text = (html, id, value) => html.replace(
    new RegExp('(<(?:title|h1|p)\\b[^>]*id="' + id + '"[^>]*>)[^<]*'),
    (_match, start) => start + escapeHtml(value),
  );
  const meta = (html, marker, value) => html.replace(
    new RegExp('(<meta[^>]*' + marker + '[^>]*content=")[^"]*(")'),
    (_match, start, end) => start + escapeHtml(value) + end,
  );
  let html = text(template, 'doc-title', title);
  html = text(html, prefix + '-h1', heading);
  html = text(html, prefix + '-sub', subheading);
  for (const [id, value] of [['meta-desc', description], ['og-title', title], ['og-desc', description], ['tw-title', title], ['tw-desc', description]]) {
    html = meta(html, 'id="' + id + '"', value);
  }
  html = html.replace(/(<link rel="canonical" href=")[^"]*(")/, (_match, start, end) => start + escapeHtml(canonical) + end);
  html = meta(html, 'property="og:url"', canonical);
  const schema = JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebPage', name: title, url: canonical, description }).replace(/</g, '\\u003c');
  html = html.replace(/(<script type="application\/ld\+json" id="ld-json">)[\s\S]*?(<\/script>)/, (_match, start, end) => start + schema + end);
  return indexable ? html : html.replace('</head>', '<meta name="robots" content="noindex, follow" />\n</head>');
}

// Next indexable shows for a city, for crawlable links. Never throws: the page
// still renders (client-side rails) if the catalog is unreachable.
// A city×genre page is indexable only with this many real upcoming shows;
// thinner combinations stay reachable but `noindex, follow`.
export const MIN_GENRE_SHOWS = 3;

// Upcoming indexable shows for a city (optionally one genre), for crawlable
// links and ItemList schema. Resolves null when the catalog is unreachable so
// callers keep their previous indexing decision instead of flipping to noindex.
export async function upcomingEvents({ city, genre = null, limit = 24 }) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  try {
    const rows = await rest('events', {
      select: 'id,title,date,timezone,time_tbd,is_festival,lifecycle_status,venue_id,venue_name,venue_address,city,state,event_artists(artists(genres))',
      status: 'eq.published', city: 'ilike.' + city, date: 'gte.' + today.toISOString(),
      order: 'date.asc,id.asc', limit: 500,
    });
    return rows.filter((event) => isIndexableEvent(event) && (!genre || matchesGenre(event, genre))).slice(0, limit);
  } catch {
    return null;
  }
}

function shortDate(event) {
  const options = { month: 'short', day: 'numeric', timeZone: event.time_tbd ? 'UTC' : (event.timezone || 'UTC') };
  try { return new Date(event.date).toLocaleDateString('en-US', options); }
  catch { return new Date(event.date).toLocaleDateString('en-US', { ...options, timeZone: 'UTC' }); }
}

// Plain links inside a rail host that site.js clears synchronously
// (skeletonGrid) before painting: non-JS crawlers see them, visitors don't.
function linkBlock(heading, items) {
  return items.length ? '<h3>' + escapeHtml(heading) + '</h3><ul>' + items.join('') + '</ul>' : '';
}

function eventItems(events) {
  return events.map((event) => '<li><a href="' + escapeHtml(eventPath(event)) + '">' + escapeHtml(event.title) + '</a> — ' +
    (event.venue_id ? '<a href="' + escapeHtml(venuePath(event)) + '">' + escapeHtml(event.venue_name) + '</a>' : escapeHtml(event.venue_name)) +
    ', ' + escapeHtml(shortDate(event)) + '</li>');
}

export function genrePath(genre, city) {
  return '/genre?genre=' + encodeURIComponent(genre) + (city ? '&city=' + encodeURIComponent(city) : '');
}

// Genres with enough real shows in this sample to earn an indexable page.
export function liveGenres(events) {
  return GENRES.filter((genre) => events.filter((event) => matchesGenre(event, genre)).length >= MIN_GENRE_SHOWS);
}

function itemListLd(name, events) {
  return {
    '@context': 'https://schema.org', '@type': 'ItemList', name,
    itemListElement: events.map((event, index) => ({
      '@type': 'ListItem', position: index + 1,
      item: {
        '@type': 'MusicEvent', name: event.title, startDate: event.date, url: 'https://trydropapp.com' + eventPath(event),
        eventStatus: schemaEventStatus(event.lifecycle_status), eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        location: { '@type': 'Place', name: event.venue_name, address: { '@type': 'PostalAddress', streetAddress: event.venue_address || undefined, addressLocality: event.city, addressRegion: event.state } },
      },
    })),
  };
}

function inject(html, railId, block, ld) {
  if (!block) return html;
  html = html.replace(new RegExp('(<div class="rail" id="' + railId + '"[^>]*>)'), (match) => match + '<div data-server-entity>' + block + '</div>');
  const json = JSON.stringify(ld).replace(/</g, '\\u003c');
  return html.replace('</head>', '<script type="application/ld+json" data-server-ldjson>' + json + '</script>\n</head>');
}

export function renderCityPage(template, city, events = []) {
  const canonical = 'https://trydropapp.com/city?city=' + encodeURIComponent(city);
  const description = 'Every rave, festival, and club night in ' + city + ' — with all-in prices and who’s going. Updated daily.';
  const html = render(template, {
    title: 'EDM Shows in ' + city + ' | Drop', description, canonical, prefix: 'city',
    heading: 'EDM shows in ' + city, subheading: description,
  });
  const shows = (events || []).slice(0, 24);
  const genres = liveGenres(events || []).map((genre) => '<li><a href="' + escapeHtml(genrePath(genre, city)) + '">' + escapeHtml(genre) + ' in ' + escapeHtml(city) + '</a></li>');
  // Own heading: the host sits under "This weekend", these run further out.
  const block = linkBlock('Upcoming shows in ' + city, eventItems(shows)) + linkBlock('Genres in ' + city, genres);
  return inject(html, 'rail-city-weekend', block, itemListLd('Upcoming shows in ' + city, shows));
}

// Indexable city×genre pages for the entity sitemap. Denver's genre pages are
// already listed (without the city param) in the static sitemap.xml.
export function genreCityPaths(events) {
  return CITIES.filter((city) => city !== 'Denver').flatMap((city) => {
    const inCity = events.filter((event) => String(event.city || '').toLowerCase() === city.toLowerCase());
    return liveGenres(inCity).map((genre) => genrePath(genre, city));
  });
}

// events === null means the catalog was unreachable: keep the city-based decision.
export function renderGenrePage(template, genre, city, hasCity, indexable = true, events = null) {
  const canonical = 'https://trydropapp.com' + genrePath(genre, hasCity ? city : null);
  const description = 'Upcoming ' + genre.toLowerCase() + ' shows, the artists defining the sound, and where to catch them live near ' + city + '.';
  const shows = events || [];
  const html = render(template, {
    title: genre + ' Events Near ' + city + ' | Drop', description, canonical, prefix: 'genre',
    heading: genre + ' events near ' + city,
    subheading: 'Upcoming ' + genre.toLowerCase() + ' shows, the artists defining the sound, and where to catch them live.',
    indexable: indexable && (events === null || shows.length >= MIN_GENRE_SHOWS),
  });
  const name = 'Upcoming ' + genre + ' shows in ' + city;
  return inject(html, 'rail-genre-shows', linkBlock(name, eventItems(shows)), itemListLd(name, shows));
}
