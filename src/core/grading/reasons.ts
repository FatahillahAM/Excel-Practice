/**
 * Indonesian reason templates (AD-3, Consistency Conventions › Copy): why one
 * cell of an answer is wrong, resolved into `QuestionResult.reasonText`. A
 * reason names the cell (and, for a missing function, the function), never the
 * key, the expected value or the expected reference (U2). Content text,
 * not a system message, so it lives here and not in `src/messages` (which
 * core does not import).
 */

export type ReasonKind =
  | "typed_value"
  | "empty"
  | "hard_coded"
  | "missing_function"
  | "wrong_reference"
  | "error_value"
  | "not_calculated"
  | "wrong_value";

/** Why a check failed: the kind and the first cell (A1, without the sheet) it failed on. */
export interface Reason {
  kind: ReasonKind;
  ref: string;
  /** `missing_function`: the declared function the formula does not call (`SUM`). */
  function?: string;
}

export const REASON_TEMPLATES: Readonly<Record<ReasonKind, string>> = {
  /** `formula_present`: a value (number or text) typed into the cell instead of a formula. */
  typed_value: "Sel {ref} berisi nilai yang diketik, bukan rumus.",
  /** Any check: the cell has neither a formula nor a value. */
  empty: "Sel {ref} masih kosong.",
  /** `not_hard_coded`: the formula refers to no cell, range or structured reference (`=1159*1123.51`). */
  hard_coded: "Rumus di {ref} hanya berisi angka, tidak merujuk sel.",
  /** `uses_functions`: the formula does not call a declared function. */
  missing_function: "Rumus di {ref} tidak memakai fungsi {function}.",
  /** `uses_reference`: the formula lacks the declared reference (shifted for this cell); never names it. */
  wrong_reference: "Rumus di {ref} belum memakai referensi sel yang diminta, jadi hasilnya bisa salah saat disalin.",
  /** `value_equals_key`: the formula's value is an error (`#DIV/0!`); never names the code. */
  error_value: "Rumus di {ref} menghasilkan error.",
  /** `value_equals_key`: a formula without a cached value (saved without calculating). */
  not_calculated: "Rumus di {ref} belum dihitung oleh Excel.",
  /** `value_equals_key`: the cell's value is not the expected one. */
  wrong_value: "Hasil di {ref} belum sesuai.",
};

/** The reason's Indonesian text: `{ref}` and `{function}` filled in. */
export function reasonText(reason: Reason): string {
  const template = REASON_TEMPLATES[reason.kind];
  if (template.includes("{function}") && (reason.function === undefined || reason.function === "")) {
    throw new Error(`Reason ${reason.kind} needs a function name`);
  }
  return template.replace("{ref}", reason.ref).replace("{function}", reason.function ?? "");
}
