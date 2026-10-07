import { expect, test, type Page, type Route } from '@playwright/test';

const rows = [
  { id: '11111111-1111-4111-8111-111111111111', title: 'Tonight show', date: '2030-01-10T03:00:00Z' },
  { id: '22222222-2222-4222-8222-222222222222', title: 'Friday show', date: '2030-01-12T03:00:00Z' },
  { id: '33333333-3333-4333-8333-333333333333', title: 'Next month show', date: '2030-02-02T03:00:00Z' },
].map(row => ({ ...row, city: 'Denver', venue_name: 'Test Hall', status: 'published', event_artists: [] }));

async function respond(route: Route, data = rows, status = 200) {
  await route.fulfill({ status, contentType: 'application/json',
    headers: { 'content-range': `0-${data.length - 1}/${data.length}` }, body: JSON.stringify(data) });
}

async function settle(page: Page) {
  // Flush browser promise/render work after the deliberately released old response.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

test.use({ timezoneId: 'America/Denver' });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('drop.cookie-consent', 'essential'));
  await page.clock.install({ time: new Date('2030-01-09T19:00:00Z') });
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('**/rest/v1/**', route => respond(route, []));
});

test('date chips bound the real catalog request and rendered shows', async ({ page }) => {
  await page.route('**/rest/v1/events?**', route => {
    const params = new URL(route.request().url()).searchParams;
    if (params.get('select') === 'venue_name') return respond(route, []);
    const from = Date.parse((params.get('date') || '').replace('gte.', ''));
    const to = params.get('and')?.match(/date\.lte\.([^,)]+)/)?.[1];
    return respond(route, rows.filter(row => Date.parse(row.date) >= from && (!to || Date.parse(row.date) <= Date.parse(to))));
  });
  await page.goto('/events.html?city=Denver');
  await expect(page.locator('#grid .wsc-card')).toHaveCount(3);
  for (const [when, titles] of [
    ['tonight', ['Tonight show']], ['weekend', ['Friday show']], ['month', ['Tonight show', 'Friday show']],
  ] as const) {
    const response = page.waitForResponse(res => res.url().includes('/rest/v1/events?'));
    await page.locator(`#fb-when [data-when="${when}"]`).click();
    const params = new URL((await response).url()).searchParams;
    expect(params.get('and')).toMatch(/^\(date\.lte\..+\)$/);
    await expect(page.locator('#grid .wsc__title')).toHaveText([...titles]);
  }
});

for (const [oldStatus, currentStatus] of [[200, 200], [500, 200], [200, 500]]) {
  test(`latest filter owns results: old ${oldStatus}, current ${currentStatus}`, async ({ page }) => {
    let oldRoute!: Route;
    let requestCount = 0;
    await page.route('**/rest/v1/events?**', async route => {
      if (new URL(route.request().url()).searchParams.get('select') === 'venue_name') return respond(route, []);
      if (++requestCount === 1) { oldRoute = route; return; }
      await respond(route, [rows[0]], currentStatus);
    });
    await page.goto('/events.html?city=Denver');
    await expect.poll(() => requestCount).toBe(1);
    await page.locator('#fb-when [data-when="tonight"]').click();
    if (currentStatus === 200) await expect(page.locator('#grid .wsc__title')).toHaveText(['Tonight show']);
    else await expect(page.locator('#grid .state-error')).toBeVisible();
    const oldResponse = page.waitForResponse(res => res.url() === oldRoute.request().url());
    await respond(oldRoute, rows, oldStatus);
    await (await oldResponse).finished();
    await settle(page);
    if (currentStatus === 200) await expect(page.locator('#grid .wsc__title')).toHaveText(['Tonight show']);
    else await expect(page.locator('#grid .state-error')).toBeVisible();
    await expect(page.locator('#fb-when [data-when="tonight"]')).toHaveAttribute('aria-pressed', 'true');
  });
}

test('price changes cannot restore old cards during a new filter request or error', async ({ page }) => {
  let pending!: Route;
  let requestCount = 0;
  await page.route('**/rest/v1/events?**', async route => {
    if (new URL(route.request().url()).searchParams.get('select') === 'venue_name') return respond(route, []);
    if (++requestCount === 1) return respond(route);
    pending = route;
  });
  await page.goto('/events.html?city=Denver');
  await expect(page.locator('#grid .wsc-card')).toHaveCount(3);
  await page.locator('#fb-when [data-when="tonight"]').click();
  await expect.poll(() => !!pending).toBe(true);
  await page.locator('#price-max').press('ArrowLeft');
  await expect(page.locator('#grid .wsc-card')).toHaveCount(0);
  await respond(pending, [], 500);
  await expect(page.locator('#grid .state-error')).toBeVisible();
  await page.locator('#price-max').press('ArrowLeft');
  await expect(page.locator('#grid .state-error')).toBeVisible();
  await expect(page.locator('#grid .wsc-card')).toHaveCount(0);
});

test('query city, interactive city and global festivals keep every location label aligned', async ({ page }) => {
  await page.route('**/rest/v1/events?**', route => respond(route, []));
  await page.goto('/events.html?city=Seattle');
  await expect(page.locator('#fb-city-btn')).toHaveText('Seattle');
  await expect(page.locator('.loc-city')).toHaveText(['Seattle', 'Seattle']);
  await page.locator('#fb-city-btn').click();
  await page.locator('#fb-city-pop input').fill('Denver');
  await page.locator('#fb-city-pop input').press('Enter');
  await expect(page.locator('.loc-city')).toHaveText(['Denver', 'Denver']);
  await expect(page).toHaveURL(/city=Denver/);
  await page.goto('/events.html?festival=1');
  await expect(page.locator('.loc-city')).toHaveText(['All cities', 'All cities']);
});

test('header search and picker use the current query city while implicit festivals preserve preference', async ({ page }) => {
  await page.route('**/rest/v1/events?**', route => respond(route, []));
  await page.goto('/events.html?city=Seattle');
  const search = page.locator(await page.locator('#nav-q').isVisible() ? '#nav-q' : '#events-q');
  await search.fill('Tonight');
  await search.press('Enter');
  await expect(page).toHaveURL(/city=Seattle/);
  await expect(page).toHaveURL(/q=Tonight/);
  await page.getByRole('button', { name: 'Change location', exact: true }).click();
  await page.locator('.wn .loc-filter input').fill('Denver');
  await page.locator('.wn .loc-filter input').press('Enter');
  await expect(page).toHaveURL(/city=Denver/);
  await expect(page).toHaveURL(/q=Tonight/);
  await expect(page.locator('.loc-city')).toHaveText(['Denver', 'Denver']);
  await page.goto('/events.html?festival=1');
  await expect(page.locator('.loc-city')).toHaveText(['All cities', 'All cities']);
  expect(await page.evaluate(() => localStorage.getItem('drop.city'))).toBe('Denver');
  await search.fill('Festival');
  await search.press('Enter');
  await expect(page).toHaveURL(/city=All\+cities/);
});
