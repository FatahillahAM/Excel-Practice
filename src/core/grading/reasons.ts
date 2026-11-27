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
  | "array_formula"
  | "empty"
  | "hard_coded"
  | "missing_function"
  | "unknown_function"
  | "missing_any_function"
  | "wrong_reference"
  | "error_value"
  | "not_calculated"
  | "wrong_value"
  | "not_a_table"
  | "wrong_table_range"
  | "wrong_table_header"
  | "wrong_spill";

/**
 * Why a check failed: the kind and the first cell (A1, without the sheet) it
 * failed on; for the Table reasons, the range the Table must cover (the
 * prompt names it too).
 */
export interface Reason {
  kind: ReasonKind;
  ref: string;
  /** `missing_function` / `missing_any_function`: the declared function the formula does not call (`SUM`). */
  function?: string;
}

export const REASON_TEMPLATES: Readonly<Record<ReasonKind, string>> = {
  /** `formula_present`: a value (number or text) typed into the cell instead of a formula. */
  typed_value: "Sel {ref} berisi nilai yang diketik, bukan rumus.",
  /**
   * Any check where the cell would be `typed_value`, and `uses_reference` at the
   * anchor: the cell lies in an array formula over several cells (its values
   * were not typed, so `typed_value` would be a false accusation).
   */
  array_formula: "Sel {ref} berisi hasil rumus array; tulis satu rumus biasa lalu salin ke sel lainnya.",
  /** Any check: the cell has neither a formula nor a value. */
  empty: "Sel {ref} masih kosong.",
  /** `not_hard_coded`: the formula refers to no cell, range or structured reference (`=1159*1123.51`). */
  hard_coded: "Rumus di {ref} hanya berisi angka, tidak merujuk sel.",
  /** `uses_functions`: the formula does not call a declared function. */
  missing_function: "Rumus di {ref} tidak memakai fungsi {function}.",
  /**
   * Any check on a formula: it calls a function Excel does not recognize
   * (saved with the `_xludf.` prefix, shown as #NAME?); decides before the
   * other checks on that cell, so it is never reported as `missing_function`.
   */
  unknown_function: "Excel tidak mengenali nama fungsi di rumus {ref}, jadi hasilnya #NAME?. Cek ejaan nama fungsinya, atau pastikan fungsinya ada di Excel 2021.",
  /** `uses_any_function`: the formula calls none of the declared functions; `{function}` is them all ("IF atau IFS"). */
  missing_any_function: "Rumus di {ref} belum memakai {function}.",
  /** `uses_reference`: the formula lacks the declared reference (shifted for this cell); never names it. */
  wrong_reference: "Rumus di {ref} belum memakai referensi sel yang diminta, jadi hasilnya bisa salah saat disalin.",
  /** `value_equals_key`: the formula's value is an error (`#DIV/0!`); never names the code. */
  error_value: "Rumus di {ref} menghasilkan error.",
  /** `value_equals_key`: a formula without a cached value (saved without calculating). */
  not_calculated: "Rumus di {ref} belum dihitung oleh Excel.",
  /** `value_equals_key`: the cell's value is not the expected one. */
  wrong_value: "Hasil di {ref} belum sesuai.",
  /** `is_table`: no Excel Table on the sheet overlaps the data (formatting or a plain AutoFilter is not one). */
  not_a_table: "Data di {ref} belum dijadikan Excel Table.",
  /** `is_table`: a Table overlaps the data but its range is not exactly the data (rows left out, or extra columns or rows). */
  wrong_table_range: "Range Excel Table belum sama dengan data di {ref}: judul kolom dan semua baris data harus masuk, tanpa kolom atau baris tambahan.",
  /** `is_table`: the Table's header row is off, or its column names are not the data's headers. */
  wrong_table_header: "Excel Table di {ref} belum memakai baris judul data sebagai header.",
  /** `spills`: the top-left cell's formula does not spill over exactly the answer range; never names the expected size. */
  wrong_spill: "Hasil rumus di {ref} belum mengisi daftar yang diminta: jumlah baris atau kolom hasilnya berbeda.",
};

/** The reason's Indonesian text: `{ref}` and `{function}` filled in. */
export function reasonText(reason: Reason): string {
  const template = REASON_TEMPLATES[reason.kind];
  if (template.includes("{function}") && (reason.function === undefined || reason.function === "")) {
    throw new Error(`Reason ${reason.kind} needs a function name`);
  }
  return template.replace("{ref}", reason.ref).replace("{function}", reason.function ?? "");
}
