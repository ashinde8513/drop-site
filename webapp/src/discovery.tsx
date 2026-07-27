import { useEffect, useMemo, useState } from 'react';
import { ArrowSquareOut } from '@phosphor-icons/react/ArrowSquareOut';
import { CalendarDots } from '@phosphor-icons/react/CalendarDots';
import { CheckCircle } from '@phosphor-icons/react/CheckCircle';
import { CircleNotch } from '@phosphor-icons/react/CircleNotch';
import { Funnel } from '@phosphor-icons/react/Funnel';
import { ImageSquare } from '@phosphor-icons/react/ImageSquare';
import { MagnifyingGlass } from '@phosphor-icons/react/MagnifyingGlass';
import { MapPin } from '@phosphor-icons/react/MapPin';
import { ShareNetwork } from '@phosphor-icons/react/ShareNetwork';
import { Ticket } from '@phosphor-icons/react/Ticket';
import { WarningCircle } from '@phosphor-icons/react/WarningCircle';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from './auth';
import { supabase } from './lib/supabase';

type Artist = {
  id: string;
  name: string;
  genres: string[] | null;
  image_url: string | null;
};

type EventArtist = { position: number | null; artists: Artist | null };

export type DropEvent = {
  id: string;
  title: string;
  description: string | null;
  date: string;
  end_date: string | null;
  venue_name: string | null;
  city: string | null;
  state: string | null;
  image_url: string | null;
  ticket_url: string | null;
  price_min: number | null;
  price_max: number | null;
  currency: string | null;
  is_festival: boolean;
  time_tbd: boolean;
  timezone: string | null;
  event_artists: EventArtist[];
};

const EVENT_SELECT = [
  'id', 'title', 'description', 'date', 'end_date', 'venue_name', 'city', 'state',
  'image_url', 'ticket_url', 'price_min', 'price_max', 'currency', 'is_festival',
  'time_tbd', 'timezone', 'event_artists(position,artists(id,name,genres,image_url))',
].join(',');

const sections = ['Happening', 'For You', 'Crew'] as const;
const dateFilters = ['Any time', 'Today', 'This weekend', 'Next 30 days'] as const;
const EVENT_GRACE_MS = 6 * 60 * 60 * 1000;
const PAGE_SIZE = 1000;
const MAX_CATALOG_EVENTS = 5000;
const PUBLIC_EVENT_URL = 'https://trydropapp.com/event.html';
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
      : Boolean(location.state && event.state?.toLocaleLowerCase() === location.state.toLocaleLowerCase());
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
  const image = safeHttpUrl(event.image_url);
  return image
    ? <img src={image} alt="" loading="lazy" />
    : <span className="event-artwork__fallback" aria-hidden="true"><ImageSquare size={40} /></span>;
}

function EventCard({ event }: { event: DropEvent }) {
  return (
    <Link className="event-card" to={`/event/${event.id}`} aria-label={`Open ${event.title}`}>
      <div className="event-card__art">
        <EventArtwork event={event} />
        <span className="event-card__genre">{genre(event)}</span>
        <span className="event-card__price">{formatPrice(event)}</span>
      </div>
      <div className="event-card__body">
        <time dateTime={event.date}>{formatEventDate(event)} · {formatEventTime(event)}</time>
        <h3>{event.title}</h3>
        <p><MapPin size={15} /> {[event.venue_name, event.city].filter(Boolean).join(' · ') || 'Venue TBA'}</p>
      </div>
    </Link>
  );
}

function EventGrid({ events }: { events: DropEvent[] }) {
  return <div className="event-grid">{events.map((event) => <EventCard key={event.id} event={event} />)}</div>;
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
  const { events, state } = useEvents();
  const [personal, setPersonal] = useState<{ forYou: DropEvent[]; crew: DropEvent[] }>({ forYou: [], crew: [] });
  const [personalState, setPersonalState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [section, setSection] = useState<(typeof sections)[number]>('Happening');
  const [dateFilter, setDateFilter] = useState<(typeof dateFilters)[number]>('Any time');
  const scoped = useMemo(() => events.filter((event) => {
    if (city) return event.city?.toLocaleLowerCase() === city.toLocaleLowerCase();
    if (stateCode) return event.state?.toLocaleLowerCase() === stateCode.toLocaleLowerCase();
    return true;
  }), [city, events, stateCode]);
  const visible = useMemo(() => scoped.filter((event) => eventMatchesDate(event, dateFilter)), [scoped, dateFilter]);
  const crew = useMemo(() => {
    const scopedIds = new Set(scoped.map((event) => event.id));
    return personal.crew.filter((event) => scopedIds.has(event.id));
  }, [personal.crew, scoped]);

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
    <section className="discovery-page" aria-labelledby="discover-heading">
      <header className="discovery-heading">
        <p>YOUR NEXT NIGHT OUT</p>
        <h2 id="discover-heading">{city ? `Shows near ${city}` : 'Shows near you'}</h2>
      </header>
      <div className="segment-control" aria-label="Discover feed">
        {sections.map((item) => <button key={item} className={section === item ? 'is-active' : ''} type="button" aria-pressed={section === item} onClick={() => setSection(item)}>{item}</button>)}
      </div>
      {section === 'Happening' && (
        <>
          <div className="chip-rail" aria-label="Date filter">
            {dateFilters.map((item) => <button key={item} className={dateFilter === item ? 'is-active' : ''} type="button" aria-pressed={dateFilter === item} onClick={() => setDateFilter(item)}>{item}</button>)}
          </div>
          {state === 'loading' && <StatePanel state="loading" />}
          {state === 'error' && <StatePanel state="error" />}
          {state === 'ready' && (visible.length ? <EventGrid events={visible} /> : <StatePanel state="empty" />)}
        </>
      )}
      {section === 'For You' && personalState === 'loading' && <StatePanel state="loading" />}
      {section === 'For You' && personalState === 'error' && <StatePanel state="error" message="Could not load your picks." />}
      {section === 'For You' && personalState === 'ready' && (personal.forYou.length
        ? <EventGrid events={personal.forYou} />
        : <StatePanel state="empty" message="Follow artists in Drop to build your personalized feed." />)}
      {section === 'Crew' && personalState === 'loading' && <StatePanel state="loading" />}
      {section === 'Crew' && personalState === 'error' && <StatePanel state="error" message="Could not load crew plans." />}
      {section === 'Crew' && personalState === 'ready' && (crew.length
        ? <EventGrid events={crew} />
        : <StatePanel state="empty" message="Crew shows appear when friends mark that they are going." />)}
    </section>
  );
}

export function SearchPage() {
  const { events, state } = useEvents();
  const [query, setQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState('');
  const [resultLimit, setResultLimit] = useState(24);
  const genres = useMemo(() => Array.from(new Set(events.map(genre))).sort().slice(0, 12), [events]);
  const visible = useMemo(() => events.filter((event) => {
    if (selectedGenre && !eventGenres(event).has(selectedGenre)) return false;
    return !query.trim() || eventMatchesQuery(event, query);
  }), [events, query, selectedGenre]);
  useEffect(() => setResultLimit(24), [query, selectedGenre]);

  return (
    <section className="discovery-page" aria-labelledby="search-heading">
      <h2 className="sr-only" id="search-heading">Search shows</h2>
      <div className="search-row">
        <label className="search-input">
          <MagnifyingGlass size={20} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Artists, venues, shows" aria-label="Search artists, venues, and shows" autoComplete="off" />
        </label>
        <button className={filterOpen ? 'filter-button is-active' : 'filter-button'} type="button" onClick={() => setFilterOpen((open) => !open)} aria-expanded={filterOpen} aria-label="Filter shows">
          <Funnel size={21} weight={filterOpen ? 'fill' : 'regular'} />
        </button>
      </div>
      {filterOpen && (
        <div className="filter-panel">
          <p>Genre</p>
          <div className="chip-rail">
            <button className={!selectedGenre ? 'is-active' : ''} type="button" aria-pressed={!selectedGenre} onClick={() => setSelectedGenre('')}>All</button>
            {genres.map((item) => <button key={item} className={selectedGenre === item ? 'is-active' : ''} type="button" aria-pressed={selectedGenre === item} onClick={() => setSelectedGenre(item)}>{item}</button>)}
          </div>
        </div>
      )}
      <header className="result-heading">
        <div><p>{query.trim() ? 'RESULTS' : 'UPCOMING'}</p><h3>{query.trim() ? `Matches for “${query.trim()}”` : 'All cities'}</h3></div>
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

export function EventDetailPage() {
  const auth = useAuth();
  const { eventId = '' } = useParams();
  const [event, setEvent] = useState<DropEvent | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attendance, setAttendance] = useState<'going' | 'interested' | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    setState('loading');
    void Promise.all([
      fetchEvent(eventId),
      auth.user
        ? supabase.from('attendance').select('status').eq('user_id', auth.user.id).eq('event_id', eventId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]).then(([nextEvent, response]) => {
      if (!active) return;
      setEvent(nextEvent);
      const status = response.data?.status;
      setAttendance(status === 'going' || status === 'interested' ? status : null);
      setState('ready');
    }).catch(() => { if (active) setState('error'); });
    return () => { active = false; };
  }, [auth.user, eventId]);

  async function changeAttendance(next: 'going' | 'interested') {
    if (!auth.user || saving) return;
    const previous = attendance;
    const value = attendance === next ? null : next;
    setAttendance(value);
    setSaving(true);
    setNotice('');
    try {
      const result = value
        ? await supabase.from('attendance').upsert({ user_id: auth.user.id, event_id: eventId, status: value }, { onConflict: 'user_id,event_id' })
        : await supabase.from('attendance').delete().eq('user_id', auth.user.id).eq('event_id', eventId);
      if (result.error) throw result.error;
    } catch {
      setAttendance(previous);
      setNotice('Could not save that response.');
    } finally {
      setSaving(false);
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
      setNotice('Could not share this show.');
    }
  }

  if (state === 'loading') return <StatePanel state="loading" />;
  if (state === 'error' || !event) return <StatePanel state="error" message="This show could not be loaded." />;
  const ticketUrl = safeHttpUrl(event.ticket_url);
  const lineup = artists(event);
  const past = isEventPast(event);

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
        </div>
        <div className={`event-detail__actions${past ? ' event-detail__actions--past' : ''}`}>
          {!past && <button className={attendance === 'going' ? 'button button--primary' : 'button button--secondary'} type="button" disabled={saving} onClick={() => void changeAttendance('going')}>
            {attendance === 'going' && <CheckCircle size={18} weight="fill" />} Going
          </button>}
          {!past && <button className={attendance === 'interested' ? 'button button--primary' : 'button button--secondary'} type="button" disabled={saving} onClick={() => void changeAttendance('interested')}>Interested</button>}
          <button className="button button--secondary button--icon" type="button" onClick={() => void share()} aria-label="Share show"><ShareNetwork size={19} /></button>
        </div>
        {notice && <p className="status status--error" role="alert"><WarningCircle size={18} />{notice}</p>}
        {ticketUrl && !past && <a className="button button--primary event-detail__ticket" href={ticketUrl} target="_blank" rel="noopener noreferrer">Get tickets <ArrowSquareOut size={18} /></a>}
        {event.description && <section className="event-detail__section"><h3>About</h3><p>{event.description}</p></section>}
        {lineup.length > 0 && <section className="event-detail__section"><h3>Lineup</h3><div className="lineup">{lineup.map((artist) => <div key={artist.id}><span>{artist.image_url && safeHttpUrl(artist.image_url) ? <img src={safeHttpUrl(artist.image_url)!} alt="" loading="lazy" /> : <ImageSquare size={22} />}</span><strong>{artist.name}</strong><small>{(artist.genres ?? []).slice(0, 2).join(' · ') || 'Artist'}</small></div>)}</div></section>}
      </div>
    </article>
  );
}
