import { describe, expect, it } from "vitest";
import {
  PREFERENCE_MAX_AGE,
  htmlPreferenceAttributes,
  isReduceMotion,
  isTheme,
  parsePreferences,
  parseReduceMotion,
  parseTheme,
  reduceMotionCookie,
  themeCookie,
} from "./preferences";

describe("parseTheme", () => {
  it("is dark without a cookie (first visit)", () => {
    expect(parseTheme(undefined)).toBe("dark");
    expect(parseTheme(null)).toBe("dark");
    expect(parseTheme("")).toBe("dark");
  });

  it.each(["dark", "light"] as const)("keeps %s", (value) => {
    expect(parseTheme(value)).toBe(value);
  });

  it.each(["xyz", "Light", " light", "system", "light;"])("ignores a broken value %j", (value) => {
    expect(parseTheme(value)).toBe("dark");
  });
});

describe("parseReduceMotion", () => {
  it("follows the OS without a cookie", () => {
    expect(parseReduceMotion(undefined)).toBe("system");
  });

  it.each(["on", "system"] as const)("keeps %s", (value) => {
    expect(parseReduceMotion(value)).toBe(value);
  });

  it.each(["off", "true", "ON", "1"])("ignores a broken value %j", (value) => {
    expect(parseReduceMotion(value)).toBe("system");
  });
});

describe("parsePreferences", () => {
  it("reads both cookies by name", () => {
    const jar: Record<string, string> = { theme: "light", reduce_motion: "on" };
    expect(parsePreferences((name) => jar[name])).toEqual({ theme: "light", reduceMotion: "on" });
  });

  it("falls back to the defaults", () => {
    expect(parsePreferences(() => undefined)).toEqual({ theme: "dark", reduceMotion: "system" });
  });
});

describe("guards", () => {
  it("accept only the known values", () => {
    expect(isTheme("light")).toBe(true);
    expect(isTheme(1)).toBe(false);
    expect(isTheme({})).toBe(false);
    expect(isReduceMotion("on")).toBe(true);
    expect(isReduceMotion("off")).toBe(false);
    expect(isReduceMotion(null)).toBe(false);
  });
});

describe("cookies", () => {
  it("writes theme for one year, lax, server-only", () => {
    expect(themeCookie("light", true)).toEqual({
      name: "theme",
      value: "light",
      options: { path: "/", maxAge: PREFERENCE_MAX_AGE, sameSite: "lax", httpOnly: true, secure: true },
    });
    expect(PREFERENCE_MAX_AGE).toBe(31_536_000);
  });

  it("writes reduce_motion, secure only when asked", () => {
    const cookie = reduceMotionCookie("system", false);
    expect(cookie.name).toBe("reduce_motion");
    expect(cookie.value).toBe("system");
    expect(cookie.options.secure).toBe(false);
  });
});

describe("htmlPreferenceAttributes", () => {
  it("sets data-motion only when the switch is on", () => {
    expect(htmlPreferenceAttributes({ theme: "dark", reduceMotion: "system" })).toEqual({ "data-theme": "dark" });
    expect(htmlPreferenceAttributes({ theme: "light", reduceMotion: "on" })).toEqual({
      "data-theme": "light",
      "data-motion": "reduce",
    });
  });
});
