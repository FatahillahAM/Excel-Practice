import { describe, expect, it } from "vitest";
import { batchesOf, expectFreshData, expectItemRules, param } from "./__fixtures__/content-checks";
import { P4_TIPS, P4_TEXT, practice4 } from "./practice-4";
import { scenarios } from "./scenarios";

describe("L02-P4 (IFERROR)", () => {
  it("is Practice 4: 40/30/30, IFERROR required, no answer given away", () => {
    expect(practice4).toMatchObject({ id: "L02-P4", kind: "practice", number: 4 });
    expectItemRules({
      outputs: Object.values(P4_TEXT),
      item: practice4,
      points: [40, 30, 30],
      tips: [P4_TIPS.iferror, P4_TIPS.zero, P4_TIPS.outer],
      formulas: ['IFERROR(E2/F2,"Tanpa Cacat")', "IFERROR(F2/G2,0)", 'IFERROR(IF(F2/G2>$O$2,"Cek","OK"),"Tanpa Downtime")', 'IF(F2/G2>$O$2,"Cek","OK")'],
    });
  }, 30_000);

  it("has a batch without defects and one without downtime, and keys with the replacement value there (R2)", () => {
    for (const scenario of scenarios) {
      for (const seed of [11, 12, 13]) {
        const exam = practice4.generate(seed, scenario);
        const batches = batchesOf(exam);
        const limit = param(exam, 2) as number;
        expect(batches.some((b) => b.defects === 0)).toBe(true);
        expect(batches.some((b) => b.downtime === 0)).toBe(true);
        expect(Math.round(limit * 100)).toBeCloseTo(limit * 100, 9);
        const [q1, q2, q3] = exam.questions;
        expect(Object.values(q1.key)).toEqual(batches.map((b) => (b.defects === 0 ? "Tanpa Cacat" : b.units / b.defects)));
        expect(Object.values(q2.key)).toEqual(batches.map((b) => (b.downtime === 0 ? 0 : b.defects / b.downtime)));
        expect(Object.values(q3.key)).toEqual(
          batches.map((b) => (b.downtime === 0 ? "Tanpa Downtime" : b.defects / b.downtime > limit ? "Cek" : "OK")),
        );
        // The limit splits the ratios: never equal to one, so > and >= agree.
        for (const b of batches) if (b.downtime > 0) expect(b.defects / b.downtime).not.toBe(limit);
      }
    }
  });

  it("draws different data for two attempts (R1)", () => expectFreshData(practice4));
});
