import { typedValue } from "@/adapters/workbook/__fixtures__/formula-cells";
import { P5_TIPS, practice5 } from "../practice-5";
import { RIGHT, fixtureToken, itemFixture, wrong, type Cells, type ExpectedGrade } from "./item-fixture";

/**
 * Test only: the code-built golden fixtures of L01-P5 (mixed references and
 * fill). Seed 7, `baut-sinar-presisi`: 4 products (Data A2:B5), hours C1:F1
 * = 6…9, 6 days (M2:N7). Answers filled as Excel saves a fill (shared
 * formulas): C2 `=$B2*C$1` over C2:F5, H2 `=C2/MAX(C$2:C$5)` over H2:K5,
 * O2 `=SUM($N$2:N2)` over O2:O7.
 */

export const FIXTURE = itemFixture(practice5, fixtureToken("L01-P5 golden fixture token 0001"));
export const TIPS_IN_ORDER = [P5_TIPS.mixed, P5_TIPS.mixedRange, P5_TIPS.running];

export const VARIANTS = ["blank", "correct", "typed-values", "wrong-reference", "absolute-range"] as const;
export type Variant = (typeof VARIANTS)[number];

function correct(): Cells {
  return {
    ...FIXTURE.filled(1, 0, "$B2*C$1"),
    ...FIXTURE.filled(2, 1, "C2/MAX(C$2:C$5)"),
    ...FIXTURE.filled(3, 2, "SUM($N$2:N2)"),
  };
}

export async function buildFixture(variant: Variant): Promise<Uint8Array> {
  switch (variant) {
    case "blank":
      return FIXTURE.build({});
    case "correct":
      return FIXTURE.build(correct());
    case "typed-values":
      // Paste Values over C2:F5.
      return FIXTURE.build({
        ...correct(),
        ...Object.fromEntries(Object.entries(FIXTURE.keyOf(1)).map(([ref, value]) => [ref, typedValue(value)])),
      });
    case "wrong-reference":
      // N$2 instead of $N$2: the same values in one column, but the start of the range is not fully locked.
      return FIXTURE.build({ ...correct(), ...FIXTURE.filled(3, 2, "SUM(N$2:N2)") });
    case "absolute-range": {
      // $C$2:$C$5 in every column: right in column H, wrong from I on.
      const capacities = FIXTURE.keyOf(1) as Record<string, number>;
      const maxC = Math.max(...[2, 3, 4, 5].map((r) => capacities[`C${r}`]));
      const values = Object.fromEntries(
        Object.keys(FIXTURE.keyOf(2)).map((ref) => {
          const source = String.fromCharCode(ref.charCodeAt(0) - 5) + ref.slice(1);
          return [ref, capacities[source] / maxC];
        }),
      );
      return FIXTURE.build({ ...correct(), ...FIXTURE.filled(2, 1, "C2/MAX($C$2:$C$5)", values) });
    }
  }
}

export const EXPECTED: Readonly<Record<Variant, ExpectedGrade>> = {
  blank: { score: 0, correctCount: 0, questions: ["C2", "H2", "O2"].map((ref) => wrong(`Sel ${ref} masih kosong.`)) },
  correct: { score: 100, correctCount: 3, questions: [RIGHT, RIGHT, RIGHT] },
  "typed-values": { score: 60, correctCount: 2, questions: [wrong("Sel C2 berisi nilai yang diketik, bukan rumus."), RIGHT, RIGHT] },
  "wrong-reference": {
    score: 70,
    correctCount: 2,
    questions: [RIGHT, RIGHT, wrong("Rumus di O2 belum memakai referensi sel yang diminta, jadi hasilnya bisa salah saat disalin.")],
  },
  "absolute-range": { score: 70, correctCount: 2, questions: [RIGHT, wrong("Hasil di I2 belum sesuai."), RIGHT] },
};
