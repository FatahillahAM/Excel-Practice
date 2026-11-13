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
 *   fill does (`$` parts stay fixed). `ref` itself has no sheet; in the
 *   student's formula the reference may carry the question's own sheet prefix
 *   (`Data!$L$2`, `'Data'!$L$2`), never another sheet's.
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
 * Function names only Microsoft 365 has (`level-curriculum.md` › Dilarang,
 * plus the other Microsoft 365-only functions): Excel 2021 cannot run them, so
 * no question, Instructions text, hint, Tip or level function list may name them.
 */
export const M365_ONLY_FUNCTIONS = [
  "LAMBDA",
  "TEXTSPLIT",
  "VSTACK",
  "HSTACK",
  "TAKE",
  "DROP",
  "GROUPBY",
  "PIVOTBY",
  "TEXTBEFORE",
  "TEXTAFTER",
  "TOCOL",
  "TOROW",
  "WRAPROWS",
  "WRAPCOLS",
  "CHOOSEROWS",
  "CHOOSECOLS",
  "EXPAND",
  "BYROW",
  "BYCOL",
  "MAP",
  "REDUCE",
  "SCAN",
  "MAKEARRAY",
  "ISOMITTED",
  "IMAGE",
  "REGEXTEST",
  "REGEXEXTRACT",
  "REGEXREPLACE",
  "PERCENTOF",
  "TRIMRANGE",
] as const;

const M365_NAMES = M365_ONLY_FUNCTIONS.join("|");
// Not part of a longer or dotted name (`XTAKE`, `T.TAKE`, `TAKE.X`); a sentence's full stop still ends the word.
const BEFORE = "(?<![A-Za-z0-9_]|[A-Za-z0-9_]\\.)";
// Either the bare name in uppercase (`pakai VSTACK`, `=TAKE(`), or the name in any case written as a
// call (`=take(`, `Take(`): ordinary prose (`take a break`, `peta map`) does not match.
const M365_RE = new RegExp(
  `${BEFORE}(?:(${M365_NAMES})(?=\\()|(${M365_NAMES})(?![A-Za-z0-9_]|\\.[A-Za-z0-9_]))`,
  "gi",
);
const UPPERCASE_NAME = new Set<string>(M365_ONLY_FUNCTIONS);

/**
 * The Microsoft 365-only function names in `text` (in uppercase), each once, in
 * order of appearance: whole words in uppercase, as Excel names are written in
 * content (`pakai VSTACK`), or a call in any case (`=take(A1:A9,3)`, `Lambda(x`).
 * Lowercase or capitalized prose without a `(` does not match.
 */
export function findM365Functions(text: string): string[] {
  const names: string[] = [];
  for (const match of text.matchAll(M365_RE)) {
    // A call counts in any case; the bare-word branch matched case-insensitively and counts only in uppercase.
    const name = match[1] !== undefined ? match[1].toUpperCase() : UPPERCASE_NAME.has(match[2]) ? match[2] : null;
    if (name !== null) names.push(name);
  }
  return [...new Set(names)];
}
