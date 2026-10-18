import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { buildGuides, faqFrom, parseGuide, renderMarkdown } from '../scripts/build-guides.mjs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const slugs = readdirSync(new URL('../guides/src/', import.meta.url)).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3));

test('committed guide pages, index, sitemap and llms.txt are up to date', () => {
  const { guides, index, sitemap, llms } = buildGuides();
  for (const { meta, html } of guides) assert.equal(read('guides/' + meta.slug + '.html'), html, meta.slug + ' is stale: run node scripts/build-guides.mjs');
  assert.equal(read('guides.html'), index);
  assert.equal(read('sitemap.xml'), sitemap);
  assert.equal(read('llms.txt'), llms);
});

test('every guide: canonical, Article schema, resolvable citations, verified date', () => {
  assert.ok(slugs.length >= 10);
  for (const slug of slugs) {
    const html = read('guides/' + slug + '.html');
    assert.match(html, new RegExp(`<link rel="canonical" href="https://trydropapp.com/guides/${slug}"`), slug);
    const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1])).flat();
    assert.ok(ld.some((d) => d['@type'] === 'Article' && d.url.endsWith('/guides/' + slug)), slug + ' Article');
    for (const [, n] of html.matchAll(/href="#source-(\d+)"/g)) assert.match(html, new RegExp(`<li id="source-${n}">`), `${slug} source ${n}`);
    assert.match(html, /Facts checked against the sources below on <time datetime="\d{4}-\d{2}-\d{2}">/);
    assert.doesNotMatch(html, /every weekend/i, slug + ' unverifiable brand claim');
    assert.doesNotMatch(html, /keep only if|re-verified|otherwise cut/i, slug + ' leftover fact-check note');
    assert.ok(read('sitemap.xml').includes(`<loc>https://trydropapp.com/guides/${slug}</loc>`));
    assert.ok(read('llms.txt').includes(`https://trydropapp.com/guides/${slug}`));
  }
  assert.match(read('scripts/build-dist.sh'), /cp -R [^\n]*\bguides\b[^\n]* dist\//);
  assert.match(read('scripts/build-dist.sh'), /rm -rf dist\/guides\/src/);
});

test('FAQ schema answers are the visible paragraph under each question heading', () => {
  for (const slug of slugs) {
    const { meta, body } = parseGuide(read('guides/src/' + slug + '.md'));
    if (meta.schema_type !== 'FAQPage') continue;
    const html = read('guides/' + slug + '.html');
    const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1])).flat().find((d) => d['@type'] === 'FAQPage');
    assert.ok(ld, slug + ' FAQPage');
    // Strip JSON-LD first, or the schema text would "see" itself.
    const visible = html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').replace(/\s+([.,;:])/g, '$1');
    for (const q of ld.mainEntity) {
      assert.ok(visible.includes(q.name), `${slug}: question visible: ${q.name}`);
      assert.ok(visible.includes(q.acceptedAnswer.text), `${slug}: answer visible: ${q.acceptedAnswer.text.slice(0, 80)}`);
      assert.doesNotMatch(q.acceptedAnswer.text, /^([-*]|\d+\.)\s/, `${slug}: answer is a list item`);
    }
    // Every question heading answered by a paragraph is in the schema.
    const paraQs = [...body.matchAll(/^##\s+(.+\?)\s*\n+(?!\s*([-*]|\d+\.)\s|[#>|])/gm)].length;
    assert.equal(ld.mainEntity.length, paraQs);
  }
});

test('markdown renderer escapes HTML and links citations, tables and quotes', () => {
  const { html } = renderMarkdown('# T\n\n> **Quick** answer <b>x</b>\n\n## Q?\n\nA [1] see https://x.test/a.\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n## Sources\n\n1. Src https://x.test/s.\n');
  assert.doesNotMatch(html, /<b>x<\/b>/);
  assert.match(html, /<blockquote><p><strong>Quick<\/strong> answer &lt;b&gt;x&lt;\/b&gt;<\/p><\/blockquote>/);
  assert.match(html, /<sup><a href="#source-1"/);
  assert.match(html, /<a href="https:\/\/x\.test\/a" rel="noopener">https:\/\/x\.test\/a<\/a>\./);
  assert.match(html, /<th scope="col">a<\/th>/);
  assert.match(html, /<li id="source-1">/);
  const split = renderMarkdown('## Sources\n\n1. A\n\n2. B\n').html;
  assert.match(split, /<li id="source-2">B/, 'numbering survives a blank line inside the list');
  assert.doesNotMatch(renderMarkdown('[x](//evil.test/a)').html, /href="\/\/evil/);
  assert.deepEqual(faqFrom('## What to pack?\n\n- Earplugs\n- Water\n'), []);
});
