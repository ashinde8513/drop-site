import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
    if (msg.type() !== 'error') return;
    const url = msg.location().url;
    // Match requestfailed below: third-party image/font failures are noisy,
    // but external scripts' own console errors must still fail the suite.
    const externalResourceNoise = url
      && !url.includes('localhost')
      && !url.includes('127.0.0.1')
      && msg.text().startsWith('Failed to load resource:');
    if (!externalResourceNoise) errors.push(`console.error: ${msg.text()}`);
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
  { path: '/download.html', title: /Download Drop on the App Store/ },
  { path: '/privacy.html', title: /Drop/ },
  { path: '/terms.html', title: /Drop/ },
  { path: '/link.html', title: /Drop — Get the app/ },
  { path: '/city.html', title: /EDM Shows in .+\| Drop/ },
  { path: '/404.html', title: /404 — Page not found \| Drop/ },
  { path: '/genre.html', title: /Events Near .+\| Drop/ },
  { path: '/share-plan.html', title: /Drop/ },
  { path: '/share-recap.html', title: /Drop/ },
  { path: '/share-wrapped.html', title: /Drop/ },
  { path: '/sms-opt-in.html', title: /SMS verification consent/ },
  { path: '/creators.html', title: /Drop Creator Program/ },
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

const SOCIAL_LINKS = [
  { name: 'Instagram', href: 'https://www.instagram.com/trydropapp/', icon: 'instagram' },
  { name: 'TikTok', href: 'https://www.tiktok.com/@trydropapp', icon: 'tiktok' },
  { name: 'X', href: 'https://x.com/trydropapp', icon: 'x' },
  { name: 'YouTube', href: 'https://www.youtube.com/channel/UCvzbdCiHMW6ZHDe04PUEdTQ', icon: 'youtube' },
  { name: 'Facebook', href: 'https://www.facebook.com/profile.php?id=61591821453151', icon: 'facebook' },
  { name: 'Reddit', href: 'https://www.reddit.com/user/trydrop/', icon: 'reddit' },
  { name: 'LinkedIn', href: 'https://www.linkedin.com/company/trydropapp/', icon: 'linkedin' },
];

test.describe('website smoke', () => {
  // Pre-dismiss the cookie banner so it can't sit over unrelated click
  // targets; the dedicated 'cookie consent' suite below exercises the banner.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('drop.cookie-consent', 'essential'); } catch {}
    });
    // Keep smoke tests independent of third-party latency. Tests that exercise
    // catalog behavior register a more specific route after this fallback.
    await page.route('https://fonts.googleapis.com/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await page.route('**/rest/v1/**', (route) => {
      const body = new URL(route.request().url()).pathname.endsWith('/event_cities')
        ? JSON.stringify([{ city: 'Denver' }, { city: 'Seattle' }])
        : '[]';
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'content-range': '*/0' },
        body,
      });
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
    await expect(page.locator('head > meta').first()).toHaveAttribute(
      'name',
      'impact-site-verification',
    );
    await expect(page.locator('head > meta').first()).toHaveAttribute(
      'value',
      '7d7f50d4-d425-4041-ae9b-84d29d3d0305',
    );
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

  test('hero proof line renders exact canonical buyable-event totals', async ({ page }) => {
    let statsRequests = 0;
    await page.route('**/rest/v1/rpc/get_public_catalog_stats', (route) => {
      statsRequests += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          event_count: 1234,
          city_count: 236,
          calculated_at: '2026-08-16T03:30:00Z',
        }]),
      });
    });
    await page.goto('/index.html');
    const stats = await page.evaluate(() => (window as any).Drop.fetchCatalogStats());
    expect(stats).toEqual({ events: 1234, cities: 236, calculatedAt: '2026-08-16T03:30:00Z' });
    expect(statsRequests).toBeGreaterThan(0);
    await expect(page.locator('.hero-proof')).toContainText('Tracking');
    await expect(page.locator('.hero-proof')).toContainText('1,234 events');
    await expect(page.locator('.hero-proof')).toContainText('236 cities');
    await expect(page.locator('[data-catalog-proof-pending]')).toBeHidden();
    await expect(page.locator('.hero-proof')).not.toContainText('40,000');
  });

  test('hero proof line never falls back to stale numbers when live stats are malformed', async ({ page }) => {
    await page.route('**/rest/v1/rpc/get_public_catalog_stats', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          event_count: null,
          city_count: null,
          calculated_at: '2026-08-16T03:30:00Z',
        }]),
      }));
    await page.goto('/index.html');
    await expect(page.locator('[data-catalog-proof]')).toBeHidden();
    await expect(page.locator('.hero-proof')).toContainText('Live catalog updated continuously');
    await expect(page.locator('.hero-proof')).not.toContainText('4,500');
    await expect(page.locator('.hero-proof')).not.toContainText('320');
  });

  test('homepage shows official Drop partners and ticket sources without extra relationship copy', async ({ page }) => {
    await page.goto('/index.html');
    const sources = page.locator('.ticket-sources');
    await expect(sources).toContainText('Official Drop partners and ticket sources');
    await expect(sources.locator(':scope > p')).toHaveCount(0);
    await expect(sources).not.toContainText('partnered with');
    await expect(sources).not.toContainText('integrated with');
    await expect(sources.locator('img')).toHaveCount(6);
    await expect(sources.locator('img').nth(0)).toHaveAttribute('alt', 'Cervantes’ Masterpiece Ballroom');
    await expect(sources.locator('img').nth(1)).toHaveAttribute('alt', 'Eventim');
    await expect(sources.locator('img').nth(2)).toHaveAttribute('alt', 'Ticketmaster');
    await expect(sources.locator('img').nth(3)).toHaveAttribute('alt', 'SeatGeek');
    await expect(sources.locator('img').nth(4)).toHaveAttribute('alt', 'Etix');
    await expect(sources.locator('img').nth(5)).toHaveAttribute('alt', 'Ticketsauce');
    await expect(sources.locator('a[aria-label="Visit Cervantes\' Masterpiece Ballroom"]')).toHaveAttribute(
      'href',
      'https://cervantesmasterpiece.com/',
    );
    await expect(sources.locator('a[aria-label="Visit Eventim"]')).toHaveAttribute('href', 'https://www.eventim.us/');
    await expect(sources.locator('a[aria-label="Visit Ticketsauce"]')).toHaveAttribute('href', 'https://www.ticketsauce.com/');
    for (const src of await sources.locator('img').evaluateAll((images) => images.map((image) => image.getAttribute('src')))) {
      expect(src).toMatch(/^\/assets\/partners\//);
    }
    await expect(page.locator('.foot-disc')).toContainText('affiliate links');
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

  test('public footer and link hub expose every official social profile safely', async ({ page }) => {
    for (const path of ['/index.html', '/link.html']) {
      await page.goto(path);
      const socials = page.locator('.foot-social').first();
      await expect(socials).toBeVisible();
      for (const { name, href, icon } of SOCIAL_LINKS) {
        const link = socials.getByRole('link', { name, exact: true });
        await expect(link).toHaveAttribute('href', href);
        await expect(link).toHaveAttribute('target', '_blank');
        await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        await expect(link.locator('use')).toHaveAttribute('href', `/social-icons.svg#${icon}`);
      }
    }
  });

  test('SMS opt-in proof mirrors the shipped one-time verification consent', async ({ page }) => {
    await page.goto('/sms-opt-in.html');
    await expect(page.getByText('Drop uses a one-time text to prove this number belongs to you. One phone can belong to only one Drop account.')).toBeVisible();
    await expect(page.getByText('Text me a code', { exact: true })).toBeVisible();
    await expect(page.getByText('No recurring or promotional texts', { exact: true })).toBeVisible();
    await expect(page.locator('a[href="/terms.html"]')).toHaveCount(1);
    await expect(page.locator('a[href="/privacy.html"]')).toHaveCount(1);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
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

  test('Android association matches the exact Google Play app-signing identity', async ({ request }) => {
    const response = await request.get('/.well-known/assetlinks.json');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');

    const source = readFileSync('.well-known/assetlinks.json', 'utf8');
    expect(source).not.toMatch(/TODO|REPLACE|app\.drop\.mobile/);

    const association = JSON.parse(source);
    expect(association).toEqual([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'app.resonanceventures.drop',
          sha256_cert_fingerprints: [
            'E3:15:2D:04:79:CB:20:91:35:16:7C:88:DA:77:07:AE:3D:71:E5:87:C5:97:94:7C:EA:BC:E2:2D:77:5F:A1:F2',
          ],
        },
      },
    ]);
    expect(await response.json()).toEqual(association);
  });

  test('password recovery has a browser fallback to the signed-in SPA', () => {
    const redirects = readFileSync('_redirects', 'utf8');
    expect(redirects).toContain(
      '/reset-password https://app.trydropapp.com/?mode=reset-password  302',
    );
  });

  test('legal pages match the 13+ gate and audited data handling', async ({ page }) => {
    await page.goto('/terms.html');
    const terms = page.locator('.doc-inner');
    const termsCanonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(termsCanonical).toBe('https://trydropapp.com/terms');
    await expect(terms).toContainText('at least 13 years old to create or use a Drop account');
    await expect(terms).toContainText('date of birth when requested');
    await expect(terms).not.toContainText(/under 16|at least 16/i);

    await page.goto('/privacy.html');
    const privacy = page.locator('.doc-inner');
    const privacyCanonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(privacyCanonical).toBe('https://trydropapp.com/privacy');
    await expect(privacy).toContainText('one-way hash');
    await expect(privacy).toContainText('enables matching for that verified channel by default');
    await expect(privacy).toContainText('turn either channel off at any time in Edit profile');
    await expect(privacy).toContainText('One verified phone can belong to only one Drop account');
    await expect(privacy).toContainText('Twilio processes the phone number');
    await expect(privacy).toContainText('processed on your device');
    await expect(privacy).toContainText('not transmitted to or retained by Drop');
    await expect(privacy).toContainText('ticket-wallet records');
    await expect(privacy).toContainText('Expo push token');
    await expect(privacy).toContainText(
      'In the mobile app, we collect product interactions and search or filter history, including selected genre, city, and date filters'
    );
    await expect(privacy).toContainText('accounts and social features are for people who are at least 13 years old');
    await expect(privacy).not.toContainText(/under 16|at least 16|finding your crew at a venue/i);

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
    expect(appTemplate).toContain('Free forever. 13+ only.');
    expect(appTemplate).not.toContain('Free forever. 16+ only.');

    const signupImplementation = appScript.match(/doSignup:\(\)=>\{([\s\S]*?)\n      \},\n      oauthGoogle:/)?.[1];
    expect(signupImplementation, 'signup implementation is present').toBeDefined();
    const consentGuardIndex = signupImplementation?.indexOf('if (!consented)') ?? -1;
    const signUpIndex = signupImplementation?.indexOf('supa.auth.signUp') ?? -1;
    expect(consentGuardIndex, 'unchecked consent is rejected').toBeGreaterThanOrEqual(0);
    expect(signUpIndex, 'Supabase signup call is present').toBeGreaterThan(consentGuardIndex);
    expect(signupImplementation).toContain('birthdate:dobValue');
    expect(signupImplementation).toContain('years < 13');
    expect(signupImplementation).not.toContain('years < 16');
    expect(signupImplementation).toContain('legal_accepted:true');
    expect(signupImplementation).toContain("terms_version:'2026-07-18'");
    expect(signupImplementation).toContain("privacy_version:'2026-08-11'");
    expect(signupImplementation).not.toContain('consented_at');
    expect(signupImplementation).toContain("'?mode=signup-complete'");
    const oauthImplementation = appScript.match(/oauth\(provider\)\{([\s\S]*?)\n  \}\n\n  renderVals\(\)\{/);
    expect(oauthImplementation, 'OAuth implementation is present').not.toBeNull();
    expect(oauthImplementation?.[1]).toContain('signInWithOAuth');
    expect(oauthImplementation?.[1]).toContain("signupOrigin ? '?mode=signup-complete' : ''");
    expect(oauthImplementation?.[1]).toContain("fieldVal('signup-dob')");
    expect(oauthImplementation?.[1]).toContain("fieldChecked('signup-consent')");
    expect(oauthImplementation?.[1]).toContain('years < 13');
    expect(oauthImplementation?.[1]).not.toContain('years < 16');
    expect(oauthImplementation?.[1]).toContain('savePendingOAuthCompliance(dobValue)');
    expect(appScript).toContain('years >= 13 && years <= 120');
    expect(appScript).not.toMatch(/16 or older|years >= 16/);
    expect(appScript).toContain("supa.rpc('complete_signup_profile'");
    expect(appScript).toContain('p_terms_version:pending.termsVersion');
    expect(appScript).toContain('p_privacy_version:pending.privacyVersion');

    expect(appTemplate).toContain('A verified phone is required before account activation');
    expect(appTemplate).toContain('value="{{ wizStepPhone }}"');
    expect(appTemplate).toContain('autocomplete="tel"');
    expect(appTemplate).toContain('autocomplete="one-time-code"');
    expect(appTemplate).not.toContain('Email-only signup stays available');
    expect(appScript).toContain("functions.invoke('verify-phone'");
    expect(appScript).toContain("functions.invoke('delete-account'");
    expect(appScript).toContain("if (value.profile_complete === true && value.phone_verified === false) return 'phone-required'");
    expect(appScript).toContain("body:{ action:'send', phone }");
    expect(appScript).toContain("body:{ action:'check', phone:this.state.wizPhonePending, code }");
    expect(appScript).toContain("wizPhone:'', wizPhonePending:'', wizPhoneCode:'', wizPhoneVerified:true");
    expect(appScript).toContain('wizPhoneResendDisabled:s.wizPhoneResendBlocked || s.wizPhoneBusy');
    expect(appScript).toContain('wizNavigationBusy:s.wizStep===0 && (s.wizPhoneBusy || (s.wizPhoneRequired && !s.wizPhoneVerified))');
    expect(appTemplate).toContain('onClick="{{ wizPhoneResend }}" disabled="{{ wizPhoneResendDisabled }}"');
    expect(appTemplate).toContain('onClick="{{ wizPhoneChange }}" disabled="{{ wizPhoneBusy }}"');
    expect(appTemplate).toContain('<sc-if value="{{ wizPhoneOptional }}"><button type="button" class="btn btn--ghost" onClick="{{ wizSkip }}"');
    expect(appTemplate).toContain('<sc-if value="{{ wizPhoneOptional }}"><button type="button" class="btn btn--primary" onClick="{{ wizNext }}"');
    expect(appScript).toContain("var SIGNUP_COMPLETE_MODE = 'signup-complete'");
    expect(appScript).not.toContain("if (mode === 'signup-complete') instance.setState({ screen: 'activation'");
    expect(appScript).toContain('scrubSignupCompletionUrl();');
    expect(appScript).toContain('clearPhoneVerificationState({ authed:false');
    expect(appScript).toContain('window.clearTimeout(this._wizPhoneCooldown)');
    const afterLoginImplementation = appScript.match(/async afterLogin\(\)\{([\s\S]*?)\n  \}\n  async connectTikTok/);
    expect(afterLoginImplementation?.[1]).toContain("supa.rpc('signup_compliance_status')");
    expect(afterLoginImplementation?.[1].indexOf("supa.rpc('signup_compliance_status')"))
      .toBeLessThan(afterLoginImplementation?.[1].indexOf("this.go('discover')"));
    expect(appScript).toContain("if(this.state.wizStep===0){ this.clearPhoneVerificationState({wizStep:1}); return; }");
    expect(appScript).not.toMatch(/console\.(?:log|error|warn)\([^\n]*(?:wizPhone|PhonePending|phonePending)/);

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

  test('download page uses Apple-provided artwork and the live App Store destination', async ({ page }) => {
    await page.goto('/download.html');
    const badge = page.getByRole('link', { name: 'Download Drop on the App Store' });
    await expect(badge).toHaveAttribute('href', 'https://apps.apple.com/us/app/drop-edm-events/id6790662825');
    await expect(badge.locator('img')).toHaveAttribute('alt', 'Download on the App Store');
    await expect(page.getByText('Available for iPhone', { exact: true })).toBeVisible();
    await expect(page.getByText(/iPhone\s*(?:&|and)\s*iPad/i)).toHaveCount(0);
    await expect(page.locator('#waitlist')).toHaveCount(0);

    const appTemplate = readFileSync(resolve('app/index.html'), 'utf8');
    expect(appTemplate).toContain('Available for iPhone');
    expect(appTemplate).not.toMatch(/iPhone\s*(?:&amp;|&|and)\s*iPad/i);

    const crawlerGuide = readFileSync(resolve('llms.txt'), 'utf8');
    expect(crawlerGuide).toContain('id6790662825): iPhone app');
    expect(crawlerGuide).not.toMatch(/iPhone\s*(?:&|and)\s*iPad/i);
  });

  test('creator application submits accessible normalized fields without production writes', async ({ page }) => {
    let payload: Record<string, unknown> | undefined;
    await page.route('**/functions/v1/submit-creator-application', async (route) => {
      payload = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"status":"received"}' });
    });
    await page.goto('/creators.html');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
    await page.locator('#creator-email').fill('Raver@Example.com');
    await page.locator('#creator-name').fill('Raver Maya');
    await page.locator('#creator-city').fill('Denver');
    await page.locator('#creator-username').fill('@raver_maya');
    await page.locator('#creator-platform').fill('https://instagram.com/raver_maya');
    await page.locator('#creator-sample').fill('https://instagram.com/p/example');
    await page.locator('#creator-audience').fill('Colorado ravers looking for local shows.');
    await page.locator('#creator-motivation').fill('I want to help Colorado fans discover the right shows.');
    await page.locator('#creator-age').check();
    await page.locator('#creator-expectations').check();
    await page.locator('.creator-submit').click();
    await expect(page.locator('.creator-message')).toContainText(/check your inbox/i);
    expect(payload?.email).toBe('raver@example.com');
    expect(payload?.state).toBe('CO');
    expect(payload?.platform_urls).toEqual(['https://instagram.com/raver_maya']);
  });

  test('creator pretty URL avoids a Cloudflare self-redirect', () => {
    expect(readFileSync('_redirects', 'utf8')).not.toMatch(/^\/creators\s+\/creators\.html\s+200$/m);
  });

  test('creator application surfaces validation, rate limiting, and outages', async ({ page }) => {
    await page.goto('/creators.html');
    await page.locator('.creator-submit').click();
    await expect(page.locator('.creator-message')).toContainText(/required fields/i);

    for (const status of [429, 500]) {
      await page.route('**/functions/v1/submit-creator-application', (route) =>
        route.fulfill({ status, body: '' }));
      await page.locator('#creator-email').fill('raver@example.com');
      await page.locator('#creator-name').fill('Raver Maya');
      await page.locator('#creator-city').fill('Denver');
      await page.locator('#creator-platform').fill('https://instagram.com/raver_maya');
      await page.locator('#creator-sample').fill('https://instagram.com/p/example');
      await page.locator('#creator-audience').fill('Colorado ravers looking for local shows.');
      await page.locator('#creator-motivation').fill('I want to help Colorado fans discover the right shows.');
      await page.locator('#creator-age').check();
      await page.locator('#creator-expectations').check();
      await page.locator('.creator-submit').click();
      await expect(page.locator('.creator-message')).toContainText(
        status === 429 ? /wait an hour/i : /didn’t go through/i,
      );
      await page.unroute('**/functions/v1/submit-creator-application');
    }
  });

  test('creator page remains absent from founding-cohort navigation and sitemap', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page.locator('nav a[href*="creator"], footer a[href*="creator"]')).toHaveCount(0);
    const sitemap = readFileSync(resolve('sitemap.xml'), 'utf8');
    expect(sitemap).not.toContain('/creators');
  });

  test('creator referral code crosses the public-to-browser signup boundary', async ({ page }) => {
    const ref = '11111111-1111-4111-8111-111111111111';
    await page.goto(`/index.html?creator=MAYA2026&ref=${ref}&src=creator`);
    const signup = new URL(await page.locator('a[href*="mode=signup"]').first().getAttribute('href') || '');
    expect(signup.searchParams.get('creator')).toBe('MAYA2026');
    expect(signup.searchParams.get('ref')).toBe(ref);
    expect(signup.searchParams.get('src')).toBe('creator');
  });

  test('signed-in web preserves creator codes until compliant attribution and shows active badge', () => {
    const appScript = readFileSync(resolve('app/app.js'), 'utf8');
    const appTemplate = readFileSync(resolve('app/index.html'), 'utf8');
    expect(appScript).toContain("var CREATOR_CODE_KEY = 'drop.creatorCode'");
    expect(appScript).toContain("supa.rpc('signup_compliance_status')");
    expect(appScript).toContain("supa.rpc('record_creator_referral', { p_code: code })");
    expect(appScript.indexOf("supa.rpc('signup_compliance_status')"))
      .toBeLessThan(appScript.indexOf("supa.rpc('record_creator_referral', { p_code: code })"));
    expect(appScript).toContain("creator_status,creator_code");
    expect(appTemplate).toContain('id="signup-creator-code"');
    expect(appTemplate).toContain('aria-label="Drop Creator"');
    expect(appTemplate).toContain('<sc-if value="{{ prof.isCreator }}">');
  });

  test('TikTok production stays read-only while sandbox asks for publishing consent', async ({ page }) => {
    const appScript = readFileSync(resolve('app/app.js'), 'utf8');
    const appTemplate = readFileSync(resolve('app/index.html'), 'utf8');
    expect(appTemplate).not.toMatch(/<base\s/i);
    expect(appTemplate).toContain("location.pathname === '/tiktok/callback'");
    expect(appTemplate).toContain("searchParams.set('tiktok_callback', '1')");
    expect(appTemplate).toContain('{{ tiktokButtonLabel }}');
    expect(appScript).toContain(": 'user.info.basic,video.list';");
    expect(appScript).toContain("? 'user.info.basic,video.list,video.upload,video.publish'");
    expect(appScript).not.toMatch(/video\.delete/);
    expect(appScript).toContain("config.data.redirectUri !== 'https://app.trydropapp.com/tiktok/callback'");
    expect(appScript).toContain("const state = randomToken(32), codeVerifier = sandbox ? null : randomToken(64)");
    expect(appScript).toContain("...(codeVerifier ? {");
    expect(appScript).toContain("code_challenge_method: 'S256'");
    expect(appScript).toContain("params.get('state') !== flow.state");
    expect(appScript).toContain("get('tiktok_sandbox') === '1'");
    expect(appScript).toContain("tiktok-oauth-sandbox");
    expect(appScript).toContain("flow.functionName === 'tiktok-oauth-sandbox'");
    expect(appScript.indexOf("sessionStorage.removeItem('drop.tiktok.oauth')", appScript.indexOf('async resumeTikTokCallback')))
      .toBeLessThan(appScript.indexOf("body: { code: params.get('code')", appScript.indexOf('async resumeTikTokCallback')));

    const appAssetRequests: string[] = [];
    await page.route('**/tiktok/callback?**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: appTemplate }));
    for (const asset of ['tokens.css', 'app.css', 'app.js']) {
      await page.route(`**/${asset}?*`, (route) => {
        appAssetRequests.push(new URL(route.request().url()).pathname);
        return route.fulfill({ status: 200, contentType: asset.endsWith('.css') ? 'text/css' : 'text/javascript', body: '' });
      });
    }
    await page.goto('/tiktok/callback?code=once&state=expected');
    expect(new URL(page.url()).pathname).toBe('/');
    expect(new URL(page.url()).searchParams.get('tiktok_callback')).toBe('1');
    expect(appAssetRequests.sort()).toEqual(['/app.css', '/app.js', '/tokens.css']);
  });

  test('TikTok site-verification artifacts are served unchanged by the deploy build', async ({ request }) => {
    const filenames = [
      'tiktok3KrSWG3sUOucxtykK5XlHMXDu5JZXf7J.txt',
      'tiktok3vSsOjcdAwZqkeershAZQumPuThIJ0JS.txt',
    ];
    for (const filename of filenames) {
      const artifact = readFileSync(resolve(filename));
      const response = await request.get(`/${filename}`);
      expect(response.status()).toBe(200);
      expect(await response.body()).toEqual(artifact);
    }
    const buildScript = readFileSync(resolve('scripts/build-dist.sh'), 'utf8');
    expect(buildScript).toContain(`cp ${filenames.join(' ')} dist/app/`);
  });

  test('link-in-bio sends visitors to the live App Store listing', async ({ page }) => {
    await page.goto('/link.html');
    await expect(page.locator('#getApp')).toHaveAttribute('href', 'https://apps.apple.com/us/app/drop-edm-events/id6790662825');
    await expect(page.locator('#aboutDrop')).toHaveAttribute('href', '/download.html');
    await expect(page.getByText('iPhone · Free', { exact: true })).toBeVisible();
  });

  test('event page shows a single honest ticket listing with no exclusivity claim', async ({ page }) => {
    await page.setViewportSize({ width: 498, height: 608 });
    const fakeId = '7b6f66aa-2f6d-4f6e-9d55-1c2b3a4d5e6f';
    const fakeVenueId = '9f4327fb-b0ca-46dd-a210-84bce2269c2c';
    const fakeEvent = {
      id: fakeId, title: 'Test Rave', description: 'A test show.',
      date: '2027-01-15T20:00:00', end_date: null, venue_id: fakeVenueId, venue_name: 'Test Hall',
      city: 'Denver', state: 'CO', image_url: null,
      ticket_url: 'https://www.ticketmaster.com/e/123',
      price_min: 45, price_max: null, currency: 'USD',
      is_festival: false, time_tbd: false, status: 'published',
      lifecycle_status: 'cancelled', ticket_status: 'unknown',
      created_at: '2026-07-01T00:00:00', event_artists: [],
    };
    await page.route('**/rest/v1/events?**', (route) => {
      const select = new URL(route.request().url()).searchParams.get('select') || '';
      expect(select).toContain('lifecycle_status');
      expect(select).toContain('ticket_status');
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([fakeEvent]) });
    });
    await page.route('**/rest/v1/rpc/event_going_counts', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

    await page.goto(`/event.html?id=${fakeId}`);
    await expect(page.locator('.ed-buybox [title="Log in to RSVP"]')).toHaveCount(2);
    await expect(page.locator('.ed-facts a', { hasText: 'Test Hall' }))
      .toHaveAttribute('href', `/venue/${fakeVenueId}/test-hall-denver`);
    // One honest row — real seller name from the URL, no fabricated competitors,
    // and no "Only seller" badge/notice (it implied exclusivity, but resale
    // markets usually also carry the show — removed 2026-07-16, founder call).
    await expect(page.locator('.ed-price-row')).toHaveCount(1);
    await expect(page.locator('.ed-price-row')).toContainText('Ticketmaster');
    await expect(page.locator('.ed-best')).toHaveCount(0);
    await expect(page.locator('.ed-single-note')).toHaveCount(0);
    await expect(page.locator('.ed-section', { hasText: 'Tickets' })).not.toContainText('only');
    await expect(page.locator('.ed-onsale')).toHaveText(/Event canceled/);
    const ticketLinks = page.locator('.ed-price-row a, .ed-buybox > a, #sticky-cta > a.btn--primary');
    await expect(ticketLinks).toHaveCount(3);
    expect(await ticketLinks.allTextContents()).toEqual([
      'View ticket details', 'View ticket details', 'Tickets',
    ]);
    await expect(page.locator('#sticky-cta > a.btn--primary')).toHaveAccessibleName('View ticket details');
    const stickyLayout = await page.locator('#sticky-cta').evaluate((bar) => {
      const ticket = bar.querySelector<HTMLElement>('.ed-bottombar__tickets');
      const children = [...bar.children].map((child) => (child as HTMLElement).getBoundingClientRect());
      return {
        noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth,
        ticketFits: !!ticket && ticket.scrollWidth <= ticket.clientWidth && ticket.scrollHeight <= ticket.clientHeight,
        noOverlap: children.every((rect, index) => index === 0 || rect.left >= children[index - 1].right),
      };
    });
    expect(stickyLayout).toEqual({ noHorizontalOverflow: true, ticketFits: true, noOverlap: true });
    await page.setViewportSize({ width: 320, height: 568 });
    const compactLayout = await page.locator('#sticky-cta').evaluate((bar) => {
      const ticket = bar.querySelector<HTMLElement>('.ed-bottombar__tickets');
      const content = document.querySelector<HTMLElement>('.ed-wrap');
      return {
        reserved: !!content && bar.getBoundingClientRect().height <= parseFloat(getComputedStyle(content).paddingBottom),
        ticketFits: !!ticket && ticket.scrollWidth <= ticket.clientWidth && ticket.scrollHeight <= ticket.clientHeight,
        noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth,
      };
    });
    expect(compactLayout).toEqual({ reserved: true, ticketFits: true, noHorizontalOverflow: true });
    const ld = JSON.parse(await page.locator('#ldjson').textContent() || '{}');
    expect(ld.eventStatus).toBe('https://schema.org/EventCancelled');
    expect(ld.offers.url).toBe(fakeEvent.ticket_url);
    expect(ld.offers.availability).toBeUndefined();
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
