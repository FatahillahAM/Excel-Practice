import type { SupabaseClient } from "@supabase/supabase-js";
import { IN_PROGRESS_STATUSES, transition, type AttemptEvent, type AttemptStatus } from "../../core/services/attempts";

/**
 * `attempts` and the `attempt-files` bucket (migration `20261102000001`).
 *
 * Session functions take the user's client (`server.ts`), so RLS keeps every
 * read and write to the owner's rows and files. `findAttemptByTokenHash` and
 * `markReceived` take the service-role client (`service.ts`) and exist only for
 * the macro path (AD-9); `storeSubmissionFile` takes either. Every status change asks the core state machine
 * (`core/services/attempts`, AD-5) for the next status, then writes it with a
 * compare-and-set on the current status (`changeStatus`).
 *
 * Log lines carry an event and the database error code: never tokens or hashes.
 */

// The lifecycle types live in core (AD-5); re-exported for existing callers.
export { IN_PROGRESS_STATUSES } from "../../core/services/attempts";
export type { AttemptEvent, AttemptStatus } from "../../core/services/attempts";

export interface Attempt {
  id: string;
  itemId: string;
  status: AttemptStatus;
  templateVersion: number;
  /** ISO 8601, set by the database. */
  startedAt: string;
  receivedAt: string | null;
}

/** What the macro path needs of an attempt found by its token hash. */
export interface AttemptIdentity {
  id: string;
  status: AttemptStatus;
  templateVersion: number;
}

/** A read that can fail: `ok: false` when the database could not answer (already logged). */
export type Read<T> = { ok: true; value: T } | { ok: false };

/**
 * A status change: `changed` (the row moved to `status`); `refused` (AD-5 has
 * no such edge, nothing was written); `lost` (the compare-and-set matched no
 * row: the status changed first, or RLS hides the row; read it again);
 * `failed` (the database could not answer, already logged).
 */
export type ChangeStatusResult =
  | { outcome: "changed"; status: AttemptStatus }
  | { outcome: "refused" | "lost" | "failed" };

/** Abandon: a status change, or `not_found` when the attempt does not exist or is not the user's. */
export type AbandonResult = ChangeStatusResult | { outcome: "not_found" };

export type CreateAttemptResult =
  | { ok: true; id: string }
  | { ok: false; reason: "open_attempt_exists" | "failed" };

export const ATTEMPT_FILES_BUCKET = "attempt-files";
export const XLSM_CONTENT_TYPE = "application/vnd.ms-excel.sheet.macroEnabled.12";

const TABLE = "attempts";
const UNIQUE_VIOLATION = "23505";
/** The partial unique index on attempts in progress (migration 20261102000001). */
const IN_PROGRESS_INDEX = "attempts_one_in_progress_idx";
const ATTEMPT_COLUMNS = "id, item_id, status, template_version, started_at, received_at";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `attempt-files/<attemptId>/generated.xlsm` (Consistency Conventions › Storage paths). */
export function generatedFilePath(attemptId: string): string {
  return `${attemptId}/generated.xlsm`;
}

/**
 * `attempt-files/<attemptId>/submission-<n>.xlsm` (Consistency Conventions ›
 * Storage paths): `n` from 1; the first accepted file is the one graded.
 */
export function submissionFilePath(attemptId: string, n: number): string {
  if (!Number.isInteger(n) || n < 1) throw new Error("Submission number must be a positive integer");
  return `${attemptId}/submission-${n}.xlsm`;
}

/** Whether a route segment can be an attempt id (a malformed uuid would make Postgres raise). */
export function isAttemptId(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Start's insert, through the user's session: only the item, the token hash
 * and the template version (`user_id`, `status`, `started_at` are defaults).
 * The partial unique index refuses a second attempt in progress:
 * `open_attempt_exists`.
 */
export async function createAttempt(
  supabase: SupabaseClient,
  attempt: { itemId: string; tokenSha256: string; templateVersion: number },
): Promise<CreateAttemptResult> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .insert({ item_id: attempt.itemId, token_sha256: attempt.tokenSha256, template_version: attempt.templateVersion })
      .select("id")
      .single();
    if (error) {
      const names = `${error.message ?? ""} ${(error as { details?: string }).details ?? ""}`;
      if (error.code === UNIQUE_VIOLATION && names.includes(IN_PROGRESS_INDEX)) {
        return { ok: false, reason: "open_attempt_exists" };
      }
      logError("attempt.create_failed", error.code);
      return { ok: false, reason: "failed" };
    }
    const id = (data as { id?: unknown } | null)?.id;
    if (typeof id !== "string") {
      logError("attempt.create_failed", "no_id");
      return { ok: false, reason: "failed" };
    }
    return { ok: true, id };
  } catch (error) {
    logError("attempt.create_failed", errorName(error));
    return { ok: false, reason: "failed" };
  }
}

/**
 * Start's compensation when the file could not be stored: deletes the attempt
 * while it is still `open`. `true` only when exactly that one row was deleted.
 */
export async function deleteOpenAttempt(supabase: SupabaseClient, attemptId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.from(TABLE).delete().eq("id", attemptId).eq("status", "open").select("id");
    if (!error) {
      if (Array.isArray(data) && data.length === 1) return true;
      logError("attempt.delete_failed", "no_row");
      return false;
    }
    logError("attempt.delete_failed", error.code);
  } catch (error) {
    logError("attempt.delete_failed", errorName(error));
  }
  return false;
}

/** The user's attempt in progress (`open`, `received`, `grading_failed`), if any. */
export async function findOpenAttemptId(supabase: SupabaseClient, userId: string): Promise<Read<string | null>> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("id")
      .eq("user_id", userId)
      .in("status", [...IN_PROGRESS_STATUSES])
      .maybeSingle();
    if (error) {
      logError("attempt.find_open_failed", error.code);
      return { ok: false };
    }
    const id = (data as { id?: unknown } | null)?.id;
    return { ok: true, value: typeof id === "string" ? id : null };
  } catch (error) {
    logError("attempt.find_open_failed", errorName(error));
    return { ok: false };
  }
}

/** One attempt through the user's session (RLS: owner only); `null` when it does not exist or is not theirs. */
export async function readAttempt(supabase: SupabaseClient, attemptId: string): Promise<Read<Attempt | null>> {
  if (!isAttemptId(attemptId)) return { ok: true, value: null };
  try {
    const { data, error } = await supabase.from(TABLE).select(ATTEMPT_COLUMNS).eq("id", attemptId).maybeSingle();
    if (error) {
      logError("attempt.read_failed", error.code);
      return { ok: false };
    }
    return { ok: true, value: data ? toAttempt(data as AttemptRow) : null };
  } catch (error) {
    logError("attempt.read_failed", errorName(error));
    return { ok: false };
  }
}

/** Stores the generated workbook once (`upsert: false`), through the user's session (Storage RLS). */
export async function uploadGeneratedFile(supabase: SupabaseClient, attemptId: string, bytes: Uint8Array): Promise<boolean> {
  try {
    const { error } = await supabase.storage
      .from(ATTEMPT_FILES_BUCKET)
      .upload(generatedFilePath(attemptId), bytes, { contentType: XLSM_CONTENT_TYPE, upsert: false });
    if (!error) return true;
    logError("attempt.upload_failed", storageErrorCode(error));
  } catch (error) {
    logError("attempt.upload_failed", errorName(error));
  }
  return false;
}

/**
 * Stores a submitted workbook once (`upsert: false`, the pattern of
 * `uploadGeneratedFile`): `stored`; `exists` when the object is already there
 * (an earlier post stored it; it is never replaced); `failed` otherwise
 * (logged). The macro path passes the service-role client, which bypasses
 * Storage RLS; upload (entry 5) passes the user's session.
 */
export async function storeSubmissionFile(
  client: SupabaseClient,
  attemptId: string,
  n: number,
  bytes: Uint8Array,
): Promise<"stored" | "exists" | "failed"> {
  try {
    const { error } = await client.storage
      .from(ATTEMPT_FILES_BUCKET)
      .upload(submissionFilePath(attemptId, n), bytes, { contentType: XLSM_CONTENT_TYPE, upsert: false });
    if (!error) return "stored";
    if (isAlreadyExists(error)) return "exists";
    logError("attempt.submission_store_failed", storageErrorCode(error));
  } catch (error) {
    logError("attempt.submission_store_failed", errorName(error));
  }
  return "failed";
}

/** The stored generated workbook's bytes, through the user's session; `null` when it cannot be read. */
export async function downloadGeneratedFile(supabase: SupabaseClient, attemptId: string): Promise<Uint8Array | null> {
  try {
    const { data, error } = await supabase.storage.from(ATTEMPT_FILES_BUCKET).download(generatedFilePath(attemptId));
    if (error || !data) {
      logError("attempt.download_failed", error ? storageErrorCode(error) : "no_data");
      return null;
    }
    return new Uint8Array(await data.arrayBuffer());
  } catch (error) {
    logError("attempt.download_failed", errorName(error));
    return null;
  }
}

/** Macro path (service role): the attempt whose token has this SHA-256 (64 hex), or `null`. */
export async function findAttemptByTokenHash(
  service: SupabaseClient,
  tokenSha256: string,
): Promise<Read<AttemptIdentity | null>> {
  try {
    const { data, error } = await service
      .from(TABLE)
      .select("id, status, template_version")
      .eq("token_sha256", tokenSha256)
      .maybeSingle();
    if (error) {
      logError("attempt.find_by_token_failed", error.code);
      return { ok: false };
    }
    if (!data) return { ok: true, value: null };
    const row = data as Pick<AttemptRow, "id" | "status" | "template_version">;
    return { ok: true, value: { id: row.id, status: row.status, templateVersion: row.template_version } };
  } catch (error) {
    logError("attempt.find_by_token_failed", errorName(error));
    return { ok: false };
  }
}

/**
 * The one writer of `attempts.status` (AD-5): asks `transition(from, event)`
 * for the next status, then updates `where id = ? and status = <from>`. A
 * refused transition sends no query. `received_at` is the trigger's, never
 * sent here.
 */
export async function changeStatus(
  client: SupabaseClient,
  attemptId: string,
  from: AttemptStatus,
  event: AttemptEvent,
  /** Log event on failure; defaults to `attempt.<event>_failed`. */
  logEvent = `attempt.${event}_failed`,
): Promise<ChangeStatusResult> {
  const next = transition(from, event);
  if (!next.ok) return { outcome: "refused" };
  try {
    const { data, error } = await client
      .from(TABLE)
      .update({ status: next.to })
      .eq("id", attemptId)
      .eq("status", from)
      .select("id");
    if (error) {
      logError(logEvent, error.code);
      return { outcome: "failed" };
    }
    return Array.isArray(data) && data.length === 1 ? { outcome: "changed", status: next.to } : { outcome: "lost" };
  } catch (error) {
    logError(logEvent, errorName(error));
    return { outcome: "failed" };
  }
}

/**
 * Macro path (service role): `open` → `received` through `changeStatus`; the
 * database stamps `received_at`. `value: false` when the attempt was no longer
 * `open` (another post won).
 */
export async function markReceived(service: SupabaseClient, attemptId: string): Promise<Read<boolean>> {
  const result = await changeStatus(service, attemptId, "open", "submit_accepted", "attempt.mark_received_failed");
  if (result.outcome === "failed") return { ok: false };
  return { ok: true, value: result.outcome === "changed" };
}

/**
 * Abandon through the user's session (RLS: the owner may move their own
 * `open`, `received` or `grading_failed` attempt to `abandoned`, nothing
 * else). Reads the current status, then `changeStatus(…, status, 'abandon')`:
 * `refused` for `graded`, `abandoned` or `closed` (no update sent); `lost`
 * when the status changed between the read and the write.
 */
export async function abandon(supabase: SupabaseClient, attemptId: string): Promise<AbandonResult> {
  const read = await readAttempt(supabase, attemptId);
  if (!read.ok) return { outcome: "failed" };
  if (!read.value) return { outcome: "not_found" };
  return changeStatus(supabase, attemptId, read.value.status, "abandon");
}

interface AttemptRow {
  id: string;
  item_id: string;
  status: AttemptStatus;
  template_version: number;
  started_at: string;
  received_at: string | null;
}

function toAttempt(row: AttemptRow): Attempt {
  return {
    id: row.id,
    itemId: row.item_id,
    status: row.status,
    templateVersion: row.template_version,
    startedAt: row.started_at,
    receivedAt: row.received_at,
  };
}

function logError(event: string, code: string | undefined): void {
  console.error(JSON.stringify({ event, code: code ?? "unknown" }));
}

/** Storage answers a second `upsert: false` upload with 409 (`statusCode: "409"`, error `Duplicate`, code `ResourceAlreadyExists`). */
function isAlreadyExists(error: unknown): boolean {
  const e = error as { statusCode?: unknown; status?: unknown; code?: unknown; error?: unknown } | null;
  return (
    String(e?.statusCode) === "409" ||
    String(e?.status) === "409" ||
    e?.code === "ResourceAlreadyExists" ||
    e?.error === "Duplicate"
  );
}

function storageErrorCode(error: unknown): string {
  const e = error as { statusCode?: unknown; status?: unknown; name?: unknown } | null;
  const status = e?.statusCode ?? e?.status;
  if (typeof status === "string" || typeof status === "number") return String(status);
  return typeof e?.name === "string" ? e.name : "unknown";
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}
