import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowSquareOut } from '@phosphor-icons/react/ArrowSquareOut';
import { BookmarkSimple } from '@phosphor-icons/react/BookmarkSimple';
import { Buildings } from '@phosphor-icons/react/Buildings';
import { CalendarDots } from '@phosphor-icons/react/CalendarDots';
import { CaretLeft } from '@phosphor-icons/react/CaretLeft';
import { CaretRight } from '@phosphor-icons/react/CaretRight';
import { CheckCircle } from '@phosphor-icons/react/CheckCircle';
import { CircleNotch } from '@phosphor-icons/react/CircleNotch';
import { CloudSun } from '@phosphor-icons/react/CloudSun';
import { Flag } from '@phosphor-icons/react/Flag';
import { Funnel } from '@phosphor-icons/react/Funnel';
import { ImageSquare } from '@phosphor-icons/react/ImageSquare';
import { MagnifyingGlass } from '@phosphor-icons/react/MagnifyingGlass';
import { MapPin } from '@phosphor-icons/react/MapPin';
import { PaperPlaneTilt } from '@phosphor-icons/react/PaperPlaneTilt';
import { ShareNetwork } from '@phosphor-icons/react/ShareNetwork';
import { Sparkle } from '@phosphor-icons/react/Sparkle';
import { Ticket } from '@phosphor-icons/react/Ticket';
import { Trash } from '@phosphor-icons/react/Trash';
import { UsersThree } from '@phosphor-icons/react/UsersThree';
import { WarningCircle } from '@phosphor-icons/react/WarningCircle';
import { X } from '@phosphor-icons/react/X';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from './auth';
import { supabase } from './lib/supabase';

type Artist = {
  id: string;
  name: string;
  genres: string[] | null;
  image_url: string | null;
};

type EventArtist = { artist_id?: string | null; position: number | null; artists: Artist | null };

export type DropEvent = {
  id: string;
  title: string;
  description: string | null;
  date: string;
  end_date: string | null;
  venue_id: string | null;
  venue_name: string | null;
  city: string | null;
  state: string | null;
  lat?: number | null;
  lng?: number | null;
  image_url: string | null;
  ticket_url: string | null;
  price_min: number | null;
  price_max: number | null;
  currency: string | null;
  source: string;
  is_festival: boolean;
  time_tbd: boolean;
  timezone: string | null;
  presale_start: string | null;
  onsale_start: string | null;
  event_artists: EventArtist[];
};

type TicketOffer = {
  id: string;
  event_id: string;
  vendor: string;
  url: string | null;
  price_min: number | null;
  price_max: number | null;
  currency: string | null;
  fetched_at: string | null;
};

type OfferCandidate = Pick<
  DropEvent,
  'id' | 'title' | 'date' | 'city' | 'state' | 'venue_name' | 'venue_id' | 'source' | 'event_artists'
>;

type CommentProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  profile_image: string | null;
};

type EventComment = {
  id: string;
  event_id: string;
  user_id: string;
  body: string;
  created_at: string;
  profiles: CommentProfile | null;
};

type EventWeather = {
  temperature: number | null;
  temperatureUnit: 'F' | 'C' | null;
  shortForecast: string | null;
  precipitationProbability: number | null;
  forecastTime: string;
};

type SearchSuggestion = {
  key: string;
  type: 'Venues' | 'Events' | 'Artists' | 'Cities' | 'Genres';
  label: string;
  subtitle: string;
  value: string;
  eventId?: string;
};

type Distance = 5 | 25 | 50 | 100 | null;
type Coordinates = { latitude: number; longitude: number };

const EVENT_SELECT = [
  'id', 'title', 'description', 'date', 'end_date', 'venue_id', 'venue_name', 'city', 'state',
  'image_url', 'ticket_url', 'price_min', 'price_max', 'currency', 'source', 'is_festival',
  'time_tbd', 'timezone', 'presale_start', 'onsale_start', 'lat', 'lng',
  'event_artists(artist_id,position,artists(id,name,genres,image_url))',
].join(',');
const ARTIST_EVENT_SELECT = EVENT_SELECT.replace('event_artists(', 'event_artists!inner(');

const sections = ['Happening', 'For You', 'Crew'] as const;
const dateFilters = ['Any time', 'Today', 'This weekend', 'Next 30 days'] as const;
const discoverGenres = ['Festivals', 'House', 'Techno', 'Dubstep', 'Drum & Bass', 'Hip-Hop', 'Indie', 'Clubs'] as const;
const EVENT_GRACE_MS = 6 * 60 * 60 * 1000;
const PAGE_SIZE = 1000;
const MAX_CATALOG_EVENTS = 5000;
const PUBLIC_EVENT_URL = 'https://trydropapp.com/event.html';
const SEARCH_RECENTS_KEY = 'drop.web.search.recents.v2';
const PRICE_CEILING = 200;
const SEARCH_TYPES = new Set<SearchSuggestion['type']>(['Venues', 'Events', 'Artists', 'Cities', 'Genres']);
const DISTANCES: { label: string; value: Distance }[] = [
  { label: '5 mi', value: 5 },
  { label: '25 mi', value: 25 },
  { label: '50 mi', value: 50 },
  { label: '100 mi', value: 100 },
  { label: 'Any', value: null },
];
const STATE_CODES = Object.fromEntries(Object.entries({
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas',
  KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts',
  MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana',
  NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico',
  NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
}).map(([code, name]) => [name.toLocaleLowerCase().replace(/[^a-z]/g, ''), code]));
STATE_CODES.washingtondc = 'DC';
// Kept in lockstep with the native launch-city picker. ponytail: city-level
// distance is the known ceiling; replace with venue coordinates when stored.
const CITY_COORDS: Record<string, Coordinates> = Object.fromEntries(([
  ['New York', 'NY', 40.7128, -74.006], ['Brooklyn', 'NY', 40.6782, -73.9442],
  ['Buffalo', 'NY', 42.8864, -78.8784], ['Rochester', 'NY', 43.1566, -77.6088],
  ['Albany', 'NY', 42.6526, -73.7562], ['Los Angeles', 'CA', 34.0522, -118.2437],
  ['San Diego', 'CA', 32.7157, -117.1611], ['San Francisco', 'CA', 37.7749, -122.4194],
  ['San Jose', 'CA', 37.3382, -121.8863], ['Oakland', 'CA', 37.8044, -122.2712],
  ['Sacramento', 'CA', 38.5816, -121.4944], ['Fresno', 'CA', 36.7378, -119.7871],
  ['Long Beach', 'CA', 33.7701, -118.1937], ['Anaheim', 'CA', 33.8366, -117.9143],
  ['Santa Ana', 'CA', 33.7455, -117.8677], ['Riverside', 'CA', 33.9806, -117.3755],
  ['Palm Springs', 'CA', 33.8303, -116.5453], ['San Bernardino', 'CA', 34.1083, -117.2898],
  ['Chicago', 'IL', 41.8781, -87.6298], ['Aurora', 'IL', 41.7606, -88.3201],
  ['Houston', 'TX', 29.7604, -95.3698], ['San Antonio', 'TX', 29.4241, -98.4936],
  ['Dallas', 'TX', 32.7767, -96.797], ['Austin', 'TX', 30.2672, -97.7431],
  ['Fort Worth', 'TX', 32.7555, -97.3308], ['El Paso', 'TX', 31.7619, -106.485],
  ['Phoenix', 'AZ', 33.4484, -112.074], ['Tucson', 'AZ', 32.2226, -110.9747],
  ['Mesa', 'AZ', 33.4152, -111.8315], ['Scottsdale', 'AZ', 33.4942, -111.9261],
  ['Tempe', 'AZ', 33.4255, -111.94], ['Philadelphia', 'PA', 39.9526, -75.1652],
  ['Pittsburgh', 'PA', 40.4406, -79.9959], ['Las Vegas', 'NV', 36.1699, -115.1398],
  ['Henderson', 'NV', 36.0395, -114.9817], ['Reno', 'NV', 39.5296, -119.8138],
  ['Miami', 'FL', 25.7617, -80.1918], ['Miami Beach', 'FL', 25.7907, -80.13],
  ['Orlando', 'FL', 28.5383, -81.3792], ['Tampa', 'FL', 27.9506, -82.4572],
  ['Jacksonville', 'FL', 30.3322, -81.6557], ['Fort Lauderdale', 'FL', 26.1224, -80.1373],
  ['St. Petersburg', 'FL', 27.7676, -82.6403], ['Tallahassee', 'FL', 30.4383, -84.2807],
  ['Denver', 'CO', 39.7392, -104.9903], ['Boulder', 'CO', 40.015, -105.2705],
  ['Colorado Springs', 'CO', 38.8339, -104.8214], ['Fort Collins', 'CO', 40.5853, -105.0844],
  ['Morrison', 'CO', 39.6536, -105.1942], ['Seattle', 'WA', 47.6062, -122.3321],
  ['Tacoma', 'WA', 47.2529, -122.4443], ['Spokane', 'WA', 47.6588, -117.426],
  ['Quincy', 'WA', 47.2343, -119.8526], ['Portland', 'OR', 45.5152, -122.6784],
  ['Eugene', 'OR', 44.0521, -123.0868], ['Boston', 'MA', 42.3601, -71.0589],
  ['Worcester', 'MA', 42.2626, -71.8023], ['Cambridge', 'MA', 42.3736, -71.1097],
  ['Atlanta', 'GA', 33.749, -84.388], ['Savannah', 'GA', 32.0809, -81.0912],
  ['Athens', 'GA', 33.9519, -83.3576], ['Washington', 'DC', 38.9072, -77.0369],
  ['Detroit', 'MI', 42.3314, -83.0458], ['Grand Rapids', 'MI', 42.9634, -85.6681],
  ['Ann Arbor', 'MI', 42.2808, -83.743], ['Minneapolis', 'MN', 44.9778, -93.265],
  ['St. Paul', 'MN', 44.9537, -93.09], ['Nashville', 'TN', 36.1627, -86.7816],
  ['Memphis', 'TN', 35.1495, -90.049], ['Knoxville', 'TN', 35.9606, -83.9207],
  ['Manchester', 'TN', 35.4817, -86.0886], ['New Orleans', 'LA', 29.9511, -90.0715],
  ['Baton Rouge', 'LA', 30.4515, -91.1871], ['Charlotte', 'NC', 35.2271, -80.8431],
  ['Raleigh', 'NC', 35.7796, -78.6382], ['Durham', 'NC', 35.994, -78.8986],
  ['Asheville', 'NC', 35.5951, -82.5515], ['Columbus', 'OH', 39.9612, -82.9988],
  ['Cleveland', 'OH', 41.4993, -81.6944], ['Cincinnati', 'OH', 39.1031, -84.512],
  ['Indianapolis', 'IN', 39.7684, -86.1581], ['Kansas City', 'MO', 39.0997, -94.5786],
  ['St. Louis', 'MO', 38.627, -90.1994], ['Milwaukee', 'WI', 43.0389, -87.9065],
  ['Madison', 'WI', 43.0731, -89.4012], ['Salt Lake City', 'UT', 40.7608, -111.891],
  ['Park City', 'UT', 40.6461, -111.498], ['Baltimore', 'MD', 39.2904, -76.6122],
  ['Columbia', 'MD', 39.2037, -76.861], ['Louisville', 'KY', 38.2527, -85.7585],
  ['Lexington', 'KY', 38.0406, -84.5037], ['Richmond', 'VA', 37.5407, -77.436],
  ['Virginia Beach', 'VA', 36.8529, -75.978], ['Norfolk', 'VA', 36.8508, -76.2859],
  ['Oklahoma City', 'OK', 35.4676, -97.5164], ['Tulsa', 'OK', 36.154, -95.9928],
  ['Albuquerque', 'NM', 35.0844, -106.6504], ['Santa Fe', 'NM', 35.687, -105.9378],
  ['Omaha', 'NE', 41.2565, -95.9345], ['Des Moines', 'IA', 41.5868, -93.625],
  ['Boise', 'ID', 43.615, -116.2023], ['Honolulu', 'HI', 21.3069, -157.8583],
  ['Anchorage', 'AK', 61.2181, -149.9003], ['Newark', 'NJ', 40.7357, -74.1724],
  ['Jersey City', 'NJ', 40.7178, -74.0431], ['Atlantic City', 'NJ', 39.3643, -74.4229],
  ['Hartford', 'CT', 41.7658, -72.6734], ['New Haven', 'CT', 41.3083, -72.9279],
  ['Providence', 'RI', 41.824, -71.4128], ['Birmingham', 'AL', 33.5186, -86.8104],
  ['Charleston', 'SC', 32.7765, -79.9311], ['Columbia', 'SC', 34.0007, -81.0348],
  ['Little Rock', 'AR', 34.7465, -92.2896], ['Jackson', 'MS', 32.2988, -90.1848],
  ['Wichita', 'KS', 37.6872, -97.3301], ['Billings', 'MT', 45.7833, -108.5007],
  ['Portland', 'ME', 43.6591, -70.2568], ['Burlington', 'VT', 44.4759, -73.2121],
  ['Manchester', 'NH', 42.9956, -71.4548], ['Wilmington', 'DE', 39.7459, -75.5466],
  ['Charleston', 'WV', 38.3498, -81.6326], ['Sioux Falls', 'SD', 43.5446, -96.7311],
  ['Fargo', 'ND', 46.8772, -96.7898], ['Cheyenne', 'WY', 41.14, -104.8202],
] as [string, string, number, number][]).map(([city, state, latitude, longitude]) => [
  `${city.toLocaleLowerCase()}|${state.toLocaleLowerCase()}`,
  { latitude, longitude },
]));
let catalogPromise: Promise<DropEvent[]> | null = null;

function upcomingSince() {
  return new Date(Date.now() - EVENT_GRACE_MS).toISOString();
}

function isEventPast(event: DropEvent) {
  const start = new Date(event.date).getTime();
  if (Number.isNaN(start)) return false;
  const authoredEnd = event.end_date ? new Date(event.end_date).getTime() : NaN;
  const end = Number.isFinite(authoredEnd) && authoredEnd >= start ? authoredEnd : start;
  return end + EVENT_GRACE_MS < Date.now();
}

async function fetchEvents() {
  if (!catalogPromise) {
    catalogPromise = (async () => {
      const since = upcomingSince();
      const base = () => supabase
        .from('events')
        .select(EVENT_SELECT)
        .eq('status', 'published');
      const future: DropEvent[] = [];
      for (let offset = 0; offset < MAX_CATALOG_EVENTS; offset += PAGE_SIZE) {
        const { data, error } = await base()
          .gte('date', since)
          .order('date', { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);
        if (error) throw error;
        const page = (data ?? []) as unknown as DropEvent[];
        future.push(...page);
        if (page.length < PAGE_SIZE) break;
      }
      const ongoing = await base()
        .eq('is_festival', true)
        .lt('date', since)
        .not('end_date', 'is', null)
        .gte('end_date', since)
        .order('end_date', { ascending: true })
        .limit(100);
      if (ongoing.error) throw ongoing.error;
      return Array.from(
        new Map([
          ...(ongoing.data ?? []) as unknown as DropEvent[],
          ...future,
        ].map((event) => [event.id, event])).values(),
      ).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    })().catch((error) => {
      catalogPromise = null;
      throw error;
    });
  }
  return catalogPromise;
}

export function loadEventCatalog() {
  return fetchEvents();
}

export async function loadEventById(eventId: string) {
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_SELECT)
    .eq('status', 'published')
    .eq('id', eventId)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as DropEvent | null;
}

async function loadEventsByArtistId(artistId: string) {
  const since = upcomingSince();
  const base = () => supabase
    .from('events')
    .select(ARTIST_EVENT_SELECT)
    .eq('status', 'published')
    .eq('event_artists.artist_id', artistId);
  const [future, ongoing] = await Promise.all([
    base().gte('date', since).order('date', { ascending: true }).limit(500),
    base()
      .eq('is_festival', true)
      .lt('date', since)
      .not('end_date', 'is', null)
      .gte('end_date', since)
      .order('end_date', { ascending: true })
      .limit(100),
  ]);
  if (future.error) throw future.error;
  if (ongoing.error) throw ongoing.error;
  return Array.from(
    new Map([
      ...(ongoing.data ?? []) as unknown as DropEvent[],
      ...(future.data ?? []) as unknown as DropEvent[],
    ].map((event) => [event.id, event])).values(),
  ).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

async function fetchPersonalizedEvents(
  userId: string,
  events: DropEvent[],
  location: { city?: string; state?: string },
) {
  const [{ data: follows, error: followError }, { data: friendships, error: friendshipError }, { data: blocks, error: blockError }] = await Promise.all([
    supabase.from('artist_follows').select('artist_id').eq('user_id', userId).limit(100),
    supabase
      .from('friendships')
      .select('requester_id,recipient_id,status')
      .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`)
      .eq('status', 'accepted'),
    supabase.from('user_blocks').select('blocked_id').eq('blocker_id', userId),
  ]);
  if (followError) throw followError;
  if (friendshipError) throw friendshipError;
  if (blockError) throw blockError;

  const followedIds = new Set((follows ?? []).map((row) => row.artist_id));
  const followedGenres = new Set<string>();
  if (followedIds.size) {
    const { data, error } = await supabase.from('artists').select('genres').in('id', [...followedIds]);
    if (error) throw error;
    for (const row of data ?? []) {
      for (const item of displayGenres(row.genres ?? [])) followedGenres.add(item);
    }
  }

  const scored = events.map((event) => {
    const eventArtistIds = new Set(artists(event).map((artist) => artist.id));
    const direct = [...followedIds].some((id) => eventArtistIds.has(id));
    const overlap = [...eventGenres(event)].filter((item) => followedGenres.has(item)).length;
    const nearby = location.city
      ? event.city?.toLocaleLowerCase() === location.city.toLocaleLowerCase()
      : Boolean(location.state && normalizeState(event.state) === normalizeState(location.state));
    return { event, score: (direct ? 1000 : overlap * 100) + (nearby ? 15 : 0) };
  });
  const personalized = scored.filter(({ score }) => score >= 100);
  const forYou = (personalized.length ? personalized : scored)
    .sort((a, b) => b.score - a.score || a.event.date.localeCompare(b.event.date))
    .slice(0, 10)
    .map(({ event }) => event);

  const blockedIds = new Set((blocks ?? []).map((row) => row.blocked_id));
  const friendIds = (friendships ?? []).map((row) => row.requester_id === userId ? row.recipient_id : row.requester_id)
    .filter((id) => !blockedIds.has(id));
  if (!friendIds.length || !events.length) return { forYou, crew: [] };
  const { data: attendance, error: attendanceError } = await supabase
    .from('attendance')
    .select('event_id')
    .in('user_id', friendIds)
    .eq('status', 'going');
  if (attendanceError) throw attendanceError;
  const counts = new Map<string, number>();
  for (const row of attendance ?? []) counts.set(row.event_id, (counts.get(row.event_id) ?? 0) + 1);
  const visibleIds = new Set((await Promise.all([...counts.keys()].map(async (eventId) => {
    const { data, error } = await supabase.rpc('recap_crew_for', { p_event: eventId });
    if (error) throw error;
    return data?.length ? eventId : null;
  }))).filter((eventId): eventId is string => Boolean(eventId)));
  const crew = events.filter((event) => visibleIds.has(event.id))
    .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || a.date.localeCompare(b.date));
  return { forYou, crew };
}

const GENRE_BUCKETS = [
  { label: 'Bass', keys: ['bass', 'dubstep', 'riddim', 'trap'] },
  { label: 'Techno', keys: ['techno', 'hardstyle'] },
  { label: 'House', keys: ['house', 'trance'] },
  { label: 'Drum & Bass', keys: ['drum and bass', 'drum & bass', 'dnb', 'd&b', 'jungle', 'breakbeat'] },
  { label: 'Hip-Hop', keys: ['hip hop', 'hip-hop', 'rap', 'r&b', 'rnb'] },
  { label: 'Indie', keys: ['indie', 'rock', 'alternative', 'folk'] },
  { label: 'Electronic', keys: ['edm', 'electronic', 'dance'] },
] as const;
const GENERIC_GENRES = new Set(['edm', 'electronic', 'dance', 'pop']);

function normalizeGenre(raw: string, skipGeneric = false) {
  const value = raw.trim().toLocaleLowerCase();
  if (!value || (skipGeneric && GENERIC_GENRES.has(value))) return null;
  return GENRE_BUCKETS.find((bucket) => bucket.keys.some((key) => value.includes(key)))?.label ?? null;
}

function displayGenres(raw: string[]) {
  const output = new Set<string>();
  for (const pass of [true, false]) {
    for (const item of raw) {
      const normalized = normalizeGenre(item, pass);
      if (normalized) output.add(normalized);
    }
    if (output.size) break;
  }
  return output;
}

function eventGenres(event: DropEvent) {
  if (event.is_festival) return new Set(['Festival']);
  return displayGenres(artists(event).flatMap((artist) => artist.genres ?? []));
}

function matchesDiscoverGenre(event: DropEvent, selected: (typeof discoverGenres)[number]) {
  if (selected === 'Festivals') return event.is_festival;
  const raw = artists(event).flatMap((artist) => artist.genres ?? []).map((item) => item.toLocaleLowerCase());
  if (selected === 'Dubstep') return raw.some((item) => ['bass', 'riddim', 'brostep'].includes(item) || item.includes('dubstep'));
  if (selected === 'Clubs') return raw.some((item) => ['electronic', 'dance', 'house', 'techno'].some((genre) => item.includes(genre)));
  return eventGenres(event).has(selected);
}

function genre(event: DropEvent) {
  return eventGenres(event).values().next().value ?? 'Live';
}

async function fetchEvent(id: string) {
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_SELECT)
    .eq('id', id)
    .eq('status', 'published')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Show not found.');
  return data as unknown as DropEvent;
}

async function fetchEventComments(eventId: string) {
  const { data, error } = await supabase
    .from('event_comments')
    .select('id,event_id,user_id,body,created_at,profiles!event_comments_user_id_fkey(id,username,display_name,profile_image)')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return ((data ?? []) as unknown as EventComment[]).reverse();
}

function artists(event: DropEvent) {
  return [...event.event_artists]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map(({ artists: artist }) => artist)
    .filter(Boolean) as Artist[];
}

function eventMatchesDate(event: DropEvent, filter: (typeof dateFilters)[number]) {
  if (filter === 'Any time') return true;
  const date = new Date(event.date);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  let start = now;
  const end = new Date(now);
  if (filter === 'Today') end.setHours(23, 59, 59, 999);
  if (filter === 'This weekend') {
    const day = now.getDay();
    const friday = new Date(now);
    friday.setHours(0, 0, 0, 0);
    friday.setDate(now.getDate() + (day === 0 ? -2 : 5 - day));
    if (day >= 1 && day <= 4) start = friday;
    end.setTime(friday.getTime());
    end.setDate(friday.getDate() + 2);
    end.setHours(23, 59, 59, 999);
  }
  if (filter === 'Next 30 days') end.setDate(now.getDate() + 30);
  const authoredEnd = event.end_date ? new Date(event.end_date).getTime() : NaN;
  const eventEnd = Number.isFinite(authoredEnd) && authoredEnd >= date.getTime() ? authoredEnd : date.getTime();
  return date <= end && eventEnd + EVENT_GRACE_MS >= start.getTime();
}

function eventMatchesQuery(event: DropEvent, query: string) {
  const haystack = [
    event.title, event.venue_name, event.city, event.state, ...artists(event).map((artist) => artist.name),
    ...eventGenres(event),
  ].filter(Boolean).join(' ').toLocaleLowerCase();
  return haystack.includes(query.trim().toLocaleLowerCase());
}

function formatEventDate(event: DropEvent, includeYear = false) {
  const date = new Date(event.date);
  if (Number.isNaN(date.getTime())) return 'Date TBA';
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' } : {}),
    timeZone: event.timezone || undefined,
  };
  try {
    return new Intl.DateTimeFormat(undefined, options).format(date);
  } catch {
    delete options.timeZone;
    return new Intl.DateTimeFormat(undefined, options).format(date);
  }
}

function formatEventTime(event: DropEvent) {
  if (event.time_tbd) return 'Time TBA';
  const date = new Date(event.date);
  if (Number.isNaN(date.getTime())) return 'Time TBA';
  const options: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: event.timezone || undefined,
  };
  try {
    return new Intl.DateTimeFormat(undefined, options).format(date);
  } catch {
    delete options.timeZone;
    return new Intl.DateTimeFormat(undefined, options).format(date);
  }
}

function formatPrice(event: DropEvent) {
  if (event.price_min == null) return 'Price TBA';
  const currency = event.currency || 'USD';
  const format = new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 });
  if (event.price_max != null && event.price_max !== event.price_min) {
    return `${format.format(event.price_min)}–${format.format(event.price_max)}`;
  }
  return `From ${format.format(event.price_min)}`;
}

function safeHttpUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function cityKey(city?: string | null, state?: string | null) {
  return `${(city ?? '').trim().toLocaleLowerCase()}|${(state ?? '').trim().toLocaleLowerCase()}`;
}

function normalizeState(value?: string | null) {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return '';
  return STATE_CODES[trimmed.toLocaleLowerCase().replace(/[^a-z]/g, '')] ?? trimmed.toUpperCase();
}

function cityParamKey(value: string | null) {
  if (!value?.trim()) return '';
  const [city, state = ''] = value.split(',').map((part) => part.trim());
  return city ? cityKey(city, normalizeState(state)) : '';
}

function cityParamKeys(params: URLSearchParams) {
  return [...new Set(params.getAll('city').map(cityParamKey).filter((key) => key))];
}

function cityKeyLabel(key: string) {
  const [city, state = ''] = key.split('|');
  const title = city.replace(/\b[a-z]/g, (letter) => letter.toLocaleUpperCase());
  return [title, state.toLocaleUpperCase()].filter(Boolean).join(', ');
}

function eventMatchesCitySelection(event: DropEvent, selection: string) {
  const [city, state = ''] = selection.split('|');
  return normalized(event.city) === normalized(city)
    && (!state || normalizeState(event.state).toLocaleLowerCase() === state);
}

export function coordinatesForCity(city?: string | null, state?: string | null) {
  const cityName = city?.trim().toLocaleLowerCase();
  if (!cityName) return null;
  const exact = CITY_COORDS[cityKey(cityName, normalizeState(state))];
  if (exact) return exact;
  const matches = Object.entries(CITY_COORDS).filter(([key]) => key.startsWith(`${cityName}|`));
  return matches.length === 1 ? matches[0][1] : null;
}

function milesBetween(a: Coordinates, b: Coordinates) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const lat1 = radians(a.latitude);
  const lat2 = radians(b.latitude);
  const value = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function nearestSupportedCity(origin: Coordinates) {
  let nearest: { city: string; state: string; coordinates: Coordinates } | null = null;
  let nearestMiles = Infinity;
  for (const [key, coordinates] of Object.entries(CITY_COORDS)) {
    const miles = milesBetween(origin, coordinates);
    if (miles >= nearestMiles) continue;
    const [city, state] = key.split('|');
    nearest = {
      city: city.replace(/\b\w/g, (letter) => letter.toUpperCase()),
      state: state.toUpperCase(),
      coordinates,
    };
    nearestMiles = miles;
  }
  return nearest;
}

function eventWithinDistance(
  event: DropEvent,
  origin: Coordinates | null,
  distance: Distance,
  areaCity: string,
  areaState: string,
) {
  if (!distance || !origin) return true;
  const eventOrigin = coordinatesForCity(event.city, event.state);
  if (eventOrigin) return milesBetween(origin, eventOrigin) <= distance;
  return Boolean(
    areaCity
    && event.city?.toLocaleLowerCase() === areaCity.toLocaleLowerCase()
    && (!areaState || !event.state || normalizeState(event.state) === normalizeState(areaState)),
  );
}

function eventMatchesPrice(event: DropEvent, minimum: number, maximum: number) {
  const low = event.price_min ?? event.price_max;
  const high = event.price_max ?? event.price_min;
  if (low == null || high == null) return true;
  return high >= minimum && (maximum === PRICE_CEILING || low <= maximum);
}

function latinFold(value: string | null | undefined) {
  return (value ?? '')
    .toLocaleLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/œ/g, 'oe')
    .replace(/ß/g, 'ss')
    .replace(/[øōő]/g, 'o')
    .replace(/ł/g, 'l')
    .replace(/đ/g, 'd')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalized(value: string | null | undefined) {
  return latinFold(value).replace(/[^a-z0-9]/g, '');
}

function venueTokens(value: string | null) {
  const ignored = new Set(['the', 'and', 'at', 'venue', 'center', 'centre', 'hall', 'arena', 'ballroom', 'nightclub']);
  return latinFold(value).split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !ignored.has(token));
}

function venuesCompatible(left: string | null, right: string | null) {
  const normalizedLeft = normalized(left);
  const normalizedRight = normalized(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (
    normalizedLeft === normalizedRight
    || (normalizedLeft.length >= 6 && normalizedRight.length >= 6
      && (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)))
  ) return true;
  const rightTokens = new Set(venueTokens(right));
  return [...new Set(venueTokens(left))].filter((token) => rightTokens.has(token)).length >= 2;
}

function comparableOfferEventIds(anchor: OfferCandidate, candidates: OfferCandidate[]) {
  const headliners = (candidate: OfferCandidate) => new Set(
    candidate.event_artists
      .filter((entry) => entry.position == null || entry.position === 0)
      .flatMap((entry) => [
        entry.artist_id ? `id:${entry.artist_id}` : '',
        entry.artists?.name ? `name:${normalized(entry.artists.name)}` : '',
      ])
      .filter(Boolean),
  );
  const anchorHeadliners = headliners(anchor);
  const matches = candidates.filter((candidate) => {
    if (candidate.id === anchor.id) return true;
    const candidateTime = Date.parse(candidate.date);
    const anchorTime = Date.parse(anchor.date);
    const candidateState = normalizeState(candidate.state);
    const anchorState = normalizeState(anchor.state);
    if (
      !Number.isFinite(candidateTime)
      || !Number.isFinite(anchorTime)
      || Math.abs(candidateTime - anchorTime) > EVENT_GRACE_MS
      || normalized(candidate.city) !== normalized(anchor.city)
      || Boolean(candidateState && anchorState && candidateState !== anchorState)
    ) return false;
    const sameVenue = anchor.venue_id && candidate.venue_id
      ? anchor.venue_id === candidate.venue_id
      : venuesCompatible(anchor.venue_name, candidate.venue_name);
    if (normalized(candidate.title) === normalized(anchor.title)) return sameVenue;
    return venuesCompatible(anchor.venue_name, candidate.venue_name)
      && [...headliners(candidate)].some((headliner) => anchorHeadliners.has(headliner));
  });
  if (matches.length < 2) return [anchor.id];
  const sourceCounts = new Map<string, number>();
  for (const candidate of matches) {
    const source = normalized(candidate.source);
    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
  }
  return [...sourceCounts.values()].some((count) => count > 1)
    ? [anchor.id]
    : matches.map((candidate) => candidate.id);
}

async function fetchTicketOffers(event: DropEvent) {
  let eventIds = [event.id];
  const anchorTime = Date.parse(event.date);
  if (Number.isFinite(anchorTime)) {
    const candidateRows: OfferCandidate[] = [];
    let candidateLoadFailed = false;
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from('events')
        .select('id,title,date,city,state,venue_name,venue_id,source,event_artists(artist_id,position,artists(name))')
        .eq('status', 'published')
        .gte('date', new Date(anchorTime - EVENT_GRACE_MS).toISOString())
        .lte('date', new Date(anchorTime + EVENT_GRACE_MS).toISOString())
        .order('id')
        .range(offset, offset + pageSize - 1);
      if (error) {
        candidateLoadFailed = true;
        break;
      }
      candidateRows.push(...((data ?? []) as unknown as OfferCandidate[]));
      if ((data?.length ?? 0) < pageSize) break;
    }
    if (!candidateLoadFailed) {
      const candidates = new Map<string, OfferCandidate>([
        [event.id, event],
        ...candidateRows.map((candidate) => [candidate.id, candidate] as const),
      ]);
      eventIds = comparableOfferEventIds(event, [...candidates.values()]);
    }
  }
  const { data, error } = await supabase
    .from('ticket_offers')
    .select('id,event_id,vendor,url,price_min,price_max,currency,fetched_at')
    .in('event_id', eventIds);
  if (error) return [];
  const byVendor = new Map<string, TicketOffer>();
  for (const row of (data ?? []) as unknown as TicketOffer[]) {
    const offer = {
      ...row,
      price_min: row.price_min == null ? null : Number(row.price_min),
      price_max: row.price_max == null ? null : Number(row.price_max),
    };
    const key = normalized(offer.vendor);
    const current = byVendor.get(key);
    if (!current) {
      byVendor.set(key, offer);
      continue;
    }
    const timestamp = (item: TicketOffer) => Date.parse(item.fetched_at ?? '') || 0;
    const newer = timestamp(offer) !== timestamp(current)
      ? (timestamp(offer) > timestamp(current) ? offer : current)
      : (offer.id.localeCompare(current.id) <= 0 ? offer : current);
    const currentPriced = current.price_min != null || current.price_max != null;
    const offerPriced = offer.price_min != null || offer.price_max != null;
    const priced = currentPriced && offerPriced ? newer : currentPriced ? current : offerPriced ? offer : null;
    const linked = current.url && offer.url ? newer : current.url ? current : offer.url ? offer : null;
    byVendor.set(key, {
      ...newer,
      url: linked?.url ?? null,
      price_min: priced?.price_min ?? null,
      price_max: priced?.price_max ?? null,
      currency: priced?.currency ?? newer.currency ?? null,
    });
  }
  return [...byVendor.values()]
    .sort((left, right) => (estimatedAllIn(left) ?? Infinity) - (estimatedAllIn(right) ?? Infinity));
}

function weatherEligible(event: DropEvent) {
  const eventTime = Date.parse(event.date);
  const now = Date.now();
  return !event.time_tbd && Number.isFinite(eventTime) && eventTime >= now
    && eventTime - now <= 7 * 24 * 60 * 60 * 1000;
}

function parseWeather(value: unknown): EventWeather | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const envelope = value as Record<string, unknown>;
  const raw = envelope.ok === true && envelope.weather && typeof envelope.weather === 'object'
    ? envelope.weather as Record<string, unknown>
    : null;
  if (!raw || typeof raw.forecastTime !== 'string' || !Number.isFinite(Date.parse(raw.forecastTime))) return null;
  const temperature = raw.temperature === null || (typeof raw.temperature === 'number' && Number.isFinite(raw.temperature))
    ? raw.temperature as number | null
    : null;
  const temperatureUnit = raw.temperatureUnit === 'F' || raw.temperatureUnit === 'C' ? raw.temperatureUnit : null;
  const precipitation = raw.precipitationProbability === null
    || (typeof raw.precipitationProbability === 'number'
      && raw.precipitationProbability >= 0
      && raw.precipitationProbability <= 100)
    ? raw.precipitationProbability as number | null
    : null;
  return {
    temperature,
    temperatureUnit,
    shortForecast: typeof raw.shortForecast === 'string' ? raw.shortForecast.slice(0, 120) : null,
    precipitationProbability: precipitation,
    forecastTime: raw.forecastTime,
  };
}

function weatherLabel(weather: EventWeather) {
  return [
    weather.temperature != null && weather.temperatureUnit ? `${Math.round(weather.temperature)}°${weather.temperatureUnit}` : '',
    weather.shortForecast ?? '',
    weather.precipitationProbability != null ? `${Math.round(weather.precipitationProbability)}% precip` : '',
  ].filter(Boolean).join(' · ');
}

function presaleState(event: DropEvent) {
  if (!event.presale_start) return null;
  const start = Date.parse(event.presale_start);
  const end = event.onsale_start ? Date.parse(event.onsale_start) : NaN;
  const now = Date.now();
  if (!Number.isFinite(start)) return null;
  if (now < start) return 'upcoming' as const;
  if (!Number.isFinite(end) || now < end) return 'active' as const;
  return null;
}

function vendorFeeRate(vendor: string) {
  const normalized = vendor.toLocaleLowerCase();
  if (normalized.includes('ticketmaster')) return 0.27;
  if (normalized.includes('seatgeek')) return 0.22;
  if (normalized.includes('axs')) return 0.2;
  if (normalized.includes('dice')) return 0.12;
  if (normalized.includes('eventbrite')) return 0.08;
  if (normalized.includes('front gate')) return 0.25;
  return 0.25;
}

function estimatedAllIn(offer: TicketOffer) {
  const price = offer.price_min ?? offer.price_max;
  return price == null ? null : price * (1 + vendorFeeRate(offer.vendor));
}

function formatMoney(value: number, currency = 'USD') {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function personName(profile: CommentProfile | null) {
  return profile?.display_name || profile?.username || 'Drop user';
}

function timeAgo(value: string) {
  const elapsed = Date.now() - Date.parse(value);
  if (!Number.isFinite(elapsed) || elapsed < 0) return 'now';
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

const DISALLOWED_PATTERNS = [
  /\bf+u+c+k+\w*/i, /\bs+h+i+t+\w*/i, /\bb+i+t+c+h+\w*/i,
  /\ba+s+s+h+o+l+e+\w*/i, /\bc+u+n+t+\w*/i, /\bd+i+c+k+h+e+a+d+\w*/i,
  /\bp+r+i+c+k+\b/i, /\bb+a+s+t+a+r+d+\w*/i, /\bw+h+o+r+e+\w*/i,
  /\bs+l+u+t+\w*/i, /\bn+i+gg+[ae]+r+\w*/i, /\bf+a+gg+o+t+\w*/i,
  /\bf+a+g+\b/i, /\br+e+t+a+r+d+\w*/i, /\bk+i+k+e+\b/i,
  /\bs+p+i+c+\b/i, /\bc+h+i+n+k+\b/i, /\bt+r+a+nn+y+\w*/i,
  /\bk+i+ll+\s+y+o+u+r+s+e+l+f\b/i, /\bk+y+s\b/i,
];

export function containsDisallowed(text: string) {
  return DISALLOWED_PATTERNS.some((pattern) => pattern.test(text.trim()));
}

function icsEscape(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1');
}

function icsDate(value: Date) {
  return value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function icsDay(value: Date) {
  return icsDate(value).slice(0, 8);
}

function foldIcsLine(line: string) {
  const encoder = new TextEncoder();
  const folded: string[] = [];
  let current = '';
  for (const character of line) {
    if (encoder.encode(current + character).length > 75) {
      folded.push(current);
      current = ` ${character}`;
    } else {
      current += character;
    }
  }
  folded.push(current);
  return folded.join('\r\n');
}

function icsDayInTimezone(value: Date, timezone: string | null) {
  if (!timezone) return icsDay(value);
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(value);
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
    const day = `${part('year')}${part('month')}${part('day')}`;
    return /^\d{8}$/.test(day) ? day : icsDay(value);
  } catch {
    return icsDay(value);
  }
}

function addIcsDays(day: string, amount: number) {
  const value = new Date(`${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return icsDay(value);
}

function addToCalendar(event: DropEvent) {
  const start = new Date(event.date);
  if (Number.isNaN(start.getTime())) throw new Error('Invalid event date');
  const authoredEnd = event.end_date ? new Date(event.end_date) : null;
  const end = authoredEnd && !Number.isNaN(authoredEnd.getTime()) && authoredEnd > start
    ? authoredEnd
    : new Date(start.getTime() + 3 * 60 * 60 * 1000);
  const location = [event.venue_name, event.city, event.state].filter(Boolean).join(', ');
  const url = new URL(PUBLIC_EVENT_URL);
  url.searchParams.set('id', event.id);
  const timing = event.time_tbd
    ? [
      `DTSTART;VALUE=DATE:${icsDayInTimezone(start, event.timezone)}`,
      ...(authoredEnd && !Number.isNaN(authoredEnd.getTime()) && authoredEnd > start
        ? [`DTEND;VALUE=DATE:${addIcsDays(icsDayInTimezone(authoredEnd, event.timezone), 1)}`]
        : []),
    ]
    : [`DTSTART:${icsDate(start)}`, `DTEND:${icsDate(end)}`];
  const content = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Drop//Event//EN',
    'BEGIN:VEVENT',
    `UID:${icsEscape(event.id)}@trydropapp.com`,
    `DTSTAMP:${icsDate(new Date())}`,
    ...timing,
    `SUMMARY:${icsEscape(event.title)}`,
    `LOCATION:${icsEscape(location)}`,
    `DESCRIPTION:${icsEscape(event.description ?? `Open in Drop: ${url}`)}`,
    `URL:${url}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].map(foldIcsLine).join('\r\n');
  const href = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = `${event.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'drop-event'}.ics`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}

function StatePanel({ state, message }: { state: 'loading' | 'empty' | 'error'; message?: string }) {
  const content = {
    loading: { icon: <CircleNotch className="spin" size={27} />, title: 'Loading shows', body: 'Finding what is happening near you.' },
    empty: { icon: <CalendarDots size={27} />, title: 'No shows found', body: message ?? 'Try another date, genre, or city.' },
    error: { icon: <WarningCircle size={27} />, title: 'Shows unavailable', body: message ?? 'Could not load shows. Try again shortly.' },
  }[state];
  return (
    <div className={`event-state event-state--${state}`} role={state === 'error' ? 'alert' : 'status'}>
      <span>{content.icon}</span>
      <h2>{content.title}</h2>
      <p>{content.body}</p>
    </div>
  );
}

function EventArtwork({ event }: { event: DropEvent }) {
  const candidates = [...new Set([
    safeHttpUrl(event.image_url),
    ...artists(event).map((artist) => safeHttpUrl(artist.image_url)),
  ].filter(Boolean) as string[])];
  const candidateKey = candidates.join('\n');
  const [imageIndex, setImageIndex] = useState(0);
  useEffect(() => setImageIndex(0), [event.id, candidateKey]);
  const image = candidates[imageIndex];
  return image
    ? <img src={image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setImageIndex((current) => current + 1)} />
    : <span className="event-artwork__fallback" aria-hidden="true"><ImageSquare size={34} /><b>{event.title}</b></span>;
}

function EventCard({ event }: { event: DropEvent }) {
  return (
    <Link className="event-card" to={`/event/${event.id}`} aria-label={`Open ${event.title}`}>
      <div className="event-card__art">
        <EventArtwork event={event} />
        <span className="event-card__scrim" aria-hidden="true" />
        <span className="event-card__genre">{genre(event)}</span>
        <span className="event-card__price">{formatPrice(event)}</span>
        <div className="event-card__body">
          <time dateTime={event.date}>{formatEventDate(event)} · {formatEventTime(event)}</time>
          <h3>{event.title}</h3>
          <p><MapPin size={15} /> {[event.venue_name, event.city].filter(Boolean).join(' · ') || 'Venue TBA'}</p>
        </div>
      </div>
    </Link>
  );
}

function EventGrid({ events }: { events: DropEvent[] }) {
  return <div className="event-grid">{events.map((event) => <EventCard key={event.id} event={event} />)}</div>;
}

export function EventRail({ events, label = 'Events' }: { events: DropEvent[]; label?: string }) {
  const rail = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true, overflow: false });

  function measure() {
    const element = rail.current;
    if (!element) return;
    setEdges({
      start: element.scrollLeft <= 2,
      end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 2,
      overflow: element.scrollWidth > element.clientWidth + 2,
    });
  }

  useEffect(() => {
    const element = rail.current;
    if (!element) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [events.length]);

  function scroll(direction: -1 | 1) {
    const element = rail.current;
    if (!element) return;
    element.scrollBy({ left: direction * Math.max(280, Math.round(element.clientWidth * 0.8)), behavior: 'smooth' });
  }

  return (
    <div className="event-rail-wrap">
      <button className="event-rail__button event-rail__button--previous" type="button" onClick={() => scroll(-1)} disabled={edges.start} hidden={!edges.overflow} aria-label={`Previous ${label}`}><CaretLeft size={19} weight="bold" /></button>
      <div className="event-rail" ref={rail} onScroll={measure} aria-label={label}>
        {events.map((event) => <EventCard key={event.id} event={event} />)}
      </div>
      <button className="event-rail__button event-rail__button--next" type="button" onClick={() => scroll(1)} disabled={edges.end} hidden={!edges.overflow} aria-label={`Next ${label}`}><CaretRight size={19} weight="bold" /></button>
    </div>
  );
}

function discoverGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function useEvents() {
  const [events, setEvents] = useState<DropEvent[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    let active = true;
    setState('loading');
    void fetchEvents()
      .then((rows) => { if (active) { setEvents(rows); setState('ready'); } })
      .catch(() => { if (active) setState('error'); });
    return () => { active = false; };
  }, []);
  return { events, state };
}

export function DiscoverPage() {
  const auth = useAuth();
  const city = auth.profile?.city || undefined;
  const stateCode = auth.profile?.state || undefined;
  const firstName = (auth.profile?.display_name || auth.profile?.username || auth.user?.email?.split('@')[0] || 'there').split(' ')[0];
  const { events, state } = useEvents();
  const [personal, setPersonal] = useState<{ forYou: DropEvent[]; crew: DropEvent[] }>({ forYou: [], crew: [] });
  const [personalState, setPersonalState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [section, setSection] = useState<(typeof sections)[number]>('Happening');
  const [dateFilter, setDateFilter] = useState<(typeof dateFilters)[number]>('Any time');
  const [discoverGenre, setDiscoverGenre] = useState<(typeof discoverGenres)[number] | null>(null);
  const scoped = useMemo(() => events.filter((event) => {
    if (city) {
      if (event.city?.toLocaleLowerCase() !== city.toLocaleLowerCase()) return false;
      return !stateCode || !event.state || normalizeState(event.state) === normalizeState(stateCode);
    }
    if (stateCode) return normalizeState(event.state) === normalizeState(stateCode);
    return true;
  }), [city, events, stateCode]);
  const visible = useMemo(() => scoped.filter((event) => (
    eventMatchesDate(event, dateFilter)
    && (!discoverGenre || matchesDiscoverGenre(event, discoverGenre))
  )), [discoverGenre, scoped, dateFilter]);
  const scopedIds = useMemo(() => new Set(scoped.map((event) => event.id)), [scoped]);
  const forYou = useMemo(() => personal.forYou.slice(0, 6), [personal.forYou]);
  const festivals = useMemo(
    () => events.filter((event) => event.is_festival).slice(0, 8),
    [events],
  );
  const crew = useMemo(() => {
    return personal.crew.filter((event) => scopedIds.has(event.id));
  }, [personal.crew, scopedIds]);

  useEffect(() => {
    if (state !== 'ready') return;
    if (!auth.user) {
      setPersonal({ forYou: events.slice(0, 10), crew: [] });
      setPersonalState('ready');
      return;
    }
    let active = true;
    setPersonalState('loading');
    void fetchPersonalizedEvents(auth.user.id, events, { city, state: stateCode })
      .then((next) => { if (active) { setPersonal(next); setPersonalState('ready'); } })
      .catch(() => { if (active) setPersonalState('error'); });
    return () => { active = false; };
  }, [auth.user, city, events, state, stateCode]);

  return (
    <section className="discovery-page" aria-label="Discover">
      <div className="discover-desktop">
        <p className="discover-greeting">{discoverGreeting()}, {firstName} — here&apos;s what&apos;s moving in {city ? `${city}${stateCode ? `, ${stateCode}` : ''}` : 'your area'}.</p>
        <div className="discover-filter-row">
          <div className="chip-rail" aria-label="Date scope">
            {dateFilters.map((item) => <button key={item} className={dateFilter === item ? 'is-active' : ''} type="button" aria-pressed={dateFilter === item} onClick={() => setDateFilter(item)}>{item}</button>)}
          </div>
          <Link className="view-map-link" to="/map"><MapPin size={15} /> Map</Link>
        </div>
        <div className="genre-tile-rail" aria-label="Browse by genre">
          {discoverGenres.map((item) => (
            <button key={item} className={discoverGenre === item ? 'is-active' : ''} type="button" aria-pressed={discoverGenre === item} onClick={() => setDiscoverGenre((current) => current === item ? null : item)}>
              <span>{item}</span>
            </button>
          ))}
        </div>
        {state === 'loading' && <StatePanel state="loading" />}
        {state === 'error' && <StatePanel state="error" />}
        {state === 'ready' && <>
          <section className="discover-section" aria-labelledby="for-you-heading">
            <header><h2 id="for-you-heading">For You</h2><Link to="/search">See all</Link></header>
            {personalState === 'loading' && <StatePanel state="loading" />}
            {personalState === 'error' && <StatePanel state="error" message="Could not load your picks." />}
            {personalState === 'ready' && (forYou.length
              ? <EventRail events={forYou} label="For You shows" />
              : <p className="section-empty">Follow artists in Drop to build your personalized feed.</p>)}
          </section>
          <section className="discover-section" aria-labelledby="upcoming-heading">
            <header className="discover-section__centered-header"><h2 id="upcoming-heading">{discoverGenre ? `${discoverGenre} shows` : 'Upcoming'}</h2><span>{visible.length}</span></header>
            {visible.length ? <EventGrid events={visible} /> : <StatePanel state="empty" />}
          </section>
          <section className="discover-section" aria-labelledby="festival-heading">
            <header><h2 id="festival-heading">Global festivals</h2><Link to="/festivals">See all</Link></header>
            {festivals.length
              ? <EventRail events={festivals} label="Global festivals" />
              : <p className="section-empty">Festival schedules will appear when published events are available.</p>}
          </section>
        </>}
      </div>

      <div className="discover-mobile">
        <header className="discovery-heading">
          <p>YOUR NEXT NIGHT OUT</p>
          <h2>{city ? `Shows near ${city}` : 'Shows near you'}</h2>
        </header>
        <div className="segment-control" aria-label="Discover feed">
          {sections.map((item) => <button key={item} className={section === item ? 'is-active' : ''} type="button" aria-pressed={section === item} onClick={() => setSection(item)}>{item}</button>)}
        </div>
        {section === 'Happening' && (
          <>
            <div className="chip-rail" aria-label="Date filter">
              {dateFilters.map((item) => <button key={item} className={dateFilter === item ? 'is-active' : ''} type="button" aria-pressed={dateFilter === item} onClick={() => setDateFilter(item)}>{item}</button>)}
            </div>
            <h3 className="mobile-rail-title">Pick your night</h3>
            <div className="genre-tile-rail genre-tile-rail--mobile" aria-label="Browse by genre">
              {discoverGenres.map((item) => (
                <button key={item} className={discoverGenre === item ? 'is-active' : ''} type="button" aria-pressed={discoverGenre === item} onClick={() => setDiscoverGenre((current) => current === item ? null : item)}>
                  <span>{item}</span>
                </button>
              ))}
            </div>
            {festivals[0] && <Link className="festival-banner" to={`/event/${festivals[0].id}`}><Flag size={18} /><span><strong>{festivals[0].title}</strong><small>{formatEventDate(festivals[0])} · View festival</small></span><CaretRight size={17} /></Link>}
            {state === 'loading' && <StatePanel state="loading" />}
            {state === 'error' && <StatePanel state="error" />}
            {state === 'ready' && (visible.length ? <EventGrid events={visible} /> : <StatePanel state="empty" />)}
          </>
        )}
        {section === 'For You' && personalState === 'loading' && <StatePanel state="loading" />}
        {section === 'For You' && personalState === 'error' && <StatePanel state="error" message="Could not load your picks." />}
        {section === 'For You' && personalState === 'ready' && (personal.forYou.length
          ? <EventRail events={personal.forYou} label="For You shows" />
          : <StatePanel state="empty" message="Follow artists in Drop to build your personalized feed." />)}
        {section === 'Crew' && personalState === 'loading' && <StatePanel state="loading" />}
        {section === 'Crew' && personalState === 'error' && <StatePanel state="error" message="Could not load crew plans." />}
        {section === 'Crew' && personalState === 'ready' && (crew.length
          ? <EventGrid events={crew} />
          : <StatePanel state="empty" message="Crew shows appear when friends mark that they are going." />)}
      </div>
    </section>
  );
}

export function SearchPage() {
  const auth = useAuth();
  const { events, state } = useEvents();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>(() => cityParamKeys(searchParams));
  const [genreQuery, setGenreQuery] = useState('');
  const [cityQuery, setCityQuery] = useState('');
  const [genreOpen, setGenreOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [areaActive, setAreaActive] = useState(false);
  const [area, setArea] = useState<Coordinates | null>(null);
  const [areaLabel, setAreaLabel] = useState('');
  const [areaCity, setAreaCity] = useState('');
  const [areaState, setAreaState] = useState('');
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [distance, setDistance] = useState<Distance>(null);
  const [priceMinimum, setPriceMinimum] = useState(0);
  const [priceMaximum, setPriceMaximum] = useState(PRICE_CEILING);
  const [resultLimit, setResultLimit] = useState(24);
  const filterDialogRef = useRef<HTMLElement | null>(null);
  const filterOpenerRef = useRef<HTMLElement | null>(null);
  const filterButtonRef = useRef<HTMLButtonElement | null>(null);
  const searchSuggestionsRef = useRef<HTMLDivElement | null>(null);
  const searchSuggestionPointerDownRef = useRef(false);
  const usingCurrentLocationRef = useRef(false);
  const [recents, setRecents] = useState<SearchSuggestion[]>(() => {
    try {
      const value = JSON.parse(localStorage.getItem(SEARCH_RECENTS_KEY) ?? '[]');
      return Array.isArray(value) ? value.filter((item): item is SearchSuggestion => (
        item && typeof item === 'object'
        && typeof item.key === 'string'
        && typeof item.label === 'string'
        && typeof item.subtitle === 'string'
        && typeof item.value === 'string'
        && SEARCH_TYPES.has(item.type)
      )).slice(0, 5) : [];
    } catch {
      return [];
    }
  });
  const genres = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of events) {
      for (const item of eventGenres(event)) counts.set(item, (counts.get(item) ?? 0) + 1);
    }
    return [...counts].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .map(([item]) => item);
  }, [events]);
  const cities = useMemo(() => {
    const options = new Map<string, { key: string; label: string; city: string; state: string }>();
    for (const event of events) {
      const city = event.city?.trim();
      if (!city) continue;
      const stateCode = normalizeState(event.state);
      const key = cityKey(city, stateCode);
      options.set(key, { key, label: [city, stateCode].filter(Boolean).join(', '), city, state: stateCode });
    }
    return [...options.values()].sort((left, right) => left.label.localeCompare(right.label));
  }, [events]);
  const cityCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of events) {
      if (event.city) {
        const key = cityKey(event.city, normalizeState(event.state));
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return counts;
  }, [events]);

  useEffect(() => {
    setQuery(searchParams.get('q') ?? '');
    setSelectedCities(cityParamKeys(searchParams));
  }, [searchParamsKey]);

  useEffect(() => {
    if (usingCurrentLocationRef.current) return;
    const city = auth.profile?.city?.trim() ?? '';
    const stateCode = normalizeState(auth.profile?.state);
    setAreaCity(city);
    setAreaState(stateCode);
    setAreaLabel([city, stateCode].filter(Boolean).join(', '));
    setArea(coordinatesForCity(city, stateCode));
  }, [auth.profile?.city, auth.profile?.state]);

  const visible = useMemo(() => events.filter((event) => {
    if (selectedGenres.length && !selectedGenres.some((item) => eventGenres(event).has(item))) return false;
    if (selectedCities.length && !selectedCities.some((selection) => eventMatchesCitySelection(event, selection))) return false;
    if (areaActive && !distance) {
      if (areaCity && event.city?.toLocaleLowerCase() !== areaCity.toLocaleLowerCase()) return false;
      if (areaState && event.state && normalizeState(event.state) !== normalizeState(areaState)) return false;
    }
    if (!eventWithinDistance(event, area, distance, areaCity, areaState)) return false;
    if (!eventMatchesPrice(event, priceMinimum, priceMaximum)) return false;
    return !query.trim() || eventMatchesQuery(event, query);
  }), [
    area, areaActive, areaCity, areaState, distance, events, priceMaximum, priceMinimum,
    query, selectedCities, selectedGenres,
  ]);
  useEffect(() => setResultLimit(24), [
    areaActive, distance, priceMaximum, priceMinimum, query, selectedCities, selectedGenres,
  ]);

  useEffect(() => {
    if (!filterOpen) return;
    const previous = document.body.style.overflow;
    const focusableSelector = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');
    const frame = window.requestAnimationFrame(() => {
      const first = filterDialogRef.current?.querySelector<HTMLElement>(focusableSelector);
      (first ?? filterDialogRef.current)?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setFilterOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !filterDialogRef.current) return;
      const focusable = [...filterDialogRef.current.querySelectorAll<HTMLElement>(focusableSelector)];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) {
        event.preventDefault();
        filterDialogRef.current.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKeyDown);
      const opener = filterOpenerRef.current;
      (opener?.isConnected ? opener : filterButtonRef.current)?.focus();
    };
  }, [filterOpen]);

  const suggestions = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return [] as { label: SearchSuggestion['type']; items: SearchSuggestion[] }[];
    const groups = new Map<SearchSuggestion['type'], Map<string, SearchSuggestion>>([
      ['Venues', new Map()], ['Events', new Map()], ['Artists', new Map()],
      ['Cities', new Map()], ['Genres', new Map()],
    ]);
    const add = (suggestion: SearchSuggestion) => {
      if (suggestion.label.toLocaleLowerCase().includes(term)) {
        groups.get(suggestion.type)?.set(suggestion.key, suggestion);
      }
    };
    for (const event of events) {
      add({
        key: `event:${event.id}`, type: 'Events', label: event.title,
        subtitle: [formatEventDate(event), event.venue_name, event.city].filter(Boolean).join(' · '),
        value: event.title, eventId: event.id,
      });
      if (event.venue_name) add({
        key: `venue:${event.venue_name}|${event.city}`, type: 'Venues', label: event.venue_name,
        subtitle: [event.city, event.state].filter(Boolean).join(', ') || 'Venue',
        value: event.venue_name,
      });
      if (event.city) {
        const stateCode = normalizeState(event.state);
        const key = cityKey(event.city, stateCode);
        add({
          key: `city:${key}`, type: 'Cities', label: event.city,
          subtitle: [stateCode, `${cityCounts.get(key) ?? 0} upcoming shows`].filter(Boolean).join(' · '),
          value: key,
        });
      }
      for (const artist of artists(event)) add({
        key: `artist:${artist.id}`, type: 'Artists', label: artist.name,
        subtitle: 'Artist', value: artist.name,
      });
      for (const item of eventGenres(event)) add({
        key: `genre:${item}`, type: 'Genres', label: item,
        subtitle: 'Genre', value: item,
      });
    }
    const limits: Record<SearchSuggestion['type'], number> = {
      Venues: 2, Events: 3, Artists: 2, Cities: 2, Genres: 1,
    };
    return [...groups].map(([label, items]) => ({
      label,
      items: [...items.values()].slice(0, limits[label]),
    })).filter((group) => group.items.length);
  }, [cityCounts, events, query]);

  const priceActive = priceMinimum > 0 || priceMaximum < PRICE_CEILING;
  const distanceAvailable = Boolean(area);
  const activeFilterCount = (selectedCities.length ? 1 : 0)
    + (selectedGenres.length ? 1 : 0)
    + (areaActive ? 1 : 0)
    + (distance && distanceAvailable ? 1 : 0)
    + (priceActive ? 1 : 0);
  const summaryParts = [
    ...selectedGenres,
    ...selectedCities.map((key) => cities.find((city) => city.key === key)?.label ?? cityKeyLabel(key)),
    ...(areaActive && areaLabel ? [`Near ${areaLabel}`] : []),
    ...(distance && distanceAvailable ? [`${distance} mi`] : []),
    ...(priceActive ? [`$${priceMinimum}–$${priceMaximum}${priceMaximum === PRICE_CEILING ? '+' : ''}`] : []),
  ];
  const filterSummary = summaryParts.length > 2
    ? `${summaryParts.slice(0, 2).join(', ')} +${summaryParts.length - 2} more`
    : summaryParts.join(', ');
  const calm = !query.trim() && activeFilterCount === 0;
  const filteredGenres = genres.filter((item) => item.toLocaleLowerCase().includes(genreQuery.trim().toLocaleLowerCase()));
  const filteredCities = cities.filter((item) => item.label.toLocaleLowerCase().includes(cityQuery.trim().toLocaleLowerCase()));

  function remember(suggestion: SearchSuggestion) {
    const next = [suggestion, ...recents.filter((item) => item.key !== suggestion.key)].slice(0, 5);
    try {
      localStorage.setItem(SEARCH_RECENTS_KEY, JSON.stringify(next));
    } catch {
      // A full or disabled storage area should not break Search.
    }
    setRecents(next);
  }

  function applySuggestion(suggestion: SearchSuggestion) {
    remember(suggestion);
    let nextCities = selectedCities;
    if (suggestion.type === 'Cities') {
      nextCities = selectedCities.includes(suggestion.value) ? selectedCities : [...selectedCities, suggestion.value];
      setSelectedCities(nextCities);
      setAreaActive(false);
      setDistance(null);
    }
    if (suggestion.type === 'Genres') {
      setSelectedGenres((current) => current.includes(suggestion.value) ? current : [...current, suggestion.value]);
    }
    const nextQuery = suggestion.type === 'Cities' ? suggestion.label : suggestion.value;
    setQuery(nextQuery);
    syncSearchParams(nextQuery, nextCities);
    setSearchFocused(false);
  }

  function toggleSelection(value: string, selected: string[], update: (value: string[]) => void) {
    update(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  }

  function syncSearchParams(nextQuery: string, nextCities: string[]) {
    const next = new URLSearchParams(searchParams);
    nextQuery.trim() ? next.set('q', nextQuery) : next.delete('q');
    next.delete('city');
    for (const key of nextCities) {
      const label = cities.find((city) => city.key === key)?.label ?? cityKeyLabel(key);
      next.append('city', label);
    }
    setSearchParams(next, { replace: true });
  }

  function resetFilters() {
    setSelectedCities([]);
    setSelectedGenres([]);
    setAreaActive(false);
    setDistance(null);
    setPriceMinimum(0);
    setPriceMaximum(PRICE_CEILING);
    setLocationError('');
    syncSearchParams(query, []);
  }

  function openFilters(opener: HTMLElement) {
    filterOpenerRef.current = opener;
    setFilterOpen(true);
  }

  function closeFilters() {
    setFilterOpen(false);
  }

  function refreshLocation() {
    setLocationError('');
    if (!navigator.geolocation) {
      setLocationError('Location is not available in this browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coordinates = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        const nearest = nearestSupportedCity(coordinates);
        setArea(coordinates);
        setAreaLabel(nearest ? `${nearest.city}, ${nearest.state}` : 'Current location');
        setAreaCity(nearest?.city ?? '');
        setAreaState(nearest?.state ?? '');
        usingCurrentLocationRef.current = true;
        setAreaActive(true);
        setSelectedCities([]);
        syncSearchParams(query, []);
        setLocating(false);
      },
      () => {
        setLocationError('Could not use your location. Check browser permission and try again.');
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  return (
    <section className="discovery-page" aria-labelledby="search-heading">
      <h2 className="sr-only" id="search-heading">Search shows</h2>
      <div className="search-row">
        <label className="search-input">
          <MagnifyingGlass size={20} />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              syncSearchParams(event.target.value, selectedCities);
            }}
            onFocus={() => setSearchFocused(true)}
            onBlur={(event) => {
              if (
                !searchSuggestionPointerDownRef.current
                && !searchSuggestionsRef.current?.contains(event.relatedTarget as Node | null)
              ) {
                setSearchFocused(false);
              }
            }}
            placeholder="Search artists, venues, events"
            aria-label="Search artists, venues, and shows"
            autoComplete="off"
          />
        </label>
        <button
          ref={filterButtonRef}
          className={filterOpen || activeFilterCount ? 'filter-button is-active' : 'filter-button'}
          type="button"
          onClick={(event) => openFilters(event.currentTarget)}
          aria-expanded={filterOpen}
          aria-label={activeFilterCount ? `Filters, ${activeFilterCount} active` : 'Filters'}
        >
          <Funnel size={21} weight={filterOpen || activeFilterCount ? 'fill' : 'regular'} />
          {activeFilterCount > 0 && <span className="filter-badge">{activeFilterCount}</span>}
        </button>
      </div>
      {activeFilterCount > 0 && filterSummary && (
        <button className="filter-summary" type="button" onClick={(event) => openFilters(event.currentTarget)}>
          <Funnel size={14} /> <span>{filterSummary}</span>
        </button>
      )}
      {searchFocused && suggestions.length > 0 && (
        <div
          ref={searchSuggestionsRef}
          className="search-suggestions"
          role="region"
          aria-label="Search suggestions"
          onPointerDownCapture={() => { searchSuggestionPointerDownRef.current = true; }}
          onPointerUpCapture={() => { searchSuggestionPointerDownRef.current = false; }}
          onPointerCancelCapture={() => { searchSuggestionPointerDownRef.current = false; }}
        >
          {suggestions.map((group) => (
            <div key={group.label}>
              <p>{group.label}</p>
              {group.items.map((suggestion) => suggestion.eventId ? (
                <Link key={suggestion.key} to={`/event/${suggestion.eventId}`} onClick={() => {
                  remember(suggestion);
                  setQuery('');
                  syncSearchParams('', selectedCities);
                }}>
                  <span><strong>{suggestion.label}</strong><small>{suggestion.subtitle}</small></span>
                  <ArrowSquareOut size={16} />
                </Link>
              ) : (
                <button key={suggestion.key} type="button" onClick={() => applySuggestion(suggestion)}>
                  <span><strong>{suggestion.label}</strong><small>{suggestion.subtitle}</small></span>
                  <ArrowSquareOut size={16} />
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
      {calm && (
        <div className="search-calm">
          {recents.length > 0 && (
            <section aria-labelledby="recent-searches-heading">
              <div className="search-calm__heading">
                <h3 id="recent-searches-heading">Recent</h3>
                <button type="button" onClick={() => {
                  setRecents([]);
                  localStorage.removeItem(SEARCH_RECENTS_KEY);
                }}>Clear all</button>
              </div>
              <div className="recent-searches">
                {recents.map((item) => item.eventId
                  ? <Link key={item.key} to={`/event/${item.eventId}`}>{item.label}<span>{item.subtitle}</span></Link>
                  : <button key={item.key} type="button" onClick={() => applySuggestion(item)}>{item.label}<span>{item.subtitle}</span></button>)}
              </div>
            </section>
          )}
          {genres.length > 0 && (
            <section aria-labelledby="trending-genres-heading">
              <h3 id="trending-genres-heading">Trending genres</h3>
              <div className="chip-rail">
                {genres.slice(0, 8).map((item) => <button key={item} type="button" onClick={() => applySuggestion({
                  key: `genre:${item}`, type: 'Genres', label: item, subtitle: 'Genre', value: item,
                })}>{item}</button>)}
              </div>
            </section>
          )}
        </div>
      )}
      {filterOpen && (
        <div className="modal-backdrop search-filter-backdrop" role="presentation" onMouseDown={closeFilters}>
          <section ref={filterDialogRef} className="search-filter-dialog" role="dialog" aria-modal="true" aria-labelledby="filter-heading" tabIndex={-1} onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <h2 id="filter-heading">Filters</h2>
              <button type="button" onClick={closeFilters} aria-label="Close filters"><X size={20} /></button>
            </header>
            <div className="filter-section">
              <div className="filter-label-row"><span>Location</span><button className="button button--secondary button--small" type="button" onClick={refreshLocation} disabled={locating}>{locating ? 'Locating…' : 'Refresh'}</button></div>
              <label className="filter-location">
                <input
                  type="checkbox"
                  checked={areaActive}
                  onChange={(event) => {
                    if (event.target.checked && !areaLabel) {
                      setLocationError('Add a city to your profile or refresh your location first.');
                      return;
                    }
                    setAreaActive(event.target.checked);
                  }}
                />
                <span aria-hidden="true" />
                {areaLabel || 'No location available'}
              </label>
              {locationError && <p className="filter-help filter-help--error" role="alert">{locationError}</p>}
            </div>
            <div className="filter-section">
              <span className="filter-section__label">Distance</span>
              <div className="chip-rail">
                {DISTANCES.map((item) => <button
                  key={item.label}
                  className={distance === item.value ? 'is-active' : ''}
                  type="button"
                  disabled={!distanceAvailable && item.value != null}
                  aria-pressed={distance === item.value}
                  onClick={() => setDistance(item.value)}
                >{item.label}</button>)}
              </div>
              {!distanceAvailable && <p className="filter-help">Turn on location or add a supported city to use distance.</p>}
            </div>
            <div className="filter-section">
              <div className="filter-label-row"><span>Price</span><output>${priceMinimum} – ${priceMaximum}{priceMaximum === PRICE_CEILING ? '+' : ''}</output></div>
              <div className="price-slider">
                <label className="sr-only" htmlFor="price-minimum">Minimum price</label>
                <input id="price-minimum" aria-label="Minimum price" style={{ zIndex: priceMinimum === PRICE_CEILING ? 2 : 1 }} type="range" min="0" max={PRICE_CEILING} step="5" value={priceMinimum} onChange={(event) => setPriceMinimum(Math.min(Number(event.target.value), priceMaximum))} />
                <label className="sr-only" htmlFor="price-maximum">Maximum price</label>
                <input id="price-maximum" aria-label="Maximum price" style={{ zIndex: priceMinimum === PRICE_CEILING ? 1 : 2 }} type="range" min="0" max={PRICE_CEILING} step="5" value={priceMaximum} onChange={(event) => setPriceMaximum(Math.max(Number(event.target.value), priceMinimum))} />
              </div>
              <p className="filter-help">Shows without published prices stay visible.</p>
            </div>
            <div className="filter-section">
              <button className="filter-combo-trigger" type="button" aria-expanded={genreOpen} onClick={() => setGenreOpen((open) => !open)}>
                <span>Genres</span><strong>{selectedGenres.length ? `${selectedGenres.length} selected` : 'All genres'}</strong>
              </button>
              {genreOpen && <>
                <label className="filter-combo"><span className="sr-only">Find a genre</span><input type="search" value={genreQuery} onChange={(event) => setGenreQuery(event.target.value)} placeholder="Search genres" /></label>
                <div className="filter-options">
                  {filteredGenres.map((item) => <label key={item}><input type="checkbox" checked={selectedGenres.includes(item)} onChange={() => toggleSelection(item, selectedGenres, setSelectedGenres)} />{item}</label>)}
                </div>
              </>}
            </div>
            <div className="filter-section">
              <button className="filter-combo-trigger" type="button" aria-expanded={cityOpen} onClick={() => setCityOpen((open) => !open)}>
                <span>City</span><strong>{selectedCities.length ? `${selectedCities.length} selected` : 'All cities'}</strong>
              </button>
              {cityOpen && <>
                <label className="filter-combo"><span className="sr-only">Find a city</span><input type="search" value={cityQuery} onChange={(event) => setCityQuery(event.target.value)} placeholder="Search cities" /></label>
                <div className="filter-options">
                  {filteredCities.map((item) => <label key={item.key}><input type="checkbox" checked={selectedCities.includes(item.key)} onChange={() => {
                    const next = selectedCities.includes(item.key)
                      ? selectedCities.filter((city) => city !== item.key)
                      : [...selectedCities, item.key];
                    setSelectedCities(next);
                    syncSearchParams(query, next);
                    setAreaActive(false);
                    if (!selectedCities.includes(item.key)) setDistance(null);
                  }} />{item.label}</label>)}
                </div>
              </>}
            </div>
            <footer>
              <button className="button button--secondary" type="button" onClick={resetFilters}>Reset</button>
              <button className="button button--primary" type="button" onClick={closeFilters}>Show {visible.length} results</button>
            </footer>
          </section>
        </div>
      )}
      <header className="result-heading">
        <div><p>{calm ? 'UPCOMING' : 'RESULTS'}</p><h3>{query.trim() ? `Matches for “${query.trim()}”` : activeFilterCount ? 'Filtered shows' : 'All cities'}</h3></div>
        <span>{state === 'ready' ? visible.length : '—'}</span>
      </header>
      {state === 'loading' && <StatePanel state="loading" />}
      {state === 'error' && <StatePanel state="error" />}
      {state === 'ready' && (visible.length ? (
        <>
          <EventGrid events={visible.slice(0, resultLimit)} />
          {resultLimit < visible.length && <button className="button button--secondary search-more" type="button" onClick={() => setResultLimit((value) => value + 24)}>Show more</button>}
        </>
      ) : <StatePanel state="empty" />)}
    </section>
  );
}

export function ArtistPage() {
  const { artistId = '' } = useParams();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [events, setEvents] = useState<DropEvent[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let active = true;
    setState('loading');
    void Promise.all([
      loadEventsByArtistId(artistId),
      supabase.from('artists').select('id,name,genres,image_url').eq('id', artistId).maybeSingle(),
    ]).then(([catalog, result]) => {
      if (!active) return;
      if (result.error) throw result.error;
      const upcoming = catalog.filter((event) => event.event_artists.some((row) => row.artists?.id === artistId));
      const catalogArtist = upcoming.flatMap((event) => event.event_artists).find((row) => row.artists?.id === artistId)?.artists ?? null;
      setArtist((result.data as Artist | null) ?? catalogArtist);
      setEvents(upcoming);
      setState('ready');
    }).catch(() => {
      if (active) setState('error');
    });
    return () => { active = false; };
  }, [artistId]);

  return (
    <section className="catalog-page" aria-label="Artist">
      {state === 'loading' && <StatePanel state="loading" message="Loading artist." />}
      {state === 'error' && <StatePanel state="error" message="Could not load this artist." />}
      {state === 'ready' && !artist && <StatePanel state="empty" message="This artist is not available." />}
      {state === 'ready' && artist && <>
        <header className="catalog-hero">
          <span>{artist.image_url && safeHttpUrl(artist.image_url) ? <img src={safeHttpUrl(artist.image_url)!} alt="" /> : <ImageSquare size={34} />}</span>
          <div>
            <p>ARTIST</p>
            <h2>{artist.name}</h2>
            <small>{(artist.genres ?? []).slice(0, 3).join(' · ') || 'Electronic artist'}</small>
          </div>
        </header>
        <section className="discover-section" aria-labelledby="artist-shows-heading">
          <header><h2 id="artist-shows-heading">Upcoming shows</h2><span>{events.length}</span></header>
          {events.length ? <EventGrid events={events} /> : <p className="section-empty">No upcoming shows announced yet.</p>}
        </section>
      </>}
    </section>
  );
}

export function EventDetailPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const { eventId = '' } = useParams();
  const [event, setEvent] = useState<DropEvent | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attendance, setAttendance] = useState<'going' | 'interested' | 'attended' | null>(null);
  const [attendanceReady, setAttendanceReady] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedReady, setSavedReady] = useState(false);
  const [followingVenue, setFollowingVenue] = useState(false);
  const [venueReady, setVenueReady] = useState(false);
  const [offers, setOffers] = useState<TicketOffer[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState('');
  const [comments, setComments] = useState<EventComment[]>([]);
  const [hiddenCommentIds, setHiddenCommentIds] = useState<Set<string>>(new Set());
  const [commentsState, setCommentsState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [weather, setWeather] = useState<EventWeather | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentPending, setCommentPending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionPending, setActionPending] = useState('');
  const [presaleClock, setPresaleClock] = useState(0);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    setState('loading');
    setEvent(null);
    setAttendance(null);
    setAttendanceReady(false);
    setSaved(false);
    setSavedReady(false);
    setFollowingVenue(false);
    setVenueReady(false);
    setOffers([]);
    setSelectedOfferId('');
    setComments([]);
    setHiddenCommentIds(new Set());
    setBlockedIds(new Set());
    setWeather(null);
    setCommentsState('loading');
    setNotice(null);
    void fetchEvent(eventId).then(async (nextEvent) => {
      if (!active) return;
      const userId = auth.user?.id;
      const venueCity = (nextEvent.city ?? '').trim();
      const [
        attendanceResponse,
        saveResponse,
        venueResponse,
        offerResponse,
        commentResponse,
        blockResponse,
      ] = await Promise.all([
        userId
          ? supabase.from('attendance').select('status').eq('user_id', userId).eq('event_id', eventId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        userId
          ? supabase.from('saved_events').select('event_id').eq('user_id', userId).eq('event_id', eventId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        userId && nextEvent.venue_name
          ? supabase.from('venue_follows').select('venue_name').eq('user_id', userId).eq('venue_name', nextEvent.venue_name).eq('city', venueCity).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        fetchTicketOffers(nextEvent).then((data) => ({ data, error: null })).catch((error) => ({ data: [], error })),
        fetchEventComments(eventId).then((data) => ({ data, error: null })).catch((error) => ({ data: [], error })),
        userId
          ? supabase.from('user_blocks').select('blocked_id').eq('blocker_id', userId)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (!active) return;
      const status = attendanceResponse.data?.status;
      setAttendance(status === 'going' || status === 'interested' || status === 'attended' ? status : null);
      setAttendanceReady(Boolean(userId && !attendanceResponse.error));
      setSaved(Boolean(saveResponse.data));
      setSavedReady(Boolean(userId && !saveResponse.error));
      setFollowingVenue(Boolean(venueResponse.data));
      setVenueReady(Boolean(userId && nextEvent.venue_name && !venueResponse.error));
      const nextOffers = offerResponse.error ? [] : offerResponse.data;
      setOffers(nextOffers);
      setSelectedOfferId(nextOffers[0]?.id ?? '');
      const commentsUnavailable = Boolean(commentResponse.error || blockResponse.error);
      const blocked = new Set(commentsUnavailable ? [] : (blockResponse.data ?? []).map((row) => row.blocked_id));
      setBlockedIds(blocked);
      setComments(commentsUnavailable
        ? []
        : (commentResponse.data ?? []).filter((comment) => !blocked.has(comment.user_id)));
      setCommentsState(commentsUnavailable ? 'error' : 'ready');
      if (attendanceResponse.error || saveResponse.error || venueResponse.error) {
        setNotice({ tone: 'error', text: 'Some show actions are unavailable. Refresh to retry.' });
      }
      setEvent(nextEvent);
      setState('ready');
      if (userId && weatherEligible(nextEvent)) {
        void supabase.functions.invoke('event-weather', { body: { eventId } }).then((response) => {
          if (active) setWeather(response.error ? null : parseWeather(response.data));
        }).catch(() => { if (active) setWeather(null); });
      }
    }).catch(() => { if (active) setState('error'); });
    return () => { active = false; };
  }, [auth.user, eventId]);

  useEffect(() => {
    if (!event) return;
    const now = Date.now();
    const nextBoundary = [event.presale_start, event.onsale_start]
      .map((value) => Date.parse(value ?? ''))
      .filter((value) => Number.isFinite(value) && value > now)
      .sort((left, right) => left - right)[0];
    if (nextBoundary == null) return;
    const timeout = window.setTimeout(
      () => setPresaleClock((clock) => clock + 1),
      Math.min(nextBoundary - now + 25, 2_147_483_647),
    );
    return () => window.clearTimeout(timeout);
  }, [event, presaleClock]);

  async function changeAttendance(next: 'going' | 'interested' | 'attended') {
    if (!auth.user || !attendanceReady || saving) return;
    const previous = attendance;
    const value = attendance === next ? null : next;
    setAttendance(value);
    setSaving(true);
    setNotice(null);
    try {
      const result = value
        ? await supabase.from('attendance').upsert({ user_id: auth.user.id, event_id: eventId, status: value }, { onConflict: 'user_id,event_id' })
        : await supabase.from('attendance').delete().eq('user_id', auth.user.id).eq('event_id', eventId);
      if (result.error) throw result.error;
    } catch {
      setAttendance(previous);
      setNotice({ tone: 'error', text: 'Could not save that response.' });
    } finally {
      setSaving(false);
    }
  }

  async function startPlan() {
    if (!auth.user || actionPending) return;
    setActionPending('plan');
    setNotice(null);
    try {
      const { data: planId, error } = await supabase.rpc('create_or_get_plan', { p_event_id: eventId });
      if (error || !planId) throw error ?? new Error('Could not create that plan.');
      navigate(`/plan/${planId}`);
    } catch {
      setNotice({ tone: 'error', text: 'Could not start that plan. Please try again.' });
    } finally {
      setActionPending('');
    }
  }

  async function toggleSaved() {
    if (!auth.user || !savedReady || actionPending) return;
    const previous = saved;
    setSaved(!previous);
    setActionPending('save');
    setNotice(null);
    try {
      const result = previous
        ? await supabase.from('saved_events').delete().eq('user_id', auth.user.id).eq('event_id', eventId)
        : await supabase.from('saved_events').insert({ user_id: auth.user.id, event_id: eventId });
      if (result.error) throw result.error;
    } catch {
      setSaved(previous);
      setNotice({ tone: 'error', text: 'Could not update your saved shows.' });
    } finally {
      setActionPending('');
    }
  }

  async function toggleVenueFollow() {
    if (!auth.user || !event?.venue_name || !venueReady || actionPending) return;
    const previous = followingVenue;
    const city = (event.city ?? '').trim();
    setFollowingVenue(!previous);
    setActionPending('venue');
    setNotice(null);
    try {
      const result = previous
        ? await supabase.from('venue_follows').delete()
          .eq('user_id', auth.user.id).eq('venue_name', event.venue_name).eq('city', city)
        : await supabase.from('venue_follows').insert({
          user_id: auth.user.id,
          venue_name: event.venue_name,
          city,
        });
      if (result.error) throw result.error;
    } catch {
      setFollowingVenue(previous);
      setNotice({ tone: 'error', text: 'Could not update this venue.' });
    } finally {
      setActionPending('');
    }
  }

  async function share() {
    if (!event) return;
    const url = new URL(PUBLIC_EVENT_URL);
    url.searchParams.set('id', event.id);
    try {
      if (navigator.share) await navigator.share({ title: event.title, url: url.toString() });
      else await navigator.clipboard.writeText(url.toString());
    } catch {
      setNotice({ tone: 'error', text: 'Could not share this show.' });
    }
  }

  async function postComment(submitEvent: FormEvent) {
    submitEvent.preventDefault();
    if (!auth.user || commentPending) return;
    const body = commentDraft.trim().slice(0, 500);
    if (!body) return;
    if (containsDisallowed(body)) {
      setNotice({ tone: 'error', text: 'Let’s keep it friendly. Edit that comment and try again.' });
      return;
    }
    setCommentPending(true);
    setNotice(null);
    const result = await supabase.from('event_comments').insert({
      user_id: auth.user.id,
      event_id: eventId,
      body,
    });
    if (result.error) {
      setNotice({ tone: 'error', text: 'Could not post your comment.' });
      setCommentPending(false);
      return;
    }
    setCommentDraft('');
    try {
      const rows = await fetchEventComments(eventId);
      setComments(rows.filter((comment) => !blockedIds.has(comment.user_id) && !hiddenCommentIds.has(comment.id)));
      setCommentsState('ready');
    } catch {
      setNotice({ tone: 'success', text: 'Comment posted. Refresh to see it in the thread.' });
    } finally {
      setCommentPending(false);
    }
  }

  async function retryComments() {
    setCommentsState('loading');
    try {
      const [rows, blockResponse] = await Promise.all([
        fetchEventComments(eventId),
        auth.user
          ? supabase.from('user_blocks').select('blocked_id').eq('blocker_id', auth.user.id)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (blockResponse.error) throw blockResponse.error;
      const blocked = new Set((blockResponse.data ?? []).map((row) => row.blocked_id));
      setBlockedIds(blocked);
      setComments(rows.filter((comment) => !blocked.has(comment.user_id) && !hiddenCommentIds.has(comment.id)));
      setCommentsState('ready');
    } catch {
      setCommentsState('error');
    }
  }

  async function deleteComment(commentId: string) {
    if (!window.confirm('Delete this comment?')) return;
    const result = await supabase.from('event_comments').delete().eq('id', commentId);
    if (result.error) {
      setNotice({ tone: 'error', text: 'Could not delete that comment.' });
      return;
    }
    setComments((current) => current.filter((comment) => comment.id !== commentId));
  }

  async function reportComment(comment: EventComment) {
    if (!auth.user) return;
    const result = await supabase.from('content_reports').insert({
      reporter_id: auth.user.id,
      content_type: 'comment',
      content_id: comment.id,
      reported_user_id: comment.user_id,
      reason: 'Inappropriate or harmful content',
      status: 'open',
    });
    if (result.error) {
      setNotice({ tone: 'error', text: 'Could not submit that report.' });
      return;
    }
    setHiddenCommentIds((current) => new Set(current).add(comment.id));
    setComments((current) => current.filter((item) => item.id !== comment.id));
    setNotice({ tone: 'success', text: 'Report submitted. That comment is hidden for now.' });
  }

  if (state === 'loading') return <StatePanel state="loading" />;
  if (state === 'error' || !event) return <StatePanel state="error" message="This show could not be loaded." />;
  const lineup = artists(event);
  const past = isEventPast(event);
  const selectedOffer = offers.find((offer) => offer.id === selectedOfferId) ?? offers[0] ?? null;
  const selectedOfferUrl = safeHttpUrl(selectedOffer?.url ?? null);
  const ticketUrl = selectedOffer
    ? selectedOfferUrl ?? (offers.length === 1 ? safeHttpUrl(event.ticket_url) : null)
    : safeHttpUrl(event.ticket_url);
  const ticketVendor = selectedOfferUrl ? selectedOffer?.vendor : null;
  const saleState = presaleState(event);
  const bestOfferId = offers.filter((offer) => estimatedAllIn(offer) != null)
    .sort((a, b) => estimatedAllIn(a)! - estimatedAllIn(b)!)[0]?.id;

  return (
    <article className="event-detail">
      <div className="event-detail__art"><EventArtwork event={event} /><span>{genre(event)}</span></div>
      <div className="event-detail__content">
        <p className="event-detail__eyebrow">{event.is_festival ? 'FESTIVAL' : 'LIVE EVENT'}</p>
        <h2>{event.title}</h2>
        <div className="event-detail__facts">
          <p><CalendarDots size={20} /><span><strong>{formatEventDate(event, true)}</strong>{formatEventTime(event)}</span></p>
          <p><MapPin size={20} /><span><strong>{event.venue_name || 'Venue TBA'}</strong>{[event.city, event.state].filter(Boolean).join(', ')}</span></p>
          <p><Ticket size={20} /><span><strong>{formatPrice(event)}</strong>Ticket pricing from organizer</span></p>
          {weather && weatherLabel(weather) && <p><CloudSun size={20} /><span><strong>{weatherLabel(weather)}</strong>Forecast for showtime</span></p>}
        </div>
        <div className={`event-detail__actions${past ? ' event-detail__actions--past' : ''}`}>
          {!past && <button className={attendance === 'going' ? 'button button--primary' : 'button button--secondary'} type="button" disabled={!attendanceReady || saving} onClick={() => void changeAttendance('going')}>
            {attendance === 'going' && <CheckCircle size={18} weight="fill" />} Going
          </button>}
          {!past && <button className={attendance === 'interested' ? 'button button--primary' : 'button button--secondary'} type="button" disabled={!attendanceReady || saving} onClick={() => void changeAttendance('interested')}>Interested</button>}
          {past && attendance !== 'attended' && <button className="button button--primary" type="button" disabled={!attendanceReady || saving} onClick={() => void changeAttendance('attended')}><CheckCircle size={18} /> I was there</button>}
          {past && attendance === 'attended' && <Link className="button button--primary" to={`/recap/${event.id}`}><Sparkle size={18} /> Create recap</Link>}
          <button className="button button--secondary button--icon" type="button" onClick={() => void share()} aria-label="Share show"><ShareNetwork size={19} /></button>
          {!past && <button className={saved ? 'button button--secondary is-selected' : 'button button--secondary'} type="button" disabled={!savedReady || Boolean(actionPending)} onClick={() => void toggleSaved()}>
            <BookmarkSimple size={18} weight={saved ? 'fill' : 'regular'} /> {saved ? 'Saved' : 'Save show'}
          </button>}
        </div>
        {notice && <p className={`status status--${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
          {notice.tone === 'error' ? <WarningCircle size={18} /> : <CheckCircle size={18} weight="fill" />}{notice.text}
        </p>}
        {(!past || event.venue_name) && (
          <div className="event-tools">
            {!past && <button className="button button--secondary" type="button" disabled={Boolean(actionPending)} onClick={() => void startPlan()}><UsersThree size={18} /> Start a plan</button>}
            {!past && <button className="button button--secondary" type="button" onClick={() => {
              try {
                addToCalendar(event);
                setNotice({ tone: 'success', text: 'Calendar file downloaded.' });
              } catch {
                setNotice({ tone: 'error', text: 'Could not create the calendar event.' });
              }
            }}><CalendarDots size={18} /> Add to calendar</button>}
            {event.venue_name && <button
              className={followingVenue ? 'button button--secondary is-selected' : 'button button--secondary'}
              type="button"
              disabled={!venueReady || Boolean(actionPending)}
              onClick={() => void toggleVenueFollow()}
            ><Buildings size={18} weight={followingVenue ? 'fill' : 'regular'} />{followingVenue ? 'Following venue' : 'Follow venue'}</button>}
          </div>
        )}
        {!past && saleState && (
          <section className={`presale-card${saleState === 'active' ? ' is-active' : ''}`}>
            <h3>{saleState === 'active' ? 'Presale is live now' : 'Presale upcoming'}</h3>
            <p>{saleState === 'active'
              ? 'Check the artist or venue socials for the current code.'
              : 'Codes will appear after Drop has a server-enforced release window.'}</p>
          </section>
        )}
        {offers.length > 1 && !past && (
          <section className="event-detail__section ticket-compare">
            <h3>Tickets</h3>
            <p>Compare estimated all-in prices. Live totals may differ at checkout.</p>
            <div>
              {offers.map((offer) => {
                const face = offer.price_min ?? offer.price_max;
                const allIn = estimatedAllIn(offer);
                return <button
                  key={offer.id}
                  className={selectedOffer?.id === offer.id ? 'ticket-offer is-selected' : 'ticket-offer'}
                  type="button"
                  aria-pressed={selectedOffer?.id === offer.id}
                  onClick={() => setSelectedOfferId(offer.id)}
                >
                  <span><strong>{offer.vendor}</strong><small>{face == null ? 'Open seller for live price' : `Listed from ${formatMoney(face, offer.currency ?? 'USD')}`}</small></span>
                  <span><strong>{allIn == null ? 'Price TBA' : `${formatMoney(allIn, offer.currency ?? 'USD')} est.`}</strong>{bestOfferId === offer.id && <small>LOWEST KNOWN</small>}</span>
                </button>;
              })}
            </div>
          </section>
        )}
        {!past && (ticketUrl
          ? <a className="button button--primary event-detail__ticket" href={ticketUrl} target="_blank" rel="noopener noreferrer">Get tickets{ticketVendor ? ` · ${ticketVendor}` : ''} <ArrowSquareOut size={18} /></a>
          : selectedOffer && <button className="button button--primary event-detail__ticket" type="button" disabled>Ticket link unavailable</button>)}
        {event.description && <section className="event-detail__section"><h3>About</h3><p>{event.description}</p></section>}
        {lineup.length > 0 && <section className="event-detail__section"><h3>Lineup</h3><div className="lineup">{lineup.map((artist) => <Link key={artist.id} to={`/artist/${artist.id}`} aria-label={`Open ${artist.name}`}><span>{artist.image_url && safeHttpUrl(artist.image_url) ? <img src={safeHttpUrl(artist.image_url)!} alt="" loading="lazy" /> : <ImageSquare size={22} />}</span><strong>{artist.name}</strong><small>{(artist.genres ?? []).slice(0, 2).join(' · ') || 'Artist'}</small><CaretRight size={16} /></Link>)}</div></section>}
        <section className="event-detail__section comments">
          <h3>Comments{comments.length ? ` (${comments.length})` : ''}</h3>
          {commentsState === 'loading' && <p role="status">Loading comments…</p>}
          {commentsState === 'error' && (
            <div className="comments-error" role="alert">
              <p>Comments are unavailable right now.</p>
              <button className="button button--secondary button--small" type="button" onClick={() => void retryComments()}>Try again</button>
            </div>
          )}
          {commentsState === 'ready' && !comments.length && <p>No comments yet — hype it up, ask who’s going, or share the meetup spot.</p>}
          {commentsState === 'ready' && <div className="comment-list">
            {comments.map((comment) => (
              <article key={comment.id}>
                <header><strong>{personName(comment.profiles)}</strong><time dateTime={comment.created_at}>{timeAgo(comment.created_at)}</time></header>
                <p>{comment.body}</p>
                <footer>
                  {auth.user?.id !== comment.user_id && <button type="button" aria-label={`Reply to ${personName(comment.profiles)}`} onClick={() => setCommentDraft(`@${comment.profiles?.username || personName(comment.profiles)} `)}>Reply</button>}
                  {auth.user?.id === comment.user_id
                    ? <button type="button" aria-label={`Delete comment by ${personName(comment.profiles)}`} onClick={() => void deleteComment(comment.id)}><Trash size={14} /> Delete</button>
                    : <button type="button" aria-label={`Report comment by ${personName(comment.profiles)}`} onClick={() => void reportComment(comment)}><Flag size={14} /> Report</button>}
                </footer>
              </article>
            ))}
          </div>}
          {commentsState === 'ready' && <form className="comment-form" onSubmit={(submitEvent) => void postComment(submitEvent)}>
            <label className="sr-only" htmlFor="event-comment">Add a comment</label>
            <textarea id="event-comment" value={commentDraft} onChange={(inputEvent) => setCommentDraft(inputEvent.target.value)} maxLength={500} placeholder="Add a comment…" rows={2} />
            <button className="button button--primary button--icon" type="submit" disabled={!commentDraft.trim() || commentPending} aria-label="Post comment"><PaperPlaneTilt size={18} /></button>
          </form>}
          {commentsState === 'ready' && <small className="comment-count">{commentDraft.length}/500</small>}
        </section>
      </div>
    </article>
  );
}
