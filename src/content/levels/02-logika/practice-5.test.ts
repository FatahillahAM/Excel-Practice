import { describe, expect, it } from "vitest";
import { batchesOf, expectBothOutcomes, expectFreshData, expectItemRules, param } from "./__fixtures__/content-checks";
import { P5_TIPS, P5_TEXT, practice5 } from "./practice-5";
import { scenarios } from "./scenarios";

describe("L02-P5 (mixed)", () => {
  it("is Practice 5: 25 × 4, no answer given away", () => {
    expect(practice5).toMatchObject({ id: "L02-P5", kind: "practice", number: 5 });
    expectItemRules({
      outputs: Object.values(P5_TEXT),
      item: practice5,
      points: [25, 25, 25, 25],
      tips: [P5_TIPS.evaluate, P5_TIPS.conditions, P5_TIPS.parentheses, P5_TIPS.chain],
      formulas: [
        "AND(E2>=$O$2,G2<=$O$4)",
        'IFS(G2>$O$4,"Tinggi",G2>0,"Rendah",TRUE,"Tidak Ada")',
        'IF(G2>$O$4,"Tinggi",IF(G2>0,"Rendah","Tidak Ada"))',
        "(E2-F2)/G2",
        'OR(H2="Terganggu",F2>$O$3)',
      ],
    });
  }, 30_000);

  it("computes every key from the generated data (R2)", () => {
    for (const scenario of scenarios) {
      for (const seed of [11, 12, 13]) {
        const exam = practice5.generate(seed, scenario);
        const batches = batchesOf(exam);
        const [target, defects, downtime] = [2, 3, 4].map((row) => param(exam, row) as number);
        expect(batches.some((b) => b.downtime === 0)).toBe(true);
        const smooth = batches.map((b) => b.units >= target && b.downtime <= downtime);
        const [q1, q2, q3, q4] = exam.questions;
        expect(Object.values(q1.key)).toEqual(smooth.map((s) => (s ? "Lancar" : "Terganggu")));
        expect(Object.values(q2.key)).toEqual(batches.map((b) => (b.downtime > downtime ? "Tinggi" : b.downtime > 0 ? "Rendah" : "Tidak Ada")));
        expect(Object.values(q3.key)).toEqual(batches.map((b) => (b.downtime === 0 ? "Tanpa Downtime" : (b.units - b.defects) / b.downtime)));
        expect(Object.values(q4.key)).toEqual(batches.map((b, i) => (!smooth[i] || b.defects > defects ? "Ya" : "Tidak")));
      }
    }
  });

  it("gives every outcome over the bank", () => {
    expectBothOutcomes(practice5, 1, ["Lancar", "Terganggu"]);
    expectBothOutcomes(practice5, 2, ["Tinggi", "Rendah", "Tidak Ada"]);
    expectBothOutcomes(practice5, 4, ["Ya", "Tidak"]);
  });

  it("draws different data for two attempts (R1)", () => expectFreshData(practice5));
});
