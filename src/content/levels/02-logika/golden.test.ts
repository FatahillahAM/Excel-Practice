import { beforeAll, describe, expect, it } from "vitest";
import { readWorkbook, type WorkbookReading } from "@/adapters/workbook/read";
import { CURRENT_TEMPLATE_VERSION, matchesTemplate } from "@/adapters/workbook/templates";
import { grade } from "@/core/grading";
import type { Tip } from "@/core/content/level-module";
import { logika } from ".";
import type { ExpectedGrade, ItemFixture } from "./__fixtures__/item-fixture";
import * as l02p1 from "./__fixtures__/l02-p1";
import * as l02p2 from "./__fixtures__/l02-p2";
import * as l02p3 from "./__fixtures__/l02-p3";
import * as l02p4 from "./__fixtures__/l02-p4";
import * as l02p5 from "./__fixtures__/l02-p5";
import * as l02t from "./__fixtures__/l02-t";

// Golden fixtures of Level 2 (spine › fixtures): every code-built variant is
// written into template v1 as Excel saves it, read back with readWorkbook and
// graded; score, correct count and every reason are pinned in EXPECTED. The
// Excel 2021 files of L02-P1 and L02-T skip until the user commits them
// (README.md), then must pass; only some of them committed fails the suite.

interface Golden<V extends string> {
  id: string;
  FIXTURE: ItemFixture;
  TIPS_IN_ORDER: readonly Tip[];
  VARIANTS: readonly V[];
  EXPECTED: Readonly<Record<V, ExpectedGrade>>;
  buildFixture(variant: V): Promise<Uint8Array>;
}

const ITEMS = [
  { id: "L02-P1", ...l02p1 },
  { id: "L02-P2", ...l02p2 },
  { id: "L02-P3", ...l02p3 },
  { id: "L02-P4", ...l02p4 },
  { id: "L02-P5", ...l02p5 },
  { id: "L02-T", ...l02t },
] as Golden<string>[];

const summary = (result: ReturnType<typeof grade>) => ({
  score: result.score,
  correctCount: result.correctCount,
  questions: result.questions.map(({ correct, reasonText }) => ({ correct, reasonText })),
});

describe.each(ITEMS)("$id golden fixtures (code-built)", (item) => {
  it("the snapshot is seed 7, kemasan-karton-prima, 100 points with the hint quota of Level 2", () => {
    const snapshot = item.FIXTURE.snapshot();
    expect(snapshot).toMatchObject({ version: 2, contentVersion: logika.contentVersion, hintQuota: 2, scenarioId: "kemasan-karton-prima", seed: 7 });
    expect(snapshot.questions.reduce((sum, q) => sum + q.points, 0)).toBe(100);
  });

  it.each(item.VARIANTS)("%s grades to its expected score and reasons", async (variant) => {
    const result = grade(item.FIXTURE.snapshot(), await readWorkbook(await item.buildFixture(variant)), 0);
    expect(summary(result)).toEqual(item.EXPECTED[variant]);
    expect(result).toEqual(item.FIXTURE.resultOf(item.EXPECTED[variant], item.TIPS_IN_ORDER));
  });
});

describe("L02 code-built fixtures read as Excel saves them", () => {
  it("L02-P1 correct: the seed-7 keys, and K's \"\" results read as an empty text cache", async () => {
    const snapshot = l02p1.FIXTURE.snapshot();
    expect(snapshot.questions.map((q) => q.range)).toEqual(["H2:H13", "I2:I13", "J2:J13", "K2:K13"]);
    expect(l02p1.FIXTURE.cells().Data).toMatchObject({ O2: 1250, O3: 23, O4: 10 });
    const data = (await readWorkbook(await l02p1.buildFixture("correct"))).sheets.Data;
    expect(data.H2).toMatchObject({ formula: 'IF(E2>=$O$2,"Capai","Kurang")', value: "Kurang", type: "string" });
    expect(data.J5).toMatchObject({ formula: "IF(E5>$O$2,E5-$O$2,0)", value: 498 });
    expect(data.K2).toEqual({ formula: 'IF(G2>$O$4,"Cek mesin","")', value: null, type: "string" });
    expect(data.K4).toMatchObject({ value: "Cek mesin", type: "string" });
  });

  it("L02-P1 unknown-function: _xludf. kept in the formula, #NAME? as the value", async () => {
    const data = (await readWorkbook(await l02p1.buildFixture("unknown-function"))).sheets.Data;
    expect(data.H2).toMatchObject({ formula: '_XLUDF.IFF(E2>=$O$2,"Capai","Kurang")', value: "#NAME?", type: "error" });
  });

  it("L02-T correct: IFS with its _xlfn. prefix dropped, a mixed number/text column in L", async () => {
    const data = (await readWorkbook(await l02t.buildFixture("correct"))).sheets.Data;
    expect(data.K2.formula).toBe('IFS(F2=0,"A",F2<=$O$3,"B",TRUE,"C")');
    expect(data.L2).toMatchObject({ value: 72.8125, type: "number" });
    expect(data.L7).toMatchObject({ value: "Tanpa Cacat", type: "string" });
  });
});

/** The Excel 2021 suite of one item: graded, saved as the README asks, and the drift guard. */
function excelSuite<N extends string>(
  id: string,
  module: {
    EXCEL_FIXTURES: readonly N[];
    EXPECTED_EXCEL: Readonly<Record<N, ExpectedGrade>>;
    FIXTURE: ItemFixture;
    FIXTURE_TOKEN: string;
    TIPS_IN_ORDER: readonly Tip[];
    excelFixturesPresent(): boolean;
    readExcelFixture(name: N): Promise<Uint8Array>;
    driftGuardCells(): Record<string, number | string>;
  },
  savedAsAsked: (readings: Map<N, WorkbookReading>) => void,
) {
  const reason = `${id} Excel 2021 fixtures (${module.EXCEL_FIXTURES.map((name) => `${name}.xlsm`).join(", ")}) are not committed yet: see __fixtures__/README.md › ${id}`;
  const present = module.excelFixturesPresent();
  if (!present) console.warn(`skipped: ${reason}`);

  describe.skipIf(!present)(`${id} golden fixtures (saved by Excel 2021)${present ? "" : ` — skipped: ${reason}`}`, () => {
    const readings = new Map<N, WorkbookReading>();
    beforeAll(async () => {
      for (const name of module.EXCEL_FIXTURES) readings.set(name, await readWorkbook(await module.readExcelFixture(name)));
    });

    it.each(module.EXCEL_FIXTURES)("%s grades to its expected score and reasons", (name) => {
      const result = grade(module.FIXTURE.snapshot(), readings.get(name)!, 0);
      expect(summary(result)).toEqual(module.EXPECTED_EXCEL[name]);
      expect(result).toEqual(module.FIXTURE.resultOf(module.EXPECTED_EXCEL[name], module.TIPS_IN_ORDER));
    });

    it("Excel saved the answers as the README asks", () => savedAsAsked(readings));

    // Drift guard: fix the content or the fixture snapshot, never the files.
    it.each(module.EXCEL_FIXTURES)("%s still holds the generated Data cells and template v1's fingerprint", (name) => {
      const reading = readings.get(name)!;
      for (const [ref, value] of Object.entries(module.driftGuardCells())) {
        expect(reading.sheets.Data[ref], `${name} Data!${ref}`).toEqual({ formula: null, value, type: typeof value === "number" ? "number" : "string" });
      }
      expect(reading.properties.WHE_AttemptToken).toBe(module.FIXTURE_TOKEN);
      expect(reading.properties.WHE_TemplateVersion).toBe(String(CURRENT_TEMPLATE_VERSION));
      expect(matchesTemplate(reading.vbaModuleHashes, 1)).toBe(true);
    });
  });
}

excelSuite("L02-P1", l02p1, (readings) => {
  const correct = readings.get("l02-p1-correct")!.sheets.Data;
  expect(correct.H13.formula).toBe('IF(E13>=$O$2,"Capai","Kurang")');
  expect(correct.J13.formula).toBe("IF(E13>$O$2,E13-$O$2,0)");
  expect(correct.K13.formula).toBe('IF(G13>$O$4,"Cek mesin","")');
  // The open question of the plan: Excel 2021 saves its own "" result as t="str" with an empty <v>.
  expect(correct.K2).toEqual({ formula: 'IF(G2>$O$4,"Cek mesin","")', value: null, type: "string" });
  expect(readings.get("l02-p1-typed-values")!.sheets.Data.H2.formula).toBeNull();
});

excelSuite("L02-T", l02t, (readings) => {
  const correct = readings.get("l02-t-correct")!.sheets.Data;
  expect(correct.I13.formula).toBe('IF(AND(E13>=$O$2,F13<=$O$3),"Lolos","Tahan")');
  expect(correct.K13.formula).toBe('IFS(F13=0,"A",F13<=$O$3,"B",TRUE,"C")');
  expect(correct.L13.formula).toBe('IFERROR(E13/F13,"Tanpa Cacat")');
  expect(readings.get("l02-t-typed-values")!.sheets.Data.H2.formula).toBeNull();
  expect(readings.get("l02-t-wrong-function")!.sheets.Data.L2.formula).toBe('IF(F2=0,"Tanpa Cacat",E2/F2)');
});
