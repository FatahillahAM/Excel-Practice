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
  | { status: "refused"; reason: "safe" | "quota_used" | "day_changed" }
  | { status: "error" };

const DASHBOARD_PATH = "/dashboard";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Use freeze (Streak Hero): freezes today for the session user through
 * `use_freeze` on their session (RLS, AD-9). The form sends `expectedDate`,
 * the day the server-rendered page showed as today; the database decides
 * "today" (the user's zone, its clock: the client never does), answers
 * `day_changed` when they differ (the page went stale over midnight) and
 * enforces every rule. `frozen` and `already_frozen` (a second quick click)
 * re-render the Dashboard as frozen today; `safe`, `quota_used` and
 * `day_changed` are refusals with a reason (the Dashboard re-renders); anything else is an error message. Without a session: Login, then
 * back to Dashboard.
 */
export async function freezeToday(formData: FormData): Promise<FreezeState> {
  let outcome: FreezeState | { redirectTo: string };
  try {
    outcome = await run(formData);
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

async function run(formData: FormData): Promise<FreezeState | { redirectTo: string }> {
  const user = await getSessionUser();
  if (!user) return { redirectTo: loginRedirectPath(DASHBOARD_PATH, "") };

  const expectedDate = formData.get("expectedDate");
  if (typeof expectedDate !== "string" || !DATE_RE.test(expectedDate)) {
    console.error(JSON.stringify({ event: "freeze.use_failed", code: "bad_date" }));
    return { status: "error" };
  }

  const answer = await spendFreeze(await createClient(), expectedDate);
  if (!answer.ok) return { status: "error" };

  switch (answer.value.code) {
    case "frozen":
    case "already_frozen":
      if (answer.value.code === "frozen") console.log(JSON.stringify({ event: "freeze.used", localDate: answer.value.localDate }));
      revalidatePath(DASHBOARD_PATH);
      return { status: "done" };
    case "safe":
    case "quota_used":
    case "day_changed":
      revalidatePath(DASHBOARD_PATH);
      return { status: "refused", reason: answer.value.code };
    default:
      console.error(JSON.stringify({ event: "freeze.use_failed", code: answer.value.code }));
      return { status: "error" };
  }
}
