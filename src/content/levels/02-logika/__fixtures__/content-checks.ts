import { expect } from "vitest";
import { expandRange } from "@/core/content/a1";
import { generatedExamSchema, INSTRUCTIONS_CELLS, type GeneratedExam, type LevelItem, type Tip } from "@/core/content/level-module";
import type { Batch } from "../batches";
import { scenarios, type LogikaScenario } from "../scenarios";

/**
 * Test only: the content rules every L02 item is held to (the pattern of
 * L01's `content-checks.ts`), so each item test names only what is its own:
 * points, Tips, the formulas hints must not give away, the keys.
 */

export const SEEDS = [1, 2, 3, 4, 5];

/** Uppercase, no spaces: how a formula is compared inside hint text. */
export const normalize = (text: string) => text.replace(/\s+/g, "").toUpperCase();

/** The last data row of an exam: A2… filled down from row 2. */
export function lastRow(exam: GeneratedExam): number {
  let last = 1;
  while (exam.cells.Data[`A${last + 1}`] !== undefined) last++;
  return last;
}

export interface ItemRules {
  item: LevelItem<LogikaScenario>;
  points: number[];
  tips: readonly Tip[];
  /** Whole answer formulas (top cell, no `=`) that no hint, Tip title or body may contain. */
  formulas: string[];
  /** The text answers prompts may quote (`"Capai"`); any other quoted word must be a Data header. */
  outputs: readonly string[];
}

/**
 * Every scenario × seed: a valid exam of 100 points with the declared points,
 * 3 hints and the Tip of each question (identical across seeds), the Finish
 * line after the prompts, no answer formula or required reference in hints or
 * Tips, quoted words in a prompt that are a Data header (row 1) or one of
 * the item's text answers, no `$` or F4 key in a prompt, and answer
 * cells left empty.
 */
export function expectItemRules({ item, points, tips, formulas, outputs }: ItemRules): void {
  const forbidden = formulas.map(normalize);
  for (const scenario of scenarios) {
    for (const seed of SEEDS) {
      const where = `${item.id} ${scenario.id} seed ${seed}`;
      const exam = item.generate(seed, scenario);
      const parsed = generatedExamSchema.safeParse(exam);
      expect(parsed.success, parsed.success ? where : `${where}: ${parsed.error.message}`).toBe(true);
      expect(exam.questions.map((q) => q.points), where).toEqual(points);
      expect(exam.questions.map((q) => q.hints.length), where).toEqual(points.map(() => 3));
      exam.questions.forEach((q, i) => expect(q.tip, `${where} Q${q.number}`).toEqual(tips[i]));
      const instructions = exam.cells.Instructions;
      expect(instructions[INSTRUCTIONS_CELLS.lines[exam.questions.length]], where).toMatch(/^Kalau sudah selesai, klik Finish/);
      const headers = new Set(Object.entries(exam.cells.Data).filter(([ref]) => /^[A-Z]+1$/.test(ref)).map(([, value]) => value));
      for (const question of exam.questions) {
        const refs = question.checks.flatMap((check) => (check.name === "uses_reference" ? [check.ref] : []));
        for (const text of [...question.hints, question.tip.title, question.tip.body]) {
          for (const formula of forbidden) expect(normalize(text), `${where} Q${question.number}: ${formula}`).not.toContain(formula);
          for (const ref of refs) expect(normalize(text), `${where} Q${question.number}: ${ref}`).not.toContain(normalize(ref));
        }
        for (const label of Array.from(question.prompt.matchAll(/"([^"]+)"/g), (m) => m[1])) {
          expect(headers.has(label) || outputs.includes(label), `${where} Q${question.number}: "${label}"`).toBe(true);
        }
        // Every text answer is one the prompt names ("" is the empty text the prompt describes).
        for (const value of Object.values(question.key)) {
          if (typeof value === "string" && value !== "") expect(question.prompt, `${where} Q${question.number}`).toContain(`"${value}"`);
        }
        expect(question.prompt, where).not.toMatch(/\$|\bF4\b/);
        for (const ref of expandRange(question.range)!) expect(exam.cells.Data[ref], `${where} ${ref}`).toBeUndefined();
      }
    }
  }
}

/** Two seeds of one scenario give different Data and keys; one seed always gives the same exam (R1). */
export function expectFreshData(item: LevelItem<LogikaScenario>): void {
  for (const scenario of scenarios) {
    const a = item.generate(101, scenario);
    const b = item.generate(102, scenario);
    expect(a.cells.Data, scenario.id).not.toEqual(b.cells.Data);
    expect(a.questions.map((q) => q.key), scenario.id).not.toEqual(b.questions.map((q) => q.key));
    expect(item.generate(101, scenario)).toEqual(a);
  }
}

/** The batches of an L02 Data sheet (A2:G{last}), read back from the generated cells. */
export function batchesOf(exam: GeneratedExam): Batch[] {
  const data = exam.cells.Data;
  const rows: Batch[] = [];
  for (let r = 2; data[`A${r}`] !== undefined; r++) {
    rows.push({
      code: data[`A${r}`] as string,
      line: data[`B${r}`] as string,
      shift: data[`C${r}`] as string,
      product: data[`D${r}`] as string,
      units: data[`E${r}`] as number,
      defects: data[`F${r}`] as number,
      downtime: data[`G${r}`] as number,
    });
  }
  return rows;
}

/** Parameter `O{row}` of an exam, as a number or text. */
export const param = (exam: GeneratedExam, row: number) => exam.cells.Data[`O${row}`];

/** Every key of a question, in range order. */
export const keyValues = (exam: GeneratedExam, number: number) => Object.values(exam.questions[number - 1].key);

/** Both outcomes of a two-way question occur over the scenarios × seeds (the drawn limits split the data). */
export function expectBothOutcomes(item: LevelItem<LogikaScenario>, number: number, outcomes: readonly (string | number)[]): void {
  const seen = new Set<string | number>();
  for (const scenario of scenarios) for (const seed of SEEDS) for (const value of keyValues(item.generate(seed, scenario), number)) seen.add(value);
  for (const outcome of outcomes) expect(seen, `${item.id} Q${number}: ${outcome}`).toContain(outcome);
}
