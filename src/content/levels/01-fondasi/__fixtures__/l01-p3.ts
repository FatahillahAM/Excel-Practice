import { arrayFill, typedValue } from "@/adapters/workbook/__fixtures__/formula-cells";
import { P3_TIPS, practice3 } from "../practice-3";
import { RIGHT, dataTable, fixtureToken, itemFixture, wrong, type Cells, type ExpectedGrade } from "./item-fixture";

/**
 * Test only: the code-built golden fixtures of L01-P3 (Sort through SORT /
 * SORTBY). Seed 7, `baut-sinar-presisi`: 12 batches (Data A1:G13, every Unit
 * Diproduksi different); answers I2:I13, K2:K13, M2:S13, each one spilled
 * dynamic array with its cached values, written as Excel 2021 saves it
 * (`_xlfn._xlws.SORT`, `_xlfn.SORTBY`, `<f t="array" ref=…>` on the anchor).
 * No Excel-saved file (plan: one Excel fixture per level besides the Test).
 */

export const FIXTURE = itemFixture(practice3, fixtureToken("L01-P3 golden fixture token 0001"));
export const TIPS_IN_ORDER = [P3_TIPS.sort, P3_TIPS.sortby, P3_TIPS.manual];

export const VARIANTS = ["blank", "correct", "structured", "typed-values", "wrong-function", "short-spill", "wrong-order"] as const;
export type Variant = (typeof VARIANTS)[number];

const spill = (number: number, formula: string, range = FIXTURE.snapshot().questions[number - 1].range): Cells => {
  const key = FIXTURE.keyOf(number);
  return arrayFill(range, formula, (ref) => key[ref]);
};

function correct(): Cells {
  return {
    ...spill(1, "_xlfn._xlws.SORT(E2:E13,1,-1)"),
    ...spill(2, "_xlfn.SORTBY(A2:A13,E2:E13,-1)"),
    ...spill(3, "_xlfn._xlws.SORT(A2:G13,5,1)"),
  };
}

export async function buildFixture(variant: Variant): Promise<Uint8Array> {
  switch (variant) {
    case "blank":
      return FIXTURE.build({});
    case "correct":
      return FIXTURE.build(correct());
    case "structured":
      // After Ctrl+T, selecting the columns writes structured references.
      return FIXTURE.build(
        {
          ...spill(1, "_xlfn._xlws.SORT(Table1[Unit Diproduksi],1,-1)"),
          ...spill(2, "_xlfn.SORTBY(Table1[Kode Batch],Table1[Unit Diproduksi],-1)"),
          ...spill(3, "_xlfn._xlws.SORT(Table1,5,1)"),
        },
        [dataTable(13)],
      );
    case "typed-values":
      // Paste Values over I2:I13.
      return FIXTURE.build({
        ...correct(),
        ...Object.fromEntries(Object.entries(FIXTURE.keyOf(1)).map(([ref, value]) => [ref, typedValue(value)])),
      });
    case "wrong-function":
      // The right codes in the right order, but through SORT, not SORTBY.
      return FIXTURE.build({ ...correct(), ...spill(2, "INDEX(_xlfn._xlws.SORT(A2:E13,5,-1),0,1)") });
    case "short-spill": {
      // SORT over E2:E12: one batch short, so the spill ends at I12 and I13 stays empty.
      const sorted = Object.values(FIXTURE.keyOf(1)).slice(0, 11);
      const cells: Cells = { ...correct(), ...arrayFill("I2:I12", "_xlfn._xlws.SORT(E2:E12,1,-1)", (ref) => sorted[Number(ref.slice(1)) - 2]) };
      delete cells.I13;
      return FIXTURE.build(cells);
    }
    case "wrong-order": {
      const ascending = Object.values(FIXTURE.keyOf(1)).reverse();
      return FIXTURE.build({ ...correct(), ...arrayFill("I2:I13", "_xlfn._xlws.SORT(E2:E13)", (ref) => ascending[Number(ref.slice(1)) - 2]) });
    }
  }
}

const ALL_RIGHT = [RIGHT, RIGHT, RIGHT];

export const EXPECTED: Readonly<Record<Variant, ExpectedGrade>> = {
  blank: { score: 0, correctCount: 0, questions: ["I2", "K2", "M2"].map((ref) => wrong(`Sel ${ref} masih kosong.`)) },
  correct: { score: 100, correctCount: 3, questions: ALL_RIGHT },
  structured: { score: 100, correctCount: 3, questions: ALL_RIGHT },
  "typed-values": { score: 70, correctCount: 2, questions: [wrong("Sel I2 berisi nilai yang diketik, bukan rumus."), RIGHT, RIGHT] },
  "wrong-function": { score: 65, correctCount: 2, questions: [RIGHT, wrong("Rumus di K2 tidak memakai fungsi SORTBY."), RIGHT] },
  "short-spill": {
    score: 70,
    correctCount: 2,
    questions: [wrong("Hasil rumus di I2 belum mengisi daftar yang diminta: jumlah baris atau kolom hasilnya berbeda."), RIGHT, RIGHT],
  },
  "wrong-order": { score: 70, correctCount: 2, questions: [wrong("Hasil di I2 belum sesuai."), RIGHT, RIGHT] },
};
