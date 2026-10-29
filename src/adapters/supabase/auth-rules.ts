/**
 * Pure rules for Google sign-in (CAP-17, AD-9): no IO, no framework imports,
 * so they are unit-tested directly. `auth.ts`, the `/auth/*` routes and the
 * proxy wire them to Supabase and Next.
 */

import type { LoginError } from "../../messages/id";

/** How a sign-in attempt ended, as the popup reports it to the Login page. */
export type AuthStatus = "success" | "not_allowed" | "cancelled" | "error";

/** `postMessage` payload from `/auth/callback` (popup) to the Login page. */
export type AuthMessage = { type: "whe-auth"; status: AuthStatus; next: string };
export const AUTH_MESSAGE_TYPE = "whe-auth";

/** API envelope code for a request without a session (Consistency Conventions › API envelope). */
export const UNAUTHENTICATED = "UNAUTHENTICATED";

/**
 * Marker in the message the `hook_before_user_created` hook returns when it
 * rejects an email (migration 20261029000003). Supabase Auth passes the hook's
 * message on as `error_description` in the OAuth redirect.
 */
export const NOT_ALLOWLISTED_MARKER = "not_allowlisted";

const LOGIN_PATH = "/login";
const PLACEHOLDER_ORIGIN = "http://next.invalid";

/**
 * Where to go after sign-in: only a same-origin relative path (`/…`, never
 * `//…` or `/\…`), otherwise `/`. Paths back into `/login` or `/auth/*` also
 * become `/` so sign-in never loops.
 */
export function safeNext(raw: string | null | undefined): string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 2048) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  // Control characters and whitespace (tab, newline) can smuggle a scheme or host.
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i);
    if (code <= 0x20 || code === 0x7f || code === 0x5c /* \ */) return "/";
  }
  let url: URL;
  try {
    url = new URL(raw, PLACEHOLDER_ORIGIN);
  } catch {
    return "/";
  }
  if (url.origin !== PLACEHOLDER_ORIGIN) return "/";
  if (isAuthPath(url.pathname)) return "/";
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Case-insensitive, whitespace-trimmed equality; an empty or missing allowlist allows nobody. */
export function isAllowedEmail(email: string | null | undefined, allowed: string | null | undefined): boolean {
  const candidate = email?.trim().toLowerCase();
  const expected = allowed?.trim().toLowerCase();
  if (!candidate || !expected) return false;
  return candidate === expected;
}

/**
 * Maps the error parameters Supabase Auth adds to the callback URL when the
 * OAuth flow fails. `null` when there is no error.
 */
export function classifyOAuthError(params: {
  error: string | null;
  errorCode: string | null;
  errorDescription: string | null;
}): AuthStatus | null {
  const { error, errorCode, errorDescription } = params;
  if (!error && !errorCode && !errorDescription) return null;
  if (errorDescription?.toLowerCase().includes(NOT_ALLOWLISTED_MARKER)) return "not_allowed";
  // Google's consent screen "Cancel" comes back as a bare access_denied; with
  // an error_code it is a Supabase rejection (e.g. signup_disabled).
  if (error === "access_denied" && !errorCode) return "cancelled";
  return "error";
}

/**
 * The trimmed IANA zone, or `null` when it is not a zone the runtime knows
 * (AD-8: `profiles.time_zone`).
 */
export function normalizeTimeZone(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const tz = raw.trim();
  if (tz.length === 0 || tz.length > 64 || !/^[A-Za-z0-9_+\-/]+$/.test(tz)) return null;
  try {
    // Throws RangeError for a zone ICU does not know. The browser's own name is
    // kept (ICU would turn e.g. Asia/Kolkata into the older link Asia/Calcutta).
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return null;
  }
}

/** `/auth/google` for the Login control: the popup's URL, and the plain link without JS. */
export function googleSignInPath(next: string, timeZone?: string): string {
  const params = new URLSearchParams({ next: safeNext(next) });
  if (timeZone) params.set("tz", timeZone);
  return `/auth/google?${params.toString()}`;
}

/** Login's inline error for the `?error=` value `callbackFallbackUrl` sets; `null` for none. */
export function loginErrorFromParam(value: string | null | undefined): LoginError | null {
  if (value === "not_allowed") return "notAllowed";
  if (value === "error") return "network";
  return null;
}

/**
 * Where a callback lands when it cannot hand its result to an opener window
 * (opened as a normal tab): the requested page on success, otherwise Login
 * with the reason so the inline slot can show it.
 */
export function callbackFallbackUrl(status: AuthStatus, next: string): string {
  if (status === "success") return next;
  const params = new URLSearchParams();
  if (status !== "cancelled") params.set("error", status);
  if (next !== "/") params.set("next", next);
  const query = params.toString();
  return query ? `${LOGIN_PATH}?${query}` : LOGIN_PATH;
}

/**
 * The page `/auth/callback` returns: it posts the result to the opener (same
 * origin only) and closes the popup; without an opener it navigates to the
 * fallback URL itself.
 */
export function callbackPageHtml(status: AuthStatus, next: string): string {
  const message: AuthMessage = { type: AUTH_MESSAGE_TYPE, status, next };
  const payload = jsonForScript({ message, fallback: callbackFallbackUrl(status, next) });
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Signing in…</title></head>
<body style="background:#0b0d0c;color:#8e9993;font-family:system-ui,sans-serif">
<p>Signing in…</p>
<script>
(function () {
  var p = ${payload};
  var opener = null;
  try { opener = window.opener && !window.opener.closed ? window.opener : null; } catch (e) { opener = null; }
  if (opener) {
    try { opener.postMessage(p.message, window.location.origin); } catch (e) {}
    window.close();
  } else {
    window.location.replace(p.fallback);
  }
})();
</script>
</body>
</html>`;
}

/** JSON safe to inline in a `<script>`: no `</script>`, `<!--` or line separators survive. */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/** Login and the OAuth routes. */
function isAuthPath(pathname: string): boolean {
  return pathname === LOGIN_PATH || pathname === "/auth" || pathname.startsWith("/auth/");
}

/** A file directly in `public/`: one path segment with a static extension. */
const STATIC_FILE = /^\/[^/]+\.(?:ico|svg|png|jpg|jpeg|gif|webp|avif|css|js|map|txt|xml|webmanifest|woff2?)$/i;

/**
 * Paths reachable without a session: Login, `/auth/*`, the macro endpoint
 * (token-authenticated, AD-6), `/health` and static assets. Everything else
 * needs a session.
 */
export function isPublicPath(pathname: string): boolean {
  const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  if (isAuthPath(path)) return true;
  if (path === "/api/submissions/macro") return true;
  if (path === "/health") return true;
  if (path.startsWith("/_next/")) return true;
  if (path === "/favicon.ico") return true;
  // A file at the top of `public/` (no page route has an extension).
  if (STATIC_FILE.test(path)) return true;
  return false;
}

/** API routes answer 401 JSON instead of a redirect to Login. */
export function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

/** `/login?next=<path>` for a request without a session. */
export function loginRedirectPath(pathname: string, search: string): string {
  const next = safeNext(`${pathname}${search}`);
  return next === "/" ? LOGIN_PATH : `${LOGIN_PATH}?${new URLSearchParams({ next }).toString()}`;
}
