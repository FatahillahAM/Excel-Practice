import type { AttemptStatus } from "../services/attempts";
import { RejectionCode } from "./rejection-codes";

/**
 * `submit(bytes, channel)` (AD-6): the one use case behind the macro path
 * (`POST /api/submissions/macro`, token header, service-role ports) and the
 * upload path (session ports). Decision order, exactly:
 *
 * 1. not an OOXML workbook the reader can read → `NOT_EXCEL`;
 * 2. not a macro-enabled `.xlsm` (main part's content type), `WHE_AttemptToken`
 *    missing or malformed, or (macro) `X-Attempt-Token` ≠ the file's token,
 *    compared through the SHA-256 of both → `IDENTITY_ALTERED`;
 * 3. no attempt has the file's token → `NOT_THIS_ATTEMPT`;
 * 4. the VBA fingerprint does not match the attempt's recorded
 *    `template_version` (never `WHE_TemplateVersion`) → `IDENTITY_ALTERED`;
 * 5. `graded` → `ALREADY_GRADED`; `abandoned`/`closed` → `ATTEMPT_CLOSED`;
 *    `received`/`grading_failed` → accepted as a duplicate (nothing stored);
 *    `open` → the file is stored as `submission-1` (replacing a file an earlier,
 *    never-accepted post left), then `open` → `received`
 *    by compare-and-set; a lost compare-and-set re-reads and runs (5) again.
 *
 * Bytes, zip, hashing, the database and Storage are reached only through
 * `SubmissionPorts` (AD-1). The result carries the log line's fields.
 */

/** Largest body accepted (4 MiB): Vercel refuses bodies over 4.5 MB before the function runs. */
export const MAX_SUBMISSION_BYTES = 4 * 1024 * 1024;

/**
 * Attempt token: 32 random bytes, base64url without padding (Consistency
 * Conventions › IDs).
 */
export const ATTEMPT_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

/**
 * Server-side outcomes outside the AD-6 `RejectionCode`s (adding one there
 * would bump `WHE_TemplateVersion`). The macro maps them by HTTP status.
 */
export const SubmissionFault = {
  /** Body larger than `MAX_SUBMISSION_BYTES` (HTTP 413). */
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  /** A server fault, not a reason the file is refused (HTTP 500). */
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type SubmissionFault = (typeof SubmissionFault)[keyof typeof SubmissionFault];

export type SubmissionCode = RejectionCode | SubmissionFault;

/** How the file arrived: the macro also carries its `X-Attempt-Token` header (`null` when absent). */
export type Channel = { kind: "macro"; headerToken: string | null } | { kind: "upload" };

/** Opaque VBA fingerprint the workbook port reads and compares; `null` when there is no readable VBA project. */
export type VbaFingerprint = Readonly<Record<string, string>> | null;

/** What the workbook port learns from the bytes (AD-6 steps 1–2). */
export type WorkbookInspection =
  | { kind: "not_excel" }
  | { kind: "not_xlsm" }
  | { kind: "xlsm"; /** `WHE_AttemptToken`, `null` when the property is missing. */ token: string | null; vba: VbaFingerprint };

export interface WorkbookPort {
  inspect(bytes: Uint8Array): Promise<WorkbookInspection>;
  /** AD-4 match against template `templateVersion`; throws for a version not in the registry. */
  fingerprintMatches(vba: VbaFingerprint, templateVersion: number): boolean;
  /** Full lowercase hex SHA-256 of a token: the attempt's key. */
  hashToken(token: string): string;
}

export interface SubmittedAttempt {
  id: string;
  status: AttemptStatus;
  templateVersion: number;
}

/** A read that can fail: `ok: false` when the store could not answer. */
export type PortRead<T> = { ok: true; value: T } | { ok: false };

export interface AttemptsPort {
  /** The attempt whose token has this SHA-256 (64 hex), or `null`. */
  findByTokenHash(tokenSha256Hex: string): Promise<PortRead<SubmittedAttempt | null>>;
  /** `open` → `received` by compare-and-set (`submit_accepted`); `value: false` when the attempt was no longer `open`. */
  markReceived(attemptId: string): Promise<PortRead<boolean>>;
}

export interface FilesPort {
  /**
   * Stores `submission-<n>`, replacing what is there: called only while the
   * attempt is `open`, so a file an earlier post stored before its
   * compare-and-set failed gives way to the bytes that are accepted.
   */
  storeSubmission(attemptId: string, n: number, bytes: Uint8Array): Promise<"stored" | "failed">;
}

export interface SubmissionPorts {
  workbook: WorkbookPort;
  attempts: AttemptsPort;
  files: FilesPort;
}

/** One JSON log line (Consistency Conventions › Logging): never file bytes or tokens. */
export interface SubmissionLog {
  attemptId: string | null;
  channel: Channel["kind"];
  code: SubmissionCode | null;
  /** First 12 hex of the file token's SHA-256, when the file has a token. */
  tokenSha256: string | null;
  /** Whether this submission moved the attempt from `open` to `received`. */
  received: boolean;
  /** Whether the attempt was already `received`/`grading_failed` (idempotent duplicate). */
  duplicate: boolean;
}

/** Which port step failed behind an `INTERNAL_ERROR`, for the caller's error log. */
export type SubmissionFailure =
  | "lookup_failed"
  | "template_version_unknown"
  | "store_failed"
  | "mark_received_failed"
  | "status_unsettled";

export type SubmitResult =
  | { ok: true; status: AttemptStatus; duplicate: boolean; log: SubmissionLog }
  | { ok: false; code: SubmissionCode; failure?: SubmissionFailure; log: SubmissionLog };

/** Every submission is file 1: a duplicate never stores, so the first accepted file is the one graded. */
const SUBMISSION_NUMBER = 1;
/** Lost compare-and-sets in a row before giving up (each lost one means the status moved). */
const MAX_STATUS_ROUNDS = 3;

export async function submit(bytes: Uint8Array, channel: Channel, ports: SubmissionPorts): Promise<SubmitResult> {
  const log: SubmissionLog = {
    attemptId: null,
    channel: channel.kind,
    code: null,
    tokenSha256: null,
    received: false,
    duplicate: false,
  };
  const refuse = (code: SubmissionCode, failure?: SubmissionFailure): SubmitResult => {
    log.code = code;
    return failure ? { ok: false, code, failure, log } : { ok: false, code, log };
  };
  const fail = (failure: SubmissionFailure) => refuse(SubmissionFault.INTERNAL_ERROR, failure);

  if (bytes.byteLength > MAX_SUBMISSION_BYTES) return refuse(SubmissionFault.FILE_TOO_LARGE);

  // (1) Not a workbook the reader can read.
  const inspection = bytes.byteLength === 0 ? ({ kind: "not_excel" } as const) : await ports.workbook.inspect(bytes);
  if (inspection.kind === "not_excel") return refuse(RejectionCode.NOT_EXCEL);

  // (2) Not a macro-enabled `.xlsm`, token missing or malformed, or header ≠ file token.
  if (inspection.kind === "not_xlsm") return refuse(RejectionCode.IDENTITY_ALTERED);
  const fileToken = inspection.token ?? "";
  const fileHash = fileToken === "" ? null : ports.workbook.hashToken(fileToken);
  log.tokenSha256 = fileHash === null ? null : fileHash.slice(0, 12);
  if (fileHash === null || !ATTEMPT_TOKEN_RE.test(fileToken)) return refuse(RejectionCode.IDENTITY_ALTERED);
  if (channel.kind === "macro") {
    const header = channel.headerToken;
    if (header === null || !sameDigest(ports.workbook.hashToken(header), fileHash)) {
      return refuse(RejectionCode.IDENTITY_ALTERED);
    }
  }

  // (3) The attempt is found by the file's token.
  const found = await ports.attempts.findByTokenHash(fileHash);
  if (!found.ok) return fail("lookup_failed");
  if (found.value === null) return refuse(RejectionCode.NOT_THIS_ATTEMPT);
  let attempt = found.value;
  log.attemptId = attempt.id;

  // (4) The VBA fingerprint of the attempt's own template version.
  let matches: boolean;
  try {
    matches = ports.workbook.fingerprintMatches(inspection.vba, attempt.templateVersion);
  } catch {
    return fail("template_version_unknown");
  }
  if (!matches) return refuse(RejectionCode.IDENTITY_ALTERED);

  // (5) The attempt's status.
  for (let round = 0; round < MAX_STATUS_ROUNDS; round++) {
    switch (attempt.status) {
      case "graded":
        return refuse(RejectionCode.ALREADY_GRADED);
      case "abandoned":
      case "closed":
        return refuse(RejectionCode.ATTEMPT_CLOSED);
      case "received":
      case "grading_failed":
        log.duplicate = true;
        return { ok: true, status: attempt.status, duplicate: true, log };
      case "open": {
        // Stored before the status changes, so a `received` attempt always has its file.
        // Overwrites a file from an earlier post whose compare-and-set failed: only an `open` attempt stores.
        const stored = await ports.files.storeSubmission(attempt.id, SUBMISSION_NUMBER, bytes);
        if (stored === "failed") return fail("store_failed");
        const marked = await ports.attempts.markReceived(attempt.id);
        if (!marked.ok) return fail("mark_received_failed");
        if (marked.value) {
          log.received = true;
          return { ok: true, status: "received", duplicate: false, log };
        }
        // The compare-and-set lost: the status moved meanwhile. Read it again and decide (5) anew.
        const now = await ports.attempts.findByTokenHash(fileHash);
        if (!now.ok) return fail("lookup_failed");
        if (now.value === null) return refuse(RejectionCode.NOT_THIS_ATTEMPT);
        attempt = now.value;
        break;
      }
      default:
        return fail("status_unsettled");
    }
  }
  return fail("status_unsettled");
}

/** Equal hex digests, compared without an early exit. */
function sameDigest(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
