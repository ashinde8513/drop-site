import { escapeHtml, eventPath, restWithCount } from './entity-seo.mjs';
import { genreOf } from './genres.mjs';

// The homepage grid is rendered by JS after a catalog fetch, so its first card
// image (the mobile LCP element) was only discovered ~1 s in. This finds the
// exact image a default-city (Denver) visitor's grid shows first, so index.html
// can preload it. Mirrors data.js fetchEvents/hasRealArt/eventArtCandidates
// (tests/entity-seo.test.mjs checks the art rules against data.js).
export const HOME_CITY = 'Denver';
const HOME_TZ = 'America/Denver';
const EVENT_SELECT = 'id,title,description,date,end_date,venue_id,venue_name,venue_address,city,state,image_url,ticket_url,' +
  'price_min,price_max,currency,is_festival,time_tbd,timezone,status,lifecycle_status,ticket_status,created_at,event_artists(artists(id,name,genres,image_url))';

function isTicketmasterCategoryArt(url) {
  const host = url.hostname.toLowerCase();
  const ticketmaster = host === 'ticketm.net' || host.endsWith('.ticketm.net') || host === 'ticketmaster.com' || host.endsWith('.ticketmaster.com');
  return ticketmaster && /\/dam\/c\//i.test(url.pathname);
}

export function isRealArtUrl(value) {
  if (!value) return false;
  let url;
  try { url = new URL(value); } catch { return false; }
  if (url.protocol !== 'https:' || url.username || url.password) return false;
  return !isTicketmasterCategoryArt(url);
}

function firstArt(event) {
  return [event.image_url, ...(event.event_artists || []).map((entry) => entry.artists?.image_url)].find(isRealArtUrl) || null;
}

// Local midnight in the home city, matching the browser's todayISO() there.
export function startOfDayIn(timeZone, now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map((p) => [p.type, p.value]));
  const wall = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  const offset = wall - Math.floor(now.getTime() / 1000) * 1000;
  return new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day) - offset).toISOString();
}

// Same ordering as index.html: first page of 24, cards with real artwork first.
export function homeLcpImage(rows) {
  const sorted = [...rows].sort((a, b) => (isRealArtUrl(b.image_url) ? 1 : 0) - (isRealArtUrl(a.image_url) ? 1 : 0));
  return sorted.length ? firstArt(sorted[0]) : null;
}

// Page 1 of the default city's grid, exactly as index.html requests it.
export async function fetchHomeSeed(now = new Date()) {
  const { rows, total } = await restWithCount('events', {
    select: EVENT_SELECT, status: 'eq.published', order: 'date.asc', limit: 24,
    date: 'gte.' + startOfDayIn(HOME_TZ, now), city: 'ilike.' + HOME_CITY,
  });
  // Cards never show descriptions; dropping them keeps the inline seed small.
  return { city: HOME_CITY, total, rows: rows.map(({ description, ...row }) => row) };
}

function scriptJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

// Inline seed for the grid (index.html uses it instead of its first fetch).
export function withHomeSeed(template, seed) {
  if (!seed) return template;
  return template.replace('<div class="grid-events" id="home-grid"', () =>
    '<script type="application/json" id="home-seed">' + scriptJson(seed) + '</script>\n        <div class="grid-events" id="home-grid"');
}

// ---- First cards in the HTML -------------------------------------------
// The LCP <img> only existed after scripts ran, so Lighthouse's simulated LCP
// waited on every render-blocking resource first. These strings mirror
// site.js Drop.ecard + data.js fmtDate/fmtPrice for the home city's time zone;
// tests/lcp-priority.spec.ts compares them with the real client output.
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtDate(iso, timeTbd, timeZone = HOME_TZ) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
    .formatToParts(d).map((x) => [x.type, x.value]));
  const dow = new Date(Date.UTC(+p.year, +p.month - 1, +p.day)).getUTCDay();
  const base = DOW[dow] + ', ' + MON[+p.month - 1] + ' ' + +p.day;
  if (timeTbd) return base + ' · Time TBA';
  const h = +p.hour, m = +p.minute;
  if (h === 0 && m === 0) return base;
  return base + ' · ' + (h % 12 || 12) + ':' + String(m).padStart(2, '0') + ' ' + (h >= 12 ? 'PM' : 'AM');
}

export function fmtPrice(min, max) {
  const n = (v) => '$' + Math.round(v);
  if (min == null && max == null) return 'See tickets';
  if (min != null && max != null && max > min) return n(min) + '–' + n(max);
  if (min != null) return 'From ' + n(min);
  return 'From ' + n(max);
}

function cardHtml(event, index) {
  const art = firstArt(event);
  const label = [event.title, fmtDate(event.date, event.time_tbd), event.venue_name ? 'at ' + event.venue_name : '', fmtPrice(event.price_min, event.price_max)].filter(Boolean).join(', ');
  return '<a class="wsc-card" data-ssr href="' + escapeHtml(eventPath(event)) + '" data-event-id="' + escapeHtml(event.id) + '" aria-label="' + escapeHtml(label) + '">' +
    '<img class="wsc__img" src="' + escapeHtml(art) + '" alt="" loading="eager"' + (index === 0 ? ' fetchpriority="high"' : '') + ' referrerpolicy="no-referrer">' +
    '<div class="wsc__scrim"></div><span class="genre-pill">' + escapeHtml(genreOf(event)) + '</span><span class="wsc__price">' + escapeHtml(fmtPrice(event.price_min, event.price_max)) + '</span>' +
    '<div class="wsc__text"><div class="wsc__date">' + escapeHtml(fmtDate(event.date, event.time_tbd)) + '</div><h3 class="wsc__title">' + escapeHtml(event.title) + '</h3>' +
    '<p class="wsc__venue">' + escapeHtml([event.venue_name, event.city].filter(Boolean).join(' · ')) + '</p></div></a>';
}

// Leading cards with real art, in the grid's order (art first, then date).
// ponytail: one card — Lighthouse (applied 4G throttling) LCP 3.58→2.62 s with
// one; four eager posters competed for bandwidth and regressed it to 4.43 s.
export function homeCardsHtml(rows, count = 1) {
  const sorted = [...rows].sort((a, b) => (isRealArtUrl(b.image_url) ? 1 : 0) - (isRealArtUrl(a.image_url) ? 1 : 0));
  const lead = [];
  for (const event of sorted) {
    if (lead.length === count || !isRealArtUrl(event.image_url)) break;
    lead.push(event);
  }
  return lead.map(cardHtml).join('');
}

export function withHomeCards(template, seed) {
  if (!seed) return template;
  const cards = homeCardsHtml(seed.rows);
  return template.replace('<div class="grid-events" id="home-grid" aria-label="Upcoming shows"></div>', () =>
    '<div class="grid-events" id="home-grid" aria-label="Upcoming shows">' + cards + '</div>');
}

// The meta is read by the static hint script in index.html's <head>.
export function withLcpHint(template, image) {
  if (!image) return template;
  const meta = '<meta name="drop-lcp" data-city="' + HOME_CITY + '" content="' +
    String(image).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]) + '" />\n  ';
  return template.replace('<script data-lcp-hint>', () => meta + '<script data-lcp-hint>');
}
