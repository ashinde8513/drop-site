import type { Provider } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { normalizeUsername, validateUsername } from '../lib/usernames';

export { normalizeUsername, validateUsername } from '../lib/usernames';

export const LEGAL_VERSION = '2026-07-18';

export interface AuthResult {
  error?: string;
}

export interface SignUpInput {
  email: string;
  password: string;
  username: string;
  birthdate: string;
  legalAccepted: boolean;
  referredBy?: string;
}

export interface SignUpResult extends AuthResult {
  needsConfirmation?: boolean;
}

export type OAuthProvider = Extract<Provider, 'google' | 'apple' | 'facebook'>;

export function isAtLeast16(birthdate: string, today = new Date()): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthdate);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return false;
  const cutoff = new Date(Date.UTC(today.getUTCFullYear() - 16, today.getUTCMonth(), today.getUTCDate()));
  return date <= cutoff;
}

export async function signIn(identifier: string, password: string): Promise<AuthResult> {
  const login = identifier.trim();
  if (!login || !password) return { error: 'Enter your email or username and password.' };
  if (!looksLikeEmail(login)) {
    const username = normalizeUsername(login);
    const { data, error } = await supabase.functions.invoke('login-with-username', {
      body: { username, password },
    });
    if (error || !data?.access_token || !data?.refresh_token) {
      return { error: 'Invalid username or password.' };
    }
    const result = await supabase.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });
    return result.error ? { error: result.error.message } : {};
  }
  const { error } = await supabase.auth.signInWithPassword({ email: login, password });
  return error ? { error: error.message } : {};
}

export async function signUp(input: SignUpInput): Promise<SignUpResult> {
  const email = input.email.trim();
  if (!looksLikeEmail(email)) return { error: 'Enter a valid email address.' };
  if (input.password.length < 8) return { error: 'Password must be at least 8 characters.' };
  const username = validateUsername(input.username);
  if (!username.ok) return { error: username.error };
  const { data: available, error: availabilityError } = await supabase.rpc('username_available', {
    p_username: username.value,
  });
  if (!availabilityError && available === false) return { error: 'That username is taken.' };
  if (!isAtLeast16(input.birthdate)) return { error: 'You must be 16 or older to use Drop.' };
  if (!input.legalAccepted) return { error: 'Agree to the Terms and Privacy Policy to continue.' };
  const metadata: Record<string, string> = {
    username: username.value,
    birthdate: input.birthdate,
    legal_accepted: 'true',
    terms_version: LEGAL_VERSION,
    privacy_version: LEGAL_VERSION,
  };
  if (input.referredBy) metadata.referred_by = input.referredBy;
  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      emailRedirectTo: authRedirectUrl(),
      data: metadata,
    },
  });
  if (error) return { error: error.message };
  return { needsConfirmation: !data.session };
}

export async function signInWithOAuth(provider: OAuthProvider): Promise<AuthResult> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: authRedirectUrl() },
  });
  return error ? { error: error.message } : {};
}

export async function requestPasswordReset(email: string): Promise<AuthResult> {
  const normalized = email.trim();
  if (!looksLikeEmail(normalized)) return { error: 'Enter a valid email address.' };
  const { error } = await supabase.auth.resetPasswordForEmail(normalized, {
    redirectTo: authRedirectUrl('reset-password'),
  });
  return error ? { error: error.message } : {};
}

export async function updatePassword(password: string): Promise<AuthResult> {
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' };
  const { error } = await supabase.auth.updateUser({ password });
  return error ? { error: error.message } : {};
}

export async function resendVerification(email: string): Promise<AuthResult> {
  const normalized = email.trim();
  if (!looksLikeEmail(normalized)) return { error: 'Enter a valid email address.' };
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: normalized,
    options: { emailRedirectTo: authRedirectUrl() },
  });
  return error ? { error: error.message } : {};
}

export async function signOut(): Promise<AuthResult> {
  const { error } = await supabase.auth.signOut();
  return error ? { error: error.message } : {};
}

export async function deleteAccount(): Promise<AuthResult> {
  const { data, error } = await supabase.functions.invoke('delete-account', {
    body: { confirm: 'DELETE' },
  });
  if (error || data?.ok !== true) return { error: error?.message ?? 'Could not delete account.' };
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
  return {};
}

function authRedirectUrl(path = ''): string {
  if (typeof window === 'undefined') return '';
  const base = `${window.location.origin}/app/next/`;
  return path ? new URL(path, base).toString() : base;
}

function looksLikeEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}
