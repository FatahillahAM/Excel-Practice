import { describe, expect, it } from "vitest";
import { batchesOf, expectFreshData, expectPracticeRules } from "./__fixtures__/content-checks";
import { P3_TIPS, practice3 } from "./practice-3";
import { scenarios } from "./scenarios";

describe("L01-P3 (Sort through SORT and SORTBY)", () => {
  it("is Practice 3: 30/35/35, 3 hints and its Tip per question, no answer given away", () => {
    expect(practice3).toMatchObject({ id: "L01-P3", kind: "practice", number: 3 });
    expectPracticeRules({
      item: practice3,
      points: [30, 35, 35],
      tips: [P3_TIPS.sort, P3_TIPS.sortby, P3_TIPS.manual],
      formulas: (last) => [`SORT(E2:E${last},1,-1)`, `SORTBY(A2:A${last},E2:E${last},-1)`, `SORT(A2:G${last},5,1)`, `SORT(A2:G${last},5)`],
    });
  }, 30_000);

  it("declares one spill per answer and computes the keys as stable sorts of the data (R2)", () => {
    for (const scenario of scenarios) {
      const exam = practice3.generate(11, scenario);
      const batches = batchesOf(exam);
      const last = batches.length + 1;
      expect(new Set(batches.map((b) => b.units)).size, `${scenario.id}: no ties`).toBe(batches.length);
      const [q1, q2, q3] = exam.questions;
      expect(exam.questions.map((q) => q.range)).toEqual([`I2:I${last}`, `K2:K${last}`, `M2:S${last}`]);
      for (const q of exam.questions) expect(q.checks.map((c) => c.name)).toContain("spills");
      const desc = [...batches].sort((a, b) => b.units - a.units);
      const asc = [...batches].sort((a, b) => a.units - b.units);
      desc.forEach((b, i) => {
        expect(q1.key[`I${i + 2}`]).toBe(b.units);
        expect(q2.key[`K${i + 2}`]).toBe(b.code);
      });
      asc.forEach((b, i) => {
        expect([q3.key[`M${i + 2}`], q3.key[`Q${i + 2}`], q3.key[`S${i + 2}`]]).toEqual([b.code, b.units, b.cost]);
      });
    }
  });

  it("draws different data for two attempts (R1)", () => expectFreshData(practice3));
});
