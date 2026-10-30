/**
 * Per-device preferences (ARCHITECTURE-SPINE › Consistency Conventions ›
 * Preferences): Theme and Reduce motion live in cookies the server reads to
 * set `data-theme` / `data-motion` on <html> before first paint. Pure: no IO,
 * no framework imports; the Server Actions in `preferences-actions.ts` and the
 * layouts wire it to `next/headers`.
 */

export const THEME_COOKIE = "theme";
export const REDUCE_MOTION_COOKIE = "reduce_motion";

export const THEMES = ["dark", "light"] as const;
export type Theme = (typeof THEMES)[number];
export const DEFAULT_THEME: Theme = "dark";

/**
 * `on` adds reduction on top of the OS; `system` (default, also what turning
 * the switch off writes) leaves it to `prefers-reduced-motion`.
 */
export const REDUCE_MOTION_VALUES = ["on", "system"] as const;
export type ReduceMotion = (typeof REDUCE_MOTION_VALUES)[number];
export const DEFAULT_REDUCE_MOTION: ReduceMotion = "system";

export type Preferences = { theme: Theme; reduceMotion: ReduceMotion };

/** One year, in seconds. */
export const PREFERENCE_MAX_AGE = 60 * 60 * 24 * 365;

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

export function isReduceMotion(value: unknown): value is ReduceMotion {
  return typeof value === "string" && (REDUCE_MOTION_VALUES as readonly string[]).includes(value);
}

/** The `theme` cookie value; anything missing or unknown is dark. */
export function parseTheme(raw: string | null | undefined): Theme {
  return isTheme(raw) ? raw : DEFAULT_THEME;
}

/** The `reduce_motion` cookie value; anything missing or unknown follows the OS. */
export function parseReduceMotion(raw: string | null | undefined): ReduceMotion {
  return isReduceMotion(raw) ? raw : DEFAULT_REDUCE_MOTION;
}

/** Both preferences from a cookie lookup (e.g. `name => store.get(name)?.value`). */
export function parsePreferences(get: (name: string) => string | undefined): Preferences {
  return {
    theme: parseTheme(get(THEME_COOKIE)),
    reduceMotion: parseReduceMotion(get(REDUCE_MOTION_COOKIE)),
  };
}

export type PreferenceCookie = {
  name: typeof THEME_COOKIE | typeof REDUCE_MOTION_COOKIE;
  value: string;
  options: {
    path: "/";
    maxAge: number;
    sameSite: "lax";
    httpOnly: true;
    secure: boolean;
  };
};

function cookieOptions(secure: boolean): PreferenceCookie["options"] {
  // Only the server reads these, so the page script never needs them.
  return { path: "/", maxAge: PREFERENCE_MAX_AGE, sameSite: "lax", httpOnly: true, secure };
}

export function themeCookie(theme: Theme, secure: boolean): PreferenceCookie {
  return { name: THEME_COOKIE, value: theme, options: cookieOptions(secure) };
}

export function reduceMotionCookie(value: ReduceMotion, secure: boolean): PreferenceCookie {
  return { name: REDUCE_MOTION_COOKIE, value, options: cookieOptions(secure) };
}

/** `data-theme` always; `data-motion="reduce"` only when the switch is on. */
export function htmlPreferenceAttributes(preferences: Preferences): {
  "data-theme": Theme;
  "data-motion"?: "reduce";
} {
  return preferences.reduceMotion === "on"
    ? { "data-theme": preferences.theme, "data-motion": "reduce" }
    : { "data-theme": preferences.theme };
}
