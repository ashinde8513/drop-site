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

// ?r=<recap id>: the shared_recap_card RPC decides what shows (real show + an opted-in first name).
const RECAP = '33333333-3333-4333-8333-333333333333';
const card = (o: object = {}) => [{ event_title: 'Real Show', event_date: '2026-10-24T03:00:00Z', event_timezone: 'America/Denver', venue_name: 'Real Hall', city: 'Denver', poster_first_name: 'Maya', ...o }];
async function recap(page, body: unknown, status = 200, extra = '') {
  const calls: string[] = [];
  await page.route('**/rest/v1/rpc/shared_recap_card', (route) => { calls.push(route.request().postData() || ''); return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }); });
  await page.goto(`/share-recap.html?r=${RECAP}${extra}`);
  return calls;
}

test('recap ?r= with a name the sharer allowed: their night, joined by name, photos not shared', async ({ page }) => {
  const calls = await recap(page, card(), 200, `&ref=${REF}&friend=Mallory&artist=Fake%20Headliner`);
  await expect(page.locator('#recap-headline')).toHaveText('Maya’s night at Real Show');
  await expect(page.locator('#recap-join')).toHaveText('Join Maya on Drop');
  await expect(page.locator('#recap-eyebrow')).toHaveText('RECAP · REAL HALL');
  await expect(page.locator('#recap-meta')).toHaveText('Real Hall, Oct 23, 2026'); // the show's own zone, not UTC
  await expect(page.locator('#recap-photos')).toHaveText('Photos aren’t shared.');
  await expect(page).toHaveTitle('Maya’s night at Real Show — a Drop recap');
  expect(calls).toEqual([JSON.stringify({ p_id: RECAP })]);
  const text = await visibleText(page);
  for (const planted of ['Mallory', 'Fake Headliner']) expect(text).not.toContain(planted);
  await expect(page.locator('#recap-join')).toHaveAttribute('href', `https://app.trydropapp.com/?mode=signup&ref=${REF}&src=recap_share`);
});

test('recap ?r= without an allowed name never invents a person', async ({ page }) => {
  await recap(page, card({ poster_first_name: null }));
  await expect(page.locator('#recap-headline')).toHaveText('A night at Real Show');
  await expect(page.locator('#recap-join')).toHaveText('Join Drop');
});

test('recap ?r= that resolves to nothing: one "not available" state with Browse shows', async ({ page }) => {
  await recap(page, []);
  const missing = page.locator('#recap-missing');
  await expect(missing.getByRole('heading', { name:'This recap isn’t available.' })).toBeVisible();
  await expect(missing).toContainText('The link may be wrong, or the person who shared it removed it.');
  await expect(missing.getByRole('link', { name:'Browse shows' })).toHaveAttribute('href', '/events');
  await expect(page.locator('.share-recap-grid')).toBeHidden();
  await expect(page.locator('#recap-join')).toBeHidden();
});

test('recap ?r= on a server error keeps the generic card and claims nothing', async ({ page }) => {
  await recap(page, { message:'boom' }, 500);
  await expect(page.locator('#recap-headline')).toHaveText('A friend shared their Drop recap');
  await expect(page.locator('.share-wrap')).not.toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('#recap-missing')).toBeHidden();
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
