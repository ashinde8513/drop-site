import { expect, test } from '@playwright/test';

// Read-only signed-in check against production (APPROVALS W28). Runs only in the
// live-signed-in workflow, which supplies the fixture login from the live-fixture
// environment. Clicks nothing that writes; seed data comes from ops/live-fixture-seed.sql.
const email = process.env.DROP_FIXTURE_EMAIL, password = process.env.DROP_FIXTURE_PASSWORD;
test.skip(!email || !password, 'fixture credentials not provided');

const menu = async (page, item: string) => {
  await page.getByRole('button', { name:'Account menu' }).click();
  await page.getByRole('button', { name:item, exact:true }).click();
};

test('fixture account: inbox, seen history, rating, blocked accounts', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?mode=login');
  await page.locator('#login-email').fill(email!);
  await page.locator('#login-password').fill(password!);
  await page.locator('#login-submit').click();
  await expect(page.getByRole('button', { name:'Account menu' })).toBeVisible({ timeout:20_000 });

  await expect(page.locator('.wn__badge')).toHaveCount(1);
  await menu(page, 'Notifications');
  await expect(page.getByText('Live check unread alert')).toBeVisible();
  await expect(page.getByText('Live check read alert')).toBeVisible();

  await menu(page, 'Profile');
  await page.getByRole('button', { name:/Shows you.ve seen/ }).first().click();
  await expect(page.getByText('Fixture Act 2025')).toBeVisible();
  const years = await page.locator('div', { hasText:/^(2024|2025)$/ }).allTextContents();
  expect(years.slice(0, 2)).toEqual(['2025', '2024']);

  await menu(page, 'My Shows');
  await page.locator('.seg__item', { hasText:'Past' }).click();
  await expect(page.getByText('You rated 4★')).toBeVisible();

  await menu(page, 'Settings');
  await page.getByRole('button', { name:/Blocked accounts/ }).click();
  await expect(page.getByText('Alex R.')).toBeVisible();

  expect(errors).toEqual([]);
});
