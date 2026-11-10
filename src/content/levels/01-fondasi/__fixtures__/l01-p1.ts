import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  arrayFill,
  formulaCell,
  sharedFill,
  typedValue,
  writeFormulaCells,
  type FixtureCell,
} from "@/adapters/workbook/__fixtures__/formula-cells";
import { generateExamWorkbook } from "@/adapters/workbook/generate";
import { expandRange, parseCell } from "@/core/content/a1";
import {
  DATA_SHEET,
  examSnapshotSchema,
  generatedExamSchema,
  type ExamSnapshot,
  type GeneratedExam,
} from "@/core/content/level-module";
import { shiftFormula } from "@/core/grading/formula";
import { RESULT_VERSION, type Result } from "@/core/grading";
import { fondasi } from "..";
import { practice1 } from "../practice-1";

/**
 * Test only: the golden fixtures of L01-P1 (AD-3, spine › fixtures). One exam
 * (seed 7, scenario `baut-sinar-presisi`, a fixed token that belongs to no
 * attempt) generated live from template v1 exactly as Start does, with answer
 * cells written the way Excel saves them (`formula-cells.ts`). Each variant
 * has its expected `Result` in `EXPECTED`; the golden suite reads every
 * variant with `readWorkbook` and grades it, the parity suite posts the same
 * bytes through the macro and upload routes.
 *
 * L01-P1 seed 7: 12 batches (Data rows 2–13), L2 = 129, O1:R1 = 0.04, 0.06,
 * 0.08, 0.1, grid O2:R5. Expected top-cell formulas: H2 `=E2*G2`,
 * I2 `=E2*$L$2`, J2 `=E2/SUM($E$2:$E$13)`, O2 `=$N2*(1+O$1)`.
 */

export const FIXTURE_SEED = 7;
export const FIXTURE_SCENARIO_ID = "baut-sinar-presisi";
/** `WHE_AttemptToken` of every fixture: "L01-P1 golden fixture token 0001" (32 bytes) in base64url; no attempt has it. */
export const FIXTURE_TOKEN = "TDAxLVAxIGdvbGRlbiBmaXh0dXJlIHRva2VuIDAwMDE";
export const FIXTURE_SERVER_URL = "https://example.invalid";

export const VARIANTS = [
  "blank",
  "correct",
  "valid-variants",
  "typed-values",
  "hard-coded",
  "wrong-function",
  "wrong-reference",
  "error",
  "not-calculated",
  "array",
  "tolerance",
] as const;

export type Variant = (typeof VARIANTS)[number];

function generated(): { exam: GeneratedExam; snapshot: ExamSnapshot } {
  const scenario = fondasi.scenarios.find((candidate) => candidate.id === FIXTURE_SCENARIO_ID);
  if (scenario === undefined) throw new Error(`Scenario ${FIXTURE_SCENARIO_ID} is gone`);
  const exam = generatedExamSchema.parse(practice1.generate(FIXTURE_SEED, scenario));
  const snapshot = examSnapshotSchema.parse({
    contentVersion: fondasi.contentVersion,
    scenarioId: scenario.id,
    seed: FIXTURE_SEED,
    questions: exam.questions,
  } satisfies ExamSnapshot);
  return { exam, snapshot };
}

/** The attempt's snapshot as Start writes it (`start-actions.ts`), schema-validated. */
export function fixtureSnapshot(): ExamSnapshot {
  return generated().snapshot;
}

/** The exam's generated cells (Instructions and Data) as Start patches them into the template. */
export function fixtureCells(): GeneratedExam["cells"] {
  return generated().exam.cells;
}

type Cells = Record<string, FixtureCell>;

/** The answer key of question `number` (1-based). */
function keyOf(snapshot: ExamSnapshot, number: number): Record<string, number> {
  return snapshot.questions[number - 1].key as Record<string, number>;
}

/** `formula` (for the range's top-left cell) filled as Excel saves it, cached values from `values`. */
function filled(snapshot: ExamSnapshot, number: number, si: number, formula: string, values = keyOf(snapshot, number)): Cells {
  return sharedFill(snapshot.questions[number - 1].range, si, formula, (ref) => values[ref]);
}

/** Rows and columns from `top` to `ref` (`Z2` to `AA3` is 1, 1): what a copy shifts a formula by. */
export function fillOffset(top: string, ref: string): { dRow: number; dCol: number } {
  const from = parseCell(top);
  const to = parseCell(ref);
  if (from === null || to === null) throw new Error(`fillOffset: bad cell ${top} or ${ref}`);
  return { dRow: to.row - from.row, dCol: to.column - from.column };
}

/**
 * `formula` (for the range's top-left cell) typed into every cell of question
 * `number` for which `where` holds, shifted as a copy would; each cell its own
 * `<f>` (no shared form).
 */
function perCell(
  snapshot: ExamSnapshot,
  number: number,
  formula: string,
  where: (ref: string) => boolean = () => true,
  values = keyOf(snapshot, number),
): Cells {
  const refs = expandRange(snapshot.questions[number - 1].range)!;
  const cells: Cells = {};
  for (const ref of refs.filter(where)) {
    const { dRow, dCol } = fillOffset(refs[0], ref);
    cells[ref] = formulaCell(shiftFormula(formula, dRow, dCol), values[ref]);
  }
  return cells;
}

const rowOf = (ref: string) => parseCell(ref)!.row;

/** Answers that pass every check, as Excel saves them: one formula per question, filled (shared formulas). */
function correct(snapshot: ExamSnapshot): Cells {
  return {
    ...filled(snapshot, 1, 0, "E2*G2"),
    ...filled(snapshot, 2, 1, "E2*$L$2"),
    ...filled(snapshot, 3, 2, "E2/SUM($E$2:$E$13)"),
    ...filled(snapshot, 4, 3, "$N2*(1+O$1)"),
  };
}

const scaled = (values: Record<string, number>, factor: (ref: string) => number) =>
  Object.fromEntries(Object.entries(values).map(([ref, value]) => [ref, value * factor(ref)]));

function answers(variant: Variant, snapshot: ExamSnapshot): Cells {
  switch (variant) {
    case "blank":
      return {};
    case "correct":
      return correct(snapshot);
    case "valid-variants":
      return {
        ...filled(snapshot, 1, 0, "G2*E2"),
        // Reversed operands in I2:I7, the sheet's own prefix in I8:I13.
        ...perCell(snapshot, 2, "$L$2*E2", (ref) => rowOf(ref) <= 7),
        ...perCell(snapshot, 2, "Data!E2*Data!$L$2", (ref) => rowOf(ref) >= 8),
        ...perCell(snapshot, 3, "e2 / sum( $e$2:$e$13 )"),
        ...filled(snapshot, 4, 3, "'Data'!$N2 * (1 + O$1)"),
      };
    case "typed-values":
      return {
        ...correct(snapshot),
        ...Object.fromEntries(Object.entries(keyOf(snapshot, 1)).map(([ref, value]) => [ref, typedValue(value)])),
      };
    case "hard-coded":
      // H2 typed as the product of the two numbers (right value), the rest filled from H3.
      return {
        ...correct(snapshot),
        ...perCell(snapshot, 1, "E2*G2"),
        H2: formulaCell("1159*1123.51", keyOf(snapshot, 1).H2),
      };
    case "wrong-function":
      return { ...correct(snapshot), ...filled(snapshot, 3, 2, "E2/(AVERAGE($E$2:$E$13)*COUNT($E$2:$E$13))") };
    case "wrong-reference":
      return { ...correct(snapshot), ...filled(snapshot, 2, 1, "E2*L$2") };
    case "error": {
      const divided = Object.fromEntries(Object.keys(keyOf(snapshot, 3)).map((ref) => [ref, { error: "#DIV/0!" }]));
      return {
        ...correct(snapshot),
        ...perCell(snapshot, 1, "E2*G2"),
        H5: formulaCell("E5*#REF!", { error: "#REF!" }),
        ...sharedFill(snapshot.questions[2].range, 2, "E2/SUM($F$20:$F$31)", (ref) => divided[ref] as { error: string }),
        ...perCell(snapshot, 4, "$N2*(1+O$1)"),
        R5: formulaCell("$N5*(1+R$1)*NA()", { error: "#N/A" }),
      };
    }
    case "array":
      // H2:H13 as one array formula (Ctrl+Shift+Enter, or a dynamic array that spilled): not copied.
      return {
        ...correct(snapshot),
        ...arrayFill(snapshot.questions[0].range, "E2:E13*G2:G13", (ref) => keyOf(snapshot, 1)[ref]),
      };
    case "not-calculated":
      // Saved without calculating after the grid was entered: no cached values in O2:R5.
      return { ...correct(snapshot), ...sharedFill(snapshot.questions[3].range, 3, "$N2*(1+O$1)", () => null) };
    case "tolerance":
      return {
        ...correct(snapshot),
        // Within 1e-9 × |key|: still correct.
        ...filled(snapshot, 1, 0, "E2*G2", scaled(keyOf(snapshot, 1), () => 1 + 5e-10)),
        // Beyond it at I3 only.
        ...filled(snapshot, 2, 1, "E2*$L$2", scaled(keyOf(snapshot, 2), (ref) => (ref === "I3" ? 1 + 2e-9 : 1))),
      };
  }
}

/** The fixture workbook of `variant`: template v1 generated as Start does, answer cells written as Excel saves them. */
export async function buildFixture(variant: Variant): Promise<Uint8Array> {
  const { exam, snapshot } = generated();
  const { bytes } = await generateExamWorkbook({ token: FIXTURE_TOKEN, serverUrl: FIXTURE_SERVER_URL, cells: exam.cells });
  const cells = answers(variant, snapshot);
  return Object.keys(cells).length === 0 ? bytes : writeFormulaCells(bytes, DATA_SHEET, cells);
}

/** What a variant grades to: score, correct count and, per question, `correct` and the exact reason. */
export interface ExpectedGrade {
  score: number;
  correctCount: number;
  questions: { correct: boolean; reasonText: string | null }[];
}

const RIGHT = { correct: true, reasonText: null };
const wrong = (reasonText: string) => ({ correct: false, reasonText });

export const EXPECTED: Readonly<Record<Variant, ExpectedGrade>> = {
  blank: {
    score: 0,
    correctCount: 0,
    questions: [
      wrong("Sel H2 masih kosong."),
      wrong("Sel I2 masih kosong."),
      wrong("Sel J2 masih kosong."),
      wrong("Sel O2 masih kosong."),
    ],
  },
  correct: { score: 100, correctCount: 4, questions: [RIGHT, RIGHT, RIGHT, RIGHT] },
  "valid-variants": { score: 100, correctCount: 4, questions: [RIGHT, RIGHT, RIGHT, RIGHT] },
  "typed-values": {
    score: 80,
    correctCount: 3,
    questions: [wrong("Sel H2 berisi nilai yang diketik, bukan rumus."), RIGHT, RIGHT, RIGHT],
  },
  "hard-coded": {
    score: 80,
    correctCount: 3,
    questions: [wrong("Rumus di H2 hanya berisi angka, tidak merujuk sel."), RIGHT, RIGHT, RIGHT],
  },
  "wrong-function": {
    score: 75,
    correctCount: 3,
    questions: [RIGHT, RIGHT, wrong("Rumus di J2 tidak memakai fungsi SUM."), RIGHT],
  },
  "wrong-reference": {
    score: 75,
    correctCount: 3,
    questions: [
      RIGHT,
      wrong("Rumus di I2 belum memakai referensi sel yang diminta, jadi hasilnya bisa salah saat disalin."),
      RIGHT,
      RIGHT,
    ],
  },
  error: {
    score: 25,
    correctCount: 1,
    questions: [
      wrong("Rumus di H5 menghasilkan error."),
      RIGHT,
      wrong("Rumus di J2 menghasilkan error."),
      wrong("Rumus di R5 menghasilkan error."),
    ],
  },
  array: {
    score: 80,
    correctCount: 3,
    questions: [wrong("Sel H3 berisi hasil rumus array; tulis satu rumus biasa lalu salin ke sel lainnya."), RIGHT, RIGHT, RIGHT],
  },
  "not-calculated": {
    score: 70,
    correctCount: 3,
    questions: [RIGHT, RIGHT, RIGHT, wrong("Rumus di O2 belum dihitung oleh Excel.")],
  },
  tolerance: {
    score: 75,
    correctCount: 3,
    questions: [RIGHT, wrong("Hasil di I3 belum sesuai."), RIGHT, RIGHT],
  },
};

/** The full `Result` a code-built variant grades to with no hints (what the grading path writes). */
export function expectedResult(variant: Variant, snapshot: ExamSnapshot = fixtureSnapshot()): Result {
  return resultOf(EXPECTED[variant], snapshot);
}

/** The full `Result` an `ExpectedGrade` stands for, with no hints. */
export function resultOf(expected: ExpectedGrade, snapshot: ExamSnapshot = fixtureSnapshot()): Result {
  const pointsEarned = snapshot.questions.reduce((sum, q, i) => sum + (expected.questions[i].correct ? q.points : 0), 0);
  return {
    version: RESULT_VERSION,
    contentVersion: snapshot.contentVersion,
    scenarioId: snapshot.scenarioId,
    hintsUsed: 0,
    hintPenalty: 0,
    pointsEarned,
    score: expected.score,
    correctCount: expected.correctCount,
    questionCount: snapshot.questions.length,
    questions: snapshot.questions.map((q, i) => ({
      number: q.number,
      points: q.points,
      pointsAwarded: expected.questions[i].correct ? q.points : 0,
      correct: expected.questions[i].correct,
      reasonText: expected.questions[i].reasonText,
      tip: null,
    })),
  };
}

// ---------------------------------------------------------------------------
// Excel 2021 files (README.md): `buildFixture("blank")` opened, answered and
// saved by Excel 2021, committed as they are. Never written by code.

export const EXCEL_FIXTURES = ["l01-p1-correct", "l01-p1-typed-values", "l01-p1-wrong-function"] as const;

export type ExcelFixture = (typeof EXCEL_FIXTURES)[number];

export const EXPECTED_EXCEL: Readonly<Record<ExcelFixture, ExpectedGrade>> = {
  "l01-p1-correct": { score: 100, correctCount: 4, questions: [RIGHT, RIGHT, RIGHT, RIGHT] },
  "l01-p1-typed-values": {
    score: 80,
    correctCount: 3,
    questions: [wrong("Sel H2 berisi nilai yang diketik, bukan rumus."), RIGHT, RIGHT, RIGHT],
  },
  "l01-p1-wrong-function": {
    score: 75,
    correctCount: 3,
    questions: [RIGHT, RIGHT, wrong("Rumus di J2 tidak memakai fungsi SUM."), RIGHT],
  },
};

/** The committed bytes of an Excel-saved fixture. */
export async function readExcelFixture(name: ExcelFixture): Promise<Uint8Array> {
  return Uint8Array.from(await readFile(fileURLToPath(new URL(`./${name}.xlsm`, import.meta.url))));
}

/**
 * The Data cells the drift guard compares (plan: A1:G13, L2, M2:N5, O1:R1):
 * the generated batches, the overhead rate, the product grid and the cost
 * increases, as `fixtureCells()` generates them now.
 */
export function driftGuardCells(): Record<string, number | string> {
  const data = fixtureCells()[DATA_SHEET];
  const refs = [...expandRange("A1:G13")!, "L2", ...expandRange("M2:N5")!, ...expandRange("O1:R1")!];
  return Object.fromEntries(
    refs.map((ref) => {
      const value = data[ref];
      if (value === undefined) throw new Error(`driftGuardCells: generated Data has no ${ref}`);
      return [ref, value];
    }),
  );
}
