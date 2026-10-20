// Web → app conversion counts from Cloudflare's own request analytics: the
// consented /e/<name>/<detail>/<surface> beacons (src/track.mjs) by path.
// Needs a token with Zone → Analytics → Read on trydropapp.com:
//   CLOUDFLARE_API_TOKEN=… node scripts/conversion-counts.mjs [days=7] [--md]
// (Drop machines: ~/.local/bin/cf-drop exports it from Keychain.)
// Adaptive analytics is sampled; treat counts as estimates.
import { pathToFileURL } from 'node:url';
import { SURFACES, validBeacon } from '../src/track.mjs';

export const ZONE = '5ac5024f45acd7d744470a025e650837';

export function query(days, now = new Date()) {
  const since = new Date(now.getTime() - days * 864e5).toISOString().replace(/\.\d+Z$/, 'Z');
  return `query{viewer{zones(filter:{zoneTag:"${ZONE}"}){httpRequestsAdaptiveGroups(limit:1000,orderBy:[count_DESC],filter:{datetime_geq:"${since}",clientRequestPath_like:"/e/%",clientRequestHTTPMethodName:"POST",edgeResponseStatus:204}){count dimensions{clientRequestPath}}}}}`;
}

// Public-site HTML page views from recognised browsers, for click rates. Most
// raw views are monitors/bots with no browser UA, so those are left out; bots
// that pass as browsers still count, so rates are a floor.
export function viewsQuery(days, now = new Date()) {
  const since = new Date(now.getTime() - days * 864e5).toISOString().replace(/\.\d+Z$/, 'Z');
  return `query{viewer{zones(filter:{zoneTag:"${ZONE}"}){httpRequestsAdaptiveGroups(limit:5000,orderBy:[count_DESC],filter:{datetime_geq:"${since}",clientRequestHTTPHost:"trydropapp.com",requestSource:"eyeball",userAgentBrowser_neq:"Unknown",clientRequestHTTPMethodName:"GET",edgeResponseStatus:200,edgeResponseContentTypeName:"html"}){count dimensions{clientRequestPath}}}}}`;
}

// Same mapping as surface() in site.js.
export function surfaceOf(path) {
  const first = (String(path).split('/')[1] || '').replace(/\.html$/, '');
  return first === '' || first === 'index' ? 'home' : SURFACES.includes(first) ? first : 'other';
}

export function views(rows) {
  const out = {};
  for (const { count, dimensions: { clientRequestPath: path } } of rows) out[surfaceOf(path)] = (out[surfaceOf(path)] || 0) + count;
  return out;
}

const pct = (n, d) => (d ? ((100 * n) / d).toFixed(2) + '%' : '–');

// Weekly markdown readout: per surface, views → ticket and app-store clicks.
export function readout(days, counts, pageViews, until = new Date()) {
  const t = counts.ticket_click?.bySurface || {}, a = counts.app_store_click?.bySurface || {};
  const surfaces = [...new Set([...Object.keys(pageViews), ...Object.keys(t), ...Object.keys(a)])].sort((x, y) => (pageViews[y] || 0) - (pageViews[x] || 0));
  const sum = (o) => Object.values(o).reduce((n, v) => n + v, 0);
  const row = (s, v, tc, ac) => `| ${s} | ${v} | ${tc} | ${pct(tc, v)} | ${ac} | ${pct(ac, v)} |`;
  const detail = (c) => Object.entries(c?.byDetail || {}).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${v}`).join(', ') || 'none';
  return [
    `# Web → app conversion readout`, '',
    `Last ${days} days to ${until.toISOString().slice(0, 10)}. Consented clicks only ("Accept all"), sampled Cloudflare analytics: estimates, and rates are floors because declined visitors still count as views.`, '',
    '| Surface | Page views | Ticket clicks | Ticket rate | App-store clicks | App rate |', '|---|---|---|---|---|---|',
    ...surfaces.map((s) => row(s, pageViews[s] || 0, t[s] || 0, a[s] || 0)),
    row('**all**', sum(pageViews), sum(t), sum(a)), '',
    `Ticket clicks by seller: ${detail(counts.ticket_click)}.`,
    `App-store clicks by store: ${detail(counts.app_store_click)}.`, '',
  ].join('\n');
}

// Roll path counts up into name → detail and name → surface tables.
export function summarize(rows) {
  const out = {};
  for (const { count, dimensions: { clientRequestPath: path } } of rows) {
    if (!validBeacon(path)) continue;
    const [, , name, detail, surface] = path.split('/');
    out[name] ||= { total: 0, byDetail: {}, bySurface: {} };
    out[name].total += count;
    out[name].byDetail[detail] = (out[name].byDetail[detail] || 0) + count;
    out[name].bySurface[surface] = (out[name].bySurface[surface] || 0) + count;
  }
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const md = process.argv.includes('--md');
  const days = Number(process.argv.slice(2).find((a) => !a.startsWith('--')) || 7);
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) throw new Error('CLOUDFLARE_API_TOKEN is required (Zone Analytics: Read on trydropapp.com)');
  const gql = async (q) => {
    const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }),
    });
    const json = await res.json();
    if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join('; '));
    return json.data.viewer.zones[0].httpRequestsAdaptiveGroups;
  };
  const [clicks, pages] = await Promise.all([gql(query(days)), gql(viewsQuery(days))]);
  const counts = summarize(clicks), pageViews = views(pages);
  console.log(md ? readout(days, counts, pageViews) : JSON.stringify({ days, counts, pageViews }, null, 2));
}
