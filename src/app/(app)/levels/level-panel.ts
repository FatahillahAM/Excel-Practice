import { itemLabel, type LevelModule } from "@/core/content/level-module";
import type { LevelProgress } from "@/core/progress";

/**
 * The view model of the Level Detail Panel, as a pure function of the level's
 * registry entry and the set of completed item ids (from `levelProgress`,
 * via `completedItemIds`, so /levels and the Dashboard agree). An item the
 * registry does not have yet is "unavailable", never startable.
 */

export const PRACTICE_COUNT = 5;

export type PipState = "done" | "next" | "pending";
export type PracticeStatus = "done" | "next" | "not_started" | "unavailable";
export type TestStatus = "locked" | "open" | "passed" | "failed" | "unavailable";

export interface PanelPractice {
  number: number;
  label: string;
  /** The registry item id, or `null` while the practice has no content. */
  itemId: string | null;
  status: PracticeStatus;
  /** Done practices can be started again ("Practice again"; never changes pips, gate or level status). */
  practiceAgain: boolean;
}

export interface PanelTest {
  label: string;
  itemId: string | null;
  status: TestStatus;
  /** Practices still to complete before the Test opens. */
  toGo: number;
  /** A passed Test can be started again ("Practice again"). */
  practiceAgain: boolean;
}

/** The level's Test outcome so far (from `levelProgress`). */
export interface TestResult {
  passed: boolean;
  attempted: boolean;
}

const NO_TEST: TestResult = { passed: false, attempted: false };

export interface LevelPanel {
  doneCount: number;
  pips: PipState[];
  practices: PanelPractice[];
  test: PanelTest;
  /** The first practice not done, when it has content. */
  next: { itemId: string; label: string } | null;
  /**
   * The panel's Primary Button: "Start Practice N" for `next`, else "Start
   * Test" (open) or "Try the Test again" (failed); `null` when neither.
   */
  primary: { itemId: string; text: string } | null;
}

export function levelPanel(
  level: Pick<LevelModule, "items">,
  completed: ReadonlySet<string>,
  result: TestResult = NO_TEST,
): LevelPanel {
  const practiceItems = Array.from({ length: PRACTICE_COUNT }, (_, index) =>
    level.items.find((item) => item.kind === "practice" && item.number === index + 1),
  );
  const testItem = level.items.find((item) => item.kind === "test");

  const doneCount = practiceItems.filter((item) => item && completed.has(item.id)).length;
  // The first practice with content not done (no skipping past it; `canStart` enforces the same order).
  const nextIndex = practiceItems.findIndex((item) => item !== undefined && !completed.has(item.id));

  const practices: PanelPractice[] = practiceItems.map((item, index) => {
    const number = index + 1;
    const label = itemLabel({ kind: "practice", number });
    if (!item) return { number, label, itemId: null, status: "unavailable", practiceAgain: false };
    const status: PracticeStatus = completed.has(item.id) ? "done" : index === nextIndex ? "next" : "not_started";
    return { number, label, itemId: item.id, status, practiceAgain: status === "done" };
  });

  const pips: PipState[] = practices.map((practice) =>
    practice.status === "done" ? "done" : practice.status === "next" ? "next" : "pending",
  );

  const toGo = PRACTICE_COUNT - doneCount;
  // A level without Test content shows "unavailable" from the start (until epic 5).
  const testStatus: TestStatus = !testItem
    ? "unavailable"
    : result.passed
      ? "passed"
      : toGo > 0
        ? "locked"
        : result.attempted
          ? "failed"
          : "open";
  const test: PanelTest = {
    label: itemLabel({ kind: "test", number: PRACTICE_COUNT + 1 }),
    itemId: testItem?.id ?? null,
    status: testStatus,
    toGo,
    practiceAgain: testStatus === "passed",
  };

  const nextPractice = nextIndex === -1 ? null : practices[nextIndex];
  const next = nextPractice?.itemId ? { itemId: nextPractice.itemId, label: nextPractice.label } : null;
  const primary = next
    ? { itemId: next.itemId, text: `Start ${next.label}` }
    : testItem && testStatus === "open"
      ? { itemId: testItem.id, text: "Start Test" }
      : testItem && testStatus === "failed"
        ? { itemId: testItem.id, text: "Try the Test again" }
        : null;

  return { doneCount, pips, practices, test, next, primary };
}

/** EXPERIENCE.md › State Patterns: the Test row's lock line with the live count. */
export function testLockLine(toGo: number): string {
  return `Test opens after ${PRACTICE_COUNT} practices — ${toGo} to go.`;
}

/** The level's practice item ids done in `progress` (`levelProgress`): the panel's `completed`. */
export function completedItemIds(
  level: Pick<LevelModule, "number" | "items">,
  progress: readonly Pick<LevelProgress, "number" | "practicesDone">[],
): Set<string> {
  const done = progress.find((entry) => entry.number === level.number)?.practicesDone;
  const ids = new Set<string>();
  if (!done) return ids;
  for (const item of level.items) if (item.kind === "practice" && done.has(item.number)) ids.add(item.id);
  return ids;
}

/** The level's Test outcome in `progress` (`levelProgress`): the panel's `result`. */
export function testResult(
  level: Pick<LevelModule, "number">,
  progress: readonly Pick<LevelProgress, "number" | "testPassed" | "testAttempted">[],
): TestResult {
  const entry = progress.find((candidate) => candidate.number === level.number);
  return { passed: entry?.testPassed ?? false, attempted: entry?.testAttempted ?? false };
}

/** EXPERIENCE.md › Level Callout: the line after Level 4's Test passes. */
export const V1_END_LINE = "Level 4 complete — Level 5 is coming soon";

/** EXPERIENCE.md › Level Node: why a locked level cannot start (its panel and node `aria-describedby`). */
export function lockedReason(levelNumber: number): string {
  return `Pass Test Level ${levelNumber - 1} to unlock.`;
}
