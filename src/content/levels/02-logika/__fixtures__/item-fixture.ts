import { formulaCell, sharedFill, writeFormulaCells, type FixtureCell, type FixtureValue } from "@/adapters/workbook/__fixtures__/formula-cells";
import { generateExamWorkbook } from "@/adapters/workbook/generate";
import {
  DATA_SHEET,
  SNAPSHOT_VERSION,
  examSnapshotSchema,
  generatedExamSchema,
  type ExamSnapshot,
  type GeneratedExam,
  type LevelItem,
  type Tip,
} from "@/core/content/level-module";
import { RESULT_VERSION, type Result } from "@/core/grading";
import { logika } from "..";
import type { LogikaScenario } from "../scenarios";

/**
 * Test only: what the golden fixtures of every L02 item share (the pattern of
 * L01's `item-fixture.ts`): one exam per item (seed 7, scenario
 * `kemasan-karton-prima`, a fixed token that belongs to no attempt) generated
 * live from template v1 as Start does, answer cells written as Excel saves them.
 */

export const FIXTURE_SEED = 7;
export const FIXTURE_SCENARIO_ID = "kemasan-karton-prima";
export const FIXTURE_SERVER_URL = "https://example.invalid";

export type Cells = Record<string, FixtureCell>;

/** What a variant grades to: score, correct count and, per question, `correct` and the exact reason. */
export interface ExpectedGrade {
  score: number;
  correctCount: number;
  questions: { correct: boolean; reasonText: string | null }[];
}

export const RIGHT = { correct: true, reasonText: null };
export const wrong = (reasonText: string) => ({ correct: false, reasonText });

export interface ItemFixture {
  readonly token: string;
  /** The attempt's snapshot as Start writes it (`start-actions.ts`), schema-validated. */
  snapshot(): ExamSnapshot;
  /** The exam's generated cells (Instructions and Data) as Start patches them into the template. */
  cells(): GeneratedExam["cells"];
  /** The key of question `number` (1-based). */
  keyOf(number: number): Record<string, number | string>;
  /** `formula` (for the range's top-left cell) filled over question `number` as Excel saves a fill, cached values from the key. */
  filled(number: number, si: number, formula: string, values?: Record<string, FixtureValue>): Cells;
  /** One formula in question `number`'s single answer cell, cached value from the key. */
  single(number: number, formula: string, value?: FixtureValue): Cells;
  /** Template v1 generated as Start does, `answers` written on Data. */
  build(answers: Cells): Promise<Uint8Array>;
  /** The full `Result` an `ExpectedGrade` stands for, with no hints; Tips from the content constants `tips`, in order. */
  resultOf(expected: ExpectedGrade, tips: readonly Tip[]): Result;
}

export function itemFixture(item: LevelItem<LogikaScenario>, token: string): ItemFixture {
  const generated = (): { exam: GeneratedExam; snapshot: ExamSnapshot } => {
    const scenario = logika.scenarios.find((candidate) => candidate.id === FIXTURE_SCENARIO_ID);
    if (scenario === undefined) throw new Error(`Scenario ${FIXTURE_SCENARIO_ID} is gone`);
    const exam = generatedExamSchema.parse(item.generate(FIXTURE_SEED, scenario));
    const snapshot = examSnapshotSchema.parse({
      version: SNAPSHOT_VERSION,
      contentVersion: logika.contentVersion,
      scenarioId: scenario.id,
      seed: FIXTURE_SEED,
      hintQuota: logika.hintQuota,
      questions: exam.questions,
    } satisfies ExamSnapshot);
    return { exam, snapshot };
  };
  const keyOf = (number: number) => generated().snapshot.questions[number - 1].key as Record<string, number | string>;
  const rangeOf = (number: number) => generated().snapshot.questions[number - 1].range;

  return {
    token,
    snapshot: () => generated().snapshot,
    cells: () => generated().exam.cells,
    keyOf,
    filled(number, si, formula, values = keyOf(number)) {
      return sharedFill(rangeOf(number), si, formula, (ref) => values[ref]);
    },
    single(number, formula, value) {
      const range = rangeOf(number);
      if (range.includes(":")) throw new Error(`single: question ${number} has range ${range}`);
      return { [range]: formulaCell(formula, value === undefined ? keyOf(number)[range] : value) };
    },
    async build(answers) {
      const { exam } = generated();
      const { bytes } = await generateExamWorkbook({ token, serverUrl: FIXTURE_SERVER_URL, cells: exam.cells });
      return Object.keys(answers).length > 0 ? writeFormulaCells(bytes, DATA_SHEET, answers) : bytes;
    },
    resultOf(expected, tips) {
      const snapshot = generated().snapshot;
      const pointsEarned = snapshot.questions.reduce((sum, q, i) => sum + (expected.questions[i].correct ? q.points : 0), 0);
      return {
        version: RESULT_VERSION,
        contentVersion: snapshot.contentVersion,
        scenarioId: snapshot.scenarioId,
        hintsUsed: 0,
        hintPenalty: 0,
        pointsEarned,
        score: expected.score,
        correctCount: expected.correctCount,
        questionCount: snapshot.questions.length,
        questions: snapshot.questions.map((q, i) => ({
          number: q.number,
          points: q.points,
          pointsAwarded: expected.questions[i].correct ? q.points : 0,
          correct: expected.questions[i].correct,
          reasonText: expected.questions[i].reasonText,
          tip: { ...tips[i], shortcuts: [...tips[i].shortcuts] },
        })),
      };
    },
  };
}

/** `"L02-P2 golden fixture token 0001"` (32 bytes) in base64url: a `WHE_AttemptToken` no attempt has. */
export function fixtureToken(text: string): string {
  if (new TextEncoder().encode(text).length !== 32) throw new Error(`fixtureToken: "${text}" is not 32 bytes`);
  return Buffer.from(text, "utf8").toString("base64url");
}
