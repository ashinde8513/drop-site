import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('signed-in app shell is never indexed', () => {
  assert.match(read('app/index.html'), /<meta name="robots" content="noindex, nofollow">/);
});

test('sitemap lists no page that declares noindex', () => {
  const locs = [...read('sitemap.xml').matchAll(/<loc>https:\/\/trydropapp\.com\/([^<?]*)/g)].map((m) => m[1]);
  for (const path of locs) {
    const file = (path || 'index') + '.html';
    if (!existsSync(new URL('../' + file, import.meta.url))) continue;
    assert.doesNotMatch(read(file), /<meta name="robots" content="noindex/i, file);
  }
});

test('download FAQ schema mirrors the visible FAQ', () => {
  const html = read('download.html');
  const visible = [...html.matchAll(/<summary>([^<]+)<\/summary>\s*<p>([^<]+)<\/p>/g)].map((m) => [m[1], m[2]]);
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((m) => JSON.parse(m[1])).find((doc) => doc['@type'] === 'FAQPage');
  assert.ok(visible.length > 0);
  assert.deepEqual(ld.mainEntity.map((q) => [q.name, q.acceptedAnswer.text]), visible);
});

test('crawler guide states what Drop is not and where entity pages live', () => {
  const guide = read('llms.txt');
  assert.match(guide, /not a ticket seller/);
  assert.match(guide, /sitemap-entities\.xml/);
  assert.doesNotMatch(guide, /trydropapp\.com\/link\)/);
});
