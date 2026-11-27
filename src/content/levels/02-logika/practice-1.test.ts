import { describe, expect, it } from "vitest";
import { batchesOf, expectBothOutcomes, expectFreshData, expectItemRules, param } from "./__fixtures__/content-checks";
import { P1_TIPS, TEXT, practice1 } from "./practice-1";
import { scenarios } from "./scenarios";

describe("L02-P1 (IF)", () => {
  it("is Practice 1: 25 × 4, 3 hints and its Tip per question, no answer given away", () => {
    expect(practice1).toMatchObject({ id: "L02-P1", kind: "practice", number: 1 });
    expectItemRules({
      outputs: Object.values(TEXT),
      item: practice1,
      points: [25, 25, 25, 25],
      tips: [P1_TIPS.args, P1_TIPS.quotes, P1_TIPS.calc, P1_TIPS.blank],
      formulas: ['IF(E2>=$O$2,"Capai","Kurang")', 'IF(F2>$O$3,"NG","OK")', "IF(E2>$O$2,E2-$O$2,0)", 'IF(G2>$O$4,"Cek mesin","")', "E2-$O$2"],
    });
  }, 30_000);

  it("computes every key from the generated data and limits (R2, R3)", () => {
    for (const scenario of scenarios) {
      for (const seed of [11, 12, 13]) {
        const exam = practice1.generate(seed, scenario);
        const batches = batchesOf(exam);
        const [target, defects, downtime] = [2, 3, 4].map((row) => param(exam, row) as number);
        const [q1, q2, q3, q4] = exam.questions;
        expect(Object.values(q1.key)).toEqual(batches.map((b) => (b.units >= target ? "Capai" : "Kurang")));
        expect(Object.values(q2.key)).toEqual(batches.map((b) => (b.defects > defects ? "NG" : "OK")));
        expect(Object.values(q3.key)).toEqual(batches.map((b) => Math.max(0, b.units - target)));
        expect(Object.values(q4.key)).toEqual(batches.map((b) => (b.downtime > downtime ? TEXT.check : "")));
        expect(exam.cells.Data.N2).toBe("Target Unit");
        expect(target % 10).toBe(0);
      }
    }
  });

  it("draws limits that split the data: both outcomes of every IF occur", () => {
    expectBothOutcomes(practice1, 1, ["Capai", "Kurang"]);
    expectBothOutcomes(practice1, 2, ["NG", "OK"]);
    expectBothOutcomes(practice1, 3, [0]);
    expectBothOutcomes(practice1, 4, [TEXT.check, ""]);
  });

  it("draws different data for two attempts (R1)", () => expectFreshData(practice1));
});
