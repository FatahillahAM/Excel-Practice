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
 * Logs: one `grading.done` line (`attemptId`, `channel`, `outcome`, `score`),
 * plus a `grading.<reason>` error line when the attempt was not graded; never
 * file bytes, the key or a token. Nothing escapes: any throw is logged as
 * `grading.threw`.
 */

/** `gradeAttempt`'s ports on one service-role client. */
export function gradingPorts(service: SupabaseClient): GradingPorts {
  return {
    load: (attemptId) => loadForGrading(service, attemptId),
    readSubmission: (attemptId) => downloadSubmissionFile(service, attemptId, 1),
    readWorkbook: (bytes) => readWorkbook(bytes),
    complete: async (attemptId, event, result) => {
      const changed = await changeStatus(
        service,
        attemptId,
        "received",
        event,
        `attempt.${event}_failed`,
        result === null ? {} : { result },
      );
      if (changed.outcome === "changed") return "changed";
      return changed.outcome === "failed" ? "failed" : "lost";
    },
  };
}

/** Grades the attempt and logs the outcome; never throws. */
export async function runGrading(channel: ChannelKind, attemptId: string): Promise<GradingOutcome> {
  try {
    const service = createServiceClient();
    if (service === null) {
      console.error(JSON.stringify({ event: "grading.service_env_missing", attemptId, channel }));
      logDone(attemptId, channel, "failed", null);
      return "failed";
    }
    const run = await gradeAttempt(attemptId, gradingPorts(service), { hintsUsed: 0 });
    const { reason, score } = run.log;
    if (reason !== null && run.outcome !== "skipped") {
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
export function scheduleGrading(channel: ChannelKind, attemptId: string): void {
  after(() => runGrading(channel, attemptId));
}

function logDone(attemptId: string, channel: ChannelKind, outcome: GradingOutcome, score: number | null): void {
  console.log(JSON.stringify({ event: "grading.done", attemptId, channel, outcome, score }));
}
