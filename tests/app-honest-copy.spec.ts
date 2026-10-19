import { expect, test, type Page } from '@playwright/test';
import { stubApp } from './helpers/fakeSupabase';

// The signed-in app must only show real data: no invented user counts and no
// boilerplate event descriptions (age limits, "new album") a provider never sent.
const date = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const base = { date, venue_name:'Mission Ballroom', city:'Denver', state:'CO', status:'published', image_url:null, event_artists:[], is_festival:false };
const EVENTS = [
  { ...base, id:'00000000-0000-4000-8000-000000000001', title:'Described Show', description:'<p style="margin:0;">Doors 8pm&nbsp;&amp; all ages</p>' },
  { ...base, id:'00000000-0000-4000-8000-000000000002', title:'Bare Show', description:null },
];

async function boot(page: Page) {
  await stubApp(page);
  await page.route('**/rest/v1/events?*', route => {
    const offset = Number(new URL(route.request().url()).searchParams.get('offset') || 0);
    route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(offset ? [] : EVENTS) });
  });
  await page.goto('/app/index.html');
}

test('signed-out hero makes no unverified user-count claim', async ({ page }) => {
  await boot(page);
  await expect(page.getByRole('heading', { name:'Never miss a drop.' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText('40,000');
  await expect(page.locator('body')).not.toContainText('ravers already on Drop');
});

test('event detail shows only the provider description, as plain text', async ({ page }) => {
  await boot(page);
  await page.getByText('Described Show').first().click();
  await expect(page.getByText('About this show')).toBeVisible();
  await expect(page.locator('.readmore__body')).toHaveText('Doors 8pm & all ages');
  await expect(page.locator('body')).not.toContainText('brings a full production');
  await expect(page.locator('body')).not.toContainText('18+ event');
});

test('event detail hides the About section when there is no description', async ({ page }) => {
  await boot(page);
  await page.getByText('Bare Show').first().click();
  await expect(page.getByRole('heading', { name:'Bare Show' }).or(page.locator('h1', { hasText:'Bare Show' })).first()).toBeVisible();
  await expect(page.getByText('About this show')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('brings a full production');
});
