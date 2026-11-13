import { describe, expect, it } from "vitest";
import { SNAPSHOT } from "../../grading/__fixtures__/exam";
import { hintState, hintsLeft, nextHintIndex, questionExhausted, type HintState } from "./hints";

const snapshot = {
  ...SNAPSHOT,
  questions: SNAPSHOT.questions.map((q) => (q.number === 2 ? { ...q, hints: ["Dua-1.", "Dua-2.", "Dua-3."] } : q)),
};

describe("hintState", () => {
  it("takes the quota and soal from the snapshot, and texts in the rows' (reveal) order", () => {
    const state = hintState(snapshot, [
      { question_number: 2, hint_index: 0 },
      { question_number: 1, hint_index: 0 },
      { question_number: 2, hint_index: 1 },
    ]);
    expect(state).toEqual({
      quota: 3,
      used: 3,
      questions: [
        { number: 1, hintCount: 1 },
        { number: 2, hintCount: 3 },
        { number: 3, hintCount: 1 },
        { number: 4, hintCount: 1 },
      ],
      revealed: [
        { question: 2, index: 0, text: "Dua-1." },
        { question: 1, index: 0, text: "Kalikan dua kolom." },
        { question: 2, index: 1, text: "Dua-2." },
      ],
    });
  });

  it("drops rows the snapshot has no hint for from the list, but still counts them as used", () => {
    const state = hintState(snapshot, [
      { question_number: 9, hint_index: 0 },
      { question_number: 1, hint_index: 5 },
    ]);
    expect(state.revealed).toEqual([]);
    expect(state.used).toBe(2);
    expect(hintsLeft(state)).toBe(1);
  });

  it("starts empty without rows", () => {
    const state = hintState(snapshot, []);
    expect(state).toMatchObject({ quota: 3, used: 0, revealed: [] });
  });
});

describe("nextHintIndex / hintsLeft / questionExhausted", () => {
  const state: HintState = hintState(snapshot, [
    { question_number: 2, hint_index: 0 },
    { question_number: 1, hint_index: 0 },
  ]);

  it("is the count of the soal's revealed hints", () => {
    expect(nextHintIndex(state, 2)).toBe(1);
    expect(nextHintIndex(state, 1)).toBe(1);
    expect(nextHintIndex(state, 3)).toBe(0);
  });

  it("hintsLeft is quota − used, never below 0", () => {
    expect(hintsLeft(state)).toBe(1);
    expect(hintsLeft({ ...state, used: 5 })).toBe(0);
  });

  it("a soal is exhausted once all its hints are shown, or when it is not in the attempt", () => {
    expect(questionExhausted(state, 1)).toBe(true);
    expect(questionExhausted(state, 2)).toBe(false);
    expect(questionExhausted(state, 3)).toBe(false);
    expect(questionExhausted(state, 7)).toBe(true);
  });
});
