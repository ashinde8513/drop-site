import { escapeHtml } from './entity-seo.mjs';

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

export function renderCityPage(template, city) {
  const canonical = 'https://trydropapp.com/city?city=' + encodeURIComponent(city);
  const description = 'Every rave, festival, and club night in ' + city + ' — with all-in prices and who’s going. Updated daily.';
  return render(template, {
    title: 'EDM Shows in ' + city + ' | Drop', description, canonical, prefix: 'city',
    heading: 'EDM shows in ' + city, subheading: description,
  });
}

export function renderGenrePage(template, genre, city, hasCity, indexable = true) {
  const canonical = 'https://trydropapp.com/genre?genre=' + encodeURIComponent(genre) + (hasCity ? '&city=' + encodeURIComponent(city) : '');
  const description = 'Upcoming ' + genre.toLowerCase() + ' shows, the artists defining the sound, and where to catch them live near ' + city + '.';
  return render(template, {
    title: genre + ' Events Near ' + city + ' | Drop', description, canonical, prefix: 'genre',
    heading: genre + ' events near ' + city,
    subheading: 'Upcoming ' + genre.toLowerCase() + ' shows, the artists defining the sound, and where to catch them live.', indexable,
  });
}
