import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { typedValue } from "@/adapters/workbook/__fixtures__/formula-cells";
import { expandRange } from "@/core/content/a1";
import { DATA_SHEET } from "@/core/content/level-module";
import { TEST_TIPS, levelTest } from "../test";
import { RIGHT, fixtureToken, itemFixture, wrong, type Cells, type ExpectedGrade } from "./item-fixture";

/**
 * Test only: the golden fixtures of L02-T. Seed 7, `kemasan-karton-prima`:
 * 12 batches (Data A1:G13), O2 = 1250, O3 = 23, O4 = 10. Expected: H2
 * `=IF(E2>=$O$2,"Capai","Kurang")`, I2 `=IF(AND(E2>=$O$2,F2<=$O$3),"Lolos","Tahan")`,
 * J2 `=IF(OR(F2>$O$3,G2>$O$4),"Ya","Tidak")`, K2 `=IFS(F2=0,"A",F2<=$O$3,"B",TRUE,"C")`,
 * L2 `=IFERROR(E2/F2,"Tanpa Cacat")`, M2 `=IF(G2>$O$4,"Cek mesin","")`.
 * The Excel-saved files (README.md › L02-T) skip until the user commits them.
 */

export const FIXTURE = itemFixture(levelTest, fixtureToken("L02-T golden fixture token 00001"));
export const FIXTURE_TOKEN = FIXTURE.token;
export const TIPS_IN_ORDER = Object.values(TEST_TIPS);

export const VARIANTS = ["blank", "correct", "nested-if", "typed-values", "wrong-function"] as const;
export type Variant = (typeof VARIANTS)[number];

function correct(): Cells {
  return {
    ...FIXTURE.filled(1, 0, 'IF(E2>=$O$2,"Capai","Kurang")'),
    ...FIXTURE.filled(2, 1, 'IF(AND(E2>=$O$2,F2<=$O$3),"Lolos","Tahan")'),
    ...FIXTURE.filled(3, 2, 'IF(OR(F2>$O$3,G2>$O$4),"Ya","Tidak")'),
    ...FIXTURE.filled(4, 3, '_xlfn.IFS(F2=0,"A",F2<=$O$3,"B",TRUE,"C")'),
    ...FIXTURE.filled(5, 4, 'IFERROR(E2/F2,"Tanpa Cacat")'),
    ...FIXTURE.filled(6, 5, 'IF(G2>$O$4,"Cek mesin","")'),
  };
}

/** The fixture workbook of `variant`. `blank` is the file sent for Excel (no answers). */
export async function buildFixture(variant: Variant): Promise<Uint8Array> {
  switch (variant) {
    case "blank":
      return FIXTURE.build({});
    case "correct":
      return FIXTURE.build(correct());
    case "nested-if":
      // Question 4 accepts nested IF as well as IFS.
      return FIXTURE.build({ ...correct(), ...FIXTURE.filled(4, 3, 'IF(F2=0,"A",IF(F2<=$O$3,"B","C"))') });
    case "typed-values":
      // Paste Values over H2:H13.
      return FIXTURE.build({ ...correct(), ...Object.fromEntries(Object.entries(FIXTURE.keyOf(1)).map(([ref, value]) => [ref, typedValue(value)])) });
    case "wrong-function":
      // The right values in L, but through IF testing for 0 instead of IFERROR.
      return FIXTURE.build({ ...correct(), ...FIXTURE.filled(5, 4, 'IF(F2=0,"Tanpa Cacat",E2/F2)') });
  }
}

const ALL_RIGHT = [RIGHT, RIGHT, RIGHT, RIGHT, RIGHT, RIGHT];
const TYPED: ExpectedGrade = { score: 85, correctCount: 5, questions: [wrong("Sel H2 berisi nilai yang diketik, bukan rumus."), RIGHT, RIGHT, RIGHT, RIGHT, RIGHT] };
const WRONG_FUNCTION: ExpectedGrade = { score: 80, correctCount: 5, questions: [RIGHT, RIGHT, RIGHT, RIGHT, wrong("Rumus di L2 tidak memakai fungsi IFERROR."), RIGHT] };

export const EXPECTED: Readonly<Record<Variant, ExpectedGrade>> = {
  blank: { score: 0, correctCount: 0, questions: ["H2", "I2", "J2", "K2", "L2", "M2"].map((ref) => wrong(`Sel ${ref} masih kosong.`)) },
  correct: { score: 100, correctCount: 6, questions: ALL_RIGHT },
  "nested-if": { score: 100, correctCount: 6, questions: ALL_RIGHT },
  "typed-values": TYPED,
  "wrong-function": WRONG_FUNCTION,
};

// ---------------------------------------------------------------------------
// Excel 2021 files (README.md › L02-T): `buildFixture("blank")` opened,
// answered and saved by Excel 2021, committed as they are. Never written by code.

export const EXCEL_FIXTURES = ["l02-t-correct", "l02-t-typed-values", "l02-t-wrong-function"] as const;
export type ExcelFixture = (typeof EXCEL_FIXTURES)[number];

export const EXPECTED_EXCEL: Readonly<Record<ExcelFixture, ExpectedGrade>> = {
  "l02-t-correct": { score: 100, correctCount: 6, questions: ALL_RIGHT },
  "l02-t-typed-values": TYPED,
  "l02-t-wrong-function": WRONG_FUNCTION,
};

const excelPath = (name: ExcelFixture) => fileURLToPath(new URL(`./${name}.xlsm`, import.meta.url));

/** Whether every Excel-saved L02-T file is committed: `false` (golden tests skip) when none is; throws (the suite fails) when only some are. */
export function excelFixturesPresent(): boolean {
  const present = EXCEL_FIXTURES.filter((name) => existsSync(excelPath(name)));
  if (present.length === 0) return false;
  if (present.length < EXCEL_FIXTURES.length) {
    const missing = EXCEL_FIXTURES.filter((name) => !present.includes(name));
    throw new Error(`L02-T Excel fixtures are incomplete: ${present.join(", ")} committed, ${missing.join(", ")} missing (README.md › L02-T)`);
  }
  return true;
}

export async function readExcelFixture(name: ExcelFixture): Promise<Uint8Array> {
  return Uint8Array.from(await readFile(excelPath(name)));
}

/** The Data cells the drift guard compares: the batches A1:G13 and the parameters N2:O4, as generated now. */
export function driftGuardCells(): Record<string, number | string> {
  const data = FIXTURE.cells()[DATA_SHEET];
  return Object.fromEntries(
    [...expandRange("A1:G13")!, ...expandRange("N2:O4")!].map((ref) => {
      const value = data[ref];
      if (value === undefined) throw new Error(`driftGuardCells: generated Data has no ${ref}`);
      return [ref, value];
    }),
  );
}
