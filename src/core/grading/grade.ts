import { expandRange } from "../content/a1";
import type { ExamQuestion, ExamSnapshot } from "../content/level-module";
import { runCheck, type AnswerCell } from "./checkers";
import { reasonText } from "./reasons";
import { HINT_PENALTY_POINTS, RESULT_VERSION, resultSchema, scoreOf, type QuestionResult, type Result, type Tip } from "./result";
import type { WorkbookReading } from "./workbook-reading";

/**
 * `grade(snapshot, reading, hintsUsed) → Result` (AD-3): pure and
 * deterministic, it reads only its arguments (no clock, random or IO, and
 * never the level content). Per question, the declared checks run in order
 * on the answer cells; the first failing check, at its first failing cell,
 * gives the reason. A correct question earns its points; score = Σ points of
 * correct questions − 5 × `hintsUsed`, floor 0. Throws on a malformed
 * snapshot or `hintsUsed`; the output always passes `resultSchema`.
 */
export function grade(snapshot: ExamSnapshot, reading: WorkbookReading, hintsUsed: number): Result {
  if (!Number.isInteger(hintsUsed) || hintsUsed < 0) throw new Error(`hintsUsed must be a whole number ≥ 0, not ${hintsUsed}`);

  const questions = snapshot.questions.map((question) => gradeQuestion(question, reading));
  const pointsEarned = questions.reduce((sum, question) => sum + question.pointsAwarded, 0);
  const result: Result = {
    version: RESULT_VERSION,
    contentVersion: snapshot.contentVersion,
    scenarioId: snapshot.scenarioId,
    hintsUsed,
    hintPenalty: HINT_PENALTY_POINTS * hintsUsed,
    pointsEarned,
    score: scoreOf(pointsEarned, hintsUsed),
    correctCount: questions.filter((question) => question.correct).length,
    questionCount: questions.length,
    questions,
  };
  return resultSchema.parse(result);
}

function gradeQuestion(question: ExamQuestion, reading: WorkbookReading): QuestionResult {
  const refs = expandRange(question.range);
  if (refs === null) throw new Error(`Question ${question.number}: malformed answer range ${question.range}`);
  const sheet = Object.hasOwn(reading.sheets, question.sheet) ? reading.sheets[question.sheet] : {};
  const cells: AnswerCell[] = refs.map((ref) => ({ ref, reading: Object.hasOwn(sheet, ref) ? sheet[ref] : undefined }));

  let reason: string | null = null;
  for (const check of question.checks) {
    const outcome = runCheck(check, question, cells);
    if (!outcome.ok) {
      reason = reasonText(outcome.reason);
      break;
    }
  }
  const correct = reason === null;
  return {
    number: question.number,
    points: question.points,
    pointsAwarded: correct ? question.points : 0,
    correct,
    reasonText: reason,
    tip: tipOf(question),
  };
}

/** The question's Tip when its content has one (entry 4 adds `tip` to the question schema), else `null`. */
function tipOf(question: ExamQuestion): Tip | null {
  return (question as ExamQuestion & { tip?: Tip | null }).tip ?? null;
}
