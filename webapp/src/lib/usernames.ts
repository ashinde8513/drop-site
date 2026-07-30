export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

export type UsernameResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9._]/g, '');
}

export function validateUsername(value: string): UsernameResult {
  const username = normalizeUsername(value);
  if (!username) return { ok: false, error: 'Pick a username.' };
  if (username.length < USERNAME_MIN) {
    return { ok: false, error: `Username must be at least ${USERNAME_MIN} characters.` };
  }
  if (username.length > USERNAME_MAX) {
    return { ok: false, error: `Username must be at most ${USERNAME_MAX} characters.` };
  }
  if (!/^[a-z0-9]/.test(username) || !/[a-z0-9]$/.test(username)) {
    return { ok: false, error: 'Username must start and end with a letter or number.' };
  }
  if (RESERVED_USERNAMES.has(username)) return { ok: false, error: 'That username is reserved.' };
  return { ok: true, value: username };
}

const RESERVED_USERNAMES = new Set([
  'admin', 'administrator', 'drop', 'dropapp', 'support', 'help', 'root',
  'system', 'moderator', 'mod', 'official', 'staff', 'team', 'null', 'undefined',
]);
