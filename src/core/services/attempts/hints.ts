import type { ExamSnapshot } from "../../content/level-module";

/**
 * Hint state of an attempt (CAP-7, AD-5): what the exam screen shows — the
 * quota, the soal a hint can be asked for, and the hints already revealed —
 * built from the snapshot (texts and quota, AD-3) and the attempt's
 * `hint_reveals` rows. Pure: the adapter reads, this assembles.
 */

/** One revealed hint: soal number, 0-based index in that soal's hints (the UI shows it + 1), and its text. */
export interface HintReveal {
  question: number;
  index: number;
  text: string;
}

export interface HintState {
  /** `snapshot.hintQuota`: hints per attempt, over all soal. */
  quota: number;
  /** Hints revealed so far (every stored row counts against the quota). */
  used: number;
  /** The soal of this attempt, in order, with how many hints each has. */
  questions: { number: number; hintCount: number }[];
  /** Revealed hints, in reveal order. */
  revealed: HintReveal[];
}

/** One `hint_reveals` row as the adapter reads it. */
export interface HintRevealRow {
  question_number: number;
  hint_index: number;
}

/**
 * The state from the snapshot and the rows (in the order given: reveal
 * order). A row whose soal or index the snapshot does not have is dropped
 * from `revealed`, but still counted in `used`, as the database counts it.
 */
export function hintState(snapshot: ExamSnapshot, rows: readonly HintRevealRow[]): HintState {
  const byNumber = new Map(snapshot.questions.map((question) => [question.number, question]));
  const revealed: HintReveal[] = [];
  for (const row of rows) {
    const text = byNumber.get(row.question_number)?.hints[row.hint_index];
    if (typeof text === "string") revealed.push({ question: row.question_number, index: row.hint_index, text });
  }
  return {
    quota: snapshot.hintQuota,
    used: rows.length,
    questions: snapshot.questions.map((question) => ({ number: question.number, hintCount: question.hints.length })),
    revealed,
  };
}

/** The next hint index for `question`: how many of its hints are revealed (hints open in order). */
export function nextHintIndex(state: HintState, question: number): number {
  return state.revealed.filter((reveal) => reveal.question === question).length;
}

/** Hints left in the attempt's quota, never below 0. */
export function hintsLeft(state: HintState): number {
  return Math.max(0, state.quota - state.used);
}

/** Whether every hint of `question` is revealed (or it has none, or is not in the attempt). */
export function questionExhausted(state: HintState, question: number): boolean {
  const entry = state.questions.find((q) => q.number === question);
  return entry === undefined || nextHintIndex(state, question) >= entry.hintCount;
}
