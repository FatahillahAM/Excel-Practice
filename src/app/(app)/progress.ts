import { unstable_rethrow } from "next/navigation";
import { listProgressAttempts } from "@/adapters/supabase/attempts";
import { getSessionUser } from "@/adapters/supabase/auth";
import { listFreezes, listStreakDays } from "@/adapters/supabase/freezes";
import { readTimeZone } from "@/adapters/supabase/profiles";
import { createClient } from "@/adapters/supabase/server";
import {
  freezesLeft,
  isNewRecord,
  levelProgress,
  records,
  streak,
  toGradedAttempts,
  type GradedAttempt,
  type ItemRecord,
  type LevelProgress,
  type Streak,
} from "@/core/progress";
import { levels } from "@/content/levels";

/**
 * Server only: the session user's graded attempts (`listProgressAttempts`,
 * RLS, AD-9; AD-7, nothing stored), the one read progress, gates and
 * records derive from. `[]` without a session (the proxy sends those to
 * Login). `"failed"` when the database could not answer (already logged) or
 * anything threw (`progress.load_failed`).
 */
async function loadGradedAttempts(): Promise<GradedAttempt[] | "failed"> {
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
}

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

/** What /records shows: the best time per item and the progress its Practice again checks (`canStart`). */
export interface RecordsView {
  records: Map<string, ItemRecord>;
  progress: LevelProgress[];
}

/** Server only: records and progress from the same one read (no extra query). */
export async function loadRecords(): Promise<RecordsView | "failed"> {
  const attempts = await loadGradedAttempts();
  if (attempts === "failed") return "failed";
  return { records: records(attempts), progress: levelProgress(attempts, levels) };
}

/**
 * Server only: whether Results shows "New record" for `attemptId`
 * (`isNewRecord`). A failed read hides the badge (`false`): Results still
 * renders.
 */
export async function loadNewRecord(attemptId: string): Promise<boolean> {
  const attempts = await loadGradedAttempts();
  return attempts !== "failed" && isNewRecord(attempts, attemptId);
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
