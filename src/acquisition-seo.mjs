import { escapeHtml, eventLd, eventPath, isIndexableEvent, rest, venuePath } from './entity-seo.mjs';
import { matchesGenre } from './genres.mjs';

export const GENRES = ['House', 'Techno', 'Bass', 'Drum & Bass', 'Hip-Hop', 'Indie'];
// US markets with >=20 upcoming published shows in event_cities (2026-10-18; mirrors data.js).
// Thin pages inside a market stay noindex and out of the sitemap via the show gates below.
export const CITIES = ['Denver', 'Los Angeles', 'Seattle', 'Portland', 'San Diego', 'Brooklyn', 'New York', 'Chicago', 'Dallas', 'Austin', 'Boston', 'Las Vegas', 'San Francisco', 'Houston', 'Phoenix', 'Atlanta', 'Cambridge', 'Washington', 'Miami', 'Detroit', 'Philadelphia', 'Columbus', 'Charlotte'];

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
      select: 'id,title,date,end_date,timezone,time_tbd,is_festival,lifecycle_status,venue_id,venue_name,venue_address,city,state,image_url,ticket_url,price_min,currency,ticket_status,event_artists(artists(id,name,genres,image_url))',
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

// Shows in the same state outside every market city: the only crawl path to
// single-show towns (2026-10-19 crawl: the last 45 orphans were all these).
// ponytail: 200 links per city page; split by region if one state outgrows it.
export const STATE_SHOW_LINKS = 200;
// Bordering states/provinces with no market of their own ride along with a
// market state, so every upcoming show has a crawl path (none are noindexed).
export const NEARBY_STATES = {
  CO: ['NM', 'UT', 'WY', 'KS', 'NE'], WA: ['ID', 'MT', 'AK', 'BC'], OR: [], CA: ['HI'], NV: [], AZ: [],
  TX: ['OK', 'LA', 'AR'], IL: ['IN', 'WI', 'MO', 'IA', 'MN'], GA: ['TN', 'AL', 'SC', 'MS'], FL: [],
  NY: ['NJ', 'CT', 'VT'], MA: ['NH', 'RI', 'ME'], PA: ['DE', 'MD', 'WV'], DC: ['VA'], MI: ['ON'], OH: ['KY'], NC: [],
};
export async function smallTownShows(state) {
  if (!state) return [];
  const states = [state, ...(NEARBY_STATES[state] || [])];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  try {
    const rows = await rest('events', {
      select: 'id,title,date,timezone,time_tbd,lifecycle_status,venue_id,venue_name,venue_address,city,state',
      // Same "upcoming" as the sitemap: ongoing runs (season passes, residencies) count.
      status: 'eq.published', state: 'in.(' + states.join(',') + ')', or: '(date.gte.' + today.toISOString() + ',end_date.gte.' + today.toISOString() + ')', order: 'date.asc,id.asc', limit: 1000,
    });
    const markets = new Set(CITIES.map((city) => city.toLowerCase()));
    return rows.filter((event) => isIndexableEvent(event) && !markets.has(String(event.city || '').trim().toLowerCase())).slice(0, STATE_SHOW_LINKS);
  } catch { return []; }
}

// Most common state among a city's shows (CITIES carries names only).
export function stateOf(events) {
  const tally = {};
  for (const event of events || []) if (event.state) tally[event.state] = (tally[event.state] || 0) + 1;
  return Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0] || null;
}

// Denver is the server default, so its canonical genre URL has no city param
// (that is the form listed in the static sitemap).
export function genrePath(genre, city) {
  return '/genre?genre=' + encodeURIComponent(genre) + (city && city !== 'Denver' ? '&city=' + encodeURIComponent(city) : '');
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
      // Same MusicEvent as the event page (image, offers, performers when known).
      item: eventLd(event),
    })),
  };
}

function inject(html, railId, block, ld) {
  if (!block) return html;
  html = html.replace(new RegExp('(<div class="rail" id="' + railId + '"[^>]*>)'), (match) => match + '<div data-server-entity>' + block + '</div>');
  if (!ld.itemListElement.length) return html;
  const json = JSON.stringify(ld).replace(/</g, '\\u003c');
  return html.replace('</head>', () => '<script type="application/ld+json" data-server-ldjson>' + json + '</script>\n</head>');
}

// Same Q&A as city.html's client fallback (tests keep them equal). Rendered
// server-side so the visible FAQ and its FAQPage schema ship in the HTML.
export function cityFaq(city) {
  return [
    { q: 'How often is the ' + city + ' show list updated?', a: 'Every day. New listings, price changes, and lineup updates land as soon as promoters and venues confirm them.' },
    { q: 'Are ticket prices on Drop all-in?', a: 'Where the seller publishes an all-in price, Drop shows it. Otherwise Drop shows the listed price plus an estimate of typical fees.' },
    { q: 'Can I see which friends are going to a show in ' + city + '?', a: 'Yes, once you create a free account. Drop shows you who in your crew already has a show on their radar.' },
    { q: 'Is Drop free to use in ' + city + '?', a: 'Yes, browsing and account features are free. Drop is a discovery layer, not a ticket seller.' },
  ];
}

function withCityFaq(html, city) {
  const faq = cityFaq(city);
  const items = faq.map(({ q, a }) => '<details class="faq-item"><summary>' + escapeHtml(q) + '</summary><p>' + escapeHtml(a) + '</p></details>').join('');
  const ld = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) };
  html = html.replace(/(<div class="faq-list" id="city-faq"[^>]*>)/, (match) => match + items);
  return html.replace('</head>', () => '<script type="application/ld+json" data-server-faq>' + JSON.stringify(ld).replace(/</g, '\\u003c') + '</script>\n</head>');
}

export function renderCityPage(template, city, events = [], elsewhere = []) {
  const canonical = 'https://trydropapp.com/city?city=' + encodeURIComponent(city);
  const description = 'Every rave, festival, and club night in ' + city + ' — with all-in prices and who’s going. Updated daily.';
  const html = render(template, {
    title: 'EDM Shows in ' + city + ' | Drop', description, canonical, prefix: 'city',
    heading: 'EDM shows in ' + city, subheading: description,
    // events === null: catalog unreachable, keep the page indexable.
    indexable: events === null || events.length >= MIN_GENRE_SHOWS,
  });
  const shows = (events || []).slice(0, 24);
  const genres = liveGenres(events || []).map((genre) => '<li><a href="' + escapeHtml(genrePath(genre, city)) + '">' + escapeHtml(genre) + ' in ' + escapeHtml(city) + '</a></li>');
  // Own heading: the host sits under "This weekend", these run further out.
  const guides = ['<li><a href="/events?when=weekend&amp;city=' + escapeHtml(encodeURIComponent(city)) + '">This weekend in ' + escapeHtml(city) + '</a></li>',
    '<li><a href="/events?festival=1">Upcoming festivals</a></li>', '<li><a href="/guides">Guides: festivals, venues and your first rave</a></li>'];
  const others = CITIES.filter((other) => other !== city).map((other) => '<li><a href="/city?city=' + escapeHtml(encodeURIComponent(other)) + '">EDM shows in ' + escapeHtml(other) + '</a></li>');
  const towns = (elsewhere || []).map((event) => '<li><a href="' + escapeHtml(eventPath(event)) + '">' + escapeHtml(event.title) + '</a> — ' + escapeHtml([event.venue_name, event.city].filter(Boolean).join(', ')) + ', ' + escapeHtml(shortDate(event)) + '</li>');
  const block = linkBlock('Upcoming shows in ' + city, eventItems(shows)) + linkBlock('Genres in ' + city, genres) + linkBlock('More in ' + city, guides) +
    linkBlock('More shows nearby, outside the big cities', towns) + linkBlock('Other cities', others);
  return inject(withCityFaq(html, city), 'rail-city-weekend', block, itemListLd('Upcoming shows in ' + city, shows));
}

// City pages for the entity sitemap: only markets with enough real upcoming shows.
// Denver (home market) stays in the static sitemap.xml, like its genre pages.
export function cityPaths(events) {
  return CITIES.filter((city) => city !== 'Denver' && events.filter((event) => String(event.city || '').toLowerCase() === city.toLowerCase()).length >= MIN_GENRE_SHOWS)
    .map((city) => '/city?city=' + encodeURIComponent(city));
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
