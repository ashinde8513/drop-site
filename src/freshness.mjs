// Catalog freshness for the server-rendered city / weekend / genre pages.
// Those pages rebuild on every request (10-minute edge cache), so the only
// thing that can go stale is the catalog the sync jobs feed. /freshness.json
// reports it and answers 503 when stale, so any uptime monitor can alert.
import { rest, restWithCount } from './entity-seo.mjs';
import { CITIES } from './acquisition-seo.mjs';

// Sync adds shows daily; three quiet days or a thin week means it stopped.
export const LIMITS = { maxHoursSinceNewest: 72, minNext7Days: 100, minHomeMarketNext7Days: 5 };

export async function readCatalog(now = new Date()) {
  const start = new Date(now); start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 7 * 864e5);
  const [newest, week] = await Promise.all([
    rest('events', { select: 'created_at', status: 'eq.published', order: 'created_at.desc', limit: 1 }),
    restWithCount('events', { select: 'city', status: 'eq.published', date: 'gte.' + start.toISOString(), and: '(date.lt.' + end.toISOString() + ')', limit: 1000 }),
  ]);
  return { newestCreatedAt: newest[0]?.created_at || null, next7Days: week.count ?? week.rows.length, cities: week.rows.map((row) => row.city) };
}

export function assess(catalog, now = new Date()) {
  const hours = catalog.newestCreatedAt ? (now - new Date(catalog.newestCreatedAt)) / 36e5 : Infinity;
  const markets = Object.fromEntries(CITIES.map((city) => [city, catalog.cities.filter((c) => String(c || '').trim().toLowerCase() === city.toLowerCase()).length]));
  const problems = [];
  if (!(hours <= LIMITS.maxHoursSinceNewest)) problems.push(`no new shows for ${Number.isFinite(hours) ? Math.round(hours) + ' h' : 'ever'} (limit ${LIMITS.maxHoursSinceNewest} h)`);
  if (catalog.next7Days < LIMITS.minNext7Days) problems.push(`only ${catalog.next7Days} shows in the next 7 days (limit ${LIMITS.minNext7Days})`);
  if (markets.Denver < LIMITS.minHomeMarketNext7Days) problems.push(`only ${markets.Denver} Denver shows in the next 7 days (limit ${LIMITS.minHomeMarketNext7Days})`);
  return {
    status: problems.length ? 'stale' : 'ok', checkedAt: now.toISOString(), problems,
    newestShowAddedAt: catalog.newestCreatedAt, hoursSinceNewestShow: Number.isFinite(hours) ? Math.round(hours) : null,
    showsNext7Days: catalog.next7Days, marketShowsNext7Days: markets, limits: LIMITS,
    pages: 'City, genre and weekend pages render from the live catalog on every request (10-minute edge cache).',
  };
}
