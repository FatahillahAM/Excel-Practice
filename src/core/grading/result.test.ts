import { describe, expect, it } from "vitest";
import { questionResultSchema, resultSchema, scoreOf, tipSchema, type Result } from "./result";

const RESULT: Result = {
  version: 2,
  contentVersion: 1,
  scenarioId: "baut-sinar-presisi",
  hintsUsed: 1,
  hintPenalty: 5,
  pointsEarned: 75,
  score: 70,
  correctCount: 3,
  questionCount: 4,
  questions: [
    { number: 1, points: 20, pointsAwarded: 20, correct: true, reasonText: null, tip: null },
    { number: 2, points: 25, pointsAwarded: 0, correct: false, reasonText: "Sel I3 masih kosong.", tip: null },
    { number: 3, points: 25, pointsAwarded: 25, correct: true, reasonText: null, tip: null },
    { number: 4, points: 30, pointsAwarded: 30, correct: true, reasonText: null, tip: null },
  ],
};

const with_ = (patch: Partial<Result>) => ({ ...RESULT, ...patch });

describe("resultSchema", () => {
  it("accepts a consistent Result", () => {
    expect(resultSchema.parse(RESULT)).toEqual(RESULT);
  });

  it("refuses unknown fields (strict), here and per question", () => {
    expect(resultSchema.safeParse({ ...RESULT, key: { H2: 1 } }).success).toBe(false);
    const questions = RESULT.questions.map((q, i) => (i === 0 ? { ...q, expected: 1 } : q));
    expect(resultSchema.safeParse(with_({ questions })).success).toBe(false);
  });

  it("refuses a score other than max(0, pointsEarned − hintPenalty)", () => {
    expect(resultSchema.safeParse(with_({ score: 75 })).success).toBe(false);
    expect(resultSchema.safeParse(with_({ hintPenalty: 0 })).success).toBe(false);
  });

  it("refuses counts or points that do not match the questions", () => {
    expect(resultSchema.safeParse(with_({ correctCount: 4 })).success).toBe(false);
    expect(resultSchema.safeParse(with_({ questionCount: 3 })).success).toBe(false);
    expect(resultSchema.safeParse(with_({ pointsEarned: 80, score: 75 })).success).toBe(false);
  });

  it("refuses questions out of order or whose points do not sum to 100", () => {
    const swapped = [RESULT.questions[1], RESULT.questions[0], ...RESULT.questions.slice(2)];
    expect(resultSchema.safeParse(with_({ questions: swapped })).success).toBe(false);
    const short = RESULT.questions.map((q, i) => (i === 3 ? { ...q, points: 20, pointsAwarded: 20 } : q));
    expect(resultSchema.safeParse(with_({ questions: short, pointsEarned: 65, score: 60 })).success).toBe(false);
  });

  it("reads version 1 (entry 1 Results, stored in Production) and 2 with the same shape; refuses any other", () => {
    expect(resultSchema.parse(with_({ version: 1 }))).toEqual({ ...RESULT, version: 1 });
    for (const version of [0, 3, "2"]) {
      expect(resultSchema.safeParse(with_({ version: version as 2 })).success).toBe(false);
    }
  });

  it("parses a stored entry-1 Result as written in Production (attempt 7ee570ef shape)", () => {
    const stored = {
      version: 1,
      contentVersion: 1,
      scenarioId: "baut-sinar-presisi",
      hintsUsed: 0,
      hintPenalty: 0,
      pointsEarned: 80,
      score: 80,
      correctCount: 3,
      questionCount: 4,
      questions: [
        { number: 1, points: 20, pointsAwarded: 0, correct: false, reasonText: "Sel H2 berisi nilai yang diketik, bukan rumus.", tip: null },
        { number: 2, points: 25, pointsAwarded: 25, correct: true, reasonText: null, tip: null },
        { number: 3, points: 25, pointsAwarded: 25, correct: true, reasonText: null, tip: null },
        { number: 4, points: 30, pointsAwarded: 30, correct: true, reasonText: null, tip: null },
      ],
    };
    expect(resultSchema.safeParse(JSON.parse(JSON.stringify(stored))).success).toBe(true);
  });
});

describe("questionResultSchema", () => {
  it("needs a reason exactly when wrong, and full points exactly when correct", () => {
    const base = { number: 1, points: 20, tip: null };
    expect(questionResultSchema.safeParse({ ...base, correct: true, pointsAwarded: 20, reasonText: null }).success).toBe(true);
    expect(questionResultSchema.safeParse({ ...base, correct: true, pointsAwarded: 20, reasonText: "x" }).success).toBe(false);
    expect(questionResultSchema.safeParse({ ...base, correct: true, pointsAwarded: 10, reasonText: null }).success).toBe(false);
    expect(questionResultSchema.safeParse({ ...base, correct: false, pointsAwarded: 0, reasonText: null }).success).toBe(false);
    expect(questionResultSchema.safeParse({ ...base, correct: false, pointsAwarded: 20, reasonText: "x" }).success).toBe(false);
  });
});

describe("tipSchema", () => {
  it("is id, title, body and shortcuts", () => {
    expect(tipSchema.safeParse({ id: "f4", title: "F4", body: "Tekan F4.", shortcuts: ["F4"] }).success).toBe(true);
    expect(tipSchema.safeParse({ id: "f4", title: "F4", body: "Tekan F4." }).success).toBe(false);
  });
});

describe("scoreOf", () => {
  it("is points − 5 × hints, floor 0", () => {
    expect(scoreOf(100, 0)).toBe(100);
    expect(scoreOf(75, 3)).toBe(60);
    expect(scoreOf(10, 3)).toBe(0);
  });
});
