// "Drop picks" newsletter archive. Drafts (newsletter/src/*.md, copied from
// drop-launch-kit) render to newsletter/drafts/ for review and are NEVER
// deployed. An issue goes live only when its slug is in newsletter/published.json,
// which changes only on Arya's explicit approval (APPROVALS.md W17).
// Run: node scripts/build-newsletter.mjs — tests/newsletter.test.mjs fails if stale.
import { readdirSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { page, renderMarkdown } from './build-guides.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const SITE = 'https://trydropapp.com';
const STORES = '[Get Drop on iPhone](https://apps.apple.com/us/app/drop-edm-events/id6790662825?pt=129160185&ct=newsletter&mt=8) · [Get Drop on Android](https://play.google.com/store/apps/details?id=app.resonanceventures.drop)';
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Email-only and internal lines (sourcing notes, subject, preheader, footer
// placeholders) never reach the web page.
export function parseIssue(md, slug) {
  const lines = md.split('\n');
  const title = (lines[0].match(/^#\s+(.+?)\s*\(DRAFT[^)]*\)\s*$/) || lines[0].match(/^#\s+(.+)$/) || [])[1];
  if (!title) throw new Error(slug + ': missing title');
  const preheader = (md.match(/^\*\*Preheader:\*\*\s*`([^`]+)`/m) || [])[1] || '';
  const start = lines.findIndex((line) => line.startsWith('**Preheader:**'));
  const end = lines.findIndex((line) => line.startsWith('[Get Drop on iPhone]'));
  if (start < 0 || end < 0) throw new Error(slug + ': missing preheader or store line');
  // Email picks are a bold header line then a blurb line: keep them as two paragraphs.
  const body = lines.slice(start + 1, end).join('\n').trim().replace(/^(\*\*[^\n]+)\n(?=\S)/gm, (_m, head) => head + '\n\n');
  if (/\{\{|DRAFT|not sourced|Re-pull/i.test(body)) throw new Error(slug + ': internal note left in body');
  const date = (slug.match(/(\d{4}-\d{2}-\d{2})$/) || [])[1];
  return { slug, title, preheader, date, body: body + '\n\n' + STORES + '\n' };
}

export function buildNewsletter(published = JSON.parse(read('newsletter/published.json'))) {
  const template = read('privacy.html');
  const issues = readdirSync(new URL('newsletter/src/', root)).filter((f) => f.endsWith('.md')).sort()
    .map((file) => parseIssue(read('newsletter/src/' + file), file.slice(0, -3)));
  for (const slug of published) if (!issues.some((issue) => issue.slug === slug)) throw new Error('published.json names unknown issue ' + slug);
  const render = (issue, live) => {
    const canonical = SITE + '/newsletter/' + issue.slug;
    const banner = live ? '' : '<p class="meta"><strong>Draft, not published.</strong> Not sent and not live until Arya approves it.</p>';
    let html = page(template, {
      title: issue.title + ' | Drop', description: issue.preheader, canonical, h1: issue.title, navLinks: '',
      content: banner + renderMarkdown(issue.body).html,
      ld: { '@context': 'https://schema.org', '@type': 'Article', headline: issue.title, description: issue.preheader, url: canonical, datePublished: issue.date, author: { '@type': 'Organization', name: 'Drop', url: SITE + '/' } },
      lastVerified: '',
    });
    html = html.replace(/<a class="(legal-doc-link|back)" href="\/guides">[^<]*<\/a>/g, (_m, cls) => '<a class="' + cls + '" href="/newsletter/">' + (cls === 'back' ? '← All issues' : 'All issues') + '</a>');
    return live ? html : html.replace('</head>', () => '  <meta name="robots" content="noindex, nofollow" />\n</head>');
  };
  const drafts = issues.map((issue) => ({ slug: issue.slug, html: render(issue, false) }));
  const live = issues.filter((issue) => published.includes(issue.slug));
  const pages = live.map((issue) => ({ slug: issue.slug, html: render(issue, true) }));
  // No index page until there is something approved to list.
  const index = live.length ? page(template, {
    title: 'Drop picks: the newsletter archive | Drop', description: 'Past issues of Drop picks, the weekly list of shows worth leaving the house for.',
    canonical: SITE + '/newsletter/', h1: 'Drop picks', navLinks: '', lastVerified: '', ogType: 'website',
    content: '<ul class="guide-list">\n          ' + live.slice().reverse().map((issue) => `<li><a href="/newsletter/${issue.slug}"><strong>${esc(issue.title)}</strong></a><br>${esc(issue.preheader)}</li>`).join('\n          ') + '\n        </ul>',
    ld: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Drop picks', url: SITE + '/newsletter/' },
  }) : null;
  return { drafts, pages, index };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { mkdirSync, rmSync, writeFileSync } = await import('node:fs');
  const { drafts, pages, index } = buildNewsletter();
  for (const dir of ['newsletter/drafts/', 'newsletter/live/']) { rmSync(new URL(dir, root), { recursive: true, force: true }); mkdirSync(new URL(dir, root), { recursive: true }); }
  for (const { slug, html } of drafts) writeFileSync(new URL('newsletter/drafts/' + slug + '.html', root), html);
  for (const { slug, html } of pages) writeFileSync(new URL('newsletter/live/' + slug + '.html', root), html);
  if (index) writeFileSync(new URL('newsletter/live/index.html', root), index);
  console.log('built', drafts.length, 'drafts,', pages.length, 'published');
}
