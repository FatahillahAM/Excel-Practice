import { attemptDurationSeconds } from "@/core/services/attempts/elapsed";
import type { GradedAttempt } from "./level-progress";

/**
 * Records (CAP-11, AD-7): the best time per item, derived per request from
 * the graded attempts (`toGradedAttempts`), never stored. A practice and a
 * Test are different items, so they hold separate records. Any score counts
 * (Practice again and a failed Test too). The time is `received_at −
 * started_at` in whole seconds (`attemptDurationSeconds`, the Results time);
 * an attempt without one is ignored.
 */

/** The best attempt of one item. */
export interface ItemRecord {
  itemId: string;
  attemptId: string;
  seconds: number;
  /** When that attempt was received (the Records date). */
  receivedAt: string;
  score: number;
}

type Timed = { attempt: GradedAttempt; seconds: number; at: number };

function timed(attempt: GradedAttempt): Timed | null {
  const seconds = attemptDurationSeconds(attempt.startedAt, attempt.receivedAt);
  if (seconds === null || attempt.receivedAt === null) return null;
  return { attempt, seconds, at: Date.parse(attempt.receivedAt) };
}

/** History order: `received_at`, then `id` on a tie. */
function earlier(a: Timed, b: Timed): number {
  if (a.at !== b.at) return a.at - b.at;
  return a.attempt.id < b.attempt.id ? -1 : a.attempt.id > b.attempt.id ? 1 : 0;
}

/**
 * The record of every item with a timed graded attempt. On a tie the earlier
 * attempt keeps the record (a tie is not a new record).
 */
export function records(attempts: readonly GradedAttempt[]): Map<string, ItemRecord> {
  const ordered = attempts.map(timed).filter((entry): entry is Timed => entry !== null).sort(earlier);
  const best = new Map<string, ItemRecord>();
  for (const { attempt, seconds } of ordered) {
    const current = best.get(attempt.itemId);
    if (current && current.seconds <= seconds) continue;
    best.set(attempt.itemId, {
      itemId: attempt.itemId,
      attemptId: attempt.id,
      seconds,
      receivedAt: attempt.receivedAt as string,
      score: attempt.score,
    });
  }
  return best;
}

/**
 * "New record" on Results: `attemptId` is strictly faster than every earlier
 * timed graded attempt of the same item ("earlier" by `received_at`, then
 * `id`, so an old Results still shows what was true then). The first attempt
 * of an item, a tie, an unknown id and an untimed attempt are never one.
 */
export function isNewRecord(attempts: readonly GradedAttempt[], attemptId: string): boolean {
  const all = attempts.map(timed).filter((entry): entry is Timed => entry !== null);
  const target = all.find((entry) => entry.attempt.id === attemptId);
  if (!target) return false;
  const before = all.filter((entry) => entry.attempt.itemId === target.attempt.itemId && earlier(entry, target) < 0);
  if (before.length === 0) return false;
  return before.every((entry) => target.seconds < entry.seconds);
}

/** The best score per item over graded attempts (any score, timed or not): the panel's "Best" column. */
export function bestScores(attempts: readonly GradedAttempt[]): Map<string, number> {
  const best = new Map<string, number>();
  for (const attempt of attempts) {
    const current = best.get(attempt.itemId);
    if (current === undefined || attempt.score > current) best.set(attempt.itemId, attempt.score);
  }
  return best;
}
