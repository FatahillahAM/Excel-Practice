import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { sharedFill, typedValue } from "@/adapters/workbook/__fixtures__/formula-cells";
import { expandRange } from "@/core/content/a1";
import { DATA_SHEET } from "@/core/content/level-module";
import { P1_TIPS, practice1 } from "../practice-1";
import { RIGHT, fixtureToken, itemFixture, wrong, type Cells, type ExpectedGrade } from "./item-fixture";

/**
 * Test only: the golden fixtures of L02-P1 (IF). Seed 7,
 * `kemasan-karton-prima`: 12 batches (Data A1:G13), O2 = 1250, O3 = 23,
 * O4 = 10. Expected: H2 `=IF(E2>=$O$2,"Capai","Kurang")`, I2
 * `=IF(F2>$O$3,"NG","OK")`, J2 `=IF(E2>$O$2,E2-$O$2,0)`, K2
 * `=IF(G2>$O$4,"Cek mesin","")` (K2, K3, K6, K9 and K10 are Excel's own ""
 * result). The Excel-saved files (README.md › L02-P1) skip until the user
 * commits them; they also settle whether Excel 2021 saves a "" result as
 * `t="str"` with an empty `<v>` (plan › Open Questions).
 */

export const FIXTURE = itemFixture(practice1, fixtureToken("L02-P1 golden fixture token 0001"));
export const FIXTURE_TOKEN = FIXTURE.token;
export const TIPS_IN_ORDER = [P1_TIPS.args, P1_TIPS.quotes, P1_TIPS.calc, P1_TIPS.blank];

export const VARIANTS = ["blank", "correct", "ifs", "typed-values", "unknown-function", "empty-text-cache"] as const;
export type Variant = (typeof VARIANTS)[number];

/** As the README asks: one formula per column, filled down (Excel saves a fill as a shared formula). */
function correct(): Cells {
  return {
    ...FIXTURE.filled(1, 0, 'IF(E2>=$O$2,"Capai","Kurang")'),
    ...FIXTURE.filled(2, 1, 'IF(F2>$O$3,"NG","OK")'),
    ...FIXTURE.filled(3, 2, "IF(E2>$O$2,E2-$O$2,0)"),
    ...FIXTURE.filled(4, 3, 'IF(G2>$O$4,"Cek mesin","")'),
  };
}

/** The fixture workbook of `variant`. `blank` is the file sent for Excel (no answers). */
export async function buildFixture(variant: Variant): Promise<Uint8Array> {
  switch (variant) {
    case "blank":
      return FIXTURE.build({});
    case "correct":
      return FIXTURE.build(correct());
    case "ifs":
      // IFS gives the same answers; Excel 2021 saves it with the _xlfn. prefix. No question requires IF.
      return FIXTURE.build({ ...correct(), ...FIXTURE.filled(1, 0, '_xlfn.IFS(E2>=$O$2,"Capai",TRUE,"Kurang")') });
    case "typed-values":
      // Paste Values over H2:H13.
      return FIXTURE.build({ ...correct(), ...Object.fromEntries(Object.entries(FIXTURE.keyOf(1)).map(([ref, value]) => [ref, typedValue(value)])) });
    case "unknown-function":
      // A misspelled IF: Excel saves an unknown name with _xludf. and shows #NAME? in every cell.
      return FIXTURE.build({ ...correct(), ...FIXTURE.filled(1, 0, '_xludf.IFF(E2>=$O$2,"Capai","Kurang")', Object.fromEntries(expandRange("H2:H13")!.map((ref) => [ref, { error: "#NAME?" }]))) });
    case "empty-text-cache":
      // A writer that did not calculate: every K cell a text formula with an empty cache (t="str", <v></v>).
      return FIXTURE.build({ ...correct(), ...sharedFill("K2:K13", 3, 'IF(G2>$O$4,"Cek mesin","")', () => "") });
  }
}

const ALL_RIGHT = [RIGHT, RIGHT, RIGHT, RIGHT];
const TYPED: ExpectedGrade = { score: 75, correctCount: 3, questions: [wrong("Sel H2 berisi nilai yang diketik, bukan rumus."), RIGHT, RIGHT, RIGHT] };

export const EXPECTED: Readonly<Record<Variant, ExpectedGrade>> = {
  blank: { score: 0, correctCount: 0, questions: ["H2", "I2", "J2", "K2"].map((ref) => wrong(`Sel ${ref} masih kosong.`)) },
  correct: { score: 100, correctCount: 4, questions: ALL_RIGHT },
  ifs: { score: 100, correctCount: 4, questions: ALL_RIGHT },
  "typed-values": TYPED,
  "unknown-function": {
    score: 75,
    correctCount: 3,
    questions: [wrong("Excel tidak mengenali nama fungsi di rumus H2, jadi hasilnya #NAME?. Cek ejaan nama fungsinya."), RIGHT, RIGHT, RIGHT],
  },
  // K2 and K3 hold Excel's "" (key ""), so the first cell that should read "Cek mesin" decides: not calculated, not wrong.
  "empty-text-cache": { score: 75, correctCount: 3, questions: [RIGHT, RIGHT, RIGHT, wrong("Rumus di K4 belum dihitung oleh Excel.")] },
};

// ---------------------------------------------------------------------------
// Excel 2021 files (README.md › L02-P1): `buildFixture("blank")` opened,
// answered and saved by Excel 2021, committed as they are. Never written by code.

export const EXCEL_FIXTURES = ["l02-p1-correct", "l02-p1-typed-values"] as const;
export type ExcelFixture = (typeof EXCEL_FIXTURES)[number];

export const EXPECTED_EXCEL: Readonly<Record<ExcelFixture, ExpectedGrade>> = {
  "l02-p1-correct": { score: 100, correctCount: 4, questions: ALL_RIGHT },
  "l02-p1-typed-values": TYPED,
};

const excelPath = (name: ExcelFixture) => fileURLToPath(new URL(`./${name}.xlsm`, import.meta.url));

/** Whether every Excel-saved L02-P1 file is committed: `false` (golden tests skip) when none is; throws (the suite fails) when only some are. */
export function excelFixturesPresent(): boolean {
  const present = EXCEL_FIXTURES.filter((name) => existsSync(excelPath(name)));
  if (present.length === 0) return false;
  if (present.length < EXCEL_FIXTURES.length) {
    const missing = EXCEL_FIXTURES.filter((name) => !present.includes(name));
    throw new Error(`L02-P1 Excel fixtures are incomplete: ${present.join(", ")} committed, ${missing.join(", ")} missing (README.md › L02-P1)`);
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
