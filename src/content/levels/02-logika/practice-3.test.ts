import { describe, expect, it } from "vitest";
import { batchesOf, expectBothOutcomes, expectFreshData, expectItemRules, param } from "./__fixtures__/content-checks";
import { P3_TIPS, P3_TEXT, practice3 } from "./practice-3";
import { scenarios } from "./scenarios";

describe("L02-P3 (nested IF and IFS)", () => {
  it("is Practice 3: 35/35/30, IF and IFS required where taught, no answer given away", () => {
    expect(practice3).toMatchObject({ id: "L02-P3", kind: "practice", number: 3 });
    expectItemRules({
      outputs: Object.values(P3_TEXT),
      item: practice3,
      points: [35, 35, 30],
      tips: [P3_TIPS.nested, P3_TIPS.ifs, P3_TIPS.order],
      formulas: [
        'IF(F2=0,"A",IF(F2<=$O$3,"B","C"))',
        'IFS(G2>$O$4,"Tinggi",G2>$O$5,"Sedang",TRUE,"Rendah")',
        "IF(AND(E2>=$O$2,F2<=$O$3),3,IF(E2>=$O$2,2,1))",
        'IF(F2<=$O$3,"B","C")',
      ],
    });
    const functions = practice3.generate(1, scenarios[0]).questions.map((q) => q.checks.flatMap((c) => (c.name === "uses_functions" ? c.functions : [])));
    expect(functions).toEqual([["IF"], ["IFS"], []]);
  }, 30_000);

  it("computes every key from the generated data, the medium limit below the high one (R2)", () => {
    for (const scenario of scenarios) {
      for (const seed of [11, 12, 13]) {
        const exam = practice3.generate(seed, scenario);
        const batches = batchesOf(exam);
        const [target, defects, high, medium] = [2, 3, 4, 5].map((row) => param(exam, row) as number);
        expect(medium).toBeLessThan(high);
        const [q1, q2, q3] = exam.questions;
        expect(Object.values(q1.key)).toEqual(batches.map((b) => (b.defects === 0 ? "A" : b.defects <= defects ? "B" : "C")));
        expect(Object.values(q2.key)).toEqual(batches.map((b) => (b.downtime > high ? "Tinggi" : b.downtime > medium ? "Sedang" : "Rendah")));
        expect(Object.values(q3.key)).toEqual(batches.map((b) => (b.units >= target ? (b.defects <= defects ? 3 : 2) : 1)));
      }
    }
  });

  it("gives every outcome over the bank", () => {
    expectBothOutcomes(practice3, 1, ["A", "B", "C"]);
    expectBothOutcomes(practice3, 2, ["Tinggi", "Sedang", "Rendah"]);
    expectBothOutcomes(practice3, 3, [1, 2, 3]);
  });

  it("draws different data for two attempts (R1)", () => expectFreshData(practice3));
});
