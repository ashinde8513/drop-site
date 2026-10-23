import { expect, test, type Page } from '@playwright/test';
import { bootSignedIn, fakeCalls, USER_ID } from './helpers/fakeSession';

const EV_ID = '9bd6c283-051a-42d5-a1a6-b01ba64266a4';
const PAST_ID = '7c1f1e8e-2b44-4d6a-9a51-3f7b0f2a9c11';
const day = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const EVENT = { id:EV_ID, title:'Parity Three Night', date:day(5), venue_name:'Mission Ballroom', city:'Denver', state:'CO', status:'published', image_url:null, event_artists:[], is_festival:false, ticket_url:'https://www.axs.com/e', price_min:40, price_max:60 };
const pastRow = (status: string, id = PAST_ID, title = 'Past Night') => ({ user_id:USER_ID, status, created_at:'2026-01-01T00:00:00Z', events:{ id, title, date:day(-30), venue_name:'Ogden', city:'Denver', ticket_url:null, time_tbd:false, is_festival:false, event_artists:[] } });

const open = async (page: Page) => { await page.goto('/app/index.html'); await expect(page.getByText('Parity Three Night').first()).toBeVisible(); };
const nav = async (page: Page, isMobile: boolean, item: string) => {
  if (isMobile) { await page.getByRole('button', { name:'Menu' }).click(); await page.locator('.mnav__panel').getByRole('button', { name:new RegExp(item) }).click(); }
  else { await page.getByRole('button', { name:'Account menu' }).click(); await page.getByLabel('Primary').getByRole('button', { name:item, exact:true }).click(); }
};
const profileItem = async (page: Page, isMobile: boolean, item: string | RegExp) => { await nav(page, isMobile, 'Profile'); await page.getByRole('button', { name:item }).first().click(); };
const pastTab = async (page: Page, isMobile: boolean) => { await nav(page, isMobile, 'My Shows'); await page.locator('.seg__item', { hasText:'Past' }).click(); };
const writes = async (page: Page, table: string, op: string) => (await fakeCalls(page, 'from')).filter((c: any) => c.table === table && c.ops[0][0] === op).map((c: any) => c.ops);

test.describe('1 show ratings persist', () => {
  test('loads own ratings (half stars shown) and rating writes show_ratings', async ({ page, isMobile }) => {
    const OTHER = '5d0b8c1e-6a7f-4e3b-8f20-1c2d3e4f5a6b';
    await bootSignedIn(page, { rows:{ attendance:[pastRow('attended'), pastRow('attended', OTHER, 'Rated Night')], show_ratings:[{ user_id:USER_ID, event_id:OTHER, rating:7, notes:null, is_public:false, is_anonymous:false }] } }, [EVENT]);
    await open(page);
    const load = (await fakeCalls(page, 'from')).find((c: any) => c.table === 'show_ratings');
    expect(load.ops).toEqual([['select', ['event_id,rating,notes,is_public,is_anonymous']], ['eq', ['user_id', USER_ID]]]);
    await pastTab(page, isMobile);
    await expect(page.getByText('You rated 3.5★')).toBeVisible();
    await page.getByRole('button', { name:'Rate 4 stars' }).first().click();
    await expect.poll(() => writes(page, 'show_ratings', 'upsert')).toHaveLength(1);
    const [[, [row, opts]]] = (await writes(page, 'show_ratings', 'upsert'))[0];
    expect(opts).toEqual({ onConflict:'user_id,event_id' });
    expect({ ...row, updated_at:undefined }).toEqual({ user_id:USER_ID, event_id:PAST_ID, rating:8, is_public:false, is_anonymous:false, updated_at:undefined });
    await expect(page.getByText('You rated 4★')).toBeVisible();
  });

  test('keeps a public review public; failed write rolls back and flashes', async ({ page, isMobile }) => {
    await bootSignedIn(page, { rows:{ attendance:[pastRow('attended')], show_ratings:[{ user_id:USER_ID, event_id:PAST_ID, rating:6, notes:'Great night', is_public:true, is_anonymous:false }] }, errors:{ 'show_ratings.upsert':'denied' } }, [EVENT]);
    await open(page);
    await pastTab(page, isMobile);
    await page.getByRole('button', { name:'Rate 5 stars' }).click();
    await expect(page.getByText('Could not save your rating — try again')).toBeVisible();
    expect((await writes(page, 'show_ratings', 'upsert'))[0][0][1][0].is_public).toBe(true);
    await expect(page.getByText('You rated 3★')).toBeVisible();
  });

  test('past "going" row asks to mark attended first, then updates attendance', async ({ page, isMobile }) => {
    await bootSignedIn(page, { rows:{ attendance:[pastRow('going')] } }, [EVENT]);
    await open(page);
    await pastTab(page, isMobile);
    await expect(page.getByRole('button', { name:/^Rate / })).toHaveCount(0);
    await page.getByRole('button', { name:'I went' }).click();
    await expect.poll(() => writes(page, 'attendance', 'update')).toEqual([[['update', [{ status:'attended' }]], ['eq', ['user_id', USER_ID]], ['eq', ['event_id', PAST_ID]], ['eq', ['status', 'going']], ['select', ['event_id']]]]);
  });
});

test.describe('2 blocked accounts (type B)', () => {
  const settings = async (page: Page, isMobile: boolean) => { await nav(page, isMobile, 'Settings'); await page.getByRole('button', { name:/Blocked accounts/ }).click(); };
  test('lists blocks from the RPC and unblock deletes own row', async ({ page, isMobile }) => {
    await bootSignedIn(page, { rpc:{ list_my_blocked_profiles:[{ id:'b1', username:'noisy', display_name:'Noisy Person', profile_image:null }] } }, [EVENT]);
    await open(page);
    await settings(page, isMobile);
    await expect(page.getByText('Noisy Person')).toBeVisible();
    await expect(page.getByText('@noisy')).toBeVisible();
    await page.getByRole('button', { name:'Unblock' }).click();
    await expect.poll(() => writes(page, 'user_blocks', 'delete')).toEqual([[['delete', []], ['eq', ['blocker_id', USER_ID]], ['eq', ['blocked_id', 'b1']]]]);
    await expect(page.getByRole('heading', { name:"You haven't blocked anyone" })).toBeVisible();
  });

  test('error frame with retry; never shown as empty', async ({ page, isMobile }) => {
    await bootSignedIn(page, { errors:{ 'rpc.list_my_blocked_profiles':'boom' } }, [EVENT]);
    await open(page);
    await settings(page, isMobile);
    await expect(page.getByRole('alert').filter({ hasText:"We couldn't load this" })).toBeVisible();
    await expect(page.getByText("You haven't blocked anyone")).toHaveCount(0);
    await page.evaluate(() => { delete (window as any).__cfg.errors; });
    await page.getByRole('button', { name:'Try again' }).click();
    await expect(page.getByRole('heading', { name:"You haven't blocked anyone" })).toBeVisible();
  });
});

test.describe('3 spec 02 honest app-only states', () => {
  test('plans tab, tagged, wallet say the feature lives in the app with one primary button', async ({ page, isMobile }) => {
    await bootSignedIn(page, {}, [EVENT]);
    await open(page);
    await nav(page, isMobile, 'Crew');
    await page.locator('.seg__item', { hasText:'Plans' }).click();
    await expect(page.getByRole('heading', { name:'Plans live in the app' })).toBeVisible();
    await expect(page.getByRole('link', { name:'Browse shows' })).toBeVisible();
    for (const [item, title] of [[/Tagged in shows/, 'Tags are handled in the app'], [/Drop\+ wallet/, 'Cashback shows up in the app']] as const) {
      await profileItem(page, isMobile, item);
      const box = page.locator('.empty--wide', { has:page.getByRole('heading', { name:title }) });
      await expect(box).toBeVisible();
      await expect(box.locator('.btn--primary')).toHaveText('Get the Drop app');
      await expect(box.locator('svg')).toHaveAttribute('aria-hidden', 'true');
    }
  });

  test('get the app page has no fake QR', async ({ page }) => {
    await bootSignedIn(page, { signedOut:true }, [EVENT]);
    await open(page);
    await page.getByRole('link', { name:'Get the app', exact:true }).last().click();
    await expect(page.getByRole('heading', { name:'Drop in your pocket' })).toBeVisible();
    await expect(page.locator('body')).not.toContainText('drop.fm/app');
    await expect(page.locator('body')).not.toContainText('Scan to install');
  });
});

test('4 spec 06 Drop+ plan cards: radio semantics, explicit colors, every text pair ≥ 4.5:1', async ({ page }) => {
  await bootSignedIn(page, { signedOut:true }, [EVENT]);
  await open(page);
  await page.getByRole('link', { name:'Drop+', exact:true }).click();
  const group = page.getByRole('radiogroup', { name:'Choose a plan' });
  await expect(group.getByRole('radio')).toHaveCount(2);
  await group.getByRole('radio', { name:/Monthly/ }).click();
  await expect(group.getByRole('radio', { name:/Monthly/ })).toHaveAttribute('aria-checked', 'true');
  await expect(group.getByRole('radio', { name:/Annual/ })).toHaveAttribute('aria-checked', 'false');
  await expect(group.getByRole('radio', { name:/Monthly/ })).toHaveAttribute('tabindex', '0');
  await group.getByRole('radio', { name:/Monthly/ }).press('ArrowUp');
  await expect(group.getByRole('radio', { name:/Annual/ })).toHaveAttribute('aria-checked', 'true');
  await expect(group.getByRole('radio', { name:/Annual/ })).toBeFocused();
  // WCAG 2.x ratio of each card's title/caption against the card's own (now opaque) fill.
  const ratios = await group.getByRole('radio').evaluateAll(cards => {
    const lum = (c: string) => { const [r, g, b] = c.match(/\d+(\.\d+)?/g)!.slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    return cards.flatMap(card => { const bg = getComputedStyle(card).backgroundColor; return [...card.querySelectorAll('div > div')].map(t => ratio(getComputedStyle(t).color, bg)); });
  });
  expect(ratios).toHaveLength(4);
  for (const r of ratios) expect(r).toBeGreaterThanOrEqual(4.5);
});
