import { describe, expect, it } from "vitest";
import { SLOW_GRADING_S, elapsedAt, formatElapsed, isGradingSlow } from "./exam-time";

describe("formatElapsed", () => {
  it("shows mm:ss under an hour", () => {
    expect(formatElapsed(0)).toBe("00:00");
    expect(formatElapsed(5)).toBe("00:05");
    expect(formatElapsed(754)).toBe("12:34");
    expect(formatElapsed(3599)).toBe("59:59");
  });

  it("shows h:mm:ss from one hour", () => {
    expect(formatElapsed(3600)).toBe("1:00:00");
    expect(formatElapsed(3725)).toBe("1:02:05");
  });

  it("never shows a negative or broken time", () => {
    expect(formatElapsed(-3)).toBe("00:00");
    expect(formatElapsed(Number.NaN)).toBe("00:00");
  });
});

describe("elapsedAt", () => {
  it("adds the whole seconds since the anchor to the server's value", () => {
    expect(elapsedAt(754, 1_000, 1_000)).toBe(754);
    expect(elapsedAt(754, 1_000, 2_999)).toBe(755);
    expect(elapsedAt(754, 1_000, 4_000)).toBe(757);
  });

  it("re-anchors to a new server value (poll) instead of keeping the local count", () => {
    const drifted = elapsedAt(100, 0, 10_000);
    expect(drifted).toBe(110);
    expect(elapsedAt(108, 10_000, 10_000)).toBe(108);
  });

  it("shows the server value when the client clock went backwards", () => {
    expect(elapsedAt(60, 5_000, 1_000)).toBe(60);
  });
});

describe("isGradingSlow (AD-11)", () => {
  it("is slow from 15 s in received", () => {
    expect(SLOW_GRADING_S).toBe(15);
    expect(isGradingSlow("received", 0)).toBe(false);
    expect(isGradingSlow("received", 14)).toBe(false);
    expect(isGradingSlow("received", 15)).toBe(true);
    expect(isGradingSlow("received", 20)).toBe(true);
  });

  it("never shows the slow message for a failed grading or another status", () => {
    expect(isGradingSlow("grading_failed", 120)).toBe(false);
    expect(isGradingSlow("open", 120)).toBe(false);
    expect(isGradingSlow("graded", 120)).toBe(false);
  });
});
