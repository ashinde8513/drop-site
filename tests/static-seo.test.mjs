import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('signed-in app shell is never indexed', () => {
  assert.match(read('app/index.html'), /<meta name="robots" content="noindex, nofollow">/);
  assert.match(read('_headers'), /\/app\/\*\n  X-Robots-Tag: noindex, nofollow/);
});

test('sitemap lists no page that declares noindex', () => {
  const locs = [...read('sitemap.xml').matchAll(/<loc>https:\/\/trydropapp\.com\/([^<?]*)/g)].map((m) => m[1]);
  for (const path of locs) {
    const file = (path || 'index') + '.html';
    if (!existsSync(new URL('../' + file, import.meta.url))) continue;
    const robots = read(file).match(/<meta\b[^>]*name="robots"[^>]*>/i)?.[0] || '';
    assert.doesNotMatch(robots, /noindex/i, file);
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

test('OKF bundle files carry frontmatter and only link to files that exist', async () => {
  const { readdirSync } = await import('node:fs');
  const files = readdirSync(new URL('../okf/', import.meta.url)).filter((f) => f.endsWith('.md'));
  assert.ok(files.includes('index.md'));
  for (const file of files) {
    const text = read('okf/' + file);
    const front = text.match(/^---\n([\s\S]*?)\n---\n/);
    assert.ok(front, file + ' frontmatter');
    assert.match(front[1], /^type: \S+/m, file + ' type');
    assert.match(front[1], /^resource: https:\/\/trydropapp\.com\//m, file + ' resource');
    for (const [, target] of text.matchAll(/\]\(([^)#]+\.md)\)/g)) assert.ok(files.includes(target), `${file} → ${target}`);
  }
  assert.match(read('scripts/build-dist.sh'), /cp -R [^\n]*\bokf\b[^\n]* dist\//);
  assert.match(read('llms.txt'), /trydropapp\.com\/okf\/index\.md/);
  const { CITIES } = await import('../src/acquisition-seo.mjs');
  const listed = [...read('okf/city-guides.md').matchAll(/^- \[([^\]]+)\]\(https:\/\/trydropapp\.com\/city\?city=/gm)].map((m) => m[1]);
  assert.deepEqual(listed, CITIES, 'OKF city guides must list exactly CITIES');
});

test('every page opts out of Cloudflare email obfuscation (its /cdn-cgi link 404s for crawlers)', async () => {
  const { readdirSync } = await import('node:fs');
  const pages = readdirSync(new URL('../', import.meta.url)).filter((f) => f.endsWith('.html') && !f.startsWith('google'))
    .concat(['app/index.html'], readdirSync(new URL('../guides/', import.meta.url)).filter((f) => f.endsWith('.html')).map((f) => 'guides/' + f));
  for (const page of pages) {
    const html = readFileSync(new URL('../' + page, import.meta.url), 'utf8');
    assert.match(html, /<body[^>]*>\n<!--email_off-->/, page);
    assert.match(html, /<!--\/email_off-->\n<\/body>/, page);
  }
});
