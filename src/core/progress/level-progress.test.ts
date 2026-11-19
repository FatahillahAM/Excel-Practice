import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LevelModule, LevelPhase } from "@/core/content/level-module";
import { PRACTICE_64, PRACTICE_85, SCORE_79, SCORE_80, TEST_72, TEST_88 } from "@/core/grading/__fixtures__/results";
import { levelProgress, toGradedAttempts, type GradedAttempt } from "./level-progress";

/** A registry module with only what progress reads: number, name, phase and item ids. */
function fixtureModule(number: number, phase: LevelPhase = "v1", practices = 5, test = true): LevelModule {
  const pad = String(number).padStart(2, "0");
  const items = Array.from({ length: practices }, (_, i) => ({ id: `L${pad}-P${i + 1}`, kind: "practice", number: i + 1 }));
  if (test) items.push({ id: `L${pad}-T`, kind: "test", number: 6 });
  return { id: `${pad}-x`, number, name: `Modul ${number}`, phase, items } as unknown as LevelModule;
}

const L1 = fixtureModule(1);
const L2 = fixtureModule(2);
const at = (itemId: string, score: number): GradedAttempt => ({ itemId, score, startedAt: "2026-11-02T01:00:00Z", receivedAt: "2026-11-02T01:10:00Z" });
const states = (progress: ReturnType<typeof levelProgress>) => progress.map((level) => level.state);

describe("levelProgress", () => {
  it("empty: Level 1 active 0/5, the rest Under Construction without a module", () => {
    const progress = levelProgress([], [L1]);
    expect(progress).toHaveLength(9);
    expect(progress[0]).toMatchObject({ number: 1, name: "Modul 1", state: "active", testPassed: false });
    expect(progress[0].practicesDone.size).toBe(0);
    expect(states(progress).slice(1)).toEqual(Array(8).fill("under_construction"));
    expect(progress[1].name).toBe("Logika");
  });

  it("empty with a Level 2 module: Level 2 locked", () => {
    expect(states(levelProgress([], [L1, L2])).slice(0, 3)).toEqual(["active", "locked", "under_construction"]);
  });

  it.each([
    ["one practice, score 40", [at("L01-P1", 40)], [1]],
    ["the same practice 3×", [at("L01-P1", 40), at("L01-P1", 90), at("L01-P1", 10)], [1]],
    ["three practices", [at("L01-P1", 40), at("L01-P3", 100), at("L01-P5", 0)], [1, 3, 5]],
    ["an unknown item is ignored", [at("L77-P1", 90), at("L01-P2", 50)], [2]],
  ])("pips: %s", (_, attempts, expected) => {
    expect([...levelProgress(attempts, [L1])[0].practicesDone].sort()).toEqual(expected);
  });

  it("Test passed (85): Level 1 passed, Level 2 active — or Under Construction without a module", () => {
    expect(states(levelProgress([at("L01-T", 85)], [L1, L2])).slice(0, 2)).toEqual(["passed", "active"]);
    const alone = levelProgress([at("L01-T", 85)], [L1]);
    expect(alone[0]).toMatchObject({ state: "passed", testPassed: true });
    expect(alone[1].state).toBe("under_construction");
  });

  it("Test failed (70) or 79: Level 2 stays locked; 80 passes", () => {
    expect(states(levelProgress([at("L01-T", 70)], [L1, L2])).slice(0, 2)).toEqual(["active", "locked"]);
    expect(states(levelProgress([at("L01-T", 79)], [L1, L2])).slice(0, 2)).toEqual(["active", "locked"]);
    expect(states(levelProgress([at("L01-T", 70), at("L01-T", 80)], [L1, L2])).slice(0, 2)).toEqual(["passed", "active"]);
  });

  it("a Test does not add a pip", () => {
    expect(levelProgress([at("L01-T", 90)], [L1])[0].practicesDone.size).toBe(0);
  });

  it("a phase `next` module is Under Construction and opens nothing after it", () => {
    const progress = levelProgress([at("L01-T", 90), at("L02-T", 90)], [L1, fixtureModule(2, "next"), fixtureModule(3)]);
    expect(states(progress).slice(0, 3)).toEqual(["passed", "under_construction", "locked"]);
  });

  it("a later level's passed Test does not open it while locked", () => {
    expect(states(levelProgress([at("L02-T", 90)], [L1, L2])).slice(0, 2)).toEqual(["active", "locked"]);
  });
});

describe("toGradedAttempts", () => {
  let errors: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    errors = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  const row = (id: string, result: unknown, itemId = "L01-P1") => ({ id, itemId, result, startedAt: "2026-11-02T01:00:00Z", receivedAt: "2026-11-02T01:10:00Z" });

  it("keeps valid Results in order with their score", () => {
    expect(toGradedAttempts([row("a", PRACTICE_85), row("b", PRACTICE_64, "L01-P2"), row("c", TEST_88, "L01-T")])).toEqual([
      { itemId: "L01-P1", score: PRACTICE_85.score, startedAt: "2026-11-02T01:00:00Z", receivedAt: "2026-11-02T01:10:00Z" },
      expect.objectContaining({ itemId: "L01-P2", score: PRACTICE_64.score }),
      expect.objectContaining({ itemId: "L01-T", score: TEST_88.score }),
    ]);
    expect(errors).not.toHaveBeenCalled();
  });

  it("drops an invalid Result and logs progress.result_invalid without its content", () => {
    const kept = toGradedAttempts([row("bad", { version: 9, secret: "x" }, "L01-P3"), row("ok", SCORE_80)]);
    expect(kept.map((a) => a.score)).toEqual([SCORE_80.score]);
    expect(errors.mock.calls.map((c: unknown[]) => JSON.parse(c[0] as string))).toEqual([{ event: "progress.result_invalid", attemptId: "bad" }]);
  });

  it("feeds levelProgress: an invalid L01-P3 is not counted, the rest is", () => {
    const attempts = toGradedAttempts([row("a", SCORE_79), row("bad", null, "L01-P3"), row("t", TEST_72, "L01-T")]);
    const level = levelProgress(attempts, [L1])[0];
    expect([...level.practicesDone]).toEqual([1]);
    expect(level.state).toBe("active");
  });
});
