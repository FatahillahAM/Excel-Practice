import { describe, expect, it } from "vitest";
import { batchesOf, expectFreshData, expectPracticeRules } from "./__fixtures__/content-checks";
import { DATA_HEADERS } from "./practice-1";
import { P2_TIPS, practice2 } from "./practice-2";
import { scenarios } from "./scenarios";

describe("L01-P2 (Excel Table)", () => {
  it("is Practice 2: 40/20/20/20, 3 hints and its Tip per question, no answer given away", () => {
    expect(practice2).toMatchObject({ id: "L01-P2", kind: "practice", number: 2 });
    expectPracticeRules({
      item: practice2,
      points: [40, 20, 20, 20],
      tips: [P2_TIPS.table, P2_TIPS.totalRow, P2_TIPS.columnName, P2_TIPS.autosum],
      formulas: (last) => [
        `SUM(E2:E${last})`,
        `SUM(F2:F${last})`,
        `COUNTA(A2:A${last})`,
        `MAX(E2:E${last})`,
        "SUM(TABLE1[UNIT DIPRODUKSI])",
        "SUM(TABLE1[UNIT CACAT])",
        "COUNTA(TABLE1[KODE BATCH])",
        "MAX(TABLE1[UNIT DIPRODUKSI])",
      ],
    });
  }, 30_000);

  it("checks the Table over exactly the data with its headers, and computes every key from the data (R2)", () => {
    for (const scenario of scenarios) {
      const exam = practice2.generate(11, scenario);
      const batches = batchesOf(exam);
      const last = batches.length + 1;
      const [q1, q2, q3, q4] = exam.questions;
      expect(q1.checks[0]).toEqual({ name: "is_table", ref: `A1:G${last}`, headers: [...DATA_HEADERS] });
      expect(q1.key).toEqual({ K2: batches.reduce((sum, b) => sum + b.units, 0) });
      expect(q2.key).toEqual({ K3: batches.reduce((sum, b) => sum + b.defects, 0) });
      expect(q3.key).toEqual({ K4: batches.length });
      expect(q4.key).toEqual({ K5: Math.max(...batches.map((b) => b.units)) });
      // Column H stays empty: Ctrl+T on the data finds exactly A1:G{last}.
      expect(Object.keys(exam.cells.Data).filter((ref) => /^H\d+$/.test(ref))).toEqual([]);
      expect(exam.cells.Instructions.B6).toContain(`A1:G${last}`);
    }
  });

  it("draws different data for two attempts (R1)", () => expectFreshData(practice2));
});
