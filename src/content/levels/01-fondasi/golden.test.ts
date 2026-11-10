import { beforeAll, describe, expect, it } from "vitest";
import { readWorkbook, type WorkbookReading } from "@/adapters/workbook/read";
import { expandRange } from "@/core/content/a1";
import type { CheckName } from "@/core/content/checks";
import { REASON_TEMPLATES, grade, runCheck, shiftedReference, type AnswerCell } from "@/core/grading";
import { CURRENT_TEMPLATE_VERSION, matchesTemplate } from "@/adapters/workbook/templates";
import {
  EXCEL_FIXTURES,
  EXPECTED,
  EXPECTED_EXCEL,
  FIXTURE_TOKEN,
  VARIANTS,
  buildFixture,
  driftGuardCells,
  expectedResult,
  fillOffset,
  fixtureSnapshot,
  readExcelFixture,
  resultOf,
  type ExcelFixture,
  type Variant,
} from "./__fixtures__/l01-p1";

// Golden fixtures of L01-P1 (spine › fixtures): every code-built variant is
// written into template v1 as Excel saves it, read back with readWorkbook and
// graded; score, correct count and every reason are pinned in EXPECTED.

const snapshot = fixtureSnapshot();
const readings = new Map<Variant, WorkbookReading>();
const excelReadings = new Map<ExcelFixture, WorkbookReading>();

beforeAll(async () => {
  for (const variant of VARIANTS) readings.set(variant, await readWorkbook(await buildFixture(variant)));
  for (const name of EXCEL_FIXTURES) excelReadings.set(name, await readWorkbook(await readExcelFixture(name)));
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

  it("no reason names a declared reference, a key value or a declared function beyond its {function} slot", () => {
    const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // A reference as a whole token: not inside a longer cell name (`O1` is not in `O12`).
    const containsRef = (text: string, ref: string) => new RegExp(`(?<![A-Z0-9$])${escape(ref)}(?![0-9])`, "i").test(text);
    const keyForms = (value: number | string): string[] => {
      if (typeof value === "string") return [value];
      const forms = [String(value), value.toLocaleString("id-ID"), value.toLocaleString("en-US")];
      for (const digits of [2, 4, 6]) forms.push(value.toFixed(digits), value.toFixed(digits).replace(".", ","));
      return forms;
    };
    let checked = 0;
    for (const variant of VARIANTS) {
      const result = grade(snapshot, readings.get(variant)!, 0);
      result.questions.forEach(({ reasonText }, i) => {
        if (reasonText === null) return;
        checked += 1;
        const question = snapshot.questions[i];
        const refs = expandRange(question.range)!;
        // Declared references: as declared, without `$`, and shifted to every cell of the range.
        for (const check of question.checks) {
          if (check.name !== "uses_reference") continue;
          const forms = new Set([check.ref, check.ref.replace(/\$/g, "")]);
          for (const ref of refs) {
            const shifted = shiftedReference(check.ref, question.range, ref);
            if (shifted !== null) forms.add(shifted).add(shifted.replace(/\$/g, ""));
          }
          for (const form of forms) expect(containsRef(reasonText, form), `${variant} Q${i + 1}: ${form}`).toBe(false);
        }
        // Key values, as the reader, Excel or an Indonesian display would write them.
        for (const value of Object.values(question.key)) {
          for (const form of keyForms(value)) expect(reasonText, `${variant} Q${i + 1}: key`).not.toContain(form);
        }
        // Declared functions: only the one named in the {function} slot.
        const slot = /tidak memakai fungsi ([A-Z0-9.]+)\.$/.exec(reasonText);
        const rest = slot === null ? reasonText : reasonText.slice(0, slot.index);
        for (const check of question.checks) {
          if (check.name !== "uses_functions") continue;
          for (const name of check.functions) expect(rest, `${variant} Q${i + 1}: ${name}`).not.toMatch(new RegExp(`\\b${name}\\b`, "i"));
        }
      });
    }
    expect(checked).toBeGreaterThan(10);
  });

  it("the reason templates name only the cell and the function", () => {
    for (const template of Object.values(REASON_TEMPLATES)) {
      expect(template.replace("{ref}", "").replace("{function}", "")).not.toMatch(/[{}$]|\d/);
    }
  });

  it("fillOffset counts columns by their full letters", () => {
    expect(fillOffset("O2", "R5")).toEqual({ dRow: 3, dCol: 3 });
    expect(fillOffset("Z2", "AA3")).toEqual({ dRow: 1, dCol: 1 });
    expect(fillOffset("AZ2", "BA2")).toEqual({ dRow: 0, dCol: 1 });
  });

  it("valid-variants writes Q2 with reversed operands and with the sheet prefix", () => {
    const data = readings.get("valid-variants")!.sheets.Data;
    expect(data.I2.formula).toBe("$L$2*E2");
    expect(data.I13.formula).toBe("DATA!E13*DATA!$L$2");
  });

  it("the array variant reads H2:H13 as one array formula", () => {
    const data = readings.get("array")!.sheets.Data;
    expect(data.H2).toMatchObject({ formula: "E2:E13*G2:G13", array: true });
    expect(data.H13).toMatchObject({ formula: null, array: true });
  });
});

// The three files Excel 2021 saved from `buildFixture("blank")` (README.md),
// graded through the same reader and grade() as the code-built variants.
describe("L01-P1 golden fixtures (saved by Excel 2021)", () => {
  it.each(EXCEL_FIXTURES)("%s grades to its expected score and reasons", (name) => {
    const result = grade(snapshot, excelReadings.get(name)!, 0);
    expect({
      score: result.score,
      correctCount: result.correctCount,
      questions: result.questions.map(({ correct, reasonText }) => ({ correct, reasonText })),
    }).toEqual(EXPECTED_EXCEL[name]);
    expect(result).toEqual(resultOf(EXPECTED_EXCEL[name], snapshot));
  });

  it("Excel saved the answers as the README asks: fill as shared formulas, typed values without formulas", () => {
    const correct = excelReadings.get("l01-p1-correct")!.sheets.Data;
    expect(correct.H13.formula).toBe("E13*G13");
    expect(correct.I13.formula).toBe("E13*$L$2");
    expect(correct.J13.formula).toBe("E13/SUM($E$2:$E$13)");
    expect(correct.R5.formula).toBe("$N5*(1+R$1)");
    expect(excelReadings.get("l01-p1-typed-values")!.sheets.Data.H2.formula).toBeNull();
    expect(excelReadings.get("l01-p1-wrong-function")!.sheets.Data.J13.formula).toBe("E13/(AVERAGE($E$2:$E$13)*COUNT($E$2:$E$13))");
  });

  // Drift guard: content or the template changing under the committed files
  // would make them grade a different exam. Fix fixtureSnapshot(), never the files.
  it.each(EXCEL_FIXTURES)("%s still holds the generated Data cells and template v1's fingerprint", (name) => {
    const reading = excelReadings.get(name)!;
    const data = reading.sheets.Data;
    for (const [ref, value] of Object.entries(driftGuardCells())) {
      expect(data[ref], `${name} Data!${ref}`).toEqual({ formula: null, value, type: typeof value === "number" ? "number" : "string" });
    }
    expect(reading.properties.WHE_AttemptToken).toBe(FIXTURE_TOKEN);
    expect(reading.properties.WHE_TemplateVersion).toBe(String(CURRENT_TEMPLATE_VERSION));
    expect(matchesTemplate(reading.vbaModuleHashes, 1)).toBe(true);
  });
});
