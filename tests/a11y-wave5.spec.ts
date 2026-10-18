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
  await expect(page.locator('#grid [role="status"]')).toBeVisible();
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
  await page.getByRole('button', { name:/Suggest an event/ }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(dialog).toHaveAccessibleName(/./);
  await expect(dialog.getByRole('button', { name:'Log in' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
