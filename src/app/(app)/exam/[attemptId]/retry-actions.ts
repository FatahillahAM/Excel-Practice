"use server";

import { redirect } from "next/navigation";
import { changeStatus, isAttemptId, readAttempt } from "@/adapters/supabase/attempts";
import { getSessionUser } from "@/adapters/supabase/auth";
import { loginRedirectPath } from "@/adapters/supabase/auth-rules";
import { createClient } from "@/adapters/supabase/server";
import { createServiceClient } from "@/adapters/supabase/service";
import { scheduleGrading } from "@/app/api/submissions/grading";

/**
 * `retried`: the attempt moved back to `received` and its grading is
 * scheduled; `unchanged`: it was no longer `grading_failed` (another device,
 * Abandon), nothing was written and the next poll shows where it is;
 * `error`: nothing could be done now (the button comes back with a message).
 */
export type RetryState = { status: "idle" } | { status: "retried" } | { status: "unchanged" } | { status: "error" };

const FAILED = "attempt.retry_grading_failed";

/**
 * Try again on the exam screen (`grading_failed`, EXPERIENCE.md › State
 * Patterns): the session user's attempt goes back to `received` and is graded
 * again, like an accepted file. Ownership comes from the session read (RLS);
 * the session may not write that status (AD-9), so the move is the grading
 * path's service-role write, `changeStatus(…, "grading_failed",
 * "retry_grading")` (AD-5: `transition()` + one compare-and-set), and the run
 * goes through the same `scheduleGrading` as macro and upload (`channel:
 * retry`). The database stamps `grading_requested_at`; `received_at` stays
 * the first file's time (AD-8). Without a session: Login, then back to this
 * exam. A malformed id, someone else's attempt or a failure: `error`, with
 * nothing about the attempt. If scheduling throws after the move succeeded,
 * the answer is still `retried` (logged `grading.schedule_failed`): the
 * attempt is `received`, and the U4 restart grades it.
 */
export async function retryGrading(_previous: RetryState, formData: FormData): Promise<RetryState> {
  let outcome: RetryState | { redirectTo: string };
  try {
    outcome = await run(formData);
  } catch (error) {
    console.error(
      JSON.stringify({ event: FAILED, code: "threw", name: error instanceof Error ? error.name : typeof error }),
    );
    return { status: "error" };
  }
  // Outside the try: `redirect()` throws on purpose.
  if ("redirectTo" in outcome) redirect(outcome.redirectTo);
  return outcome;
}

async function run(formData: FormData): Promise<RetryState | { redirectTo: string }> {
  const attemptId = formData.get("attemptId");
  const validId = typeof attemptId === "string" && isAttemptId(attemptId) ? attemptId : null;

  const user = await getSessionUser();
  if (!user) {
    return { redirectTo: loginRedirectPath(validId === null ? "/dashboard" : `/exam/${validId}`, "") };
  }
  if (validId === null) {
    console.error(JSON.stringify({ event: FAILED, code: "bad_id" }));
    return { status: "error" };
  }

  const supabase = await createClient();
  const read = await readAttempt(supabase, validId);
  // `!ok` was logged by the adapter; `null` is an attempt that is missing or not the user's.
  if (!read.ok || read.value === null) return { status: "error" };
  if (read.value.status !== "grading_failed") return { status: "unchanged" };

  const service = createServiceClient();
  if (service === null) {
    console.error(JSON.stringify({ event: FAILED, attemptId: validId, code: "service_env_missing" }));
    return { status: "error" };
  }

  const changed = await changeStatus(service, validId, "grading_failed", "retry_grading", FAILED);
  switch (changed.outcome) {
    case "changed":
      console.log(JSON.stringify({ event: "attempt.grading_retried", attemptId: validId }));
      try {
        scheduleGrading("retry", validId);
      } catch (error) {
        // The attempt is `received` already: the status endpoint's U4 restart picks it up after 15 s.
        console.error(
          JSON.stringify({
            event: "grading.schedule_failed",
            attemptId: validId,
            channel: "retry",
            code: error instanceof Error ? error.name : typeof error,
          }),
        );
      }
      return { status: "retried" };
    case "lost":
    case "refused":
      return { status: "unchanged" };
    default:
      // `failed` was logged by the adapter with its database code.
      return { status: "error" };
  }
}
