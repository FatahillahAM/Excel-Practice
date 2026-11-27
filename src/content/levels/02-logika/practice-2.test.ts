import { describe, expect, it } from "vitest";
import { batchesOf, expectBothOutcomes, expectFreshData, expectItemRules, param } from "./__fixtures__/content-checks";
import { P2_TIPS, P2_TEXT, practice2 } from "./practice-2";
import { scenarios } from "./scenarios";

describe("L02-P2 (AND and OR)", () => {
  it("is Practice 2: 30/30/20/20, AND and OR required, no answer given away", () => {
    expect(practice2).toMatchObject({ id: "L02-P2", kind: "practice", number: 2 });
    expectItemRules({
      outputs: Object.values(P2_TEXT),
      item: practice2,
      points: [30, 30, 20, 20],
      tips: [P2_TIPS.and, P2_TIPS.or, P2_TIPS.text, P2_TIPS.mix],
      formulas: [
        "AND(E2>=$O$2,F2<=$O$3)",
        "OR(F2>$O$3,G2>$O$4)",
        "AND(C2=$O$5,G2>$O$4)",
        "OR(B2=$O$6,F2=0)",
      ],
    });
    const functions = practice2.generate(1, scenarios[0]).questions.map((q) => q.checks.flatMap((c) => (c.name === "uses_functions" ? c.functions : [])));
    expect(functions).toEqual([["AND"], ["OR"], ["AND"], ["OR"]]);
  }, 30_000);

  it("computes every key from the generated data and parameters (R2, R3)", () => {
    for (const scenario of scenarios) {
      for (const seed of [11, 12, 13]) {
        const exam = practice2.generate(seed, scenario);
        const batches = batchesOf(exam);
        const [target, defects, downtime] = [2, 3, 4].map((row) => param(exam, row) as number);
        const shift = param(exam, 5);
        const line = param(exam, 6);
        expect(scenario.shifts).toContain(shift);
        expect(batches.map((b) => b.line)).toContain(line);
        const [q1, q2, q3, q4] = exam.questions;
        expect(Object.values(q1.key)).toEqual(batches.map((b) => (b.units >= target && b.defects <= defects ? "Lolos" : "Tahan")));
        expect(Object.values(q2.key)).toEqual(batches.map((b) => (b.defects > defects || b.downtime > downtime ? "Ya" : "Tidak")));
        expect(Object.values(q3.key)).toEqual(batches.map((b) => (b.shift === shift && b.downtime > downtime ? "Prioritas" : "Normal")));
        expect(Object.values(q4.key)).toEqual(batches.map((b) => (b.line === line || b.defects === 0 ? "Ambil" : "Tidak")));
      }
    }
  });

  it("gives both outcomes of every question over the bank", () => {
    expectBothOutcomes(practice2, 1, ["Lolos", "Tahan"]);
    expectBothOutcomes(practice2, 2, ["Ya", "Tidak"]);
    expectBothOutcomes(practice2, 3, ["Prioritas", "Normal"]);
    expectBothOutcomes(practice2, 4, ["Ambil", "Tidak"]);
  });

  it("draws different data for two attempts (R1)", () => expectFreshData(practice2));
});
