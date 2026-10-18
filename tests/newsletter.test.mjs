import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { buildNewsletter, parseIssue } from '../scripts/build-newsletter.mjs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('drafts are rendered, committed and never published without approval', () => {
  const { drafts, pages, index } = buildNewsletter();
  assert.deepEqual(JSON.parse(read('newsletter/published.json')), [], 'publishing needs Arya (APPROVALS W17)');
  assert.equal(pages.length, 0);
  assert.equal(index, null);
  assert.ok(drafts.length >= 4);
  for (const { slug, html } of drafts) {
    assert.equal(read('newsletter/drafts/' + slug + '.html'), html, slug + ' is stale: run node scripts/build-newsletter.mjs');
    assert.match(html, /<meta name="robots" content="noindex, nofollow" \/>/);
    assert.match(html, /Draft, not published\./);
    assert.doesNotMatch(html, /\{\{|not sourced|Re-pull|\*\*Subject|Preheader:/, slug + ' internal or email-only text');
    assert.match(html, /apps\.apple\.com\/us\/app\/drop-edm-events\/id6790662825/);
  }
  assert.ok(!existsSync(new URL('../newsletter/live/', import.meta.url)) || readdirSync(new URL('../newsletter/live/', import.meta.url)).length === 0);
  const dist = read('scripts/build-dist.sh');
  assert.doesNotMatch(dist, /cp -R [^\n]*\bnewsletter\b/, 'drafts and sources must not be copied wholesale');
  assert.match(dist, /cp newsletter\/live\/\*\.html dist\/newsletter\//);
});

test('an approved issue publishes without the draft marks, and gets an archive index', () => {
  const [first] = buildNewsletter().drafts;
  const { pages, index } = buildNewsletter([first.slug]);
  assert.equal(pages.length, 1);
  assert.doesNotMatch(pages[0].html, /noindex|Draft, not published/);
  assert.match(pages[0].html, new RegExp(`<link rel="canonical" href="https://trydropapp.com/newsletter/${first.slug}"`));
  assert.match(index, new RegExp(`href="/newsletter/${first.slug}"`));
  assert.match(index, /<link rel="canonical" href="https:\/\/trydropapp\.com\/newsletter\/"/);
  assert.throws(() => buildNewsletter(['issue-99-2099-01-01']), /unknown issue/);
});

test('issue parsing drops email-only lines and refuses leftover notes', () => {
  const md = '# Drop picks · Issue 9 · Thu Jan 1 (DRAFT, not sent)\nWindow: x. Source: y.\n**Subject:** `S`\n**Preheader:** `P`\n\nHey.\n\n**Act** · Room · Fri\nBlurb.\n\n[Get Drop on iPhone] · [Get Drop on Android]\n{{postal_address}}\n';
  const issue = parseIssue(md, 'issue-09-2099-01-01');
  assert.equal(issue.title, 'Drop picks · Issue 9 · Thu Jan 1');
  assert.equal(issue.preheader, 'P');
  assert.equal(issue.date, '2099-01-01');
  assert.match(issue.body, /\*\*Act\*\* · Room · Fri\n\nBlurb\./);
  assert.doesNotMatch(issue.body, /Window|Subject|postal/);
  assert.throws(() => parseIssue(md.replace('Hey.', 'Hey {{first_name}}.'), 'x'), /internal note/);
});
