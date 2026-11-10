import { examSnapshotSchema, type ExamSnapshot } from "../content/level-module";
import { AttemptEvent, type AttemptStatus } from "../services/attempts";
import type { PortRead } from "../submission";
import { grade } from "./grade";
import type { Result } from "./result";
import type { WorkbookReading } from "./workbook-reading";

/**
 * `gradeAttempt(attemptId, ports, { hintsUsed })`: the grading use case the
 * submission routes schedule after a file is accepted (AD-11). It loads the
 * attempt, and only while it is `received`: validates the stored snapshot,
 * reads `submission-1`, grades it, and asks `complete` to write `graded` +
 * the `Result` (`grade_ok`) or `grading_failed` (`grade_error`), which the
 * adapter does through `transition()` with one compare-and-set on
 * `status = 'received'` (AD-5).
 *
 * | Case                                                  | Write          | Outcome          |
 * |-------------------------------------------------------|----------------|------------------|
 * | graded                                                | `grade_ok`     | `graded`         |
 * | snapshot null or invalid; file unreadable; `grade()` throws | `grade_error` | `grading_failed` |
 * | attempt missing or no longer `received`               | none           | `skipped`        |
 * | compare-and-set matched no row (Abandon came first)   | (discarded)    | `lost`           |
 * | the store could not answer (read or write)            | none           | `failed`         |
 * | `submission-1` missing (`file_missing`)               | none           | `failed`         |
 *
 * A store fault leaves the attempt `received` (entry 3 restarts it). So does
 * a missing `submission-1`: the attempt is `received` only after its file was
 * stored, so a missing object is a storage fault worth retrying, not a bad
 * file. `file_unreadable` is a file that exists but is no workbook. The log
 * carries no file bytes, key or token.
 */

export interface GradingAttempt {
  status: AttemptStatus;
  /** `attempts.snapshot` as stored: validated here, never trusted. */
  snapshot: unknown;
}

/** What `complete` did: `changed` (written), `lost` (the status moved first), `failed` (store fault). */
export type CompleteOutcome = "changed" | "lost" | "failed";

export interface GradingPorts {
  /** The attempt's status and snapshot (service role); `null` when there is no such attempt. */
  load(attemptId: string): Promise<PortRead<GradingAttempt | null>>;
  /** The bytes of `submission-1`; `null` when the file does not exist. */
  readSubmission(attemptId: string): Promise<PortRead<Uint8Array | null>>;
  /** WorkbookIO (AD-4); throws when the bytes are not a readable workbook. */
  readWorkbook(bytes: Uint8Array): Promise<WorkbookReading>;
  /** `received` → `graded` with `result`, or → `grading_failed` (`result` null), in one compare-and-set. */
  complete(
    attemptId: string,
    event: typeof AttemptEvent.GRADE_OK | typeof AttemptEvent.GRADE_ERROR,
    result: Result | null,
  ): Promise<CompleteOutcome>;
}

export type GradingOutcome = "graded" | "grading_failed" | "skipped" | "lost" | "failed";

/** Why the attempt was not graded, as the `grading.<reason>` log event. */
export type GradingReason =
  | "snapshot_invalid"
  | "file_missing"
  | "file_unreadable"
  | "grade_threw"
  | "not_received"
  | "not_found"
  | "load_failed"
  | "file_read_failed"
  | "write_failed"
  | "lost";

export interface GradingLog {
  attemptId: string;
  outcome: GradingOutcome;
  /** The score written, when graded. */
  score: number | null;
  reason: GradingReason | null;
}

export interface GradingRun {
  outcome: GradingOutcome;
  log: GradingLog;
}

export async function gradeAttempt(
  attemptId: string,
  ports: GradingPorts,
  options: { hintsUsed: number },
): Promise<GradingRun> {
  const done = (outcome: GradingOutcome, reason: GradingReason | null, score: number | null = null): GradingRun => ({
    outcome,
    log: { attemptId, outcome, score, reason },
  });

  const loaded = await ports.load(attemptId);
  if (!loaded.ok) return done("failed", "load_failed");
  if (loaded.value === null) return done("skipped", "not_found");
  // A duplicate Finish, Abandon, or an attempt already graded: nothing to do.
  if (loaded.value.status !== "received") return done("skipped", "not_received");

  const fail = async (reason: GradingReason): Promise<GradingRun> => {
    const written = await ports.complete(attemptId, AttemptEvent.GRADE_ERROR, null);
    if (written === "changed") return done("grading_failed", reason);
    return written === "lost" ? done("lost", "lost") : done("failed", "write_failed");
  };

  const parsed = examSnapshotSchema.safeParse(loaded.value.snapshot);
  if (!parsed.success) return fail("snapshot_invalid");
  const snapshot: ExamSnapshot = parsed.data;

  const file = await ports.readSubmission(attemptId);
  if (!file.ok) return done("failed", "file_read_failed");
  // The file was stored before `received`: its absence is a fault to retry, not a terminal failure.
  if (file.value === null) return done("failed", "file_missing");

  let reading: WorkbookReading;
  try {
    reading = await ports.readWorkbook(file.value);
  } catch {
    return fail("file_unreadable");
  }

  let result: Result;
  try {
    result = grade(snapshot, reading, options.hintsUsed);
  } catch {
    return fail("grade_threw");
  }

  const written = await ports.complete(attemptId, AttemptEvent.GRADE_OK, result);
  if (written === "changed") return done("graded", null, result.score);
  return written === "lost" ? done("lost", "lost") : done("failed", "write_failed");
}
