import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

// The homepage grid's first card image is the LCP element: it must not be
// lazy-loaded, and the first one carries fetchpriority=high.
test('above-the-fold card images load eagerly; the first is high priority', async ({ page }) => {
  const date = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const events = Array.from({ length: 12 }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, title: `Show ${i}`, date, status: 'published',
    venue_name: 'Mission Ballroom', city: 'Denver', state: 'CO', image_url: `https://art.test/${i}.png`, event_artists: [],
  }));
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ status:200, contentType:'text/css', body:'' }));
  await page.route('https://art.test/**', route => route.fulfill({ status:200, contentType:'image/png', body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64') }));
  await page.route('**/rest/v1/**', route => route.fulfill({ status:200, contentType:'application/json', body:'[]' }));
  await page.route('**/rest/v1/events?**', route => route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(events) }));
  await page.goto('/index.html');
  const imgs = page.locator('#home-grid img.wsc__img');
  await expect(imgs.first()).toBeAttached();
  await expect(imgs.first()).toHaveAttribute('loading', 'eager');
  await expect(imgs.first()).toHaveAttribute('fetchpriority', 'high');
  await expect(imgs.nth(1)).not.toHaveAttribute('fetchpriority', 'high');
  expect(await imgs.evaluateAll((list) => list.slice(4).every((img) => (img as HTMLImageElement).loading === 'lazy'))).toBe(true);
});

test('server LCP hint preloads the first card only for the default city', async ({ page }) => {
  const html = readFileSync('index.html', 'utf8').replace('<script data-lcp-hint>', '<meta name="drop-lcp" data-city="Denver" content="https://art.test/hero.png" />\n  <script data-lcp-hint>');
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ status:200, contentType:'text/css', body:'' }));
  await page.route('https://art.test/**', route => route.fulfill({ status:200, contentType:'image/png', body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64') }));
  await page.route('**/rest/v1/**', route => route.fulfill({ status:200, contentType:'application/json', body:'[]' }));
  await page.route('**/index.html*', route => route.fulfill({ status:200, contentType:'text/html', body:html }));
  await page.goto('/index.html');
  const preload = page.locator('link[rel="preload"][as="image"]');
  await expect(preload).toHaveAttribute('href', 'https://art.test/hero.png');
  await expect(preload).toHaveAttribute('fetchpriority', 'high');
  await expect(preload).toHaveAttribute('referrerpolicy', 'no-referrer');
  await page.evaluate(() => localStorage.setItem('drop.city', 'Chicago'));
  await page.reload();
  await expect(page.locator('link[rel="preload"][as="image"]')).toHaveCount(0);
});

test('a server-seeded homepage renders the grid without the catalog request', async ({ page }) => {
  const date = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const rows = Array.from({ length: 3 }, (_, i) => ({ id: `00000000-0000-4000-8000-00000000003${i}`, title: `Seeded ${i}`, date, status: 'published', venue_name: 'Mission Ballroom', city: 'Denver', state: 'CO', image_url: null, event_artists: [] }));
  const html = readFileSync('index.html', 'utf8').replace('<div class="grid-events" id="home-grid"',
    '<script type="application/json" id="home-seed">' + JSON.stringify({ city: 'Denver', total: 3, rows }) + '</script>\n<div class="grid-events" id="home-grid"');
  const gridRequests: string[] = [];
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ status:200, contentType:'text/css', body:'' }));
  await page.route('**/rest/v1/**', route => route.fulfill({ status:200, contentType:'application/json', body:'[]' }));
  await page.route('**/rest/v1/events?**', route => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('city') === 'ilike.Denver' && url.searchParams.get('limit') === '24') gridRequests.push(url.href);
    route.fulfill({ status:200, contentType:'application/json', body:'[]' });
  });
  await page.route('**/index.html*', route => route.fulfill({ status:200, contentType:'text/html', body:html }));
  await page.goto('/index.html');
  await expect(page.locator('#home-grid .wsc-card')).toHaveCount(3);
  await expect(page.locator('#home-grid')).toContainText('Seeded 0');
  expect(gridRequests).toEqual([]);
});

test.describe('server-rendered first cards', () => {
  test.use({ timezoneId: 'America/Denver' });
  test('match the client ecard markup exactly and paint before scripts', async ({ page }) => {
    const { homeCardsHtml } = await import('../src/home-lcp.mjs');
    const date = new Date(Date.now() + 2 * 86400000);
    date.setUTCHours(3, 30, 0, 0);
    const rows = [
      { id: '00000000-0000-4000-8000-000000000041', title: 'No Art Show', date: date.toISOString(), venue_name: 'Bluebird', city: 'Denver', state: 'CO', image_url: null, price_min: null, price_max: null, event_artists: [] },
      { id: '00000000-0000-4000-8000-000000000042', title: 'Bass & <Friends>', date: date.toISOString(), venue_name: 'Mission Ballroom', city: 'Denver', state: 'CO', image_url: 'https://art.test/a.png', price_min: 25, price_max: 40, event_artists: [{ artists: { genres: ['dubstep'] } }] },
      { id: '00000000-0000-4000-8000-000000000043', title: 'Late Techno', date: date.toISOString(), time_tbd: true, venue_name: 'Temple', city: 'Denver', state: 'CO', image_url: 'https://art.test/b.png', price_min: 15, price_max: null, event_artists: [{ artists: { genres: ['techno'] } }] },
    ];
    const server = homeCardsHtml(rows, 2); // production renders 1; parity checked on 2
    const html = readFileSync('index.html', 'utf8').replace('<div class="grid-events" id="home-grid" aria-label="Upcoming shows"></div>',
      '<script type="application/json" id="home-seed">' + JSON.stringify({ city: 'Denver', total: rows.length, rows }) + '</script>\n<div class="grid-events" id="home-grid" aria-label="Upcoming shows">' + server + '</div>');
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ status:200, contentType:'text/css', body:'' }));
    await page.route('https://art.test/**', route => route.fulfill({ status:200, contentType:'image/png', body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64') }));
    await page.route('**/rest/v1/**', route => route.fulfill({ status:200, contentType:'application/json', body:'[]' }));
    await page.route('**/index.html*', route => route.fulfill({ status:200, contentType:'text/html', body:html }));
    await page.goto('/index.html');
    await expect(page.locator('#home-grid .wsc-card')).toHaveCount(3);
    const [client, ssr] = await page.evaluate((serverHtml) => {
      const s = (root: Element) => [...root.querySelectorAll(':scope > a.wsc-card')].map(function walk(el: Element): unknown {
        const attrs = [...el.attributes].map((a) => [a.name, a.value]).sort();
        return [el.tagName, attrs, el.children.length ? [...el.children].map(walk) : el.textContent];
      });
      const box = document.createElement('div');
      box.innerHTML = serverHtml;
      return [s(document.getElementById('home-grid')!).slice(0, 2), s(box)];
    }, server);
    expect(ssr).toHaveLength(2); // only leading cards with real art
    expect(client).toEqual(ssr);
  });
});
