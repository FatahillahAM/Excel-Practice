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
export type TestStatus = "locked" | "open" | "unavailable";

export interface PanelPractice {
  number: number;
  label: string;
  /** The registry item id, or `null` while the practice has no content. */
  itemId: string | null;
  status: PracticeStatus;
}

export interface PanelTest {
  label: string;
  itemId: string | null;
  status: TestStatus;
  /** Practices still to complete before the Test opens. */
  toGo: number;
}

export interface LevelPanel {
  doneCount: number;
  pips: PipState[];
  practices: PanelPractice[];
  test: PanelTest;
  /** The one item the panel's Start starts: the first practice not done, when it has content. */
  next: { itemId: string; label: string } | null;
}

export function levelPanel(level: Pick<LevelModule, "items">, completed: ReadonlySet<string>): LevelPanel {
  const practiceItems = Array.from({ length: PRACTICE_COUNT }, (_, index) =>
    level.items.find((item) => item.kind === "practice" && item.number === index + 1),
  );
  const testItem = level.items.find((item) => item.kind === "test");

  const doneCount = practiceItems.filter((item) => item && completed.has(item.id)).length;
  // The first practice not done; when it has no content yet, nothing is next (no skipping ahead).
  const firstOpen = practiceItems.findIndex((item) => !item || !completed.has(item.id));
  const nextIndex = firstOpen !== -1 && practiceItems[firstOpen] ? firstOpen : -1;

  const practices: PanelPractice[] = practiceItems.map((item, index) => {
    const number = index + 1;
    const label = itemLabel({ kind: "practice", number });
    if (!item) return { number, label, itemId: null, status: "unavailable" };
    const status: PracticeStatus = completed.has(item.id) ? "done" : index === nextIndex ? "next" : "not_started";
    return { number, label, itemId: item.id, status };
  });

  const pips: PipState[] = practices.map((practice) =>
    practice.status === "done" ? "done" : practice.status === "next" ? "next" : "pending",
  );

  const toGo = PRACTICE_COUNT - doneCount;
  const hasContent = level.items.length > 0;
  const testStatus: TestStatus =
    toGo === 0 ? (testItem ? "open" : "unavailable") : hasContent ? "locked" : "unavailable";
  const test: PanelTest = {
    label: itemLabel({ kind: "test", number: PRACTICE_COUNT + 1 }),
    itemId: testItem?.id ?? null,
    status: testStatus,
    toGo,
  };

  const nextPractice = nextIndex === -1 ? null : practices[nextIndex];
  const next = nextPractice?.itemId ? { itemId: nextPractice.itemId, label: nextPractice.label } : null;

  return { doneCount, pips, practices, test, next };
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
