import { expect, test } from '@playwright/test';

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
