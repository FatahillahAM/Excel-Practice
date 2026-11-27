import { typedValue } from "@/adapters/workbook/__fixtures__/formula-cells";
import { P2_TIPS, practice2 } from "../practice-2";
import { RIGHT, fixtureToken, itemFixture, wrong, type Cells, type ExpectedGrade } from "./item-fixture";

/**
 * Test only: the code-built golden fixtures of L02-P2 (AND, OR). Seed 7,
 * `kemasan-karton-prima`, 12 batches (Data A1:G13); answers H2:K13. No
 * Excel-saved file (plan: one Excel fixture per level besides the Test).
 */

export const FIXTURE = itemFixture(practice2, fixtureToken("L02-P2 golden fixture token 0001"));
export const TIPS_IN_ORDER = [P2_TIPS.and, P2_TIPS.or, P2_TIPS.text, P2_TIPS.mix];

export const VARIANTS = ["blank", "correct", "ifs-around", "typed-values", "wrong-function", "unlocked"] as const;
export type Variant = (typeof VARIANTS)[number];

function correct(): Cells {
  return {
    ...FIXTURE.filled(1, 0, 'IF(AND(E2>=$O$2,F2<=$O$3),"Lolos","Tahan")'),
    ...FIXTURE.filled(2, 1, 'IF(OR(F2>$O$3,G2>$O$4),"Ya","Tidak")'),
    ...FIXTURE.filled(3, 2, 'IF(AND(C2=$O$5,G2>$O$4),"Prioritas","Normal")'),
    ...FIXTURE.filled(4, 3, 'IF(OR(B2=$O$6,F2=0),"Ambil","Tidak")'),
  };
}

export async function buildFixture(variant: Variant): Promise<Uint8Array> {
  switch (variant) {
    case "blank":
      return FIXTURE.build({});
    case "correct":
      return FIXTURE.build(correct());
    case "ifs-around":
      // AND inside IFS instead of IF: the question requires AND only.
      return FIXTURE.build({ ...correct(), ...FIXTURE.filled(1, 0, '_xlfn.IFS(AND(E2>=$O$2,F2<=$O$3),"Lolos",TRUE,"Tahan")') });
    case "typed-values":
      return FIXTURE.build({ ...correct(), ...Object.fromEntries(Object.entries(FIXTURE.keyOf(2)).map(([ref, value]) => [ref, typedValue(value)])) });
    case "wrong-function":
      // The same answers through IF inside IF, without AND.
      return FIXTURE.build({ ...correct(), ...FIXTURE.filled(1, 0, 'IF(E2>=$O$2,IF(F2<=$O$3,"Lolos","Tahan"),"Tahan")') });
    case "unlocked":
      // The audit line written as O6 without $: right in K2 only if Excel had not shifted it; the values are the key's, the reference is not.
      return FIXTURE.build({ ...correct(), ...FIXTURE.filled(4, 3, 'IF(OR(B2=O6,F2=0),"Ambil","Tidak")') });
  }
}

const ALL_RIGHT = [RIGHT, RIGHT, RIGHT, RIGHT];

export const EXPECTED: Readonly<Record<Variant, ExpectedGrade>> = {
  blank: { score: 0, correctCount: 0, questions: ["H2", "I2", "J2", "K2"].map((ref) => wrong(`Sel ${ref} masih kosong.`)) },
  correct: { score: 100, correctCount: 4, questions: ALL_RIGHT },
  "ifs-around": { score: 100, correctCount: 4, questions: ALL_RIGHT },
  "typed-values": { score: 70, correctCount: 3, questions: [RIGHT, wrong("Sel I2 berisi nilai yang diketik, bukan rumus."), RIGHT, RIGHT] },
  "wrong-function": { score: 70, correctCount: 3, questions: [wrong("Rumus di H2 tidak memakai fungsi AND."), RIGHT, RIGHT, RIGHT] },
  unlocked: {
    score: 80,
    correctCount: 3,
    questions: [RIGHT, RIGHT, RIGHT, wrong("Rumus di K2 belum memakai referensi sel yang diminta, jadi hasilnya bisa salah saat disalin.")],
  },
};
