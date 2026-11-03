import { z } from "zod";

/**
 * The attempt lifecycle (AD-5): the one state machine for `attempts.status`.
 * Adapters ask `transition()` for the next status, then write it with a
 * compare-and-set on the current status; they never pick a status themselves.
 */

export const ATTEMPT_STATUSES = ["open", "received", "graded", "grading_failed", "abandoned", "closed"] as const;

export const AttemptStatusSchema = z.enum(ATTEMPT_STATUSES);

export type AttemptStatus = z.infer<typeof AttemptStatusSchema>;

/** Start and *Practice again* insert an attempt in this status. */
export const INITIAL_STATUS: AttemptStatus = "open";

/** Statuses the partial unique index allows only once per user: an attempt in progress. */
export const IN_PROGRESS_STATUSES: readonly AttemptStatus[] = ["open", "received", "grading_failed"];

export const AttemptEvent = {
  /** A submitted file was accepted (macro or upload). */
  SUBMIT_ACCEPTED: "submit_accepted",
  /** The user abandoned the attempt. */
  ABANDON: "abandon",
  /** The time limit ran out (Ujian Akhir, Next). */
  TIME_LIMIT: "time_limit",
  /** `grade()` returned a result. */
  GRADE_OK: "grade_ok",
  /** `grade()` failed. */
  GRADE_ERROR: "grade_error",
  /** *Try again* after a grading failure. */
  RETRY_GRADING: "retry_grading",
} as const;

export type AttemptEvent = (typeof AttemptEvent)[keyof typeof AttemptEvent];

export const ATTEMPT_EVENTS: readonly AttemptEvent[] = Object.values(AttemptEvent);

export const TRANSITION_REFUSED = "TRANSITION_REFUSED";

export type TransitionResult =
  | { ok: true; to: AttemptStatus }
  | { ok: false; code: typeof TRANSITION_REFUSED };

/** Every edge of the AD-5 diagram; anything else is refused. */
const EDGES: Readonly<Record<AttemptStatus, Partial<Record<AttemptEvent, AttemptStatus>>>> = {
  open: { submit_accepted: "received", abandon: "abandoned", time_limit: "closed" },
  received: { grade_ok: "graded", grade_error: "grading_failed", abandon: "abandoned" },
  grading_failed: { abandon: "abandoned", retry_grading: "received" },
  graded: {},
  abandoned: {},
  closed: {},
};

/** The status after `event` in status `from`, or `TRANSITION_REFUSED` when the diagram has no such edge. */
export function transition(from: AttemptStatus, event: AttemptEvent): TransitionResult {
  const to = Object.hasOwn(EDGES, from) && Object.hasOwn(EDGES[from], event) ? EDGES[from][event] : undefined;
  return to ? { ok: true, to } : { ok: false, code: TRANSITION_REFUSED };
}
