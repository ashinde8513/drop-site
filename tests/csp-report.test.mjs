import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { onRequest, summarizeCspReports } from '../functions/csp-report.js';
import { SECURITY_HEADERS } from '../src/entity-seo.mjs';

const post = (body, headers = {}) => onRequest({ request: new Request('https://trydropapp.com/csp-report', { method: 'POST', body, headers }) });

test('CSP reports are reduced to directive, blocked origin and page path', () => {
  assert.deepEqual(summarizeCspReports({ 'csp-report': { 'violated-directive': 'script-src-elem', 'blocked-uri': 'https://evil.example/x.js?token=1', 'document-uri': 'https://trydropapp.com/event/abc?ref=1' } }),
    [{ directive: 'script-src-elem', blocked: 'https://evil.example', page: '/event/abc' }]);
  assert.deepEqual(summarizeCspReports([{ type: 'csp-violation', body: { effectiveDirective: 'connect-src', blockedURL: 'https://o1.ingest.us.sentry.io/api/1/envelope/', documentURL: 'https://app.trydropapp.com/' } }, { type: 'deprecation', body: {} }]),
    [{ directive: 'connect-src', blocked: 'https://o1.ingest.us.sentry.io', page: '/' }]);
  assert.deepEqual(summarizeCspReports([{ type: 'csp-violation', body: { effectiveDirective: 'script-src', blockedURL: 'inline' } }]), [{ directive: 'script-src', blocked: 'inline', page: '' }]);
  assert.deepEqual(summarizeCspReports('nonsense'), []);
});

test('the sink answers CORS preflight and POST, stores nothing, and rejects other methods', async () => {
  const pre = await onRequest({ request: new Request('https://trydropapp.com/csp-report', { method: 'OPTIONS' }) });
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get('access-control-allow-methods'), 'POST');
  assert.equal((await post('{"csp-report":{}}', { 'content-type': 'application/csp-report' })).status, 204);
  assert.equal((await post('not json')).status, 204);
  assert.equal((await post('x', { 'content-length': String(1 << 20) })).status, 413);
  assert.equal((await onRequest({ request: new Request('https://trydropapp.com/csp-report') })).status, 405);
});

test('HSTS and the Report-Only policy cover what the site and web app load, and report', () => {
  assert.equal(SECURITY_HEADERS['Strict-Transport-Security'], 'max-age=31536000; includeSubDomains');
  const ro = SECURITY_HEADERS['Content-Security-Policy-Report-Only'];
  for (const need of ["script-src 'self' 'unsafe-inline' https://trydropapp.com", 'https://tiles.openfreemap.org', 'https://*.ingest.us.sentry.io', "worker-src 'self' blob:", 'report-uri https://trydropapp.com/csp-report', 'report-to csp']) assert.ok(ro.includes(need), need);
  assert.equal(SECURITY_HEADERS['Reporting-Endpoints'], 'csp="https://trydropapp.com/csp-report"');
  assert.doesNotMatch(SECURITY_HEADERS['Content-Security-Policy'], /script-src/, 'still report-only; enforcing is a later step');
  assert.ok(JSON.parse(readFileSync(new URL('../_routes.json', import.meta.url), 'utf8')).include.includes('/csp-report'));
});
