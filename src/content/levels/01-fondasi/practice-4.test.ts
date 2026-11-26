import { describe, expect, it } from "vitest";
import { batchesOf, expectFreshData, expectPracticeRules } from "./__fixtures__/content-checks";
import { P4_TIPS, practice4 } from "./practice-4";
import { scenarios } from "./scenarios";

describe("L01-P4 (Filter through FILTER and COUNTIF)", () => {
  it("is Practice 4: 30/30/20/20, 3 hints and its Tip per question, no answer given away", () => {
    expect(practice4).toMatchObject({ id: "L01-P4", kind: "practice", number: 4 });
    expectPracticeRules({
      item: practice4,
      points: [30, 30, 20, 20],
      tips: [P4_TIPS.filter, P4_TIPS.autofilter, P4_TIPS.statusBar, P4_TIPS.criteria],
      formulas: (last) => [
        `FILTER(A2:A${last},B2:B${last}=N2)`,
        `FILTER(A2:A${last},E2:E${last}>N3)`,
        `COUNTIF(B2:B${last},N2)`,
        `COUNTIF(E2:E${last},">"&N3)`,
      ],
    });
  }, 30_000);

  it("filters by the line in N2 and the limit in N3, in data order, and counts them (R2, R3)", () => {
    for (const scenario of scenarios) {
      for (const seed of [11, 12, 13]) {
        const exam = practice4.generate(seed, scenario);
        const data = exam.cells.Data;
        const batches = batchesOf(exam);
        const line = data.N2 as string;
        const limit = data.N3 as number;
        const ofLine = batches.filter((b) => b.line === line).map((b) => b.code);
        const above = batches.filter((b) => b.units > limit).map((b) => b.code);
        expect(ofLine.length).toBeGreaterThanOrEqual(1);
        expect(above.length).toBeGreaterThanOrEqual(1);
        expect(above.length).toBeLessThan(batches.length);
        const [q1, q2, q3, q4] = exam.questions;
        expect(Object.values(q1.key)).toEqual(ofLine);
        expect(Object.values(q2.key)).toEqual(above);
        expect(q3.key).toEqual({ N5: ofLine.length });
        expect(q4.key).toEqual({ N6: above.length });
        // The prompt names the anchor only: the end of the spill would give the count away.
        expect(q1.prompt).not.toContain(q1.range.split(":")[1] ?? "-");
      }
    }
  });

  it("draws different data for two attempts (R1)", () => expectFreshData(practice4));
});
