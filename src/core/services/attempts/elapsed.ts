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
