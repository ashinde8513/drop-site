import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://ebccwnkmsnhbljxxxdej.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_ZMsNcfhfqsGgyvsdBDTKHg__h8SDZyd';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});
