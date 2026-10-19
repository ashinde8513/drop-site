// "Know before you go" for venue pages, from data only. Same rule as the
// native Venue Intel card (DropApp/src/data/venueIntel.ts): a fact shows only
// when admin-approved, status 'fact' and verified within 90 days; stale facts
// are withheld; everything else is "Unknown". Age labels come from this
// venue's upcoming listings (they vary by show), never from a guess.
import { escapeHtml, rest } from './entity-seo.mjs';

export const MAX_AGE_DAYS = 90;
export const CATEGORIES = [
  ['bag_policy', 'Bag policy'], ['water', 'Water & refill'], ['arrival', 'Parking, transit & rideshare'],
  ['lockers', 'Lockers'], ['reentry', 'Re-entry'], ['accessibility', 'Accessibility'],
];
const SOURCE_KINDS = new Set(['official_venue', 'official_accessibility', 'official_transit', 'official_parking', 'official_rideshare', 'ticketing_partner']);

function httpsUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; }
}
const text = (value, max) => (typeof value === 'string' && value.trim() && value.trim().length <= max ? value.trim() : null);

export function normalizeIntel(rows, venueId, now = new Date()) {
  const venueRows = (Array.isArray(rows) ? rows : []).filter((row) => row && row.venue_id === venueId && !row.access_key);
  return CATEGORIES.map(([category, label]) => {
    const matching = venueRows.filter((row) => row.category === category);
    const row = matching.length === 1 ? matching[0] : null;
    const approved = row && Number.isFinite(Date.parse(row.approved_at)) && Date.parse(row.approved_at) <= now.getTime();
    const verified = row ? Date.parse(row.last_verified_at) : NaN;
    const fresh = Number.isFinite(verified) && verified <= now.getTime() && now.getTime() - verified <= MAX_AGE_DAYS * 864e5;
    const valid = approved && (row.status === 'fact' || row.status === 'unknown') && SOURCE_KINDS.has(row.source_kind);
    const source = valid ? { label: text(row.source_label, 120), url: httpsUrl(row.source_url) } : null;
    if (valid && row.status === 'fact' && fresh && text(row.summary, 600)) {
      return { category, label, status: 'fact', summary: text(row.summary, 600), source, verifiedAt: row.last_verified_at.slice(0, 10) };
    }
    return { category, label, status: valid && row.status === 'fact' ? 'stale' : 'unknown', summary: null, source };
  });
}

export async function getVenueIntel(venueId) {
  try {
    return await rest('venue_intel', {
      select: 'venue_id,category,access_key,status,summary,source_kind,source_label,source_url,last_verified_at,approved_at',
      venue_id: 'eq.' + venueId, order: 'category.asc',
    });
  } catch { return []; }
}

// "21+ (6 shows), 18+ (2 shows)" from the venue's upcoming listings.
export function ageLabels(events) {
  const tally = new Map();
  for (const event of events || []) {
    const raw = text(event.age_restriction, 40);
    if (!raw) continue;
    const label = /^all ages$/i.test(raw) ? 'All ages' : raw;
    tally.set(label, (tally.get(label) || 0) + 1);
  }
  return [...tally].sort((a, b) => b[1] - a[1]);
}

// Known rows first; Unknown / stale rows sit behind a native disclosure (same
// shape as the native VenueIntelSection "show unknown" toggle). venue.html
// keeps this server-rendered node when it draws the page ([data-kbyg]).
export function knowBeforeYouGo(items, events) {
  const row = (label, value, source) => '<li><strong>' + escapeHtml(label) + ':</strong> ' + value +
    (source?.url && source?.label ? ' <a class="kbyg-src" href="' + escapeHtml(source.url) + '" rel="noopener" target="_blank">' + escapeHtml(source.label) + ' ↗</a>' : '') + '</li>';
  const ages = ageLabels(events);
  const listed = (events || []).filter((event) => text(event.age_restriction, 40)).length;
  const known = [], unknown = [];
  if (ages.length) known.push(row('Age policy', escapeHtml(ages.map(([label, n]) => label + ' (' + n + ' show' + (n === 1 ? '' : 's') + ')').join(', ')) + ' <small>From ' + listed + ' of ' + (events || []).length + ' upcoming listings; ages are set per show.</small>'));
  else unknown.push(row('Age policy', 'Unknown — set per show; check each listing.'));
  unknown.push(row('Capacity', 'Unknown'));
  for (const item of items) {
    if (item.status === 'fact') known.push(row(item.label, escapeHtml(item.summary) + ' <small>Verified ' + escapeHtml(item.verifiedAt) + '.</small>', item.source));
    else unknown.push(row(item.label, item.status === 'stale' ? 'Needs rechecking — previous guidance is withheld.' : 'Unknown', item.source));
  }
  return '<section class="ven-section kbyg" data-kbyg aria-labelledby="kbyg-h"><h2 class="sec-h2" id="kbyg-h">Know before you go</h2>' +
    '<p class="kbyg-intro">Reviewed venue information. Policies can change for individual shows; confirm with the official source.</p>' +
    (known.length ? '<ul class="kbyg-list">' + known.join('') + '</ul>' : '') +
    '<details class="kbyg-unknown"' + (known.length ? '' : ' open') + '><summary>Not verified yet (' + unknown.length + ')</summary><ul class="kbyg-list">' + unknown.join('') + '</ul></details></section>';
}
