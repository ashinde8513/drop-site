// IndexNow (Bing, Yandex, Seznam, Naver; Google ignores it) for new and
// changed pages. Dry run by default: prints what it would submit.
//   node scripts/indexnow.mjs [--since <git-ref>] [--submit]
// New = sitemap URLs not in indexnow/submitted.json. Changed = pages whose
// source files changed since <git-ref> (static pages, guides). --submit needs
// INDEXNOW_KEY and the key file live at https://trydropapp.com/<key>.txt
// (APPROVALS W23), then records what was sent in indexnow/submitted.json.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const HOST = 'trydropapp.com';
const SITE = 'https://' + HOST;
const SITEMAPS = [SITE + '/sitemap.xml', SITE + '/sitemap-entities.xml'];
const SNAPSHOT = new URL('../indexnow/submitted.json', import.meta.url);

export function locs(xml) {
  return [...String(xml).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&').trim());
}

// Repo file → public URL (Pages strips .html; index.html is /).
export function fileToUrl(file) {
  if (!/\.html$/.test(file) || /^(app|design-drop|dist|docs|history|newsletter|tests)\//.test(file) || /^(404|google[^/]*)\.html$/.test(file)) return null;
  if (file === 'index.html') return SITE + '/';
  return SITE + '/' + file.replace(/\.html$/, '');
}

export function changedUrls(files, sitemapUrls) {
  const listed = new Set(sitemapUrls);
  return [...new Set(files.map(fileToUrl).filter((url) => url && listed.has(url)))];
}

export function newUrls(sitemapUrls, submitted) {
  const seen = new Set(submitted);
  return sitemapUrls.filter((url) => !seen.has(url));
}

export function payloads(urls, key, size = 10000) {
  const out = [];
  for (let i = 0; i < urls.length; i += size) out.push({ host: HOST, key, keyLocation: `${SITE}/${key}.txt`, urlList: urls.slice(i, i + size) });
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const since = args.includes('--since') ? args[args.indexOf('--since') + 1] : null;
  const submit = args.includes('--submit');
  const sitemapUrls = (await Promise.all(SITEMAPS.map(async (url) => locs(await (await fetch(url)).text())))).flat();
  const submitted = existsSync(SNAPSHOT) ? JSON.parse(readFileSync(SNAPSHOT, 'utf8')).urls : [];
  const files = since ? execFileSync('git', ['diff', '--name-only', since, 'HEAD'], { encoding: 'utf8' }).split('\n').filter(Boolean) : [];
  const urls = [...new Set([...newUrls(sitemapUrls, submitted), ...changedUrls(files, sitemapUrls)])];
  console.log(`${sitemapUrls.length} sitemap URLs, ${submitted.length} already submitted → ${urls.length} to submit` + (since ? ` (incl. pages changed since ${since})` : ''));
  if (!submit) { console.log(urls.slice(0, 20).join('\n') + (urls.length > 20 ? `\n… ${urls.length - 20} more` : '') + '\nDry run. Add --submit to send.'); process.exit(0); }
  const key = process.env.INDEXNOW_KEY;
  if (!key || !/^[a-zA-Z0-9-]{8,128}$/.test(key)) throw new Error('INDEXNOW_KEY missing or malformed');
  const hosted = await fetch(`${SITE}/${key}.txt`);
  if (!hosted.ok || (await hosted.text()).trim() !== key) throw new Error(`key file ${SITE}/${key}.txt is not live`);
  for (const body of payloads(urls, key)) {
    const res = await fetch('https://api.indexnow.org/indexnow', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(body) });
    console.log('IndexNow', res.status, body.urlList.length, 'URLs');
    if (res.status !== 200 && res.status !== 202) throw new Error('IndexNow rejected the batch: ' + res.status);
  }
  writeFileSync(SNAPSHOT, JSON.stringify({ updatedAt: new Date().toISOString(), urls: [...new Set([...submitted, ...urls])].sort() }, null, 1) + '\n');
}
