import { expect, test, type Page } from '@playwright/test';
import { bootSignedIn, fakeCalls, USER_ID } from './helpers/fakeSession';

// Design spec 05 (recap composer) — gate, empty, photos, reorder/remove, rating,
// file error, render error, save, phone bar. Photos never leave the browser (A52).
const EV_ID = '7d3f0c2e-5b1a-4c8e-9f2d-3a6b8c1d0e4f';
const past = new Date(Date.now() - 3 * 86400000).toISOString();
const SHOW = { id:EV_ID, title:'Recap Test Night', date:past, venue_name:'Mission Ballroom', city:'Denver', ticket_url:null, time_tbd:false, is_festival:false, event_artists:[] };
const row = (status: string) => ({ user_id:USER_ID, event_id:EV_ID, status, created_at:past, events:SHOW });
const UPCOMING = { id:'9bd6c283-051a-42d5-a1a6-b01ba64266a4', title:'Upcoming Night', date:new Date(Date.now() + 5 * 86400000).toISOString(), venue_name:'Ogden', city:'Denver', state:'CO', status:'published', event_artists:[] };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const png = (name: string) => ({ name, mimeType:'image/png', buffer:PNG });

async function openRecap(page: Page, isMobile: boolean, status = 'going', cfg: Record<string, unknown> = {}) {
  await bootSignedIn(page, { rows:{ attendance:[row(status)] }, ...cfg }, [UPCOMING]);
  await page.goto('/app/index.html');
  await expect(page.getByText('Upcoming Night').first()).toBeVisible();
  if (isMobile) { await page.getByRole('button', { name:'Menu' }).click(); await page.locator('.mnav__panel').getByRole('button', { name:/My Shows/ }).click(); }
  else { await page.getByRole('button', { name:'Account menu' }).click(); await page.getByLabel('Primary').getByRole('button', { name:'My Shows', exact:true }).click(); }
  await page.locator('.seg__item', { hasText:'Past' }).click();
  await page.getByRole('button', { name:'Make a recap' }).click();
}
const primary = (page: Page) => page.locator('.rc-primary');

test('gate: shown when attendance is not recorded; saving is busy; then the composer opens', async ({ page, isMobile }) => {
  await openRecap(page, isMobile);
  await expect(page.getByRole('heading', { name:'Were you there?' })).toBeVisible();
  await expect(page.getByText('Recap Test Night · Mission Ballroom')).toBeVisible();
  await expect(page.getByText('Confirm you attended to build a recap. Recaps are only for shows you were at.')).toBeVisible();
  await expect(page.locator('main .btn--primary:visible')).toHaveCount(1);
  await page.evaluate(() => { (window as any).__cfg.hold = ['attendance']; });
  await page.getByRole('button', { name:'Yes, I was there' }).click();
  await expect(page.getByRole('button', { name:'Saving…' })).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByRole('button', { name:'Not this one' })).toBeEnabled();
  await page.evaluate(() => (window as any).__fake.release());
  await expect(page.getByRole('heading', { name:'Build your recap' })).toBeVisible();
  const ups = (await fakeCalls(page, 'from')).filter((c: any) => c.table === 'attendance' && c.ops[0][0] === 'upsert');
  expect(ups[0].ops).toEqual([['upsert', [{ user_id:USER_ID, event_id:EV_ID, status:'attended' }, { onConflict:'user_id,event_id' }]]]);
});

test('gate: a failed save shows the inline alert and "Not this one" still works', async ({ page, isMobile }) => {
  await openRecap(page, isMobile, 'going', { errors:{ 'attendance.upsert':'denied' } });
  await page.getByRole('button', { name:'Yes, I was there' }).click();
  await expect(page.getByRole('alert')).toHaveText('Could not save. Try again.');
  await expect(page.getByRole('heading', { name:'Were you there?' })).toBeVisible();
  await page.getByRole('button', { name:'Not this one' }).click();
  await expect(page.getByRole('heading', { name:'Memories' })).toBeVisible();
});

test('attended shows skip the gate; empty composer: four Add photo slots, disabled share, honest card', async ({ page, isMobile }) => {
  await openRecap(page, isMobile, 'attended');
  await expect(page.getByRole('heading', { name:'Build your recap' })).toBeVisible();
  await expect(page.getByText('0 of 4 added')).toBeVisible();
  for (const n of [1, 2, 3, 4]) await expect(page.getByRole('button', { name:'Add photo ' + n })).toBeVisible();
  await expect(page.getByText('Photos stay on your device.')).toBeVisible();
  await expect(page.getByText('Add up to 4 photos')).toBeVisible();
  await expect(page.getByRole('img', { name:/^Recap card: Recap Test Night, Mission Ballroom, .*, 0 photos\.$/ })).toBeVisible();
  await expect(primary(page)).toHaveAttribute('aria-disabled', 'true');
  await expect(primary(page)).toHaveAccessibleDescription('Add at least 1 photo to share.');
  await expect(page.getByText('Not rated')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/odesza|red rocks|maya/i);
});

test('photos: added, counted, reordered with Move buttons, removed; the card follows', async ({ page, isMobile }) => {
  await openRecap(page, isMobile, 'attended');
  await page.locator('#rc-file').setInputFiles([png('a.png'), png('b.png'), png('c.png')]);
  await expect(page.getByText('3 of 4 added')).toBeVisible();
  await expect(page.locator('.rc-card__grid--3 .rc-card__cell')).toHaveCount(3);
  await expect(page.getByRole('img', { name:/, 3 photos\.$/ })).toBeVisible();
  await expect(page.getByLabel('Describe photo 3 (optional)')).toBeVisible();
  const srcs = () => page.locator('.rc-tile__img').evaluateAll(els => els.map(e => (e as HTMLImageElement).src));
  const before = await srcs();
  await page.getByRole('button', { name:'Move photo 1 right' }).click();
  expect(await srcs()).toEqual([before[1], before[0], before[2]]);
  await expect(page.getByRole('button', { name:'Move photo 1 left' })).toBeDisabled();
  await page.getByRole('button', { name:'Remove photo 2' }).click();
  await expect(page.getByText('2 of 4 added')).toBeVisible();
  await expect(page.locator('.rc-card__grid--2 .rc-card__cell')).toHaveCount(2);
  await expect(primary(page)).not.toHaveAttribute('aria-disabled', 'true');
  await expect(primary(page)).toHaveAccessibleDescription('Saves as a 1080 × 1920 PNG.');
  // A fifth photo never fits.
  await page.locator('#rc-file').setInputFiles([png('d.png'), png('e.png'), png('f.png')]);
  await expect(page.getByText('4 of 4 added')).toBeVisible();
});

test('bad file: inline alert under the grid with the board copy', async ({ page, isMobile }) => {
  await openRecap(page, isMobile, 'attended');
  await page.locator('#rc-file').setInputFiles([{ name:'notes.txt', mimeType:'text/plain', buffer:Buffer.from('hi') }]);
  await expect(page.getByRole('alert')).toHaveText("That file didn't work. Use a JPG, PNG, or HEIC photo under 10 MB.");
  await expect(page.getByText('0 of 4 added')).toBeVisible();
});

test('rating: optional radio group, arrows move it, Clear rating empties it; stars appear on the card', async ({ page, isMobile }) => {
  await openRecap(page, isMobile, 'attended');
  const group = page.getByRole('radiogroup', { name:'Your rating (optional)' });
  await expect(group.getByRole('radio')).toHaveCount(5);
  await group.getByRole('radio', { name:'4 stars' }).click();
  await expect(group.getByRole('radio', { name:'4 stars' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('4 of 5')).toBeVisible();
  await expect(page.locator('.rc-card__stars')).toHaveText('★★★★☆');
  await page.keyboard.press('ArrowRight');
  await expect(group.getByRole('radio', { name:'5 stars' })).toBeFocused();
  await expect(page.getByText('5 of 5')).toBeVisible();
  await page.getByRole('button', { name:'Clear rating' }).click();
  await expect(page.getByText('Not rated')).toBeVisible();
  await expect(page.locator('.rc-card__stars')).toHaveCount(0);
});

test('save: renders a 1080×1920 PNG in the browser, toasts "Card saved.", records the recap; nothing uploads', async ({ page, isMobile, browserName }) => {
  test.skip(isMobile, 'downloads checked on desktop');
  const uploads: string[] = [];
  page.on('request', r => { if (r.method() !== 'GET' && /storage|upload/i.test(r.url())) uploads.push(r.url()); });
  await openRecap(page, isMobile, 'attended');
  await page.locator('#rc-file').setInputFiles([png('a.png'), png('b.png')]);
  await expect(page.getByText('2 of 4 added')).toBeVisible();
  const save = page.locator('.rc-actions').getByRole('button', { name:'Save image' }).first();
  const [download] = await Promise.all([page.waitForEvent('download'), save.click()]);
  expect(download.suggestedFilename()).toBe('drop-recap-recap-test-night.png');
  const buf = await download.createReadStream().then(s => new Promise<Buffer>((res) => { const parts: Buffer[] = []; s.on('data', c => parts.push(c as Buffer)); s.on('end', () => res(Buffer.concat(parts))); }));
  expect(buf.readUInt32BE(16)).toBe(1080);
  expect(buf.readUInt32BE(20)).toBe(1920);
  await expect(page.getByText('Card saved.')).toBeVisible();
  await expect.poll(async () => (await fakeCalls(page, 'from')).filter((c: any) => c.table === 'recap_posts').map((c: any) => c.ops))
    .toEqual([[['upsert', [{ user_id:USER_ID, event_id:EV_ID }, { onConflict:'user_id,event_id' }]]]]);
  expect(uploads).toEqual([]);
  void browserName;
});

test('render failure: inline alert under the buttons; nothing recorded', async ({ page, isMobile }) => {
  await page.addInitScript(() => { HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) { cb(null); }; });
  await openRecap(page, isMobile, 'attended');
  await page.locator('#rc-file').setInputFiles([png('a.png')]);
  await expect(page.getByText('1 of 4 added')).toBeVisible();
  await primary(page).click();
  await expect(page.getByRole('alert')).toHaveText("We couldn't make your card. Try again.");
  expect((await fakeCalls(page, 'from')).filter((c: any) => c.table === 'recap_posts')).toEqual([]);
});

test('phone: the one primary sits in a bottom bar (thumb zone)', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone layout');
  await openRecap(page, isMobile, 'attended');
  await page.locator('#rc-file').setInputFiles([png('a.png')]);
  await expect(page.getByText('1 of 4 added')).toBeVisible();
  await expect(primary(page)).toBeVisible();
  const box = (await primary(page).boundingBox())!;
  const vh = page.viewportSize()!.height;
  expect(box.y).toBeGreaterThan(vh * 0.6);
  expect(box.y + box.height).toBeLessThanOrEqual(vh);
  expect(box.height).toBeGreaterThanOrEqual(44);
  await expect(page.locator('main .btn--primary:visible')).toHaveCount(1);
});
