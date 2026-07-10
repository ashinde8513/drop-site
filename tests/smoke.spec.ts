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
  { path: '/account.html', title: /Log In \| Drop/ },
  { path: '/city.html', title: /EDM Shows in .+\| Drop/ },
  { path: '/404.html', title: /404 — Page not found \| Drop/ },
  // ponytail: genre.html, share-plan/recap/wrapped.html, app/index.html are
  // in-scope per INGEST_PLAN (tracks 3/A) but not yet landed on disk as of
  // this pass — add their PAGES entries in the same commit that ships them,
  // not speculatively (a guessed title here would just be a future false-red).
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

  test('search typeahead opens a suggestions dropdown while typing', async ({ page }) => {
    await page.goto('/index.html');
    // Hero input — visible on desktop AND mobile (nav search hides behind a toggle).
    await page.locator('#hs-q').fill('house');
    // Always at least the "Search “house”" row, even with zero live matches.
    await expect(page.locator('#hero-search .ta-pop')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#hero-search .ta-row').first()).toBeVisible();
  });

  test('city label follows the selected location everywhere on the page', async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => localStorage.setItem('drop.city', 'Seattle'));
    await page.reload();
    // Nav pill AND the in-page "Near <city>" eyebrow both reflect the choice.
    for (const label of await page.locator('.loc-city').all()) {
      await expect(label).toHaveText('Seattle');
    }
  });

  test('About lives in the footer, not the header; genres listed once', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page.locator('header a[href="/about.html"]')).toHaveCount(0);
    await expect(page.locator('footer a[href="/about.html"]')).toHaveCount(1);
    // The chip row duplicated the "Pick your night" genre tiles — it's gone.
    await expect(page.locator('.chip-row')).toHaveCount(0);
    await expect(page.locator('.grid-tiles')).toHaveCount(1);
  });

  test('website header points login to the static browser account shell', async ({ page }) => {
    // Browser login now points to the static account shell on this static domain.
    for (const path of ['/index.html', '/events.html', '/about.html', '/download.html']) {
      await page.goto(path);
      await expect(page.locator('header a[href^="/app"]')).toHaveCount(0);
      await expect(page.locator('header a[href="/account.html"]').first()).toHaveCount(1);
      await expect(page.locator('header a[href="/download.html"]').first()).toHaveCount(1);
    }
  });

  test('account page renders the browser login screen', async ({ page }) => {
    await page.goto('/account.html');
    await expect(page.locator('h1')).toContainText("Who's going.");
    await expect(page.locator('#auth-title')).toHaveText('Welcome back');
    await expect(page.locator('#auth-login')).toBeVisible();
    await expect(page.locator('#auth-password')).toBeVisible();
    await expect(page.locator('#auth-submit')).toHaveText('Log in');
  });

  test('nav parity: browse links + corner, no For Promoters in header', async ({ page }) => {
    await page.goto('/index.html');
    for (const href of ['/events.html', '/venues.html', '/artists.html']) {
      await expect(page.locator(`header .nav-links a[href="${href}"]`)).toHaveCount(1);
    }
    await expect(page.locator('header a[href="/promoters.html"]')).toHaveCount(0);
    await expect(page.locator('footer a[href="/promoters.html"]')).toHaveCount(1);
    await expect(page.locator('header a[href^="/app"]')).toHaveCount(0);
    await expect(page.locator('header a[href="/account.html"]').first()).toHaveCount(1);
  });

});
