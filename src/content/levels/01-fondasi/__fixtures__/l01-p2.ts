import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { typedValue, writeFormulaCells } from "@/adapters/workbook/__fixtures__/formula-cells";
import { writeTablePart } from "@/adapters/workbook/__fixtures__/table-part";
import { generateExamWorkbook } from "@/adapters/workbook/generate";
import { expandRange } from "@/core/content/a1";
import { DATA_SHEET, INSTRUCTIONS_SHEET } from "@/core/content/level-module";
import { P2_TIPS, practice2 } from "../practice-2";
import { FIXTURE_SERVER_URL, RIGHT, dataTable, fixtureToken, itemFixture, wrong, type Cells, type ExpectedGrade } from "./item-fixture";

/**
 * Test only: the golden fixtures of L01-P2 (Excel Table). Seed 7,
 * `baut-sinar-presisi`: 12 batches (Data A1:G13), answers K2:K5 = 11788,
 * 223, 12, 1545. The Excel-saved files (README.md › L01-P2) skip until the
 * user commits them.
 */

export const FIXTURE = itemFixture(practice2, fixtureToken("L01-P2 golden fixture token 0001"));
export const FIXTURE_TOKEN = FIXTURE.token;
export const TIPS_IN_ORDER = [P2_TIPS.table, P2_TIPS.totalRow, P2_TIPS.columnName, P2_TIPS.autosum];

export const VARIANTS = [
  "blank",
  "correct",
  "plain-ranges",
  "typed-values",
  "no-table",
  "wrong-table-range",
  "no-header-row",
  "renamed-header",
  "table-on-other-sheet",
] as const;
export type Variant = (typeof VARIANTS)[number];

/** As the README asks: structured references, typed into K2:K5 after Ctrl+T. */
function correct(): Cells {
  return {
    ...FIXTURE.single(1, "SUM(Table1[Unit Diproduksi])"),
    ...FIXTURE.single(2, "SUM(Table1[Unit Cacat])"),
    ...FIXTURE.single(3, "COUNTA(Table1[Kode Batch])"),
    ...FIXTURE.single(4, "MAX(Table1[Unit Diproduksi])"),
  };
}

const TABLE = dataTable(13);

/** The fixture workbook of `variant`. `blank` is the file sent for Excel (no Table, no answers). */
export async function buildFixture(variant: Variant): Promise<Uint8Array> {
  switch (variant) {
    case "blank":
      return FIXTURE.build({});
    case "correct":
      return FIXTURE.build(correct(), [TABLE]);
    case "plain-ranges":
      return FIXTURE.build(
        {
          ...FIXTURE.single(1, "SUM(E2:E13)"),
          ...FIXTURE.single(2, "SUM($F$2:$F$13)"),
          ...FIXTURE.single(3, "COUNTA(A2:A13)"),
          ...FIXTURE.single(4, "MAX(E2:E13)"),
        },
        [TABLE],
      );
    case "typed-values":
      return FIXTURE.build({ ...correct(), K2: typedValue(FIXTURE.keyOf(1).K2 as number) }, [TABLE]);
    case "no-table":
      return FIXTURE.build(correct());
    case "wrong-table-range":
      return FIXTURE.build(correct(), [dataTable(12, { ref: "A1:G12" })]);
    case "no-header-row":
      // Ctrl+T without "My table has headers": Excel inserts a header row of Column1… above the data.
      return FIXTURE.build(correct(), [dataTable(14, { ref: "A1:G14", headerRow: true, columns: ["Column1", "Column2", "Column3", "Column4", "Column5", "Column6", "Column7"] })]);
    case "renamed-header":
      return FIXTURE.build(correct(), [dataTable(13, { columns: ["Kode Batch", "Lini", "Shift", "Produk", "Unit", "Unit Cacat", "Biaya per Unit"] })]);
    case "table-on-other-sheet": {
      const { bytes } = await generateExamWorkbook({ token: FIXTURE.token, serverUrl: FIXTURE_SERVER_URL, cells: FIXTURE.cells() });
      const answered = await writeFormulaCells(bytes, DATA_SHEET, correct());
      return writeTablePart(answered, INSTRUCTIONS_SHEET, TABLE);
    }
  }
}

const NOT_A_TABLE = "Data di A1:G13 belum dijadikan Excel Table.";
const ALL_RIGHT = [RIGHT, RIGHT, RIGHT, RIGHT];
const TYPED: ExpectedGrade = { score: 60, correctCount: 3, questions: [wrong("Sel K2 berisi nilai yang diketik, bukan rumus."), RIGHT, RIGHT, RIGHT] };

export const EXPECTED: Readonly<Record<Variant, ExpectedGrade>> = {
  blank: {
    score: 0,
    correctCount: 0,
    questions: [wrong(NOT_A_TABLE), wrong("Sel K3 masih kosong."), wrong("Sel K4 masih kosong."), wrong("Sel K5 masih kosong.")],
  },
  correct: { score: 100, correctCount: 4, questions: ALL_RIGHT },
  "plain-ranges": { score: 100, correctCount: 4, questions: ALL_RIGHT },
  "typed-values": TYPED,
  "no-table": { score: 60, correctCount: 3, questions: [wrong(NOT_A_TABLE), RIGHT, RIGHT, RIGHT] },
  "wrong-table-range": {
    score: 60,
    correctCount: 3,
    questions: [
      wrong("Range Excel Table belum sama dengan data di A1:G13: judul kolom dan semua baris data harus masuk, tanpa kolom atau baris tambahan."),
      RIGHT,
      RIGHT,
      RIGHT,
    ],
  },
  "no-header-row": {
    score: 60,
    correctCount: 3,
    questions: [
      wrong("Range Excel Table belum sama dengan data di A1:G13: judul kolom dan semua baris data harus masuk, tanpa kolom atau baris tambahan."),
      RIGHT,
      RIGHT,
      RIGHT,
    ],
  },
  "renamed-header": {
    score: 60,
    correctCount: 3,
    questions: [wrong("Excel Table di A1:G13 belum memakai baris judul data sebagai header."), RIGHT, RIGHT, RIGHT],
  },
  "table-on-other-sheet": { score: 60, correctCount: 3, questions: [wrong(NOT_A_TABLE), RIGHT, RIGHT, RIGHT] },
};

// ---------------------------------------------------------------------------
// Excel 2021 files (README.md › L01-P2): `buildFixture("blank")` opened,
// answered and saved by Excel 2021, committed as they are. Never written by code.

export const EXCEL_FIXTURES = ["l01-p2-correct", "l01-p2-typed-values"] as const;
export type ExcelFixture = (typeof EXCEL_FIXTURES)[number];

export const EXPECTED_EXCEL: Readonly<Record<ExcelFixture, ExpectedGrade>> = {
  "l01-p2-correct": { score: 100, correctCount: 4, questions: ALL_RIGHT },
  "l01-p2-typed-values": TYPED,
};

const excelPath = (name: ExcelFixture) => fileURLToPath(new URL(`./${name}.xlsm`, import.meta.url));

/** Whether every Excel-saved L01-P2 file is committed: `false` (golden tests skip) when none is; throws (the suite fails) when only some are. */
export function excelFixturesPresent(): boolean {
  const present = EXCEL_FIXTURES.filter((name) => existsSync(excelPath(name)));
  if (present.length === 0) return false;
  if (present.length < EXCEL_FIXTURES.length) {
    const missing = EXCEL_FIXTURES.filter((name) => !present.includes(name));
    throw new Error(`L01-P2 Excel fixtures are incomplete: ${present.join(", ")} committed, ${missing.join(", ")} missing (README.md › L01-P2)`);
  }
  return true;
}

export async function readExcelFixture(name: ExcelFixture): Promise<Uint8Array> {
  return Uint8Array.from(await readFile(excelPath(name)));
}

/** The Data cells the drift guard compares: the batches A1:G13 and the labels J2:J5, as generated now. */
export function driftGuardCells(): Record<string, number | string> {
  const data = FIXTURE.cells()[DATA_SHEET];
  return Object.fromEntries(
    [...expandRange("A1:G13")!, ...expandRange("J2:J5")!].map((ref) => {
      const value = data[ref];
      if (value === undefined) throw new Error(`driftGuardCells: generated Data has no ${ref}`);
      return [ref, value];
    }),
  );
}
