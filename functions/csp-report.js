// CSP violation sink for the Report-Only policy (_headers, SECURITY_HEADERS).
// Logs one line per violation with only the directive, the blocked origin and the
// page path — no IP, no full URLs, nothing stored — so a live tail of the Pages
// deployment shows what promoting the policy would break. Reports from
// app.trydropapp.com arrive cross-origin, hence the CORS preflight answer.
const MAX_BYTES = 64 * 1024;
const MAX_LINES = 20;
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'content-type' };

function origin(value) {
  if (!value) return '';
  if (/^(inline|eval|data|blob|self|wasm-eval|trusted-types-[a-z-]+)$/i.test(value)) return value;
  try { return new URL(value).origin; } catch { return String(value).slice(0, 40); }
}

function path(value) {
  try { return new URL(value).pathname.slice(0, 120); } catch { return ''; }
}

// Legacy report-uri ({"csp-report": {...}}) and Reporting API ([{type, body}]) shapes.
export function summarizeCspReports(payload) {
  const reports = Array.isArray(payload)
    ? payload.filter((r) => r && r.type === 'csp-violation').map((r) => r.body || {})
    : payload && payload['csp-report'] ? [payload['csp-report']] : [];
  return reports.slice(0, MAX_LINES).map((r) => ({
    directive: String(r.effectiveDirective || r['effective-directive'] || r['violated-directive'] || '').split(' ')[0].slice(0, 40),
    blocked: origin(r.blockedURL || r['blocked-uri']),
    page: path(r.documentURL || r['document-uri']),
  }));
}

export async function onRequest({ request }) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST, OPTIONS' } });
  if (Number(request.headers.get('content-length') || 0) > MAX_BYTES) return new Response(null, { status: 413, headers: CORS });
  try {
    const text = await request.text();
    if (text.length <= MAX_BYTES) {
      for (const line of summarizeCspReports(JSON.parse(text))) console.log('csp-violation', JSON.stringify(line));
    }
  } catch {
    // malformed report: drop it
  }
  return new Response(null, { status: 204, headers: CORS });
}
