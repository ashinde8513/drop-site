import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

// The server renders "Know before you go" into #venue-content; venue.html must
// keep that node (not wipe it) and place it after "About this venue".
const CARD = '<section class="ven-section kbyg" data-kbyg aria-labelledby="kbyg-h"><h2 class="sec-h2" id="kbyg-h">Know before you go</h2>' +
  '<p class="kbyg-intro">Reviewed venue information.</p><ul class="kbyg-list"><li><strong>Age policy:</strong> 21+ (2 shows)</li></ul>' +
  '<details class="kbyg-unknown"><summary>Not verified yet (7)</summary><ul class="kbyg-list"><li><strong>Capacity:</strong> Unknown</li></ul></details></section>';
const ROW = { id: '11111111-1111-4111-8111-111111111111', title: 'Card Night', date: '2099-01-01T03:00:00Z', venue_id: '33333333-3333-4333-8333-333333333333',
  venue_name: 'Ogden Theatre', city: 'Denver', state: 'CO', status: 'published', event_artists: [] };

test('venue page keeps the server "Know before you go" card after the client render', async ({ page }) => {
  const html = readFileSync('venue.html', 'utf8').replace(/(<div id="venue-content"[^>]*>)/, (m) => m + '<div data-server-entity>' + CARD + '</div>');
  await page.route('**/venue.html?*', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: html }));
  await page.route('**/rest/v1/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(/events\?/.test(route.request().url()) ? [ROW] : []) }));
  await page.goto('/venue.html?name=Ogden%20Theatre&city=Denver');
  const card = page.locator('[data-kbyg]');
  await expect(page.locator('.ven-name')).toHaveText('Ogden Theatre');
  await expect(card).toHaveCount(1);
  await expect(card.getByRole('heading', { name: 'Know before you go' })).toBeVisible();
  // Placed after "About this venue", before the show grid.
  const order = await page.evaluate(() => [...document.querySelectorAll('.ven-section h2')].map((h) => h.textContent));
  expect(order.indexOf('Know before you go')).toBe(order.indexOf('About this venue') + 1);
  await expect(card.getByText('Capacity:')).toBeHidden();
  await card.getByText('Not verified yet (7)').click();
  await expect(card.getByText('Capacity:')).toBeVisible();
});
