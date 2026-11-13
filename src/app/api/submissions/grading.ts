import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { changeStatus, downloadSubmissionFile, loadForGrading } from "@/adapters/supabase/attempts";
import { createServiceClient } from "@/adapters/supabase/service";
import { readWorkbook } from "@/adapters/workbook/read";
import { gradeAttempt, type GradingOutcome, type GradingPorts } from "@/core/grading";
import { errorName, type ChannelKind } from "./http";

/**
 * Grading after a file is accepted (AD-11): both submission routes call
 * `scheduleGrading` (parity), which runs `gradeAttempt` (core) in `after()`,
 * once the response is sent. Ports use the service-role client (AD-9): only
 * it reads the snapshot and the submitted file, and only it writes `result`,
 * through `changeStatus` (AD-5: `transition()` + one compare-and-set on
 * `status = 'received'`).
 *
 * The exam screen's Try again (`retry`, `grading_failed` → `received`) and
 * the status endpoint's restart of a grading stuck in `received` (`restart`,
 * U4) schedule the same run; the source is logged as `channel`.
 *
 * Logs: one `grading.done` line (`attemptId`, `channel`, `outcome`, `score`),
 * plus a `grading.<reason>` error line when the attempt was not graded
 * (`grading.lost`, the attempt moved on first — Abandon, or a newer run
 * superseded this one — is an info line); never
 * file bytes, the key or a token. Nothing escapes: any throw is logged as
 * `grading.threw`.
 */

/**
 * U4: a grading still `received` this long after it was requested
 * (`grading_requested_at`) is restarted by the status endpoint, at most once
 * per attempt per this many seconds (`claim_grading_restart`, the database's
 * clock). The same 15 s as the slow-grading message (AD-11).
 */
export const GRADING_RESTART_AFTER_S = 15;

/**
 * U4: `claim_grading_restart` refuses once the current grading request was
 * restarted this many times; the status endpoint then moves the attempt
 * `received` → `grading_failed`, so the user gets Try again (which resets the
 * count).
 */
export const GRADING_RESTART_CAP = 3;

/** What asked for a grading run: a submission channel, Try again, or the U4 restart. */
export type GradingSource = ChannelKind | "retry" | "restart";

/** `gradeAttempt`'s ports on one service-role client. */
export function gradingPorts(service: SupabaseClient): GradingPorts {
  return {
    load: (attemptId) => loadForGrading(service, attemptId),
    readSubmission: (attemptId) => downloadSubmissionFile(service, attemptId, 1),
    readWorkbook: (bytes) => readWorkbook(bytes),
    complete: async (attemptId, event, result, gradingRequestedAt) => {
      const changed = await changeStatus(
        service,
        attemptId,
        "received",
        event,
        `attempt.${event}_failed`,
        result === null ? { gradingRequestedAt } : { result, gradingRequestedAt },
      );
      if (changed.outcome === "changed") return "changed";
      return changed.outcome === "failed" ? "failed" : "lost";
    },
  };
}

/** Grades the attempt and logs the outcome; never throws. */
export async function runGrading(channel: GradingSource, attemptId: string): Promise<GradingOutcome> {
  try {
    const service = createServiceClient();
    if (service === null) {
      console.error(JSON.stringify({ event: "grading.service_env_missing", attemptId, channel }));
      logDone(attemptId, channel, "failed", null);
      return "failed";
    }
    const run = await gradeAttempt(attemptId, gradingPorts(service));
    const { reason, score } = run.log;
    if (run.outcome === "lost") {
      // The attempt moved on before this run wrote (Abandon, or a newer run after Try again / a
      // restart): the result is discarded, like `skipped`. Info, not an error.
      console.log(JSON.stringify({ event: "grading.lost", attemptId, channel }));
    } else if (reason !== null && run.outcome !== "skipped") {
      console.error(JSON.stringify({ event: `grading.${reason}`, attemptId, channel }));
    }
    logDone(attemptId, channel, run.outcome, score);
    return run.outcome;
  } catch (error) {
    console.error(JSON.stringify({ event: "grading.threw", attemptId, channel, code: errorName(error) }));
    logDone(attemptId, channel, "failed", null);
    return "failed";
  }
}

/** Schedules `runGrading` after the response (`after()` from `next/server`). */
export function scheduleGrading(channel: GradingSource, attemptId: string): void {
  after(() => runGrading(channel, attemptId));
}

function logDone(attemptId: string, channel: GradingSource, outcome: GradingOutcome, score: number | null): void {
  console.log(JSON.stringify({ event: "grading.done", attemptId, channel, outcome, score }));
}
