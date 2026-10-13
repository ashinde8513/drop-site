import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('canonical Crew shares use an existing install fallback without leaving their URL', () => {
  const rules = read('_redirects').split('\n').filter((line) => !line.trim().startsWith('#'));
  const crew = rules.filter((line) => line.trim().startsWith('/crew-picks/'));
  assert.equal(crew.length, 1);
  assert.deepEqual(crew[0].trim().split(/\s+/), ['/crew-picks/:id', '/download', '200']);
  const page = read('download.html');
  assert.match(page, /https:\/\/apps\.apple\.com\/us\/app\/drop-edm-events\/id6790662825/);
  assert.match(page, /https:\/\/play\.google\.com\/store\/apps\/details\?id=app\.resonanceventures\.drop/);
  assert.doesNotMatch(page + read('site.js') + read('data.js'), /get_crew_pick_preview|crew_pick_(boards|members|votes)|get_crew_pick_board/);
  const routes = JSON.parse(read('_routes.json'));
  assert.ok(!routes.include.some((path) => path === '/*' || path.startsWith('/crew-picks')),
    'Crew fallback stays static, outside database-backed Pages Functions');
});

test('AASA adds Crew boards to the existing Drop identity without losing existing links', () => {
  const association = JSON.parse(read('.well-known/apple-app-site-association'));
  assert.equal(association.applinks.details.length, 1);
  const detail = association.applinks.details[0];
  assert.deepEqual(detail.appIDs, ['S6H8PA7TUH.app.resonanceventures.drop']);
  const paths = detail.components.map((component) => component['/']);
  assert.deepEqual(paths.toSorted(), ['/', '/crew-picks/*', '/event/*', '/plan/*', '/reset-password'].toSorted());
  assert.ok(detail.components.every((component) => !component.exclude));
});

test('Crew fallback suppresses indexing and identifier-bearing referrers', () => {
  const headers = read('_headers').match(/^\/crew-picks\/\*\n((?:[ \t]+[^\n]+\n)+)/m)?.[1];
  assert.ok(headers, 'Pretty Crew URLs need their own response-header rule');
  assert.match(headers, /Referrer-Policy: no-referrer/);
  assert.match(headers, /X-Robots-Tag: noindex, nofollow/);
  assert.match(read('_headers'), /\/\.well-known\/apple-app-site-association\n\s+Content-Type: application\/json/);
});
