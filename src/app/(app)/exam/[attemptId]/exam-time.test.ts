import { describe, expect, it } from "vitest";
import {
  SLOW_GRADING_S,
  elapsedAt,
  formatElapsed,
  isGradingSlow,
  reanchor,
  receivedAnchorOnChange,
  slowGradingWaitMs,
} from "./exam-time";

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

describe("reanchor", () => {
  it("takes the server value when the server is ahead", () => {
    expect(reanchor(754, 756)).toBe(756);
  });

  it("keeps the shown value when the server is 0–1 s behind, so the time never steps back", () => {
    expect(reanchor(755, 755)).toBe(755);
    expect(reanchor(755, 754)).toBe(755);
  });

  it("takes the server value for real drift", () => {
    expect(reanchor(760, 755)).toBe(755);
  });
});

describe("slowGradingWaitMs", () => {
  it("waits the full 15 s for a fresh anchor", () => {
    expect(slowGradingWaitMs(0, 1_000, 1_000)).toBe(15_000);
  });

  it("waits the rest when the server already counted 10 s", () => {
    expect(slowGradingWaitMs(10, 1_000, 1_000)).toBe(5_000);
    expect(slowGradingWaitMs(10, 1_000, 3_000)).toBe(3_000);
  });

  it("is 0 once past", () => {
    expect(slowGradingWaitMs(20, 1_000, 1_000)).toBe(0);
    expect(slowGradingWaitMs(0, 0, 16_000)).toBe(0);
  });
});

describe("receivedAnchorOnChange", () => {
  it("counts from 0 now when the attempt moves to received", () => {
    expect(receivedAnchorOnChange("open", "received", 5_000)).toEqual({ base: 0, at: 5_000 });
    expect(receivedAnchorOnChange("grading_failed", "received", 7)).toEqual({ base: 0, at: 7 });
  });

  it("changes nothing when it already was received, or moves elsewhere", () => {
    expect(receivedAnchorOnChange("received", "received", 5_000)).toBeNull();
    expect(receivedAnchorOnChange("open", "grading_failed", 5_000)).toBeNull();
    expect(receivedAnchorOnChange("received", "graded", 5_000)).toBeNull();
    expect(receivedAnchorOnChange("open", "open", 5_000)).toBeNull();
  });
});
