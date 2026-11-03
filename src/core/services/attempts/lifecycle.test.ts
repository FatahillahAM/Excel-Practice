import { describe, expect, it } from "vitest";
import {
  ATTEMPT_EVENTS,
  ATTEMPT_STATUSES,
  AttemptStatusSchema,
  IN_PROGRESS_STATUSES,
  INITIAL_STATUS,
  transition,
  type AttemptEvent,
  type AttemptStatus,
} from "./index";

/** The AD-5 diagram, written out independently of the implementation's table. */
const ALLOWED: [AttemptStatus, AttemptEvent, AttemptStatus][] = [
  ["open", "submit_accepted", "received"],
  ["open", "abandon", "abandoned"],
  ["open", "time_limit", "closed"],
  ["received", "grade_ok", "graded"],
  ["received", "grade_error", "grading_failed"],
  ["received", "abandon", "abandoned"],
  ["grading_failed", "abandon", "abandoned"],
  ["grading_failed", "retry_grading", "received"],
];

describe("attempt lifecycle (AD-5)", () => {
  it("knows the six statuses and six events", () => {
    expect([...ATTEMPT_STATUSES].sort()).toEqual(
      ["abandoned", "closed", "graded", "grading_failed", "open", "received"],
    );
    expect([...ATTEMPT_EVENTS].sort()).toEqual(
      ["abandon", "grade_error", "grade_ok", "retry_grading", "submit_accepted", "time_limit"],
    );
    expect(INITIAL_STATUS).toBe("open");
    expect(IN_PROGRESS_STATUSES).toEqual(["open", "received", "grading_failed"]);
    expect(AttemptStatusSchema.safeParse("graded").success).toBe(true);
    expect(AttemptStatusSchema.safeParse("pending").success).toBe(false);
  });

  it.each(ALLOWED)("%s --%s--> %s", (from, event, to) => {
    expect(transition(from, event)).toEqual({ ok: true, to });
  });

  const refused = ATTEMPT_STATUSES.flatMap((from) =>
    ATTEMPT_EVENTS.filter((event) => !ALLOWED.some(([f, e]) => f === from && e === event)).map(
      (event) => [from, event] as const,
    ),
  );

  it("refuses every other pair (28 of 36)", () => {
    expect(ALLOWED.length + refused.length).toBe(36);
    expect(refused).toHaveLength(28);
  });

  it.each(refused)("refuses %s --%s-->", (from, event) => {
    expect(transition(from, event)).toEqual({ ok: false, code: "TRANSITION_REFUSED" });
  });

  it("refuses values outside the enums (prototype keys included)", () => {
    expect(transition("toString" as AttemptStatus, "abandon")).toEqual({ ok: false, code: "TRANSITION_REFUSED" });
    expect(transition("open", "constructor" as AttemptEvent)).toEqual({ ok: false, code: "TRANSITION_REFUSED" });
  });
});
