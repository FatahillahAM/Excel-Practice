import { describe, expect, it } from "vitest";
import { MAX_QUESTIONS, type LevelModule } from "@/core/content/level-module";
import { canStart, levelProgress, type GradedAttempt } from "@/core/progress";
import { grade } from "@/core/grading";
import type { WorkbookReading } from "@/adapters/workbook/read";
import { fondasi } from "../01-fondasi";
import { logika } from ".";
import { batchesOf, expectFreshData, expectItemRules, param } from "./__fixtures__/content-checks";
import { P1_TIPS, TEXT } from "./practice-1";
import { P2_TEXT } from "./practice-2";
import { P3_TEXT } from "./practice-3";
import { P4_TEXT } from "./practice-4";
import { scenarios } from "./scenarios";
import { TEST_TIPS, levelTest } from "./test";

describe("L02-T (Level 2 Test)", () => {
  it("is item 6 of Level 2, a test without Materi, registered in the module", () => {
    expect(levelTest).toMatchObject({ id: "L02-T", kind: "test", number: 6 });
    expect(levelTest.materi).toBeUndefined();
    expect(logika.items).toContain(levelTest);
    expect(logika.hintQuota).toBe(2);
  });

  it("has six questions (MAX_QUESTIONS) of 15–20 points summing to 100, 3 hints and the practices' Tips, no answer given away", () => {
    expect(MAX_QUESTIONS).toBe(6);
    expectItemRules({
      item: levelTest,
      outputs: [...Object.values(TEXT), ...Object.values(P2_TEXT), ...Object.values(P3_TEXT), ...Object.values(P4_TEXT)],
      points: [15, 15, 15, 20, 20, 15],
      tips: Object.values(TEST_TIPS),
      formulas: [
        'IF(E2>=$O$2,"Capai","Kurang")',
        "AND(E2>=$O$2,F2<=$O$3)",
        "OR(F2>$O$3,G2>$O$4)",
        'IFS(F2=0,"A",F2<=$O$3,"B",TRUE,"C")',
        'IF(F2=0,"A",IF(F2<=$O$3,"B","C"))',
        'IFERROR(E2/F2,"Tanpa Cacat")',
        'IF(G2>$O$4,"Cek mesin","")',
      ],
    });
    expect(TEST_TIPS.args).toBe(P1_TIPS.args);
  }, 30_000);

  it("computes every key from the generated data (R2), with a batch without defects", () => {
    for (const scenario of scenarios) {
      const exam = levelTest.generate(11, scenario);
      const batches = batchesOf(exam);
      const [target, defects, downtime] = [2, 3, 4].map((row) => param(exam, row) as number);
      expect(batches.some((b) => b.defects === 0)).toBe(true);
      const keys = exam.questions.map((q) => Object.values(q.key));
      expect(keys[0]).toEqual(batches.map((b) => (b.units >= target ? "Capai" : "Kurang")));
      expect(keys[1]).toEqual(batches.map((b) => (b.units >= target && b.defects <= defects ? "Lolos" : "Tahan")));
      expect(keys[2]).toEqual(batches.map((b) => (b.defects > defects || b.downtime > downtime ? "Ya" : "Tidak")));
      expect(keys[3]).toEqual(batches.map((b) => (b.defects === 0 ? "A" : b.defects <= defects ? "B" : "C")));
      expect(keys[4]).toEqual(batches.map((b) => (b.defects === 0 ? "Tanpa Cacat" : b.units / b.defects)));
      expect(keys[5]).toEqual(batches.map((b) => (b.downtime > downtime ? "Cek mesin" : "")));
    }
  });

  it("says there is no time limit and the pass mark, keeping the Finish line on B12", () => {
    const instructions = levelTest.generate(3, scenarios[2]).cells.Instructions;
    expect(instructions.B2).toMatch(/^Level 2 · Test — /);
    expect(instructions.B4).toContain("Test ini tanpa batas waktu; lulus dengan skor 80.");
    expect(instructions.B11).toMatch(/^6\. /);
    expect(instructions.B12).toMatch(/^Kalau sudah selesai, klik Finish/);
  });

  it("draws different data for two attempts (R1)", () => expectFreshData(levelTest));

  it("scores 100 with every answer right, 80 with the IFERROR question wrong (passes), 65 with one more wrong; −5 per hint", () => {
    const exam = levelTest.generate(7, scenarios[0]);
    const snapshot = { version: 2 as const, contentVersion: logika.contentVersion, scenarioId: scenarios[0].id, seed: 7, hintQuota: 2, questions: exam.questions };
    const reading = (wrong: number[] = []): WorkbookReading => {
      const data: WorkbookReading["sheets"][string] = {};
      for (const q of exam.questions) {
        for (const [ref, value] of Object.entries(q.key)) {
          const row = ref.slice(1);
          const formula = q.number === 5 ? `IFERROR(E${row}/F${row},"Tanpa Cacat")` : `IF(AND(E${row}>=$O$2,F${row}<=$O$3,G${row}>$O$4),"x",IF(OR(F${row}>$O$3),"y","z"))`;
          const typed = wrong.includes(q.number);
          data[ref] = { formula: typed ? null : formula, value, type: typeof value === "number" ? "number" : "string" };
        }
      }
      return { sheets: { Data: data }, properties: {}, vbaModuleHashes: null, tables: { Data: [] } };
    };
    expect(grade(snapshot, reading(), 0).score).toBe(100);
    expect(grade(snapshot, reading([5]), 0).score).toBe(80);
    expect(grade(snapshot, reading([5, 1]), 0).score).toBe(65);
    expect(grade(snapshot, reading(), 2).score).toBe(90);
    expect(() => grade(snapshot, reading(), 3)).toThrow(/hintQuota/);
  });
});

describe("the real L02-T gate (registry: L01 + L02)", () => {
  const real = [fondasi, logika] as unknown as LevelModule[];
  const at = (itemId: string, score: number): GradedAttempt => ({ id: `${itemId}-${score}`, itemId, score, startedAt: "2026-11-27T01:00:00Z", receivedAt: "2026-11-27T01:10:00Z" });
  const l1Passed = at("L01-T", 80);

  it("Level 2 is locked until the L01-T passes; then L02-P1 starts", () => {
    expect(canStart(levelProgress([], real), real, "L02-P1")).toMatchObject({ ok: false });
    expect(canStart(levelProgress([l1Passed], real), real, "L02-P1")).toEqual({ ok: true, practiceAgain: false });
  });

  it("L02-T opens once the 5 L02 practices each have a graded attempt; 80 passes Level 2", () => {
    const four = ["L02-P1", "L02-P2", "L02-P3", "L02-P4"].map((id) => at(id, 40));
    expect(canStart(levelProgress([l1Passed, ...four], real), real, "L02-T")).toEqual({ ok: false, reason: "test_locked", toGo: 1 });
    expect(canStart(levelProgress([l1Passed, ...four, at("L02-P5", 0)], real), real, "L02-T")).toEqual({ ok: true, practiceAgain: false });
    expect(levelProgress([l1Passed, at("L02-T", 80)], real).slice(0, 2).map((level) => level.state)).toEqual(["passed", "passed"]);
    expect(levelProgress([l1Passed, at("L02-T", 79)], real)[1]).toMatchObject({ state: "active", testPassed: false });
  });
});
