import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The service-role client (AD-9): bypasses RLS, so it exists only on the macro
 * submission path, which has no session (the token authenticates, AD-6).
 * `SUPABASE_SECRET_KEY` is a server-only env var (no `NEXT_PUBLIC_`), so it
 * never reaches a browser bundle. `null` when the env is not set: callers carry
 * on without writing.
 *
 * Create one per request; never keep it in a module-level variable.
 */
export function createServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
