import { expect, test, type Page } from '@playwright/test';

const APP = '/app/next';
const SUPABASE = 'https://ebccwnkmsnhbljxxxdej.supabase.co';
const STORAGE_KEY = 'sb-ebccwnkmsnhbljxxxdej-auth-token';
type MockOptions = {
  actionReadError?: boolean;
  alreadyCheckedIn?: boolean;
  attendedEvent?: boolean;
  alertOverflow?: boolean;
  blockError?: boolean;
  blockedFriend?: boolean;
  blockedByProfile?: boolean;
  canonicalLogged?: boolean;
  compliance?: boolean | 'error' | 'hang';
  commentError?: boolean;
  commentOverflow?: boolean;
  coordinateMissing?: boolean;
  crewReadError?: boolean;
  loginError?: boolean;
  logConflict?: boolean;
  logoutFailure?: boolean;
  ongoingEvent?: boolean;
  overlappingSetTimes?: boolean;
  pastEvent?: boolean;
  pastProfileGoing?: boolean;
  pendingFriendship?: boolean;
  personalized?: boolean;
  parityFeatures?: boolean;
  presaleBoundary?: boolean;
  detailFeatures?: boolean;
  delayedActionWrite?: boolean;
  delayedProfile?: boolean;
  delayedSaved?: boolean;
  delayedWeather?: boolean;
  delayedLivePoll?: boolean;
  duplicateCities?: boolean;
  profileCity?: string | null;
  profileMissing?: boolean;
  profileState?: string | null;
  invitedPlan?: boolean;
  crewCapReached?: boolean;
  activeBeyondGrace?: boolean;
  ambiguousArchive?: boolean;
  sameDayReminder?: boolean;
  savedEvent?: boolean;
  singleUnlinkedOffer?: boolean;
  tbdEvent?: boolean;
  tagReadError?: boolean;
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
  lat: 39.764,
  lng: -104.986,
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
  lat: 34.0522,
  lng: -118.2437,
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
  lat: 39.6654,
  lng: -105.2057,
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

const festivalEvent = {
  ...dropEvent,
  id: '99999999-9999-4999-8999-999999999999',
  title: 'Prism Festival',
  is_festival: true,
  venue_name: 'Civic Center Park',
  date: '2027-09-04T23:00:00.000Z',
};

const friendProfile = {
  ...profile,
  id: '00000000-0000-4000-8000-000000000002',
  username: 'nightowl',
  display_name: 'Night Owl',
};

async function mockSupabase(page: Page, authenticated = false, options: MockOptions = {}) {
  const mockedWrites: string[] = [];
  let setTimeReads = 0;
  let recapRating = 0;
  let recapSeenArtists: Array<{ id: string; artist_id: null; artist_name: string }> = [];
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
        body: JSON.stringify(options.personalized ? [
          { id: friendProfile.id, display_name: friendProfile.display_name, confirmed: true },
          { id: '00000000-0000-4000-8000-000000000003', display_name: 'Opted Out', confirmed: false },
        ] : []),
      });
    }
    if (url.pathname === '/rest/v1/rpc/list_known_venues') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ venue_name: 'Mission Ballroom', city: 'Denver', state: 'CO' }]),
      });
    }
    if (url.pathname === '/rest/v1/rpc/record_past_show') {
      const payload = request.postDataJSON() as { p_resolution?: string | null };
      if (options.logConflict && !payload.p_resolution) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'confirmation_required',
            candidate_event_id: dropEvent.id,
            existing_lineup: ['Neon Current'],
            incoming_lineup: ['Lane 8'],
          }),
        });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"recorded","logged_show_id":"logged-1"}' });
    }
    if (url.pathname === '/rest/v1/rpc/replace_logged_show_openers' || url.pathname === '/rest/v1/rpc/delete_past_show') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
    }
    if (url.pathname === '/rest/v1/rpc/is_blocked_with') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(options.blockedByProfile === true) });
    }
    if (url.pathname === '/rest/v1/rpc/public_profile') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: friendProfile.id,
          display_name: friendProfile.display_name,
          username: friendProfile.username,
          profile_image: friendProfile.profile_image,
        }),
      });
    }
    if (url.pathname === '/rest/v1/rpc/get_show_history_access') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"can_view":true,"is_public":false,"is_friend":true}' });
    }
    if (url.pathname === '/rest/v1/rpc/create_or_get_plan') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '"plan-1"' });
    }
    if (url.pathname === '/rest/v1/rpc/leave_plan') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: 'true' });
    }
    if (url.pathname === '/rest/v1/rpc/search_public_profiles') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([friendProfile]) });
    }
    if (url.pathname === '/rest/v1/rpc/get_friend_review_activity') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    if (url.pathname === '/rest/v1/profiles') {
      if (options.delayedProfile) await new Promise((resolve) => setTimeout(resolve, 1_500));
      return route.fulfill({
        status: 200,
        headers: { 'content-range': '0-0/1' },
        contentType: 'application/json',
        body: JSON.stringify(options.profileMissing ? [] : [{
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
        body: JSON.stringify(options.pendingFriendship ? [{
          id: 'friendship-pending',
          requester_id: friendProfile.id,
          recipient_id: user.id,
          status: 'pending',
          created_at: '2026-01-02T00:00:00.000Z',
          requester: friendProfile,
          recipient: profile,
        }] : options.personalized || options.parityFeatures ? [{
          id: 'friendship-1',
          requester_id: user.id,
          recipient_id: friendProfile.id,
          status: 'accepted',
          created_at: '2026-01-02T00:00:00.000Z',
          requester: profile,
          recipient: friendProfile,
        }] : []),
      });
    }
    if (url.pathname === '/rest/v1/user_blocks') {
      if (options.blockError) {
        return route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"blocks unavailable"}' });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(options.blockedFriend ? [{ id: 'block-1', blocked_id: friendProfile.id, created_at: '2026-01-03T00:00:00.000Z' }] : []),
      });
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
      const idFilter = url.searchParams.get('id');
      const dateFilters = url.searchParams.getAll('date');
      const isOfferCandidateQuery = dateFilters.some((value) => value.startsWith('gte.'))
        && dateFilters.some((value) => value.startsWith('lte.'));
      const isPastArchiveQuery = dateFilters.filter((value) => value.startsWith('lt.')).length >= 2
        && dateFilters.some((value) => value.startsWith('gte.'));
      const eventRows = isPastArchiveQuery && options.parityFeatures
        ? [
          { ...endedEvent, date: '2025-09-13T02:00:00.000Z' },
          ...(options.ambiguousArchive ? [{ ...endedEvent, id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', date: '2025-09-13T02:00:00.000Z' }] : []),
        ]
        : isOfferCandidateQuery && options.detailFeatures
        ? [featureEvent, siblingFeatureEvent, wrongStateFeatureEvent]
        : options.activeBeyondGrace
          ? [{ ...festivalEvent, date: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(), end_date: null }]
          : options.sameDayReminder
            ? [{ ...dropEvent, date: '2027-08-21T01:00:00.000Z' }]
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
              : options.coordinateMissing
                ? [{ ...dropEvent, lat: null, lng: null }]
                : options.ongoingEvent
                  ? [{
                    ...festivalEvent,
                    date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
                    end_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                  }]
              : options.parityFeatures
                ? [dropEvent, festivalEvent]
              : options.personalized
                ? [dropEvent, coastEvent, morrisonEvent]
                : [dropEvent];
      const filteredRows = idFilter ? eventRows.filter((event) => idFilter.includes(event.id)) : eventRows;
      return route.fulfill({
        status: 200,
        headers: { 'content-range': options.personalized ? '0-2/3' : '0-0/1' },
        contentType: 'application/json',
        body: JSON.stringify(filteredRows),
      });
    }
    if (url.pathname === '/rest/v1/attendance') {
      const selection = url.searchParams.get('select') ?? '';
      const embedded = selection.includes('events');
      const withProfiles = selection.includes('profiles');
      const status = url.searchParams.get('status');
      return route.fulfill({
        status: 200,
        headers: { 'content-range': options.personalized ? '0-0/1' : '*/0' },
        contentType: 'application/json',
        body: JSON.stringify(withProfiles && options.parityFeatures
          ? [{ event_id: dropEvent.id, user_id: friendProfile.id, profiles: friendProfile }]
          : options.attendedEvent
          ? embedded ? [{ events: endedEvent }] : [{ event_id: endedEvent.id, status: 'attended' }]
          : options.ongoingEvent
          ? embedded
            ? [{ events: {
              ...festivalEvent,
              date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
              end_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            } }]
            : [{ event_id: festivalEvent.id, status: 'going' }]
          : options.parityFeatures
          ? embedded
            ? [{ events: status?.includes('going') ? options.pastProfileGoing ? endedEvent : dropEvent : { ...dropEvent, date: '2020-08-20T03:00:00.000Z' } }]
            : [{ event_id: dropEvent.id, status: 'going' }]
          : options.personalized ? [{ event_id: dropEvent.id }] : []),
      });
    }
    if (url.pathname === '/rest/v1/plans') {
      if (method === 'GET' && url.searchParams.has('creator_id')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{"id":"plan-1"}' });
      }
      if (method === 'GET' && url.searchParams.get('id') === 'eq.plan-1') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'plan-1', creator_id: options.invitedPlan ? friendProfile.id : user.id, events: dropEvent }),
        });
      }
      if (method === 'POST') {
        return route.fulfill({ status: 201, contentType: 'application/json', body: '{"id":"plan-1"}' });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(options.parityFeatures ? [{
          id: 'plan-1',
          creator_id: user.id,
          event_id: dropEvent.id,
          profiles: profile,
          events: dropEvent,
        }] : []),
      });
    }
    if (url.pathname === '/rest/v1/plan_members') {
      const detail = url.searchParams.get('select')?.includes('profiles');
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(options.parityFeatures
          ? detail
            ? [{ plan_id: 'plan-1', user_id: user.id, status: options.invitedPlan ? 'invited' : 'going', profiles: profile }]
            : [{ plan_id: 'plan-1', user_id: user.id, status: options.invitedPlan ? 'invited' : 'going' }]
          : []),
      });
    }
    if (url.pathname === '/rest/v1/plan_messages') {
      return route.fulfill({
        status: method === 'GET' ? 200 : 201,
        contentType: 'application/json',
        body: JSON.stringify(options.parityFeatures && method === 'GET' ? [
          {
            id: 'message-2',
            user_id: user.id,
            body: 'I will bring the tickets.',
            created_at: '2027-08-19T21:00:00.000Z',
            profiles: profile,
          },
          {
            id: 'message-1',
            user_id: friendProfile.id,
            body: 'Meet at the entrance.',
            created_at: '2027-08-19T20:00:00.000Z',
            profiles: friendProfile,
          },
        ] : []),
      });
    }
    if (url.pathname === '/rest/v1/plan_meetup_spots') {
      return route.fulfill({
        status: method === 'GET' ? 200 : 201,
        contentType: 'application/json',
        body: JSON.stringify(options.parityFeatures && method === 'GET' ? [{ user_id: user.id, spot: 'Entrance' }] : []),
      });
    }
    if (url.pathname === '/rest/v1/crews') {
      if (method === 'GET' && options.crewReadError) {
        return route.fulfill({ status: 400, contentType: 'application/json', body: '{"message":"mock unavailable"}' });
      }
      if (method === 'HEAD') {
        const count = options.crewCapReached ? 5 : options.parityFeatures ? 1 : 0;
        return route.fulfill({
          status: 200,
          headers: {
            'access-control-expose-headers': 'content-range',
            'content-range': count ? `0-${count - 1}/${count}` : '*/0',
          },
          body: '',
        });
      }
      return route.fulfill({
        status: method === 'GET' ? 200 : 201,
        contentType: 'application/json',
        body: JSON.stringify(options.parityFeatures && method === 'GET' ? [{ id: 'crew-1', name: 'Red Rocks crew', emoji: null }] : []),
      });
    }
    if (url.pathname === '/rest/v1/crew_members') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(options.parityFeatures ? [{ crew_id: 'crew-1', user_id: friendProfile.id, profiles: friendProfile }] : []),
      });
    }
    if (url.pathname === '/rest/v1/event_set_times') {
      setTimeReads += 1;
      if (options.delayedLivePoll && setTimeReads > 1) await new Promise((resolve) => setTimeout(resolve, 1_000));
      const setTimes = options.overlappingSetTimes ? [
        {
          id: 'set-1',
          event_id: festivalEvent.id,
          artist_name: 'Neon Current',
          stage: 'Main Stage',
          start_time: '2027-09-05T01:00:00.000Z',
          end_time: null,
          timezone: 'America/Denver',
        },
        {
          id: 'set-2',
          event_id: festivalEvent.id,
          artist_name: 'Lane 8',
          stage: 'Bass Cathedral',
          start_time: '2027-09-05T01:30:00.000Z',
          end_time: null,
          timezone: 'America/Denver',
        },
      ] : [
        {
          id: 'set-1',
          event_id: festivalEvent.id,
          artist_name: 'Neon Current',
          stage: 'Main Stage',
          start_time: '2027-09-05T01:00:00.000Z',
          end_time: '2027-09-05T02:00:00.000Z',
          timezone: 'America/Denver',
        },
        {
          id: 'set-2',
          event_id: festivalEvent.id,
          artist_name: 'Lane 8',
          stage: 'Bass Cathedral',
          start_time: '2027-09-06T01:00:00.000Z',
          end_time: null,
          timezone: 'America/Denver',
        },
      ];
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(options.parityFeatures ? setTimes : []),
      });
    }
    if (url.pathname === '/rest/v1/my_set_times') {
      return route.fulfill({ status: method === 'GET' ? 200 : 201, contentType: 'application/json', body: '[]' });
    }
    if (url.pathname === '/rest/v1/event_checkins') {
      return route.fulfill({
        status: method === 'GET' ? 200 : 201,
        contentType: 'application/json',
        body: JSON.stringify(options.parityFeatures && method === 'GET' ? [
          ...(options.alreadyCheckedIn ? [{ user_id: user.id, spot_label: null, checked_in_at: '2027-09-05T01:10:00.000Z', profiles: profile }] : []),
          { user_id: friendProfile.id, spot_label: 'Entrance', checked_in_at: '2027-09-05T01:15:00.000Z', profiles: friendProfile },
        ] : []),
      });
    }
    if (url.pathname === '/rest/v1/alerts') {
      if (method !== 'GET') return route.fulfill({ status: 204 });
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(options.parityFeatures
          ? options.alertOverflow
            ? Array.from({ length: 15 }, (_, index) => ({
              id: `alert-${index}`,
              title: `Stored alert ${index + 1}`,
              body: 'Stored history',
              kind: 'sale',
              read: true,
              created_at: new Date(Date.now() - index * 1_000).toISOString(),
              event_id: null,
              plan_id: null,
            }))
            : [{
              id: 'alert-1',
              title: 'Night Owl is going',
              body: 'Prism Nights',
              kind: 'friend_going',
              read: false,
              created_at: new Date().toISOString(),
              event_id: dropEvent.id,
              plan_id: null,
            }]
          : []),
      });
    }
    if (url.pathname === '/rest/v1/notification_prefs') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{"artist_announcements":true,"friend_activity":true,"show_reminders":true,"sale_alerts":true,"comment_alerts":true,"plan_messages":true,"recap_alerts":true}',
      });
    }
    if (url.pathname === '/rest/v1/logged_shows') {
      const row = {
        id: 'logged-1',
        event_id: options.canonicalLogged ? dropEvent.id : null,
        artist_name: 'Lane 8',
        venue_name: 'Red Rocks',
        city: 'Morrison',
        state: 'CO',
        show_date: '2025-09-12',
        notes: 'Sunset set.',
      };
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(options.parityFeatures ? url.searchParams.has('id') ? row : [row] : []),
      });
    }
    if (url.pathname === '/rest/v1/logged_show_artists') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(options.parityFeatures ? [{ artist_name: 'Sultan + Shepard' }] : []) });
    }
    if (url.pathname === '/rest/v1/show_ratings') {
      if (method === 'POST' && (request.postDataJSON() as { event_id?: string }).event_id === endedEvent.id) {
        recapRating = Number((request.postDataJSON() as { rating?: number }).rating ?? 0);
        return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
      }
      if (method === 'GET' && url.searchParams.get('event_id')?.includes(endedEvent.id)) return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(recapRating ? [{ rating: recapRating }] : []),
      });
    }
    if (url.pathname === '/rest/v1/event_seen_artists' && (url.searchParams.get('event_id')?.includes(endedEvent.id) || method === 'POST')) {
      if (method === 'POST') {
        const body = request.postDataJSON() as { artist_name: string };
        recapSeenArtists = [...recapSeenArtists, { id: `seen-${recapSeenArtists.length + 1}`, artist_id: null, artist_name: body.artist_name }];
        return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(recapSeenArtists) });
    }
    if (url.pathname === '/rest/v1/show_tags' && method === 'GET' && options.tagReadError) {
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: '{"code":"PGRST000","details":null,"hint":null,"message":"mock unavailable"}',
      });
    }
    if (url.pathname === '/rest/v1/show_tags' || url.pathname === '/rest/v1/event_seen_artists' || url.pathname === '/rest/v1/show_ratings' || url.pathname === '/rest/v1/recap_posts') {
      return route.fulfill({
        status: method === 'GET' ? 200 : method === 'DELETE' ? 204 : 201,
        contentType: 'application/json',
        body: method === 'DELETE' ? '' : '[]',
      });
    }
    if (url.pathname === '/rest/v1/user_tickets') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(options.parityFeatures ? [{
          id: 'ticket-1',
          event_id: dropEvent.id,
          seller: 'AXS',
          order_ref: '1234',
          shot_path: null,
          created_at: '2027-08-01T00:00:00.000Z',
          events: dropEvent,
        }] : []),
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

async function openAppRoute(page: Page, path: string) {
  await page.goto(`${APP}/`);
  await expect(page.getByRole('region', { name: 'Discover' })).toBeVisible();
  await page.evaluate((route) => {
    history.pushState({}, '', `/app/next${route}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
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
    await expect(primary.getByRole('link', { name: /^friends$/i })).toBeVisible();
    await expect(primary.getByRole('link', { name: /festivals & live/i })).toBeVisible();
    await expect(primary.getByRole('link', { name: /settings/i })).toHaveCount(0);
    await expect(page.locator('.app-shell > .public-header')).toHaveCount(0);
    await expect(page.locator('.side-nav').getByRole('link', { name: /drop home/i })).toBeVisible();
    await expect(page.getByText(/good (morning|afternoon|evening), web/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /^for you$/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^upcoming$/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /global festivals/i })).toBeVisible();
    await expect(page.getByRole('navigation', { name: /mobile navigation/i })).toBeHidden();
  });

  test('desktop keeps personalized events outside the profile city', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockSupabase(page, true, { personalized: true });
    await page.goto(`${APP}/`);

    await expect(page.getByRole('link', { name: /open coast frequency/i }).first()).toBeVisible();
  });

  test('desktop location never invents missing profile fields', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockSupabase(page, true, { profileCity: 'Austin', profileState: null });
    await page.goto(`${APP}/`);

    const location = page.getByRole('button', { name: /change location, current location austin/i });
    await expect(location).toHaveText(/Austin/);
    await location.click();
    await expect(page.getByRole('link', { name: /change city/i })).toBeVisible();
    await page.getByRole('link', { name: /change city/i }).click();
    await expect(page).toHaveURL(new RegExp(`${APP}/profile#profile-city$`));
    await expect(page.locator('#profile-city')).toBeFocused();
    await expect(page.getByRole('link', { name: /change city/i })).toBeHidden();
    await expect(page.getByText('Austin, CO', { exact: true })).toHaveCount(0);
  });

  test('signed-in cards are uniform and horizontal rails have working controls', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'Desktop rail control check');
    await page.setViewportSize({ width: 900, height: 800 });
    await mockSupabase(page, true, { personalized: true });
    await openAppRoute(page, '/map');

    const cards = page.locator('.map-event-rail .event-card');
    await expect(cards).toHaveCount(2);
    for (const card of await cards.all()) {
      const box = await card.boundingBox();
      expect(box?.width).toBe(300);
      expect(box?.height).toBe(340);
    }
    const rail = page.locator('.map-event-rail .event-rail');
    const before = await rail.evaluate((element) => element.scrollLeft);
    await page.getByRole('button', { name: /next shows on the map/i }).click();
    await expect.poll(() => rail.evaluate((element) => element.scrollLeft)).toBeGreaterThan(before);
  });

  test('settings remain reachable when the profile cannot be loaded', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockSupabase(page, true, { profileMissing: true });
    await page.goto(`${APP}/`);
    await page.getByRole('navigation', { name: /^primary$/i })
      .getByRole('link', { name: /^profile$/i }).click();

    await expect(page.getByRole('link', { name: /^settings$/i })).toBeVisible();
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
    await expect(page.getByRole('button', { name: /change location, current location denver, co/i })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });

  test('mobile For You uses the native horizontal card rail', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockSupabase(page, true, { personalized: true });
    await page.goto(`${APP}/`);
    await page.getByRole('button', { name: 'For You' }).click();

    const rail = page.locator('.discover-mobile .event-rail');
    await expect(rail).toBeVisible();
    await expect(rail.locator('.event-card')).toHaveCount(1);
    expect(await rail.evaluate((element) => getComputedStyle(element).overflowX)).toBe('auto');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });

  test('the approved desktop parity routes replace every next-slice placeholder', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const writes = await mockSupabase(page, true, { parityFeatures: true });
    await page.goto(`${APP}/`);
    const primary = page.getByRole('navigation', { name: /^primary$/i });

    for (const [name, heading] of [
      ['Map', 'Map'],
      ['My Shows', 'My Shows'],
      ['Friends', 'Friends'],
      ['Plans', 'Plans'],
      ['Festivals & Live', 'Festivals'],
      ['Notifications', 'Notifications'],
    ] as const) {
      await primary.getByRole('link', { name: new RegExp(`^${name}$`, 'i') }).click();
      await expect(page.getByRole('heading', { name: heading, exact: true, level: heading === 'Map' ? 1 : 2 })).toBeVisible();
      await expect(page.getByText(/is next|next approved parity slice/i)).toHaveCount(0);
    }

    await expect(page.getByText('Night Owl is going', { exact: true })).toBeVisible();
    await expect.poll(() => writes.filter((entry) => entry === 'PATCH /rest/v1/alerts').length).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });

  test('festival schedule and Live Mode use connected set times and check-in writes', async ({ page }) => {
    await page.clock.install({ time: new Date('2027-09-05T01:30:00.000Z') });
    const writes = await mockSupabase(page, true, { parityFeatures: true });
    await openAppRoute(page, '/festivals');

    await expect(page.getByRole('link', { name: /^schedule$/i })).toBeVisible();
    await page.evaluate(() => {
      history.pushState({}, '', '/app/next/schedule/99999999-9999-4999-8999-999999999999');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await expect(page.getByRole('heading', { name: 'Prism Festival' })).toBeVisible();
    await expect(page.getByText('Neon Current')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Saturday, Sep 4, 2027/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Sunday, Sep 5, 2027/i })).toBeVisible();
    await page.getByRole('button', { name: /add neon current/i }).click();
    await expect.poll(() => writes.filter((entry) => entry === 'POST /rest/v1/my_set_times').length).toBe(1);

    await page.evaluate(() => {
      history.pushState({}, '', '/app/next/festivals');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await page.getByRole('link', { name: /^live mode$/i }).click();
    await expect(page.getByRole('heading', { name: 'Prism Festival' })).toBeVisible();
    await expect(page.getByText(/Night Owl/)).toBeVisible();
    await page.getByRole('button', { name: /check in/i }).click();
    await expect.poll(() => writes.filter((entry) => entry === 'POST /rest/v1/event_checkins').length).toBe(1);
  });

  test('Live Mode blocks check-ins outside the event window', async ({ page }) => {
    const writes = await mockSupabase(page, true, { parityFeatures: true });
    await openAppRoute(page, `/live/${festivalEvent.id}`);

    const checkIn = page.getByRole('button', { name: /check-in opens during the show/i });
    await expect(checkIn).toBeDisabled();
    await checkIn.click({ force: true });
    expect(writes.filter((entry) => entry === 'POST /rest/v1/event_checkins')).toHaveLength(0);
  });

  test('Live Mode restores an existing active check-in', async ({ page }) => {
    await page.clock.install({ time: new Date('2027-09-05T01:30:00.000Z') });
    const writes = await mockSupabase(page, true, { parityFeatures: true, alreadyCheckedIn: true });
    await openAppRoute(page, `/live/${festivalEvent.id}`);

    const checkIn = page.getByRole('button', { name: /checked in/i });
    await expect(checkIn).toBeDisabled();
    await checkIn.click({ force: true });
    expect(writes.filter((entry) => entry === 'POST /rest/v1/event_checkins')).toHaveLength(0);
  });

  test('Live Mode resets local check-in state when the event route changes', async ({ page }) => {
    await page.clock.install({ time: new Date('2027-09-05T01:30:00.000Z') });
    await mockSupabase(page, true, { parityFeatures: true });
    await openAppRoute(page, `/live/${festivalEvent.id}`);
    await page.getByRole('button', { name: /check in/i }).click();
    await expect(page.getByRole('button', { name: /checked in/i })).toBeDisabled();

    await page.evaluate((eventId) => {
      history.pushState({}, '', `/app/next/live/${eventId}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, dropEvent.id);
    await expect(page.getByRole('heading', { name: 'Prism Nights' })).toBeVisible();
    await expect(page.getByRole('button', { name: /check-in opens during the show/i })).toBeDisabled();
    await expect(page.getByRole('button', { name: /checked in/i })).toHaveCount(0);
  });

  test('Live Mode does not end an open set when another stage starts', async ({ page }) => {
    await page.clock.install({ time: new Date('2027-09-05T01:45:00.000Z') });
    await mockSupabase(page, true, { parityFeatures: true, overlappingSetTimes: true });
    await openAppRoute(page, `/live/${festivalEvent.id}`);

    await expect(page.locator('.live-now').getByRole('heading', { name: 'Neon Current' })).toBeVisible();
  });

  test('Live Mode loads a timed event directly through its full active window', async ({ page }) => {
    await mockSupabase(page, true, { parityFeatures: true, activeBeyondGrace: true });
    await openAppRoute(page, `/live/${festivalEvent.id}`);

    await expect(page.getByRole('heading', { name: 'Prism Festival' })).toBeVisible();
    await expect(page.getByRole('button', { name: /check in/i })).toBeEnabled();
  });

  test('Live Mode keeps ready content visible during background polling', async ({ page }) => {
    let setTimeReads = 0;
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === '/rest/v1/event_set_times') setTimeReads += 1;
    });
    await page.clock.install({ time: new Date('2027-09-05T01:30:00.000Z') });
    await mockSupabase(page, true, { parityFeatures: true, delayedLivePoll: true });
    await openAppRoute(page, `/live/${festivalEvent.id}`);
    await expect(page.locator('.live-grid')).toBeVisible();

    await page.clock.fastForward(60_000);
    await expect.poll(() => setTimeReads).toBeGreaterThan(1);
    await expect(page.locator('.live-grid')).toBeVisible();
    await expect(page.getByRole('heading', { name: /loading drop/i })).toHaveCount(0);
  });

  test('starting a plan from event detail uses the atomic backend contract', async ({ page }) => {
    const writes = await mockSupabase(page, true, { parityFeatures: true });
    await page.goto(`${APP}/`);
    await page.getByRole('link', { name: /open prism nights/i }).first().click();

    await page.getByRole('button', { name: /start a plan/i }).click();
    await expect(page).toHaveURL(new RegExp(`${APP}/plan/plan-1/?$`));
    await expect.poll(() => writes.filter((entry) => entry === 'POST /rest/v1/rpc/create_or_get_plan').length).toBe(1);
    expect(writes.filter((entry) => entry === 'POST /rest/v1/plan_members')).toHaveLength(0);
  });

  test('plan chat requests the latest 100 messages and renders them oldest first', async ({ page }) => {
    const queries: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname === '/rest/v1/plan_messages' && request.method() === 'GET') queries.push(url.search);
    });
    await mockSupabase(page, true, { parityFeatures: true });
    await openAppRoute(page, '/plan/plan-1');

    await expect(page.getByRole('heading', { name: 'Plan chat' })).toBeVisible();
    await expect(page.locator('.chat-list article p')).toHaveText([
      'Meet at the entrance.',
      'I will bring the tickets.',
    ]);
    expect(queries.some((query) => query.includes('order=created_at.desc') && query.includes('limit=100'))).toBe(true);
  });

  test('invited plan members can RSVP and leave through the atomic backend contract', async ({ page }) => {
    const writes = await mockSupabase(page, true, { parityFeatures: true, invitedPlan: true });
    await openAppRoute(page, '/plan/plan-1');

    await expect(page.getByRole('button', { name: /invite night owl/i })).toHaveCount(0);
    await page.getByRole('button', { name: /^going$/i }).click();
    await expect.poll(() => writes.filter((entry) => entry === 'PATCH /rest/v1/plan_members').length).toBe(1);
    await page.getByRole('button', { name: /leave plan/i }).click();
    await expect(page).toHaveURL(new RegExp(`${APP}/plans/?$`));
    await expect.poll(() => writes.filter((entry) => entry === 'POST /rest/v1/rpc/leave_plan').length).toBe(1);
    expect(writes.filter((entry) => entry === 'DELETE /rest/v1/plan_members')).toHaveLength(0);
  });

  test('plan creators can invite accepted friends and leave through the handoff RPC', async ({ page }) => {
    const writes = await mockSupabase(page, true, { parityFeatures: true });
    await openAppRoute(page, '/plan/plan-1');

    await page.getByRole('button', { name: /invite night owl/i }).last().click();
    await expect.poll(() => writes.filter((entry) => entry === 'POST /rest/v1/plan_members').length).toBe(1);
    await page.getByRole('button', { name: /leave plan/i }).click();
    await expect(page).toHaveURL(new RegExp(`${APP}/plans/?$`));
    await expect.poll(() => writes.filter((entry) => entry === 'POST /rest/v1/rpc/leave_plan').length).toBe(1);
  });

  test('map uses event coordinates and excludes shows outside the selected area', async ({ page }) => {
    const eventSelects: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname === '/rest/v1/events' && request.method() === 'GET') {
        eventSelects.push(url.searchParams.get('select') ?? '');
      }
    });
    await mockSupabase(page, true, { personalized: true });
    await openAppRoute(page, '/map');
    await page.getByRole('tab', { name: /^list$/i }).click();

    await expect(page.getByText('Prism Nights', { exact: true })).toBeVisible();
    await expect(page.getByText('Red Rocks Echo', { exact: true })).toBeVisible();
    await expect(page.getByText('Coast Frequency', { exact: true })).toHaveCount(0);
    expect(eventSelects.some((select) => select.includes('lat') && select.includes('lng'))).toBe(true);
  });

  test('map never renders a venue pin from a city-only fallback', async ({ page }) => {
    await mockSupabase(page, true, { coordinateMissing: true });
    await openAppRoute(page, '/map');

    await expect(page.getByRole('link', { name: /prism nights on map/i })).toHaveCount(0);
    await expect(page.getByLabel('Shows on the map')).toHaveCount(0);
    await page.getByRole('tab', { name: /^list$/i }).click();
    await expect(page.getByText('Prism Nights', { exact: true })).toBeVisible();
  });

  test('map tiles remain square so geographic pin math matches the rendered grid', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockSupabase(page, true, { personalized: true });
    await openAppRoute(page, '/map');

    const tile = page.locator('.map-tiles img').first();
    await expect(tile).toBeVisible();
    await expect(tile).toHaveAttribute('src', /basemaps\.cartocdn\.com\/dark_all/);
    await expect(page.locator('.map-surface__attribution a[href="https://www.openstreetmap.org/copyright"]')).toBeVisible();
    await expect(page.locator('.map-surface__attribution a[href="https://carto.com/attributions"]')).toBeVisible();
    const box = await tile.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.abs((box?.width ?? 0) - (box?.height ?? 0))).toBeLessThan(1);
  });

  test('friend discovery uses the privacy-safe search contract', async ({ page }) => {
    const writes = await mockSupabase(page, true, { parityFeatures: true });
    await openAppRoute(page, '/friends');
    await page.getByRole('tab', { name: /^find$/i }).click();
    await page.getByRole('textbox', { name: /search drop users/i }).fill('Night');
    await page.getByRole('main').getByRole('button', { name: /^search$/i }).click();

    await expect(page.getByText('Night Owl', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /added/i })).toBeDisabled();
    await expect.poll(() => writes.filter((entry) => entry === 'POST /rest/v1/rpc/search_public_profiles').length).toBe(1);
    expect(writes.filter((entry) => entry === 'POST /rest/v1/friendships')).toHaveLength(0);
  });

  test('failed parity-page loads retry in place', async ({ page }) => {
    let crewReads = 0;
    const crewStatuses: number[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === '/rest/v1/crews' && request.method() === 'GET') crewReads += 1;
    });
    page.on('response', (response) => {
      if (new URL(response.url()).pathname === '/rest/v1/crews') crewStatuses.push(response.status());
    });
    await mockSupabase(page, true, { parityFeatures: true, crewReadError: true });
    await openAppRoute(page, '/crews');

    await expect.poll(() => crewStatuses).toContain(400);
    await expect(page.getByRole('heading', { name: /couldn’t load this screen/i })).toBeVisible();
    const beforeRetry = crewReads;
    await page.getByRole('button', { name: /^retry$/i }).click();
    await expect.poll(() => crewReads).toBeGreaterThan(beforeRetry);
  });

  test('friend request filtering controls the visible request rows and empty state', async ({ page }) => {
    await mockSupabase(page, true, { pendingFriendship: true });
    await openAppRoute(page, '/friends');
    await page.getByRole('tab', { name: /^requests$/i }).click();
    await expect(page.getByText('Night Owl', { exact: true })).toBeVisible();

    await page.getByRole('textbox', { name: /filter friends/i }).fill('not this person');
    await expect(page.getByText('Night Owl', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /no pending requests/i })).toBeVisible();
  });

  test('past-show lineup conflicts require an explicit merge or separate choice', async ({ page }) => {
    const writes = await mockSupabase(page, true, { logConflict: true });
    await page.goto(`${APP}/`);
    await page.locator('a[href$="/shows"]:visible').click();
    await page.getByRole('link', { name: /log a past show/i }).click();
    await page.getByLabel(/artist or event/i).fill('Lane 8');
    await page.getByLabel(/^date$/i).fill('2025-09-12');
    await page.getByRole('button', { name: /save show/i }).click();

    await expect(page.getByRole('heading', { name: /is this the same show/i })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${APP}/log-show/?$`));
    await page.getByRole('button', { name: /keep separate/i }).click();
    await expect(page).toHaveURL(new RegExp(`${APP}/shows/?$`));
    await expect.poll(() => writes.filter((entry) => entry === 'POST /rest/v1/rpc/record_past_show').length).toBe(2);
  });

  test('calendar history import stays local until confirmed and saves only checked shows', async ({ page }) => {
    const writes = await mockSupabase(page, true, { parityFeatures: true });
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));
    await openAppRoute(page, '/import-shows');
    await expect(page.getByText(/selected show details are used to find matching Drop events/i)).toBeVisible();

    await page.locator('input[type="file"]').setInputFiles({
      name: 'concerts.ics',
      mimeType: 'text/calendar',
      buffer: Buffer.from([
        'BEGIN:VCALENDAR',
        'BEGIN:VEVENT',
        'UID:neon-current-2025',
        'DTSTART;TZID=America/Denver:20250912T200000',
        'SUMMARY:Neon Current concert',
        'LOCATION:Mission Ballroom',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n')),
    });

    await expect(page.getByRole('heading', { name: '1 likely show found' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /import neon current concert/i })).toBeChecked();
    await expect(page.getByText(/2025-09-12 · Mission Ballroom/)).toBeVisible();
    expect(requests.some((url) => decodeURIComponent(url).includes('Neon Current concert'))).toBe(false);
    await page.getByRole('button', { name: /import 1 show/i }).click();
    await expect(page).toHaveURL(new RegExp(`${APP}/shows/?$`));
    await expect.poll(() => writes.filter((entry) => entry === 'POST /rest/v1/attendance').length).toBe(1);
  });

  test('calendar history leaves ambiguous archive matches for manual review', async ({ page }) => {
    const writes = await mockSupabase(page, true, { parityFeatures: true, ambiguousArchive: true });
    await openAppRoute(page, '/import-shows');
    await page.locator('input[type="file"]').setInputFiles({
      name: 'concerts.ics',
      mimeType: 'text/calendar',
      buffer: Buffer.from([
        'BEGIN:VCALENDAR',
        'BEGIN:VEVENT',
        'DTSTART;TZID=America/Denver:20250912T200000',
        'SUMMARY:Neon Current concert',
        'LOCATION:Mission Ballroom',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n')),
    });
    await page.getByRole('button', { name: /import 1 show/i }).click();
    await expect(page.getByText(/1 entry needs manual review/i)).toBeVisible();
    expect(writes).not.toContain('POST /rest/v1/attendance');
  });

  test('manual show memories can edit details, rating, lineup, tags, and device-local media', async ({ page }) => {
    const writes = await mockSupabase(page, true, { parityFeatures: true });
    const payloads: Array<{ path: string; body: any }> = [];
    page.on('request', (request) => {
      const path = new URL(request.url()).pathname;
      if (['/rest/v1/logged_shows', '/rest/v1/rpc/replace_logged_show_openers', '/rest/v1/show_tags'].includes(path) && request.method() !== 'GET') {
        payloads.push({ path, body: request.postDataJSON() });
      }
    });
    await openAppRoute(page, '/show/logged-1');

    await expect(page.getByRole('heading', { name: 'Lane 8' })).toBeVisible();
    await page.getByRole('button', { name: /edit memory/i }).click();
    await page.getByLabel(/^venue$/i).fill('Mission Ballroom');
    await page.getByLabel(/^rating$/i).selectOption('8');
    await page.getByRole('checkbox', { name: 'Night Owl' }).check();
    await page.getByRole('button', { name: /save changes/i }).click();
    await expect(page.getByText('Show memory saved.')).toBeVisible();
    await expect.poll(() => writes).toContain('PATCH /rest/v1/logged_shows');
    await expect.poll(() => writes).toContain('POST /rest/v1/rpc/replace_logged_show_openers');
    expect(payloads.find((item) => item.path === '/rest/v1/logged_shows')?.body).toMatchObject({
      venue_name: 'Mission Ballroom',
      notes: 'Rated 4/5 ★ — Sunset set.',
    });
    expect(payloads.find((item) => item.path === '/rest/v1/rpc/replace_logged_show_openers')?.body.p_openers).toEqual([
      { artist_id: null, artist_name: 'Sultan + Shepard' },
    ]);
    expect(payloads.find((item) => item.path === '/rest/v1/show_tags')?.body[0]).toMatchObject({
      tagged_user_id: friendProfile.id,
      artist_name: 'Lane 8',
    });

    await page.locator('.memory-section input[type="file"]').setInputFiles({
      name: 'night.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
    });
    await expect(page.locator('.memory-media figure')).toHaveCount(1);
    await page.locator('.memory-section input[type="file"]').setInputFiles({
      name: 'not-media.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not media'),
    });
    await expect(page.getByText(/1 file was not saved/i)).toBeVisible();
    await expect(page.locator('.memory-media figure')).toHaveCount(1);
  });

  test('show memory saves leave existing tags unchanged when hydration fails', async ({ page }) => {
    const writes = await mockSupabase(page, true, { parityFeatures: true, tagReadError: true });
    await openAppRoute(page, '/show/logged-1');
    await page.getByRole('button', { name: /edit memory/i }).click();
    await expect(page.getByText(/friend tags are unavailable/i)).toBeVisible();
    await page.getByLabel(/^venue$/i).fill('Mission Ballroom');
    await page.getByRole('button', { name: /save changes/i }).click();
    await expect(page.getByText(/existing tags unchanged/i)).toBeVisible();
    expect(writes.filter((entry) => entry.endsWith('/show_tags'))).toHaveLength(0);
  });

  test('direct recap access cannot mark a future show attended', async ({ page }) => {
    const writes = await mockSupabase(page, true, { parityFeatures: true });
    await openAppRoute(page, `/recap/${dropEvent.id}`);
    await expect(page.getByRole('heading', { name: /recaps unlock after the show/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /i was there/i })).toHaveCount(0);
    expect(writes).not.toContain('POST /rest/v1/attendance');
  });

  test('attended shows create a privacy-safe local-first downloadable recap', async ({ page }) => {
    const writes = await mockSupabase(page, true, { pastEvent: true, attendedEvent: true, personalized: true });
    const payloads: Array<{ path: string; body: any }> = [];
    page.on('request', (request) => {
      const path = new URL(request.url()).pathname;
      if (['/rest/v1/show_ratings', '/rest/v1/event_seen_artists'].includes(path) && request.method() === 'POST') {
        payloads.push({ path, body: request.postDataJSON() });
      }
    });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { throw new Error('mock share failure'); } });
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    });
    await openAppRoute(page, `/recap/${endedEvent.id}`);

    await expect(page.getByRole('heading', { name: 'Build your recap' })).toBeVisible();
    await expect(page.getByText(/Crew: Night Owl.*rechecked before export/i)).toBeVisible();
    await expect(page.getByText('Opted Out', { exact: true })).toHaveCount(0);
    const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
    await page.locator('.memory-section input[type="file"]').setInputFiles(Array.from({ length: 4 }, (_, index) => ({
      name: `recap-${index + 1}.png`,
      mimeType: 'image/png',
      buffer: image,
    })));
    await expect(page.locator('.recap-preview__media img')).toHaveCount(4);
    await page.getByRole('button', { name: 'Rate 4 out of 5' }).click();
    await expect(page.getByRole('button', { name: 'Rate 4 out of 5' })).toHaveClass(/is-active/);
    await page.getByRole('textbox', { name: /add an artist you saw/i }).fill('Surprise Guest');
    await page.getByRole('button', { name: /^add$/i }).click();
    await expect(page.getByRole('heading', { name: /Neon Current · Surprise Guest/ })).toBeVisible();
    const crewReadsBeforeExport = writes.filter((entry) => entry === 'POST /rest/v1/rpc/recap_crew_for').length;
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: /share recap/i }).click();
    const exported = await download;
    const stream = await exported.createReadStream();
    let bytes = 0;
    for await (const chunk of stream) bytes += chunk.length;
    expect(bytes).toBeGreaterThan(1_000);
    await expect(page.getByText('Recap downloaded.')).toBeVisible();
    expect(payloads.find((item) => item.path === '/rest/v1/show_ratings')?.body).toMatchObject({ rating: 8 });
    expect(payloads.find((item) => item.path === '/rest/v1/event_seen_artists')?.body).toMatchObject({ artist_name: 'Surprise Guest' });
    expect(writes.filter((entry) => entry === 'POST /rest/v1/rpc/recap_crew_for').length).toBeGreaterThan(crewReadsBeforeExport);
    expect(writes).not.toContain('POST /rest/v1/recap_posts');
  });

  test('blocked users are removed from friends, crews, and live presence', async ({ page }) => {
    await mockSupabase(page, true, { parityFeatures: true, blockedFriend: true });
    await page.goto(`${APP}/`);
    await page.locator('a[href$="/friends"]:visible').click();
    await expect(page.getByText('Night Owl', { exact: true })).toHaveCount(0);

    await page.getByRole('link', { name: /^crews$/i }).click();
    await expect(page.getByText('0 members')).toBeVisible();
    await page.evaluate(() => {
      history.pushState({}, '', '/app/next/festivals');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await page.getByRole('link', { name: /^live mode$/i }).click();
    await expect(page.getByText(/no friends have checked in yet/i)).toBeVisible();
  });

  test('crew owners can update membership from accepted friends', async ({ page }) => {
    const writes = await mockSupabase(page, true, { parityFeatures: true });
    await openAppRoute(page, '/crews');

    await page.getByRole('button', { name: /manage members/i }).click();
    await page.getByRole('checkbox', { name: 'Night Owl' }).uncheck();
    await page.getByRole('button', { name: /save members/i }).click();
    await expect.poll(() => writes.filter((entry) => entry === 'DELETE /rest/v1/crew_members').length).toBe(1);
  });

  test('crew creation rechecks the live free-tier cap before inserting', async ({ page }) => {
    const writes = await mockSupabase(page, true, { parityFeatures: true, crewCapReached: true });
    await openAppRoute(page, '/crews');

    await page.getByRole('textbox', { name: /new crew name/i }).fill('Sixth crew');
    await page.getByRole('button', { name: /^create$/i }).click();
    await expect(page.getByText(/up to five crews/i)).toBeVisible();
    expect(writes.filter((entry) => entry === 'POST /rest/v1/crews')).toHaveLength(0);
  });

  test('friend rows open the connected public profile', async ({ page }) => {
    await mockSupabase(page, true, { parityFeatures: true });
    await page.goto(`${APP}/`);
    await page.evaluate(() => {
      history.pushState({}, '', '/app/next/friends');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await page.getByRole('link', { name: 'View' }).click();
    await expect(page).toHaveURL(new RegExp(`${APP}/profile/${friendProfile.id}/?$`));
    await expect(page.getByRole('heading', { name: 'Night Owl' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Going' })).toBeVisible();
    await expect(page.getByRole('link', { name: /open prism nights/i }).first()).toBeVisible();
  });

  test('public profiles stay hidden when the profile owner blocked the viewer', async ({ page }) => {
    await mockSupabase(page, true, { parityFeatures: true, blockedByProfile: true });
    await openAppRoute(page, `/profile/${friendProfile.id}`);

    await expect(page.getByRole('heading', { name: 'Profile not found' })).toBeVisible();
    await expect(page.getByText('Night Owl', { exact: true })).toHaveCount(0);
  });

  test('public profiles exclude ended shows from Going', async ({ page }) => {
    await mockSupabase(page, true, { parityFeatures: true, pastProfileGoing: true });
    await openAppRoute(page, `/profile/${friendProfile.id}`);

    await expect(page.getByText('No upcoming shows.')).toBeVisible();
    await expect(page.getByText('Ended Frequency', { exact: true })).toHaveCount(0);
  });

  test('canonical linked show memories do not duplicate attended events', async ({ page }) => {
    await mockSupabase(page, true, { parityFeatures: true, canonicalLogged: true });
    await page.goto(`${APP}/`);
    await page.locator('a[href$="/shows"]:visible').click();
    await page.getByRole('tab', { name: /^past$/i }).click();
    await expect(page.getByText('Lane 8', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Prism Nights', { exact: true })).toBeVisible();
    await expect(page.locator('a[href$="/show/logged-1"]').filter({ hasText: 'Prism Nights' })).toBeVisible();
  });

  test('ongoing multi-day shows stay in the upcoming lineup', async ({ page }) => {
    await mockSupabase(page, true, { ongoingEvent: true });
    await openAppRoute(page, '/shows');

    await expect(page.locator('.shows-page .parity-list').getByText('Prism Festival', { exact: true })).toBeVisible();
  });

  test('past shows merge canonical and manual history in newest-first order', async ({ page }) => {
    await mockSupabase(page, true, { parityFeatures: true });
    await openAppRoute(page, '/shows');
    await page.getByRole('tab', { name: /^past$/i }).click();

    const titles = await page.locator('.parity-list .parity-event-row strong').allTextContents();
    expect(titles.slice(0, 2)).toEqual(['Lane 8', 'Prism Nights']);
  });

  test('stats default to the current year and offer an all-time range', async ({ page }) => {
    await mockSupabase(page, true, { parityFeatures: true });
    await openAppRoute(page, '/stats');

    await expect(page.getByRole('tab', { name: /^this year$/i })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'Your history is waiting' })).toBeVisible();
    await page.getByRole('tab', { name: /^all time$/i }).click();
    await expect(page.locator('.stats-grid article').first()).toContainText('2');
  });

  test('cancelling Wrapped sharing does not surface an unhandled error', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: () => Promise.reject(new DOMException('Share canceled', 'AbortError')),
      });
    });
    await mockSupabase(page, true, { parityFeatures: true });
    await openAppRoute(page, '/wrapped');

    await page.getByRole('button', { name: /^share$/i }).click();
    await page.waitForTimeout(50);
    expect(pageErrors).toEqual([]);
  });

  test('cancelling ticket sharing does not surface an unhandled error', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: () => Promise.reject(new DOMException('Share canceled', 'AbortError')),
      });
    });
    await mockSupabase(page, true, { parityFeatures: true });
    await openAppRoute(page, '/wallet');

    await page.getByRole('button', { name: /^share$/i }).click();
    await page.waitForTimeout(50);
    expect(pageErrors).toEqual([]);
  });

  test('blocked friends are excluded before notification attendance lookup', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname === '/rest/v1/attendance') requests.push(url.search);
    });
    await mockSupabase(page, true, { parityFeatures: true, blockedFriend: true });
    await openAppRoute(page, '/notifications');
    await expect(page.getByRole('heading', { name: 'Notifications', level: 2 })).toBeVisible();

    expect(requests.some((query) => query.includes(friendProfile.id))).toBe(false);
  });

  test('notifications wait for profile hydration before deriving and marking alerts', async ({ page }) => {
    const writes = await mockSupabase(page, true, { parityFeatures: true, delayedProfile: true });
    await page.goto(`${APP}/`);
    await page.evaluate(() => {
      history.pushState({}, '', '/app/next/notifications');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    await expect(page.getByRole('heading', { name: 'Notifications', level: 2 })).toBeVisible();
    await page.waitForTimeout(250);
    expect(writes.filter((entry) => entry === 'PATCH /rest/v1/alerts')).toHaveLength(0);
    await expect(page.getByText('Night Owl is going', { exact: true })).toBeVisible();
    await expect.poll(() => writes.filter((entry) => entry === 'PATCH /rest/v1/alerts').length).toBe(1);
  });

  test('stored notification history leaves room for current synthesized alerts', async ({ page }) => {
    const queries: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname === '/rest/v1/alerts' && request.method() === 'GET') queries.push(url.search);
    });
    await mockSupabase(page, true, { parityFeatures: true, alertOverflow: true });
    await openAppRoute(page, '/notifications');

    await expect(page.getByText('Night Owl is going to Prism Nights')).toBeVisible();
    expect(queries.some((query) => query.includes('limit=15'))).toBe(true);
  });

  test('same-day reminders use the event timezone calendar date', async ({ page }) => {
    await page.clock.install({ time: new Date('2027-08-20T15:00:00.000Z') });
    await mockSupabase(page, true, { parityFeatures: true, sameDayReminder: true });
    await openAppRoute(page, '/notifications');

    await expect(page.getByText('Prism Nights is today!')).toBeVisible();
    await expect(page.getByText(/Prism Nights is in 1 day/)).toHaveCount(0);
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
    await expect(page.getByRole('article').getByRole('heading', { name: 'Prism Nights' })).toBeVisible();
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
    await page.getByRole('link', { name: /open prism nights/i }).first().click();

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
    await page.getByRole('link', { name: /open prism nights/i }).first().click();

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
    await page.getByRole('link', { name: /open prism nights/i }).first().click();
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
    await page.getByRole('link', { name: /open prism nights/i }).first().click();
    await weatherStarted;

    await expect(page.getByRole('heading', { name: 'Prism Nights' })).toBeVisible({ timeout: 500 });
    await expect(page.getByText('72°F · Clear · 10% precip')).toBeVisible();
  });

  test('action-state read failures keep save and venue follow disabled', async ({ page }) => {
    await mockSupabase(page, true, { actionReadError: true });
    await page.goto(`${APP}/`);
    await page.getByRole('link', { name: /open prism nights/i }).first().click();

    await expect(page.getByRole('article').getByRole('heading', { name: 'Prism Nights' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText(/some show actions are unavailable/i);
    await expect(page.getByRole('button', { name: /save show/i })).toBeDisabled();
    await expect(page.getByRole('button', { name: /follow venue/i })).toBeDisabled();
  });

  test('a single unlinked offer keeps the event purchase URL', async ({ page }) => {
    await mockSupabase(page, true, { singleUnlinkedOffer: true });
    await page.goto(`${APP}/`);
    await page.getByRole('link', { name: /open prism nights/i }).first().click();

    await expect(page.getByRole('link', { name: /^get tickets$/i })).toHaveAttribute('href', dropEvent.ticket_url);
    await expect(page.getByRole('button', { name: /ticket link unavailable/i })).toHaveCount(0);
  });

  test('multi-day time-TBA calendar downloads preserve an exclusive all-day end', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockSupabase(page, true, { tbdEvent: true });
    await page.goto(`${APP}/`);
    await page.getByRole('link', { name: /open prism nights/i }).first().click();

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
    await page.getByRole('link', { name: /open prism nights/i }).first().click();

    await expect(page.getByRole('alert')).toContainText(/comments are unavailable/i);
    await expect(page.getByRole('button', { name: /try again/i })).toBeVisible();
    await expect(page.getByLabel('Add a comment')).toHaveCount(0);
    await expect(page.getByText(/no comments yet/i)).toHaveCount(0);
  });

  test('block-list failures fail comments closed', async ({ page }) => {
    await mockSupabase(page, true, { detailFeatures: true, blockError: true });
    await page.goto(`${APP}/`);
    await page.getByRole('link', { name: /open prism nights/i }).first().click();

    await expect(page.getByRole('alert')).toContainText(/comments are unavailable/i);
    await expect(page.getByText('Meet by the south entrance.')).toHaveCount(0);
    await expect(page.getByLabel('Add a comment')).toHaveCount(0);
  });

  test('comments retain the newest 100 in chronological display order', async ({ page }) => {
    await mockSupabase(page, true, { commentOverflow: true });
    await page.goto(`${APP}/`);
    await page.getByRole('link', { name: /open prism nights/i }).first().click();

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
    await page.evaluate((userId) => new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('drop-history-media', 2);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore('media', { keyPath: 'id' });
        store.createIndex('by-show', ['userId', 'showKey']);
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const transaction = request.result.transaction('media', 'readwrite');
        transaction.objectStore('media').put({
          id: 'delete-me',
          userId,
          showKey: 'logged:delete-me',
          name: 'private.png',
          type: 'image/png',
          size: 1,
          addedAt: Date.now(),
          bytes: new ArrayBuffer(1),
        });
        transaction.oncomplete = () => { request.result.close(); resolve(); };
        transaction.onerror = () => reject(transaction.error);
      };
    }), user.id);

    await page.getByRole('navigation', { name: /^primary$/i })
      .getByRole('link', { name: /^profile$/i }).click();
    await page.getByRole('link', { name: /^settings$/i }).click();
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
    await expect.poll(() => page.evaluate((userId) => new Promise<number>((resolve, reject) => {
      const request = indexedDB.open('drop-history-media', 2);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const count = request.result.transaction('media').objectStore('media').index('by-show').count(IDBKeyRange.bound([userId, ''], [userId, '\uffff']));
        count.onsuccess = () => { request.result.close(); resolve(count.result); };
        count.onerror = () => reject(count.error);
      };
    }), user.id)).toBe(0);
  });
});
