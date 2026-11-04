"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { abandon, isAttemptId, type AbandonResult } from "../../../adapters/supabase/attempts";
import { getSessionUser } from "../../../adapters/supabase/auth";
import { loginRedirectPath } from "../../../adapters/supabase/auth-rules";
import { createClient } from "../../../adapters/supabase/server";

export type AbandonState = { status: "idle" } | { status: "done" } | { status: "error" };

const DASHBOARD_PATH = "/dashboard";
const LEVELS_PATH = "/levels";

/**
 * Abandon (Attempt Card's dialog): the session user's attempt moves to
 * `abandoned` only through `abandon()` → `changeStatus` → `transition(from,
 * "abandon")` (AD-5), on their session (RLS, AD-9). A `lost` compare-and-set
 * (Finish moved `open` → `received` between the read and the write) is
 * retried once from the new status. `changed`, `refused` (already graded or
 * abandoned elsewhere) and `not_found` re-render Dashboard and /levels:
 * either way the card is gone. `failed`, a second `lost` or a throw keep the
 * card and show the message in the dialog. Without a session: Login, then
 * back to Dashboard.
 */
export async function abandonAttempt(_previous: AbandonState, formData: FormData): Promise<AbandonState> {
  let outcome: AbandonState | { redirectTo: string };
  try {
    outcome = await run(formData);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "attempt.abandon_failed",
        code: "threw",
        name: error instanceof Error ? error.name : typeof error,
      }),
    );
    return { status: "error" };
  }
  // Outside the try: `redirect()` throws on purpose.
  if ("redirectTo" in outcome) redirect(outcome.redirectTo);
  return outcome;
}

async function run(formData: FormData): Promise<AbandonState | { redirectTo: string }> {
  const user = await getSessionUser();
  if (!user) return { redirectTo: loginRedirectPath(DASHBOARD_PATH, "") };

  const attemptId = formData.get("attemptId");
  if (typeof attemptId !== "string" || !isAttemptId(attemptId)) {
    console.error(JSON.stringify({ event: "attempt.abandon_failed", code: "bad_id" }));
    return { status: "error" };
  }

  const supabase = await createClient();
  let result: AbandonResult = await abandon(supabase, attemptId);
  if (result.outcome === "lost") result = await abandon(supabase, attemptId);

  switch (result.outcome) {
    case "changed":
    case "refused":
    case "not_found":
      if (result.outcome === "changed") console.log(JSON.stringify({ event: "attempt.abandoned", attemptId }));
      revalidatePath(DASHBOARD_PATH);
      revalidatePath(LEVELS_PATH);
      return { status: "done" };
    default:
      // `failed` was logged by the adapter with its database code; the event ties it to the attempt.
      console.error(JSON.stringify({ event: "attempt.abandon_failed", attemptId, code: result.outcome }));
      return { status: "error" };
  }
}
