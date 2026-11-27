import { describe, expect, it } from "vitest";
import type { LevelItem } from "@/core/content/level-module";
import { levels } from "@/content/levels";
import { canStart, levelProgress } from "@/core/progress";
import { completedItemIds, levelPanel, lockedReason, testLockLine, testResult } from "./level-panel";

const generate = () => ({ cells: { Data: { A1: "x" } }, questions: [] });
const practice = (number: number): LevelItem => ({ id: `L01-P${number}`, kind: "practice", number, generate });
const TEST: LevelItem = { id: "L01-T", kind: "test", number: 6, generate };
const NONE: ReadonlySet<string> = new Set();

describe("levelPanel", () => {
  it("default registry (L01-P1..P5 + L01-T): P1 next, P2–P5 not started, Test locked 5 to go", () => {
    const panel = levelPanel(levels[0], NONE);
    expect(panel.doneCount).toBe(0);
    expect(panel.pips).toEqual(["next", "pending", "pending", "pending", "pending"]);
    expect(panel.practices.map((p) => [p.label, p.itemId, p.status])).toEqual([
      ["Practice 1", "L01-P1", "next"],
      ["Practice 2", "L01-P2", "not_started"],
      ["Practice 3", "L01-P3", "not_started"],
      ["Practice 4", "L01-P4", "not_started"],
      ["Practice 5", "L01-P5", "not_started"],
    ]);
    expect(panel.test).toMatchObject({ label: "Test", itemId: "L01-T", status: "locked", toGo: 5 });
    expect(panel.next).toEqual({ itemId: "L01-P1", label: "Practice 1" });
  });

  it("content grows (P1, P2): P1 next, P2 not started, one Start for Practice 1", () => {
    const panel = levelPanel({ items: [practice(1), practice(2)] }, NONE);
    expect(panel.practices.map((p) => p.status)).toEqual(["next", "not_started", "unavailable", "unavailable", "unavailable"]);
    expect(panel.pips).toEqual(["next", "pending", "pending", "pending", "pending"]);
    expect(panel.next).toEqual({ itemId: "L01-P1", label: "Practice 1" });
  });

  it("no item with content: every row unavailable and nothing to start", () => {
    const panel = levelPanel({ items: [] }, NONE);
    expect(panel.practices.every((p) => p.status === "unavailable")).toBe(true);
    expect(panel.test.status).toBe("unavailable");
    expect(panel.pips).toEqual(["pending", "pending", "pending", "pending", "pending"]);
    expect(panel.next).toBeNull();
  });

  it("completed = {P1}: one done pip, Test locked 4 to go, P2 next", () => {
    const panel = levelPanel(levels[0], new Set(["L01-P1"]));
    expect(panel.doneCount).toBe(1);
    expect(panel.pips).toEqual(["done", "next", "pending", "pending", "pending"]);
    expect(panel.practices[0].status).toBe("done");
    expect(panel.test).toMatchObject({ status: "locked", toGo: 4 });
    expect(testLockLine(panel.test.toGo)).toBe("Test opens after 5 practices — 4 to go.");
    expect(panel.next).toEqual({ itemId: "L01-P2", label: "Practice 2" });
  });

  it("completed = {P1..P5} on the real registry: the Test is open", () => {
    const panel = levelPanel(levels[0], new Set(["L01-P1", "L01-P2", "L01-P3", "L01-P4", "L01-P5"]));
    expect(panel.doneCount).toBe(5);
    expect(panel.test).toMatchObject({ status: "open", toGo: 0, itemId: "L01-T" });
  });

  it("completed = {P1} with P2 content: P2 is next", () => {
    const panel = levelPanel({ items: [practice(1), practice(2)] }, new Set(["L01-P1"]));
    expect(panel.pips).toEqual(["done", "next", "pending", "pending", "pending"]);
    expect(panel.next).toEqual({ itemId: "L01-P2", label: "Practice 2" });
  });

  it("P1 done, P2 missing, P3 present: P3 is next (first with content not done, as canStart)", () => {
    const items = [practice(1), practice(3)];
    const panel = levelPanel({ items }, new Set(["L01-P1"]));
    expect(panel.practices.map((p) => p.status)).toEqual(["done", "unavailable", "next", "unavailable", "unavailable"]);
    expect(panel.pips).toEqual(["done", "pending", "next", "pending", "pending"]);
    expect(panel.next).toEqual({ itemId: "L01-P3", label: "Practice 3" });
    const mods = [{ ...levels[0], items }];
    const progress = levelProgress([{ id: "a", itemId: "L01-P1", score: 0, startedAt: "2026-11-02T01:00:00Z", receivedAt: null }], mods);
    expect(canStart(progress, mods, "L01-P3")).toEqual({ ok: true, practiceAgain: false });
    expect(canStart(levelProgress([], mods), mods, "L01-P3")).toEqual({ ok: false, reason: "practice_locked" });
  });

  it("opens the Test only at 5 done with Test content", () => {
    const all = [1, 2, 3, 4, 5].map(practice);
    const done = new Set(all.map((item) => item.id));
    expect(levelPanel({ items: [...all, TEST] }, done).test).toMatchObject({ status: "open", toGo: 0, itemId: "L01-T" });
    expect(levelPanel({ items: all }, done).test.status).toBe("unavailable");
    expect(levelPanel({ items: [...all, TEST] }, new Set(["L01-P1"])).test.status).toBe("locked");
  });

  it("counts only practices toward the gate", () => {
    expect(levelPanel({ items: [practice(1), TEST] }, new Set(["L01-T"])).doneCount).toBe(0);
  });
});

describe("levelPanel: Test outcome, Primary Button and Practice again", () => {
  const all = [1, 2, 3, 4, 5].map(practice);
  const level = { items: [...all, TEST] };
  const done = new Set(all.map((item) => item.id));

  it("next practice first: Start Practice N; done practices offer Practice again", () => {
    const panel = levelPanel(level, new Set(["L01-P1", "L01-P2"]));
    expect(panel.primary).toEqual({ itemId: "L01-P3", text: "Start Practice 3" });
    expect(panel.practices.map((p) => p.practiceAgain)).toEqual([true, true, false, false, false]);
    expect(panel.test.practiceAgain).toBe(false);
  });

  it("5 done, no Test attempt: Start Test", () => {
    expect(levelPanel(level, done).primary).toEqual({ itemId: "L01-T", text: "Start Test" });
  });

  it("failed Test: Try the Test again, no Practice again on the Test", () => {
    const panel = levelPanel(level, done, { passed: false, attempted: true });
    expect(panel.test).toMatchObject({ status: "failed", practiceAgain: false });
    expect(panel.primary).toEqual({ itemId: "L01-T", text: "Try the Test again" });
  });

  it("passed Test: no Primary Button, Practice again on the Test and every practice", () => {
    const panel = levelPanel(level, done, { passed: true, attempted: true });
    expect(panel.test).toMatchObject({ status: "passed", practiceAgain: true });
    expect(panel.primary).toBeNull();
    expect(panel.practices.every((p) => p.practiceAgain)).toBe(true);
  });

  it("testResult reads levelProgress", () => {
    const at = (itemId: string, score: number) => ({ id: itemId, itemId, score, startedAt: "2026-11-02T01:00:00Z", receivedAt: null });
    expect(testResult({ number: 1 }, levelProgress([], levels))).toEqual({ passed: false, attempted: false });
    expect(testResult({ number: 7 }, [])).toEqual({ passed: false, attempted: false });
    const mods = [{ ...levels[0], items: [...levels[0].items, TEST] }];
    expect(testResult({ number: 1 }, levelProgress([at("L01-T", 50)], mods))).toEqual({ passed: false, attempted: true });
  });
});

describe("levelPanel: Materi (5.7)", () => {
  it("carries each Practice's Materi cards; an unavailable practice has none", () => {
    const panel = levelPanel(levels[0], new Set());
    expect(panel.practices.map((practice) => practice.materi.length)).toEqual([4, 4, 3, 3, 3]);
    const gappy = levelPanel({ items: levels[0].items.filter((item) => item.id !== "L01-P2") }, new Set());
    expect(gappy.practices[1]).toMatchObject({ status: "unavailable", materi: [] });
  });
});

describe("testLockLine", () => {
  it("uses the live count", () => {
    expect(testLockLine(5)).toBe("Test opens after 5 practices — 5 to go.");
    expect(testLockLine(1)).toBe("Test opens after 5 practices — 1 to go.");
  });
});

describe("completedItemIds", () => {
  const at = (itemId: string) => ({ id: itemId, itemId, score: 40, startedAt: "2026-11-02T01:00:00Z", receivedAt: "2026-11-02T01:10:00Z" });

  it("maps levelProgress practices to the level's item ids (repeats and the Test add nothing)", () => {
    const progress = levelProgress([at("L01-P1"), at("L01-P1"), at("L01-T")], levels);
    expect([...completedItemIds(levels[0], progress)]).toEqual(["L01-P1"]);
    const panel = levelPanel(levels[0], completedItemIds(levels[0], progress));
    expect(panel.doneCount).toBe(1);
    expect(panel.practices[0].status).toBe("done");
    expect(panel.practices.slice(1).map((p) => p.status)).toEqual(["next", "not_started", "not_started", "not_started"]);
    expect(panel.next).toEqual({ itemId: "L01-P2", label: "Practice 2" });
  });

  it("is empty without progress for the level", () => {
    expect(completedItemIds(levels[0], []).size).toBe(0);
    expect(completedItemIds({ number: 1, items: [practice(1)] }, levelProgress([], levels)).size).toBe(0);
  });
});

describe("lockedReason", () => {
  it("names the Test of the level before", () => {
    expect(lockedReason(3)).toBe("Pass Test Level 2 to unlock.");
  });
});
