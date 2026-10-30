import { isAllowedEmail, type AuthStatus } from "./auth-rules";
import { ensureProfile, readTimeZone, type TimeZoneRead } from "./profiles";
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

  const allowed = process.env.ALLOWED_EMAIL;
  if (!isAllowedEmail(data.user.email, allowed)) {
    await supabase.auth.signOut({ scope: "local" });
    // A missing setting rejects everyone; log it apart from a stranger's account.
    const event = allowed?.trim() ? "auth.not_allowed" : "auth.allowed_email_unset";
    console.warn(JSON.stringify({ event }));
    return "not_allowed";
  }

  const profile = await ensureProfile(supabase, data.user.id, timeZone);
  if (profile === "failed") {
    await supabase.auth.signOut({ scope: "local" });
    console.error(JSON.stringify({ event: "auth.profile_failed" }));
    return "error";
  }
  if (profile === "skipped" && timeZone === null) {
    console.warn(JSON.stringify({ event: "auth.profile_skipped_invalid_tz" }));
  }
  return "success";
}

/** Ends this device's session (other devices keep theirs). */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
}

export type SessionUser = { id: string; email: string | null };

type ServerClient = Awaited<ReturnType<typeof createClient>>;

async function userFromClaims(supabase: ServerClient): Promise<SessionUser | null> {
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims || typeof claims.sub !== "string" || claims.sub.length === 0) return null;
  // An empty claim is no address: treat it like a missing one.
  const email = typeof claims.email === "string" && claims.email.trim().length > 0 ? claims.email : null;
  return { id: claims.sub, email };
}

/**
 * The signed-in user from this request's session cookie (verified claims), or
 * `null` without a session. Server Actions call it before acting
 * (Consistency Conventions › Auth & session).
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  return userFromClaims(await createClient());
}

export type Account = { email: string | null; timeZone: TimeZoneRead };

/** Settings' account row and streak time zone, through the user's session (AD-9). */
export async function getAccount(): Promise<Account | null> {
  const supabase = await createClient();
  const user = await userFromClaims(supabase);
  if (!user) return null;
  return { email: user.email, timeZone: await readTimeZone(supabase, user.id) };
}
