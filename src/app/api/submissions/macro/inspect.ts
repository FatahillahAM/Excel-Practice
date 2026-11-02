import { createHash, timingSafeEqual } from "node:crypto";
import { ATTEMPT_TOKEN_RE } from "../../../../adapters/workbook/generate";
import { readWorkbook, type WorkbookReading } from "../../../../adapters/workbook/read";
import { matchesTemplate } from "../../../../adapters/workbook/templates";
import { tokenSha256, tokenSha256Hex } from "../../../../adapters/workbook/token";
import { RejectionCode } from "../../../../core/submission/rejection-codes";

/**
 * What `POST /api/submissions/macro` learns from a workbook posted by the
 * Finish macro before it looks up the attempt: AD-6 steps (1) and (2) in
 * `identifyMacroSubmission`, step (4) in `fingerprintMatches` once the
 * attempt's `template_version` is known. No database, no Storage. Entry 2
 * replaces this with `submit(bytes, "macro")`.
 */

export const TOKEN_PROPERTY = "WHE_AttemptToken";

export type MacroIdentification =
  | {
      ok: false;
      code: RejectionCode;
      /** First 12 hex of the file token's SHA-256, when the file has a token at all. */
      tokenSha256: string | null;
    }
  | {
      ok: true;
      reading: WorkbookReading;
      /** Full lowercase hex SHA-256 of the file's token: the attempt's key. Never logged. */
      tokenSha256Hex: string;
      /** First 12 hex of it, for the log line. */
      tokenSha256: string;
    };

export async function identifyMacroSubmission(
  bytes: Uint8Array,
  headerToken: string | null,
): Promise<MacroIdentification> {
  // AD-6 (1): any file the reader cannot read is NOT_EXCEL, not only a non-zip.
  if (bytes.byteLength === 0) return { ok: false, code: RejectionCode.NOT_EXCEL, tokenSha256: null };
  let reading: WorkbookReading;
  try {
    reading = await readWorkbook(bytes);
  } catch {
    return { ok: false, code: RejectionCode.NOT_EXCEL, tokenSha256: null };
  }

  const fileToken = Object.hasOwn(reading.properties, TOKEN_PROPERTY) ? reading.properties[TOKEN_PROPERTY] : "";
  const shortHash = fileToken === "" ? null : tokenSha256(fileToken);
  // AD-6 (2): token missing or malformed, or header ≠ file token.
  if (!ATTEMPT_TOKEN_RE.test(fileToken) || headerToken === null || !sameText(headerToken, fileToken)) {
    return { ok: false, code: RejectionCode.IDENTITY_ALTERED, tokenSha256: shortHash };
  }
  return { ok: true, reading, tokenSha256Hex: tokenSha256Hex(fileToken), tokenSha256: tokenSha256(fileToken) };
}

/**
 * AD-6 (4): whether the posted workbook's VBA fingerprint matches the
 * attempt's recorded template version, never `WHE_TemplateVersion`. Throws
 * for a version that is not in the registry (`matchesTemplate`).
 */
export function fingerprintMatches(reading: WorkbookReading, templateVersion: number): boolean {
  return matchesTemplate(reading.vbaModuleHashes, templateVersion);
}

function sameText(a: string, b: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();
  return timingSafeEqual(digest(a), digest(b));
}
