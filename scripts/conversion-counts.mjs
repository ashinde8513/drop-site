// Web → app conversion counts from Cloudflare's own request analytics: the
// consented /e/<name>/<detail>/<surface> beacons (src/track.mjs) by path.
// Needs a token with Zone → Analytics → Read on trydropapp.com:
//   CLOUDFLARE_API_TOKEN=… node scripts/conversion-counts.mjs [days=7]
// (Drop machines: ~/.local/bin/cf-drop exports it from Keychain.)
// Adaptive analytics is sampled; treat counts as estimates.
import { pathToFileURL } from 'node:url';
import { validBeacon } from '../src/track.mjs';

export const ZONE = '5ac5024f45acd7d744470a025e650837';

export function query(days, now = new Date()) {
  const since = new Date(now.getTime() - days * 864e5).toISOString().replace(/\.\d+Z$/, 'Z');
  return `query{viewer{zones(filter:{zoneTag:"${ZONE}"}){httpRequestsAdaptiveGroups(limit:1000,orderBy:[count_DESC],filter:{datetime_geq:"${since}",clientRequestPath_like:"/e/%",clientRequestHTTPMethodName:"POST",edgeResponseStatus:204}){count dimensions{clientRequestPath}}}}}`;
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
  const days = Number(process.argv[2] || 7);
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) throw new Error('CLOUDFLARE_API_TOKEN is required (Zone Analytics: Read on trydropapp.com)');
  const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: query(days) }),
  });
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join('; '));
  console.log(JSON.stringify({ days, counts: summarize(json.data.viewer.zones[0].httpRequestsAdaptiveGroups) }, null, 2));
}
