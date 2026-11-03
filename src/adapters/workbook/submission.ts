import type { WorkbookInspection, WorkbookPort } from "../../core/submission";
import { NotAWorkbookError, NotMacroEnabledError, readWorkbook } from "./read.ts";
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
 * cannot read (including a zip bomb past the reader's bounds); an error that
 * is not `NotAWorkbookError` is logged first (event and error name only). `not_xlsm`: a
 * spreadsheet whose main part is not a macro-enabled `.xlsm`. `xlsm`: its
 * `WHE_AttemptToken` (`null` when missing) and VBA fingerprint.
 */
export async function inspectWorkbook(bytes: Uint8Array): Promise<WorkbookInspection> {
  try {
    const reading = await readWorkbook(bytes);
    const token = Object.hasOwn(reading.properties, TOKEN_PROPERTY) ? reading.properties[TOKEN_PROPERTY] : null;
    return { kind: "xlsm", token, vba: reading.vbaModuleHashes };
  } catch (error) {
    if (error instanceof NotMacroEnabledError) return { kind: "not_xlsm" };
    if (!(error instanceof NotAWorkbookError)) {
      // Not one of the reader's own refusals: still NOT_EXCEL, but visible. Only the error's name, never its message.
      console.error(JSON.stringify({ event: "workbook.inspect_failed", code: error instanceof Error ? error.name : typeof error }));
    }
    return { kind: "not_excel" };
  }
}

export const workbookPort: WorkbookPort = {
  inspect: inspectWorkbook,
  fingerprintMatches: (vba, templateVersion) => matchesTemplate(vba, templateVersion),
  hashToken: tokenSha256Hex,
};
