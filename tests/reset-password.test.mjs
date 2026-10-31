import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { onRequest } from '../functions/reset-password.js';

const go = (url, method = 'GET') => onRequest({ request: new Request(url, { method }) });

test('reset link keeps the full query string and adds mode=reset-password', async () => {
  const r = await go('https://trydropapp.com/reset-password?code=abc%2B123&token_hash=x%26y&type=recovery');
  assert.equal(r.status, 302);
  const to = new URL(r.headers.get('location'));
  assert.equal(to.origin, 'https://app.trydropapp.com');
  assert.equal(to.searchParams.get('mode'), 'reset-password');
  assert.equal(to.searchParams.get('code'), 'abc+123');
  assert.equal(to.searchParams.get('token_hash'), 'x&y');
  assert.equal(to.searchParams.get('type'), 'recovery');
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.equal(r.headers.get('referrer-policy'), 'no-referrer');
});

test('a bare reset URL still lands on the reset screen; a spoofed mode cannot override it', async () => {
  assert.equal((await go('https://trydropapp.com/reset-password')).headers.get('location'), 'https://app.trydropapp.com/?mode=reset-password');
  const to = new URL((await go('https://trydropapp.com/reset-password?mode=login&code=c')).headers.get('location'));
  assert.deepEqual([...to.searchParams], [['mode', 'reset-password'], ['code', 'c']]);
  assert.equal((await go('https://trydropapp.com/reset-password', 'POST')).status, 405);
});

test('the route is a Function, not a query-dropping _redirects rule', () => {
  assert.ok(JSON.parse(readFileSync(new URL('../_routes.json', import.meta.url), 'utf8')).include.includes('/reset-password'));
  assert.doesNotMatch(readFileSync(new URL('../_redirects', import.meta.url), 'utf8'), /^\/reset-password\s/m);
});
