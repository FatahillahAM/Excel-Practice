import { describe, expect, it } from "vitest";
import { expectFreshData, expectPracticeRules } from "./__fixtures__/content-checks";
import { P5_TIPS, practice5 } from "./practice-5";
import { scenarios } from "./scenarios";

describe("L01-P5 (mixed references and fill)", () => {
  it("is Practice 5: 40/30/30, 3 hints and its Tip per question, no answer given away", () => {
    expect(practice5).toMatchObject({ id: "L01-P5", kind: "practice", number: 5 });
    expectPracticeRules({
      item: practice5,
      points: [40, 30, 30],
      tips: [P5_TIPS.mixed, P5_TIPS.mixedRange, P5_TIPS.running],
      formulas: () => ["$B2*C$1", "C$1*$B2", "C2/MAX(C$2:C$", "SUM($N$2:N2)"],
    });
  }, 30_000);

  it("computes every key from the data (R2)", () => {
    for (const scenario of scenarios) {
      const exam = practice5.generate(11, scenario);
      const data = exam.cells.Data;
      const [q1, q2, q3] = exam.questions;
      const p = scenario.products.length;
      expect(exam.questions.map((q) => q.range).slice(0, 2)).toEqual([`C2:F${p + 1}`, `H2:K${p + 1}`]);
      for (const c of ["C", "D", "E", "F"]) {
        const column = Array.from({ length: p }, (_, r) => (data[`B${r + 2}`] as number) * (data[`${c}1`] as number));
        const share = String.fromCharCode(c.charCodeAt(0) + 5);
        column.forEach((value, r) => {
          expect(q1.key[`${c}${r + 2}`]).toBe(value);
          expect(q2.key[`${share}${r + 2}`]).toBeCloseTo(value / Math.max(...column), 12);
        });
      }
      let running = 0;
      for (let r = 2; data[`N${r}`] !== undefined; r++) {
        running += data[`N${r}`] as number;
        expect(q3.key[`O${r}`]).toBe(running);
      }
      expect(Object.keys(q3.key).length).toBeGreaterThanOrEqual(5);
    }
  });

  it("draws different data for two attempts (R1)", () => expectFreshData(practice5));
});
