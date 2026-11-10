import { parseCell } from "../content/a1";
import type { Check, CheckName } from "../content/checks";
import type { ExamCellValue, ExamQuestion } from "../content/level-module";
import { shiftFormula, tokenize, type FormulaToken } from "./formula";
import type { Reason } from "./reasons";
import type { CellReading } from "./workbook-reading";

/**
 * Checker primitives (AD-3): level modules declare checks by name
 * (`src/core/content/checks.ts`); the implementations live only here. A
 * checker looks at every answer cell of one question, in range order, and
 * fails on the first cell that does not pass, with that cell's reason.
 *
 * Every checker stands on its own: an empty cell is `empty` and a typed value
 * `typed_value` (`array_formula` when the value is an array formula's, not
 * typed), whatever order the checks are declared in. A check over no cells
 * never passes: it throws (fail closed; `grade()` always passes a range). Formulas are read
 * with the one tokenizer (`./formula.ts`) the workbook reader also uses.
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

/**
 * Runs `test` on each answer cell in range order, after the rule every checker
 * applies first (an empty cell is `empty`, a value without a formula
 * `typed_value`, or `array_formula` inside an array formula's range); the
 * first cell that fails decides. No cells at all throws: a check never passes
 * vacuously.
 */
function everyFormula(
  cells: readonly AnswerCell[],
  test: (formula: string, reading: CellReading, ref: string) => Reason | null,
): CheckOutcome {
  if (cells.length === 0) throw new Error("A check needs at least one answer cell");
  for (const { ref, reading } of cells) {
    if (reading === undefined || isEmptyCell(reading)) return { ok: false, reason: { kind: "empty", ref } };
    if (reading.formula === null) return { ok: false, reason: { kind: reading.array === true ? "array_formula" : "typed_value", ref } };
    const reason = test(reading.formula, reading, ref);
    if (reason !== null) return { ok: false, reason };
  }
  return OK;
}

/** `formula_present`: every answer cell holds a formula; an empty cell is `empty`, a typed value `typed_value`. */
export const formulaPresent: Checker<"formula_present"> = (_check, _question, cells) => everyFormula(cells, () => null);

/** An external workbook index (`[1]`): a bracket, but not a reference to any cell. */
const WORKBOOK_INDEX_RE = /^\[\d+\]$/;

/** A token that refers to cells: a cell, range, whole column or row, or a structured reference. */
function isReference(token: FormulaToken): boolean {
  if (token.kind === "bracket") return !WORKBOOK_INDEX_RE.test(token.text);
  return token.kind === "cells" || token.kind === "columns" || token.kind === "rows";
}

/**
 * `not_hard_coded`: every formula refers to at least one cell, range, whole
 * column or row, or structured reference; `=1159*1123.51` is `hard_coded`.
 * A defined name and an external workbook index (`=[1]!Rate*2`) do not count.
 * A formula whose references were all deleted (`=#REF!*#REF!`) is
 * `error_value`: it once referred to cells, so `hard_coded` would be wrong.
 */
export const notHardCoded: Checker<"not_hard_coded"> = (_check, _question, cells) =>
  everyFormula(cells, (formula, _reading, ref) => {
    const tokens = tokenize(formula);
    if (tokens.some(isReference)) return null;
    return tokens.some((token) => token.kind === "error" && token.text.toUpperCase() === "#REF!")
      ? { kind: "error_value", ref }
      : { kind: "hard_coded", ref };
  });

const FUNCTION_PREFIX_RE = /^(?:_xl(?:fn|ws|pm)\.)+/i;

/** Tokens of a formula without whitespace, so neighbours can be compared. */
function solidTokens(formula: string): FormulaToken[] {
  return tokenize(formula).filter((token) => token.kind !== "space");
}

/**
 * The functions a formula calls: each name followed by `(`, in upper case,
 * with `_xlfn.`-style prefixes dropped.
 */
export function calledFunctions(formula: string): Set<string> {
  const tokens = solidTokens(formula);
  const called = new Set<string>();
  tokens.forEach((token, i) => {
    if (token.kind === "name" && tokens[i + 1]?.text === "(") {
      called.add(functionName(token.text));
    }
  });
  return called;
}

/** A function name as compared: `_xlfn.`-style prefixes dropped, upper case. */
export function functionName(name: string): string {
  return name.replace(FUNCTION_PREFIX_RE, "").toUpperCase();
}

/**
 * `uses_functions`: every formula calls each declared function; the first
 * missing one (declared order) is named. Declared names are compared like
 * called ones (`_xlfn.SUM` is `SUM`), although the content schema already
 * refuses a prefixed or lowercase name.
 */
export const usesFunctions: Checker<"uses_functions"> = (check, _question, cells) =>
  everyFormula(cells, (formula, _reading, ref) => {
    const called = calledFunctions(formula);
    const missing = check.functions.map(functionName).find((name) => !called.has(name));
    return missing === undefined ? null : { kind: "missing_function", ref, function: missing };
  });

/**
 * What `ref` (written for the range's top-left cell) becomes in `cell`,
 * shifted as Excel's fill does (`$` parts stay put), in upper case; `null`
 * when the shift pushes it off the sheet (`#REF!`, which never matches).
 */
export function shiftedReference(ref: string, range: string, cell: string): string | null {
  const topLeft = parseCell(range.split(":")[0]);
  const at = parseCell(cell);
  if (topLeft === null || at === null) throw new Error(`Malformed answer range ${range} or cell ${cell}`);
  const shifted = shiftFormula(ref, at.row - topLeft.row, at.column - topLeft.column);
  return shifted.includes("#REF!") ? null : shifted.toUpperCase();
}

/** A sheet name token's name: as is, or unquoted (`'My ''Data'''` gives `My 'Data'`). */
function sheetNameOf(token: FormulaToken | undefined): string | null {
  if (token === undefined) return null;
  if (token.kind === "name") return token.text;
  if (token.kind === "quoted" && token.text.length >= 2 && token.text.endsWith("'")) {
    return token.text.slice(1, -1).replace(/''/g, "'");
  }
  return null;
}

/**
 * Whether `formula` holds the reference token `expected` exactly (same `$`
 * parts, same range), with no sheet prefix or with `sheet`'s own
 * (case-insensitive, quoted or not). Another sheet, an external workbook
 * (`[1]Data!`), a 3D reference (`Data:Data2!`), a deleted sheet
 * (`#REF!$L$2`) or a spill reference (`$L$2#`) does not count.
 */
export function hasReference(formula: string, expected: string, sheet: string): boolean {
  const tokens = solidTokens(formula);
  return tokens.some((token, i) => {
    if (token.kind !== "cells" || token.text.toUpperCase() !== expected.toUpperCase()) return false;
    if (tokens[i + 1]?.text === "#") return false;
    if (tokens[i - 1]?.kind === "error") return false;
    if (tokens[i - 1]?.text !== "!") return true;
    const name = sheetNameOf(tokens[i - 2]);
    if (name === null || name.toUpperCase() !== sheet.toUpperCase()) return false;
    const before = tokens[i - 3];
    return before === undefined || (before.kind !== "bracket" && before.text !== ":");
  });
}

/**
 * `uses_reference`: every formula refers to `ref`, shifted from the range's
 * top-left cell to that cell as Excel's fill does; otherwise `wrong_reference`
 * (the reason never names the reference: that is the hint's job). The anchor
 * of an array formula over several cells is `array_formula`: one formula over
 * whole ranges is not a formula that was copied.
 */
export const usesReference: Checker<"uses_reference"> = (check, question, cells) =>
  everyFormula(cells, (formula, reading, ref) => {
    if (reading.array === true) return { kind: "array_formula", ref };
    const expected = shiftedReference(check.ref, question.range, ref);
    return expected !== null && hasReference(formula, expected, question.sheet) ? null : { kind: "wrong_reference", ref };
  });

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

/**
 * `value_equals_key`: every answer cell's formula value equals its key. Per
 * cell, in order: `empty`, `typed_value`, `error_value` (an error such as
 * `#DIV/0!`), `not_calculated` (a formula without a cached value), then
 * `wrong_value` for any other mismatch.
 */
export const valueEqualsKey: Checker<"value_equals_key"> = (check, question, cells) =>
  everyFormula(cells, (_formula, reading, ref) => {
    if (reading.type === "error") return { kind: "error_value", ref };
    if (reading.value === null) return { kind: "not_calculated", ref };
    const key = Object.hasOwn(question.key, ref) ? question.key[ref] : undefined;
    return key !== undefined && valueMatches(reading, key, check.tolerance) ? null : { kind: "wrong_value", ref };
  });

/** Every declared check's checker, by name (total: a check name without one does not type-check). */
export const CHECKER_REGISTRY: { readonly [N in CheckName]: Checker<N> } = {
  formula_present: formulaPresent,
  not_hard_coded: notHardCoded,
  value_equals_key: valueEqualsKey,
  uses_functions: usesFunctions,
  uses_reference: usesReference,
};

/** Runs one declared check on a question's answer cells. */
export function runCheck(check: Check, question: ExamQuestion, cells: readonly AnswerCell[]): CheckOutcome {
  const checker = CHECKER_REGISTRY[check.name] as Checker;
  return checker(check as never, question, cells);
}
