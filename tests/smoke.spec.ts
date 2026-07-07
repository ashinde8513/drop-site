import { test, expect, type Page } from '@playwright/test';

/**
 * Smoke + regression tests for the Drop landing site.
 * Goal: catch broken pages, broken links, missing critical content,
 * and JS console errors before they reach trydropapp.com.
 */

// Collect any console errors / failed requests for a page so a broken
// asset or script failure fails the test instead of silently passing.
function trackPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('requestfailed', (req) => {
    // Ignore third-party (fonts, ConvertKit) flakiness; only flag same-origin assets.
    const url = req.url();
    if (url.includes('localhost') || url.includes('127.0.0.1')) errors.push(`requestfailed: ${url}`);
  });
  return errors;
}

const PAGES = [
  { path: '/index.html', title: /Discover live shows near you/ },
  { path: '/events.html', title: /Shows near you/ },
  { path: '/venues.html', title: /Venues/ },
  { path: '/artists.html', title: /Artists/ },
  { path: '/promoters.html', title: /For Promoters/ },
  { path: '/about.html', title: /About/ },
  { path: '/download.html', title: /Get Drop/ },
  { path: '/privacy.html', title: /Drop/ },
  { path: '/terms.html', title: /Drop/ },
  { path: '/link.html', title: /Drop — Get the app/ },
];

// event/venue/artist are param-driven detail templates (?id=, ?name=&city=).
// Hit them with no params and expect the client-side "not found" empty
// state to render — no id means no Supabase fetch is even attempted.
const DETAIL_PAGES = [
  { path: '/event.html', backHref: '/events.html' },
  { path: '/venue.html', backHref: '/venues.html' },
  { path: '/artist.html', backHref: '/artists.html' },
];

test.describe('landing site smoke', () => {
  for (const { path, title } of PAGES) {
    test(`${path} loads with correct title and no console errors`, async ({ page }) => {
      const errors = trackPageErrors(page);
      const res = await page.goto(path);
      expect(res?.status(), `${path} should return 2xx`).toBeLessThan(400);
      await expect(page).toHaveTitle(title);
      // Page must render *some* visible body content.
      await expect(page.locator('body')).not.toBeEmpty();
      expect(errors, `unexpected errors on ${path}`).toEqual([]);
    });
  }

  for (const { path, backHref } of DETAIL_PAGES) {
    test(`${path} with no params renders not-found state cleanly`, async ({ page }) => {
      const errors = trackPageErrors(page);
      const res = await page.goto(path);
      expect(res?.status(), `${path} should return 2xx`).toBeLessThan(400);
      await expect(page.locator('.state-error')).toBeVisible();
      await expect(page.locator('.state-error .state-msg')).not.toBeEmpty();
      await expect(page.locator(`.state-error a[href="${backHref}"]`)).toHaveCount(1);
      expect(errors, `unexpected errors on ${path}`).toEqual([]);
    });
  }

  test('homepage shows the core value prop and hero search', async ({ page }) => {
    // ponytail: was asserting 'friends' from the retired marketing hero copy —
    // stale since the 2026-07-06 AXS browse-first rebuild (h1 is now discover-first).
    await page.goto('/index.html');
    await expect(page.locator('h1')).toContainText('Discover live shows');
    await expect(page.locator('#hero-search')).toHaveCount(1);
  });

  test('legal links from homepage resolve', async ({ page }) => {
    await page.goto('/index.html');
    for (const href of ['/privacy.html', '/terms.html']) {
      const link = page.locator(`a[href="${href}"]`).first();
      await expect(link, `${href} link present`).toHaveCount(1);
      const res = await page.request.get(href);
      expect(res.status(), `${href} reachable`).toBeLessThan(400);
    }
  });

  test('contact email link is present and well-formed', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page.locator('a[href^="mailto:"]').first()).toHaveAttribute(
      'href',
      /mailto:.+@.+/,
    );
  });

  test('login is owned by the app (nav → /app/login)', async ({ page }) => {
    // Every page nav points Log in at the real app login (email/username + social).
    // The /login and /login.html → /app/login 301s live in _redirects (Cloudflare
    // Pages only — the local static server can't process them; verified live on deploy).
    for (const path of ['/index.html', '/events.html', '/about.html', '/download.html']) {
      await page.goto(path);
      await expect(page.locator('a[href="/app/login"]').first()).toHaveCount(1);
    }
  });

});
