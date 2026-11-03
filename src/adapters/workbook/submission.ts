import type { WorkbookInspection, WorkbookPort } from "../../core/submission";
import { NotMacroEnabledError, readWorkbook } from "./read.ts";
import { matchesTemplate } from "./templates.ts";
import { tokenSha256Hex } from "./token.ts";

/**
 * The workbook port of `submit()` (AD-6 steps 1, 2 and 4; AD-4): the only
 * place a submitted file's bytes are read. Hashing the token lives here too, so
 * core never imports `node:crypto`.
 */

export const TOKEN_PROPERTY = "WHE_AttemptToken";

/**
 * `not_excel`: not a zip, not an OOXML spreadsheet, or a workbook the reader
 * cannot read (including a zip bomb past the reader's bounds). `not_xlsm`: a
 * spreadsheet whose main part is not a macro-enabled `.xlsm`. `xlsm`: its
 * `WHE_AttemptToken` (`null` when missing) and VBA fingerprint.
 */
export async function inspectWorkbook(bytes: Uint8Array): Promise<WorkbookInspection> {
  try {
    const reading = await readWorkbook(bytes);
    const token = Object.hasOwn(reading.properties, TOKEN_PROPERTY) ? reading.properties[TOKEN_PROPERTY] : null;
    return { kind: "xlsm", token, vba: reading.vbaModuleHashes };
  } catch (error) {
    return error instanceof NotMacroEnabledError ? { kind: "not_xlsm" } : { kind: "not_excel" };
  }
}

export const workbookPort: WorkbookPort = {
  inspect: inspectWorkbook,
  fingerprintMatches: (vba, templateVersion) => matchesTemplate(vba, templateVersion),
  hashToken: tokenSha256Hex,
};
