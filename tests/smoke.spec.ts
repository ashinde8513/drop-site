import { test, expect, type Page } from '@playwright/test';

/**
 * Smoke + regression tests for the Drop website (signed-out view).
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

test.describe('website smoke', () => {
  // Pre-dismiss the cookie banner so it can't sit over unrelated click
  // targets; the dedicated 'cookie consent' suite below exercises the banner.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('drop.cookie-consent', 'essential'); } catch {}
    });
  });

  test('ticket confirmation parser extracts reviewable past-show details', async ({ page }) => {
    await page.goto('/index.html');
    await page.addScriptTag({ url: '/app/ticket-email-parser.js' });
    const parsed = await page.evaluate(() => (window as any).DropTicketEmail.parseTicketEmail({
      subject: 'Your Ticketmaster Order Confirmation - John Summit',
      body: '<p>Sat &bull; Aug 09, 2025</p><p>Brooklyn Mirage</p><p>Brooklyn, NY</p>',
    }));
    expect(parsed).toMatchObject({
      source: 'ticketmaster', eventName: 'John Summit', artists: ['John Summit'],
      date: '2025-08-09', venueName: 'Brooklyn Mirage', city: 'Brooklyn', state: 'NY',
    });
  });

  test('logged-in app shell includes review-first ticket import controls', async ({ request }) => {
    const response = await request.get('/app/index.html');
    expect(response.status()).toBeLessThan(400);
    const html = await response.text();
    expect(html).toContain('Import a ticket confirmation');
    expect(html).toContain('Preview and fill details');
    expect(html).toContain('./ticket-email-parser.js');

    const appJs = await (await request.get('/app/app.js')).text();
    expect(appJs).not.toContain("supa.rpc('match_artist_by_name'");
    expect(appJs).toContain("supa.rpc('record_past_show'");
    expect(appJs).toContain("data.status === 'confirmation_required'");
    expect(appJs).toContain("this.logSubmitManual('merge'");
    expect(appJs).toContain("this.logSubmitManual('separate'");
    expect(appJs).toContain('p_lineup:lineupNames.map');
    expect(html).toContain('Show / event title');
    expect(html).toContain('Other artists on the lineup');
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

  test('homepage keeps an ongoing multi-day festival in the global rail', async ({ page }) => {
    const ongoingFestival = {
      id: '9fa26a17-b908-414a-950d-ebbbb7377e45', title: 'Ongoing Test Festival', description: '',
      date: new Date(Date.now() - 2 * 86400000).toISOString(),
      end_date: new Date(Date.now() + 2 * 86400000).toISOString(),
      venue_name: 'Test Festival Grounds', city: 'Elsewhere', state: 'CO', image_url: null,
      ticket_url: null, price_min: null, price_max: null, currency: 'USD',
      is_festival: true, time_tbd: false, status: 'published',
      created_at: '2026-07-01T00:00:00Z', event_artists: [],
    };
    await page.route('**/rest/v1/events?**', (route) => {
      const url = new URL(route.request().url());
      const rows = url.searchParams.has('end_date') ? [ongoingFestival] : [];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
    });

    await page.goto('/index.html');
    await expect(page.locator('#festival-section')).toBeVisible();
    await expect(page.locator('#festival-grid')).toContainText('Ongoing Test Festival');
    expect(await page.evaluate(() => (window as any).Drop.eventOverlapsWindow(
      {
        date: new Date(Date.now() - 2 * 86400000).toISOString(),
        end_date: new Date(Date.now() + 2 * 86400000).toISOString(),
        is_festival: true,
      },
      new Date().setHours(0, 0, 0, 0),
      new Date().setHours(23, 59, 59, 999),
    ))).toBe(true);

    await page.getByRole('link', { name: /Browse festivals/ }).click();
    await expect(page).toHaveURL(/events\.html\?genre=Festivals/);
    expect(new URL(page.url()).searchParams.get('city')).not.toBe('Denver');
    await expect(page.locator('#grid')).toContainText('Ongoing Test Festival');
    await expect(page.locator('#result-count')).toContainText('1 show');
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

  test('AASA covers every native universal-link route including password recovery', async ({ request }) => {
    const response = await request.get('/.well-known/apple-app-site-association');
    expect(response.status()).toBe(200);

    const association = await response.json() as {
      applinks: {
        details: Array<{
          appIDs: string[];
          components: Array<{ '/': string }>;
        }>;
      };
    };
    expect(association.applinks.details).toHaveLength(1);
    expect(association.applinks.details[0].appIDs).toContain(
      'S6H8PA7TUH.app.resonanceventures.drop',
    );
    expect(association.applinks.details[0].components.map((component) => component['/'])).toEqual([
      '/event/*',
      '/plan/*',
      '/reset-password',
      '/',
    ]);
  });

  test('legal pages match the 16+ gate and audited data handling', async ({ page }) => {
    await page.goto('/terms.html');
    const terms = page.locator('.doc-inner');
    const termsCanonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(termsCanonical).toBe('https://trydropapp.com/terms');
    await expect(terms).toContainText('at least 16 years old to create or use a Drop account');
    await expect(terms).toContainText('date of birth when requested');
    await expect(terms).not.toContainText(/under 13|at least 13/i);

    await page.goto('/privacy.html');
    const privacy = page.locator('.doc-inner');
    const privacyCanonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(privacyCanonical).toBe('https://trydropapp.com/privacy');
    await expect(privacy).toContainText('one-way hash');
    await expect(privacy).toContainText('processed on your device');
    await expect(privacy).toContainText('not transmitted to or retained by Drop');
    await expect(privacy).toContainText('ticket-wallet records');
    await expect(privacy).toContainText('Expo push token');
    await expect(privacy).toContainText(
      'In the mobile app, we collect product interactions and search or filter history, including selected genre, city, and date filters'
    );
    await expect(privacy).toContainText('accounts and social features are for people who are at least 16 years old');
    await expect(privacy).not.toContainText(/under 13|at least 13|finding your crew at a venue/i);

    const hostedTerms = await (await page.request.get('/terms.html')).text();
    const hostedPrivacy = await (await page.request.get('/privacy.html')).text();
    for (const hostedLegalDocument of [hostedTerms, hostedPrivacy]) {
      expect(hostedLegalDocument).toContain('href="/privacy"');
      expect(hostedLegalDocument).toContain('href="/terms"');
      expect(hostedLegalDocument).not.toMatch(/href="\/(?:privacy|terms)\.html"/);
    }

    const appTemplateResponse = await page.request.get('/app/index.html');
    const appScriptResponse = await page.request.get('/app/app.js');
    expect(appTemplateResponse.status()).toBeLessThan(400);
    expect(appScriptResponse.status()).toBeLessThan(400);
    const appTemplate = await appTemplateResponse.text();
    const appScript = await appScriptResponse.text();
    const signupConsentMarkup = appTemplate.match(/<input id="signup-consent"[\s\S]*?<\/label>/)?.[0];
    expect(signupConsentMarkup, 'signup consent links are present').toBeDefined();
    expect(signupConsentMarkup).toContain(`href="${privacyCanonical}"`);
    expect(signupConsentMarkup).toContain(`href="${termsCanonical}"`);
    expect(appTemplate).toContain(`href="${privacyCanonical}"`);
    expect(appTemplate).toContain(`href="${termsCanonical}"`);
    expect(appTemplate).not.toContain('https://trydropapp.com/privacy.html');
    expect(appTemplate).not.toContain('https://trydropapp.com/terms.html');

    const signupImplementation = appScript.match(/doSignup:\(\)=>\{([\s\S]*?)\n      \},\n      oauthGoogle:/)?.[1];
    expect(signupImplementation, 'signup implementation is present').toBeDefined();
    const consentGuardIndex = signupImplementation?.indexOf('if (!consented)') ?? -1;
    const signUpIndex = signupImplementation?.indexOf('supa.auth.signUp') ?? -1;
    expect(consentGuardIndex, 'unchecked consent is rejected').toBeGreaterThanOrEqual(0);
    expect(signUpIndex, 'Supabase signup call is present').toBeGreaterThan(consentGuardIndex);
    const oauthImplementation = appScript.match(/oauth\(provider\)\{([\s\S]*?)\n  \}\n\n  renderVals\(\)\{/);
    expect(oauthImplementation, 'OAuth implementation is present').not.toBeNull();
    expect(oauthImplementation?.[1]).toContain('signInWithOAuth');
    expect(oauthImplementation?.[1]).not.toMatch(/\bdob\b|date.of.birth/i);

    const appAssets = `${appTemplate}\n${appScript}`;
    for (const staleLegalMarker of [
      'screenLegal',
      'legalDoc',
      'const LEGAL',
      'LEGAL · PRIVACY',
      'LEGAL · TERMS',
      'privacy@drop.fm',
      'You must be 18 or older',
    ]) {
      expect(appAssets).not.toContain(staleLegalMarker);
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
    // Use a value absent from live city suggestions so Enter exercises the
    // custom-city path instead of choosing a newly-added matching city.
    await filter.fill('Codex Test City');
    await filter.press('Enter');
    await page.waitForLoadState('domcontentloaded');
    expect(await page.evaluate(() => localStorage.getItem('drop.city'))).toBe('Codex Test City');
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
    // Mock the waitlist insert: CI must never write a real row to production.
    let posted: string | undefined;
    await page.route('**/rest/v1/waitlist**', async (route) => {
      posted = route.request().postData() ?? '';
      await route.fulfill({ status: 201, body: '' });
    });
    await page.goto('/download.html');
    await page.locator('#wl-email').fill('Raver@Example.com');
    await page.locator('.wl-submit').click();
    // The tap must produce visible feedback that mentions email — never a
    // bare page reload (founder-reported bug).
    await expect(page.locator('.wl-msg')).toContainText(/on the list/);
    await expect(page.locator('.wl-msg')).toContainText(/email/i);
    expect(page.url()).not.toContain('email_address=');
    // The row goes to our own table, lowercased for the unique constraint.
    expect(posted).toContain('"email":"raver@example.com"');
  });

  test('signing up twice reads as already-on-the-list, not an error', async ({ page }) => {
    // Supabase answers a repeat email with a unique-constraint 409.
    await page.route('**/rest/v1/waitlist**', (route) =>
      route.fulfill({
        status: 409, contentType: 'application/json',
        body: JSON.stringify({ code: '23505', message: 'duplicate key value violates unique constraint "waitlist_email_key"' }),
      }));
    await page.goto('/download.html');
    await page.locator('#wl-email').fill('raver@example.com');
    await page.locator('.wl-submit').click();
    await expect(page.locator('.wl-msg')).toContainText(/already on the list/);
    await expect(page.locator('.wl-msg')).toHaveClass(/ok/);
  });

  test('waitlist outage shows a retry message instead of failing silently', async ({ page }) => {
    await page.route('**/rest/v1/waitlist**', (route) =>
      route.fulfill({ status: 500, body: '' }));
    await page.goto('/download.html');
    await page.locator('#wl-email').fill('raver@example.com');
    await page.locator('.wl-submit').click();
    await expect(page.locator('.wl-msg')).toContainText(/didn't go through/);
    await expect(page.locator('.wl-msg')).toHaveClass(/err/);
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
    await expect(page.locator('.ed-buybox [title="Log in to RSVP"]')).toHaveCount(2);
    // One honest row — real seller name from the URL, no fabricated competitors,
    // and no "Only seller" badge/notice (it implied exclusivity, but resale
    // markets usually also carry the show — removed 2026-07-16, founder call).
    await expect(page.locator('.ed-price-row')).toHaveCount(1);
    await expect(page.locator('.ed-price-row')).toContainText('Ticketmaster');
    await expect(page.locator('.ed-best')).toHaveCount(0);
    await expect(page.locator('.ed-single-note')).toHaveCount(0);
    await expect(page.locator('.ed-section', { hasText: 'Tickets' })).not.toContainText('only');
  });

  test('event detail keeps metadata and long lineup pills below and within artwork bounds', async ({ page }) => {
    const fakeId = '8d29d4e4-6845-4ef5-9259-a036074065bc';
    const fakeEvent = {
      id: fakeId,
      title: 'A very long event title with every artist in the lineup',
      description: `Doors:9:00PM_${'promoter.example/event/'.repeat(20)}`,
      date: '2027-01-15T20:00:00', end_date: null, venue_name: 'The Test Lounge',
      city: 'Denver', state: 'CO', image_url: null,
      ticket_url: 'https://www.ticketmaster.com/e/123',
      price_min: 45, price_max: null, currency: 'USD',
      is_festival: false, time_tbd: false, status: 'published',
      created_at: '2026-07-01T00:00:00',
      event_artists: [{ artists: {
        id: 'long-lineup-artist',
        name: 'BASS BINGO AFTERS – Earth/One – DJ Bacon – MJ – Another Artist With A Long Name',
        image_url: null,
      } }],
    };
    const relatedEvent = { ...fakeEvent, id: '33a064c4-cb11-4df9-b5ba-428938cd62e2', title: 'Related show' };
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route('**/rest/v1/events?**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([fakeEvent, relatedEvent]) }));
    await page.route('**/rest/v1/rpc/event_going_counts', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

    await page.goto(`/event.html?id=${fakeId}`);
    await expect(page.locator('.ed-hero__title')).toHaveText(fakeEvent.title);
    await expect(page.locator('.ed-hero__date, .ed-hero__venue')).toHaveCount(0);
    await expect(page.locator('.rail .wsc-card').first()).toBeVisible();
    const layout = await page.locator('#event-root').evaluate((root) => {
      const rect = (selector: string) => {
        const box = root.querySelector(selector)!.getBoundingClientRect();
        return { top: box.top, bottom: box.bottom, left: box.left, right: box.right };
      };
      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        media: rect('.ed-hero__media'),
        genre: rect('.ed-hero__meta .genre-pill'),
        title: rect('.ed-hero__title'),
        facts: rect('.ed-facts'),
        lineupSection: rect('.ed-lineup'),
        lineupChip: rect('.ed-lineup .chip'),
        lineupWhiteSpace: getComputedStyle(root.querySelector('.ed-lineup .chip')!).whiteSpace,
        titleInsideMedia: root.querySelector('.ed-hero__media .ed-hero__title') !== null,
      };
    });

    expect(layout.scrollWidth).toBe(layout.clientWidth);
    expect(layout.titleInsideMedia).toBe(false);
    expect(layout.genre.top).toBeGreaterThanOrEqual(layout.media.bottom);
    expect(layout.title.top).toBeGreaterThanOrEqual(layout.media.bottom);
    expect(layout.facts.top).toBeGreaterThanOrEqual(layout.title.bottom);
    expect(layout.lineupChip.left).toBeGreaterThanOrEqual(layout.lineupSection.left);
    expect(layout.lineupChip.right).toBeLessThanOrEqual(layout.lineupSection.right);
    expect(layout.lineupWhiteSpace).toBe('normal');

    await page.setViewportSize({ width: 1280, height: 800 });
    const desktop = await page.locator('#event-root').evaluate((root) => {
      const media = root.querySelector('.ed-hero__media')!.getBoundingClientRect();
      const meta = root.querySelector('.ed-hero__meta')!.getBoundingClientRect();
      const title = root.querySelector('.ed-hero__title')!.getBoundingClientRect();
      const facts = root.querySelector('.ed-facts')!.getBoundingClientRect();
      return {
        metaPosition: getComputedStyle(root.querySelector('.ed-hero__meta')!).position,
        metaTop: meta.top,
        titleTop: title.top,
        mediaBottom: media.bottom,
        factsTop: facts.top,
        factsText: root.querySelector('.ed-facts')!.textContent,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      };
    });
    expect(desktop.metaPosition).toBe('static');
    expect(desktop.metaTop).toBeGreaterThanOrEqual(desktop.mediaBottom);
    expect(desktop.titleTop).toBeGreaterThanOrEqual(desktop.mediaBottom);
    expect(desktop.factsTop).toBeGreaterThanOrEqual(desktop.metaTop);
    expect(desktop.factsText).toContain('Jan 15');
    expect(desktop.factsText).toContain('The Test Lounge · Denver, CO');
    expect(desktop.scrollWidth).toBe(desktop.clientWidth);
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

  test('event surfaces reject Ticketmaster category stock and cycle every artist fallback', async ({ page }) => {
    const fakeId = '6a1655bb-354e-4bbc-963a-9212d8404401';
    const brokenArtist = 'https://art.example/broken.jpg';
    const workingArtist = 'https://art.example/working.png';
    const fakeEvent = {
      id: fakeId, title: 'Fallback Art Festival', description: '',
      date: '2027-03-01T02:00:00Z', end_date: null, venue_name: 'Test Grounds',
      city: 'Denver', state: 'CO',
      image_url: 'https://images.ticketmaster.com/dam/c/category.jpg',
      ticket_url: null, price_min: null, price_max: null, currency: 'USD',
      is_festival: true, time_tbd: false, status: 'published',
      created_at: '2026-07-01T00:00:00Z',
      event_artists: [
        { artists: { id: 'a1', name: 'Broken Artist', genres: [], image_url: brokenArtist } },
        { artists: { id: 'a2', name: 'Working Artist', genres: [], image_url: workingArtist } },
      ],
    };
    await page.route('**/rest/v1/events?**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([fakeEvent]) }));
    await page.route(brokenArtist, (route) => route.abort('failed'));
    await page.route(workingArtist, (route) => route.fulfill({
      status: 200,
      contentType: 'image/png',
      path: 'og-image.png',
    }));

    await page.goto(`/event.html?id=${fakeId}`);
    const hero = page.locator(`#event-root img[alt^="${fakeEvent.title}"]`);
    await expect(hero).toHaveAttribute('src', workingArtist);
    expect(await page.evaluate(() => ({
      category: (window as any).Drop.isRealArtUrl('https://images.ticketmaster.com/dam/c/category.jpg'),
      deceptiveHost: (window as any).Drop.isRealArtUrl('https://example.com/images.ticketmaster.com/dam/c/category.jpg'),
      insecure: (window as any).Drop.isRealArtUrl('http://example.com/artist.jpg'),
      malformed: (window as any).Drop.isRealArtUrl('not-a-url'),
    }))).toEqual({ category: false, deceptiveHost: true, insecure: false, malformed: false });

    await page.goto('/index.html');
    await expect(page.locator('#home-grid img.wsc__img')).toHaveAttribute('src', workingArtist);
    await expect(page.locator('#home-grid .wsc-card button')).toHaveCount(0);
  });

  test('web app renders a real venue-timezone festival schedule with no demo rows', async ({ page }) => {
    const festivalId = '1b2625b7-40f4-45ca-a55d-59d839141881';
    const fakeFestival = {
      id: festivalId, title: 'Test Festival 2027', description: '',
      date: '2027-09-18T12:00:00Z', end_date: '2027-09-20T23:59:59Z',
      venue_name: 'Test Festival Grounds', city: 'Denver', state: 'CO', image_url: null,
      ticket_url: null, price_min: null, price_max: null, currency: 'USD',
      is_festival: true, time_tbd: false, timezone: 'America/Denver', status: 'published',
      created_at: '2026-07-01T00:00:00Z', event_artists: [],
    };
    const sets = [
      {
        id: '3bd42422-c675-4389-9817-ebcce8ed5594', event_id: festivalId,
        artist_name: 'ALPHA', artist_id: null, stage: 'Main Stage',
        start_time: '2027-09-19T04:30:00Z', end_time: '2027-09-19T06:00:00Z',
        timezone: 'America/Denver', status: 'published',
      },
      {
        id: '71130718-bc47-4e35-88f9-4bd484033b3a', event_id: festivalId,
        artist_name: 'BETA', artist_id: null, stage: 'Bass Stage',
        start_time: '2027-09-19T05:00:00Z', end_time: '2027-09-19T06:30:00Z',
        timezone: 'America/Denver', status: 'published',
      },
      {
        id: '180f702f-52a9-4816-a497-ec37e103af17', event_id: festivalId,
        artist_name: 'GAMMA', artist_id: null, stage: 'Main Stage',
        start_time: '2027-09-20T04:30:00Z', end_time: '2027-09-20T06:00:00Z',
        timezone: 'America/Denver', status: 'published',
      },
      {
        id: 'e7bfd55e-427f-4a16-9444-8d2bf9ebdeed', event_id: festivalId,
        artist_name: 'LEGACY DEMO', artist_id: null, stage: 'Main Stage',
        start_time: '2027-09-20T07:00:00Z', end_time: '2027-09-20T08:00:00Z',
        timezone: 'America/Denver', status: null,
      },
    ];
    await page.route('**/rest/v1/events?**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([fakeFestival]) }));
    await page.route('**/rest/v1/event_set_times?**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sets) }));

    await page.goto(`/app/index.html?festival=${festivalId}`);
    await expect(page.getByRole('heading', { name: 'Test Festival 2027' })).toBeVisible();
    await expect(page.locator('body')).toContainText('Test Festival Grounds · 2 stages · 3 sets');
    await expect(page.locator('body')).toContainText('Times shown in America/Denver');
    await expect(page.getByText('Sat, Sep 18', { exact: true })).toHaveCount(2);
    await expect(page.getByText('Sun, Sep 19', { exact: true })).toHaveCount(1);
    await expect(page.getByText('Main Stage', { exact: true })).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Add ALPHA to my schedule' })).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('body')).toContainText('ALPHA');
    await expect(page.locator('body')).toContainText('10:30PM – 12AM');
    await expect(page.locator('body')).not.toContainText('Global Dance Festival 2026');
    await expect(page.locator('body')).not.toContainText('LEGACY DEMO');
    await expect(page.locator('body')).not.toContainText('Demo data');
  });

  test('set-time-free festival dates use the authoritative venue timezone', async ({ page }) => {
    const festivalId = '5c26525c-99ae-41cd-a9de-00b9196c3975';
    const festival = {
      id: festivalId, title: 'DST Safe Festival', description: '',
      date: '2027-08-01T12:00:00Z', end_date: '2027-08-03T05:59:59.999Z',
      timezone: 'America/Denver', venue_name: 'Denver Grounds', city: 'Denver', state: 'CO', image_url: null,
      ticket_url: null, price_min: null, price_max: null, currency: 'USD', is_festival: true,
      time_tbd: true, status: 'published', created_at: '2026-07-01T00:00:00Z', event_artists: [],
    };
    await page.route('**/rest/v1/events?**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([festival]) }));
    await page.route('**/rest/v1/event_set_times?**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

    await page.goto(`/app/index.html?festival=${festivalId}`);
    await expect(page.getByRole('heading', { name: 'DST Safe Festival' })).toBeVisible();
    await expect(page.locator('body')).toContainText('AUG 1 – AUG 2');
    await expect(page.locator('body')).not.toContainText('AUG 1 – AUG 3');
    await expect(page.locator('body')).toContainText('Set times not published yet');
  });

  test('festival retry recovers after one transient catalog failure', async ({ page }) => {
    const festivalId = 'f7edc77c-2451-4076-a90c-b979d11a3f60';
    const festival = {
      id: festivalId, title: 'Retry Festival', description: '', date: '2027-10-01T12:00:00Z',
      end_date: '2027-10-03T05:59:59Z', timezone: 'America/Denver', venue_name: 'Retry Grounds',
      city: 'Denver', state: 'CO', image_url: null, ticket_url: null, price_min: null, price_max: null,
      currency: 'USD', is_festival: true, time_tbd: true, status: 'published',
      created_at: '2026-07-01T00:00:00Z', event_artists: [],
    };
    let festivalRequests = 0;
    await page.route('**/rest/v1/events?**', (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('is_festival') === 'is.true') {
        festivalRequests++;
        if (festivalRequests === 1) return route.fulfill({ status: 503, body: 'temporary' });
        const rows = festivalRequests >= 3 ? [festival] : [];
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/rest/v1/event_set_times?**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

    await page.goto(`/app/index.html?festival=${festivalId}`);
    await expect(page.getByText('Couldn’t load set times')).toBeVisible();
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByRole('heading', { name: 'Retry Festival' })).toBeVisible();
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
