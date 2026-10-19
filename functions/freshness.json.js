import { assess, readCatalog } from '../src/freshness.mjs';

export async function onRequest({ request }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
  let report;
  try { report = assess(await readCatalog()); }
  catch { report = { status: 'stale', checkedAt: new Date().toISOString(), problems: ['catalog unreachable'] }; }
  return new Response(JSON.stringify(report, null, 2), {
    status: report.status === 'ok' ? 200 : 503,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=60, s-maxage=300', 'X-Robots-Tag': 'noindex', 'X-Content-Type-Options': 'nosniff' },
  });
}
