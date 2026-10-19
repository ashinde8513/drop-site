import { expect, test } from '@playwright/test';
import { stubApp } from './helpers/fakeSupabase';

test.beforeEach(async ({ page }) => {
  await stubApp(page);
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
  await launcher.pressSequentially('deadmau5');
  await launcher.press('Enter');
  await expect(page.getByPlaceholder('Search artists, venues, shows, cities, genres')).toHaveValue('deadmau5');
});

test('icon-only app controls carry accessible names', async ({ page }) => {
  await page.goto('/app/index.html');
  await expect(page.getByRole('navigation', { name:'Primary' })).toBeAttached();
  const template = await page.locator('#dc-template').evaluate((t: HTMLTemplateElement) => t.innerHTML);
  for (const label of ['Close menu', 'Account menu', 'Save event', 'Share event', 'Remove {{ a.name }}']) {
    expect(template).toContain(`aria-label="${label}"`);
  }
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
