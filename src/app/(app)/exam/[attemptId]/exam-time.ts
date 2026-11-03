import type { AttemptStatus } from "../../../../adapters/supabase/attempts";

/**
 * Pure time helpers for the Exam Status Line. The server gives the seconds
 * (AD-8); the client only adds the seconds that passed on its own monotonic
 * count since the last anchor, never comparing its clock with `started_at`.
 */

/** AD-11: the slow-grading message after this long in `received`. */
export const SLOW_GRADING_S = 15;

const pad = (n: number) => String(n).padStart(2, "0");

/** `mm:ss` ("00:05", "12:34"); from one hour `h:mm:ss` ("1:02:05"). */
export function formatElapsed(seconds: number): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/**
 * Seconds to show at `nowMs`: the server's `base` at the anchor plus the
 * whole seconds since `anchorMs` (both from the same client clock). A clock
 * that went backwards shows `base`.
 */
export function elapsedAt(base: number, anchorMs: number, nowMs: number): number {
  const since = Math.floor((nowMs - anchorMs) / 1000);
  return Math.max(0, base) + (Number.isFinite(since) && since > 0 ? since : 0);
}

/** Grading is slow once the attempt has been `received` for `SLOW_GRADING_S`; never for `grading_failed`. */
export function isGradingSlow(status: AttemptStatus, secondsInReceived: number): boolean {
  return status === "received" && secondsInReceived >= SLOW_GRADING_S;
}
