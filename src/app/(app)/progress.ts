import { unstable_rethrow } from "next/navigation";
import { listProgressAttempts } from "@/adapters/supabase/attempts";
import { getSessionUser } from "@/adapters/supabase/auth";
import { listFreezes, listStreakDays } from "@/adapters/supabase/freezes";
import { readTimeZone } from "@/adapters/supabase/profiles";
import { createClient } from "@/adapters/supabase/server";
import { freezesLeft, levelProgress, streak, toGradedAttempts, type LevelProgress, type Streak } from "@/core/progress";
import { levels } from "@/content/levels";

/**
 * Server only: the session user's progress per curriculum level, derived per
 * request from their graded attempts (`listProgressAttempts`, RLS, AD-9;
 * AD-7, nothing stored) — what the Dashboard's Level Path and /levels share.
 * Without a session, the empty progress (the proxy sends those to Login).
 * `"failed"` when the database could not answer (already logged) or anything
 * threw.
 */
export async function loadProgress(): Promise<LevelProgress[] | "failed"> {
  try {
    const user = await getSessionUser();
    if (!user) return levelProgress([], levels);
    const read = await listProgressAttempts(await createClient(), user.id);
    if (!read.ok) return "failed";
    return levelProgress(toGradedAttempts(read.value), levels);
  } catch (error) {
    // Next's own interrupts (prerender, redirect) are not failures.
    unstable_rethrow(error);
    console.error(JSON.stringify({ event: "progress.load_failed", name: (error as Error)?.name ?? "unknown" }));
    return "failed";
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
