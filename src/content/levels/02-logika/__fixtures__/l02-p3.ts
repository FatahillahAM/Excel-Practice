import { P3_TIPS, practice3 } from "../practice-3";
import { RIGHT, fixtureToken, itemFixture, wrong, type Cells, type ExpectedGrade } from "./item-fixture";

/**
 * Test only: the code-built golden fixtures of L02-P3 (nested IF, IFS).
 * Seed 7, `kemasan-karton-prima`; answers H2:J{last}. IFS is saved with the
 * `_xlfn.` prefix, as Excel 2021 does; an Excel older than 2019 saves it with
 * `_xludf.` (#NAME?), the `old-excel-ifs` variant.
 */

export const FIXTURE = itemFixture(practice3, fixtureToken("L02-P3 golden fixture token 0001"));
export const TIPS_IN_ORDER = [P3_TIPS.nested, P3_TIPS.ifs, P3_TIPS.order];

export const VARIANTS = ["blank", "correct", "ifs-score", "wrong-function", "ifs-for-nested", "old-excel-ifs"] as const;
export type Variant = (typeof VARIANTS)[number];

function correct(): Cells {
  return {
    ...FIXTURE.filled(1, 0, 'IF(F2=0,"A",IF(F2<=$O$3,"B","C"))'),
    ...FIXTURE.filled(2, 1, '_xlfn.IFS(G2>$O$4,"Tinggi",G2>$O$5,"Sedang",TRUE,"Rendah")'),
    ...FIXTURE.filled(3, 2, "IF(AND(E2>=$O$2,F2<=$O$3),3,IF(E2>=$O$2,2,1))"),
  };
}

const nameErrors = (number: number) => Object.fromEntries(Object.keys(FIXTURE.keyOf(number)).map((ref) => [ref, { error: "#NAME?" }]));

export async function buildFixture(variant: Variant): Promise<Uint8Array> {
  switch (variant) {
    case "blank":
      return FIXTURE.build({});
    case "correct":
      return FIXTURE.build(correct());
    case "ifs-score":
      // Question 3 accepts IFS too.
      return FIXTURE.build({ ...correct(), ...FIXTURE.filled(3, 2, "_xlfn.IFS(AND(E2>=$O$2,F2<=$O$3),3,E2>=$O$2,2,TRUE,1)") });
    case "wrong-function":
      // Question 2 through nested IF: right values, but IFS is what it teaches.
      return FIXTURE.build({ ...correct(), ...FIXTURE.filled(2, 1, 'IF(G2>$O$4,"Tinggi",IF(G2>$O$5,"Sedang","Rendah"))') });
    case "ifs-for-nested":
      // Question 1 through IFS: right values, but it teaches nested IF.
      return FIXTURE.build({ ...correct(), ...FIXTURE.filled(1, 0, '_xlfn.IFS(F2=0,"A",F2<=$O$3,"B",TRUE,"C")') });
    case "old-excel-ifs":
      // IFS typed in an Excel that does not know it: saved as _xludf.IFS, every cell #NAME?.
      return FIXTURE.build({ ...correct(), ...FIXTURE.filled(2, 1, '_xludf.IFS(G2>$O$4,"Tinggi",G2>$O$5,"Sedang",TRUE,"Rendah")', nameErrors(2)) });
  }
}

const ALL_RIGHT = [RIGHT, RIGHT, RIGHT];

export const EXPECTED: Readonly<Record<Variant, ExpectedGrade>> = {
  blank: { score: 0, correctCount: 0, questions: ["H2", "I2", "J2"].map((ref) => wrong(`Sel ${ref} masih kosong.`)) },
  correct: { score: 100, correctCount: 3, questions: ALL_RIGHT },
  "ifs-score": { score: 100, correctCount: 3, questions: ALL_RIGHT },
  "wrong-function": { score: 65, correctCount: 2, questions: [RIGHT, wrong("Rumus di I2 tidak memakai fungsi IFS."), RIGHT] },
  "ifs-for-nested": { score: 65, correctCount: 2, questions: [wrong("Rumus di H2 tidak memakai fungsi IF."), RIGHT, RIGHT] },
  // Not "tidak memakai fungsi IFS": the formula does call IFS, Excel just does not know it.
  "old-excel-ifs": {
    score: 65,
    correctCount: 2,
    questions: [RIGHT, wrong("Excel tidak mengenali nama fungsi di rumus I2, jadi hasilnya #NAME?. Cek ejaan nama fungsinya."), RIGHT],
  },
};
