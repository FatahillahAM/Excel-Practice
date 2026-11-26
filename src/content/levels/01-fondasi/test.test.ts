import { describe, expect, it } from "vitest";
import { generatedExamSchema, type LevelModule } from "@/core/content/level-module";
import { canStart, levelProgress, type GradedAttempt } from "@/core/progress";
import { grade } from "@/core/grading";
import type { WorkbookReading } from "@/adapters/workbook/read";
import { DATA_HEADERS } from "./practice-1";
import { fondasi } from ".";
import { scenarios } from "./scenarios";
import { TEST_TIPS, levelTest, rankEq } from "./test";

const SEEDS = [1, 2, 3, 4, 5];
const TIP_IDS = [
  "l01-isi-rumus-sekaligus",
  "l01-kunci-sel-f4",
  "l01-format-persen",
  "l01-urutan-tanpa-sort",
  "l01-referensi-campuran",
  "l01-ctrl-t-table",
];

/** Uppercase, no spaces: how a formula is compared inside hint text. */
const normalize = (text: string) => text.replace(/\s+/g, "").toUpperCase();

/** The data a generated exam was built from, read back from its cells. */
function dataOf(exam: ReturnType<typeof levelTest.generate>) {
  const data = exam.cells.Data;
  const rows: { units: number; defects: number }[] = [];
  for (let row = 2; data[`A${row}`] !== undefined; row++) rows.push({ units: data[`E${row}`] as number, defects: data[`F${row}`] as number });
  return { rows, last: rows.length + 1, target: data.O2 as number };
}

describe("L01-T (Level 1 Test)", () => {
  it("is item 6 of Level 1, a test, registered in the module", () => {
    expect(levelTest).toMatchObject({ id: "L01-T", kind: "test", number: 6 });
    expect(fondasi.items).toContain(levelTest);
  });

  it("has six questions (the instruction-line cap) of 15–20 points summing to 100, each with 3 hints and its Tip, ids in order", () => {
    for (const scenario of scenarios) {
      for (const seed of SEEDS) {
        const exam = levelTest.generate(seed, scenario);
        expect(generatedExamSchema.safeParse(exam).success, `${scenario.id} seed ${seed}`).toBe(true);
        const { questions } = exam;
        expect(questions.map((q) => q.points)).toEqual([15, 15, 15, 15, 20, 20]);
        expect(questions.reduce((sum, q) => sum + q.points, 0)).toBe(100);
        expect(questions.map((q) => q.hints.length)).toEqual([3, 3, 3, 3, 3, 3]);
        expect(questions.map((q) => q.tip.id)).toEqual(TIP_IDS);
      }
    }
  });

  it("computes every key from the generated data (R2)", () => {
    for (const scenario of scenarios) {
      const exam = levelTest.generate(11, scenario);
      const { rows, last, target } = dataOf(exam);
      const good = rows.map((row) => row.units - row.defects);
      const total = good.reduce((sum, value) => sum + value, 0);
      const [q1, q2, q3, q4, q5, q6] = exam.questions;
      expect(q1.range).toBe(`I2:I${last}`);
      good.forEach((value, i) => {
        const row = i + 2;
        expect(q1.key[`I${row}`]).toBe(value);
        expect(q2.key[`J${row}`]).toBe(value - target);
        expect(q3.key[`K${row}`]).toBeCloseTo(value / total, 12);
        expect(q4.key[`L${row}`]).toBe(1 + good.filter((other) => other > value).length);
      });
      const data = exam.cells.Data;
      for (const [ref, value] of Object.entries(q5.key)) {
        const row = Number(ref.slice(1));
        const column = ref[0];
        expect(value).toBeCloseTo((data[`R${row}`] as number) * (1 + (data[`${column}1`] as number)), 9);
      }
      expect(q6.key).toEqual({ O4: Math.max(...good) });
      expect(q6.checks[0]).toEqual({ name: "is_table", ref: `A1:G${last}`, headers: [...DATA_HEADERS] });
      expect(target % 10).toBe(0);
    }
  });

  it("draws different data for two attempts and recomputes the keys (R1)", () => {
    const a = levelTest.generate(101, scenarios[0]);
    const b = levelTest.generate(102, scenarios[0]);
    expect(a.cells.Data).not.toEqual(b.cells.Data);
    expect(a.questions[0].key).not.toEqual(b.questions[0].key);
    expect(levelTest.generate(101, scenarios[0])).toEqual(a);
  });

  it("ranks ties as RANK.EQ does (largest first, ties share a place)", () => {
    expect([50, 70, 70, 10].map((value) => rankEq(value, [50, 70, 70, 10]))).toEqual([3, 1, 1, 4]);
  });

  it("refers only to cells the exam fills (R3) and keeps the Finish line after the six prompts", () => {
    const exam = levelTest.generate(3, scenarios[2]);
    const data = exam.cells.Data;
    for (const ref of ["O2", "N2", "N4", "Q1", "R1", "S1", "V1", "Q2", "R2"]) expect(data[ref], ref).toBeDefined();
    // Column H stays empty, so Ctrl+T on the data finds exactly A1:G{n+1}.
    expect(Object.keys(data).filter((ref) => /^H\d+$/.test(ref))).toEqual([]);
    const instructions = exam.cells.Instructions;
    expect(instructions.B2).toMatch(/^Level 1 · Test — /);
    expect(instructions.B4).toContain("tanpa batas waktu");
    expect(instructions.B11).toMatch(/^6\. /);
    expect(instructions.B12).toMatch(/Finish/);
  });

  it("never gives away an answer formula or a required reference in hints or the Tip", () => {
    for (const scenario of scenarios) {
      for (const seed of SEEDS) {
        const { questions } = levelTest.generate(seed, scenario);
        const last = Number(/I2:I(\d+)/.exec(questions[0].range)![1]);
        const formulas = ["E2-F2", "I2-$O$2", `I2/SUM($I$2:$I$${last})`, `RANK.EQ(I2,$I$2:$I$${last})`, "$R2*(1+S$1)", `MAX(I2:I${last})`].map(normalize);
        for (const question of questions) {
          const where = `${scenario.id} seed ${seed} Q${question.number}`;
          const refs = question.checks.flatMap((check) => (check.name === "uses_reference" ? [check.ref] : []));
          for (const text of [...question.hints, question.tip.title, question.tip.body]) {
            for (const formula of formulas) expect(normalize(text), `${where}: ${formula}`).not.toContain(formula);
            for (const ref of refs) expect(normalize(text), `${where}: ${ref}`).not.toContain(normalize(ref));
          }
        }
      }
    }
  });

  it("keeps each Tip identical across seeds and scenarios, sharing the L01-P1 and L01-P2 cards", () => {
    const tips = Object.values(TEST_TIPS);
    for (const scenario of scenarios) {
      for (const seed of SEEDS) levelTest.generate(seed, scenario).questions.forEach((q, i) => expect(q.tip).toEqual(tips[i]));
    }
  });

  it("scores 100 with every answer right and the Table made, passes at 80 (−20 for the Table, −15 more fails)", () => {
    const exam = levelTest.generate(7, scenarios[0]);
    const snapshot = { version: 2 as const, contentVersion: fondasi.contentVersion, scenarioId: scenarios[0].id, seed: 7, hintQuota: 3, questions: exam.questions };
    const last = exam.questions[0].range.split(":")[1].slice(1);
    const formulas: Record<number, (ref: string) => string> = {
      1: (ref) => `E${ref.slice(1)}-F${ref.slice(1)}`,
      2: (ref) => `I${ref.slice(1)}-$O$2`,
      3: (ref) => `I${ref.slice(1)}/SUM($I$2:$I$${last})`,
      4: (ref) => `RANK.EQ(I${ref.slice(1)},$I$2:$I$${last})`,
      5: (ref) => `$R${ref.slice(1)}*(1+${ref[0]}$1)`,
      6: () => `MAX(I2:I${last})`,
    };
    const table = { name: "Table1", ref: `A1:G${last}`, headerRow: true, columns: [...DATA_HEADERS] };
    const reading = (skip: number[] = [], tables = [table]): WorkbookReading => {
      const data: WorkbookReading["sheets"][string] = {};
      for (const q of exam.questions) {
        if (skip.includes(q.number)) continue;
        for (const [ref, value] of Object.entries(q.key)) data[ref] = { formula: formulas[q.number](ref), value, type: "number" };
      }
      return { sheets: { Data: data }, properties: {}, vbaModuleHashes: null, tables: { Data: tables } };
    };
    expect(grade(snapshot, reading(), 0).score).toBe(100);
    expect(grade(snapshot, reading([], []), 0).score).toBe(80);
    expect(grade(snapshot, reading([], []), 0).questions[5].reasonText).toBe(`Data di A1:G${last} belum dijadikan Excel Table.`);
    expect(grade(snapshot, reading([4], []), 0).score).toBe(65);
    expect(grade(snapshot, reading(), 3).score).toBe(85);
  });
});

describe("the real L01-T (registry: P1–P5 + Test)", () => {
  const real = [fondasi as unknown as LevelModule];
  const at = (itemId: string, score: number): GradedAttempt => ({ id: `${itemId}-${score}`, itemId, score, startedAt: "2026-11-02T01:00:00Z", receivedAt: "2026-11-02T01:10:00Z" });
  const states = (progress: ReturnType<typeof levelProgress>) => progress.map((level) => level.state);

  it("is locked until 5 distinct practices, and opens once P1..P5 each have a graded attempt", () => {
    expect(canStart(levelProgress([], real), real, "L01-T")).toEqual({ ok: false, reason: "test_locked", toGo: 5 });
    const progress = levelProgress([at("L01-P1", 64), at("L01-P1", 90)], real);
    expect(canStart(progress, real, "L01-T")).toEqual({ ok: false, reason: "test_locked", toGo: 4 });
    expect(progress[0]).toMatchObject({ state: "active", testPassed: false, testAttempted: false });
    const four = ["L01-P1", "L01-P2", "L01-P3", "L01-P4"].map((id) => at(id, 30));
    expect(canStart(levelProgress(four, real), real, "L01-T")).toEqual({ ok: false, reason: "test_locked", toGo: 1 });
    expect(canStart(levelProgress([...four, at("L01-P5", 0)], real), real, "L01-T")).toEqual({ ok: true, practiceAgain: false });
  });

  it("a graded L01-T at 80 passes Level 1 (Level 2 Under Construction); 79 does not", () => {
    expect(states(levelProgress([at("L01-T", 80)], real)).slice(0, 2)).toEqual(["passed", "under_construction"]);
    expect(levelProgress([at("L01-T", 79)], real)[0]).toMatchObject({ state: "active", testAttempted: true, testPassed: false });
  });
});
