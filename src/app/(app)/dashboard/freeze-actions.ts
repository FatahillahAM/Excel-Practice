"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/adapters/supabase/auth";
import { loginRedirectPath } from "@/adapters/supabase/auth-rules";
import { spendFreeze } from "@/adapters/supabase/freezes";
import { createClient } from "@/adapters/supabase/server";

export type FreezeState =
  | { status: "idle" }
  | { status: "done" }
  | { status: "refused"; reason: "safe" | "quota_used" }
  | { status: "error" };

const DASHBOARD_PATH = "/dashboard";

/**
 * Use freeze (Streak Hero): freezes today for the session user through
 * `use_freeze` on their session (RLS, AD-9). The database decides "today"
 * (the user's zone, its clock: the client never does) and enforces every
 * rule. `frozen` and `already_frozen` (a second quick click) re-render the
 * Dashboard as frozen today; `safe` and `quota_used` are refusals with a
 * reason; anything else is an error message. Without a session: Login, then
 * back to Dashboard.
 */
export async function freezeToday(): Promise<FreezeState> {
  let outcome: FreezeState | { redirectTo: string };
  try {
    outcome = await run();
  } catch (error) {
    console.error(
      JSON.stringify({ event: "freeze.use_failed", code: "threw", name: error instanceof Error ? error.name : typeof error }),
    );
    return { status: "error" };
  }
  // Outside the try: `redirect()` throws on purpose.
  if ("redirectTo" in outcome) redirect(outcome.redirectTo);
  return outcome;
}

async function run(): Promise<FreezeState | { redirectTo: string }> {
  const user = await getSessionUser();
  if (!user) return { redirectTo: loginRedirectPath(DASHBOARD_PATH, "") };

  const answer = await spendFreeze(await createClient());
  if (!answer.ok) return { status: "error" };

  switch (answer.value.code) {
    case "frozen":
    case "already_frozen":
      if (answer.value.code === "frozen") console.log(JSON.stringify({ event: "freeze.used", localDate: answer.value.localDate }));
      revalidatePath(DASHBOARD_PATH);
      return { status: "done" };
    case "safe":
    case "quota_used":
      revalidatePath(DASHBOARD_PATH);
      return { status: "refused", reason: answer.value.code };
    default:
      console.error(JSON.stringify({ event: "freeze.use_failed", code: answer.value.code }));
      return { status: "error" };
  }
}
