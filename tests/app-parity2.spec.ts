import { expect, test, type Page } from '@playwright/test';
import { bootSignedIn, fakeCalls, USER_ID } from './helpers/fakeSession';

const EV_ID = '9bd6c283-051a-42d5-a1a6-b01ba64266a4';
const day = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const EVENT = { id:EV_ID, title:'Parity Two Night', date:day(5), venue_name:'Mission Ballroom', city:'Denver', state:'CO', status:'published', image_url:null, event_artists:[], is_festival:false, ticket_url:'https://www.axs.com/fallback', price_min:40, price_max:60 };

const open = async (page: Page, title = 'Parity Two Night') => { await page.goto('/app/index.html'); await expect(page.getByText(title).first()).toBeVisible(); };
const nav = async (page: Page, isMobile: boolean, item: string) => {
  if (isMobile) { await page.getByRole('button', { name:'Menu' }).click(); await page.locator('.mnav__panel').getByRole('button', { name:new RegExp(item) }).click(); }
  else { await page.getByRole('button', { name:'Account menu' }).click(); await page.getByRole('button', { name:item, exact:true }).click(); }
};
const profileItem = async (page: Page, isMobile: boolean, item: string | RegExp) => { await nav(page, isMobile, 'Profile'); await page.getByRole('button', { name:item }).first().click(); };
const footer = (page: Page, link: string) => page.getByRole('link', { name:link, exact:true }).click();

// 1 all ticket sellers: moved to app-tickets.spec.ts (design spec 01).

test.describe('2 notifications inbox', () => {
  const ALERTS = [
    { id:'a1', user_id:USER_ID, kind:'friend', title:'New friend', body:'Sam added you', read:false, created_at:new Date().toISOString() },
    { id:'a2', user_id:USER_ID, kind:'reminder', title:'Tonight', body:'Doors at 8', read:true, created_at:new Date().toISOString() },
    { id:'a3', user_id:USER_ID, kind:'sale', title:'On sale', body:'Tickets live', read:true, created_at:new Date().toISOString() },
  ];
  test('loads own alerts, badge, tap marks read', async ({ page, isMobile }) => {
    await bootSignedIn(page, { rows:{ alerts:ALERTS } }, [EVENT]);
    await open(page);
    const load = (await fakeCalls(page, 'from')).find((c: any) => c.table === 'alerts');
    expect(load.ops.map((o: any) => o[0])).toEqual(['select', 'eq', 'order', 'limit']);
    expect(load.ops[1]).toEqual(['eq', ['user_id', USER_ID]]);
    expect(load.ops[2]).toEqual(['order', ['created_at', { ascending:false }]]);
    expect(load.ops[3]).toEqual(['limit', [50]]);
    await expect(page.locator('.wn__badge')).toHaveCount(1);
    await nav(page, isMobile, 'Notifications');
    await expect(page.getByText('Sam added you')).toBeVisible();
    await expect(page.getByText('Doors at 8')).toBeVisible();
    await expect(page.getByText('Tickets live')).toBeVisible();
    await page.getByText('Sam added you').click();
    await expect.poll(async () => (await fakeCalls(page, 'from')).filter((c: any) => c.table === 'alerts' && c.ops[0][0] === 'update').map((c: any) => c.ops))
      .toEqual([[['update', [{ read:true }]], ['eq', ['id', 'a1']]]]);
    await expect(page.locator('.wn__badge')).toHaveCount(0);
  });

  test('failed update rolls back and flashes; sign-out clears', async ({ page, isMobile }) => {
    await bootSignedIn(page, { rows:{ alerts:ALERTS }, errors:{ 'alerts.update':'denied' } }, [EVENT]);
    await open(page);
    await nav(page, isMobile, 'Notifications');
    await page.getByText('Sam added you').click();
    await expect(page.getByText('Could not update notifications — try again')).toBeVisible();
    await expect(page.locator('.wn__badge')).toHaveCount(1);
    await page.evaluate(() => (window as any).__fake.emit('SIGNED_OUT'));
    await expect(page.locator('body')).not.toContainText('Sam added you');
  });
});

test('3 seen history groups logged shows by year, newest first', async ({ page, isMobile }) => {
  const logged = [
    { user_id:USER_ID, artist_name:'Older Act', venue_name:'Old Hall', city:'Austin', show_date:'2023-05-01' },
    { user_id:USER_ID, artist_name:'Newer Act', venue_name:'New Hall', city:'Denver', show_date:'2025-06-02' },
  ];
  await bootSignedIn(page, { rows:{ logged_shows:logged } }, [EVENT]);
  await open(page);
  await profileItem(page, isMobile, /Shows you.ve seen/);
  await expect(page.getByText('Newer Act')).toBeVisible();
  await expect(page.getByText('Older Act')).toBeVisible();
  await expect(page.getByText('No shows logged yet')).toHaveCount(0);
  const years = await page.locator('div', { hasText:/^(2023|2025)$/ }).allTextContents();
  expect(years).toEqual(['2025', '2023']);
});

test.describe('4 honest copy', () => {
  test('no ODESZA/Maya on share, wrapped-share, referral; Drop+ CTA disabled; no free-month promise', async ({ page }) => {
    await bootSignedIn(page, { signedOut:true }, [EVENT]);
    await open(page);
    for (const link of ['Shared recap', 'Shared Wrapped', 'Referral']) {
      await footer(page, link);
      await expect(page.locator('main')).toBeVisible();
      await expect(page.locator('body')).not.toContainText(/odesza|maya|red rocks/i);
      await expect(page.locator('body')).not.toContainText(/free (month|week)/i);
      await page.goto('/app/index.html'); await expect(page.getByText('Parity Two Night').first()).toBeVisible();
    }
    await footer(page, 'Drop+');
    const cta = page.getByRole('button', { name:'Coming soon' });
    await expect(cta).toBeDisabled();
    await expect(page.locator('body')).not.toContainText('$59.99');
    await expect(page.locator('body')).not.toContainText('$7.49');
    await expect(page.getByText('Drop+ isn\'t available yet').first()).toBeVisible();
  });

  test('signed-in: scout/invite/recap builder carry no mock names or free-month promise', async ({ page, isMobile }) => {
    await bootSignedIn(page, {}, [EVENT]);
    await open(page);
    await footer(page, 'Suggest an event');
    await expect(page.getByText('Approved shows count toward your scout badge')).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/free month/i);
    await page.goto('/app/index.html'); await expect(page.getByText('Parity Two Night').first()).toBeVisible();
    await nav(page, isMobile, 'Crew');
    await page.getByRole('button', { name:/Invite friends/ }).click();
    await expect(page.locator('body')).not.toContainText(/free month|odesza|maya/i);
    await page.goto('/app/index.html'); await expect(page.getByText('Parity Two Night').first()).toBeVisible();
    await profileItem(page, isMobile, /Memories/);
    await page.getByRole('button', { name:'Create recap' }).click();
    await page.getByRole('button', { name:'Yes, I was there' }).click();
    await expect(page.getByText('Log a show to fill this card')).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/odesza|red rocks/i);
  });
});
