import { supabase } from './supabase';
import { normalizeUsername, validateUsername } from './usernames';

export interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  profile_image: string | null;
  city: string | null;
  state: string | null;
  bio: string | null;
  role: 'fan' | 'promoter';
  is_admin: boolean;
  is_plus: boolean;
  onboarding_complete: boolean;
  contacts_discoverable: boolean;
  show_age: boolean;
  show_history_public: boolean;
  recap_includable: boolean;
}

export type ProfileUpdate = Partial<Pick<Profile,
  | 'username'
  | 'display_name'
  | 'city'
  | 'state'
  | 'bio'
  | 'contacts_discoverable'
  | 'show_age'
  | 'show_history_public'
  | 'recap_includable'
>>;

export interface NotificationPrefs {
  artist_announcements: boolean;
  friend_activity: boolean;
  show_reminders: boolean;
  sale_alerts: boolean;
  comment_alerts: boolean;
  plan_messages: boolean;
  recap_alerts: boolean;
}

export interface MusicConnection {
  provider: 'apple_music' | 'soundcloud';
  status: 'connected' | 'revoked' | 'error';
  storefront: string | null;
  connected_at: string;
  last_synced_at: string | null;
  followed_count: number;
}

export type MusicProvider = MusicConnection['provider'];
export type SignupComplianceState = 'unknown' | 'complete' | 'required' | 'unavailable';

const PROFILE_COLUMNS = [
  'id',
  'username',
  'display_name',
  'profile_image',
  'city',
  'state',
  'bio',
  'role',
  'is_admin',
  'is_plus',
  'onboarding_complete',
  'contacts_discoverable',
  'show_age',
  'show_history_public',
  'recap_includable',
].join(',');

const NOTIFICATION_COLUMNS = [
  'artist_announcements',
  'friend_activity',
  'show_reminders',
  'sale_alerts',
  'comment_alerts',
  'plan_messages',
  'recap_alerts',
].join(',');

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Sign in required.');
  return data.user.id;
}

export function defaultNotificationPrefs(): NotificationPrefs {
  return {
    artist_announcements: true,
    friend_activity: true,
    show_reminders: true,
    sale_alerts: true,
    comment_alerts: true,
    plan_messages: true,
    recap_alerts: true,
  };
}

export async function getMyProfile(): Promise<Profile | null> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as Profile | null;
}

export async function checkUsernameAvailable(rawUsername: string): Promise<boolean> {
  const username = normalizeUsername(rawUsername);
  if (!username) return false;
  const { data, error } = await supabase.rpc('username_available', { p_username: username });
  if (error) return true;
  return data !== false;
}

export async function updateMyProfile(updates: ProfileUpdate): Promise<Profile> {
  const userId = await requireUserId();
  const next = { ...updates };
  if (next.username !== undefined) {
    if (next.username) {
      const validated = validateUsername(next.username);
      if (!validated.ok) throw new Error(validated.error);
      next.username = validated.value;
    } else {
      next.username = null;
    }
    if (next.username && !(await isUsernameAvailableForUser(userId, next.username))) {
      throw new Error('That username is taken.');
    }
  }
  const { data, error } = await supabase
    .from('profiles')
    .update(next)
    .eq('id', userId)
    .select(PROFILE_COLUMNS)
    .single();
  if (error?.code === '23505' || (error && /duplicate|unique/i.test(error.message))) {
    throw new Error('That username is taken.');
  }
  if (error) throw error;
  return data as unknown as Profile;
}

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('notification_prefs')
    .select(NOTIFICATION_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? data as unknown as NotificationPrefs : defaultNotificationPrefs();
}

export async function saveNotificationPrefs(prefs: NotificationPrefs): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from('notification_prefs').upsert(
    { user_id: userId, ...prefs, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  );
  if (error) throw error;
}

export async function getRecapIncludable(): Promise<boolean> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('profiles')
    .select('recap_includable')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return true;
  return data.recap_includable !== false;
}

export async function setRecapIncludable(value: boolean): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from('profiles')
    .update({ recap_includable: value })
    .eq('id', userId);
  if (error) throw error;
}

export async function getMusicConnections(): Promise<MusicConnection[]> {
  const userId = await requireUserId();
  const { data: connections, error: connectionError } = await supabase
    .from('music_connections')
    .select('provider, status, storefront, connected_at, last_synced_at')
    .eq('user_id', userId);
  if (connectionError) throw connectionError;
  if (!connections?.length) return [];
  const { data: follows, error: followError } = await supabase
    .from('artist_follows')
    .select('source')
    .eq('user_id', userId);
  if (followError) throw followError;
  const counts = new Map<string, number>();
  for (const follow of follows ?? []) {
    if (!follow.source) continue;
    counts.set(follow.source, (counts.get(follow.source) ?? 0) + 1);
  }
  return (connections ?? []).map((connection) => ({
    ...connection,
    followed_count: counts.get(connection.provider) ?? 0,
  })) as MusicConnection[];
}

export async function disconnectMusic(provider: MusicProvider, keepFollows: boolean): Promise<void> {
  await requireUserId();
  const { data, error } = await supabase.functions.invoke('music-import', {
    body: { action: 'disconnect', provider, keepFollows },
  });
  if (error || !data?.disconnected) throw error ?? new Error('Music disconnect failed.');
}

export async function getSignupComplianceStatus(expectedUserId: string): Promise<Exclude<SignupComplianceState, 'unknown'>> {
  const { data, error } = await supabase.rpc('signup_compliance_status');
  if (error || !data || typeof data !== 'object') return 'unavailable';
  const result = data as { user_id?: unknown; complete?: unknown };
  if (result.user_id !== expectedUserId || typeof result.complete !== 'boolean') return 'unavailable';
  return result.complete ? 'complete' : 'required';
}

export async function completeSignupCompliance(birthdate: string): Promise<void> {
  const { data, error } = await supabase.rpc('complete_signup_profile', {
    p_birthdate: birthdate,
    p_terms_version: '2026-07-18',
    p_privacy_version: '2026-07-18',
  });
  if (!error && data === true) return;
  if (error?.message.includes('16 or older')) throw new Error('You must be 16 or older to use Drop.');
  if (error?.message.includes('current Terms')) throw new Error("Accept Drop's current Terms and Privacy Policy.");
  throw new Error('Could not finish account setup. Try again.');
}

export async function uploadAvatar(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a JPEG, PNG, or WebP image.');
  }
  if (file.size > 5 * 1024 * 1024) throw new Error('Profile photos must be 5 MB or smaller.');
  const userId = await requireUserId();
  const path = `${userId}/web-avatar`;
  const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  const publicUrl = `${data.publicUrl}?v=${Date.now()}`;
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ profile_image: publicUrl })
    .eq('id', userId);
  if (profileError) throw profileError;
  return publicUrl;
}

async function isUsernameAvailableForUser(userId: string, rawUsername: string): Promise<boolean> {
  const username = normalizeUsername(rawUsername);
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .ilike('username', username)
    .neq('id', userId)
    .maybeSingle();
  if (error) return false;
  return !data;
}
