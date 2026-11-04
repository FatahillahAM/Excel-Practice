import { z } from "zod";

/**
 * Checks a question declares (AD-3): a checker name from this list plus its
 * parameters. Level modules only declare them; the checker implementations and
 * `grade()` are epic 3's (`src/core/grading`), and read this same list.
 */

/** `$A$1`, `A$1`, `$A1`, `A1`, or a range of two of them (`$E$2:$E$13`). */
const REF_PART = String.raw`\$?[A-Z]{1,3}\$?[1-9]\d{0,6}`;
export const REFERENCE_RE = new RegExp(`^${REF_PART}(:${REF_PART})?$`);

/** An Excel function name as Excel writes it (`SUM`, `COUNTIFS`, `T.TEST`). */
export const FUNCTION_NAME_RE = /^[A-Z][A-Z0-9]*(\.[A-Z0-9]+)*$/;

/**
 * The checkers and their parameters:
 * - `formula_present`: every answer cell holds a formula.
 * - `not_hard_coded`: the formula refers to cells, it is not a typed number (`=1250`).
 * - `value_equals_key`: each cell's value equals the key, within
 *   `tolerance × max(1, |key|)` for numbers (relative), exactly for text.
 * - `uses_functions`: the formula of every answer cell calls each of `functions`.
 * - `uses_reference`: the formula refers to `ref` as it must appear in the
 *   range's top-left cell; for the other cells the checker shifts it as Excel's
 *   fill does (`$` parts stay fixed). A sheet prefix (`Data!`) is allowed.
 */
export const CHECKERS = {
  formula_present: z.object({ name: z.literal("formula_present") }).strict(),
  not_hard_coded: z.object({ name: z.literal("not_hard_coded") }).strict(),
  value_equals_key: z
    .object({ name: z.literal("value_equals_key"), tolerance: z.number().finite().min(0).max(0.01) })
    .strict(),
  uses_functions: z
    .object({ name: z.literal("uses_functions"), functions: z.array(z.string().regex(FUNCTION_NAME_RE)).min(1) })
    .strict(),
  uses_reference: z.object({ name: z.literal("uses_reference"), ref: z.string().regex(REFERENCE_RE) }).strict(),
} as const;

export type CheckName = keyof typeof CHECKERS;
export const CHECK_NAMES = Object.keys(CHECKERS) as CheckName[];

export const checkSchema = z.discriminatedUnion("name", [
  CHECKERS.formula_present,
  CHECKERS.not_hard_coded,
  CHECKERS.value_equals_key,
  CHECKERS.uses_functions,
  CHECKERS.uses_reference,
]);

export type Check = z.infer<typeof checkSchema>;

/**
 * The default relative tolerance of `value_equals_key`. Keys are doubles
 * computed like Excel computes the expected formula, but a product such as
 * 12178.14 × 1.04 is not exact in binary floating point and Excel may round
 * differently, so the checker compares within this tolerance, never exactly.
 */
export const KEY_TOLERANCE = 1e-9;

/**
 * Function names only Microsoft 365 has (`level-curriculum.md` › Dilarang):
 * Excel 2021 cannot run them, so no question, Instructions text, hint, Tip or
 * level function list may name them.
 */
export const M365_ONLY_FUNCTIONS = ["LAMBDA", "TEXTSPLIT", "VSTACK", "HSTACK", "TAKE", "DROP", "GROUPBY", "PIVOTBY"] as const;

// Whole word: no letter, digit or `_` around it, and not part of a dotted name (`T.TAKE`, `TAKE.X`);
// a sentence's full stop still ends the word.
const M365_RE = new RegExp(
  `(?<![A-Za-z0-9_]|[A-Za-z0-9_]\\.)(${M365_ONLY_FUNCTIONS.join("|")})(?![A-Za-z0-9_]|\\.[A-Za-z0-9_])`,
  "g",
);

/**
 * The Microsoft 365-only function names in `text`, each once, in order of
 * appearance: whole words in uppercase, as Excel names are written in content
 * (`=TAKE(`, `pakai VSTACK`); Indonesian or English prose in lowercase does not match.
 */
export function findM365Functions(text: string): string[] {
  return [...new Set(Array.from(text.matchAll(M365_RE), (match) => match[1]))];
}
