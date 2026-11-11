import {
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
import { GRADING_RESTART_AFTER_S, scheduleGrading } from "@/app/api/submissions/grading";
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
 * (`grading_requested_at`, else `received_at`) has its grading restarted:
 * after the session read proved ownership, the service role claims the
 * restart (`claim_grading_restart`, one atomic UPDATE, at most once per 15 s
 * per attempt) and only the winner schedules a run (`channel: restart`).
 * A missing service env, a lost or failed claim schedules nothing and never
 * changes the answer.
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

  if (attempt.value.status === "received") await restartIfStuck(attempt.value);

  const data: AttemptStatusData = {
    status: attempt.value.status,
    elapsedSeconds: elapsedSeconds(attempt.value.startedAt, Date.now()),
    resultId,
  };
  return json({ ok: true, data }, 200);
}

async function restartIfStuck(attempt: Attempt): Promise<void> {
  const requestedAt = attempt.gradingRequestedAt ?? attempt.receivedAt;
  if (requestedAt === null || elapsedSeconds(requestedAt, Date.now()) < GRADING_RESTART_AFTER_S) return;
  try {
    const service = createServiceClient();
    if (service === null) {
      console.error(JSON.stringify({ event: "grading.service_env_missing", attemptId: attempt.id, channel: "restart" }));
      return;
    }
    const claim = await claimGradingRestart(service, attempt.id);
    if (!claim.ok || !claim.value) return;
    scheduleGrading("restart", attempt.id);
    console.log(JSON.stringify({ event: "grading.restart_scheduled", attemptId: attempt.id }));
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "grading.restart_failed",
        attemptId: attempt.id,
        code: error instanceof Error ? error.name : typeof error,
      }),
    );
  }
}

function json(body: AttemptStatusBody, status: number): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}
