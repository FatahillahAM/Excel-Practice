/**
 * Whole seconds from a server timestamp to `nowMs` (AD-8: durations are
 * measured from server time, never on a client). Rounded down, never
 * negative; an ISO string that does not parse gives 0. One formula for the
 * status endpoint and the exam page.
 */
export function elapsedSeconds(fromIso: string, nowMs: number): number {
  const from = Date.parse(fromIso);
  if (Number.isNaN(from) || !Number.isFinite(nowMs)) return 0;
  return Math.max(0, Math.floor((nowMs - from) / 1000));
}

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
 * How long a finished attempt took: whole seconds from `started_at` to
 * `received_at` (AD-8: both are server timestamps), rounded down. `null` when
 * either is missing or does not parse, or when the end is before the start.
 */
export function attemptDurationSeconds(startedAt: string | null | undefined, receivedAt: string | null | undefined): number | null {
  if (typeof startedAt !== "string" || typeof receivedAt !== "string") return null;
  const from = Date.parse(startedAt);
  const to = Date.parse(receivedAt);
  if (Number.isNaN(from) || Number.isNaN(to) || to < from) return null;
  return Math.floor((to - from) / 1000);
}
