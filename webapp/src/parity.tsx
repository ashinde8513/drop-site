import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Bell } from '@phosphor-icons/react/Bell';
import { BookmarkSimple } from '@phosphor-icons/react/BookmarkSimple';
import { CalendarDots } from '@phosphor-icons/react/CalendarDots';
import { CaretRight } from '@phosphor-icons/react/CaretRight';
import { ChatCircleDots } from '@phosphor-icons/react/ChatCircleDots';
import { Check } from '@phosphor-icons/react/Check';
import { CircleNotch } from '@phosphor-icons/react/CircleNotch';
import { Clock } from '@phosphor-icons/react/Clock';
import { FlagBanner } from '@phosphor-icons/react/FlagBanner';
import { MapPin } from '@phosphor-icons/react/MapPin';
import { MagnifyingGlass } from '@phosphor-icons/react/MagnifyingGlass';
import { Plus } from '@phosphor-icons/react/Plus';
import { ShareNetwork } from '@phosphor-icons/react/ShareNetwork';
import { Sparkle } from '@phosphor-icons/react/Sparkle';
import { Star } from '@phosphor-icons/react/Star';
import { Ticket } from '@phosphor-icons/react/Ticket';
import { UserPlus } from '@phosphor-icons/react/UserPlus';
import { UsersThree } from '@phosphor-icons/react/UsersThree';
import { WarningCircle } from '@phosphor-icons/react/WarningCircle';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from './auth';
import { containsDisallowed, coordinatesForCity, EventRail, loadEventById, loadEventCatalog, type DropEvent } from './discovery';
import { supabase } from './lib/supabase';
import type { Profile } from './lib/account';

type LoadState<T> =
  | { status: 'loading'; data: T }
  | { status: 'ready'; data: T }
  | { status: 'error'; data: T };

type FriendEdge = {
  id: string;
  status: 'pending' | 'accepted';
  direction: 'friends' | 'incoming' | 'outgoing';
  profile: Profile;
  created_at: string;
};

type LoggedShow = {
  id: string;
  event_id: string | null;
  artist_name: string;
  venue_name: string | null;
  city: string | null;
  state: string | null;
  show_date: string;
  notes: string | null;
};

type PlanSummary = {
  id: string;
  creator_id: string;
  event: DropEvent;
  going: number;
  status: string | null;
  host: string | null;
};

type PlanMember = { user_id: string; status: string; profiles: Profile | null };
type PlanMessage = { id: string; user_id: string; body: string; created_at: string; profiles: Profile | null };
type Crew = { id: string; name: string; emoji: string | null; members: Profile[] };
type SetTime = {
  id: string;
  event_id: string;
  artist_name: string;
  stage: string | null;
  start_time: string;
  end_time: string | null;
  timezone: string | null;
};
type AlertRow = {
  id: string;
  title: string;
  body: string | null;
  kind: string;
  read: boolean;
  created_at: string | null;
  event_id?: string | null;
  plan_id?: string | null;
};

type FriendActivity = {
  id: string;
  type: 'going' | 'rated' | 'recap' | 'plan_join';
  profile: Profile;
  event: Pick<DropEvent, 'id' | 'title' | 'date' | 'venue_name'>;
  created_at: string;
  rating?: number;
  plan_id?: string;
};

type PublicProfile = Pick<Profile, 'id' | 'username' | 'display_name' | 'profile_image'>;
type PublicProfileData = {
  profile: PublicProfile | null;
  canViewHistory: boolean;
  isFriend: boolean;
  going: DropEvent[];
  history: DropEvent[];
};

const EMPTY_EVENTS: DropEvent[] = [];
const PUBLIC_PROFILE_COLUMNS = 'id,username,display_name,profile_image,city,state,bio';
const HOUR_MS = 60 * 60 * 1000;
const EMPTY_PUBLIC_PROFILE: PublicProfileData = {
  profile: null,
  canViewHistory: false,
  isFriend: false,
  going: [],
  history: [],
};
const EMPTY_FRIENDS = {
  friends: [] as FriendEdge[],
  incoming: [] as FriendEdge[],
  outgoing: [] as FriendEdge[],
  blocked: new Set<string>(),
  activity: [] as FriendActivity[],
};
const EMPTY_SHOWS = {
  catalog: [] as DropEvent[],
  attendance: new Map<string, string>(),
  saved: new Set<string>(),
  past: [] as DropEvent[],
  logged: [] as LoggedShow[],
};

function useLoad<T>(key: string, empty: T, loader: () => Promise<T>, background = false) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<LoadState<T>>({ status: 'loading', data: empty });
  useEffect(() => {
    let active = true;
    setState((current) => background && current.status === 'ready' ? current : { status: 'loading', data: current.data });
    void loader()
      .then((data) => { if (active) setState({ status: 'ready', data }); })
      .catch(() => { if (active) setState((current) => background && current.status === 'ready' ? current : { status: 'error', data: current.data }); });
    return () => { active = false; };
    // Loader intentionally follows the explicit data key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);
  return [state, () => setAttempt((value) => value + 1)] as const;
}

function personName(profile: Pick<Profile, 'display_name' | 'username'> | null | undefined) {
  return profile?.display_name || (profile?.username ? `@${profile.username}` : 'Drop user');
}

function formatTimestamp(value: string, compact = false, timeZone?: string | null) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date TBA';
  const options: Intl.DateTimeFormatOptions = compact
    ? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
    : { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
  if (timeZone) options.timeZone = timeZone;
  try {
    return new Intl.DateTimeFormat(undefined, options).format(date);
  } catch {
    delete options.timeZone;
    return new Intl.DateTimeFormat(undefined, options).format(date);
  }
}

function formatEventDate(event: DropEvent, compact = false) {
  if (!event.time_tbd) return formatTimestamp(event.date, compact, event.timezone);
  const date = new Date(event.date);
  if (Number.isNaN(date.getTime())) return 'Date TBA';
  const options: Intl.DateTimeFormatOptions = compact
    ? { month: 'short', day: 'numeric' }
    : { weekday: 'short', month: 'short', day: 'numeric' };
  if (event.timezone) options.timeZone = event.timezone;
  try {
    return `${new Intl.DateTimeFormat(undefined, options).format(date)} · Time TBA`;
  } catch {
    delete options.timeZone;
    return `${new Intl.DateTimeFormat(undefined, options).format(date)} · Time TBA`;
  }
}

function eventPlace(event: DropEvent) {
  return [event.venue_name, [event.city, event.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
}

function eventArtists(event: DropEvent) {
  return [...event.event_artists]
    .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
    .map((row) => row.artists?.name)
    .filter(Boolean)
    .join(', ');
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  return items.reduce<Record<string, T[]>>((groups, item) => {
    const name = key(item);
    (groups[name] ??= []).push(item);
    return groups;
  }, {});
}

function setTimeDay(time: SetTime) {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: time.timezone || undefined,
  };
  try {
    return new Intl.DateTimeFormat(undefined, options).format(new Date(time.start_time));
  } catch {
    delete options.timeZone;
    return new Intl.DateTimeFormat(undefined, options).format(new Date(time.start_time));
  }
}

function formatSetTime(time: SetTime) {
  const options: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: time.timezone || undefined,
  };
  try {
    return new Intl.DateTimeFormat(undefined, options).format(new Date(time.start_time));
  } catch {
    delete options.timeZone;
    return new Intl.DateTimeFormat(undefined, options).format(new Date(time.start_time));
  }
}

function eventInterval(event: DropEvent) {
  const start = Date.parse(event.date);
  const authoredEnd = Date.parse(event.end_date ?? '');
  return {
    start,
    end: Number.isFinite(authoredEnd) && authoredEnd >= start
      ? authoredEnd
      : start + (event.time_tbd ? 24 : 8) * HOUR_MS,
  };
}

function calendarDayDiff(value: string, now: number, timeZone?: string | null) {
  const day = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'numeric', day: 'numeric' };
    if (timeZone) options.timeZone = timeZone;
    try {
      const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(date);
      const number = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
      return Date.UTC(number('year'), number('month') - 1, number('day'));
    } catch {
      return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    }
  };
  const target = new Date(value);
  return Number.isNaN(target.getTime()) ? NaN : Math.round((day(target) - day(new Date(now))) / (24 * HOUR_MS));
}

function overlapsDays(event: DropEvent, start: Date, endExclusive: Date) {
  const interval = eventInterval(event);
  return interval.start < endExclusive.getTime() && interval.end >= start.getTime();
}

function milesBetween(
  left: { latitude: number; longitude: number },
  right: { latitude: number; longitude: number },
) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(right.latitude - left.latitude);
  const dLon = radians(right.longitude - left.longitude);
  const value = Math.sin(dLat / 2) ** 2
    + Math.cos(radians(left.latitude)) * Math.cos(radians(right.latitude)) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function PageState({
  status,
  empty,
  onRetry,
  children,
}: {
  status: LoadState<unknown>['status'];
  empty?: { title: string; body: string; icon?: ReactNode };
  onRetry?: () => void;
  children: ReactNode;
}) {
  if (status === 'loading') {
    return <div className="parity-state" role="status"><CircleNotch className="spin" size={26} /><h2>Loading…</h2></div>;
  }
  if (status === 'error') {
    return <div className="parity-state parity-state--error" role="alert"><WarningCircle size={27} /><h2>Couldn’t load this screen</h2><p>Check your connection and try again.</p>{onRetry && <button className="button button--secondary button--small" type="button" onClick={onRetry}>Retry</button>}</div>;
  }
  if (empty) {
    return <div className="parity-state">{empty.icon}<h2>{empty.title}</h2><p>{empty.body}</p></div>;
  }
  return children;
}

function Tabs<T extends string>({ options, value, onChange, label }: {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  label: string;
}) {
  return <div className="parity-tabs" role="tablist" aria-label={label}>{options.map((option) => (
    <button key={option} type="button" role="tab" aria-selected={option === value} className={option === value ? 'is-active' : ''} onClick={() => onChange(option)}>{option}</button>
  ))}</div>;
}

function EventRow({ event, trailing, to }: { event: DropEvent; trailing?: ReactNode; to?: string }) {
  const content = (
    <>
      <span className="parity-event-row__art">
        {event.image_url ? <img src={event.image_url} alt="" /> : <Ticket size={24} />}
      </span>
      <span className="parity-event-row__copy">
        <strong>{event.title}</strong>
        <small>{formatEventDate(event)} · {eventPlace(event)}</small>
        {eventArtists(event) && eventArtists(event).toLowerCase() !== event.title.toLowerCase() && <small>{eventArtists(event)}</small>}
      </span>
      {trailing ?? <CaretRight size={18} />}
    </>
  );
  return to
    ? <Link className="parity-event-row" to={to} aria-label={`Open ${event.title}`}>{content}</Link>
    : <div className="parity-event-row">{content}</div>;
}

function PersonRow({ edge, actions }: { edge: FriendEdge; actions?: ReactNode }) {
  return <div className="person-row">
    <span className="person-row__avatar">{edge.profile.profile_image ? <img src={edge.profile.profile_image} alt="" /> : personName(edge.profile).slice(0, 1).toUpperCase()}</span>
    <span><strong>{personName(edge.profile)}</strong><small>{edge.profile.username ? `@${edge.profile.username}` : [edge.profile.city, edge.profile.state].filter(Boolean).join(', ')}</small></span>
    {actions}
  </div>;
}

function eventFromRow(row: unknown) {
  return row as DropEvent;
}

async function loadBlockedIds(userId: string) {
  const { data, error } = await supabase.from('user_blocks').select('blocked_id').eq('blocker_id', userId);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.blocked_id));
}

async function loadPublicProfile(profileId: string, viewerId: string): Promise<PublicProfileData> {
  const { data: blocked, error: blockError } = await supabase.rpc('is_blocked_with', { p_other: profileId });
  if (blockError) throw blockError;
  if (blocked === true) return EMPTY_PUBLIC_PROFILE;
  const [{ data: profileData, error: profileError }, { data: accessData }] = await Promise.all([
    supabase.rpc('public_profile', { uid: profileId }),
    supabase.rpc('get_show_history_access', { p_owner: profileId }),
  ]);
  if (profileError) throw profileError;
  const profile = (Array.isArray(profileData) ? profileData[0] : profileData) as PublicProfile | null;
  if (!profile) return EMPTY_PUBLIC_PROFILE;
  const access = (Array.isArray(accessData) ? accessData[0] : accessData) as {
    can_view?: boolean;
    is_friend?: boolean;
  } | null;
  const canViewHistory = access?.can_view === true;
  const isFriend = access?.is_friend === true || profileId === viewerId;
  const eventQuery = (status: 'going' | 'attended') => supabase
    .from('attendance')
    .select('events!attendance_event_id_fkey(*,event_artists(position,artists(id,name,genres,image_url)))')
    .eq('user_id', profileId)
    .eq('status', status)
    .limit(1000);
  const [goingResult, historyResult] = await Promise.all([
    isFriend ? eventQuery('going') : Promise.resolve({ data: [], error: null }),
    canViewHistory ? eventQuery('attended') : Promise.resolve({ data: [], error: null }),
  ]);
  if (goingResult.error || historyResult.error) throw goingResult.error || historyResult.error;
  const events = (rows: any[] | null) => (rows ?? []).map((row) => row.events).filter(Boolean).map(eventFromRow);
  return {
    profile,
    canViewHistory,
    isFriend,
    going: events(goingResult.data).filter((event) => eventInterval(event).end >= Date.now()),
    history: events(historyResult.data).sort((a, b) => b.date.localeCompare(a.date)),
  };
}

async function loadFriendActivity(friendIds: string[]) {
  if (!friendIds.length) return [];
  const ratedPromise = Promise.all(
    Array.from({ length: Math.ceil(friendIds.length / 100) }, (_, batch) =>
      supabase.rpc('get_friend_review_activity', {
        p_user_ids: friendIds.slice(batch * 100, (batch + 1) * 100),
        p_limit: 12,
      }),
    ),
  ).then((results) => ({
    data: results.flatMap((result) => result.data ?? []),
    error: results.find((result) => result.error)?.error ?? null,
  }));
  const [going, rated, recaps, plans] = await Promise.all([
    supabase.from('attendance')
      .select(`id,created_at,profiles!attendance_user_id_fkey(${PUBLIC_PROFILE_COLUMNS}),events!attendance_event_id_fkey(id,title,venue_name,date)`)
      .in('user_id', friendIds).eq('status', 'going').order('created_at', { ascending: false }).limit(12),
    ratedPromise,
    supabase.from('recap_posts')
      .select(`id,created_at,profiles!recap_posts_user_id_fkey(${PUBLIC_PROFILE_COLUMNS}),events!recap_posts_event_id_fkey(id,title,venue_name,date)`)
      .in('user_id', friendIds).order('created_at', { ascending: false }).limit(12),
    supabase.from('plan_members')
      .select(`id,created_at,user_id,profiles!plan_members_user_id_fkey(${PUBLIC_PROFILE_COLUMNS}),plans!plan_members_plan_id_fkey(id,creator_id,events!plans_event_id_fkey(id,title,venue_name,date))`)
      .in('user_id', friendIds).eq('status', 'going').order('created_at', { ascending: false }).limit(12),
  ]);
  if (going.error || rated.error || recaps.error || plans.error) throw going.error || rated.error || recaps.error || plans.error;
  const rows: FriendActivity[] = [];
  for (const row of (going.data ?? []) as any[]) if (row.profiles && row.events) rows.push({
    id: `going-${row.id}`, type: 'going', profile: row.profiles, event: row.events, created_at: row.created_at,
  });
  for (const row of (rated.data ?? []) as any[]) if (row.user_id && row.event_id) rows.push({
    id: `rated-${row.id}`,
    type: 'rated',
    profile: {
      id: row.user_id,
      username: row.username,
      display_name: row.display_name,
      profile_image: row.profile_image,
    } as Profile,
    event: {
      id: row.event_id,
      title: row.event_title,
      venue_name: row.event_venue_name,
      date: row.event_date,
    },
    rating: row.rating,
    created_at: row.created_at,
  });
  for (const row of (recaps.data ?? []) as any[]) if (row.profiles && row.events) rows.push({
    id: `recap-${row.id}`, type: 'recap', profile: row.profiles, event: row.events, created_at: row.created_at,
  });
  for (const row of (plans.data ?? []) as any[]) if (row.profiles && row.plans?.events && row.user_id !== row.plans.creator_id) rows.push({
    id: `plan-${row.id}`, type: 'plan_join', profile: row.profiles, event: row.plans.events, plan_id: row.plans.id, created_at: row.created_at,
  });
  return rows.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 12);
}

async function loadFriendEdges(userId: string, includeActivity = true) {
  const [{ data, error }, blocked] = await Promise.all([
    supabase
      .from('friendships')
      .select(`id,status,requester_id,recipient_id,created_at,requester:profiles!friendships_requester_id_fkey(${PUBLIC_PROFILE_COLUMNS}),recipient:profiles!friendships_recipient_id_fkey(${PUBLIC_PROFILE_COLUMNS})`)
      .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`),
    loadBlockedIds(userId),
  ]);
  if (error) throw error;
  const next = {
    friends: [] as FriendEdge[],
    incoming: [] as FriendEdge[],
    outgoing: [] as FriendEdge[],
    blocked,
    activity: [] as FriendActivity[],
  };
  for (const row of (data ?? []) as any[]) {
    const requester = row.requester_id === userId;
    const profile = (requester ? row.recipient : row.requester) as Profile | null;
    if (!profile || blocked.has(profile.id)) continue;
    const direction = row.status === 'accepted' ? 'friends' : requester ? 'outgoing' : 'incoming';
    next[direction].push({ id: row.id, status: row.status, direction, profile, created_at: row.created_at });
  }
  if (includeActivity) next.activity = await loadFriendActivity(next.friends.map((edge) => edge.profile.id));
  return next;
}

async function loadShows(userId: string) {
  const [catalog, attendanceResult, savedResult, pastResult, loggedResult] = await Promise.all([
    loadEventCatalog(),
    supabase.from('attendance').select('event_id,status').eq('user_id', userId),
    supabase.from('saved_events').select('event_id').eq('user_id', userId),
    supabase.from('attendance').select('events!attendance_event_id_fkey(*,event_artists(position,artists(id,name,genres,image_url)))').eq('user_id', userId).eq('status', 'attended'),
    supabase.from('logged_shows').select('id,event_id,artist_name,venue_name,city,state,show_date,notes').eq('user_id', userId).order('show_date', { ascending: false }),
  ]);
  if (attendanceResult.error || savedResult.error || pastResult.error || loggedResult.error) throw attendanceResult.error || savedResult.error || pastResult.error || loggedResult.error;
  return {
    catalog,
    attendance: new Map((attendanceResult.data ?? []).map((row) => [row.event_id, row.status])),
    saved: new Set((savedResult.data ?? []).map((row) => row.event_id)),
    past: (pastResult.data ?? []).map((row: any) => row.events).filter(Boolean).map(eventFromRow),
    logged: (loggedResult.data ?? []).filter((show) => !show.event_id) as LoggedShow[],
  };
}

async function loadPlans(userId: string): Promise<PlanSummary[]> {
  const { data: memberships, error: memberError } = await supabase.from('plan_members').select('plan_id,status').eq('user_id', userId);
  if (memberError) throw memberError;
  const ids = (memberships ?? []).map((row) => row.plan_id);
  if (!ids.length) return [];
  const [plansResult, countsResult] = await Promise.all([
    supabase.from('plans').select('id,creator_id,event_id,profiles!plans_creator_id_fkey(display_name,username),events!plans_event_id_fkey(*,event_artists(position,artists(id,name,genres,image_url)))').in('id', ids),
    supabase.from('plan_members').select('plan_id,status').in('plan_id', ids),
  ]);
  if (plansResult.error || countsResult.error) throw plansResult.error || countsResult.error;
  const status = new Map((memberships ?? []).map((row) => [row.plan_id, row.status]));
  const counts = new Map<string, number>();
  for (const row of countsResult.data ?? []) if (row.status === 'going') counts.set(row.plan_id, (counts.get(row.plan_id) ?? 0) + 1);
  return (plansResult.data ?? []).flatMap((row: any) => row.events ? [{
    id: row.id,
    creator_id: row.creator_id,
    event: eventFromRow(row.events),
    going: counts.get(row.id) ?? 0,
    status: status.get(row.id) ?? null,
    host: row.profiles?.display_name ?? row.profiles?.username ?? null,
  }] : []).sort((a, b) => a.event.date.localeCompare(b.event.date));
}

async function loadCrews(userId: string): Promise<Crew[]> {
  const { data: crews, error } = await supabase.from('crews').select('id,name,emoji').eq('owner_id', userId).order('created_at');
  if (error) throw error;
  if (!crews?.length) return [];
  const ids = crews.map((crew) => crew.id);
  const [{ data: rows, error: memberError }, blocked] = await Promise.all([
    supabase.from('crew_members').select(`crew_id,user_id,profiles!crew_members_user_id_fkey(${PUBLIC_PROFILE_COLUMNS})`).in('crew_id', ids),
    loadBlockedIds(userId),
  ]);
  if (memberError) throw memberError;
  return crews.map((crew) => ({
    ...crew,
    members: (rows ?? []).filter((row: any) => row.crew_id === crew.id && row.profiles && !blocked.has(row.user_id)).map((row: any) => row.profiles as Profile),
  }));
}

function pageHeading(kicker: string, title: string, body?: string, action?: ReactNode) {
  return <header className="parity-heading"><div><p>{kicker}</p><h2>{title}</h2>{body && <span>{body}</span>}</div>{action}</header>;
}

function MapSurface({ events, city, state, compact = false }: { events: DropEvent[]; city?: string | null; state?: string | null; compact?: boolean }) {
  const eventCoordinates = events.flatMap((event) => {
    const coordinate = Number.isFinite(event.lat) && Number.isFinite(event.lng)
      ? { latitude: event.lat as number, longitude: event.lng as number }
      : null;
    return coordinate ? [{ event, coordinate }] : [];
  });
  const center = coordinatesForCity(city, state) ?? eventCoordinates[0]?.coordinate ?? null;
  if (!center) {
    return <div className={`map-surface${compact ? ' map-surface--compact' : ''}`}><span className="map-surface__center"><MapPin size={compact ? 18 : 22} /><b>Map unavailable</b></span></div>;
  }
  const zoom = compact ? 9 : 10;
  const scale = 2 ** zoom;
  const tileFor = ({ latitude, longitude }: { latitude: number; longitude: number }) => ({
    x: (longitude + 180) / 360 * scale,
    y: (1 - Math.log(Math.tan(latitude * Math.PI / 180) + 1 / Math.cos(latitude * Math.PI / 180)) / Math.PI) / 2 * scale,
  });
  const centerTile = tileFor(center);
  const firstTile = { x: Math.floor(centerTile.x) - 1, y: Math.floor(centerTile.y) - 1 };
  const tiles = Array.from({ length: 9 }, (_, index) => ({
    x: firstTile.x + index % 3,
    y: firstTile.y + Math.floor(index / 3),
  }));
  const mapped = eventCoordinates;
  const mapUrl = `https://www.openstreetmap.org/?mlat=${center.latitude}&mlon=${center.longitude}#map=11/${center.latitude}/${center.longitude}`;
  return <div className={`map-surface${compact ? ' map-surface--compact' : ''}`}>
    <div className="map-layer">
      <div className="map-tiles" aria-hidden="true">{tiles.map((tile) => <span key={`${tile.x}:${tile.y}`}><img src={`https://a.basemaps.cartocdn.com/dark_all/${zoom}/${tile.x}/${tile.y}@2x.png`} alt="" draggable={false} /></span>)}</div>
      {mapped.slice(0, 12).map(({ event, coordinate }) => {
        const tile = tileFor(coordinate);
        const x = Math.max(4, Math.min(96, (tile.x - firstTile.x) / 3 * 100));
        const y = Math.max(4, Math.min(96, (tile.y - firstTile.y) / 3 * 100));
        const price = event.price_min == null ? 'Show' : `${event.currency === 'USD' || !event.currency ? '$' : ''}${Math.round(event.price_min)}+`;
        return <Link className="map-pin" key={event.id} to={`/event/${event.id}`} style={{ left: `${x}%`, top: `${y}%` }} aria-label={`${event.title} on map, ${price}`}><span>{price}</span><small>{event.title}</small></Link>;
      })}
    </div>
    {!mapped.length && <span className="map-surface__center"><MapPin size={compact ? 18 : 22} weight="fill" /><b>{[city, state].filter(Boolean).join(', ') || 'Nearby'}</b></span>}
    <span className="map-surface__attribution">
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>
      <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">© CARTO</a>
      <a href={mapUrl} target="_blank" rel="noreferrer">Open map</a>
    </span>
  </div>;
}

export function MapPage() {
  const auth = useAuth();
  const [range, setRange] = useState<'Any time' | 'Today' | 'This weekend' | 'This week' | 'Pick dates'>('Any time');
  const [view, setView] = useState<'List' | 'Map'>('Map');
  const [pickDate, setPickDate] = useState('');
  const [state, retry] = useLoad(`map:${auth.profile?.city ?? ''}`, EMPTY_EVENTS, loadEventCatalog);
  const area = coordinatesForCity(auth.profile?.city, auth.profile?.state);
  const events = useMemo(() => {
    if (!area) return [];
    const now = new Date();
    return state.data.filter((event) => {
      const coordinate = Number.isFinite(event.lat) && Number.isFinite(event.lng)
        ? { latitude: event.lat as number, longitude: event.lng as number }
        : coordinatesForCity(event.city, event.state);
      if (!coordinate || milesBetween(area, coordinate) > 75) return false;
      if (range === 'Any time') return true;
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (range === 'Today') {
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        return overlapsDays(event, today, tomorrow);
      }
      if (range === 'Pick dates') {
        if (!pickDate) return true;
        const picked = new Date(`${pickDate}T00:00:00`);
        const after = new Date(picked);
        after.setDate(picked.getDate() + 1);
        return overlapsDays(event, picked, after);
      }
      const start = new Date(today);
      const end = new Date(today);
      if (range === 'This week') {
        end.setDate(today.getDate() + 7);
      } else {
        const day = today.getDay();
        start.setDate(today.getDate() + (day === 0 ? -2 : day === 6 ? -1 : day === 5 ? 0 : 5 - day));
        end.setTime(start.getTime());
        end.setDate(start.getDate() + 3);
      }
      return overlapsDays(event, start, end);
    }).slice(0, 30);
  }, [area?.latitude, area?.longitude, pickDate, range, state.data]);
  const mappedEvents = events.filter((event) => Number.isFinite(event.lat) && Number.isFinite(event.lng));

  return <section className="parity-page map-page">
    <div className="map-filters">
      <Tabs options={['Any time', 'Today', 'This weekend', 'This week', 'Pick dates'] as const} value={range} onChange={setRange} label="Map date" />
      {range === 'Pick dates' && <label><span>Show date</span><input type="date" value={pickDate} onChange={(event) => setPickDate(event.target.value)} /></label>}
      <Tabs options={['List', 'Map'] as const} value={view} onChange={setView} label="Map view" />
    </div>
    <PageState status={state.status} onRetry={retry} empty={state.status === 'ready' && !area
      ? { title: 'Choose a location', body: 'Add a supported city and state in Profile before opening the map.', icon: <MapPin size={28} /> }
      : events.length === 0 && state.status === 'ready' ? { title: 'No mapped shows yet', body: 'Try another date or location.', icon: <MapPin size={28} /> } : undefined}>
      {view === 'Map'
        ? <><div className="map-canvas"><MapSurface events={mappedEvents} city={auth.profile?.city} state={auth.profile?.state} /></div>{mappedEvents.length > 0 && <div className="map-event-rail"><EventRail events={mappedEvents.slice(0, 12)} label="Shows on the map" /></div>}</>
        : <div className="map-results" aria-label="Map event list">{events.map((event) => <EventRow key={event.id} event={event} to={`/event/${event.id}`} />)}</div>}
    </PageState>
  </section>;
}

export function MyShowsPage() {
  const auth = useAuth();
  const userId = auth.user?.id ?? '';
  const [tab, setTab] = useState<'Upcoming' | 'Saved' | 'Past'>('Upcoming');
  const [state, retry] = useLoad(`shows:${userId}`, EMPTY_SHOWS, () => loadShows(userId));
  const now = Date.now();
  const events = state.data.catalog.filter((event) => {
    if (tab === 'Saved') return state.data.saved.has(event.id);
    const status = state.data.attendance.get(event.id);
    return tab === 'Upcoming' && eventInterval(event).end >= now && (status === 'going' || status === 'interested');
  });
  const past = [
    ...state.data.past.map((event) => ({ kind: 'event' as const, date: event.date, event })),
    ...state.data.logged.map((show) => ({ kind: 'logged' as const, date: show.show_date, show })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const totalPast = past.length;

  return <section className="parity-page shows-page">
    {pageHeading('YOUR LINEUP', 'My Shows', undefined, <Link className="button button--primary button--small" to="/log-show"><Plus size={16} /> Log a past show</Link>)}
    <Tabs options={['Upcoming', 'Saved', 'Past'] as const} value={tab} onChange={setTab} label="My Shows" />
    {state.status === 'ready' && tab === 'Upcoming' && events.length > 0 && <p className="parity-banner">You have <strong>{events.length}</strong> upcoming {events.length === 1 ? 'show' : 'shows'}.</p>}
    <PageState status={state.status} onRetry={retry} empty={state.status === 'ready' && ((tab === 'Past' ? totalPast : events.length) === 0) ? {
      title: tab === 'Upcoming' ? 'No upcoming shows' : tab === 'Saved' ? 'Nothing saved' : 'No past shows',
      body: tab === 'Upcoming' ? 'Mark events as Going or Interested to see them here.' : tab === 'Saved' ? 'Save an event to keep it here.' : 'Log a show you attended to start your history.',
      icon: tab === 'Saved' ? <BookmarkSimple size={28} /> : <Ticket size={28} />,
    } : undefined}>
      <div className="parity-list">
        {tab !== 'Past' && events.map((event) => <EventRow key={event.id} event={event} to={`/event/${event.id}`} trailing={<span className="status-pill">{state.data.attendance.get(event.id) ?? 'Saved'}</span>} />)}
        {tab === 'Past' && past.map((row) => row.kind === 'event'
          ? <EventRow key={row.event.id} event={row.event} to={`/event/${row.event.id}`} trailing={<span className="status-pill">Attended</span>} />
          : <Link className="parity-event-row" key={row.show.id} to={`/show/${row.show.id}`}>
            <span className="parity-event-row__art"><Clock size={24} /></span>
            <span className="parity-event-row__copy"><strong>{row.show.artist_name}</strong><small>{row.show.show_date} · {[row.show.venue_name, row.show.city, row.show.state].filter(Boolean).join(' · ')}</small></span>
            <CaretRight size={18} />
          </Link>)}
      </div>
    </PageState>
    <div className="feature-links">
      <Link to="/history"><Clock size={18} /> Seen history</Link>
      <Link to="/stats"><Star size={18} /> Drop Stats</Link>
      <Link to="/wrapped"><Sparkle size={18} /> Drop Wrapped</Link>
    </div>
  </section>;
}

export function LogShowPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const [conflict, setConflict] = useState<null | {
    candidateId: string;
    existing: string[];
    incoming: string[];
    payload: Record<string, unknown>;
  }>(null);

  async function record(payload: Record<string, unknown>, candidateId: string | null, resolution: 'merge' | 'separate' | null) {
    setPending(true);
    setNotice('');
    const { data, error } = await supabase.rpc('record_past_show', {
      ...payload,
      p_candidate_event_id: candidateId,
      p_resolution: resolution,
    });
    setPending(false);
    if (error) return setNotice(error.message);
    const result = data as {
      status?: 'recorded' | 'already_logged' | 'confirmation_required';
      candidate_event_id?: string;
      existing_lineup?: string[];
      incoming_lineup?: string[];
    } | null;
    if (result?.status === 'confirmation_required' && result.candidate_event_id) {
      setConflict({
        candidateId: result.candidate_event_id,
        existing: result.existing_lineup ?? [],
        incoming: result.incoming_lineup ?? [],
        payload,
      });
      return;
    }
    if (result?.status === 'recorded' || result?.status === 'already_logged') navigate('/shows');
    else setNotice('Drop could not confirm that show. Please try again.');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth.user?.id) return;
    const values = new FormData(event.currentTarget);
    const artist = String(values.get('artist') ?? '').trim();
    const date = String(values.get('date') ?? '');
    if (!artist || !date) return setNotice('Artist and date are required.');
    setConflict(null);
    await record({
      p_title: artist,
      p_description: null,
      p_show_date: date,
      p_venue_name: String(values.get('venue') ?? '').trim() || null,
      p_city: String(values.get('city') ?? '').trim() || null,
      p_state: String(values.get('state') ?? '').trim() || null,
      p_artist_id: null,
      p_artist_name: artist,
      p_lineup: [],
      p_notes: String(values.get('notes') ?? '').trim() || null,
    }, null, null);
  }
  return <section className="parity-page form-page">
    {pageHeading('SHOW HISTORY', 'Log a past show', 'Add a night that is missing from your Drop history.')}
    <form className="parity-form" onSubmit={submit}>
      <label><span>Artist or event</span><input name="artist" required maxLength={120} /></label>
      <label><span>Date</span><input name="date" type="date" required /></label>
      <label><span>Venue</span><input name="venue" maxLength={120} /></label>
      <div className="field-row"><label><span>City</span><input name="city" maxLength={80} /></label><label><span>State</span><input name="state" maxLength={30} /></label></div>
      <label><span>Notes</span><textarea name="notes" rows={4} maxLength={500} /></label>
      {notice && <p className="status status--error" role="alert">{notice}</p>}
      <button className="button button--primary" type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save show'}</button>
    </form>
    {conflict && <section className="parity-panel conflict-panel" aria-labelledby="show-conflict-title">
      <h3 id="show-conflict-title">Is this the same show?</h3>
      <p>Drop found an event on that date with a different lineup. Choose before anything is saved.</p>
      <div><span><small>Already on Drop</small><strong>{conflict.existing.join(', ') || 'Lineup unavailable'}</strong></span><span><small>Your entry</small><strong>{conflict.incoming.join(', ') || 'Lineup unavailable'}</strong></span></div>
      <span className="row-actions">
        <button className="button button--primary button--small" type="button" disabled={pending} onClick={() => void record(conflict.payload, conflict.candidateId, 'merge')}>Use existing show</button>
        <button className="button button--secondary button--small" type="button" disabled={pending} onClick={() => void record(conflict.payload, conflict.candidateId, 'separate')}>Keep separate</button>
      </span>
    </section>}
  </section>;
}

export function LoggedShowPage() {
  const { showId = '' } = useParams();
  const [state, retry] = useLoad(`logged:${showId}`, null as LoggedShow | null, async () => {
    const { data, error } = await supabase.from('logged_shows').select('id,event_id,artist_name,venue_name,city,state,show_date,notes').eq('id', showId).maybeSingle();
    if (error) throw error;
    return data as LoggedShow | null;
  });
  return <section className="parity-page">
    <PageState status={state.status} onRetry={retry} empty={state.status === 'ready' && !state.data ? { title: 'Show not found', body: 'This logged show is no longer available.' } : undefined}>
      {state.data && <article className="show-memory">
        <p>SHOW MEMORY · {state.data.show_date}</p>
        <h2>{state.data.artist_name}</h2>
        <span>{[state.data.venue_name, state.data.city, state.data.state].filter(Boolean).join(' · ')}</span>
        {state.data.notes && <blockquote>{state.data.notes}</blockquote>}
      </article>}
    </PageState>
  </section>;
}

export function FriendsPage() {
  const auth = useAuth();
  const userId = auth.user?.id ?? '';
  const [tab, setTab] = useState<'Friends' | 'Requests' | 'Find' | 'Activity'>('Friends');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [sent, setSent] = useState(new Set<string>());
  const [refresh, setRefresh] = useState(0);
  const [state, retry] = useLoad(`friends:${userId}:${refresh}`, EMPTY_FRIENDS, () => loadFriendEdges(userId));

  async function respond(id: string, accept: boolean) {
    const request = accept
      ? supabase.from('friendships').update({ status: 'accepted' }).eq('id', id)
      : supabase.from('friendships').delete().eq('id', id);
    await request;
    setRefresh((value) => value + 1);
  }
  async function findPeople(event: FormEvent) {
    event.preventDefault();
    const term = query.trim();
    if (term.length < 2) return setResults([]);
    const { data, error } = await supabase.rpc('search_public_profiles', { p_query: term, p_limit: 20 });
    setResults(error
      ? []
      : ((data ?? []) as Profile[]).filter((profile) => profile.id !== userId && !state.data.blocked.has(profile.id)));
  }
  async function add(profile: Profile) {
    const { error } = await supabase.from('friendships').insert({ requester_id: userId, recipient_id: profile.id, status: 'pending' });
    if (!error) setSent((current) => new Set(current).add(profile.id));
  }
  const matchesQuery = (edge: FriendEdge) => personName(edge.profile).toLowerCase().includes(query.trim().toLowerCase());
  const friends = state.data.friends.filter(matchesQuery);
  const incoming = state.data.incoming.filter(matchesQuery);
  const outgoing = state.data.outgoing.filter(matchesQuery);
  const existing = new Set([...state.data.friends, ...state.data.incoming, ...state.data.outgoing].map((edge) => edge.profile.id));
  const count = tab === 'Friends' ? friends.length : tab === 'Requests' ? incoming.length + outgoing.length : tab === 'Find' ? results.length : state.data.activity.length;

  return <section className="parity-page friends-page">
    {pageHeading('SOCIAL', 'Friends', 'Find your crew, handle requests, and see what friends are planning.', <Link className="button button--secondary button--small" to="/crews"><UsersThree size={16} /> Crews</Link>)}
    <Tabs options={['Friends', 'Requests', 'Find', 'Activity'] as const} value={tab} onChange={setTab} label="Friends" />
    {tab !== 'Activity' && <label className="inline-search"><MagnifyingGlass size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tab === 'Find' ? 'Search Drop users' : 'Filter by name'} aria-label={tab === 'Find' ? 'Search Drop users' : 'Filter friends'} /></label>}
    {tab === 'Find' && <form onSubmit={findPeople}><button className="button button--primary button--small" type="submit">Search</button></form>}
    <PageState status={state.status} onRetry={retry} empty={state.status === 'ready' && count === 0 ? {
      title: tab === 'Friends' ? 'Your crew starts here' : tab === 'Requests' ? 'No pending requests' : tab === 'Find' ? 'Search by name or username' : 'No crew activity yet',
      body: tab === 'Friends' ? 'Invite friends to see who is going to every show.' : tab === 'Activity' ? 'Friend RSVPs and shared recaps will appear here.' : 'Nothing to review right now.',
      icon: <UsersThree size={28} />,
    } : undefined}>
      <div className="person-list">
        {tab === 'Friends' && friends.map((edge) => <PersonRow key={edge.id} edge={edge} actions={<Link className="text-link" to={`/profile/${edge.profile.id}`}>View</Link>} />)}
        {tab === 'Requests' && incoming.map((edge) => <PersonRow key={edge.id} edge={edge} actions={<span className="row-actions"><button className="button button--primary button--small" type="button" onClick={() => void respond(edge.id, true)}>Accept</button><button className="button button--secondary button--small" type="button" onClick={() => void respond(edge.id, false)}>Decline</button></span>} />)}
        {tab === 'Requests' && outgoing.map((edge) => <PersonRow key={edge.id} edge={edge} actions={<span className="status-pill">Sent</span>} />)}
        {tab === 'Find' && results.map((profile) => <PersonRow key={profile.id} edge={{ id: profile.id, profile, status: 'pending', direction: 'outgoing', created_at: '' }} actions={<button className="button button--secondary button--small" type="button" disabled={existing.has(profile.id) || sent.has(profile.id)} onClick={() => void add(profile)}><UserPlus size={15} /> {existing.has(profile.id) ? 'Added' : sent.has(profile.id) ? 'Sent' : 'Add'}</button>} />)}
        {tab === 'Activity' && state.data.activity.map((item) => {
          const copy = item.type === 'going' ? 'is going to'
            : item.type === 'rated' ? `rated ${item.rating ?? 'a show'}`
              : item.type === 'recap' ? 'shared a recap from'
                : 'joined a plan for';
          const to = item.plan_id ? `/plan/${item.plan_id}` : `/event/${item.event.id}`;
          return <Link className="activity-row" key={item.id} to={to}><span className="person-row__avatar">{personName(item.profile).slice(0, 1)}</span><div><strong>{personName(item.profile)}</strong><p>{copy} <b>{item.event.title}</b>.</p><small>{formatTimestamp(item.created_at, true)}</small></div><CaretRight size={17} /></Link>;
        })}
      </div>
    </PageState>
  </section>;
}

export function PersonProfilePage() {
  const auth = useAuth();
  const { profileId = '' } = useParams();
  const [state, retry] = useLoad(`profile:${profileId}:${auth.user?.id ?? ''}`, EMPTY_PUBLIC_PROFILE, () => loadPublicProfile(profileId, auth.user?.id ?? ''));
  const profile = state.data.profile;
  const artists = new Set(state.data.history.flatMap((event) => event.event_artists.map((row) => row.artists?.id).filter(Boolean)));
  const genres = new Set(state.data.history.flatMap((event) => event.event_artists.flatMap((row) => row.artists?.genres ?? [])));

  return <section className="parity-page public-profile">
    <PageState status={state.status} onRetry={retry} empty={state.status === 'ready' && !profile ? {
      title: 'Profile not found',
      body: 'This profile is unavailable.',
      icon: <UsersThree size={28} />,
    } : undefined}>
      {profile && <>
        <header className="public-profile__hero">
          <span className="person-row__avatar">{profile.profile_image ? <img src={profile.profile_image} alt="" /> : personName(profile).slice(0, 1).toUpperCase()}</span>
          <h2>{personName(profile)}</h2>
          {profile.username && <p>@{profile.username}</p>}
        </header>
        {state.data.canViewHistory && <div className="public-profile__stats" aria-label="Show history stats">
          <span><strong>{state.data.history.length}</strong><small>Shows</small></span>
          <span><strong>{artists.size}</strong><small>Artists</small></span>
          <span><strong>{genres.size}</strong><small>Genres</small></span>
        </div>}
        {state.data.isFriend && <section className="profile-section">
          <h3>Going</h3>
          {state.data.going.length
            ? <div className="parity-list">{state.data.going.map((event) => <EventRow key={event.id} event={event} to={`/event/${event.id}`} />)}</div>
            : <p>No upcoming shows.</p>}
        </section>}
        <section className="profile-section">
          <h3>Past shows</h3>
          {!state.data.canViewHistory
            ? <p>Show history and stats are private.</p>
            : state.data.history.length
              ? <div className="parity-list">{state.data.history.map((event) => <EventRow key={event.id} event={event} to={`/event/${event.id}`} />)}</div>
              : <p>No past shows yet.</p>}
        </section>
      </>}
    </PageState>
  </section>;
}

export function CrewsPage() {
  const auth = useAuth();
  const userId = auth.user?.id ?? '';
  const [refresh, setRefresh] = useState(0);
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [selected, setSelected] = useState(new Set<string>());
  const [state, retry] = useLoad(`crews:${userId}:${refresh}`, { crews: [] as Crew[], friends: [] as FriendEdge[] }, async () => {
    const [crews, edges] = await Promise.all([loadCrews(userId), loadFriendEdges(userId, false)]);
    return { crews, friends: edges.friends };
  });
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(new FormData(form).get('name') ?? '').trim();
    if (!name) return;
    const { count, error: countError } = await supabase
      .from('crews')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', userId);
    if (countError) return setNotice(countError.message);
    if ((count ?? 0) >= 5) return setNotice('Free accounts can create up to five crews.');
    const { error } = await supabase.from('crews').insert({ owner_id: userId, name });
    if (error) setNotice(error.message);
    else { form.reset(); setNotice(''); setRefresh((value) => value + 1); }
  }
  function edit(crew: Crew) {
    setEditing(crew.id);
    setSelected(new Set(crew.members.map((member) => member.id)));
    setNotice('');
  }
  async function saveMembers(crew: Crew) {
    const current = new Set(crew.members.map((member) => member.id));
    const add = [...selected].filter((id) => !current.has(id));
    const remove = [...current].filter((id) => !selected.has(id));
    const [added, removed] = await Promise.all([
      add.length ? supabase.from('crew_members').insert(add.map((id) => ({ crew_id: crew.id, user_id: id }))) : Promise.resolve({ error: null }),
      remove.length ? supabase.from('crew_members').delete().eq('crew_id', crew.id).in('user_id', remove) : Promise.resolve({ error: null }),
    ]);
    const error = added.error || removed.error;
    if (error) return setNotice(error.message);
    setEditing(null);
    setNotice('');
    setRefresh((value) => value + 1);
  }
  return <section className="parity-page">
    {pageHeading('PRIVATE GROUPS', 'Crews', 'Organize accepted friends into reusable groups.')}
    <form className="quick-create" onSubmit={create}><input name="name" maxLength={50} placeholder="New crew name" aria-label="New crew name" disabled={state.data.crews.length >= 5} /><button className="button button--primary button--small" type="submit" disabled={state.data.crews.length >= 5}><Plus size={15} /> Create</button></form>
    {notice && <p className="status status--error" role="alert">{notice}</p>}
    <PageState status={state.status} onRetry={retry} empty={state.status === 'ready' && state.data.crews.length === 0 ? { title: 'No crews yet', body: 'Create a crew for the people you plan shows with.', icon: <UsersThree size={28} /> } : undefined}>
      <div className="crew-grid">{state.data.crews.map((crew) => <article className="crew-card" key={crew.id}>
        <span>{crew.emoji || 'DROP'}</span><h3>{crew.name}</h3><p>{crew.members.length} {crew.members.length === 1 ? 'member' : 'members'}</p>
        <div className="avatar-stack">{crew.members.slice(0, 5).map((member) => <span key={member.id}>{member.profile_image ? <img src={member.profile_image} alt="" /> : personName(member).slice(0, 1)}</span>)}</div>
        <button className="button button--secondary button--small" type="button" onClick={() => edit(crew)}>Manage members</button>
        {editing === crew.id && <div className="crew-members">
          {state.data.friends.length
            ? state.data.friends.map((edge) => <label key={edge.profile.id}><input type="checkbox" checked={selected.has(edge.profile.id)} onChange={(event) => setSelected((current) => {
              const next = new Set(current);
              event.target.checked ? next.add(edge.profile.id) : next.delete(edge.profile.id);
              return next;
            })} /><span>{personName(edge.profile)}</span></label>)
            : <p>Add a friend before building this crew.</p>}
          <span className="row-actions"><button className="button button--primary button--small" type="button" onClick={() => void saveMembers(crew)}>Save members</button><button className="button button--secondary button--small" type="button" onClick={() => setEditing(null)}>Cancel</button></span>
        </div>}
      </article>)}</div>
    </PageState>
  </section>;
}

export function PlansPage() {
  const auth = useAuth();
  const userId = auth.user?.id ?? '';
  const [state, retry] = useLoad(`plans:${userId}`, [] as PlanSummary[], () => loadPlans(userId));
  return <section className="parity-page plans-page">
    {pageHeading('CREW PLANNING', 'Plans', 'Pick the show, gather the crew, choose a meetup spot, and keep chat together.', <Link className="button button--primary button--small" to="/discover"><Plus size={16} /> Start from a show</Link>)}
    <PageState status={state.status} onRetry={retry} empty={state.status === 'ready' && state.data.length === 0 ? { title: 'No plans yet', body: 'Open an event and start a plan with friends.', icon: <CalendarDots size={28} /> } : undefined}>
      <div className="plan-grid">{state.data.map((plan) => <Link className="plan-card" key={plan.id} to={`/plan/${plan.id}`}>
        <span className="plan-card__art">{plan.event.image_url ? <img src={plan.event.image_url} alt="" /> : <CalendarDots size={30} />}</span>
        <div><span className="status-pill">{plan.status ?? 'Member'}</span><h3>{plan.event.title}</h3><p>{formatEventDate(plan.event)} · {eventPlace(plan.event)}</p><small>{plan.going} going{plan.host ? ` · hosted by ${plan.creator_id === userId ? 'you' : plan.host}` : ''}</small></div>
      </Link>)}</div>
    </PageState>
  </section>;
}

export function PlanDetailPage() {
  const auth = useAuth();
  const userId = auth.user?.id ?? '';
  const { planId = '' } = useParams();
  const navigate = useNavigate();
  const [refresh, setRefresh] = useState(0);
  const [notice, setNotice] = useState('');
  const [state, retry] = useLoad(`plan:${planId}:${refresh}`, null as null | { plan: any; members: PlanMember[]; messages: PlanMessage[]; spots: any[]; friends: FriendEdge[]; crews: Crew[] }, async () => {
    const [planResult, memberResult, messageResult, spotResult, blocked, friendEdges, crews] = await Promise.all([
      supabase.from('plans').select('id,creator_id,events!plans_event_id_fkey(*,event_artists(position,artists(id,name,genres,image_url)))').eq('id', planId).maybeSingle(),
      supabase.from('plan_members').select(`user_id,status,profiles!plan_members_user_id_fkey(${PUBLIC_PROFILE_COLUMNS})`).eq('plan_id', planId),
      supabase.from('plan_messages').select(`id,user_id,body,created_at,profiles!plan_messages_user_id_fkey(${PUBLIC_PROFILE_COLUMNS})`).eq('plan_id', planId).order('created_at', { ascending: false }).limit(100),
      supabase.from('plan_meetup_spots').select('user_id,spot').eq('plan_id', planId),
      loadBlockedIds(userId),
      loadFriendEdges(userId, false),
      loadCrews(userId),
    ]);
    const error = planResult.error || memberResult.error || messageResult.error || spotResult.error;
    if (error) throw error;
    return planResult.data ? {
      plan: planResult.data,
      members: (memberResult.data as unknown as PlanMember[]).filter((row) => !blocked.has(row.user_id)),
      messages: [...(messageResult.data as unknown as PlanMessage[])].reverse().filter((row) => !blocked.has(row.user_id)),
      spots: (spotResult.data ?? []).filter((row) => !blocked.has(row.user_id)),
      friends: friendEdges.friends,
      crews,
    } : null;
  });
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = String(new FormData(form).get('message') ?? '').trim();
    if (!body) return;
    if (containsDisallowed(body)) return setNotice('That message contains language Drop does not allow.');
    const { error } = await supabase.from('plan_messages').insert({ plan_id: planId, user_id: userId, body });
    if (error) setNotice(error.message);
    else { form.reset(); setNotice(''); setRefresh((value) => value + 1); }
  }
  async function setSpot(spot: string) {
    const { error } = await supabase.from('plan_meetup_spots').upsert({ plan_id: planId, user_id: userId, spot, updated_at: new Date().toISOString() }, { onConflict: 'plan_id,user_id' });
    if (error) setNotice(error.message);
    else { setNotice(''); setRefresh((value) => value + 1); }
  }
  async function setRsvp(status: 'going' | 'maybe' | 'declined') {
    const { error } = await supabase.from('plan_members').update({ status }).eq('plan_id', planId).eq('user_id', userId);
    if (error) setNotice(error.message);
    else { setNotice(''); setRefresh((value) => value + 1); }
  }
  async function invite(userIds: string[]) {
    const memberIds = new Set(state.data?.members.map((member) => member.user_id));
    const invited = [...new Set(userIds)].filter((id) => !memberIds.has(id));
    if (!invited.length) return;
    const { error } = await supabase.from('plan_members').upsert(
      invited.map((id) => ({ plan_id: planId, user_id: id, status: 'invited' })),
      { onConflict: 'plan_id,user_id', ignoreDuplicates: true },
    );
    if (error) setNotice(error.message);
    else { setNotice(''); setRefresh((value) => value + 1); }
  }
  async function leave() {
    const { error } = await supabase.rpc('leave_plan', { p_plan_id: planId });
    if (error) setNotice(error.message);
    else navigate('/plans');
  }
  const event = state.data?.plan?.events ? eventFromRow(state.data.plan.events) : null;
  const mySpot = state.data?.spots.find((row) => row.user_id === userId)?.spot ?? '';
  const myMember = state.data?.members.find((member) => member.user_id === userId);
  const memberIds = new Set(state.data?.members.map((member) => member.user_id));
  const canInvite = state.data?.plan.creator_id === userId;
  const invitable = canInvite ? state.data?.friends.filter((edge) => !memberIds.has(edge.profile.id)) ?? [] : [];
  const invitableCrews = canInvite ? state.data?.crews
    .map((crew) => ({ crew, ids: crew.members.map((member) => member.id).filter((id) => !memberIds.has(id)) }))
    .filter(({ ids }) => ids.length) ?? [] : [];
  return <section className="parity-page">
    <PageState status={state.status} onRetry={retry} empty={state.status === 'ready' && !state.data ? { title: 'Plan not found', body: 'This plan is no longer available.' } : undefined}>
      {state.data && event && <>
        {pageHeading('PLAN DETAIL', event.title, `${formatEventDate(event)} · ${eventPlace(event)}`, <Link className="button button--secondary button--small" to={`/event/${event.id}`}>Show details</Link>)}
        <div className="plan-detail-grid">
          <section className="parity-panel"><h3>Who’s in</h3><div className="plan-rsvp" aria-label="My plan RSVP">{(['going', 'maybe', 'declined'] as const).map((status) => <button className={myMember?.status === status ? 'is-active' : ''} type="button" key={status} onClick={() => void setRsvp(status)}>{status === 'maybe' ? 'Maybe' : status === 'declined' ? 'Can’t go' : 'Going'}</button>)}</div><div className="person-list">{state.data.members.map((member) => <div className="person-row" key={member.user_id}><span className="person-row__avatar">{personName(member.profiles).slice(0, 1)}</span><span><strong>{member.user_id === userId ? 'You' : personName(member.profiles)}</strong><small>{member.status}</small></span></div>)}</div>{(invitable.length > 0 || invitableCrews.length > 0) && <div className="crew-members"><strong>Invite to this plan</strong>{invitableCrews.map(({ crew, ids }) => <button className="button button--secondary button--small" type="button" key={crew.id} onClick={() => void invite(ids)}>Invite {crew.name}</button>)}{invitable.map((edge) => <button className="button button--secondary button--small" type="button" key={edge.profile.id} onClick={() => void invite([edge.profile.id])}>Invite {personName(edge.profile)}</button>)}</div>}<button className="text-danger" type="button" onClick={() => void leave()}>Leave plan</button></section>
          <section className="parity-panel"><h3>Meetup spot</h3><label className="select-field"><span>Where should your crew meet?</span><select value={mySpot} onChange={(event) => void setSpot(event.target.value)}><option value="">Choose a spot</option>{['Main Stage', 'Second Stage', 'Bar', 'Entrance', 'Merch', 'Food Court', 'VIP Area', 'Restrooms'].map((spot) => <option key={spot}>{spot}</option>)}</select></label></section>
          <section className="parity-panel plan-chat"><h3>Plan chat</h3><div className="chat-list">{state.data.messages.length ? state.data.messages.map((message) => <article className={message.user_id === userId ? 'is-me' : ''} key={message.id}><strong>{message.user_id === userId ? 'You' : personName(message.profiles)}</strong><p>{message.body}</p><small>{formatTimestamp(message.created_at, true)}</small></article>) : <p className="muted-copy">No messages yet. Start the plan chat.</p>}</div><form onSubmit={send}><input name="message" maxLength={500} placeholder="Message the plan" aria-label="Message the plan" /><button type="submit" aria-label="Send plan message"><ChatCircleDots size={20} /></button></form></section>
        </div>
        {notice && <p className="status status--error" role="alert">{notice}</p>}
      </>}
    </PageState>
  </section>;
}

export function FestivalsPage() {
  const [state, retry] = useLoad('festivals', EMPTY_EVENTS, async () => (await loadEventCatalog()).filter((event) => event.is_festival));
  return <section className="parity-page">
    {pageHeading('FESTIVALS & LIVE', 'Festivals', 'Build your schedule, catch clashes, and use Live Mode on the night.')}
    <PageState status={state.status} onRetry={retry} empty={state.status === 'ready' && state.data.length === 0 ? { title: 'No festival schedules yet', body: 'Published festivals will appear when official schedule data is available.', icon: <FlagBanner size={28} /> } : undefined}>
      <div className="festival-grid">{state.data.map((event) => <article className="festival-card" key={event.id}>
        <span>{event.image_url ? <img src={event.image_url} alt="" /> : <FlagBanner size={31} />}</span>
        <div><p>FESTIVAL</p><h3>{event.title}</h3><small>{formatEventDate(event)} · {eventPlace(event)}</small><div><Link className="button button--secondary button--small" to={`/schedule/${event.id}`}>Schedule</Link><Link className="button button--primary button--small" to={`/live/${event.id}`}>Live Mode</Link></div></div>
      </article>)}</div>
    </PageState>
  </section>;
}

export function FestivalSchedulePage() {
  const auth = useAuth();
  const userId = auth.user?.id ?? '';
  const { eventId = '' } = useParams();
  const [mine, setMine] = useState(new Set<string>());
  const [state, retry] = useLoad(`schedule:${eventId}`, { event: null as DropEvent | null, times: [] as SetTime[] }, async () => {
    const [catalog, timesResult, mineResult] = await Promise.all([
      loadEventCatalog(),
      supabase.from('event_set_times').select('id,event_id,artist_name,stage,start_time,end_time,timezone').eq('event_id', eventId).order('start_time'),
      supabase.from('my_set_times').select('set_time_id').eq('user_id', userId),
    ]);
    if (timesResult.error || mineResult.error) throw timesResult.error || mineResult.error;
    setMine(new Set((mineResult.data ?? []).map((row) => row.set_time_id)));
    return { event: catalog.find((event) => event.id === eventId) ?? null, times: (timesResult.data ?? []) as SetTime[] };
  });
  async function toggle(id: string) {
    const active = mine.has(id);
    const { error } = active
      ? await supabase.from('my_set_times').delete().eq('user_id', userId).eq('set_time_id', id)
      : await supabase.from('my_set_times').insert({ user_id: userId, set_time_id: id });
    if (!error) setMine((current) => { const next = new Set(current); active ? next.delete(id) : next.add(id); return next; });
  }
  const days = groupBy(state.data.times, setTimeDay);
  return <section className="parity-page">
    {pageHeading('FESTIVAL SCHEDULE', state.data.event?.title ?? 'Schedule', state.data.event ? `${formatEventDate(state.data.event)} · ${eventPlace(state.data.event)}` : undefined)}
    <PageState status={state.status} onRetry={retry} empty={state.status === 'ready' && state.data.times.length === 0 ? { title: 'Schedule not published yet', body: 'Official set times will appear here as soon as the festival releases them.', icon: <CalendarDots size={28} /> } : undefined}>
      <div className="schedule">{Object.entries(days).map(([day, dayTimes]) => <section className="schedule-day" key={day}>
        <h2>{day}</h2>
        {Object.entries(groupBy(dayTimes, (time) => time.stage || 'Schedule')).map(([stage, times]) => <section key={`${day}:${stage}`}><h3><span />{stage}</h3>{times.map((time) => <article className={mine.has(time.id) ? 'is-picked' : ''} key={time.id}><time>{formatSetTime(time)}</time><strong>{time.artist_name}</strong><button type="button" onClick={() => void toggle(time.id)} aria-label={`${mine.has(time.id) ? 'Remove' : 'Add'} ${time.artist_name} from my schedule`}>{mine.has(time.id) ? <Check size={17} /> : <Plus size={17} />}</button></article>)}</section>)}
      </section>)}</div>
    </PageState>
  </section>;
}

export function LiveModePage() {
  const auth = useAuth();
  const userId = auth.user?.id ?? '';
  const { eventId = '' } = useParams();
  const [checkedInNow, setCheckedInNow] = useState(false);
  const [clock, setClock] = useState(Date.now());
  useEffect(() => setCheckedInNow(false), [eventId]);
  useEffect(() => {
    const interval = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);
  const poll = Math.floor(clock / 60_000);
  const [state, retry] = useLoad(`live:${eventId}:${poll}`, { event: null as DropEvent | null, times: [] as SetTime[], checkins: [] as any[], checkedIn: false }, async () => {
    const [event, timesResult, blocked] = await Promise.all([
      loadEventById(eventId),
      supabase.from('event_set_times').select('id,event_id,artist_name,stage,start_time,end_time,timezone').eq('event_id', eventId).order('start_time'),
      loadBlockedIds(userId),
    ]);
    if (timesResult.error) throw timesResult.error;
    const interval = event ? eventInterval(event) : null;
    const active = interval ? interval.start <= Date.now() && Date.now() <= interval.end : false;
    const checkinsResult = active
      ? await supabase.from('event_checkins')
        .select('user_id,spot_label,checked_in_at,profiles!event_checkins_user_id_fkey(display_name,username)')
        .eq('event_id', eventId)
        .gte('checked_in_at', new Date(interval!.start).toISOString())
        .lte('checked_in_at', new Date(Math.min(interval!.end, Date.now())).toISOString())
      : { data: [] as any[], error: null };
    if (checkinsResult.error) throw checkinsResult.error;
    return {
      event,
      times: (timesResult.data ?? []) as SetTime[],
      checkins: (checkinsResult.data ?? []).filter((row) => row.user_id !== userId && !blocked.has(row.user_id)),
      checkedIn: (checkinsResult.data ?? []).some((row) => row.user_id === userId),
    };
  }, true);
  const interval = state.data.event ? eventInterval(state.data.event) : null;
  const canCheckIn = Boolean(interval && interval.start <= clock && clock <= interval.end);
  const checkedIn = checkedInNow || state.data.checkedIn;
  async function checkIn() {
    if (!canCheckIn) return;
    const { error } = await supabase.from('event_checkins').upsert({ user_id: userId, event_id: eventId, checked_in_at: new Date().toISOString() }, { onConflict: 'user_id,event_id' });
    if (!error) setCheckedInNow(true);
  }
  const current = state.data.times.find((time) => {
    const start = Date.parse(time.start_time);
    const explicitEnd = Date.parse(time.end_time ?? '');
    const end = Number.isFinite(explicitEnd) ? explicitEnd : start + 90 * 60 * 1000;
    return start <= clock && clock < end;
  });
  const next = state.data.times.find((time) => Date.parse(time.start_time) > clock);
  return <section className="parity-page live-page">
    {pageHeading('LIVE', state.data.event?.title ?? 'Live Mode', state.data.event ? eventPlace(state.data.event) : undefined)}
    <PageState status={state.status} onRetry={retry}>
      <div className="live-grid">
        <section className="parity-panel live-now"><p>NOW</p><h3>{current?.artist_name ?? 'No set is live right now'}</h3>{current && <span>{current.stage}</span>}{next && <small>Next: {next.artist_name} · {formatSetTime(next)}</small>}</section>
        <section className="live-map"><MapSurface events={state.data.event ? [state.data.event] : []} city={state.data.event?.city} state={state.data.event?.state} compact /></section>
        <section className="parity-panel"><h3>Crew here now</h3><p>{state.data.checkins.length ? state.data.checkins.map((row) => personName(row.profiles)).join(', ') : 'No friends have checked in yet.'}</p></section>
        <section className="parity-panel live-checkin"><h3>At the show?</h3><button className="button button--primary" type="button" disabled={checkedIn || !canCheckIn} onClick={() => void checkIn()}>{checkedIn ? <><Check size={17} /> Checked in</> : canCheckIn ? 'I’m here — check in' : 'Check-in opens during the show'}</button></section>
      </div>
    </PageState>
  </section>;
}

const NOTIFICATION_PREF: Record<string, string> = {
  artist: 'artist_announcements',
  venue: 'artist_announcements',
  friend: 'friend_activity',
  friend_going: 'friend_activity',
  reminder: 'show_reminders',
  sale: 'sale_alerts',
  comment: 'comment_alerts',
  plan_message: 'plan_messages',
  reaction: 'friend_activity',
  recap_ready: 'recap_alerts',
};

async function loadNotifications(userId: string, profile: Profile | null) {
  const [stored, follows, venueFollows, attendance, friendships, preferences, catalog, blocked] = await Promise.all([
    supabase.from('alerts').select('id,title,body,kind,read,created_at,event_id,plan_id').eq('user_id', userId).order('created_at', { ascending: false }).limit(15),
    supabase.from('artist_follows').select('artist_id').eq('user_id', userId),
    supabase.from('venue_follows').select('venue_name,city').eq('user_id', userId),
    supabase.from('attendance').select('event_id,status').eq('user_id', userId),
    supabase.from('friendships').select('requester_id,recipient_id,status').or(`requester_id.eq.${userId},recipient_id.eq.${userId}`).eq('status', 'accepted'),
    supabase.from('notification_prefs').select('artist_announcements,friend_activity,show_reminders,sale_alerts,comment_alerts,plan_messages,recap_alerts').eq('user_id', userId).maybeSingle(),
    loadEventCatalog(),
    loadBlockedIds(userId),
  ]);
  const error = stored.error || follows.error || venueFollows.error || attendance.error || friendships.error || preferences.error;
  if (error) throw error;
  const friendIds = (friendships.data ?? [])
    .map((row) => row.requester_id === userId ? row.recipient_id : row.requester_id)
    .filter((id) => !blocked.has(id));
  const friendAttendance = friendIds.length
    ? await supabase.from('attendance')
      .select(`event_id,user_id,profiles!attendance_user_id_fkey(${PUBLIC_PROFILE_COLUMNS})`)
      .in('user_id', friendIds)
      .eq('status', 'going')
      .limit(5)
    : { data: [] as any[], error: null };
  if (friendAttendance.error) throw friendAttendance.error;

  const alerts = [...((stored.data ?? []) as AlertRow[])];
  const storedReminders = new Set(alerts.filter((alert) => alert.kind === 'reminder').map((alert) => alert.event_id).filter(Boolean));
  const followed = new Set((follows.data ?? []).map((row) => row.artist_id));
  const followedVenues = new Set((venueFollows.data ?? []).map((row) => `${row.venue_name.trim().toLowerCase()}\u0000${(row.city ?? '').trim().toLowerCase()}`));
  const eventById = new Map(catalog.map((event) => [event.id, event]));
  const now = Date.now();
  const profileState = profile?.state?.trim().toLowerCase();

  for (const event of catalog) {
    if (alerts.filter((alert) => alert.kind === 'artist').length >= 3) break;
    if (profileState && event.state?.trim().toLowerCase() !== profileState) continue;
    const artist = event.event_artists.find((row) => row.artists?.id && followed.has(row.artists.id));
    if (artist?.artists) alerts.push({
      id: `artist-${event.id}`,
      kind: 'artist',
      title: `${artist.artists.name} has an upcoming show`,
      body: `${event.title} · ${event.city ?? ''}`,
      event_id: event.id,
      read: true,
      created_at: null,
    });
  }
  for (const event of catalog) {
    if (alerts.filter((alert) => alert.kind === 'venue').length >= 3) break;
    const key = `${(event.venue_name ?? '').trim().toLowerCase()}\u0000${(event.city ?? '').trim().toLowerCase()}`;
    if (event.venue_name && followedVenues.has(key)) alerts.push({
      id: `venue-${event.id}`,
      kind: 'venue',
      title: `New show at ${event.venue_name}`,
      body: `${event.title} · ${event.city ?? ''}`,
      event_id: event.id,
      read: true,
      created_at: null,
    });
  }
  for (const row of attendance.data ?? []) {
    if (row.status !== 'going') continue;
    const event = eventById.get(row.event_id);
    if (!event || storedReminders.has(event.id)) continue;
    const days = calendarDayDiff(event.date, now, event.timezone);
    if (days >= 0 && days <= 10) alerts.push({
      id: `reminder-${event.id}`,
      kind: 'reminder',
      title: days === 0 ? `${event.title} is today!` : `${event.title} is in ${days} day${days === 1 ? '' : 's'}`,
      body: `${event.venue_name ?? ''} · ${event.city ?? ''}`,
      event_id: event.id,
      read: true,
      created_at: null,
    });
  }
  for (const row of (friendAttendance.data ?? []) as any[]) {
    const event = eventById.get(row.event_id);
    if (!event || !row.profiles) continue;
    alerts.push({
      id: `friend-${row.user_id}-${event.id}`,
      kind: 'friend',
      title: `${personName(row.profiles)} is going to ${event.title}`,
      body: `${event.city ?? ''} · tap to join the plan`,
      event_id: event.id,
      read: true,
      created_at: null,
    });
  }

  const prefs = preferences.data as Record<string, boolean> | null;
  const visible = [...new Map(alerts.map((alert) => [alert.id, alert])).values()]
    .filter((alert) => !prefs || prefs[NOTIFICATION_PREF[alert.kind]] !== false)
    .slice(0, 20);
  const storedIds = new Set((stored.data ?? []).map((alert) => alert.id));
  const renderedUnreadIds = visible.filter((alert) => storedIds.has(alert.id) && !alert.read).map((alert) => alert.id);
  if (renderedUnreadIds.length) {
    const marked = await supabase.from('alerts').update({ read: true }).eq('user_id', userId).in('id', renderedUnreadIds);
    if (marked.error) throw marked.error;
  }
  return visible;
}

function NotificationsContent({ userId, profile }: { userId: string; profile: Profile | null }) {
  const [state, retry] = useLoad(`alerts:${userId}:${profile?.city ?? ''}:${profile?.state ?? ''}`, [] as AlertRow[], () => loadNotifications(userId, profile));
  const groups = groupBy(state.data, (alert) => alert.created_at && new Date(alert.created_at).toDateString() === new Date().toDateString() ? 'Today' : 'Earlier');
  return <>
    <PageState status={state.status} onRetry={retry} empty={state.status === 'ready' && state.data.length === 0 ? { title: 'No notifications right now', body: 'You’re all caught up.', icon: <Bell size={28} /> } : undefined}>
      <div className="notification-groups">{Object.entries(groups).map(([label, alerts]) => <section key={label}><h3>{label}</h3>{alerts?.map((alert) => {
        const to = alert.plan_id ? `/plan/${alert.plan_id}` : alert.event_id ? `/event/${alert.event_id}` : '';
        const content = <><span className={`notification-icon kind-${alert.kind}`}><Bell size={18} /></span><span><strong>{alert.title}</strong>{alert.body && <small>{alert.body}</small>}</span>{!alert.read && <i />}</>;
        return to ? <Link className="notification-row" key={alert.id} to={to}>{content}</Link> : <div className="notification-row" key={alert.id}>{content}</div>;
      })}</section>)}</div>
    </PageState>
  </>;
}

export function NotificationsPage() {
  const auth = useAuth();
  const userId = auth.user?.id ?? '';
  return <section className="parity-page">
    {pageHeading('INBOX', 'Notifications', 'Shared alerts from artists, friends, plans, comments, sales, and recaps.', <Link className="button button--secondary button--small" to="/settings">Preferences</Link>)}
    {!auth.profile && !auth.profileError
      ? <PageState status="loading">{null}</PageState>
      : <NotificationsContent userId={userId} profile={auth.profile} />}
  </section>;
}

export function HistoryPage({ mode = 'history' }: { mode?: 'history' | 'stats' | 'wrapped' }) {
  const auth = useAuth();
  const userId = auth.user?.id ?? '';
  const [range, setRange] = useState<'This year' | 'All time'>('This year');
  const [state, retry] = useLoad(`${mode}:${userId}`, EMPTY_SHOWS, () => loadShows(userId));
  const currentYear = new Date().getFullYear();
  const events = mode === 'history' || range === 'All time'
    ? state.data.past
    : state.data.past.filter((event) => new Date(event.date).getFullYear() === currentYear);
  const logged = mode === 'history' || range === 'All time'
    ? state.data.logged
    : state.data.logged.filter((show) => Number(show.show_date.slice(0, 4)) === currentYear);
  const cityCounts = new Map<string, number>();
  const artistCounts = new Map<string, number>();
  for (const event of events) {
    const city = [event.city, event.state].filter(Boolean).join(', ');
    if (city) cityCounts.set(city, (cityCounts.get(city) ?? 0) + 1);
    for (const artist of event.event_artists) if (artist.artists?.name) artistCounts.set(artist.artists.name, (artistCounts.get(artist.artists.name) ?? 0) + 1);
  }
  for (const show of logged) {
    const city = [show.city, show.state].filter(Boolean).join(', ');
    if (city) cityCounts.set(city, (cityCounts.get(city) ?? 0) + 1);
    artistCounts.set(show.artist_name, (artistCounts.get(show.artist_name) ?? 0) + 1);
  }
  const topCities = [...cityCounts].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topArtists = [...artistCounts].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const total = events.length + logged.length;
  async function share() {
    const text = `My Drop ${range === 'All time' ? 'all-time' : currentYear} history: ${total} shows, ${artistCounts.size} artists, ${cityCounts.size} cities.`;
    try {
      if (navigator.share) await navigator.share({ title: 'My Drop Wrapped', text });
      else await navigator.clipboard.writeText(text);
    } catch {
      // Cancelling the share sheet is a normal no-op.
    }
  }
  return <section className={`parity-page ${mode === 'wrapped' ? 'wrapped-page' : ''}`}>
    {pageHeading(mode === 'history' ? 'SHOW HISTORY' : mode === 'stats' ? 'YOUR NUMBERS' : 'DROP WRAPPED', mode === 'history' ? 'Seen History' : mode === 'stats' ? 'Drop Stats' : range === 'All time' ? 'Your life in shows' : `Your ${currentYear} in shows`, undefined, mode === 'wrapped' ? <button className="button button--primary button--small" type="button" onClick={() => void share()}><ShareNetwork size={16} /> Share</button> : undefined)}
    {mode !== 'history' && <Tabs options={['This year', 'All time'] as const} value={range} onChange={setRange} label={`${mode} range`} />}
    <PageState status={state.status} onRetry={retry} empty={state.status === 'ready' && total === 0 ? { title: 'Your history is waiting', body: 'Attend or log a show to unlock this screen.', icon: <Sparkle size={28} /> } : undefined}>
      {mode === 'history' ? <div className="history-list">{[...events.map((event) => ({ date: event.date, title: event.title, place: eventPlace(event), to: `/event/${event.id}` })), ...logged.map((show) => ({ date: show.show_date, title: show.artist_name, place: [show.venue_name, show.city, show.state].filter(Boolean).join(' · '), to: `/show/${show.id}` }))].sort((a, b) => b.date.localeCompare(a.date)).map((item) => <Link key={`${item.to}:${item.date}`} to={item.to}><time>{item.date.slice(0, 4)}</time><span><strong>{item.title}</strong><small>{item.date.slice(0, 10)} · {item.place}</small></span><CaretRight size={17} /></Link>)}</div> : <div className="stats-grid">
        <article><strong>{total}</strong><span>Shows</span></article><article><strong>{artistCounts.size}</strong><span>Artists</span></article><article><strong>{cityCounts.size}</strong><span>Cities</span></article>
        <section><h3>Top artists</h3>{topArtists.map(([name, count], index) => <p key={name}><b>{index + 1}</b><span>{name}</span><strong>{count}x</strong></p>)}</section>
        <section><h3>Top cities</h3>{topCities.map(([name, count], index) => <p key={name}><b>{index + 1}</b><span>{name}</span><strong>{count}</strong></p>)}</section>
      </div>}
    </PageState>
  </section>;
}

export function UtilityPage({ kind }: { kind: 'wallet' | 'reminders' | 'blocked' }) {
  const auth = useAuth();
  const userId = auth.user?.id ?? '';
  const config = {
    wallet: { kicker: 'TICKETS', title: 'Ticket Wallet', empty: 'Saved ticket details and passes will appear here.', icon: <Ticket size={28} /> },
    reminders: { kicker: 'ON SALE', title: 'Reminders', empty: 'Set reminders from an event’s sale details.', icon: <Clock size={28} /> },
    blocked: { kicker: 'PRIVACY', title: 'Blocked accounts', empty: 'Accounts you block will appear here.', icon: <UsersThree size={28} /> },
  }[kind];
  const [refresh, setRefresh] = useState(0);
  const [state, retry] = useLoad(`${kind}:${userId}:${refresh}`, [] as any[], async () => {
    if (kind === 'wallet') {
      const { data, error } = await supabase.from('user_tickets')
        .select('id,event_id,seller,order_ref,shot_path,created_at,events!user_tickets_event_id_fkey(id,title,date,venue_name,image_url)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    }
    if (kind === 'reminders') {
      const [catalog, follows, saves, attendance] = await Promise.all([
        loadEventCatalog(),
        supabase.from('artist_follows').select('artist_id').eq('user_id', userId),
        supabase.from('saved_events').select('event_id').eq('user_id', userId),
        supabase.from('attendance').select('event_id').eq('user_id', userId),
      ]);
      if (follows.error || saves.error || attendance.error) throw follows.error || saves.error || attendance.error;
      const followed = new Set((follows.data ?? []).map((row) => row.artist_id));
      const relevant = new Set([
        ...(saves.data ?? []).map((row) => row.event_id),
        ...(attendance.data ?? []).map((row) => row.event_id),
      ]);
      const now = Date.now();
      const candidates = catalog.filter((event) => {
        const sale = Date.parse(event.presale_start ?? event.onsale_start ?? '');
        const followsArtist = event.event_artists.some((row) => row.artists?.id && followed.has(row.artists.id));
        return sale > now && (relevant.has(event.id) || followsArtist);
      }).sort((a, b) => Date.parse(a.presale_start ?? a.onsale_start ?? '') - Date.parse(b.presale_start ?? b.onsale_start ?? ''));
      if (!candidates.length) return [];
      const { data, error } = await supabase.from('onsale_reminders')
        .select('event_id,enabled')
        .eq('user_id', userId)
        .in('event_id', candidates.map((event) => event.id));
      if (error) throw error;
      const enabled = new Map((data ?? []).map((row) => [row.event_id, row.enabled]));
      return candidates.map((event) => ({ event_id: event.id, enabled: enabled.get(event.id) ?? true, events: event }));
    }
    const { data: blocks, error } = await supabase.from('user_blocks').select('id,blocked_id,created_at').eq('blocker_id', userId).order('created_at', { ascending: false });
    if (error) throw error;
    const ids = (blocks ?? []).map((row) => row.blocked_id);
    if (!ids.length) return [];
    const { data: profiles, error: profileError } = await supabase.from('profiles').select(PUBLIC_PROFILE_COLUMNS).in('id', ids);
    if (profileError) throw profileError;
    const byId = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    return (blocks ?? []).map((row) => ({ ...row, profile: byId.get(row.blocked_id) ?? null }));
  });
  async function toggleReminder(row: any) {
    const { error } = await supabase.from('onsale_reminders').upsert({ user_id: userId, event_id: row.event_id, enabled: !row.enabled }, { onConflict: 'user_id,event_id' });
    if (!error) setRefresh((value) => value + 1);
  }
  async function unblock(row: any) {
    const { error } = await supabase.from('user_blocks').delete().eq('blocker_id', userId).eq('blocked_id', row.blocked_id);
    if (!error) setRefresh((value) => value + 1);
  }
  async function shareTicket(row: any) {
    const event = row.events;
    const text = `${event?.title ?? 'My ticket'} — ${row.seller}`;
    try {
      if (navigator.share) await navigator.share({ title: event?.title ?? 'Drop ticket', text });
      else await navigator.clipboard.writeText(text);
    } catch {
      // Cancelling the share sheet is a normal no-op.
    }
  }
  return <section className="parity-page">
    {pageHeading(config.kicker, config.title)}
    <PageState status={state.status} onRetry={retry} empty={state.status === 'ready' && state.data.length === 0 ? { title: `No ${config.title.toLowerCase()} yet`, body: config.empty, icon: config.icon } : undefined}>
      <div className="parity-list">{state.data.map((row) => {
        const event = row.events as DropEvent | null | undefined;
        if (kind === 'blocked') return <div className="utility-row" key={row.id}>
          <span className="person-row__avatar">{personName(row.profile).slice(0, 1).toUpperCase()}</span>
          <span className="utility-row__copy"><strong>{personName(row.profile)}</strong><small>{row.profile?.username ? `@${row.profile.username}` : 'Blocked account'}</small></span>
          <button className="button button--secondary button--small" type="button" onClick={() => void unblock(row)}>Unblock</button>
        </div>;
        return <div className="utility-row" key={row.id ?? row.event_id}>
          <span className="parity-event-row__art">{event?.image_url ? <img src={event.image_url} alt="" /> : config.icon}</span>
          <span className="utility-row__copy"><strong>{event?.title ?? 'Event'}</strong><small>{event ? `${formatEventDate(event)} · ${event.venue_name ?? 'Venue TBA'}` : 'Event details unavailable'}</small>{kind === 'wallet' && <small>{row.seller}{row.order_ref ? ` · Order #${row.order_ref}` : row.shot_path ? ' · Screenshot attached' : ''}</small>}</span>
          {kind === 'wallet'
            ? <button className="button button--secondary button--small" type="button" onClick={() => void shareTicket(row)}>Share</button>
            : <button className={`toggle ${row.enabled ? 'is-on' : ''}`} type="button" role="switch" aria-checked={row.enabled} aria-label={`Remind me about ${event?.title ?? 'this event'}`} onClick={() => void toggleReminder(row)}><span /></button>}
        </div>;
      })}</div>
    </PageState>
  </section>;
}
