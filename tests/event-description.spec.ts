import { expect, test } from '@playwright/test';

// Provider descriptions arrive as HTML fragments; the event page must show,
// describe and mark them up as plain text.
test('event detail renders catalog HTML descriptions as plain text', async ({ page }) => {
  const id = '9a6c1d1e-5b7a-4c4e-9f0e-2a1b3c4d5e6f';
  const event = {
    id, title: 'Haunted Circus Night', status: 'published', is_festival: false, time_tbd: false,
    description: '<p style="margin:0;">Doors 8pm&nbsp;&amp; <b>18+</b></p>',
    date: '2027-01-15T03:00:00Z', end_date: null, timezone: 'America/Denver',
    venue_name: 'Mission Ballroom', city: 'Denver', state: 'CO', image_url: null,
    ticket_url: 'https://www.ticketmaster.com/e/123', price_min: 30, price_max: null, currency: 'USD',
    created_at: '2026-07-01T00:00:00', event_artists: [],
  };
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ status:200, contentType:'text/css', body:'' }));
  await page.route('**/rest/v1/**', route => route.fulfill({ status:200, contentType:'application/json', body:'[]' }));
  await page.route('**/rest/v1/events?**', route =>
    route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify([event]) }));

  await page.goto(`/event.html?id=${id}`);
  await expect(page.locator('.event-desc')).toHaveText('Doors 8pm & 18+');
  await expect(page).toHaveTitle('Haunted Circus Night at Mission Ballroom · Jan 14 | Drop');
  await expect(page.locator('#meta-desc')).toHaveAttribute('content', 'Doors 8pm & 18+');
  const ld = JSON.parse(await page.locator('#ldjson').textContent() || '{}');
  expect(ld['@type']).toBe('MusicEvent');
  expect(ld.description).toBe('Doors 8pm & 18+');
});
