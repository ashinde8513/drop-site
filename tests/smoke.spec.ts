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
  // Pre-dismiss the cookie banner so it can't sit over unrelated click
  // targets; the dedicated 'cookie consent' suite below exercises the banner.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('drop.cookie-consent', 'essential'); } catch {}
    });
  });

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
    await expect(page.locator('h1')).toContainText('Never miss');
    await expect(page.locator('h1')).toContainText('a drop.');
    await expect(page.locator('h1')).not.toContainText('Discover live shows near you');
    await expect(page.locator('#home-search')).toHaveCount(1);
    await expect(page.locator('#home-grid')).toHaveCount(1);
  });

  test('hero proof line is the honest tracking stat, not a fabricated user count', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page.locator('.hero-proof')).toContainText('Tracking');
    await expect(page.locator('.hero-proof')).toContainText('1,600+');
    await expect(page.locator('.hero-proof')).toContainText('200+ cities');
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

  test('city picker has a type-any-city filter; home has a pager', async ({ page }) => {
    await page.goto('/index.html');
    // Pager controls ship in the static markup (revealed once the count returns).
    await expect(page.locator('#home-pager')).toHaveCount(1);
    await expect(page.locator('#home-prev')).toHaveCount(1);
    await expect(page.locator('#home-next')).toHaveCount(1);
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

  test('website nav points login to the app shell on app.trydropapp.com', async ({ page }) => {
    // The old static /account.html shell is retired — Log in / Get started go
    // to the post-login SPA (?mode=login|signup). "Get the app" stays only at
    // /download in the footer.
    for (const path of ['/index.html', '/events.html', '/about.html', '/download.html']) {
      await page.goto(path);
      await expect(page.locator('nav.wn a[href="https://app.trydropapp.com/?mode=login"]').first()).toHaveCount(1);
      await expect(page.locator('nav.wn a[href="/download.html"]')).toHaveCount(0);
      await expect(page.locator('footer a[href="/download.html"]').first()).toHaveCount(1);
    }
  });

  test('nav parity: .wn browse links + Log in/Get started corner, no For Promoters', async ({ page }) => {
    await page.goto('/index.html');
    for (const href of ['/events.html', '/venues.html', '/artists.html']) {
      await expect(page.locator(`nav.wn .wn__navlink[href="${href}"]`)).toHaveCount(1);
    }
    await expect(page.locator('nav.wn a[href="/promoters.html"]')).toHaveCount(0);
    await expect(page.locator('footer a[href="/promoters.html"]')).toHaveCount(1);
    await expect(page.locator('nav.wn a[href="https://app.trydropapp.com/?mode=login"]').first()).toHaveCount(1);
    await expect(page.locator('nav.wn a[href="https://app.trydropapp.com/?mode=signup"]').first()).toHaveCount(1);
  });

  test('launch-access submit answers inline instead of silently reloading', async ({ page }) => {
    await page.goto('/download.html');
    await page.locator('#wl-email').fill('raver@example.com');
    await page.locator('.wl-submit').click();
    // Whether Kit is wired or not, the tap must produce visible feedback that
    // mentions email — never a bare page reload.
    await expect(page.locator('.wl-msg')).toContainText(/email/i);
    expect(page.url()).not.toContain('email_address=');
  });

  test('launch-access submit flags an invalid email inline', async ({ page }) => {
    await page.goto('/download.html');
    await page.locator('#wl-email').fill('not-an-email');
    await page.locator('.wl-submit').click();
    await expect(page.locator('.wl-msg')).toContainText('valid email');
    await expect(page.locator('#wl-email')).toHaveAttribute('aria-invalid', 'true');
  });

  test('link-in-bio launch buttons point at the real waitlist form', async ({ page }) => {
    await page.goto('/link.html');
    await expect(page.locator('#getApp')).toHaveAttribute('href', '/download.html#waitlist');
    await expect(page.locator('#joinList')).toHaveAttribute('href', '/download.html#waitlist');
  });

  test('event page shows a single honest ticket listing with no exclusivity claim', async ({ page }) => {
    const fakeId = '7b6f66aa-2f6d-4f6e-9d55-1c2b3a4d5e6f';
    const fakeEvent = {
      id: fakeId, title: 'Test Rave', description: 'A test show.',
      date: '2027-01-15T20:00:00', end_date: null, venue_name: 'Test Hall',
      city: 'Denver', state: 'CO', image_url: null,
      ticket_url: 'https://www.ticketmaster.com/e/123',
      price_min: 45, price_max: null, currency: 'USD',
      is_festival: false, time_tbd: false, status: 'published',
      created_at: '2026-07-01T00:00:00', event_artists: [],
    };
    await page.route('**/rest/v1/events?**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([fakeEvent]) }));
    await page.route('**/rest/v1/rpc/event_going_counts', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

    await page.goto(`/event.html?id=${fakeId}`);
    // One honest row — real seller name from the URL, no fabricated competitors,
    // and no "Only seller" badge/notice (it implied exclusivity, but resale
    // markets usually also carry the show — removed 2026-07-16, founder call).
    await expect(page.locator('.ed-price-row')).toHaveCount(1);
    await expect(page.locator('.ed-price-row')).toContainText('Ticketmaster');
    await expect(page.locator('.ed-best')).toHaveCount(0);
    await expect(page.locator('.ed-single-note')).toHaveCount(0);
    await expect(page.locator('.ed-section', { hasText: 'Tickets' })).not.toContainText('only');
  });

  test('event page labels an affiliate-wrapped etix.prf.hn ticket link as Etix', async ({ page }) => {
    // ~226 live events carry etix.prf.hn (Partnerize) hosts — the hostname
    // fallback would label them "Prf" without the explicit map entry.
    const fakeId = '9c1d22bb-3e4f-4a5b-8c6d-7e8f9a0b1c2d';
    const fakeEvent = {
      id: fakeId, title: 'Affiliate Etix Show', description: '',
      date: '2027-02-01T02:00:00', end_date: null, venue_name: 'Test Lounge',
      city: 'Denver', state: 'CO', image_url: null,
      ticket_url: 'https://etix.prf.hn/click/camref:TEST/destination:https%3A%2F%2Fwww.etix.com%2Fticket%2Fp%2FTEST',
      price_min: null, price_max: null, currency: 'USD',
      is_festival: false, time_tbd: false, status: 'published',
      created_at: '2026-07-01T00:00:00', event_artists: [],
    };
    await page.route('**/rest/v1/events?**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([fakeEvent]) }));
    await page.route('**/rest/v1/rpc/event_going_counts', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

    await page.goto(`/event.html?id=${fakeId}`);
    await expect(page.locator('.ed-price-row')).toContainText('Etix');
    await expect(page.locator('.ed-price-row')).not.toContainText('Prf');
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

test.describe('cookie consent', () => {
  test('banner shows on first visit and Accept all persists', async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto('/index.html');
    const banner = page.locator('.ck-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Cookies on Drop');
    await banner.getByRole('button', { name: 'Accept all' }).click();
    await expect(page.locator('.ck-banner')).toHaveCount(0);
    await page.reload();
    await expect(page.locator('.ck-banner')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('drop.cookie-consent'))).toBe('accepted');
    expect(errors, 'no console errors with the banner present').toEqual([]);
  });

  test('Essential only persists, and the privacy page reopens the banner on demand', async ({ page }) => {
    await page.goto('/privacy.html');
    await page.locator('.ck-banner .ck-essential').click();
    await expect(page.locator('.ck-banner')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('drop.cookie-consent'))).toBe('essential');
    // The policy's "Manage cookie preferences" button brings it back.
    await page.locator('[data-cookie-prefs]').click();
    await expect(page.locator('.ck-banner')).toBeVisible();
  });

  test('privacy policy has the cookies section the banner links to', async ({ page }) => {
    await page.goto('/privacy.html#cookies');
    await expect(page.locator('#cookies')).toContainText('Cookies and similar technologies');
    await expect(page.locator('.legal-nav a[href="#cookies"]')).toHaveCount(1);
    await expect(page.locator('[data-cookie-prefs]')).toHaveCount(1);
  });
});
