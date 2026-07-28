import { expect, test, type Page } from '@playwright/test';

const APP = '/app/next';
const SUPABASE = 'https://ebccwnkmsnhbljxxxdej.supabase.co';
const STORAGE_KEY = 'sb-ebccwnkmsnhbljxxxdej-auth-token';
type MockOptions = {
  actionReadError?: boolean;
  blockError?: boolean;
  compliance?: boolean | 'error' | 'hang';
  commentError?: boolean;
  commentOverflow?: boolean;
  loginError?: boolean;
  logoutFailure?: boolean;
  pastEvent?: boolean;
  personalized?: boolean;
  presaleBoundary?: boolean;
  detailFeatures?: boolean;
  delayedActionWrite?: boolean;
  delayedProfile?: boolean;
  delayedSaved?: boolean;
  delayedWeather?: boolean;
  duplicateCities?: boolean;
  profileCity?: string | null;
  profileState?: string | null;
  savedEvent?: boolean;
  singleUnlinkedOffer?: boolean;
  tbdEvent?: boolean;
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

const dropEvent = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Prism Nights',
  description: 'A full night of house music in Denver.',
  date: '2027-08-20T03:00:00.000Z',
  end_date: null,
  venue_id: 'venue-1',
  venue_name: 'Mission Ballroom',
  city: 'Denver',
  state: 'CO',
  image_url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30',
  ticket_url: 'https://example.com/tickets',
  price_min: 35,
  price_max: 55,
  currency: 'USD',
  source: 'ticketmaster',
  is_festival: false,
  time_tbd: false,
  timezone: 'America/Denver',
  presale_start: null,
  onsale_start: null,
  status: 'published',
  event_artists: [{ position: 0, artists: { id: 'artist-1', name: 'Neon Current', genres: ['House'], image_url: null } }],
};

const coastEvent = {
  ...dropEvent,
  id: '22222222-2222-4222-8222-222222222222',
  title: 'Coast Frequency',
  venue_name: 'Sound',
  city: 'Los Angeles',
  state: 'CA',
  price_min: 250,
  price_max: 300,
  source: 'seatgeek',
  event_artists: [{ position: 0, artists: { id: 'artist-2', name: 'Voltage Bloom', genres: ['Electronic', 'Techno'], image_url: null } }],
};

const morrisonEvent = {
  ...dropEvent,
  id: '44444444-4444-4444-8444-444444444444',
  title: 'Red Rocks Echo',
  venue_id: 'venue-2',
  venue_name: 'Red Rocks Amphitheatre',
  city: 'Morrison',
  state: 'Colorado',
  price_min: 75,
  price_max: 95,
  source: 'axs',
  event_artists: [{ position: 0, artists: { id: 'artist-3', name: 'Signal Path', genres: ['House'], image_url: null } }],
};

const endedEvent = {
  ...dropEvent,
  id: '33333333-3333-4333-8333-333333333333',
  title: 'Ended Frequency',
  date: '2020-08-20T03:00:00.000Z',
  presale_start: '2020-07-20T03:00:00.000Z',
};

const featureEvent = {
  ...dropEvent,
  date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  presale_start: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  onsale_start: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

const siblingFeatureEvent = {
  ...featureEvent,
  id: '55555555-5555-4555-8555-555555555555',
  date: new Date(Date.parse(featureEvent.date) + 2 * 60 * 60 * 1000).toISOString(),
  venue_id: null,
  venue_name: 'Missiøn Ballrøøm',
  state: 'Colorado',
  source: 'seatgeek',
};

const wrongStateFeatureEvent = {
  ...featureEvent,
  id: '66666666-6666-4666-8666-666666666666',
  state: 'CA',
  source: 'dice',
};

const portlandOregonEvent = {
  ...dropEvent,
  id: '77777777-7777-4777-8777-777777777777',
  title: 'Rose City Pulse',
  city: 'Portland',
  state: 'OR',
};

const portlandMaineEvent = {
  ...dropEvent,
  id: '88888888-8888-4888-8888-888888888888',
  title: 'Casco Bay Pulse',
  city: 'Portland',
  state: 'ME',
};

async function mockSupabase(page: Page, authenticated = false, options: MockOptions = {}) {
  const mockedWrites: string[] = [];
  let commentRows = options.commentOverflow
    ? Array.from({ length: 101 }, (_, index) => ({
      id: `comment-${index + 1}`,
      event_id: dropEvent.id,
      user_id: '00000000-0000-4000-8000-000000000002',
      body: `Comment ${index + 1}`,
      created_at: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
      profiles: {
        id: '00000000-0000-4000-8000-000000000002',
        username: 'nightowl',
        display_name: 'Night Owl',
        profile_image: null,
      },
    }))
    : options.detailFeatures ? [{
    id: 'comment-1',
    event_id: dropEvent.id,
    user_id: '00000000-0000-4000-8000-000000000002',
    body: 'Meet by the south entrance.',
    created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    profiles: {
      id: '00000000-0000-4000-8000-000000000002',
      username: 'nightowl',
      display_name: 'Night Owl',
      profile_image: null,
    },
    }] : [];
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
    if (url.pathname === '/functions/v1/event-weather') {
      if (options.delayedWeather) await new Promise((resolve) => setTimeout(resolve, 1_200));
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          weather: {
            temperature: 72,
            temperatureUnit: 'F',
            shortForecast: 'Clear',
            precipitationProbability: 10,
            windSpeed: '5 mph',
            windDirection: 'W',
            forecastTime: featureEvent.date,
          },
        }),
      });
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
    if (url.pathname === '/rest/v1/rpc/recap_crew_for') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(options.personalized ? [{ id: '00000000-0000-4000-8000-000000000002' }] : []),
      });
    }
    if (url.pathname === '/rest/v1/profiles') {
      if (options.delayedProfile) await new Promise((resolve) => setTimeout(resolve, 1_500));
      return route.fulfill({
        status: 200,
        headers: { 'content-range': '0-0/1' },
        contentType: 'application/json',
        body: JSON.stringify([{
          ...profile,
          city: Object.prototype.hasOwnProperty.call(options, 'profileCity') ? options.profileCity : profile.city,
          state: Object.prototype.hasOwnProperty.call(options, 'profileState') ? options.profileState : profile.state,
        }]),
      });
    }
    if (url.pathname === '/rest/v1/artist_follows') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(options.personalized ? [{ artist_id: 'artist-2' }] : []),
      });
    }
    if (url.pathname === '/rest/v1/artists') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(options.personalized ? [{ genres: ['Techno'] }] : []),
      });
    }
    if (url.pathname === '/rest/v1/friendships') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(options.personalized ? [{
          requester_id: user.id,
          recipient_id: '00000000-0000-4000-8000-000000000002',
          status: 'accepted',
        }] : []),
      });
    }
    if (url.pathname === '/rest/v1/user_blocks') {
      if (options.blockError) {
        return route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"blocks unavailable"}' });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    if (url.pathname === '/rest/v1/saved_events' || url.pathname === '/rest/v1/venue_follows') {
      if (method === 'GET' && options.actionReadError) {
        return route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"action state unavailable"}' });
      }
      if (url.pathname === '/rest/v1/saved_events' && method === 'GET' && options.delayedSaved) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      if (method !== 'GET' && options.delayedActionWrite) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      return route.fulfill({
        status: method === 'GET' ? 200 : 201,
        contentType: 'application/json',
        body: JSON.stringify(
          url.pathname === '/rest/v1/saved_events' && method === 'GET' && options.savedEvent
            ? [{ event_id: dropEvent.id }]
            : [],
        ),
      });
    }
    if (url.pathname === '/rest/v1/ticket_offers') {
      const rows = options.singleUnlinkedOffer ? [{
        id: 'offer-2',
        event_id: dropEvent.id,
        vendor: 'SeatGeek',
        url: null,
        price_min: 40,
        price_max: 40,
        currency: 'USD',
      }] : options.detailFeatures ? [
        {
          id: 'offer-1',
          event_id: dropEvent.id,
          vendor: 'Ticketmaster',
          url: 'https://tickets.example.com/ticketmaster',
          price_min: 50,
          price_max: 50,
          currency: 'USD',
          fetched_at: '2026-07-01T00:00:00.000Z',
        },
        {
          id: 'offer-3',
          event_id: siblingFeatureEvent.id,
          vendor: 'Ticketmaster',
          url: 'https://tickets.example.com/ticketmaster-fresh',
          price_min: 45,
          price_max: 45,
          currency: 'USD',
          fetched_at: '2026-07-03T00:00:00.000Z',
        },
        {
          id: 'offer-2',
          event_id: siblingFeatureEvent.id,
          vendor: 'SeatGeek',
          url: null,
          price_min: 40,
          price_max: 40,
          currency: 'USD',
          fetched_at: '2026-07-02T00:00:00.000Z',
        },
        {
          id: 'offer-wrong-state',
          event_id: wrongStateFeatureEvent.id,
          vendor: 'WrongState',
          url: 'https://tickets.example.com/wrong-state',
          price_min: 1,
          price_max: 1,
          currency: 'USD',
          fetched_at: '2026-07-04T00:00:00.000Z',
        },
      ] : [];
      const filter = url.searchParams.get('event_id') ?? '';
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(rows.filter((row) => filter.includes(row.event_id))),
      });
    }
    if (url.pathname === '/rest/v1/event_comments') {
      if (method === 'GET' && options.commentError) {
        return route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"comments unavailable"}' });
      }
      if (method === 'POST') {
        const payload = request.postDataJSON() as { body?: string } | { body?: string }[];
        const row = Array.isArray(payload) ? payload[0] : payload;
        commentRows = [...commentRows, {
          id: `comment-${commentRows.length + 1}`,
          event_id: dropEvent.id,
          user_id: user.id,
          body: row?.body ?? '',
          created_at: new Date().toISOString(),
          profiles: {
            id: user.id,
            username: profile.username,
            display_name: profile.display_name,
            profile_image: profile.profile_image,
          },
        }];
        return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
      }
      if (method === 'DELETE') {
        commentRows = commentRows.filter((comment) => !url.searchParams.get('id')?.includes(comment.id));
        return route.fulfill({ status: 204, body: '' });
      }
      const descending = url.searchParams.get('order')?.includes('desc') ?? false;
      const limit = Number(url.searchParams.get('limit') ?? commentRows.length);
      const rows = [...commentRows]
        .sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at))
        .slice(descending ? -limit : 0, descending ? undefined : limit);
      if (descending) rows.reverse();
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
    }
    if (url.pathname === '/rest/v1/content_reports') {
      return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    }
    if (url.pathname === '/rest/v1/events') {
      const dateFilters = url.searchParams.getAll('date');
      const isOfferCandidateQuery = dateFilters.some((value) => value.startsWith('gte.'))
        && dateFilters.some((value) => value.startsWith('lte.'));
      const eventRows = isOfferCandidateQuery && options.detailFeatures
        ? [featureEvent, siblingFeatureEvent, wrongStateFeatureEvent]
        : options.duplicateCities
          ? [portlandOregonEvent, portlandMaineEvent]
        : options.pastEvent
          ? [endedEvent]
          : options.presaleBoundary
            ? [{
              ...featureEvent,
              presale_start: new Date(Date.now() + 5_000).toISOString(),
              onsale_start: new Date(Date.now() + 10_000).toISOString(),
            }]
          : options.tbdEvent
            ? [{
              ...featureEvent,
              date: '2027-08-01T12:00:00.000Z',
              time_tbd: true,
              end_date: '2027-08-04T05:59:59.000Z',
            }]
            : options.detailFeatures
              ? [featureEvent]
              : options.personalized
                ? [dropEvent, coastEvent, morrisonEvent]
                : [dropEvent];
      const idFilter = url.searchParams.get('id');
      const filteredRows = idFilter ? eventRows.filter((event) => idFilter.includes(event.id)) : eventRows;
      return route.fulfill({
        status: 200,
        headers: { 'content-range': options.personalized ? '0-2/3' : '0-0/1' },
        contentType: 'application/json',
        body: JSON.stringify(filteredRows),
      });
    }
    if (url.pathname === '/rest/v1/attendance') {
      return route.fulfill({
        status: 200,
        headers: { 'content-range': options.personalized ? '0-0/1' : '*/0' },
        contentType: 'application/json',
        body: JSON.stringify(options.personalized ? [{ event_id: dropEvent.id }] : []),
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
    await expect(mobile.getByRole('link', { name: /^search$/i })).toBeVisible();
    await expect(mobile.getByRole('link', { name: /my shows/i })).toBeVisible();
    await expect(mobile.getByRole('link', { name: /^crew$/i })).toBeVisible();
    await expect(mobile.getByRole('link', { name: /^profile$/i })).toBeVisible();
    await expect(mobile.getByRole('link', { name: /^map$/i })).toHaveCount(0);
    await expect(mobile.getByRole('link', { name: /^friends$/i })).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: /^primary$/i })).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });

  test('discover loads real event data and event detail is a child route without the tab bar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const mockedWrites = await mockSupabase(page, true);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: ({ url }: { url: string }) => {
          (window as typeof window & { __sharedUrl?: string }).__sharedUrl = url;
          return Promise.resolve();
        },
      });
    });
    await page.goto(`${APP}/`);

    await expect(page.getByRole('heading', { name: /shows near denver/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Happening' })).toHaveAttribute('aria-pressed', 'true');
    const card = page.getByRole('link', { name: /open prism nights/i });
    await expect(card).toContainText('Mission Ballroom');
    await expect(card).toContainText('House');
    await expect(card).toContainText('9:00 PM');
    await card.click();

    await expect(page).toHaveURL(new RegExp(`${APP}/event/${dropEvent.id}/?$`));
    await expect(page.getByRole('heading', { name: 'Prism Nights' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: /mobile navigation/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /go back/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /get tickets/i })).toHaveAttribute('rel', /noopener/);

    await page.getByRole('button', { name: /share show/i }).click();
    await expect.poll(() => page.evaluate(() => (window as typeof window & { __sharedUrl?: string }).__sharedUrl))
      .toBe(`https://trydropapp.com/event.html?id=${dropEvent.id}`);

    await page.getByRole('button', { name: /^going$/i }).click();
    await expect.poll(() => mockedWrites.filter((entry) => entry === 'POST /rest/v1/attendance').length).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });

  test('personalized discover tabs use real follows and crew attendance while search remains global', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockSupabase(page, true, { personalized: true });
    await page.goto(`${APP}/`);

    await page.getByRole('button', { name: 'For You' }).click();
    await expect(page.getByRole('link', { name: /open coast frequency/i })).toBeVisible();
    await page.getByRole('button', { name: 'Crew' }).click();
    await expect(page.getByRole('link', { name: /open prism nights/i })).toBeVisible();

    await page.getByRole('navigation', { name: /mobile navigation/i })
      .getByRole('link', { name: /^search$/i }).click();
    await page.getByRole('textbox', { name: /search artists, venues, and shows/i }).fill('Los Angeles');
    await expect(page.getByRole('link', { name: /open coast frequency/i })).toBeVisible();
  });

  test('search matches the native calm state, grouped typeahead, and multi-filter sheet', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.context().grantPermissions(['geolocation']);
    await page.context().setGeolocation({ latitude: 39.7392, longitude: -104.9903 });
    await mockSupabase(page, true, { personalized: true });
    await page.goto(`${APP}/`);
    await page.getByRole('navigation', { name: /mobile navigation/i }).getByRole('link', { name: /^search$/i }).click();

    await expect(page.getByRole('heading', { name: /trending genres/i })).toBeVisible();
    await expect(page.locator('section[aria-labelledby="trending-genres-heading"] .chip-rail button').first()).toHaveText('House');
    await expect(page.getByText('UPCOMING', { exact: true })).toBeVisible();

    const search = page.getByRole('textbox', { name: /search artists, venues, and shows/i });
    await search.fill('Mission');
    const suggestions = page.getByRole('region', { name: /search suggestions/i });
    await expect(suggestions.getByText('Venues', { exact: true })).toBeVisible();
    await expect(suggestions.getByText('Mission Ballroom', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /^filters$/i }).focus();
    await expect(suggestions).toHaveCount(0);
    await search.fill('Prism');
    await suggestions.getByRole('link', { name: /Prism Nights/i }).click();
    await expect(page.getByRole('heading', { name: 'Prism Nights' })).toBeVisible();
    await page.getByRole('button', { name: /go back/i }).click();
    await page.locator('.recent-searches').getByRole('link', { name: /Prism Nights/i }).click();
    await expect(page.getByRole('heading', { name: 'Prism Nights' })).toBeVisible();
    await page.getByRole('button', { name: /go back/i }).click();
    await search.fill('');

    const filterButton = page.getByRole('button', { name: /^filters$/i });
    await filterButton.click();
    const dialog = page.getByRole('dialog', { name: /^filters$/i });
    await expect(dialog.getByRole('button', { name: /close filters/i })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(dialog.getByRole('button', { name: /show 3 results/i })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(filterButton).toBeFocused();
    await filterButton.click();
    await expect(dialog.getByText('Location', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Distance', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Price', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Genres', { exact: true })).toBeVisible();
    await expect(dialog.getByText('City', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /today|this weekend|next 30 days/i })).toHaveCount(0);

    const minimumPrice = dialog.getByLabel('Minimum price');
    const maximumPrice = dialog.getByLabel('Maximum price');
    const setRange = (input: typeof minimumPrice, value: number) => input.evaluate((element, next) => {
      const range = element as HTMLInputElement;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(range, String(next));
      range.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
    await setRange(maximumPrice, 100);
    await setRange(minimumPrice, 50);
    await expect(dialog.getByRole('button', { name: /show 2 results/i })).toBeVisible();
    await setRange(maximumPrice, 200);
    await setRange(minimumPrice, 200);
    await expect(minimumPrice).toHaveCSS('z-index', '2');
    await expect(maximumPrice).toHaveCSS('z-index', '1');
    await setRange(minimumPrice, 100);
    await expect(minimumPrice).toHaveValue('100');
    await setRange(minimumPrice, 0);

    await dialog.getByRole('button', { name: /city.*all cities/i }).click();
    await dialog.getByLabel('Los Angeles, CA', { exact: true }).check();
    await dialog.getByRole('button', { name: /city.*1 selected/i }).click();
    await dialog.getByRole('button', { name: /genres.*all genres/i }).click();
    await dialog.getByLabel('Techno', { exact: true }).check();
    await expect(dialog.getByRole('button', { name: /show 1 results/i })).toBeVisible();
    await dialog.getByRole('button', { name: /show 1 results/i }).click();

    await expect(page.getByRole('button', { name: /filters, 2 active/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /open coast frequency/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /open prism nights/i })).toHaveCount(0);

    await page.locator('.filter-summary').click();
    await dialog.getByRole('button', { name: /^reset$/i }).click();
    await dialog.getByRole('button', { name: /close filters/i }).click();
    const resetFilterButton = page.getByRole('button', { name: /^filters$/i });
    await expect(resetFilterButton).toBeFocused();
    await resetFilterButton.click();
    await dialog.getByRole('button', { name: /^refresh$/i }).click();
    await expect(dialog.getByText('Denver, CO', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /show 1 results/i })).toBeVisible();
    await dialog.getByRole('button', { name: /show 1 results/i }).click();
    await expect(page.getByRole('link', { name: /open prism nights/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /open coast frequency/i })).toHaveCount(0);

    await page.getByRole('button', { name: /filters, 1 active/i }).click();
    await dialog.getByRole('button', { name: /^25 mi$/i }).click();
    await expect(dialog.getByRole('button', { name: /show 2 results/i })).toBeVisible();
    await dialog.getByRole('button', { name: /show 2 results/i }).click();
    await expect(page.getByRole('link', { name: /open red rocks echo/i })).toBeVisible();

    await page.getByRole('button', { name: /filters, 2 active/i }).click();
    await dialog.getByRole('button', { name: /city.*all cities/i }).click();
    await dialog.getByLabel('Los Angeles, CA', { exact: true }).check();
    await expect(dialog.getByRole('button', { name: /^any$/i })).toHaveAttribute('aria-pressed', 'true');
    await dialog.getByRole('button', { name: /show 1 results/i }).click();
    await expect(page.getByRole('link', { name: /open coast frequency/i })).toBeVisible();

    await search.fill('Los Angeles');
    await page.getByRole('region', { name: /search suggestions/i }).getByRole('button', { name: /Los Angeles/i }).click();
    await expect(page.getByRole('link', { name: /open coast frequency/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /open red rocks echo/i })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });

  for (const [label, profileState] of [['full state names', 'Colorado'], ['blank states', null]] as const) {
    test(`profile locations with ${label} keep distance filters available`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await mockSupabase(page, true, { personalized: true, profileState });
      await page.goto(`${APP}/`);
      await page.getByRole('navigation', { name: /mobile navigation/i }).getByRole('link', { name: /^search$/i }).click();
      await page.getByRole('button', { name: /^filters$/i }).click();
      const dialog = page.getByRole('dialog', { name: /^filters$/i });

      await expect(dialog.getByText(profileState ? 'Denver, CO' : 'Denver', { exact: true })).toBeVisible();
      await expect(dialog.getByRole('button', { name: /^25 mi$/i })).toBeEnabled();
    });
  }

  test('discover and exact location filters distinguish cities that share a name', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockSupabase(page, true, {
      duplicateCities: true,
      profileCity: 'Portland',
      profileState: 'OR',
    });
    await page.goto(`${APP}/`);
    await expect(page.getByRole('link', { name: /open rose city pulse/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /open casco bay pulse/i })).toHaveCount(0);
    await page.getByRole('navigation', { name: /mobile navigation/i }).getByRole('link', { name: /^search$/i }).click();
    await page.getByRole('button', { name: /^filters$/i }).click();
    const dialog = page.getByRole('dialog', { name: /^filters$/i });

    await dialog.locator('.filter-location input').check();
    await dialog.getByRole('button', { name: /show 1 results/i }).click();
    await expect(page.getByRole('link', { name: /open rose city pulse/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /open casco bay pulse/i })).toHaveCount(0);

    await page.getByRole('button', { name: /filters, 1 active/i }).click();
    await dialog.getByRole('button', { name: /^reset$/i }).click();
    await dialog.getByRole('button', { name: /city.*all cities/i }).click();
    await dialog.locator('.filter-options').getByLabel('Portland, OR', { exact: true }).check();
    await dialog.getByRole('button', { name: /show 1 results/i }).click();
    await expect(page.getByRole('link', { name: /open rose city pulse/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /open casco bay pulse/i })).toHaveCount(0);
  });

  test('profile hydration does not replace a selected browser location', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.context().grantPermissions(['geolocation']);
    await page.context().setGeolocation({ latitude: 34.0522, longitude: -118.2437 });
    await mockSupabase(page, true, { delayedProfile: true });
    const profileLoaded = page.waitForResponse((response) => response.url().includes('/rest/v1/profiles'));
    await page.goto(`${APP}/`);
    await page.getByRole('navigation', { name: /mobile navigation/i }).getByRole('link', { name: /^search$/i }).click();
    await page.getByRole('button', { name: /^filters$/i }).click();
    const dialog = page.getByRole('dialog', { name: /^filters$/i });

    await dialog.getByRole('button', { name: /^refresh$/i }).click();
    await expect(dialog.getByText('Los Angeles, CA', { exact: true })).toBeVisible();
    await profileLoaded;
    await expect(dialog.getByText('Los Angeles, CA', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Denver, CO', { exact: true })).toHaveCount(0);
  });

  test('event detail supports saves, venue follows, calendar, offers, presale, weather, and moderated comments', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const presaleReads: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/rest/v1/presale_codes')) presaleReads.push(request.url());
    });
    const mockedWrites = await mockSupabase(page, true, { detailFeatures: true, delayedActionWrite: true });
    await page.goto(`${APP}/`);
    await page.getByRole('link', { name: /open prism nights/i }).click();

    await expect(page.getByRole('heading', { name: 'Prism Nights' })).toBeVisible();
    await expect(page.getByText('72°F · Clear · 10% precip')).toBeVisible();
    await expect(page.getByRole('heading', { name: /presale is live now/i })).toBeVisible();
    await expect(page.getByText(/check the artist or venue socials/i)).toBeVisible();
    expect(presaleReads).toEqual([]);

    const savedButton = page.getByRole('button', { name: /save show|saved/i });
    const venueButton = page.getByRole('button', { name: /follow venue|following venue/i });
    await savedButton.click();
    await expect(venueButton).toBeDisabled();
    await expect.poll(() => mockedWrites.filter((entry) => entry === 'POST /rest/v1/saved_events').length).toBe(1);
    await venueButton.click();
    await expect(savedButton).toBeDisabled();
    await expect.poll(() => mockedWrites.filter((entry) => entry === 'POST /rest/v1/venue_follows').length).toBe(1);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /add to calendar/i }).click();
    await expect((await downloadPromise).suggestedFilename()).toMatch(/Prism-Nights\.ics$/);

    await expect(page.getByRole('button', { name: /SeatGeek.*LOWEST KNOWN/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /SeatGeek.*Listed from/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /WrongState/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /get tickets/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /ticket link unavailable/i })).toBeDisabled();
    await page.getByRole('button', { name: /Ticketmaster/i }).click();
    await expect(page.getByRole('link', { name: /get tickets.*ticketmaster/i })).toHaveAttribute('href', 'https://tickets.example.com/ticketmaster-fresh');

    await expect(page.getByText('Meet by the south entrance.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reply to Night Owl' })).toBeVisible();
    const reportComment = page.getByRole('button', { name: 'Report comment by Night Owl' });
    await expect(reportComment).toBeVisible();
    await reportComment.click();
    await expect.poll(() => mockedWrites.filter((entry) => entry === 'POST /rest/v1/content_reports').length).toBe(1);
    await expect(page.getByText('Meet by the south entrance.')).toHaveCount(0);

    await page.getByLabel('Add a comment').fill('See everyone inside.');
    await page.getByRole('button', { name: /post comment/i }).click();
    await expect.poll(() => mockedWrites.filter((entry) => entry === 'POST /rest/v1/event_comments').length).toBe(1);
    await expect(page.getByText('See everyone inside.')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });

  test('presale timing never fetches embargoed code rows into the browser', async ({ page }) => {
    await page.clock.install();
    const presaleReads: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/rest/v1/presale_codes')) presaleReads.push(request.url());
    });
    await mockSupabase(page, true, { presaleBoundary: true });
    await page.goto(`${APP}/`);
    await page.getByRole('link', { name: /open prism nights/i }).click();

    await expect(page.getByRole('heading', { name: /presale upcoming/i })).toBeVisible();
    await page.clock.fastForward(6_000);
    await expect(page.getByRole('heading', { name: /presale is live now/i })).toBeVisible();
    await expect(page.getByText(/check the artist or venue socials/i)).toBeVisible();
    await page.clock.fastForward(5_000);
    await expect(page.getByRole('heading', { name: /presale/i })).toHaveCount(0);
    expect(presaleReads).toEqual([]);
  });

  test('event detail waits for saved and follow state before enabling actions', async ({ page }) => {
    const mockedWrites = await mockSupabase(page, true, { delayedSaved: true, savedEvent: true });
    await page.goto(`${APP}/`);
    const hydrationStarted = page.waitForRequest((request) =>
      request.method() === 'GET' && request.url().includes('/rest/v1/saved_events'));
    await page.getByRole('link', { name: /open prism nights/i }).click();
    await hydrationStarted;

    await expect(page.getByRole('heading', { name: 'Prism Nights' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^saved$/i })).toBeVisible();
    await page.getByRole('button', { name: /^saved$/i }).click();
    await expect.poll(() => mockedWrites.filter((entry) => entry === 'DELETE /rest/v1/saved_events').length).toBe(1);
    expect(mockedWrites.filter((entry) => entry === 'POST /rest/v1/saved_events')).toHaveLength(0);
  });

  test('optional weather does not block event detail rendering', async ({ page }) => {
    await mockSupabase(page, true, { detailFeatures: true, delayedWeather: true });
    await page.goto(`${APP}/`);
    const weatherStarted = page.waitForRequest((request) => request.url().includes('/functions/v1/event-weather'));
    await page.getByRole('link', { name: /open prism nights/i }).click();
    await weatherStarted;

    await expect(page.getByRole('heading', { name: 'Prism Nights' })).toBeVisible({ timeout: 500 });
    await expect(page.getByText('72°F · Clear · 10% precip')).toBeVisible();
  });

  test('action-state read failures keep save and venue follow disabled', async ({ page }) => {
    await mockSupabase(page, true, { actionReadError: true });
    await page.goto(`${APP}/`);
    await page.getByRole('link', { name: /open prism nights/i }).click();

    await expect(page.getByRole('heading', { name: 'Prism Nights' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText(/some show actions are unavailable/i);
    await expect(page.getByRole('button', { name: /save show/i })).toBeDisabled();
    await expect(page.getByRole('button', { name: /follow venue/i })).toBeDisabled();
  });

  test('a single unlinked offer keeps the event purchase URL', async ({ page }) => {
    await mockSupabase(page, true, { singleUnlinkedOffer: true });
    await page.goto(`${APP}/`);
    await page.getByRole('link', { name: /open prism nights/i }).click();

    await expect(page.getByRole('link', { name: /^get tickets$/i })).toHaveAttribute('href', dropEvent.ticket_url);
    await expect(page.getByRole('button', { name: /ticket link unavailable/i })).toHaveCount(0);
  });

  test('multi-day time-TBA calendar downloads preserve an exclusive all-day end', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockSupabase(page, true, { tbdEvent: true });
    await page.goto(`${APP}/`);
    await page.getByRole('link', { name: /open prism nights/i }).click();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /add to calendar/i }).click();
    const stream = await (await downloadPromise).createReadStream();
    let calendar = '';
    for await (const chunk of stream) calendar += chunk.toString();
    expect(calendar).toContain('DTSTART;VALUE=DATE:20270801');
    expect(calendar).toContain('DTEND;VALUE=DATE:20270804');
    expect(calendar).not.toMatch(/DT(?:START|END):\d{8}T/);
    expect(calendar).toContain('\r\n ');
    for (const line of calendar.split('\r\n')) {
      expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75);
    }
  });

  test('past event detail keeps sharing but hides RSVP and ticket actions', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const mockedWrites = await mockSupabase(page, true, { pastEvent: true });
    await page.goto(`${APP}/`);
    await page.getByRole('link', { name: /open ended frequency/i }).click();

    await expect(page.getByRole('heading', { name: 'Ended Frequency' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^going$/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^interested$/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /get tickets/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /save show/i })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /presale/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /add to calendar/i })).toHaveCount(0);
    await page.getByRole('button', { name: /follow venue/i }).click();
    await expect.poll(() => mockedWrites.filter((entry) => entry === 'POST /rest/v1/venue_follows').length).toBe(1);
    await expect(page.getByRole('button', { name: /share show/i })).toBeVisible();
  });

  test('comment failures show an honest retry state and suppress the composer', async ({ page }) => {
    await mockSupabase(page, true, { detailFeatures: true, commentError: true });
    await page.goto(`${APP}/`);
    await page.getByRole('link', { name: /open prism nights/i }).click();

    await expect(page.getByRole('alert')).toContainText(/comments are unavailable/i);
    await expect(page.getByRole('button', { name: /try again/i })).toBeVisible();
    await expect(page.getByLabel('Add a comment')).toHaveCount(0);
    await expect(page.getByText(/no comments yet/i)).toHaveCount(0);
  });

  test('block-list failures fail comments closed', async ({ page }) => {
    await mockSupabase(page, true, { detailFeatures: true, blockError: true });
    await page.goto(`${APP}/`);
    await page.getByRole('link', { name: /open prism nights/i }).click();

    await expect(page.getByRole('alert')).toContainText(/comments are unavailable/i);
    await expect(page.getByText('Meet by the south entrance.')).toHaveCount(0);
    await expect(page.getByLabel('Add a comment')).toHaveCount(0);
  });

  test('comments retain the newest 100 in chronological display order', async ({ page }) => {
    await mockSupabase(page, true, { commentOverflow: true });
    await page.goto(`${APP}/`);
    await page.getByRole('link', { name: /open prism nights/i }).click();

    await expect(page.getByText('Comment 101', { exact: true })).toBeVisible();
    await expect(page.getByText('Comment 1', { exact: true })).toHaveCount(0);
    const comments = page.locator('.comment-list article > p');
    await expect(comments).toHaveCount(100);
    await expect(comments.first()).toHaveText('Comment 2');
    await expect(comments.last()).toHaveText('Comment 101');
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
