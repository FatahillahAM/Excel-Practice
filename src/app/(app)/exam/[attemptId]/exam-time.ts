import type { AttemptStatus } from "@/adapters/supabase/attempts";

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

/**
 * The base for a new anchor when a poll answers: the server's floored seconds
 * are often one behind what is shown, so a 0–1 s lag keeps the larger value
 * (the time never steps backwards); any other difference takes the server's
 * value, which stays the source of truth for real drift.
 */
export function reanchor(displayed: number, server: number): number {
  const lag = displayed - server;
  return lag === 0 || lag === 1 ? Math.max(displayed, server) : server;
}

/**
 * Milliseconds until grading counts as slow, for a `received` anchor of
 * `anchorBase` seconds taken at `anchorAt` (same client clock as `nowMs`);
 * 0 once past.
 */
export function slowGradingWaitMs(anchorBase: number, anchorAt: number, nowMs: number): number {
  return Math.max(0, (SLOW_GRADING_S - anchorBase) * 1000 - (nowMs - anchorAt));
}

/** A server value in seconds and the moment (client monotonic clock) it was taken; `at` is set after hydration. */
export type Anchor = { base: number; at: number | null };

/**
 * The new `received` anchor when the screen learns of a move to `received`
 * (a poll or an accepted upload): it counts from 0 at `nowMs`, ≤ 2 s after
 * `received_at`. `null` when nothing changes (not `received`, or already was).
 */
export function receivedAnchorOnChange(previous: AttemptStatus, next: AttemptStatus, nowMs: number): Anchor | null {
  return next === "received" && previous !== "received" ? { base: 0, at: nowMs } : null;
}
