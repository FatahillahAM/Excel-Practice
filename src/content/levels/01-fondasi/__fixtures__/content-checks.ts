import { expect } from "vitest";
import { expandRange } from "@/core/content/a1";
import { generatedExamSchema, INSTRUCTIONS_CELLS, type GeneratedExam, type LevelItem, type Tip } from "@/core/content/level-module";
import { scenarios, type FondasiScenario } from "../scenarios";

/**
 * Test only: the content rules every L01 practice of 5.2 is held to (the
 * pattern of `practice-1.test.ts`), so each practice test names only what is
 * its own: points, Tips, the formulas hints must not give away, the keys.
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

export interface PracticeRules {
  item: LevelItem<FondasiScenario>;
  points: number[];
  tips: readonly Tip[];
  /** Whole answer formulas (top cell) that no hint, Tip title or body may contain, for an exam ending at row `last`. */
  formulas: (last: number) => string[];
}

/**
 * Every scenario × seed: a valid exam of 100 points with the declared
 * points, 3 hints and the Tip of each question (identical across seeds:
 * one id, one card), prompts on lines B6… with the Finish line after them,
 * no answer formula or required reference in hints or Tips, quoted column
 * names present in row 1 of Data, and no `$` or F4 key in a prompt.
 */
export function expectPracticeRules({ item, points, tips, formulas }: PracticeRules): void {
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
      const forbidden = formulas(lastRow(exam)).map(normalize);
      const row1 = new Set(Object.entries(exam.cells.Data).filter(([ref]) => /^[A-Z]+1$/.test(ref)).map(([, value]) => value));
      for (const question of exam.questions) {
        const refs = question.checks.flatMap((check) => (check.name === "uses_reference" ? [check.ref] : []));
        for (const text of [...question.hints, question.tip.title, question.tip.body]) {
          for (const formula of forbidden) expect(normalize(text), `${where} Q${question.number}: ${formula}`).not.toContain(formula);
          for (const ref of refs) expect(normalize(text), `${where} Q${question.number}: ${ref}`).not.toContain(normalize(ref));
        }
        for (const label of Array.from(question.prompt.matchAll(/"([^"]+)"/g), (m) => m[1])) {
          expect(row1, `${where} Q${question.number}: "${label}"`).toContain(label);
        }
        // `$` and the F4 key are the hints' job (F4 as a cell, `C2:F4`, is fine).
        expect(question.prompt, where).not.toMatch(/\$|(?<!:|sampai )\bF4\b/);
        for (const ref of expandRange(question.range)!) expect(exam.cells.Data[ref], `${where} ${ref}`).toBeUndefined();
      }
    }
  }
}

/** Two seeds of one scenario give different Data and keys; one seed always gives the same exam (R1). */
export function expectFreshData(item: LevelItem<FondasiScenario>): void {
  for (const scenario of scenarios) {
    const a = item.generate(101, scenario);
    const b = item.generate(102, scenario);
    expect(a.cells.Data, scenario.id).not.toEqual(b.cells.Data);
    expect(a.questions.map((q) => q.key), scenario.id).not.toEqual(b.questions.map((q) => q.key));
    expect(item.generate(101, scenario)).toEqual(a);
  }
}

/** The batches of an L01 Data sheet (A2:G{last}), read back from the generated cells. */
export function batchesOf(exam: GeneratedExam) {
  const data = exam.cells.Data;
  const rows = [];
  for (let r = 2; data[`A${r}`] !== undefined; r++) {
    rows.push({
      code: data[`A${r}`] as string,
      line: data[`B${r}`] as string,
      shift: data[`C${r}`] as string,
      product: data[`D${r}`] as string,
      units: data[`E${r}`] as number,
      defects: data[`F${r}`] as number,
      cost: data[`G${r}`] as number,
    });
  }
  return rows;
}
