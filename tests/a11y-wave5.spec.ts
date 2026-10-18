import { expect, test } from '@playwright/test';

const FAKE_SUPABASE = `
  (function () {
    function result(data) { return { data:data, error:null, count:0 }; }
    function query() {
      var promise = Promise.resolve(result([]));
      var chain = new Proxy({}, { get:function (_, key) {
        if (key === 'then') return promise.then.bind(promise);
        if (key === 'catch') return promise.catch.bind(promise);
        if (key === 'finally') return promise.finally.bind(promise);
        return function () { return chain; };
      }});
      return chain;
    }
    var client = {
      auth:{
        getSession:async function () { return { data:{ session:null }, error:null }; },
        onAuthStateChange:function () { return { data:{ subscription:{ unsubscribe:function () {} } } }; }
      },
      from:function () { return query(); },
      rpc:async function () { return result(null); }
    };
    window.supabase = { createClient:function () { return client; } };
  })();`;

test.beforeEach(async ({ page }) => {
  await page.route('**/vendor/supabase.js', route => route.fulfill({ status:200, contentType:'application/javascript', body:FAKE_SUPABASE }));
  await page.route('https://trydropapp.com/consent.js', route => route.fulfill({ status:200, contentType:'application/javascript', body:'' }));
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ status:200, contentType:'text/css', body:'' }));
  await page.route('**/rest/v1/**', route => route.fulfill({ status:200, contentType:'application/json', body:'[]' }));
});

test('city picker is a named disclosure, not an invalid listbox', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop nav chip');
  await page.goto('/events.html?city=Chicago');
  const chip = page.locator('.wn .locchip').first();
  await expect(chip).toHaveAttribute('aria-label', 'Chicago, change location');
  await expect(chip).not.toHaveAttribute('aria-haspopup', /listbox/);
  await expect(page.locator('#use-loc')).not.toHaveAttribute('aria-label', /change location/);
  await chip.click();
  await expect(chip).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.wn .loc-pop').first()).not.toHaveAttribute('role', 'listbox');
  await expect(page.locator('.wn .loc-pop').first().locator('[role="option"]')).toHaveCount(0);
  await expect(page.locator('.wn .loc-pop').first().locator('button.loc-opt').first()).toBeVisible();
});

test('grids announce loading and settle; empty states are statuses', async ({ page }) => {
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => { release = r; });
  await page.route('**/rest/v1/events?**', async route => { await gate; route.fulfill({ status:200, contentType:'application/json', body:'[]' }); });
  await page.goto('/events.html?city=Denver');
  await expect(page.locator('#grid')).toHaveAttribute('aria-busy', 'true');
  release();
  await expect(page.locator('#grid')).not.toHaveAttribute('aria-busy', /./);
  await expect(page.locator('#grid .state-empty')).toBeVisible();
  // The live result count announces the outcome; the injected empty box does not double it.
  await expect(page.locator('#result-count')).toHaveAttribute('aria-live', 'polite');
  await expect(page.locator('#grid [role="status"]')).toHaveCount(0);
});

const ROW = {
  id:'e1', title:'Test Night', date:'2099-01-01T03:00:00Z', venue_id:'v1', venue_name:'Ogden Theatre', city:'Denver', state:'CO',
  status:'published', event_artists:[{ artists:{ id:'a1', name:'Test Artist', genres:['House'] } }, { artists:{ id:'a2', name:'Other Artist', genres:['House'] } }],
};

for (const path of ['/venues.html', '/artists.html', '/artist.html?id=a1']) {
  test(`${path} grid stops being busy once results render`, async ({ page }) => {
    await page.route('**/rest/v1/events?**', route => route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify([ROW]) }));
    await page.goto(path);
    await expect(page.locator('.is-loading')).toHaveCount(0);
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  });
}

test('events filter combos expose no orphaned options', async ({ page }) => {
  await page.goto('/events.html?city=Denver');
  await page.locator('#fb-city-btn').click();
  await expect(page.locator('#fb-city-pop')).toBeVisible();
  await expect(page.locator('#fb-city-pop [role="option"], #fb-city-pop [aria-selected]')).toHaveCount(0);
  await expect(page.locator('[aria-haspopup="listbox"]')).toHaveCount(0);
  await expect(page.locator('.loc-pop[aria-label]:not([role])')).toHaveCount(0);
});

test('programmatic scrolling follows the reduced-motion preference', async ({ page }) => {
  await page.goto('/index.html');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.evaluate(() => (window as any).Drop.scrollBehavior())).toBe('auto');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  expect(await page.evaluate(() => (window as any).Drop.scrollBehavior())).toBe('smooth');
});

test('sign-in gate is a labelled modal dialog that takes focus and closes on Escape', async ({ page }) => {
  await page.goto('/app/index.html');
  // Keyboard activation (WebKit doesn't focus buttons on click, so restore targets keyboard users).
  await page.getByRole('button', { name:/Suggest an event/ }).first().focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(dialog).toHaveAccessibleName(/./);
  await expect(dialog.getByRole('button', { name:'Log in' })).toBeFocused();
  // Tab stays inside the dialog in both directions.
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
  for (let i = 0; i < 6; i++) await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // Focus returns to the control that opened the gate.
  await expect(page.getByRole('button', { name:/Suggest an event/ }).first()).toBeFocused();
});
