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

test('signup fields have names, focus, and Enter validation', async ({ page }) => {
  await page.goto('/app/index.html?mode=signup');
  await expect(page.getByRole('heading', { name:'Create your account' })).toBeVisible();
  for (const name of ['Email', 'Username', 'Creator code', 'Date of birth', 'Password']) {
    await expect(page.getByLabel(name, { exact:name !== 'Creator code' })).toBeVisible();
  }
  await expect(page.locator('#signup-dob')).toHaveAttribute('id', 'signup-dob');
  await expect.poll(() => page.locator('#signup-dob').evaluate((input: HTMLInputElement) => input.labels?.length)).toBe(1);

  await page.locator('#signup-password').focus();
  await expect.poll(() => page.locator('#signup-password').evaluate(input => getComputedStyle(input).outlineStyle)).toBe('solid');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alert')).toHaveText('Enter your email and password.');
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY');
  await page.getByLabel('Email', { exact:true }).fill('new@example.com');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByLabel('Email', { exact:true })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
});

test('public and mocked form inputs retain visible focus outlines', async ({ page }) => {
  await page.goto('/app/index.html');
  await page.getByRole('textbox', { name:'Search shows, artists, venues near you' }).click();
  const search = page.getByPlaceholder('Search artists, venues, shows, cities, genres');
  await expect(search).toBeVisible();
  await search.focus();
  await expect.poll(() => search.evaluate(input => getComputedStyle(input).outlineStyle)).toBe('solid');

  await page.evaluate(() => {
    const template = document.querySelector<HTMLTemplateElement>('#dc-template')!;
    const fixture = document.createElement('div');
    fixture.id = 'mock-form-controls';
    for (const id of ['wiz-phone', 'wiz-phone-code', 'edit-name']) {
      fixture.append(template.content.querySelector(`#${id}`)!.cloneNode(true));
    }
    document.body.append(fixture);
  });
  for (const id of ['wiz-phone', 'wiz-phone-code', 'edit-name']) {
    const input = page.locator(`#mock-form-controls #${id}`);
    await input.focus();
    await expect.poll(() => input.evaluate(node => getComputedStyle(node).outlineStyle)).toBe('solid');
    await expect.poll(() => input.evaluate(node => getComputedStyle(node).outlineWidth)).toBe('2px');
  }
});

test('mocked profile edit fields have associated labels', async ({ page }) => {
  await page.goto('/app/index.html');
  await page.evaluate(() => {
    const template = document.querySelector<HTMLTemplateElement>('#dc-template')!;
    const fixture = document.createElement('div');
    fixture.id = 'mock-profile-fields';
    for (const id of ['edit-name', 'edit-username', 'edit-bio', 'edit-city']) {
      const field = template.content.querySelector(`#${id}`)!;
      fixture.append(field.previousElementSibling!.cloneNode(true), field.cloneNode(true));
    }
    const phoneDiscovery = template.content.querySelector('#edit-city')!.nextElementSibling!;
    fixture.append(phoneDiscovery.cloneNode(true));
    document.body.append(fixture);
  });
  for (const label of ['Display name', 'Username', 'Bio · 200 max', 'City, State']) {
    await expect(page.getByLabel(label)).toBeVisible();
  }
  await expect(page.getByText('Phone discovery settings are not available on the website.')).toBeVisible();
  await expect(page.locator('#mock-profile-fields input[role="switch"]')).toHaveCount(0);
});

test('login and recovery share named fields and Enter handling', async ({ page }) => {
  await page.goto('/app/index.html?mode=login');
  await expect(page.getByLabel('Email or username')).toBeVisible();
  await expect(page.getByLabel('Password', { exact:true })).toBeVisible();
  await page.locator('#login-password').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alert')).toHaveText('Enter your email or username and password.');
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY');

  await page.getByRole('link', { name:'Forgot?' }).click();
  await expect(page.getByLabel('Email')).toBeVisible();
  await page.locator('#forgot-email').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alert')).toHaveText('Enter your account email.');
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY');

  await page.goto('/app/index.html?mode=reset-password');
  await expect(page.getByLabel('New password')).toBeVisible();
  await expect(page.getByLabel('Confirm password')).toBeVisible();
  await page.locator('#reset-password-confirm').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alert')).toHaveText('Use at least 8 characters.');
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY');
});

test('city picker moves and restores focus with keyboard', async ({ page }) => {
  await page.goto('/app/index.html');
  const toggle = page.locator('#city-toggle');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('textbox', { name:'Filter or type a city' })).toBeFocused();
  await expect.poll(() => page.locator('#city-filter').evaluate(input => getComputedStyle(input).outlineStyle)).toBe('solid');
  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toBeFocused();

  await page.keyboard.press('Enter');
  await page.locator('#city-filter').fill('Boulder, CO');
  await page.keyboard.press('Enter');
  await expect(toggle).toContainText('Boulder, CO');
  await expect(toggle).toBeFocused();
  await expect(page.locator('#city-options')).toHaveCount(0);
});
