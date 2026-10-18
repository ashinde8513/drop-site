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

test('auth fields expose autocomplete tokens for password managers', async ({ page }) => {
  await page.goto('/app/index.html?mode=login');
  await expect(page.locator('#login-email')).toHaveAttribute('autocomplete', 'username');
  await expect(page.locator('#login-password')).toHaveAttribute('autocomplete', 'current-password');
  await page.goto('/app/index.html?mode=signup');
  await expect(page.locator('#signup-email')).toHaveAttribute('autocomplete', 'email');
  await expect(page.locator('#signup-password')).toHaveAttribute('autocomplete', 'new-password');
  await expect(page.locator('#signup-dob')).toHaveAttribute('autocomplete', 'bday');
});

test('focusing the nav search does not change screen; Enter opens search', async ({ page, isMobile }) => {
  test.skip(isMobile, 'inline nav search is desktop-only');
  await page.goto('/app/index.html');
  const launcher = page.getByRole('textbox', { name:'Search artists, venues, shows', exact:true });
  await launcher.focus();
  await expect(page.getByPlaceholder('Search artists, venues, shows, cities, genres')).toHaveCount(0);
  await launcher.press('Enter');
  await expect(page.getByPlaceholder('Search artists, venues, shows, cities, genres')).toBeVisible();
});

test('mobile drawer moves focus in and Escape returns it to the menu button', async ({ page }) => {
  await page.setViewportSize({ width:390, height:844 });
  await page.goto('/index.html');
  const burger = page.locator('[data-nav-menu]');
  await burger.click();
  await expect(burger).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#nav-drawer')).toBeVisible();
  expect(await page.evaluate(() => !!document.activeElement?.closest('#nav-drawer'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('#nav-drawer')).toBeHidden();
  await expect(burger).toBeFocused();
});
