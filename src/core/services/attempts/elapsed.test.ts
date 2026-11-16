import { describe, expect, it } from "vitest";
import { attemptDurationSeconds, elapsedSeconds, formatElapsed } from "./elapsed";

const START = "2026-11-02T01:00:00+00:00";
const at = (iso: string) => Date.parse(iso);

describe("elapsedSeconds (AD-8)", () => {
  it("counts whole seconds since the timestamp, rounded down", () => {
    expect(elapsedSeconds(START, at("2026-11-02T01:00:05Z"))).toBe(5);
    expect(elapsedSeconds(START, at("2026-11-02T01:12:34.999Z"))).toBe(754);
    expect(elapsedSeconds(START, at("2026-11-02T02:02:05Z"))).toBe(3725);
  });

  it("is never negative", () => {
    expect(elapsedSeconds(START, at("2026-11-02T00:59:00Z"))).toBe(0);
  });

  it("is 0 for a timestamp that does not parse", () => {
    expect(elapsedSeconds("not a date", at("2026-11-02T01:00:05Z"))).toBe(0);
    expect(elapsedSeconds("", at("2026-11-02T01:00:05Z"))).toBe(0);
  });
});

describe("formatElapsed", () => {
  it("is mm:ss, and h:mm:ss from one hour", () => {
    expect(formatElapsed(5)).toBe("00:05");
    expect(formatElapsed(408)).toBe("06:48");
    expect(formatElapsed(3725)).toBe("1:02:05");
    expect(formatElapsed(Number.NaN)).toBe("00:00");
  });
});

describe("attemptDurationSeconds (AD-8)", () => {
  it("is the whole seconds from started_at to received_at", () => {
    expect(attemptDurationSeconds(START, "2026-11-02T01:06:48.900+00:00")).toBe(408);
    expect(attemptDurationSeconds(START, START)).toBe(0);
  });

  it("is null when a timestamp is missing or unparseable, or the end is before the start", () => {
    expect(attemptDurationSeconds(START, null)).toBeNull();
    expect(attemptDurationSeconds(undefined, START)).toBeNull();
    expect(attemptDurationSeconds(START, "not a date")).toBeNull();
    expect(attemptDurationSeconds("", START)).toBeNull();
    expect(attemptDurationSeconds(START, "2026-11-02T00:59:59Z")).toBeNull();
  });
});
