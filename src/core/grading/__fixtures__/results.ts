import { HINT_PENALTY_POINTS, scoreOf, type Result, type Tip } from "../result";

/**
 * Valid stored `Result`s for the Results screen, one per variant it renders
 * (the DOM test asserts each passes `resultSchema`). Four questions, shaped
 * like L01-P1; a Test fixture differs only in the item the screen is given.
 */

export const RESULT_TIPS: readonly Tip[] = [
  { id: "l01-isi-rumus-sekaligus", title: "Isi rumus ke bawah sekaligus", body: "Blok sel dari rumus paling atas sampai baris terakhir data, lalu tekan Ctrl+D.", shortcuts: ["Ctrl+D"] },
  { id: "l01-kunci-sel-f4", title: "Kunci sel dengan F4", body: "Taruh kursor di referensi sel lalu tekan F4: A1 menjadi $A$1.", shortcuts: ["F4"] },
  { id: "l01-format-persen", title: "Tampilkan porsi sebagai persen", body: "Blok selnya lalu tekan Ctrl+Shift+%: hanya tampilannya yang berubah.", shortcuts: ["Ctrl+Shift+%"] },
  { id: "l01-referensi-campuran", title: "Referensi campuran", body: "Kunci kolomnya saja ($N2) supaya rumus bisa disalin ke kanan.", shortcuts: ["F4", "Ctrl+R"] },
];

export const WRONG_REASONS: readonly string[] = [
  "Sel H3 masih kosong.",
  "Sel I3 berisi nilai yang diketik, bukan rumus.",
  "Rumus di sel J2 belum memakai fungsi SUM.",
  "Rumus di sel O2 belum mengunci kolom N ($N2).",
];

export interface ResultSpec {
  version?: Result["version"];
  /** Points per question; must sum to 100. */
  points?: readonly number[];
  /** Question numbers answered wrong. */
  wrong?: readonly number[];
  hintsUsed?: number;
  /** Question numbers that carry a Tip; `"all"` (default) or `"none"`. */
  tips?: "all" | "none" | readonly number[];
}

export function buildResult({ version = 2, points = [20, 25, 25, 30], wrong = [], hintsUsed = 0, tips = "all" }: ResultSpec = {}): Result {
  const questions = points.map((value, index) => {
    const number = index + 1;
    const correct = !wrong.includes(number);
    const hasTip = tips === "all" || (tips !== "none" && tips.includes(number));
    return {
      number,
      points: value,
      pointsAwarded: correct ? value : 0,
      correct,
      reasonText: correct ? null : WRONG_REASONS[index % WRONG_REASONS.length],
      tip: hasTip ? RESULT_TIPS[index % RESULT_TIPS.length] : null,
    };
  });
  const pointsEarned = questions.reduce((sum, question) => sum + question.pointsAwarded, 0);
  return {
    version,
    contentVersion: 1,
    scenarioId: "baut-sinar-presisi",
    hintsUsed,
    hintPenalty: HINT_PENALTY_POINTS * hintsUsed,
    pointsEarned,
    score: scoreOf(pointsEarned, hintsUsed),
    correctCount: questions.filter((question) => question.correct).length,
    questionCount: questions.length,
    questions,
  };
}

/** Practice, 85: all four correct, 3 hints (−15), a Tip per question. */
export const PRACTICE_85 = buildResult({ hintsUsed: 3 });
/** Practice, 64: Soal 2 and 3 wrong, no hints. */
export const PRACTICE_64 = buildResult({ points: [34, 20, 16, 30], wrong: [2, 3] });
/** Exactly 80: the lowest score of the ≥ 80 variant. */
export const SCORE_80 = buildResult({ wrong: [1] });
/** 79: the highest calm score. */
export const SCORE_79 = buildResult({ points: [21, 25, 24, 30], wrong: [1] });
/** A Test Result, 88 (shown with a `kind: "test"` item). */
export const TEST_88 = buildResult({ points: [12, 28, 30, 30], wrong: [1] });
/** A Test Result, 72. */
export const TEST_72 = buildResult({ points: [12, 28, 30, 30], wrong: [2] });
/** A version 1 Result from before Tips were stored: every `tip` is `null`. */
export const V1_NO_TIPS = buildResult({ version: 1, wrong: [2], tips: "none" });
/** Tips on Soal 1 and 3 only; Soal 2 (no Tip) and Soal 3 (Tip) are wrong. */
export const PARTIAL_TIPS = buildResult({ wrong: [2, 3], tips: [1, 3] });

export const RESULT_FIXTURES = {
  PRACTICE_85,
  PRACTICE_64,
  SCORE_80,
  SCORE_79,
  TEST_88,
  TEST_72,
  V1_NO_TIPS,
  PARTIAL_TIPS,
} as const;
