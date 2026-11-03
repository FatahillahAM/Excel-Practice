import { describe, expect, it } from "vitest";
import { elapsedSeconds } from "./elapsed";

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
