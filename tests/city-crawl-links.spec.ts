import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

// The city Function injects plain event links into the weekend rail for
// non-JS crawlers. Real visitors must never see them: site.js clears the host.
test('server-rendered crawl links are replaced before visitors see them', async ({ page }) => {
  const html = readFileSync('city.html', 'utf8').replace(
    /(<div class="rail" id="rail-city-weekend"[^>]*>)/,
    '$1<div data-server-entity><h3>Upcoming shows in Denver</h3><ul><li><a href="/event/x/crawl-only">Crawl only</a> — Venue, Nov 6</li></ul></div>',
  );
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ status:200, contentType:'text/css', body:'' }));
  await page.route('**/rest/v1/**', route => route.fulfill({ status:200, contentType:'application/json', body:'[]' }));
  await page.route('**/city.html*', route => route.fulfill({ status:200, contentType:'text/html', body:html }));
  await page.goto('/city.html?city=Denver');
  await expect(page.locator('#rail-city-weekend')).toBeAttached();
  await expect(page.locator('[data-server-entity]')).toHaveCount(0);
  await expect(page.getByText('Crawl only')).toHaveCount(0);
});

test('genre page crawl links are replaced before visitors see them', async ({ page }) => {
  const html = readFileSync('genre.html', 'utf8').replace(
    /(<div class="rail" id="rail-genre-shows"[^>]*>)/,
    '$1<div data-server-entity><h3>Upcoming House shows in Denver</h3><ul><li><a href="/event/x/crawl-only">Crawl only</a></li></ul></div>',
  );
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ status:200, contentType:'text/css', body:'' }));
  await page.route('**/rest/v1/**', route => route.fulfill({ status:200, contentType:'application/json', body:'[]' }));
  await page.route('**/genre.html*', route => route.fulfill({ status:200, contentType:'text/html', body:html }));
  await page.goto('/genre.html?genre=House&city=Denver');
  await expect(page.locator('#rail-genre-shows')).toBeAttached();
  await expect(page.locator('[data-server-entity]')).toHaveCount(0);
});
