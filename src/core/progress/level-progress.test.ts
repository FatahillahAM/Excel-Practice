import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LevelModule, LevelPhase } from "@/core/content/level-module";
import { PRACTICE_64, PRACTICE_85, SCORE_79, SCORE_80, TEST_72, TEST_88 } from "@/core/grading/__fixtures__/results";
import { FIXTURE_LEVELS, fixtureLevel } from "@/core/content/__fixtures__/levels";
import { canStart, curriculumSummary, levelProgress, toGradedAttempts, v1Complete, type GradedAttempt } from "./level-progress";

/** A registry module with only what progress reads: number, name, phase and item ids. */
function fixtureModule(number: number, phase: LevelPhase = "v1", practices = 5, test = true): LevelModule {
  const pad = String(number).padStart(2, "0");
  const items = Array.from({ length: practices }, (_, i) => ({ id: `L${pad}-P${i + 1}`, kind: "practice", number: i + 1 }));
  if (test) items.push({ id: `L${pad}-T`, kind: "test", number: 6 });
  return { id: `${pad}-x`, number, name: `Modul ${number}`, phase, items } as unknown as LevelModule;
}

const L1 = fixtureModule(1);
const L2 = fixtureModule(2);
const at = (itemId: string, score: number): GradedAttempt => ({ id: `${itemId}-${score}`, itemId, score, startedAt: "2026-11-02T01:00:00Z", receivedAt: "2026-11-02T01:10:00Z" });
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

const practices = (level: number, count = 5) =>
  Array.from({ length: count }, (_, i) => at(`L${String(level).padStart(2, "0")}-P${i + 1}`, 10 * (i + 1)));
const check = (attempts: GradedAttempt[], itemId: string, modules = FIXTURE_LEVELS) => canStart(levelProgress(attempts, modules), modules, itemId);

describe("gates on fixture Levels 1–4 (matrix)", () => {
  it("fixture levels pass defineLevelModule and hold 5 practices + Test each", () => {
    expect(FIXTURE_LEVELS.map((mod) => mod.items.map((item) => item.id).join(","))).toEqual(
      [1, 2, 3, 4].map((n) => ["P1", "P2", "P3", "P4", "P5", "T"].map((s) => `L0${n}-${s}`).join(",")),
    );
  });

  it("Test locked with 4 practices: server refuses, 1 to go", () => {
    const attempts = practices(1, 4);
    expect(levelProgress(attempts, FIXTURE_LEVELS)[0].practicesDone.size).toBe(4);
    expect(check(attempts, "L01-T")).toEqual({ ok: false, reason: "test_locked", toGo: 1 });
  });

  it("Test opens after 5 distinct practices, any score (0 counts)", () => {
    expect(check([...practices(1, 4), at("L01-P5", 0)], "L01-T")).toEqual({ ok: true, practiceAgain: false });
    expect(check([...practices(1, 4), at("L01-P4", 90)], "L01-T")).toEqual({ ok: false, reason: "test_locked", toGo: 1 });
  });

  it("Test 80 passes: Level 1 passed, Level 2 active and startable", () => {
    const attempts = [...practices(1), at("L01-T", 80)];
    expect(states(levelProgress(attempts, FIXTURE_LEVELS)).slice(0, 3)).toEqual(["passed", "active", "locked"]);
    expect(check(attempts, "L02-P1")).toEqual({ ok: true, practiceAgain: false });
    expect(check(attempts, "L01-T")).toEqual({ ok: true, practiceAgain: true });
  });

  it("Test 79 fails: retake at once, no new requirement; Level 2 refused", () => {
    const attempts = [...practices(1), at("L01-T", 79)];
    const level = levelProgress(attempts, FIXTURE_LEVELS)[0];
    expect(level).toMatchObject({ state: "active", testPassed: false, testAttempted: true });
    expect(check(attempts, "L01-T")).toEqual({ ok: true, practiceAgain: false });
    expect(check(attempts, "L02-P1")).toEqual({ ok: false, reason: "level_locked" });
  });

  it("a failed Practice again after passing keeps the level passed", () => {
    const attempts = [...practices(1), at("L01-T", 85), at("L01-T", 50)];
    expect(states(levelProgress(attempts, FIXTURE_LEVELS)).slice(0, 2)).toEqual(["passed", "active"]);
  });

  it("Level 4 passed: V1 complete, nothing new unlocks (even with a Level 5 module)", () => {
    const attempts = [1, 2, 3, 4].flatMap((n) => [...practices(n), at(`L0${n}-T`, 90)]);
    const modules = [...FIXTURE_LEVELS, fixtureLevel(5)];
    const progress = levelProgress(attempts, modules);
    expect(states(progress).slice(0, 5)).toEqual(["passed", "passed", "passed", "passed", "under_construction"]);
    expect(v1Complete(progress)).toBe(true);
    expect(check(attempts, "L05-P1", modules)).toEqual({ ok: false, reason: "under_construction" });
    expect(v1Complete(levelProgress(attempts.slice(0, -1), modules))).toBe(false);
  });

  it("next level missing from the registry: Under Construction, Start refused", () => {
    const modules = [FIXTURE_LEVELS[0]];
    const attempts = [...practices(1), at("L01-T", 90)];
    expect(levelProgress(attempts, modules)[1].state).toBe("under_construction");
    expect(check(attempts, "L02-P1", modules)).toEqual({ ok: false, reason: "under_construction" });
    expect(check(attempts, "L02-P1", [FIXTURE_LEVELS[0], fixtureLevel(2, { phase: "next" })])).toEqual({ ok: false, reason: "under_construction" });
  });

  it("Practice again on a done practice: allowed, and never changes pips, gate or level status", () => {
    const before = [...practices(1, 3)];
    expect(check(before, "L01-P1")).toEqual({ ok: true, practiceAgain: true });
    const after = [...before, at("L01-P1", 100), at("L01-P1", 5), at("L01-P2", 0)];
    const [a, b] = [levelProgress(before, FIXTURE_LEVELS)[0], levelProgress(after, FIXTURE_LEVELS)[0]];
    expect([...b.practicesDone].sort()).toEqual([...a.practicesDone].sort());
    expect(b.state).toBe(a.state);
    expect(check(after, "L01-T")).toEqual({ ok: false, reason: "test_locked", toGo: 2 });
  });

  it("unknown items are refused: L09-P1 (no content) Under Construction, a malformed id unknown", () => {
    expect(check([], "L09-P1")).toEqual({ ok: false, reason: "under_construction" });
    expect(check([], "X-1")).toEqual({ ok: false, reason: "unknown_item" });
  });

  it("practices go in order: P5 on a new account refused, P2 after P1 allowed, a done one is Practice again", () => {
    expect(check([], "L01-P5")).toEqual({ ok: false, reason: "practice_locked" });
    expect(check([], "L01-P1")).toEqual({ ok: true, practiceAgain: false });
    expect(check([at("L01-P1", 0)], "L01-P2")).toEqual({ ok: true, practiceAgain: false });
    expect(check([at("L01-P1", 0)], "L01-P3")).toEqual({ ok: false, reason: "practice_locked" });
  });

  it("a practice without content does not block the next one (same as the panel's next)", () => {
    const gappy = { ...FIXTURE_LEVELS[0], items: FIXTURE_LEVELS[0].items.filter((item) => item.id !== "L01-P2") };
    expect(check([at("L01-P1", 0)], "L01-P3", [gappy])).toEqual({ ok: true, practiceAgain: false });
    expect(check([], "L01-P3", [gappy])).toEqual({ ok: false, reason: "practice_locked" });
  });

  it("a practice of a locked level is refused", () => {
    expect(check([], "L03-P1")).toEqual({ ok: false, reason: "level_locked" });
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
      { id: "a", itemId: "L01-P1", score: PRACTICE_85.score, startedAt: "2026-11-02T01:00:00Z", receivedAt: "2026-11-02T01:10:00Z" },
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

describe("curriculumSummary", () => {
  it("new user: L1, 0 of 9", () => {
    expect(curriculumSummary(levelProgress([], [L1]))).toEqual({ activeLevel: 1, passed: 0, total: 9 });
  });

  it("Test 1 passed: 1 of 9; active level 2 when Level 2 has a module, else the last passed level", () => {
    expect(curriculumSummary(levelProgress([at("L01-T", 80)], [L1, L2]))).toEqual({ activeLevel: 2, passed: 1, total: 9 });
    expect(curriculumSummary(levelProgress([at("L01-T", 80)], [L1]))).toEqual({ activeLevel: 1, passed: 1, total: 9 });
    expect(curriculumSummary(levelProgress([at("L01-T", 79)], [L1, L2]))).toEqual({ activeLevel: 1, passed: 0, total: 9 });
  });
});
