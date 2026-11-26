import { arrayFill, typedValue } from "@/adapters/workbook/__fixtures__/formula-cells";
import { P4_TIPS, practice4 } from "../practice-4";
import { RIGHT, fixtureToken, itemFixture, wrong, type Cells, type ExpectedGrade } from "./item-fixture";

/**
 * Test only: the code-built golden fixtures of L01-P4 (Filter through FILTER
 * and COUNTIF). Seed 7, `baut-sinar-presisi`: 12 batches (Data A1:G13), N2
 * "Lini C" (4 batches: I2:I5), N3 710 (10 batches above it: K2:K11), N5 4,
 * N6 10. FILTER spills are written as Excel 2021 saves them
 * (`_xlfn._xlws.FILTER`, text results `t="str"` on the anchor).
 */

export const FIXTURE = itemFixture(practice4, fixtureToken("L01-P4 golden fixture token 0001"));
export const TIPS_IN_ORDER = [P4_TIPS.filter, P4_TIPS.autofilter, P4_TIPS.statusBar, P4_TIPS.criteria];

export const VARIANTS = ["blank", "correct", "typed-values", "wrong-line", "typed-count", "wrong-function"] as const;
export type Variant = (typeof VARIANTS)[number];

const spill = (number: number, formula: string): Cells => {
  const key = FIXTURE.keyOf(number);
  return arrayFill(FIXTURE.snapshot().questions[number - 1].range, formula, (ref) => key[ref]);
};

function correct(): Cells {
  return {
    ...spill(1, "_xlfn._xlws.FILTER(A2:A13,B2:B13=N2)"),
    ...spill(2, "_xlfn._xlws.FILTER(A2:A13,E2:E13>N3)"),
    ...FIXTURE.single(3, "COUNTIF(B2:B13,N2)"),
    ...FIXTURE.single(4, 'COUNTIF(E2:E13,">"&N3)'),
  };
}

export async function buildFixture(variant: Variant): Promise<Uint8Array> {
  switch (variant) {
    case "blank":
      return FIXTURE.build({});
    case "correct":
      return FIXTURE.build(correct());
    case "typed-values":
      // Paste Values over I2:I5.
      return FIXTURE.build({
        ...correct(),
        ...Object.fromEntries(Object.entries(FIXTURE.keyOf(1)).map(([ref, value]) => [ref, typedValue(value)])),
      });
    case "wrong-line": {
      // The line typed into the formula instead of N2, and the wrong one: six codes spill over I2:I7.
      const cells: Cells = { ...correct(), ...arrayFill("I2:I7", '_xlfn._xlws.FILTER(A2:A13,B2:B13="Lini A")', (ref) => `SBP-0${ref.slice(1)}`) };
      return FIXTURE.build(cells);
    }
    case "typed-count":
      return FIXTURE.build({ ...correct(), N5: typedValue(4) });
    case "wrong-function":
      return FIXTURE.build({ ...correct(), ...FIXTURE.single(4, "SUM(--(E2:E13>N3))") });
  }
}

export const EXPECTED: Readonly<Record<Variant, ExpectedGrade>> = {
  blank: { score: 0, correctCount: 0, questions: ["I2", "K2", "N5", "N6"].map((ref) => wrong(`Sel ${ref} masih kosong.`)) },
  correct: { score: 100, correctCount: 4, questions: [RIGHT, RIGHT, RIGHT, RIGHT] },
  "typed-values": { score: 70, correctCount: 3, questions: [wrong("Sel I2 berisi nilai yang diketik, bukan rumus."), RIGHT, RIGHT, RIGHT] },
  "wrong-line": {
    score: 70,
    correctCount: 3,
    questions: [wrong("Hasil rumus di I2 belum mengisi daftar yang diminta: jumlah baris atau kolom hasilnya berbeda."), RIGHT, RIGHT, RIGHT],
  },
  "typed-count": { score: 80, correctCount: 3, questions: [RIGHT, RIGHT, wrong("Sel N5 berisi nilai yang diketik, bukan rumus."), RIGHT] },
  "wrong-function": { score: 80, correctCount: 3, questions: [RIGHT, RIGHT, RIGHT, wrong("Rumus di N6 tidak memakai fungsi COUNTIF.")] },
};
