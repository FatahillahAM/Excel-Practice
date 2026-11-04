import { describe, expect, it } from "vitest";
import { expandRange } from "../../core/content/a1";
import {
  defineLevelModule,
  examSnapshotSchema,
  generatedExamSchema,
  INSTRUCTIONS_CELLS,
  ITEM_ID_RE,
  itemLabel,
  levelModuleSchema,
  type ExamCellValue,
  type GeneratedExam,
  type LevelItem,
  type LevelModule,
} from "../../core/content/level-module";
import { findItem, levels } from "./index";
import { fondasi } from "./01-fondasi";
import { DATA_HEADERS, practice1 } from "./01-fondasi/practice-1";
import { fondasiScenarioSchema, scenarios, type FondasiScenario } from "./01-fondasi/scenarios";

const SEEDS = Array.from({ length: 50 }, (_, i) => i + 1);

describe("level registry", () => {
  it("lists Level 1 Fondasi (V1, 3 hints, content version 1) with Practice 1", () => {
    expect(levels.map((level) => level.id)).toEqual(["01-fondasi"]);
    const [level] = levels;
    expect(level).toMatchObject({ number: 1, name: "Fondasi", phase: "v1", hintQuota: 3, contentVersion: 1 });
    expect(level.items.map((item) => item.id)).toEqual(["L01-P1"]);
    expect(level.functions).toEqual(["$ references", "Excel Table (Ctrl+T)", "Sort & Filter"]);
    for (const candidate of levels) expect(levelModuleSchema.safeParse(candidate).success).toBe(true);
  });

  it("has at least 10 scenarios with unique ids, each passing the level's scenario schema", () => {
    expect(fondasi.scenarios.length).toBeGreaterThanOrEqual(10);
    expect(new Set(fondasi.scenarios.map((s) => s.id)).size).toBe(fondasi.scenarios.length);
    for (const scenario of fondasi.scenarios) expect(fondasiScenarioSchema.safeParse(scenario).success).toBe(true);
  });

  it("finds L01-P1 and nothing else", () => {
    const found = findItem("L01-P1");
    expect(found?.level.id).toBe("01-fondasi");
    expect(found?.item).toMatchObject({ id: "L01-P1", kind: "practice", number: 1 });
    expect(itemLabel(found!.item)).toBe("Practice 1");
    expect(findItem("L01-P2")).toBeNull();
    expect(findItem("")).toBeNull();
  });
});

type Cells = Readonly<Record<string, ExamCellValue>>;
const num = (cells: Cells, ref: string) => {
  const value = cells[ref];
  if (typeof value !== "number") throw new Error(`Data!${ref} is not a number: ${String(value)}`);
  return value;
};

/** The key of each question recomputed from the Data cells alone, as Excel would compute the expected formulas. */
function recomputeKeys(data: Cells): Record<string, number>[] {
  let last = 1;
  while (data[`A${last + 1}`] !== undefined) last++;
  const rows = Array.from({ length: last - 1 }, (_, i) => i + 2);
  let total = 0;
  for (const r of rows) total += num(data, `E${r}`);
  const rate = num(data, "L2");
  const h: Record<string, number> = {};
  const i: Record<string, number> = {};
  const j: Record<string, number> = {};
  for (const r of rows) {
    h[`H${r}`] = num(data, `E${r}`) * num(data, `G${r}`);
    i[`I${r}`] = num(data, `E${r}`) * rate;
    j[`J${r}`] = num(data, `E${r}`) / total;
  }
  const grid: Record<string, number> = {};
  for (let r = 2; data[`M${r}`] !== undefined; r++) {
    for (const c of ["O", "P", "Q", "R"]) grid[`${c}${r}`] = num(data, `N${r}`) * (1 + num(data, `${c}1`));
  }
  return [h, i, j, grid];
}

describe("L01-P1 generate", () => {
  it.each(scenarios.map((s) => [s.id, s] as const))("%s × seeds 1…50: valid exam, key matches an independent recomputation", (_, scenario) => {
    for (const seed of SEEDS) {
      const exam = practice1.generate(seed, scenario);
      const parsed = generatedExamSchema.safeParse(exam);
      expect(parsed.success, parsed.success ? "" : parsed.error.message).toBe(true);

      const data = exam.cells.Data;
      const instructions = exam.cells.Instructions;
      expect(DATA_HEADERS.map((_, c) => data[`${"ABCDEFG"[c]}1`])).toEqual([...DATA_HEADERS]);
      const n = Object.keys(data).filter((ref) => /^A\d+$/.test(ref)).length - 1;
      expect(n).toBeGreaterThanOrEqual(12);
      expect(n).toBeLessThanOrEqual(20);
      // Units are integers, costs have at most two decimals, so keys are exact doubles.
      for (let r = 2; r <= n + 1; r++) {
        expect(Number.isInteger(data[`E${r}`])).toBe(true);
        expect(Number.isInteger(data[`F${r}`])).toBe(true);
        expect(Math.round(num(data, `G${r}`) * 100) / 100).toBe(data[`G${r}`]);
        expect(scenario.lines).toContain(data[`B${r}`]);
        expect(scenario.shifts).toContain(data[`C${r}`]);
        expect(scenario.products.map((p) => p.name)).toContain(data[`D${r}`]);
      }

      expect(exam.questions.map((q) => q.points)).toEqual([20, 25, 25, 30]);
      const keys = recomputeKeys(data);
      exam.questions.forEach((question, index) => {
        expect(question.key).toEqual(keys[index]);
        expect(Object.keys(question.key).sort()).toEqual([...expandRange(question.range)!].sort());
        for (const ref of Object.keys(question.key)) expect(data[ref]).toBeUndefined();
        expect(question.prompt).toContain(question.range);
        expect(instructions[INSTRUCTIONS_CELLS.lines[index]]).toBe(`${question.number}. ${question.prompt}`);
      });

      // Prompts name columns only by header labels present in row 1 of Data.
      const row1 = new Set(Object.entries(data).filter(([ref]) => /^[A-Z]+1$/.test(ref)).map(([, v]) => v));
      for (const question of exam.questions) {
        const quoted = Array.from(question.prompt.matchAll(/"([^"]+)"/g), (m) => m[1]);
        expect(quoted.length).toBeGreaterThan(0);
        for (const label of quoted) expect(row1, `${scenario.id}/${seed}: "${label}"`).toContain(label);
        // `$` and F4 are hints (epic 3), not prompt text.
        expect(question.prompt).not.toMatch(/\$|F4/);
      }

      expect(instructions.B2).toBe(`Level 1 · Practice 1 — ${scenario.title}`);
      expect(instructions.B4).toContain(scenario.story);
      expect(instructions.B10).toMatch(/^Kalau sudah selesai, klik Finish/);
    }
  });

  it("gives different Data and keys for seeds 1 and 2 of the same scenario", () => {
    for (const scenario of scenarios) {
      const one = practice1.generate(1, scenario);
      const two = practice1.generate(2, scenario);
      expect(one.cells.Data).not.toEqual(two.cells.Data);
      expect(one.questions.map((q) => q.key)).not.toEqual(two.questions.map((q) => q.key));
    }
  });

  it("gives the same exam for the same seed, byte for byte", () => {
    for (const scenario of scenarios) {
      for (const seed of [0, 7, 4294967295]) {
        expect(JSON.stringify(practice1.generate(seed, scenario))).toBe(JSON.stringify(practice1.generate(seed, scenario)));
      }
    }
  });

  it("builds a snapshot the snapshot schema accepts", () => {
    const exam = practice1.generate(99, scenarios[0]);
    const snapshot = { contentVersion: fondasi.contentVersion, scenarioId: scenarios[0].id, seed: 99, questions: exam.questions };
    expect(examSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(examSnapshotSchema.safeParse({ ...snapshot, seed: -1 }).success).toBe(false);
    expect(examSnapshotSchema.safeParse({ ...snapshot, questions: exam.questions.slice(1) }).success).toBe(false);
  });
});

type MutableExam = {
  cells: Record<string, Record<string, ExamCellValue>>;
  questions: { number: number; prompt: string; points: number; checks: unknown[]; key: Record<string, ExamCellValue> }[];
};

/** Practice 1 with its output changed by `mutate`. */
function brokenItem(mutate: (exam: MutableExam) => void): LevelItem<FondasiScenario> {
  return {
    ...practice1,
    generate(seed, scenario) {
      const exam = structuredClone(practice1.generate(seed, scenario)) as unknown as MutableExam;
      mutate(exam);
      return exam as unknown as GeneratedExam;
    },
  };
}

const validLevel: LevelModule<FondasiScenario> = {
  id: "01-fondasi",
  number: 1,
  name: "Fondasi",
  phase: "v1",
  contentVersion: 1,
  functions: ["$ references"],
  hintQuota: 3,
  scenarios,
  scenarioSchema: fondasiScenarioSchema,
  items: [practice1],
};

describe("defineLevelModule (load-time checks)", () => {
  it("accepts the valid module", () => {
    expect(() => defineLevelModule(validLevel)).not.toThrow();
  });

  it.each<[string, Partial<LevelModule<FondasiScenario>>, RegExp]>([
    ["points summing to 95", { items: [brokenItem((e) => (e.questions[0].points = 15))] }, /Points sum to 95/],
    ["9 scenarios", { scenarios: scenarios.slice(0, 9) }, /at least 10 scenarios/],
    ["a duplicate scenario id", { scenarios: [...scenarios.slice(0, 10), { ...scenarios[0] }] }, /Duplicate scenario/],
    [
      "LAMBDA in a prompt",
      {
        items: [
          brokenItem((e) => {
            e.questions[0].prompt += " Boleh pakai LAMBDA.";
            e.cells.Instructions.B6 = `1. ${e.questions[0].prompt}`;
          }),
        ],
      },
      /Microsoft 365-only function LAMBDA/,
    ],
    ["TAKE in the Instructions", { items: [brokenItem((e) => (e.cells.Instructions.B4 += " Pakai TAKE."))] }, /Microsoft 365-only function TAKE/],
    ["VSTACK in the level functions", { functions: ["VSTACK"] }, /Microsoft 365-only function VSTACK/],
    ["a key missing one cell", { items: [brokenItem((e) => delete e.questions[0].key.H2)] }, /missing H2/],
    ["a key with an extra cell", { items: [brokenItem((e) => (e.questions[0].key.Z99 = 1))] }, /extra Z99/],
    ["an answer cell that is written", { items: [brokenItem((e) => (e.cells.Data.H2 = 1))] }, /Answer cell Data!H2 is written/],
    ["questions numbered out of order", { items: [brokenItem((e) => (e.questions[1].number = 3))] }, /must be number 2/],
    ["a question without value_equals_key", { items: [brokenItem((e) => (e.questions[0].checks = [{ name: "formula_present" }]))] }, /value_equals_key/],
    ["an Instructions cell outside layout v1", { items: [brokenItem((e) => (e.cells.Instructions.B12 = "x"))] }, /no Instructions!B12/],
    ["a sheet the template does not have", { items: [brokenItem((e) => (e.cells.Hasil = { A1: "x" }))] }, /no sheet Hasil/],
    ["a scenario failing the level schema", { scenarios: [...scenarios.slice(1), { ...scenarios[0], lines: ["Lini A"] }] }, /scenario/],
    [
      "a generate that throws",
      { items: [{ ...practice1, generate: () => { throw new Error("boom"); } }] },
      /generate threw boom/,
    ],
  ])("rejects %s", (_, change, message) => {
    expect(() => defineLevelModule({ ...validLevel, ...change })).toThrow(message);
  });

  it("rejects the static shape", () => {
    const item = practice1;
    for (const change of [
      { items: [{ ...item, id: "L02-P1" }] },
      { items: [{ ...item, number: 2 }] },
      { items: [item, item] },
      { id: "02-fondasi" },
      { hintQuota: -1 },
      { phase: "later" },
      { functions: [] },
      { functions: [""] },
      { contentVersion: 0 },
      { items: [{ id: "L01-P1", kind: "practice", number: 1 }] },
      { scenarioSchema: undefined },
    ]) {
      const candidate = { ...validLevel, ...change } as unknown as LevelModule<FondasiScenario>;
      expect(() => defineLevelModule(candidate), JSON.stringify(change)).toThrow();
    }
  });

  it("accepts the item ids of the attempts table", () => {
    for (const id of ["L01-P1", "L09-P5", "L03-T", "UA"]) expect(id).toMatch(ITEM_ID_RE);
    for (const id of ["L1-P1", "L01-P6", "L01-T1", "UA1", "l01-p1"]) expect(id).not.toMatch(ITEM_ID_RE);
  });

  it("accepts the Test as item 6, and a Next level without scenarios", () => {
    const test = { ...practice1, id: "L01-T", kind: "test" as const, number: 6 };
    expect(() => defineLevelModule({ ...validLevel, items: [practice1, test] })).not.toThrow();
    expect(itemLabel({ kind: "test", number: 6 })).toBe("Test");
    expect(() => defineLevelModule({ ...validLevel, phase: "next", scenarios: [], items: [] })).not.toThrow();
  });
});
