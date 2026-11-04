import { describe, expect, it } from "vitest";
import type { LevelItem } from "../../../core/content/level-module";
import { levels } from "../../../content/levels";
import { levelPanel, testLockLine } from "./level-panel";

const examCells = () => ({ Data: { A1: "x" } });
const practice = (number: number): LevelItem => ({ id: `L01-P${number}`, kind: "practice", number, examCells });
const TEST: LevelItem = { id: "L01-T", kind: "test", number: 6, examCells };
const NONE: ReadonlySet<string> = new Set();

describe("levelPanel", () => {
  it("default registry (L01-P1 only): P1 next, P2–P5 unavailable, Test locked with 5 to go", () => {
    const panel = levelPanel(levels[0], NONE);
    expect(panel.doneCount).toBe(0);
    expect(panel.pips).toEqual(["next", "pending", "pending", "pending", "pending"]);
    expect(panel.practices.map((p) => [p.label, p.itemId, p.status])).toEqual([
      ["Practice 1", "L01-P1", "next"],
      ["Practice 2", null, "unavailable"],
      ["Practice 3", null, "unavailable"],
      ["Practice 4", null, "unavailable"],
      ["Practice 5", null, "unavailable"],
    ]);
    expect(panel.test).toMatchObject({ label: "Test", status: "locked", toGo: 5 });
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

  it("completed = {P1}: one done pip, Test 4 to go, no next while P2 has no content", () => {
    const panel = levelPanel(levels[0], new Set(["L01-P1"]));
    expect(panel.doneCount).toBe(1);
    expect(panel.pips).toEqual(["done", "pending", "pending", "pending", "pending"]);
    expect(panel.practices[0].status).toBe("done");
    expect(panel.test).toMatchObject({ status: "locked", toGo: 4 });
    expect(panel.next).toBeNull();
  });

  it("completed = {P1} with P2 content: P2 is next", () => {
    const panel = levelPanel({ items: [practice(1), practice(2)] }, new Set(["L01-P1"]));
    expect(panel.pips).toEqual(["done", "next", "pending", "pending", "pending"]);
    expect(panel.next).toEqual({ itemId: "L01-P2", label: "Practice 2" });
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

describe("testLockLine", () => {
  it("uses the live count", () => {
    expect(testLockLine(5)).toBe("Test opens after 5 practices — 5 to go.");
    expect(testLockLine(1)).toBe("Test opens after 5 practices — 1 to go.");
  });
});
