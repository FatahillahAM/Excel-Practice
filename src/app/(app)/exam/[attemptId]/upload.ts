import type { AttemptStatus } from "@/adapters/supabase/attempts";
import { MAX_SUBMISSION_BYTES, REJECTION_CODES } from "@/core/submission";
import { uploadMessages } from "@/messages/id";

/**
 * The Upload Dropzone's logic without the DOM (no DOM harness until epic 4):
 * which file to send, the size check before sending, and what the answer of
 * `POST /api/submissions/upload` means for the screen.
 */

export const UPLOAD_ENDPOINT = "/api/submissions/upload";

/** The extensions the file picker offers (EXPERIENCE.md › Upload Dropzone): a Save-As `.xlsx` gets its own message. */
export const UPLOAD_ACCEPT = ".xlsm,.xlsx";

/**
 * What an upload ended in: `received` (accepted, or a duplicate: the screen
 * moves to `status`); `rejected` (the message for the Dropzone's alert);
 * `session_lost` (401: the first-load alert with Try again); `failed` (no or
 * an unknown answer, a server fault, a 415: the connection message).
 */
export type UploadOutcome =
  | { kind: "received"; status: AttemptStatus }
  | { kind: "rejected"; message: string }
  | { kind: "session_lost" }
  | { kind: "failed" };

/** The first file of a pick or a drop, or `null` when there is none (only one file is ever sent). */
export function pickFile<T>(files: ArrayLike<T> | null | undefined): T | null {
  return files && files.length > 0 ? files[0] : null;
}

/** Larger than the server accepts (4 MiB, `MAX_SUBMISSION_BYTES`): refused without sending. */
export function tooLarge(size: number): boolean {
  return size > MAX_SUBMISSION_BYTES;
}

/** The statuses an accepted upload (or a duplicate) can leave the attempt in. */
const RECEIVED_STATUSES: readonly AttemptStatus[] = ["received", "grading_failed"];
const MESSAGE_CODES: readonly string[] = [...REJECTION_CODES, "FILE_TOO_LARGE"];

/** The answer (HTTP status + parsed JSON body, `null` when it was not JSON) as an outcome. */
export function uploadOutcome(httpStatus: number, body: unknown): UploadOutcome {
  if (httpStatus === 401) return { kind: "session_lost" };
  const b = (typeof body === "object" && body !== null ? body : {}) as {
    ok?: unknown;
    code?: unknown;
    data?: { status?: unknown } | null;
  };
  if (httpStatus === 200 && b.ok === true) {
    const status = b.data?.status;
    if (typeof status === "string" && (RECEIVED_STATUSES as readonly string[]).includes(status)) {
      return { kind: "received", status: status as AttemptStatus };
    }
    return { kind: "failed" };
  }
  if (b.ok === false && typeof b.code === "string" && MESSAGE_CODES.includes(b.code)) {
    return { kind: "rejected", message: uploadMessages[b.code as keyof typeof uploadMessages] };
  }
  return { kind: "failed" };
}

/** What the Dropzone shows. */
export type DropzoneState = { kind: "ready" } | { kind: "uploading" } | { kind: "rejected"; message: string };

/**
 * What the Dropzone does once an upload ended: its next state, what to tell
 * the exam screen (`received` with the status, or `session_lost`), and
 * whether to give focus back to the input (it was disabled while uploading).
 */
export interface AfterUpload {
  state: DropzoneState;
  notify: { kind: "received"; status: AttemptStatus } | { kind: "session_lost" } | null;
  refocus: boolean;
}

export function afterUpload(outcome: UploadOutcome): AfterUpload {
  switch (outcome.kind) {
    case "received":
      return { state: { kind: "ready" }, notify: { kind: "received", status: outcome.status }, refocus: false };
    case "session_lost":
      return { state: { kind: "ready" }, notify: { kind: "session_lost" }, refocus: false };
    case "rejected":
      return { state: { kind: "rejected", message: outcome.message }, notify: null, refocus: true };
    case "failed":
      return { state: { kind: "rejected", message: uploadMessages.failed }, notify: null, refocus: true };
  }
}
