import { describe, expect, it } from "vitest";
import {
  INITIAL_SAVE,
  PREFERENCE_MAX_AGE,
  applyPreferenceAttributes,
  finishSave,
  startSave,
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

describe("applyPreferenceAttributes", () => {
  it("sets the theme the server rule sets", () => {
    for (const theme of ["dark", "light"] as const) {
      const dataset: Record<string, string | undefined> = {};
      applyPreferenceAttributes(dataset, { theme, reduceMotion: "system" });
      expect(dataset.theme).toBe(htmlPreferenceAttributes({ theme, reduceMotion: "system" })["data-theme"]);
    }
  });

  it("sets data-motion=reduce when the switch is on", () => {
    const dataset: Record<string, string | undefined> = { theme: "dark" };
    applyPreferenceAttributes(dataset, { theme: "dark", reduceMotion: "on" });
    expect(dataset).toEqual({ theme: "dark", motion: "reduce" });
  });

  it("removes data-motion when the switch goes off", () => {
    const dataset: Record<string, string | undefined> = { theme: "light", motion: "reduce" };
    applyPreferenceAttributes(dataset, { theme: "light", reduceMotion: "system" });
    expect(dataset).toEqual({ theme: "light" });
    expect("motion" in dataset).toBe(false);
  });
});

describe("save status", () => {
  it("goes saving → saved for a single save", () => {
    const { tracker, ticket } = startSave(INITIAL_SAVE);
    expect(tracker.state).toBe("saving");
    expect(finishSave(tracker, ticket, "saved").state).toBe("saved");
  });

  it("reports an error for the latest save", () => {
    const { tracker, ticket } = startSave(INITIAL_SAVE);
    expect(finishSave(tracker, ticket, "error").state).toBe("error");
  });

  it("does not let an older save overwrite a newer status", () => {
    const first = startSave(INITIAL_SAVE);
    const second = startSave(first.tracker);
    const afterSecond = finishSave(second.tracker, second.ticket, "saved");
    const afterFirst = finishSave(afterSecond, first.ticket, "error");
    expect(afterFirst).toBe(afterSecond);
    expect(afterFirst.state).toBe("saved");
  });

  it("keeps saving while the newer save is still pending", () => {
    const first = startSave(INITIAL_SAVE);
    const second = startSave(first.tracker);
    expect(finishSave(second.tracker, first.ticket, "saved").state).toBe("saving");
  });
});
