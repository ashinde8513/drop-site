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
  { path: '/genre.html', title: /Events Near .+\| Drop/ },
  { path: '/share-plan.html', title: /Drop/ },
  { path: '/share-recap.html', title: /Drop/ },
  { path: '/share-wrapped.html', title: /Drop/ },
  // ponytail: app/index.html is in-scope per INGEST_PLAN (track A) but owned
  // by a different in-flight track — add its PAGES entry in that track's commit.
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

  test('homepage shows the core value prop and the Prism design hero', async ({ page }) => {
    // ponytail: stale since the 2026-07-09 Prism design rebuild — index.html is
    // now the design's signed-out home screen (static hero, no flip-words).
    await page.goto('/index.html');
    await expect(page.locator('h1')).toContainText("Who's going.");
    await expect(page.locator('h1')).not.toContainText('Discover live shows near you');
    await expect(page.locator('#home-search')).toHaveCount(1);
    await expect(page.locator('#home-grid')).toHaveCount(1);
  });

  test('hero proof line is the honest tracking stat, not a fabricated user count', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page.locator('.hero-proof')).toContainText('Tracking');
    await expect(page.locator('.hero-proof')).toContainText('1,500+');
    await expect(page.locator('.hero-proof')).toContainText('11 cities');
    await expect(page.locator('.hero-proof')).not.toContainText('40,000');
  });

  test('"Happening in {city}" heading has a working city dropdown in sync with the nav pill', async ({ page }) => {
    await page.goto('/index.html');
    const headingBtn = page.locator('h2 .city-head-btn');
    await expect(headingBtn).toBeVisible();
    await expect(headingBtn.locator('.loc-city')).toHaveText('Denver');
    await headingBtn.click();
    const pop = page.locator('h2 .loc-pop');
    await expect(pop).toBeVisible();
    await pop.locator('[data-city="Seattle"]').click();
    await page.waitForLoadState('load');
    for (const label of await page.locator('.loc-city').all()) {
      await expect(label).toHaveText('Seattle');
    }
  });

  test('event card grid is centered, not left-flowing', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page.locator('#home-grid')).toHaveCSS('justify-content', 'center');
  });

  test('artist page renders verified badge, merch/website pills, and a claim-profile link', async ({ page }) => {
    // Live data has no verified/merch/website rows populated yet — mock the
    // Supabase response so this exercises the new artist.html render branches
    // deterministically instead of depending on DB contents.
    const fakeId = '04b70676-c8aa-408d-9470-0985b8fe8d3d';
    await page.route('**/rest/v1/artists?**', async (route) => {
      if (route.request().url().includes('id=eq.')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{
            id: fakeId, name: 'Test Artist', genres: ['house'], image_url: null,
            merch_url: 'https://shop.example.com', website_url: 'https://example.com', verified: true,
          }]),
        });
      } else {
        await route.continue();
      }
    });
    await page.route('**/rest/v1/events?**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

    await page.goto(`/artist.html?id=${fakeId}`);
    await expect(page.locator('.art-name')).toContainText('Test Artist');
    await expect(page.locator('.art-verified')).toHaveAttribute('aria-label', 'Verified artist');
    await expect(page.locator('a.art-linkpill[href="https://example.com"]')).toBeVisible();
    await expect(page.locator('a.art-linkpill[href="https://shop.example.com"]')).toBeVisible();
    const claim = page.locator('.art-claim');
    await expect(claim).toContainText('Are you Test Artist?');
    await expect(claim).toHaveAttribute('href', `https://app.trydropapp.com/?claim=${fakeId}`);
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
    // "Happening in {city}" search — visible on desktop AND mobile (nav search hides behind a toggle).
    await page.locator('#home-q').fill('house');
    // Always at least the "Search “house”" row, even with zero live matches.
    await expect(page.locator('#home-search .ta-pop')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#home-search .ta-row').first()).toBeVisible();
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

  test('city picker has a type-any-city filter; home has a load-more button', async ({ page }) => {
    await page.goto('/index.html');
    // Load-more control ships in the static markup (revealed once a full page returns).
    await expect(page.locator('#home-more')).toHaveCount(1);
    // Opening the heading's city dropdown reveals the free-text filter input.
    await page.locator('.city-head-btn').click();
    const filter = page.locator('.loc-wrap:has(.city-head-btn) .loc-filter input');
    await expect(filter).toBeVisible();
    await filter.fill('Springfield');
    await filter.press('Enter');
    await page.waitForLoadState('domcontentloaded');
    expect(await page.evaluate(() => localStorage.getItem('drop.city'))).toBe('Springfield');
  });

  test('About lives in the footer, not the nav', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page.locator('nav.wn a[href="/about.html"]')).toHaveCount(0);
    await expect(page.locator('footer a[href="/about.html"]')).toHaveCount(1);
  });

  test('website nav points login to the static browser account shell', async ({ page }) => {
    // Browser login now points to the static account shell on this static domain.
    // "Get the app" is gone from the nav (design replaces it with Log in / Get
    // started) — get-the-app now lives only at /download in the footer.
    for (const path of ['/index.html', '/events.html', '/about.html', '/download.html']) {
      await page.goto(path);
      await expect(page.locator('nav.wn a[href^="/app"]')).toHaveCount(0);
      await expect(page.locator('nav.wn a[href="/account.html"]').first()).toHaveCount(1);
      await expect(page.locator('nav.wn a[href="/download.html"]')).toHaveCount(0);
      await expect(page.locator('footer a[href="/download.html"]').first()).toHaveCount(1);
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

  test('nav parity: .wn browse links + Log in/Get started corner, no For Promoters', async ({ page }) => {
    await page.goto('/index.html');
    for (const href of ['/events.html', '/venues.html', '/artists.html']) {
      await expect(page.locator(`nav.wn .wn__navlink[href="${href}"]`)).toHaveCount(1);
    }
    await expect(page.locator('nav.wn a[href="/promoters.html"]')).toHaveCount(0);
    await expect(page.locator('footer a[href="/promoters.html"]')).toHaveCount(1);
    await expect(page.locator('nav.wn a[href^="/app"]')).toHaveCount(0);
    await expect(page.locator('nav.wn a[href="/account.html"]').first()).toHaveCount(1);
    await expect(page.locator('nav.wn a[href="/account.html?mode=signup"]').first()).toHaveCount(1);
  });

  test('mobile: hamburger opens the .mnav drawer at 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/index.html');
    const drawer = page.locator('#nav-drawer');
    await expect(drawer).toBeHidden();
    await page.locator('nav.wn [data-nav-menu]').click();
    await expect(drawer).toBeVisible();
    await expect(drawer.locator('a[href="/events.html"]')).toBeVisible();
    // Close via the panel's ✕ button — the scrim also carries [data-nav-close]
    // but sits fully behind the panel at this viewport width, so target the button.
    await page.locator('.mnav__panel button[data-nav-close]').click();
    await expect(drawer).toBeHidden();
  });

});
