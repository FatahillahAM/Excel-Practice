import { z } from "zod";
import { MAX_QUESTIONS, TOTAL_POINTS, scenarioSchema } from "../content/level-module";

/**
 * The stored `Result` of a graded attempt (AD-3): `attempts.result`, written
 * once by the grading path and read by Results (and later History and the Tips
 * collection), which render from it and never re-read content. It holds
 * points, Indonesian reasons and Tips, never the answer key or expected values.
 *
 * Validated with `resultSchema` before it is written and whenever it is read.
 */

/** Points one revealed hint costs (AD-3). */
export const HINT_PENALTY_POINTS = 5;

/** The `Result` shape version: later entries (more checkers, Tips) bump it so old Results stay readable. */
export const RESULT_VERSION = 1;

/** A Tip as Results shows it (CAP-8): content Tips (entry 4) reuse this schema. */
export const tipSchema = z
  .object({
    id: z.string().trim().min(1).max(64),
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(2000),
    /** Keyboard shortcuts, in Excel's own key names (`Ctrl`, `F4`). */
    shortcuts: z.array(z.string().trim().min(1).max(40)).max(10),
  })
  .strict();

export type Tip = z.infer<typeof tipSchema>;

export const questionResultSchema = z
  .object({
    number: z.number().int().min(1).max(MAX_QUESTIONS),
    points: z.number().int().positive(),
    pointsAwarded: z.number().int().min(0),
    correct: z.boolean(),
    /** Why the answer is wrong, in Indonesian (`src/core/grading/reasons.ts`); `null` when correct. */
    reasonText: z.string().trim().min(1).max(500).nullable(),
    /** The question's Tip; `null` until content has Tips (entry 4). */
    tip: tipSchema.nullable(),
  })
  .strict()
  .superRefine((question, ctx) => {
    if (question.correct) {
      if (question.pointsAwarded !== question.points) {
        ctx.addIssue({ code: "custom", path: ["pointsAwarded"], message: "A correct question earns its points" });
      }
      if (question.reasonText !== null) {
        ctx.addIssue({ code: "custom", path: ["reasonText"], message: "A correct question has no reason" });
      }
    } else {
      if (question.pointsAwarded !== 0) {
        ctx.addIssue({ code: "custom", path: ["pointsAwarded"], message: "A wrong question earns 0 points" });
      }
      if (question.reasonText === null) {
        ctx.addIssue({ code: "custom", path: ["reasonText"], message: "A wrong question has a reason" });
      }
    }
  });

export type QuestionResult = z.infer<typeof questionResultSchema>;

export const resultSchema = z
  .object({
    version: z.literal(RESULT_VERSION),
    contentVersion: z.number().int().positive(),
    scenarioId: scenarioSchema.shape.id,
    hintsUsed: z.number().int().min(0),
    hintPenalty: z.number().int().min(0),
    pointsEarned: z.number().int().min(0).max(TOTAL_POINTS),
    score: z.number().int().min(0).max(TOTAL_POINTS),
    correctCount: z.number().int().min(0),
    questionCount: z.number().int().min(1).max(MAX_QUESTIONS),
    questions: z.array(questionResultSchema).min(1).max(MAX_QUESTIONS),
  })
  .strict()
  .superRefine((result, ctx) => {
    result.questions.forEach((question, index) => {
      if (question.number !== index + 1) {
        ctx.addIssue({ code: "custom", path: ["questions", index, "number"], message: `Question ${index + 1} must be number ${index + 1}` });
      }
    });
    const total = result.questions.reduce((sum, question) => sum + question.points, 0);
    if (total !== TOTAL_POINTS) {
      ctx.addIssue({ code: "custom", path: ["questions"], message: `Points sum to ${total}, not ${TOTAL_POINTS}` });
    }
    if (result.questionCount !== result.questions.length) {
      ctx.addIssue({ code: "custom", path: ["questionCount"], message: "questionCount is the number of questions" });
    }
    const correct = result.questions.filter((question) => question.correct).length;
    if (result.correctCount !== correct) {
      ctx.addIssue({ code: "custom", path: ["correctCount"], message: `${correct} questions are correct` });
    }
    const earned = result.questions.reduce((sum, question) => sum + question.pointsAwarded, 0);
    if (result.pointsEarned !== earned) {
      ctx.addIssue({ code: "custom", path: ["pointsEarned"], message: `The questions award ${earned} points` });
    }
    if (result.hintPenalty !== HINT_PENALTY_POINTS * result.hintsUsed) {
      ctx.addIssue({ code: "custom", path: ["hintPenalty"], message: `hintPenalty is ${HINT_PENALTY_POINTS} × hintsUsed` });
    }
    if (result.score !== scoreOf(result.pointsEarned, result.hintsUsed)) {
      ctx.addIssue({ code: "custom", path: ["score"], message: "score is max(0, pointsEarned − hintPenalty)" });
    }
  });

export type Result = z.infer<typeof resultSchema>;

/** Score = points earned − 5 × hints used, floor 0 (AD-3). */
export function scoreOf(pointsEarned: number, hintsUsed: number): number {
  return Math.max(0, pointsEarned - HINT_PENALTY_POINTS * hintsUsed);
}
