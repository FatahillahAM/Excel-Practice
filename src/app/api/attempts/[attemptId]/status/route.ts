import {
  changeStatus,
  claimGradingRestart,
  hasValidResult,
  readAttempt,
  type Attempt,
  type AttemptStatus,
} from "@/adapters/supabase/attempts";
import { getSessionUser } from "@/adapters/supabase/auth";
import { UNAUTHENTICATED } from "@/adapters/supabase/auth-rules";
import { createClient } from "@/adapters/supabase/server";
import { createServiceClient } from "@/adapters/supabase/service";
import { GRADING_RESTART_AFTER_S, GRADING_RESTART_CAP, scheduleGrading } from "@/app/api/submissions/grading";
import { elapsedSeconds } from "@/core/services/attempts";

export interface AttemptStatusData {
  status: AttemptStatus;
  /** Server time since Start (AD-8), whole seconds. */
  elapsedSeconds: number;
  /** The Result to move to (`/results/<resultId>`): the attempt id once it is `graded` with a stored Result that passes `resultSchema`, else `null`. */
  resultId: string | null;
}

export type AttemptStatusBody = { ok: true; data: AttemptStatusData } | { ok: false; code: string };

/**
 * `GET /api/attempts/<attemptId>/status` (AD-11): what the exam screen polls
 * every 2 s. Through the user's session; someone else's attempt is
 * `NOT_FOUND`. Once `graded`, the Result's id is the attempt's id, given only
 * when the stored Result is there and passes `resultSchema` (a row graded by
 * SQL before results existed has none). Never cached.
 *
 * U4: an attempt still `received` 15 s after its grading was requested
 * (`grading_requested_at`, else `received_at`; checked on the app clock
 * first, so the database is asked only then) has its grading restarted:
 * after the session read proved ownership, the service role claims the
 * restart (`claim_grading_restart`, one atomic UPDATE, at most once per 15 s
 * per attempt) and only the winner schedules a run (`channel: restart`).
 * Restart cap: at most `GRADING_RESTART_CAP` (3) restarts per grading
 * request (the database counts them in `grading_restarts`; Try again resets
 * the count). An attempt already restarted 3 times and still `received` 15 s
 * after the last one is moved `received` → `grading_failed` by the service
 * role (the grading path's compare-and-set, also on the stamp read), logged
 * `grading.restart_cap_reached`, and answered as `grading_failed`, so the
 * screen offers Try again. A missing service env (logged once per process),
 * a lost or failed claim or escalation schedules nothing and never changes
 * the answer.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ attemptId: string }> }): Promise<Response> {
  const { attemptId } = await params;
  const user = await getSessionUser();
  if (!user) return json({ ok: false, code: UNAUTHENTICATED }, 401);

  const supabase = await createClient();
  const attempt = await readAttempt(supabase, attemptId);
  if (!attempt.ok) return json({ ok: false, code: "INTERNAL_ERROR" }, 500);
  if (attempt.value === null) return json({ ok: false, code: "NOT_FOUND" }, 404);

  let resultId: string | null = null;
  if (attempt.value.status === "graded") {
    const valid = await hasValidResult(supabase, attempt.value.id);
    if (!valid.ok) return json({ ok: false, code: "INTERNAL_ERROR" }, 500);
    resultId = valid.value ? attempt.value.id : null;
  }

  let status = attempt.value.status;
  if (status === "received") status = await restartIfStuck(attempt.value);

  const data: AttemptStatusData = {
    status,
    elapsedSeconds: elapsedSeconds(attempt.value.startedAt, Date.now()),
    resultId,
  };
  return json({ ok: true, data }, 200);
}

/** `grading.service_env_missing` is logged once per process, not on every poll. */
let serviceEnvMissingLogged = false;

/** U4 for a `received` attempt; the status to answer (`grading_failed` once escalated at the cap). */
async function restartIfStuck(attempt: Attempt): Promise<AttemptStatus> {
  const requestedAt = attempt.gradingRequestedAt ?? attempt.receivedAt;
  if (requestedAt === null || elapsedSeconds(requestedAt, Date.now()) < GRADING_RESTART_AFTER_S) return "received";
  try {
    const service = createServiceClient();
    if (service === null) {
      if (!serviceEnvMissingLogged) {
        serviceEnvMissingLogged = true;
        console.error(JSON.stringify({ event: "grading.service_env_missing", attemptId: attempt.id, channel: "restart" }));
      }
      return "received";
    }
    if (attempt.gradingRestarts >= GRADING_RESTART_CAP) {
      const failed = await changeStatus(service, attempt.id, "received", "grade_error", "grading.restart_cap_failed", {
        gradingRequestedAt: attempt.gradingRequestedAt,
      });
      if (failed.outcome !== "changed") return "received";
      console.error(
        JSON.stringify({ event: "grading.restart_cap_reached", attemptId: attempt.id, restarts: attempt.gradingRestarts }),
      );
      return "grading_failed";
    }
    const claim = await claimGradingRestart(service, attempt.id);
    if (!claim.ok || !claim.value) return "received";
    scheduleGrading("restart", attempt.id);
    console.log(JSON.stringify({ event: "grading.restart_scheduled", attemptId: attempt.id }));
    return "received";
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "grading.restart_failed",
        attemptId: attempt.id,
        code: error instanceof Error ? error.name : typeof error,
      }),
    );
    return "received";
  }
}

function json(body: AttemptStatusBody, status: number): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}
