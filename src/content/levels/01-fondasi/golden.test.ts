import { beforeAll, describe, expect, it } from "vitest";
import { readWorkbook, type WorkbookReading } from "@/adapters/workbook/read";
import { expandRange } from "@/core/content/a1";
import type { CheckName } from "@/core/content/checks";
import { grade, runCheck, type AnswerCell } from "@/core/grading";
import { EXPECTED, VARIANTS, buildFixture, expectedResult, fixtureSnapshot, type Variant } from "./__fixtures__/l01-p1";

// Golden fixtures of L01-P1 (spine › fixtures): every code-built variant is
// written into template v1 as Excel saves it, read back with readWorkbook and
// graded; score, correct count and every reason are pinned in EXPECTED.

const snapshot = fixtureSnapshot();
const readings = new Map<Variant, WorkbookReading>();

beforeAll(async () => {
  for (const variant of VARIANTS) readings.set(variant, await readWorkbook(await buildFixture(variant)));
});

/** The name of the check that decided each wrong question (the first failing one), as grade() runs them. */
function decidingChecks(reading: WorkbookReading): CheckName[] {
  const names: CheckName[] = [];
  for (const question of snapshot.questions) {
    const sheet = reading.sheets[question.sheet] ?? {};
    const cells: AnswerCell[] = expandRange(question.range)!.map((ref) => ({ ref, reading: sheet[ref] }));
    const failing = question.checks.find((check) => !runCheck(check, question, cells).ok);
    if (failing !== undefined) names.push(failing.name);
  }
  return names;
}

describe("L01-P1 golden fixtures (code-built)", () => {
  it("the snapshot is seed 7, baut-sinar-presisi, with the plan's keys", () => {
    expect(snapshot).toMatchObject({ contentVersion: 1, scenarioId: "baut-sinar-presisi", seed: 7 });
    expect(snapshot.questions.map((q) => q.range)).toEqual(["H2:H13", "I2:I13", "J2:J13", "O2:R5"]);
    const [q1, q2, q3, q4] = snapshot.questions;
    expect(q1.key.H2).toBeCloseTo(1302148.09, 6);
    expect(q2.key.I2).toBe(149511);
    expect(q3.key.J2).toBeCloseTo(0.092461, 6);
    expect(q4.key.O2).toBeCloseTo(1168.4504, 9);
    expect(q4.key.R5).toBeCloseTo(1318.394, 9);
  });

  it.each(VARIANTS)("%s grades to its expected score and reasons", (variant) => {
    const result = grade(snapshot, readings.get(variant)!, 0);
    expect({
      score: result.score,
      correctCount: result.correctCount,
      questions: result.questions.map(({ correct, reasonText }) => ({ correct, reasonText })),
    }).toEqual(EXPECTED[variant]);
    expect(result).toEqual(expectedResult(variant, snapshot));
  });

  it("the correct variant is read as shared formulas filled down and right", () => {
    const data = readings.get("correct")!.sheets.Data;
    expect(data.H13).toMatchObject({ formula: "E13*G13", type: "number" });
    expect(data.J13).toMatchObject({ formula: "E13/SUM($E$2:$E$13)" });
    expect(data.R5).toMatchObject({ formula: "$N5*(1+R$1)" });
  });

  it("each of the five checkers decides at least one variant", () => {
    const decided = new Set(VARIANTS.flatMap((variant) => decidingChecks(readings.get(variant)!)));
    expect([...decided].sort()).toEqual(["formula_present", "not_hard_coded", "uses_functions", "uses_reference", "value_equals_key"]);
  });

  it("no reason names a key, an expected value or an expected reference", () => {
    for (const variant of VARIANTS) {
      for (const { reasonText } of grade(snapshot, readings.get(variant)!, 0).questions) {
        if (reasonText === null) continue;
        expect(reasonText).not.toMatch(/\$|\d{3,}|[=:]/);
      }
    }
  });
});
