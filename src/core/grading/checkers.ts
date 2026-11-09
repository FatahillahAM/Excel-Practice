import type { Check, CheckName } from "../content/checks";
import type { ExamCellValue, ExamQuestion } from "../content/level-module";
import type { Reason } from "./reasons";
import type { CellReading } from "./workbook-reading";

/**
 * Checker primitives (AD-3): level modules declare checks by name
 * (`src/core/content/checks.ts`); the implementations live only here. A
 * checker looks at every answer cell of one question, in range order, and
 * fails on the first cell that does not pass, with that cell's reason.
 *
 * Entry 1 implements `formula_present` and `value_equals_key`; a declared
 * check without an implementation in `CHECKER_REGISTRY` is skipped by
 * `grade()` (entry 2 fills the rest).
 */

/** One answer cell: its A1 reference and what the workbook holds there (`undefined`: nothing). */
export interface AnswerCell {
  ref: string;
  reading: CellReading | undefined;
}

export type CheckOutcome = { ok: true } | { ok: false; reason: Reason };

export type Checker<N extends CheckName = CheckName> = (
  check: Extract<Check, { name: N }>,
  question: ExamQuestion,
  cells: readonly AnswerCell[],
) => CheckOutcome;

const OK: CheckOutcome = { ok: true };

/** A cell with neither a formula nor a value. */
export function isEmptyCell(reading: CellReading | undefined): boolean {
  return reading === undefined || (reading.formula === null && reading.type === "empty");
}

/** `formula_present`: every answer cell holds a formula; an empty cell is `empty`, a typed value `typed_value`. */
export const formulaPresent: Checker<"formula_present"> = (_check, _question, cells) => {
  for (const { ref, reading } of cells) {
    if (isEmptyCell(reading)) return { ok: false, reason: { kind: "empty", ref } };
    if (reading!.formula === null) return { ok: false, reason: { kind: "typed_value", ref } };
  }
  return OK;
};

/**
 * Whether a cell's cached value equals the key: a number within
 * `tolerance × max(1, |key|)`, text exactly. A formula Excel has not
 * calculated (`null`), an error, or a type other than the key's is not equal.
 */
export function valueMatches(reading: CellReading, key: ExamCellValue, tolerance: number): boolean {
  if (typeof key === "number") {
    if (reading.type !== "number" || typeof reading.value !== "number" || !Number.isFinite(reading.value)) return false;
    return Math.abs(reading.value - key) <= tolerance * Math.max(1, Math.abs(key));
  }
  return reading.type === "string" && reading.value === key;
}

/** `value_equals_key`: every answer cell's value equals its key; an empty cell is `empty`, any other mismatch `wrong_value`. */
export const valueEqualsKey: Checker<"value_equals_key"> = (check, question, cells) => {
  for (const { ref, reading } of cells) {
    if (isEmptyCell(reading)) return { ok: false, reason: { kind: "empty", ref } };
    const key = question.key[ref];
    if (key === undefined || !valueMatches(reading!, key, check.tolerance)) {
      return { ok: false, reason: { kind: "wrong_value", ref } };
    }
  }
  return OK;
};

/** The implemented checkers by name; `grade()` skips a declared check that has none. */
export const CHECKER_REGISTRY: { readonly [N in CheckName]?: Checker<N> } = {
  formula_present: formulaPresent,
  value_equals_key: valueEqualsKey,
};

/** Runs one declared check, or `null` when the registry has no checker for it (skipped). */
export function runCheck(check: Check, question: ExamQuestion, cells: readonly AnswerCell[]): CheckOutcome | null {
  const checker = CHECKER_REGISTRY[check.name] as Checker | undefined;
  return checker === undefined ? null : checker(check as never, question, cells);
}
