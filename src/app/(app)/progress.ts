import { unstable_rethrow } from "next/navigation";
import { listProgressAttempts } from "@/adapters/supabase/attempts";
import { getSessionUser } from "@/adapters/supabase/auth";
import { createClient } from "@/adapters/supabase/server";
import { levelProgress, toGradedAttempts, type LevelProgress } from "@/core/progress";
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
