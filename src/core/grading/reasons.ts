/**
 * Indonesian reason templates (AD-3, Consistency Conventions › Copy): why one
 * cell of an answer is wrong, resolved into `QuestionResult.reasonText`. A
 * reason names the cell, never the key or the expected value. Content text,
 * not a system message, so it lives here and not in `src/messages` (which
 * core does not import).
 */

export type ReasonKind = "typed_value" | "empty" | "wrong_value";

/** Why a check failed: the kind and the first cell (A1, without the sheet) it failed on. */
export interface Reason {
  kind: ReasonKind;
  ref: string;
}

export const REASON_TEMPLATES: Readonly<Record<ReasonKind, string>> = {
  /** `formula_present`: a value (number or text) typed into the cell instead of a formula. */
  typed_value: "Sel {ref} berisi nilai yang diketik, bukan rumus.",
  /** Any check: the cell has neither a formula nor a value. */
  empty: "Sel {ref} masih kosong.",
  /** `value_equals_key`: the cell's value is not the expected one (or not calculated yet). */
  wrong_value: "Hasil di {ref} belum sesuai.",
};

export function reasonText(reason: Reason): string {
  return REASON_TEMPLATES[reason.kind].replace("{ref}", reason.ref);
}
