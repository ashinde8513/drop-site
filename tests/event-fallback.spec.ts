import { expect, test } from '@playwright/test';

// No-art event cards: own image → lineup art → approved venue photo → branded Prism card
// (spec: event-fallback-card-design-spec-2026-11-02). Seed = event id, same djb2 as the app.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const MERSIV = '11111111-1111-4111-8111-111111111111';
const BARE = '22222222-2222-4222-8222-222222222222';
const PHOTO = '33333333-3333-4333-8333-333333333333';
const base = { city: 'Denver', state: 'CO', status: 'published', timezone: 'America/Denver', event_artists: [] as unknown[] };
const rows = [
  { ...base, id: MERSIV, title: 'Halloween Night: Mersiv + Friends', date: '2030-11-07T03:00:00Z', venue_name: "Cervantes' Masterpiece Ballroom",
    event_artists: [{ artists: { id: 'a1', name: 'Mersiv', genres: ['Bass'], image_url: null } }] },
  { ...base, id: BARE, title: 'Techno Tuesday at Fiction', date: '2030-11-10T03:00:00Z', venue_name: 'Ogden Theatre' },
  { ...base, id: PHOTO, title: 'Lane 8', date: '2030-11-12T03:00:00Z', venue_name: 'Fillmore Auditorium', venue_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
];

test.use({ timezoneId: 'America/Denver' });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('drop.cookie-consent', 'essential'));
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('**/rest/v1/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/rest/v1/events?**', route => route.fulfill({ status: 200, contentType: 'application/json',
    headers: { 'content-range': `0-${rows.length - 1}/${rows.length}` }, body: JSON.stringify(rows) }));
});

test('cards without art show the branded Prism fallback with headliner, title and date chip', async ({ page }) => {
  await page.goto('/events.html?city=Denver');
  const card = (id: string) => page.locator(`.wsc-card[data-event-id="${id}"]`);
  await expect(card(MERSIV).locator('.efb')).toBeVisible();
  await expect(card(MERSIV).locator('.efb__head')).toHaveText('Mersiv');
  await expect(card(MERSIV).locator('.efb__sub')).toHaveText('Halloween Night: Mersiv + Friends');
  await expect(card(MERSIV).locator('.efb__chip')).toHaveText(/^[A-Z]{3} NOV \d+ '30$/);
  // no lineup: the title is the headliner and there is no subtitle
  await expect(card(BARE).locator('.efb__head')).toHaveText('Techno Tuesday at Fiction');
  await expect(card(BARE).locator('.efb__sub')).toHaveCount(0);
  // decorative: hidden from AT, the card's own label still names the show
  await expect(card(MERSIV).locator('.efb')).toHaveAttribute('aria-hidden', 'true');
  await expect(card(MERSIV)).toHaveAttribute('aria-label', /Halloween Night: Mersiv \+ Friends/);
  // seeded pair is a pure function of the event id (djb2 % 8, same as the app)
  const pair = (id: string) => { let h = 0; for (const c of id) { h = (h << 5) - h + c.charCodeAt(0); h |= 0; } return Math.abs(h) % 8; };
  await expect(card(MERSIV).locator('.efb')).toHaveClass(new RegExp(`efb-${pair(MERSIV)}\\b`));
  await expect(card(BARE).locator('.efb')).toHaveClass(new RegExp(`efb-${pair(BARE)}\\b`));
  // white-on-glow contrast: the headliner sits on an ink-based background, text is white
  await expect(card(MERSIV).locator('.efb__head')).toHaveCSS('color', 'rgb(255, 255, 255)');
});

test('an approved venue photo replaces the Prism card, with its credit', async ({ page }) => {
  await page.route('**/rest/v1/venue_hero_images?**', route => route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify([{ venue_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', image_url: 'https://upload.wikimedia.org/hero.png',
      credit: 'Photo: Joe Mabel · CC BY-SA 3.0 · cropped for display' }]) }));
  await page.route('https://upload.wikimedia.org/**', route => route.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await page.goto('/events.html?city=Denver');
  const card = page.locator(`.wsc-card[data-event-id="${PHOTO}"]`);
  await expect(card.locator('img.wsc__img')).toHaveAttribute('src', 'https://upload.wikimedia.org/hero.png');
  await expect(card.locator('.efb')).toHaveCount(0);
  await expect(card.locator('.efb__credit')).toHaveText('Photo: Joe Mabel · CC BY-SA 3.0');
  // cards for venues with no photo keep the Prism fallback
  await expect(page.locator(`.wsc-card[data-event-id="${BARE}"] .efb`)).toBeVisible();
});

test('fallback card stays inside the card at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/events.html?city=Denver');
  const card = page.locator(`.wsc-card[data-event-id="${MERSIV}"]`);
  await expect(card.locator('.efb__head')).toBeVisible();
  const c = (await card.boundingBox())!, t = (await card.locator('.efb__text').boundingBox())!;
  expect(t.x).toBeGreaterThanOrEqual(c.x);
  expect(t.x + t.width).toBeLessThanOrEqual(c.x + c.width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
