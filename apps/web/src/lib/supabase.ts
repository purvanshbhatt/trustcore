import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

let browserClient: SupabaseClient | null = null;

/**
 * True when both public Supabase env vars were present at build time.
 * When false the app runs without sign-in (local development against an API
 * that has auth disabled).
 */
export function isAuthConfigured(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
}

/**
 * Lazily creates the browser Supabase client. Returns null on the server and
 * when auth is not configured, so callers must handle the unauthenticated path.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (typeof window === 'undefined' || !isAuthConfigured()) {
    return null;
  }
  if (browserClient === null) {
    browserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return browserClient;
}

/** Current session access token (JWT) for the API bearer header, or null. */
export async function getAccessToken(): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (supabase === null) {
    return null;
  }
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      return null;
    }
    return data.session?.access_token ?? null;
  } catch {
    // Storage unavailable (private mode, blocked cookies): treat as signed out.
    return null;
  }
}
