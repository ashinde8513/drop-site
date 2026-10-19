import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { changedUrls, fileToUrl, locs, newUrls, payloads } from '../scripts/indexnow.mjs';

test('IndexNow picks new sitemap URLs and pages whose sources changed', () => {
  const urls = locs('<url><loc>https://trydropapp.com/</loc></url><url><loc>https://trydropapp.com/genre?genre=House&amp;city=Chicago</loc></url><url><loc>https://trydropapp.com/guides/red-rocks-edm-guide</loc></url>');
  assert.deepEqual(urls, ['https://trydropapp.com/', 'https://trydropapp.com/genre?genre=House&city=Chicago', 'https://trydropapp.com/guides/red-rocks-edm-guide']);
  assert.deepEqual(newUrls(urls, ['https://trydropapp.com/']), urls.slice(1));
  assert.equal(fileToUrl('index.html'), 'https://trydropapp.com/');
  assert.equal(fileToUrl('guides/red-rocks-edm-guide.html'), 'https://trydropapp.com/guides/red-rocks-edm-guide');
  for (const skip of ['app/index.html', 'newsletter/drafts/issue-01.html', '404.html', 'google75d252b1adf86e07.html', 'site.css']) assert.equal(fileToUrl(skip), null, skip);
  assert.deepEqual(changedUrls(['guides/red-rocks-edm-guide.html', 'promoters.html', 'site.js'], urls), ['https://trydropapp.com/guides/red-rocks-edm-guide'], 'only pages that are in a sitemap');
  const batches = payloads(Array.from({ length: 10001 }, (_, i) => `https://trydropapp.com/x${i}`), 'abc123def');
  assert.equal(batches.length, 2);
  assert.deepEqual(Object.keys(batches[0]), ['host', 'key', 'keyLocation', 'urlList']);
  assert.equal(batches[0].keyLocation, 'https://trydropapp.com/abc123def.txt');
});

test('the IndexNow key file is published and matches its name', () => {
  const keys = readdirSync(new URL('../', import.meta.url)).filter((f) => /^[0-9a-f]{32}\.txt$/.test(f));
  assert.equal(keys.length, 1, 'exactly one key file');
  assert.equal(readFileSync(new URL('../' + keys[0], import.meta.url), 'utf8'), keys[0].slice(0, -4));
  assert.match(readFileSync(new URL('../scripts/build-dist.sh', import.meta.url), 'utf8'), /IndexNow key file/);
});
