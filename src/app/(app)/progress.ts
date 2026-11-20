import { cache } from "react";
import { unstable_rethrow } from "next/navigation";
import { listItemDurations, listProgressAttempts, listRecordAttempts } from "@/adapters/supabase/attempts";
import { getSessionUser } from "@/adapters/supabase/auth";
import { listFreezes, listStreakDays } from "@/adapters/supabase/freezes";
import { readTimeZone } from "@/adapters/supabase/profiles";
import { createClient } from "@/adapters/supabase/server";
import {
  bestScores,
  curriculumSummary,
  freezesLeft,
  isNewRecord,
  levelProgress,
  records,
  streak,
  toGradedAttempts,
  type CurriculumSummary,
  type GradedAttempt,
  type ItemRecord,
  type LevelProgress,
  type Streak,
} from "@/core/progress";
import { findItem, levels } from "@/content/levels";

/**
 * Server only: the session user's graded attempts (`listProgressAttempts`,
 * RLS, AD-9; AD-7, nothing stored), the one read progress, gates and
 * records derive from. `[]` without a session (the proxy sends those to
 * Login). `"failed"` when the database could not answer (already logged) or
 * anything threw (`progress.load_failed`). `cache()`: the layout and the page
 * of one request share one read.
 */
const loadGradedAttempts = cache(async (): Promise<GradedAttempt[] | "failed"> => {
  try {
    const user = await getSessionUser();
    if (!user) return [];
    const read = await listProgressAttempts(await createClient(), user.id);
    if (!read.ok) return "failed";
    return toGradedAttempts(read.value);
  } catch (error) {
    // Next's own interrupts (prerender, redirect) are not failures.
    unstable_rethrow(error);
    console.error(JSON.stringify({ event: "progress.load_failed", name: (error as Error)?.name ?? "unknown" }));
    return "failed";
  }
});

/**
 * Server only: the session user's progress per curriculum level, derived per
 * request from their graded attempts — what the Dashboard's Level Path and
 * /levels share. Without a session, the empty progress. `"failed"` as
 * `loadGradedAttempts`.
 */
export async function loadProgress(): Promise<LevelProgress[] | "failed"> {
  const attempts = await loadGradedAttempts();
  if (attempts === "failed") return "failed";
  return levelProgress(attempts, levels);
}

/**
 * Server only: the sidebar's curriculum count for the (app) layout, `null`
 * when progress failed or deriving it threw (logged `progress.load_failed`):
 * the shell always renders.
 */
export async function loadCurriculumSummary(): Promise<CurriculumSummary | null> {
  try {
    const progress = await loadProgress();
    return progress === "failed" ? null : curriculumSummary(progress);
  } catch (error) {
    unstable_rethrow(error);
    console.error(JSON.stringify({ event: "progress.load_failed", name: (error as Error)?.name ?? "unknown" }));
    return null;
  }
}

/** What /levels shows: progress, and the record time and best score per item. */
export interface LevelMapData {
  progress: LevelProgress[];
  records: Map<string, ItemRecord>;
  bestScores: Map<string, number>;
}

/**
 * Server only: the Level Map's data from ONE graded-attempts read
 * (`loadGradedAttempts`, the progress read; no time-zone read): progress,
 * `records()` and `bestScores()`. `"failed"` only when progress cannot be
 * built (the first-load alert); if deriving records or best scores throws,
 * it is logged (`progress.load_failed`) and the panel shows "—" cells.
 */
export async function loadLevelMap(): Promise<LevelMapData | "failed"> {
  const attempts = await loadGradedAttempts();
  if (attempts === "failed") return "failed";
  const progress = levelProgress(attempts, levels);
  try {
    return { progress, records: records(attempts), bestScores: bestScores(attempts) };
  } catch (error) {
    console.error(JSON.stringify({ event: "progress.load_failed", name: (error as Error)?.name ?? "unknown" }));
    return { progress, records: new Map(), bestScores: new Map() };
  }
}

/** The zone Records dates fall back to without a profile zone (as History). */
export const RECORDS_FALLBACK_ZONE = "Asia/Jakarta";

/** What /records shows: the best time per item, the progress its Practice again checks (`canStart`), and the date zone. */
export interface RecordsView {
  records: Map<string, ItemRecord>;
  progress: LevelProgress[];
  timeZone: string;
}

const validScore = (score: unknown): score is number => typeof score === "number" && Number.isInteger(score) && score >= 0 && score <= 100;

/**
 * Server only: Records from an uncapped narrow read (`listRecordAttempts`:
 * times and `result->score`, so the progress read's cap never hides a best
 * time; a row whose score is not an integer 0–100 is dropped), the progress
 * for `canStart` (`loadProgress`) and the profile's time zone (fallback
 * `RECORDS_FALLBACK_ZONE`). Record items the registry does not know are
 * logged (`records.orphan_items`, ids only). Without a session, no records.
 * `"failed"` when a read failed (already logged) or anything threw
 * (`progress.load_failed`).
 */
export async function loadRecords(): Promise<RecordsView | "failed"> {
  try {
    const user = await getSessionUser();
    if (!user) return { records: new Map(), progress: levelProgress([], levels), timeZone: RECORDS_FALLBACK_ZONE };
    const supabase = await createClient();
    const [read, progress, zone] = await Promise.all([listRecordAttempts(supabase, user.id), loadProgress(), readTimeZone(supabase, user.id)]);
    if (!read.ok || progress === "failed") return "failed";
    const attempts: GradedAttempt[] = read.value.flatMap((row) =>
      validScore(row.score) ? [{ id: row.id, itemId: row.itemId, score: row.score, startedAt: row.startedAt, receivedAt: row.receivedAt }] : [],
    );
    const best = records(attempts);
    const orphans = [...best.keys()].filter((itemId) => findItem(itemId) === null);
    if (orphans.length > 0) console.error(JSON.stringify({ event: "records.orphan_items", itemIds: orphans }));
    const timeZone = zone.ok && zone.timeZone !== null ? zone.timeZone : RECORDS_FALLBACK_ZONE;
    return { records: best, progress, timeZone };
  } catch (error) {
    unstable_rethrow(error);
    console.error(JSON.stringify({ event: "progress.load_failed", name: (error as Error)?.name ?? "unknown" }));
    return "failed";
  }
}

/**
 * Server only: whether Results shows "New record" for `attemptId` of
 * `itemId` (`isNewRecord`), from a narrow uncapped read of that item's graded
 * attempts (`listItemDurations`: ids and times only). Call it after the
 * Result loaded. A failed read hides the badge (`false`): Results still
 * renders.
 */
export async function loadNewRecord(itemId: string, attemptId: string): Promise<boolean> {
  try {
    const user = await getSessionUser();
    if (!user) return false;
    const read = await listItemDurations(await createClient(), user.id, itemId);
    if (!read.ok) return false;
    return isNewRecord(read.value.map((row) => ({ ...row, itemId, score: 0 })), attemptId);
  } catch (error) {
    unstable_rethrow(error);
    console.error(JSON.stringify({ event: "progress.load_failed", name: (error as Error)?.name ?? "unknown" }));
    return false;
  }
}

/** The Streak Hero's view: the streak and this week's freezes left, at the server's `now`. */
export interface StreakView extends Streak {
  freezesLeft: number;
}

/**
 * Server only: the session user's streak (AD-7, derived per request from
 * `streak_days`, their distinct local graded days, uncapped and with the
 * database fence's definition of a graded day, plus their `freezes`; AD-8,
 * days in `profiles.time_zone` at the server's clock). `null` without a session (the
 * proxy sends those to Login). `"failed"` when a read failed (already
 * logged), the profile has no time zone (`streak.time_zone_missing`) or
 * anything threw (an unknown zone included: `streak.load_failed`).
 */
export async function loadStreak(now: Date = new Date()): Promise<StreakView | null | "failed"> {
  try {
    const user = await getSessionUser();
    if (!user) return null;
    const supabase = await createClient();
    const [zone, days, freezes] = await Promise.all([
      readTimeZone(supabase, user.id),
      listStreakDays(supabase),
      listFreezes(supabase, user.id),
    ]);
    if (!zone.ok || !days.ok || !freezes.ok) return "failed";
    if (zone.timeZone === null) {
      console.error(JSON.stringify({ event: "streak.time_zone_missing" }));
      return "failed";
    }
    const input = { freezes: freezes.value, now, zone: zone.timeZone };
    return { ...streak({ ...input, gradedDays: days.value }), freezesLeft: freezesLeft(input) };
  } catch (error) {
    unstable_rethrow(error);
    console.error(JSON.stringify({ event: "streak.load_failed", name: (error as Error)?.name ?? "unknown" }));
    return "failed";
  }
}
