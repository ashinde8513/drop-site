import { expect, test, type Page } from '@playwright/test';

const APP = '/app/next';
const SUPABASE = 'https://ebccwnkmsnhbljxxxdej.supabase.co';
const STORAGE_KEY = 'sb-ebccwnkmsnhbljxxxdej-auth-token';
type MockOptions = {
  compliance?: boolean | 'error' | 'hang';
  loginError?: boolean;
  logoutFailure?: boolean;
  usernameAvailable?: boolean;
};

const user = {
  id: '00000000-0000-4000-8000-000000000001',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'web-parity@example.com',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { username: 'webparity' },
  identities: [],
  created_at: '2026-01-01T00:00:00.000Z',
};

const profile = {
  id: user.id,
  username: 'webparity',
  display_name: 'Web Parity',
  profile_image: null,
  bio: null,
  city: 'Denver',
  state: 'CO',
  role: 'fan',
  is_admin: false,
  is_plus: false,
  onboarding_complete: true,
  contacts_discoverable: true,
  show_age: false,
  show_history_public: true,
  recap_includable: true,
};

async function mockSupabase(page: Page, authenticated = false, options: MockOptions = {}) {
  const mockedWrites: string[] = [];
  const session = {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user,
  };

  await page.addInitScript(({ key, value }) => {
    localStorage.setItem('drop.cookie-consent', 'essential');
    if (value) localStorage.setItem(key, JSON.stringify(value));
    else localStorage.removeItem(key);
  }, { key: STORAGE_KEY, value: authenticated ? session : null });

  await page.route(`${SUPABASE}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) mockedWrites.push(`${method} ${url.pathname}`);

    if (method === 'OPTIONS') return route.fulfill({ status: 204 });
    if (url.pathname === '/auth/v1/user') {
      return route.fulfill({
        status: authenticated ? 200 : 401,
        contentType: 'application/json',
        body: JSON.stringify(authenticated ? user : { message: 'mock signed-out session' }),
      });
    }
    if (url.pathname === '/auth/v1/token') {
      if (options.loginError) {
        return route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"invalid_grant","error_description":"Invalid login credentials"}' });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) });
    }
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: options.logoutFailure ? 500 : 204, contentType: 'application/json', body: options.logoutFailure ? '{"message":"mock logout failure"}' : '' });
    if (url.pathname === '/functions/v1/delete-account') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    }
    if (url.pathname === '/rest/v1/rpc/signup_compliance_status') {
      if (options.compliance === 'hang') return new Promise(() => {});
      if (options.compliance === 'error') return route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"mock unavailable"}' });
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user_id: user.id, complete: options.compliance !== false }),
      });
    }
    if (url.pathname === '/rest/v1/rpc/username_available') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(options.usernameAvailable !== false) });
    }
    if (url.pathname === '/rest/v1/profiles') {
      return route.fulfill({
        status: 200,
        headers: { 'content-range': '0-0/1' },
        contentType: 'application/json',
        body: JSON.stringify([profile]),
      });
    }

    // Foundation tests need honest empty states, not invented feature rows.
    if (url.pathname.startsWith('/rest/v1/')) {
      return route.fulfill({
        status: 200,
        headers: { 'content-range': '*/0' },
        contentType: 'application/json',
        body: '[]',
      });
    }
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });

  return mockedWrites;
}

test.describe('React parity preview foundation', () => {
  test('desktop keeps the Prism website header and accessible auth routes', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockSupabase(page);
    await page.goto(`${APP}/`);

    const header = page.getByRole('banner');
    await expect(header).toBeVisible();
    await expect(header.getByRole('link', { name: /drop home/i })).toBeVisible();
    await expect(header.getByRole('link', { name: /log in/i })).toBeVisible();

    await header.getByRole('link', { name: /log in/i }).click();
    await expect(page).toHaveURL(new RegExp(`${APP}/login/?$`));
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    await expect(page.getByLabel(/email or username/i)).toHaveAttribute('autocomplete', 'username');
    await expect(page.getByLabel(/email or username/i)).not.toHaveAttribute('type', 'email');
    await expect(page.locator('#login-password')).toHaveAttribute('type', 'password');
    await expect(page.getByRole('button', { name: /log in/i })).toBeEnabled();

    await page.getByRole('navigation', { name: /account access/i })
      .getByRole('link', { name: /create account/i }).click();
    await expect(page).toHaveURL(new RegExp(`${APP}/signup/?$`));
    await expect(page.getByRole('heading', { name: /create.*account|sign up/i })).toBeVisible();
    await expect(page.getByLabel(/username/i)).toBeVisible();
    await expect(page.getByLabel(/email/i)).toHaveAttribute('type', 'email');
    await expect(page.locator('#signup-password')).toHaveAttribute('type', 'password');
  });

  test('authenticated desktop uses side navigation, not mobile navigation', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockSupabase(page, true);
    await page.goto(`${APP}/`);

    const primary = page.getByRole('navigation', { name: /^primary$/i });
    await expect(primary).toBeVisible();
    await expect(primary.getByRole('link', { name: /discover/i })).toBeVisible();
    await expect(primary.getByRole('link', { name: /settings/i })).toBeVisible();
    await expect(page.getByRole('navigation', { name: /mobile navigation/i })).toBeHidden();
  });

  test('authenticated mobile uses bottom navigation without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockSupabase(page, true);
    await page.goto(`${APP}/`);

    const mobile = page.getByRole('navigation', { name: /mobile navigation/i });
    await expect(mobile).toBeVisible();
    await expect(mobile.getByRole('link', { name: /discover/i })).toBeVisible();
    await expect(page.getByRole('navigation', { name: /^primary$/i })).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });

  test('auth errors stay on the form and taken usernames never create an account', async ({ page }) => {
    await mockSupabase(page, false, { loginError: true, usernameAvailable: false });
    await page.goto(`${APP}/`);
    await page.getByLabel(/email or username/i).fill('taken@example.com');
    await page.locator('#login-password').fill('correct-length-password');
    await page.getByRole('button', { name: /^log in$/i }).click();
    await expect(page.getByRole('alert')).toContainText(/invalid login credentials/i);
    await expect(page).toHaveURL(new RegExp(`${APP}/login/?$`));

    await page.getByRole('navigation', { name: /account access/i }).getByRole('link', { name: /create account/i }).click();
    await page.getByLabel(/^username$/i).fill('alreadytaken');
    await page.getByLabel(/^email$/i).fill('new@example.com');
    await page.locator('#signup-password').fill('correct-length-password');
    await page.getByLabel(/date of birth/i).fill('2000-01-01');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: /^create account$/i }).click();
    await expect(page.getByRole('alert')).toContainText(/username is taken/i);
  });

  test('incomplete or unavailable compliance fails closed with account deletion still available', async ({ page }) => {
    await mockSupabase(page, true, { compliance: false });
    await page.goto(`${APP}/`);
    await expect(page).toHaveURL(new RegExp(`${APP}/complete-profile/?$`));
    await expect(page.getByRole('heading', { name: /finish account setup/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^delete account$/i })).toBeVisible();
  });

  test('a hung compliance check times out to the fail-closed setup route', async ({ page }) => {
    await page.clock.install();
    await mockSupabase(page, true, { compliance: 'hang' });
    const complianceStarted = page.waitForRequest((request) => request.url().includes('/rpc/signup_compliance_status'));
    await page.goto(`${APP}/`);
    await complianceStarted;
    await page.clock.fastForward(10_050);
    await expect(page).toHaveURL(new RegExp(`${APP}/complete-profile/?$`));
  });

  test('password reset route is unavailable without a recovery auth event', async ({ page }) => {
    await mockSupabase(page);
    await page.goto(`${APP}/`);
    await expect(page).toHaveURL(new RegExp(`${APP}/login/?$`));
    await page.evaluate(() => {
      history.pushState({}, '', '/app/next/reset-password');
      dispatchEvent(new PopStateEvent('popstate'));
    });
    await expect(page).toHaveURL(new RegExp(`${APP}/forgot-password/?$`));
    await expect(page.getByRole('heading', { name: /reset your password/i })).toBeVisible();
  });

  test('delete-account dialog validates confirmation and only calls the mocked function', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const mockedWrites = await mockSupabase(page, true, { logoutFailure: true });
    await page.goto(`${APP}/`);

    await page.getByRole('navigation', { name: /^primary$/i })
      .getByRole('link', { name: /settings/i }).click();
    await page.getByRole('button', { name: /delete account/i }).click();

    const dialog = page.getByRole('dialog', { name: /delete account/i });
    await expect(dialog).toBeVisible();
    const confirm = dialog.getByRole('button', { name: /^permanently delete account$/i });
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel(/type delete|confirmation/i).fill('delete');
    await expect(confirm).toBeEnabled();
    expect(mockedWrites.filter((entry) => entry.includes('/delete-account'))).toEqual([]);

    await confirm.click();
    await expect.poll(() => mockedWrites.filter((entry) => entry.includes('/delete-account')).length).toBe(1);
    await expect(page).toHaveURL(new RegExp(`${APP}/login/?$`));
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
  });
});
