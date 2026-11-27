import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = {};
vm.runInNewContext(readFileSync('app/public-redirect.js', 'utf8'), ctx);
const target = (host, path, search = '', hash = '') => ctx.publicPathTarget(host, path, search, hash);

test('public paths on the app host go to the apex, the rest stays in the app', () => {
  assert.equal(target('app.trydropapp.com', '/legal/privacy'), 'https://trydropapp.com/legal/privacy');
  assert.equal(target('app.trydropapp.com', '/event/abc', '?ref=x', '#h'), 'https://trydropapp.com/event/abc?ref=x#h');
  assert.equal(target('app.trydropapp.com', '/artist/a'), 'https://trydropapp.com/artist/a');
  assert.equal(target('app.trydropapp.com', '/privacy'), 'https://trydropapp.com/privacy');
  assert.equal(target('app.trydropapp.com', '/'), null);
  assert.equal(target('app.trydropapp.com', '/tiktok/callback'), null);
  assert.equal(target('app.trydropapp.com', '/eventual'), null);
  assert.equal(target('trydropapp.com', '/event/abc'), null);
});

test('the app shell loads the redirect before its own scripts', () => {
  const html = readFileSync('app/index.html', 'utf8');
  assert.ok(html.indexOf('https://trydropapp.com/app/public-redirect.js') > 0);
  assert.ok(html.indexOf('public-redirect.js') < html.indexOf('/vendor/supabase.js'));
});
