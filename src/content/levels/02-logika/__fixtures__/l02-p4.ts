import { typedValue } from "@/adapters/workbook/__fixtures__/formula-cells";
import { P4_TIPS, P4_TEXT, practice4 } from "../practice-4";
import { RIGHT, fixtureToken, itemFixture, wrong, type Cells, type ExpectedGrade } from "./item-fixture";

/**
 * Test only: the code-built golden fixtures of L02-P4 (IFERROR). Seed 7,
 * `kemasan-karton-prima`: KRP-06 (row 7) has no defect, five batches no
 * downtime (rows 2, 3, 6, 9, 10); O2 = 0.3. Answers H2:J13.
 */

export const FIXTURE = itemFixture(practice4, fixtureToken("L02-P4 golden fixture token 0001"));
export const TIPS_IN_ORDER = [P4_TIPS.iferror, P4_TIPS.zero, P4_TIPS.outer];

export const VARIANTS = ["blank", "correct", "typed-values", "wrong-function", "iferror-inside", "no-iferror"] as const;
export type Variant = (typeof VARIANTS)[number];

function correct(): Cells {
  return {
    ...FIXTURE.filled(1, 0, 'IFERROR(E2/F2,"Tanpa Cacat")'),
    ...FIXTURE.filled(2, 1, "IFERROR(F2/G2,0)"),
    ...FIXTURE.filled(3, 2, 'IFERROR(IF(F2/G2>$O$2,"Cek","OK"),"Tanpa Downtime")'),
  };
}

/** The value Excel computes in each J cell for `IF(IFERROR(F/G,0)>O2,"Cek","OK")`: rows without downtime read "OK". */
function insideValues(): Record<string, string> {
  const data = FIXTURE.cells().Data;
  const limit = data.O2 as number;
  return Object.fromEntries(
    Object.keys(FIXTURE.keyOf(3)).map((ref) => {
      const row = ref.slice(1);
      const downtime = data[`G${row}`] as number;
      const ratio = downtime === 0 ? 0 : (data[`F${row}`] as number) / downtime;
      return [ref, ratio > limit ? P4_TEXT.check : P4_TEXT.ok];
    }),
  );
}

export async function buildFixture(variant: Variant): Promise<Uint8Array> {
  switch (variant) {
    case "blank":
      return FIXTURE.build({});
    case "correct":
      return FIXTURE.build(correct());
    case "typed-values":
      // Paste Values over I2:I13.
      return FIXTURE.build({ ...correct(), ...Object.fromEntries(Object.entries(FIXTURE.keyOf(2)).map(([ref, value]) => [ref, typedValue(value)])) });
    case "wrong-function":
      // The right values through IF testing for 0, not IFERROR.
      return FIXTURE.build({ ...correct(), ...FIXTURE.filled(1, 0, 'IF(F2=0,"Tanpa Cacat",E2/F2)') });
    case "iferror-inside":
      // IFERROR only around the division: rows without downtime read "OK", not "Tanpa Downtime".
      return FIXTURE.build({ ...correct(), ...FIXTURE.filled(3, 2, 'IF(IFERROR(F2/G2,0)>$O$2,"Cek","OK")', insideValues()) });
    case "no-iferror": {
      // The bare division: #DIV/0! in the rows without downtime (I2 is the first).
      const key = FIXTURE.keyOf(2);
      const data = FIXTURE.cells().Data;
      const values = Object.fromEntries(Object.entries(key).map(([ref, value]) => [ref, data[`G${ref.slice(1)}`] === 0 ? { error: "#DIV/0!" } : value]));
      return FIXTURE.build({ ...correct(), ...FIXTURE.filled(2, 1, "F2/G2", values) });
    }
  }
}

const ALL_RIGHT = [RIGHT, RIGHT, RIGHT];

export const EXPECTED: Readonly<Record<Variant, ExpectedGrade>> = {
  blank: { score: 0, correctCount: 0, questions: ["H2", "I2", "J2"].map((ref) => wrong(`Sel ${ref} masih kosong.`)) },
  correct: { score: 100, correctCount: 3, questions: ALL_RIGHT },
  "typed-values": { score: 70, correctCount: 2, questions: [RIGHT, wrong("Sel I2 berisi nilai yang diketik, bukan rumus."), RIGHT] },
  "wrong-function": { score: 60, correctCount: 2, questions: [wrong("Rumus di H2 tidak memakai fungsi IFERROR."), RIGHT, RIGHT] },
  "iferror-inside": { score: 70, correctCount: 2, questions: [RIGHT, RIGHT, wrong("Hasil di J2 belum sesuai.")] },
  "no-iferror": { score: 70, correctCount: 2, questions: [RIGHT, wrong("Rumus di I2 menghasilkan error."), RIGHT] },
};
