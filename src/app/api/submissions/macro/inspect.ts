import { createHash, timingSafeEqual } from "node:crypto";
import { readWorkbook, type WorkbookReading } from "../../../../adapters/workbook/read";
import { CURRENT_TEMPLATE_VERSION, matchesTemplate } from "../../../../adapters/workbook/templates";
import { RejectionCode } from "../../../../core/submission/rejection-codes";

/**
 * Spike S3: what `POST /api/submissions/macro` learns from a workbook posted by
 * the Finish macro, without touching the database or Storage. Reads the file,
 * compares the `X-Attempt-Token` header with the file's `WHE_AttemptToken` and
 * the VBA fingerprint with the current template version (AD-4, AD-6 steps 1, 2
 * and 4). Epic 2 replaces this with `submit(bytes, "macro")`.
 */

export const TOKEN_PROPERTY = "WHE_AttemptToken";

/** Attempt token: 32 random bytes, base64url without padding (Consistency Conventions › IDs). */
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export interface MacroInspectionData {
  bytes: number;
  tokenMatches: boolean;
  fingerprintMatches: boolean;
}

export type MacroInspectionBody =
  | { ok: true; data: MacroInspectionData }
  | { ok: false; code: RejectionCode };

/** One JSON log line (Consistency Conventions › Logging): never file bytes, tokens or emails. */
export interface MacroInspectionLog {
  channel: "macro";
  code: RejectionCode | null;
  bytes: number;
  /** First 12 hex of SHA-256 of the file's `WHE_AttemptToken`; `scripts/spike-s1.ts` prints the same value. */
  tokenSha256: string | null;
  tokenMatches: boolean;
  fingerprintMatches: boolean;
  templateVersion: number;
}

export interface MacroInspection {
  status: 200 | 400;
  body: MacroInspectionBody;
  log: MacroInspectionLog;
}

export async function inspectMacroSubmission(
  bytes: Uint8Array,
  headerToken: string | null,
): Promise<MacroInspection> {
  const log: MacroInspectionLog = {
    channel: "macro",
    code: null,
    bytes: bytes.byteLength,
    tokenSha256: null,
    tokenMatches: false,
    fingerprintMatches: false,
    templateVersion: CURRENT_TEMPLATE_VERSION,
  };
  const reject = (code: RejectionCode): MacroInspection => ({
    status: 400,
    body: { ok: false, code },
    log: { ...log, code },
  });

  // AD-6 (1): any file the reader cannot read is NOT_EXCEL, not only a non-zip.
  if (bytes.byteLength === 0) return reject(RejectionCode.NOT_EXCEL);
  let reading: WorkbookReading;
  try {
    reading = await readWorkbook(bytes);
  } catch {
    return reject(RejectionCode.NOT_EXCEL);
  }

  const fileToken = Object.hasOwn(reading.properties, TOKEN_PROPERTY) ? reading.properties[TOKEN_PROPERTY] : "";
  log.tokenSha256 = fileToken === "" ? null : tokenSha256(fileToken);
  // AD-6 (2): token missing or malformed, or header ≠ file token.
  log.tokenMatches = TOKEN_RE.test(fileToken) && headerToken !== null && sameText(headerToken, fileToken);
  // AD-6 (4): the version is the server's, never `WHE_TemplateVersion`.
  log.fingerprintMatches = matchesTemplate(reading.vbaModuleHashes, CURRENT_TEMPLATE_VERSION);

  if (!log.tokenMatches || !log.fingerprintMatches) return reject(RejectionCode.IDENTITY_ALTERED);
  return {
    status: 200,
    body: {
      ok: true,
      data: { bytes: log.bytes, tokenMatches: log.tokenMatches, fingerprintMatches: log.fingerprintMatches },
    },
    log,
  };
}

/** First 12 hex of the SHA-256 of a token: lets a log line be matched to a token without holding it. */
export function tokenSha256(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex").slice(0, 12);
}

function sameText(a: string, b: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();
  return timingSafeEqual(digest(a), digest(b));
}
