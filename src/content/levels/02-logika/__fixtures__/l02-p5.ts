import { P5_TIPS, practice5 } from "../practice-5";
import { RIGHT, fixtureToken, itemFixture, wrong, type Cells, type ExpectedGrade } from "./item-fixture";

/**
 * Test only: the code-built golden fixtures of L02-P5 (mixed). Seed 7,
 * `kemasan-karton-prima` (redrawn until every outcome occurs): 17 batches
 * (Data A1:G18), rows 5, 6 and 17 without downtime; answers H2:K18.
 */

export const FIXTURE = itemFixture(practice5, fixtureToken("L02-P5 golden fixture token 0001"));
export const TIPS_IN_ORDER = [P5_TIPS.evaluate, P5_TIPS.conditions, P5_TIPS.parentheses, P5_TIPS.chain];

export const VARIANTS = ["blank", "correct", "nested-if", "recomputed", "wrong-function", "no-parentheses"] as const;
export type Variant = (typeof VARIANTS)[number];

function correct(): Cells {
  return {
    ...FIXTURE.filled(1, 0, 'IF(AND(E2>=$O$2,G2<=$O$4),"Lancar","Terganggu")'),
    ...FIXTURE.filled(2, 1, '_xlfn.IFS(G2>$O$4,"Tinggi",G2>0,"Rendah",TRUE,"Tidak Ada")'),
    ...FIXTURE.filled(3, 2, 'IFERROR((E2-F2)/G2,"Tanpa Downtime")'),
    ...FIXTURE.filled(4, 3, 'IF(OR(H2="Terganggu",F2>$O$3),"Ya","Tidak")'),
  };
}

/** What Excel computes for `IFERROR(E2-F2/G2,…)` (division first): the text where downtime is 0. */
function withoutParentheses(): Record<string, number | string> {
  const data = FIXTURE.cells().Data;
  return Object.fromEntries(
    Object.entries(FIXTURE.keyOf(3)).map(([ref, value]) => {
      const row = ref.slice(1);
      const downtime = data[`G${row}`] as number;
      return [ref, downtime === 0 ? value : (data[`E${row}`] as number) - (data[`F${row}`] as number) / downtime];
    }),
  );
}

export async function buildFixture(variant: Variant): Promise<Uint8Array> {
  switch (variant) {
    case "blank":
      return FIXTURE.build({});
    case "correct":
      return FIXTURE.build(correct());
    case "nested-if":
      // Question 2 through nested IF: accepted.
      return FIXTURE.build({ ...correct(), ...FIXTURE.filled(2, 1, 'IF(G2>$O$4,"Tinggi",IF(G2>0,"Rendah","Tidak Ada"))') });
    case "recomputed":
      // Question 4 recomputing the status instead of reading column H: accepted.
      return FIXTURE.build({ ...correct(), ...FIXTURE.filled(4, 3, 'IF(OR(NOT(AND(E2>=$O$2,G2<=$O$4)),F2>$O$3),"Ya","Tidak")') });
    case "wrong-function":
      return FIXTURE.build({ ...correct(), ...FIXTURE.filled(3, 2, 'IF(G2=0,"Tanpa Downtime",(E2-F2)/G2)') });
    case "no-parentheses":
      return FIXTURE.build({ ...correct(), ...FIXTURE.filled(3, 2, 'IFERROR(E2-F2/G2,"Tanpa Downtime")', withoutParentheses()) });
  }
}

const ALL_RIGHT = [RIGHT, RIGHT, RIGHT, RIGHT];

export const EXPECTED: Readonly<Record<Variant, ExpectedGrade>> = {
  blank: { score: 0, correctCount: 0, questions: ["H2", "I2", "J2", "K2"].map((ref) => wrong(`Sel ${ref} masih kosong.`)) },
  correct: { score: 100, correctCount: 4, questions: ALL_RIGHT },
  "nested-if": { score: 100, correctCount: 4, questions: ALL_RIGHT },
  recomputed: { score: 100, correctCount: 4, questions: ALL_RIGHT },
  "wrong-function": { score: 75, correctCount: 3, questions: [RIGHT, RIGHT, wrong("Rumus di J2 tidak memakai fungsi IFERROR."), RIGHT] },
  "no-parentheses": { score: 75, correctCount: 3, questions: [RIGHT, RIGHT, wrong("Hasil di J2 belum sesuai."), RIGHT] },
};
