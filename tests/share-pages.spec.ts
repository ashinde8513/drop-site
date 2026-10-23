import { expect, test } from '@playwright/test';

// Share landings must never show text taken from the link: anyone can craft
// ?friend=…&artist=… and put it on a trydropapp.com page. Only a published
// event id (looked up in the catalog) and a UUID referral are honoured.
const LONG = 'A'.repeat(5000);
const HOSTILE = new URLSearchParams({
  friend: '<script>window.__pwned=1</script>Mallory', artist: '<img src=x onerror="window.__pwned=1">Fake Headliner',
  venue: 'Totally Real Venue', rating: '5', date: '2026-01-01', u: 'evil"handle', year: '1999', shows: '9999',
  artists: LONG, topartist: '<b>bold</b>', topgenre: 'Spoofed', city: 'Nowhere', percentile: '99', ref: 'not-a-uuid',
}).toString();
const EVENT = '11111111-1111-4111-8111-111111111111';
const REF = '22222222-2222-4222-8222-222222222222';

async function visibleText(page) {
  return page.evaluate(() => document.body.innerText + ' ' + document.title);
}

test.beforeEach(async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
});

for (const path of ['/share-recap.html', '/share-wrapped.html']) {
  test(`${path} ignores crafted query text`, async ({ page }) => {
    await page.route('**/rest/v1/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(path + '?' + HOSTILE);
    const text = await visibleText(page);
    for (const planted of ['Mallory', 'Fake Headliner', 'Totally Real Venue', '9999', 'AAAAAAAAAA', 'bold', 'Spoofed', 'Nowhere', 'Maya', 'ODESZA']) {
      expect(text, planted).not.toContain(planted);
    }
    expect(await page.evaluate(() => (window as any).__pwned)).toBeUndefined();
    await expect(page.locator('script:not([src])').filter({ hasText: 'Mallory' })).toHaveCount(0);
    const join = page.locator('#recap-join, #wr-join');
    await expect(join).toHaveAttribute('href', 'https://app.trydropapp.com/?mode=signup');
  });
}

test('recap shows only the real catalog event for a published event id, and passes a UUID referral', async ({ page }) => {
  await page.route('**/rest/v1/events?**', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([{ id: EVENT, title: 'Real Show', venue_name: 'Real Hall', date: '2026-11-20T03:00:00Z', time_tbd: false, event_artists: [] }]),
  }));
  await page.goto(`/share-recap.html?event=${EVENT}&ref=${REF}&artist=Fake%20Headliner&friend=Mallory`);
  await expect(page.locator('#recap-artist')).toHaveText('Real Show');
  await expect(page.locator('#recap-meta')).toContainText('Real Hall');
  await expect(page.locator('#recap-headline')).toHaveText('A Drop recap from Real Show');
  const text = await visibleText(page);
  expect(text).not.toContain('Fake Headliner');
  expect(text).not.toContain('Mallory');
  await expect(page.locator('#recap-join')).toHaveAttribute('href',
    `https://app.trydropapp.com/?mode=signup&ref=${REF}&src=recap_share&kind=event&target=${EVENT}`);
});

test('wrapped passes only a UUID referral', async ({ page }) => {
  await page.goto(`/share-wrapped.html?ref=${REF}&friend=Mallory`);
  await expect(page.locator('#wr-join')).toHaveAttribute('href', `https://app.trydropapp.com/?mode=signup&ref=${REF}&src=wrapped`);
  await expect(page.locator('#wr-eyebrow')).toHaveText('DROP WRAPPED');
});

for (const path of ['/city.html', '/genre.html?genre=Techno&']) {
  test(`${path.split('?')[0]} shows a link's city only when it is a known market`, async ({ page }) => {
    await page.route('**/rest/v1/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    const join = path.includes('?') ? '' : '?';
    await page.goto(path + join + 'city=' + encodeURIComponent('Buy tickets at evil.example'));
    const text = await visibleText(page);
    expect(text).not.toContain('evil.example');
    expect(text).toContain('Denver');
    await page.goto(path + join + 'city=las%20vegas');
    await expect(page.locator('h1')).toContainText('Las Vegas');
  });
}
