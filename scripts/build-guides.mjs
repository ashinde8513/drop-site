// Fact-checked evergreen guides: guides/src/<slug>.md → guides/<slug>.html
// (+ guides/index.html), in the existing legal/doc layout. Output is committed;
// tests/guides.test.mjs fails if it is stale. Run: node scripts/build-guides.mjs
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const SITE = 'https://trydropapp.com';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const scriptJson = (v) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const slugId = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function parseGuide(md) {
  const fm = md.match(/^---\n([\s\S]*?)\n---\n/);
  if (!fm) throw new Error('missing frontmatter');
  const meta = Object.fromEntries(fm[1].split('\n').map((l) => l.match(/^(\w+):\s*(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim()]));
  for (const key of ['title', 'meta_description', 'slug', 'last_verified']) if (!meta[key]) throw new Error('missing ' + key);
  return { meta, body: md.slice(fm[0].length) };
}

// Inline: escape, then links, bare URLs, bold/italic, citation markers.
function inline(text) {
  let s = esc(text);
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/(?!\/)[^)\s]*)\)/g, (_m, t, u) => '<a href="' + u + '"' + (u.startsWith('http') ? ' rel="noopener"' : '') + '>' + t + '</a>');
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+[^\s<).,;:])/g, (_m, pre, u) => pre + '<a href="' + u + '" rel="noopener">' + u + '</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[\s(])_([^_]+)_(?=[\s).,;:]|$)/g, '$1<em>$2</em>');
  return s.replace(/\[(\d{1,2})\]/g, '<sup><a href="#source-$1" aria-label="Source $1">[$1]</a></sup>');
}

export function renderMarkdown(body) {
  const lines = body.split('\n');
  const out = [];
  const headings = [];
  let i = 0;
  const para = [];
  const flush = () => { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para.length = 0; } };
  let inSources = false;
  let sourceN = 0;
  while (i < lines.length) {
    const line = lines[i];
    let m;
    if (!line.trim()) { flush(); i++; continue; }
    if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
      flush();
      const level = m[1].length, text = m[2].trim();
      if (level === 1) { i++; continue; } // page H1 comes from the title
      const id = slugId(text);
      inSources = level === 2 && /^sources$/i.test(text);
      if (inSources) sourceN = 0;
      if (level === 2) headings.push({ id, text });
      out.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      i++; continue;
    }
    if (line.startsWith('>')) {
      flush();
      const quote = [];
      while (i < lines.length && lines[i].startsWith('>')) quote.push(lines[i++].replace(/^>\s?/, ''));
      const html = quote.join('\n').split(/\n\s*\n/).map((p) => '<p>' + inline(p.replace(/\n/g, ' ')) + '</p>');
      out.push('<blockquote>' + html.join('') + '</blockquote>');
      continue;
    }
    if (/^\s*\|/.test(line)) {
      flush();
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]);
      const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const [head, sep, ...rest] = rows;
      if (!sep || !/^[\s|:-]+$/.test(sep)) throw new Error('table without separator');
      out.push('<div class="doc-table"><table><thead><tr>' + cells(head).map((c) => '<th scope="col">' + inline(c) + '</th>').join('') + '</tr></thead><tbody>' +
        rest.map((r) => '<tr>' + cells(r).map((c) => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>');
      continue;
    }
    if ((m = line.match(/^(\s*)([-*]|\d+\.)\s+/))) {
      flush();
      const ordered = /\d/.test(m[2]);
      const items = [];
      while (i < lines.length && (m = lines[i].match(/^\s*([-*]|\d+\.)\s+(.*)$/)) && /\d/.test(m[1]) === ordered) {
        items.push(m[2]);
        i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*]|\d+\.)\s/.test(lines[i])) items[items.length - 1] += ' ' + lines[i++].trim();
      }
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>` + items.map((t) => `<li${inSources && ordered ? ` id="source-${++sourceN}"` : ''}>` + inline(t) + '</li>').join('') + `</${tag}>`);
      continue;
    }
    para.push(line.trim());
    i++;
  }
  flush();
  return { html: out.join('\n        '), headings };
}

// FAQ schema mirrors the visible Q&A: question H2s and the first paragraph after.
export function faqFrom(body) {
  const items = [];
  const re = /^##\s+(.+\?)\s*\n+(?!\s*[-*]\s|\s*\d+\.\s)([^\n#>|][^\n]*(?:\n(?![\n#>|]|\s*[-*]\s|\s*\d+\.\s)[^\n]+)*)/gm;
  let m;
  while ((m = re.exec(body))) items.push({ q: m[1].trim(), a: m[2].replace(/\s+/g, ' ').replace(/\[(\d{1,2})\]/g, '').replace(/\*\*/g, '').replace(/\s+([.,;:])/g, '$1').trim() });
  return items;
}

function page(template, { title, description, canonical, h1, navLinks, content, ld, lastVerified, ogType = 'article' }) {
  let html = template;
  const set = (re, value) => { html = html.replace(re, (_m, a, b) => a + esc(value) + b); };
  html = html.replace(/<title>[^<]*<\/title>/, () => '<title>' + esc(title) + '</title>');
  set(/(<meta name="description" content=")[^"]*(")/, description);
  set(/(<link rel="canonical" href=")[^"]*(")/, canonical);
  set(/(<meta property="og:title" content=")[^"]*(")/, title);
  set(/(<meta property="og:description" content=")[^"]*(")/, description);
  set(/(<meta property="og:url" content=")[^"]*(")/, canonical);
  html = html.replace(/<meta property="og:type" content="website" \/>/, () => '<meta property="og:type" content="' + ogType + '" />');
  html = html.replace('</head>', () => '  <script type="application/ld+json">' + scriptJson(ld) + '</script>\n</head>');
  const main = `<main class="wsh" id="main">
    <div class="legal-grid">
      <nav class="legal-nav" aria-label="On this page">
        <a class="legal-doc-link" href="/guides">All guides</a>
        <div class="legal-nav-sep"></div>
        ${navLinks}
      </nav>
      <div class="doc"><article class="doc-inner">
        <a class="back" href="/guides">← All guides</a>
        <h1>${esc(h1)}</h1>
        ${lastVerified ? `<p class="meta">Facts checked against the sources below on <time datetime="${esc(lastVerified)}">${esc(lastVerified)}</time>.</p>` : ''}
        ${content}
      </article></div>
    </div>
  </main>`;
  return html.replace(/<main class="wsh" id="main">[\s\S]*?<\/main>/, () => main);
}

export function buildGuides() {
  const template = read('privacy.html');
  const files = readdirSync(new URL('guides/src/', root)).filter((f) => f.endsWith('.md')).sort();
  const guides = files.map((file) => {
    const { meta, body } = parseGuide(read('guides/src/' + file));
    if (meta.slug + '.md' !== file) throw new Error(file + ': slug mismatch');
    const { html, headings } = renderMarkdown(body);
    const canonical = SITE + '/guides/' + meta.slug;
    const faq = meta.schema_type === 'FAQPage' ? faqFrom(body) : [];
    const ld = [{
      '@context': 'https://schema.org', '@type': 'Article', headline: meta.title, description: meta.meta_description, url: canonical,
      mainEntityOfPage: canonical, dateModified: meta.last_verified, inLanguage: 'en-US',
      author: { '@type': 'Organization', name: 'Drop', url: SITE + '/' }, publisher: { '@type': 'Organization', name: 'Resonance Ventures LLC', url: SITE + '/' },
    }];
    if (faq.length >= 2) ld.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) });
    const navLinks = headings.map((h) => `<a href="#${h.id}">${esc(h.text)}</a>`).join('\n        ');
    return { meta, html: page(template, { title: meta.title + ' | Drop', description: meta.meta_description, canonical, h1: meta.title, navLinks, content: html, ld: ld.length === 1 ? ld[0] : ld, lastVerified: meta.last_verified }) };
  });
  const list = guides.map(({ meta }) => `<li><a href="/guides/${meta.slug}"><strong>${esc(meta.title)}</strong></a><br>${esc(meta.meta_description)}</li>`).join('\n          ');
  const index = page(template, {
    title: 'EDM Guides: Festivals, Venues and Your First Rave | Drop', description: 'Practical, source-checked guides for going out: festivals, Red Rocks, Denver venues, budgeting, safety and getting home.',
    canonical: SITE + '/guides', h1: 'Guides', navLinks: '', content: '<ul class="guide-list">\n          ' + list + '\n        </ul>',
    ld: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Drop guides', url: SITE + '/guides', hasPart: guides.map(({ meta }) => ({ '@type': 'Article', headline: meta.title, url: SITE + '/guides/' + meta.slug })) },
    lastVerified: '', ogType: 'website',
  });
  const block = (text, start, end, inner) => {
    const re = new RegExp(start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (!re.test(text)) throw new Error('missing marker ' + start);
    return text.replace(re, () => start + inner + end);
  };
  const sitemap = block(read('sitemap.xml'), '<!-- guides:start -->', '<!-- guides:end -->',
    '\n' + ['/guides', ...guides.map(({ meta }) => '/guides/' + meta.slug)].map((p) => '  <url>\n    <loc>' + SITE + p + '</loc>\n    <changefreq>monthly</changefreq>\n  </url>').join('\n') + '\n  ');
  const llms = block(read('llms.txt'), '<!-- guides:start -->', '<!-- guides:end -->',
    '\n## Guides\n\nSource-checked guides (each cites its sources):\n\n' + guides.map(({ meta }) => `- [${meta.title}](${SITE}/guides/${meta.slug}): ${meta.meta_description}`).join('\n') + '\n');
  return { guides, index, sitemap, llms };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { guides, index, sitemap, llms } = buildGuides();
  for (const { meta, html } of guides) writeFileSync(new URL('guides/' + meta.slug + '.html', root), html);
  writeFileSync(new URL('guides.html', root), index); // served at /guides
  writeFileSync(new URL('sitemap.xml', root), sitemap);
  writeFileSync(new URL('llms.txt', root), llms);
  console.log('built', guides.length, 'guides + index');
}
