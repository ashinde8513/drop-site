import { rest } from './entity-seo.mjs';

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

export async function fetchHomeLcpImage(now = new Date()) {
  const rows = await rest('events', {
    select: EVENT_SELECT, status: 'eq.published', order: 'date.asc', limit: 24,
    date: 'gte.' + startOfDayIn(HOME_TZ, now), city: 'ilike.' + HOME_CITY,
  });
  return homeLcpImage(rows);
}

// The meta is read by the static hint script in index.html's <head>.
export function withLcpHint(template, image) {
  if (!image) return template;
  const meta = '<meta name="drop-lcp" data-city="' + HOME_CITY + '" content="' +
    String(image).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]) + '" />\n  ';
  return template.replace('<script data-lcp-hint>', meta + '<script data-lcp-hint>');
}
