import { describe, expect, it } from "vitest";
import { FLOORED_0, buildResult } from "@/core/grading/__fixtures__/results";
import { deductionParts, deductionText, levelLabel, resultsOutcome, shortcutKeys } from "./outcome";

const practice = { kind: "practice", number: 1 } as const;
const test = { kind: "test", number: 1 } as const;
const at = (score: number) => ({ score });

describe("resultsOutcome", () => {
  it("is pass from 80 and calm below", () => {
    expect(resultsOutcome({ item: practice, itemId: "L01-P1", result: at(80) }).variant).toBe("pass");
    expect(resultsOutcome({ item: practice, itemId: "L01-P1", result: at(79) }).variant).toBe("calm");
    expect(resultsOutcome({ item: test, itemId: "L01-T", result: at(80) }).variant).toBe("pass");
    expect(resultsOutcome({ item: test, itemId: "L01-T", result: at(79) }).variant).toBe("calm");
    expect(resultsOutcome({ item: null, itemId: "L09-P9", result: at(100) }).variant).toBe("pass");
    expect(resultsOutcome({ item: null, itemId: "L09-P9", result: at(0) }).variant).toBe("calm");
  });

  it("names a practice by its number with the score", () => {
    expect(resultsOutcome({ item: practice, itemId: "L01-P1", result: at(85) }).heading).toBe("Practice 1 — 85/100");
    expect(resultsOutcome({ item: { kind: "practice", number: 5 }, itemId: "L01-P5", result: at(64) }).heading).toBe("Practice 5 — 64/100");
  });

  it("says whether a Test passed, and what it needs when it did not", () => {
    expect(resultsOutcome({ item: test, itemId: "L01-T", result: at(88) }).heading).toBe("Test passed — 88/100");
    expect(resultsOutcome({ item: test, itemId: "L01-T", result: at(80) }).heading).toBe("Test passed — 80/100");
    expect(resultsOutcome({ item: test, itemId: "L01-T", result: at(72) }).heading).toBe("Test not passed — 72/100, needs 80");
    expect(resultsOutcome({ item: test, itemId: "L01-T", result: at(79) }).heading).toBe("Test not passed — 79/100, needs 80");
  });

  it("falls back to the item id for a kind that is neither a practice nor a Test", () => {
    const final = { kind: "final", number: 1 } as unknown as { kind: "test"; number: number };
    expect(resultsOutcome({ item: final, itemId: "UA", result: at(90) })).toEqual({ variant: "pass", heading: "UA — 90/100" });
    expect(resultsOutcome({ item: final, itemId: "UA", result: at(50) }).heading).toBe("UA — 50/100");
  });

  it("falls back to the item id for an item the registry does not know", () => {
    expect(resultsOutcome({ item: null, itemId: "L09-P9", result: at(70) }).heading).toBe("L09-P9 — 70/100");
  });
});

describe("deductionText", () => {
  it("is No hints without hints", () => {
    expect(deductionText(buildResult())).toBe("No hints");
    expect(deductionParts(buildResult())).toEqual({ label: "No hints", penalty: null });
  });

  it("is the hint count and 5 points per hint", () => {
    expect(deductionText(buildResult({ hintsUsed: 3 }))).toBe("Hint ×3 −15");
    expect(deductionParts(buildResult({ hintsUsed: 1 }))).toEqual({ label: "Hint ×1", penalty: "−5" });
  });

  it("shows the points actually taken when the floor at 0 took fewer", () => {
    expect(FLOORED_0).toMatchObject({ pointsEarned: 10, hintPenalty: 15, score: 0 });
    expect(deductionText(FLOORED_0)).toBe("Hint ×3 −10");
  });
});

describe("levelLabel", () => {
  it("is the level and its name, marked for a Test", () => {
    expect(levelLabel({ number: 1, name: "Fondasi" }, "practice")).toBe("Level 1 — Fondasi");
    expect(levelLabel({ number: 3, name: "Hitung bersyarat" }, "test")).toBe("Test · Level 3 — Hitung bersyarat");
  });
});

describe("shortcutKeys", () => {
  it("splits a shortcut into its keys", () => {
    expect(shortcutKeys("Ctrl+Shift+%")).toEqual(["Ctrl", "Shift", "%"]);
    expect(shortcutKeys("Ctrl+D")).toEqual(["Ctrl", "D"]);
    expect(shortcutKeys("F4")).toEqual(["F4"]);
  });
});
