import { isAllowedEmail, type AuthStatus } from "./auth-rules";
import { ensureProfile } from "./profiles";
import { createClient } from "./server";

/**
 * Google sign-in through Supabase Auth, server-side with PKCE (AD-9): the
 * code verifier and the session live in `@supabase/ssr` cookies; the browser
 * never talks to Supabase directly.
 */

/**
 * The Google authorization URL for this sign-in, or `null` when Supabase
 * refuses to start the flow. `callbackUrl` is the absolute `/auth/callback`
 * URL (with `next` and `tz`); it must match the project's Redirect URLs.
 */
export async function startGoogleSignIn(callbackUrl: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl,
      skipBrowserRedirect: true,
      // Always show the account chooser, so another account can be picked after a rejection.
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) {
    console.error(JSON.stringify({ event: "auth.start_failed", code: error?.code ?? "no_url" }));
    return null;
  }
  return data.url;
}

/**
 * Exchanges the OAuth code for a session, re-checks the account against
 * `ALLOWED_EMAIL` (the Before User Created hook is the first gate) and creates
 * the profile on first sign-in. Any account other than the allowlisted one is
 * signed out again, so it keeps no session.
 */
export async function completeGoogleSignIn(code: string, timeZone: string | null): Promise<AuthStatus> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    console.error(JSON.stringify({ event: "auth.exchange_failed", code: error?.code ?? "no_user" }));
    return "error";
  }

  if (!isAllowedEmail(data.user.email, process.env.ALLOWED_EMAIL)) {
    await supabase.auth.signOut({ scope: "local" });
    console.warn(JSON.stringify({ event: "auth.not_allowed" }));
    return "not_allowed";
  }

  const profile = await ensureProfile(supabase, data.user.id, timeZone);
  if (profile === "failed") {
    await supabase.auth.signOut({ scope: "local" });
    console.error(JSON.stringify({ event: "auth.profile_failed" }));
    return "error";
  }
  if (profile === "skipped") console.warn(JSON.stringify({ event: "auth.profile_skipped_invalid_tz" }));
  return "success";
}

/** Ends this device's session (other devices keep theirs). */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
}
