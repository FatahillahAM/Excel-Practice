import { describe, expect, it } from "vitest";
import { SNAPSHOT, correctCells, formula, readingOf, typed } from "./__fixtures__/exam";
import { grade } from "./grade";
import { resultSchema } from "./result";

describe("grade(snapshot, reading, hintsUsed)", () => {
  it("all correct: 100, 4 of 4, no reasons, no Tips yet", () => {
    const result = grade(SNAPSHOT, readingOf(correctCells()), 0);
    expect(result).toEqual({
      version: 1,
      contentVersion: 1,
      scenarioId: "baut-sinar-presisi",
      hintsUsed: 0,
      hintPenalty: 0,
      pointsEarned: 100,
      score: 100,
      correctCount: 4,
      questionCount: 4,
      questions: [
        { number: 1, points: 20, pointsAwarded: 20, correct: true, reasonText: null, tip: null },
        { number: 2, points: 25, pointsAwarded: 25, correct: true, reasonText: null, tip: null },
        { number: 3, points: 25, pointsAwarded: 25, correct: true, reasonText: null, tip: null },
        { number: 4, points: 30, pointsAwarded: 30, correct: true, reasonText: null, tip: null },
      ],
    });
    expect(resultSchema.safeParse(result).success).toBe(true);
  });

  it("typed numbers in one range: that question is wrong with the formula_present reason, 0 points", () => {
    const cells = correctCells();
    cells.I3 = typed(750);
    const result = grade(SNAPSHOT, readingOf(cells), 0);
    expect(result.questions[1]).toEqual({
      number: 2,
      points: 25,
      pointsAwarded: 0,
      correct: false,
      reasonText: "Sel I3 berisi nilai yang diketik, bukan rumus.",
      tip: null,
    });
    expect(result).toMatchObject({ score: 75, pointsEarned: 75, correctCount: 3 });
  });

  it("a wrong value: value_equals_key reason, without the key", () => {
    const cells = correctCells();
    cells.H3 = formula("=E3*G3", 12000);
    const result = grade(SNAPSHOT, readingOf(cells), 0);
    expect(result.questions[0].reasonText).toBe("Hasil di H3 belum sesuai.");
    expect(result.questions[0].reasonText).not.toContain("12665");
    expect(result.score).toBe(80);
  });

  it("an empty cell (missing, or a formula-less empty cell) says the cell is empty", () => {
    const missing = correctCells();
    delete missing.J2;
    expect(grade(SNAPSHOT, readingOf(missing), 0).questions[2].reasonText).toBe("Sel J2 masih kosong.");
    const blank = correctCells();
    blank.J3 = { formula: null, value: null, type: "empty" };
    expect(grade(SNAPSHOT, readingOf(blank), 0).questions[2].reasonText).toBe("Sel J3 masih kosong.");
  });

  it("a formula Excel has not calculated (null) is wrong", () => {
    const cells = correctCells();
    cells.O2 = formula("=$N2*(1+O$1)", null);
    const result = grade(SNAPSHOT, readingOf(cells), 0);
    expect(result.questions[3]).toMatchObject({ correct: false, reasonText: "Hasil di O2 belum sesuai." });
  });

  it("the first failing check, at its first failing cell, gives the reason", () => {
    const cells = correctCells();
    cells.H2 = formula("=1", 1); // wrong value, first cell
    cells.H3 = typed(12665.27); // typed, second cell
    // formula_present runs first and fails on H3; value_equals_key would fail on H2.
    expect(grade(SNAPSHOT, readingOf(cells), 0).questions[0].reasonText).toBe(
      "Sel H3 berisi nilai yang diketik, bukan rumus.",
    );
  });

  it("compares numbers within the relative tolerance, text exactly, and refuses a type mismatch", () => {
    const near = correctCells();
    near.H3 = formula("=E3*G3", 12178.14 * 1.04 * (1 + 5e-10));
    expect(grade(SNAPSHOT, readingOf(near), 0).questions[0].correct).toBe(true);
    const far = correctCells();
    far.H3 = formula("=E3*G3", 12178.14 * 1.04 * (1 + 1e-6));
    expect(grade(SNAPSHOT, readingOf(far), 0).questions[0].correct).toBe(false);
    // A key of 0 compares within the tolerance of 1.
    const zero = correctCells();
    zero.P3 = formula("=0", 1e-12);
    expect(grade(SNAPSHOT, readingOf(zero), 0).questions[3].correct).toBe(true);
    for (const wrong of [formula('="lini a"', "lini a"), formula("=1", 1), formula("=TRUE", true), { formula: "=1/0", value: "#DIV/0!", type: "error" as const }]) {
      const cells = correctCells();
      cells.O3 = wrong;
      expect(grade(SNAPSHOT, readingOf(cells), 0).questions[3].correct).toBe(false);
    }
    const text = correctCells();
    text.I2 = formula('="500"', "500");
    expect(grade(SNAPSHOT, readingOf(text), 0).questions[1].correct).toBe(false);
  });

  it("skips checks without a checker (not_hard_coded, uses_functions, uses_reference)", () => {
    const cells = correctCells();
    cells.J2 = formula("=0.4", 0.4); // a hard-coded formula that would fail not_hard_coded / uses_functions later
    expect(grade(SNAPSHOT, readingOf(cells), 0).questions[2].correct).toBe(true);
  });

  it("answers on another sheet do not count; a missing answer sheet is all empty", () => {
    const result = grade(SNAPSHOT, readingOf({}, { Sheet3: correctCells() }), 0);
    expect(result).toMatchObject({ score: 0, correctCount: 0 });
    expect(result.questions[0].reasonText).toBe("Sel H2 masih kosong.");
    const none = grade(SNAPSHOT, { sheets: {}, properties: {}, vbaModuleHashes: null }, 0);
    expect(none.score).toBe(0);
  });

  it("subtracts 5 per hint, never below 0", () => {
    expect(grade(SNAPSHOT, readingOf(correctCells()), 2)).toMatchObject({ hintsUsed: 2, hintPenalty: 10, pointsEarned: 100, score: 90 });
    expect(grade(SNAPSHOT, readingOf({}), 3)).toMatchObject({ pointsEarned: 0, hintPenalty: 15, score: 0 });
  });

  it("refuses a hintsUsed that is not a whole number ≥ 0", () => {
    for (const bad of [-1, 1.5, Number.NaN]) expect(() => grade(SNAPSHOT, readingOf(correctCells()), bad)).toThrow();
  });

  it("copies a question's Tip when its content has one", () => {
    const tip = { id: "f4", title: "Kunci sel dengan F4", body: "Tekan F4.", shortcuts: ["F4"] };
    const withTip = { ...SNAPSHOT, questions: SNAPSHOT.questions.map((q, i) => (i === 0 ? { ...q, tip } : q)) };
    expect(grade(withTip, readingOf(correctCells()), 0).questions[0].tip).toEqual(tip);
  });

  it("is deterministic: the same inputs give the same Result", () => {
    const cells = correctCells();
    cells.I3 = typed(750);
    expect(grade(SNAPSHOT, readingOf(cells), 1)).toEqual(grade(SNAPSHOT, readingOf(cells), 1));
  });

  it("throws on a malformed answer range", () => {
    const broken = { ...SNAPSHOT, questions: SNAPSHOT.questions.map((q, i) => (i === 0 ? { ...q, range: "H3:H2" } : q)) };
    expect(() => grade(broken, readingOf(correctCells()), 0)).toThrow(/malformed answer range/);
  });
});
