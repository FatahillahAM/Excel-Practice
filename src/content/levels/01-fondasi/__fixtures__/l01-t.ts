import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { formulaCell, sharedFill, typedValue, writeFormulaCells, type FixtureCell } from "@/adapters/workbook/__fixtures__/formula-cells";
import { writeTablePart } from "@/adapters/workbook/__fixtures__/table-part";
import { generateExamWorkbook } from "@/adapters/workbook/generate";
import { expandRange } from "@/core/content/a1";
import {
  DATA_SHEET,
  SNAPSHOT_VERSION,
  examSnapshotSchema,
  generatedExamSchema,
  type ExamSnapshot,
  type GeneratedExam,
} from "@/core/content/level-module";
import { RESULT_VERSION, type Result } from "@/core/grading";
import { fondasi } from "..";
import { TEST_TIPS, levelTest } from "../test";
import { dataTable } from "./item-fixture";

/**
 * Test only: the golden fixtures of L01-T (AD-3, spine › fixtures), as
 * `l01-p1.ts` does for L01-P1. One exam (seed 7, scenario
 * `baut-sinar-presisi`, a fixed token that belongs to no attempt) generated
 * live from template v1 exactly as Start does.
 *
 * L01-T seed 7 (content version 4, 5.2 layout): 12 batches (Data rows
 * 2–13), column H empty, O2 = 960, products Q2:R5, S1:V1 = 0.04, 0.09,
 * 0.14, 0.19. Expected: I2 `=E2-F2`, J2 `=I2-$O$2`, K2
 * `=I2/SUM($I$2:$I$13)`, L2 `=RANK.EQ(I2,$I$2:$I$13)`, S2 `=$R2*(1+S$1)`,
 * and A1:G13 an Excel Table with O4 `=MAX(I2:I13)`.
 */

export const FIXTURE_SEED = 7;
export const FIXTURE_SCENARIO_ID = "baut-sinar-presisi";
/** `WHE_AttemptToken` of every fixture: "L01-T golden fixture token 00001" (32 bytes) in base64url; no attempt has it. */
export const FIXTURE_TOKEN = "TDAxLVQgZ29sZGVuIGZpeHR1cmUgdG9rZW4gMDAwMDE";
export const FIXTURE_SERVER_URL = "https://example.invalid";

/** Code-built variants: `blank` is the file sent for Excel; `correct`, `typed-values`, `wrong-function` mirror the three Excel files. */
export const VARIANTS = ["blank", "correct", "typed-values", "wrong-function", "no-table"] as const;

export type Variant = (typeof VARIANTS)[number];

function generated(): { exam: GeneratedExam; snapshot: ExamSnapshot } {
  const scenario = fondasi.scenarios.find((candidate) => candidate.id === FIXTURE_SCENARIO_ID);
  if (scenario === undefined) throw new Error(`Scenario ${FIXTURE_SCENARIO_ID} is gone`);
  const exam = generatedExamSchema.parse(levelTest.generate(FIXTURE_SEED, scenario));
  const snapshot = examSnapshotSchema.parse({
    version: SNAPSHOT_VERSION,
    contentVersion: fondasi.contentVersion,
    scenarioId: scenario.id,
    seed: FIXTURE_SEED,
    hintQuota: fondasi.hintQuota,
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

function keyOf(snapshot: ExamSnapshot, number: number): Record<string, number> {
  return snapshot.questions[number - 1].key as Record<string, number>;
}

/** `formula` (for the range's top-left cell) filled as Excel saves it, cached values from the key. */
function filled(snapshot: ExamSnapshot, number: number, si: number, formula: string): Cells {
  const values = keyOf(snapshot, number);
  return sharedFill(snapshot.questions[number - 1].range, si, formula, (ref) => values[ref]);
}

function correct(snapshot: ExamSnapshot): Cells {
  return {
    ...filled(snapshot, 1, 0, "E2-F2"),
    ...filled(snapshot, 2, 1, "I2-$O$2"),
    ...filled(snapshot, 3, 2, "I2/SUM($I$2:$I$13)"),
    ...filled(snapshot, 4, 3, "RANK.EQ(I2,$I$2:$I$13)"),
    ...filled(snapshot, 5, 4, "$R2*(1+S$1)"),
    O4: formulaCell("MAX(I2:I13)", keyOf(snapshot, 6).O4),
  };
}

function answers(variant: Variant, snapshot: ExamSnapshot): Cells {
  switch (variant) {
    case "blank":
      return {};
    case "correct":
      return correct(snapshot);
    case "typed-values":
      return {
        ...correct(snapshot),
        ...Object.fromEntries(Object.entries(keyOf(snapshot, 1)).map(([ref, value]) => [ref, typedValue(value)])),
      };
    case "wrong-function":
      return { ...correct(snapshot), O4: formulaCell("LARGE(I2:I13,1)", keyOf(snapshot, 6).O4) };
    case "no-table":
      return correct(snapshot);
  }
}

/**
 * The fixture workbook of `variant`: template v1 generated as Start does,
 * answer cells written as Excel saves them and, except in `blank` and
 * `no-table`, Table1 over A1:G13 as Ctrl+T saves it.
 */
export async function buildFixture(variant: Variant): Promise<Uint8Array> {
  const { exam, snapshot } = generated();
  const { bytes } = await generateExamWorkbook({ token: FIXTURE_TOKEN, serverUrl: FIXTURE_SERVER_URL, cells: exam.cells });
  const cells = answers(variant, snapshot);
  const answered = Object.keys(cells).length === 0 ? bytes : await writeFormulaCells(bytes, DATA_SHEET, cells);
  return variant === "blank" || variant === "no-table" ? answered : writeTablePart(answered, DATA_SHEET, dataTable(13));
}

export interface ExpectedGrade {
  score: number;
  correctCount: number;
  questions: { correct: boolean; reasonText: string | null }[];
}

const RIGHT = { correct: true, reasonText: null };
const wrong = (reasonText: string) => ({ correct: false, reasonText });
const ALL_RIGHT = [RIGHT, RIGHT, RIGHT, RIGHT, RIGHT, RIGHT];
const TYPED = { score: 85, correctCount: 5, questions: [wrong("Sel I2 berisi nilai yang diketik, bukan rumus."), RIGHT, RIGHT, RIGHT, RIGHT, RIGHT] };
const WRONG_FUNCTION = { score: 80, correctCount: 5, questions: [RIGHT, RIGHT, RIGHT, RIGHT, RIGHT, wrong("Rumus di O4 tidak memakai fungsi MAX.")] };

export const EXPECTED: Readonly<Record<Variant, ExpectedGrade>> = {
  blank: {
    score: 0,
    correctCount: 0,
    questions: [...["I2", "J2", "K2", "L2", "S2"].map((ref) => wrong(`Sel ${ref} masih kosong.`)), wrong("Data di A1:G13 belum dijadikan Excel Table.")],
  },
  correct: { score: 100, correctCount: 6, questions: ALL_RIGHT },
  "typed-values": TYPED,
  "wrong-function": WRONG_FUNCTION,
  "no-table": { score: 80, correctCount: 5, questions: [RIGHT, RIGHT, RIGHT, RIGHT, RIGHT, wrong("Data di A1:G13 belum dijadikan Excel Table.")] },
};

/** The Tips of questions 1–6, from the content constants (not from the snapshot under test). */
const EXPECTED_TIPS = Object.values(TEST_TIPS);

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
      tip: { ...EXPECTED_TIPS[i], shortcuts: [...EXPECTED_TIPS[i].shortcuts] },
    })),
  };
}

// ---------------------------------------------------------------------------
// Excel 2021 files (README.md): `buildFixture("blank")` opened, answered and
// saved by Excel 2021, committed as they are. Never written by code.

export const EXCEL_FIXTURES = ["l01-t-correct", "l01-t-typed-values", "l01-t-wrong-function"] as const;

export type ExcelFixture = (typeof EXCEL_FIXTURES)[number];

export const EXPECTED_EXCEL: Readonly<Record<ExcelFixture, ExpectedGrade>> = {
  "l01-t-correct": { score: 100, correctCount: 6, questions: ALL_RIGHT },
  "l01-t-typed-values": TYPED,
  "l01-t-wrong-function": WRONG_FUNCTION,
};

const excelPath = (name: ExcelFixture) => fileURLToPath(new URL(`./${name}.xlsm`, import.meta.url));

/**
 * SHA-256 of the three files Excel 2021 saved for 5.1 (content version 3,
 * answers in H:K, no Table question). They grade a different exam than
 * `fixtureSnapshot()` now generates, so they count as not committed until the
 * user replaces them with the re-saved 5.2 files (README.md › L01-T).
 */
export const STALE_5_1_SHA256: ReadonlySet<string> = new Set([
  "1bdc8b1a6be30724ef7dc90956b43e68c38ec6b96ebac15277a3c962201223cc",
  "2b9d9aed721e5501acae50d6c0a376b8891ec79ff1704887a51e01ad5861b714",
  "535bf3e47443ad57f0044e301a72b29093ac7e7005e83d948c87106a58c2ef07",
]);

/** Whether every Excel-saved L01-T file of the current layout is committed (until then their golden tests skip). */
export function excelFixturesPresent(): boolean {
  return EXCEL_FIXTURES.every((name) => {
    const file = excelPath(name);
    return existsSync(file) && !STALE_5_1_SHA256.has(createHash("sha256").update(readFileSync(file)).digest("hex"));
  });
}

/** The committed bytes of an Excel-saved fixture. */
export async function readExcelFixture(name: ExcelFixture): Promise<Uint8Array> {
  return Uint8Array.from(await readFile(excelPath(name)));
}

/** The Data cells the drift guard compares: A1:G13, O2, Q2:R5 and S1:V1, as `fixtureCells()` generates them now. */
export function driftGuardCells(): Record<string, number | string> {
  const data = fixtureCells()[DATA_SHEET];
  const refs = [...expandRange("A1:G13")!, "O2", ...expandRange("Q2:R5")!, ...expandRange("S1:V1")!];
  return Object.fromEntries(
    refs.map((ref) => {
      const value = data[ref];
      if (value === undefined) throw new Error(`driftGuardCells: generated Data has no ${ref}`);
      return [ref, value];
    }),
  );
}
