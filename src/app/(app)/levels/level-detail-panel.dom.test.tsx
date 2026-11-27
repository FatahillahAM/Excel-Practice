// @vitest-environment jsdom
import "@/test/dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ startAttempt: vi.fn(async () => ({ status: "idle" as const })) }));
vi.mock("./start-actions", () => ({ startAttempt: mocks.startAttempt }));

import { FIXTURE_LEVELS } from "@/core/content/__fixtures__/levels";
import { phoneStartMessage } from "@/messages/id";
import { LevelDetailPanel } from "./level-detail-panel";
import { TEST_UNAVAILABLE_LINE, V1_END_LINE } from "./level-panel";
import { BLOCKED_MESSAGE } from "./start-lock";
import { PHONE_QUERY } from "./start-control";

const [L1] = FIXTURE_LEVELS;
const L4 = FIXTURE_LEVELS[3];
const ids = (level: number, count = 5) => new Set(Array.from({ length: count }, (_, i) => `L0${level}-P${i + 1}`));
/** The real (laptop) Start buttons: inside the form the phone query hides. */
const realButtons = (name: string | RegExp) =>
  screen.getAllByRole("button", { name }).filter((button) => button.closest("form") !== null);
const phoneButtons = (name: string | RegExp) =>
  screen.getAllByRole("button", { name }).filter((button) => button.closest('[data-slot="phone-start"]') !== null);

afterEach(() => {
  mocks.startAttempt.mockClear();
});

describe("LevelDetailPanel labels (fixture Level 1)", () => {
  it("2 done: Start Practice 3 and Practice again on P1, P2", () => {
    render(<LevelDetailPanel level={L1} completed={ids(1, 2)} />);
    expect(realButtons("Start Practice 3")).toHaveLength(1);
    expect(realButtons("Practice again")).toHaveLength(2);
    expect(screen.getByText("Test opens after 5 practices — 3 to go.")).toBeTruthy();
  });

  it("5 done: Start Test", () => {
    render(<LevelDetailPanel level={L1} completed={ids(1)} />);
    expect(realButtons("Start Test")).toHaveLength(1);
  });

  it("failed Test: Try the Test again", () => {
    render(<LevelDetailPanel level={L1} completed={ids(1)} result={{ passed: false, attempted: true }} />);
    expect(realButtons("Try the Test again")).toHaveLength(1);
    expect(screen.getByText("Not passed yet")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start Test" })).toBeNull();
  });

  it("passed Test: Practice again on the Test too, no Primary Button; Level 4 shows the V1 end line", () => {
    const { unmount } = render(<LevelDetailPanel level={L1} completed={ids(1)} result={{ passed: true, attempted: true }} />);
    expect(realButtons("Practice again")).toHaveLength(6);
    expect(screen.queryByText(V1_END_LINE)).toBeNull();
    unmount();
    render(<LevelDetailPanel level={L4} completed={ids(4)} result={{ passed: true, attempted: true }} state="passed" />);
    expect(screen.getByText(V1_END_LINE)).toBeTruthy();
    expect(screen.getByText(/Level 4 · Passed/)).toBeTruthy();
  });
});

describe("LevelDetailPanel locked while an attempt is open", () => {
  it("every Start / Practice again is aria-disabled, the reason shown once, nothing submits", async () => {
    const user = userEvent.setup();
    render(<LevelDetailPanel level={L1} completed={ids(1, 2)} startLock={{ reason: BLOCKED_MESSAGE, attemptId: "a1" }} />);
    const buttons = [...realButtons("Start Practice 3"), ...realButtons("Practice again")];
    expect(buttons).toHaveLength(3);
    for (const button of buttons) {
      expect(button.getAttribute("aria-disabled")).toBe("true");
      expect(button.getAttribute("aria-describedby")).toContain("start-L01-P3-lock");
      await user.click(button);
    }
    expect(screen.getAllByText(BLOCKED_MESSAGE)).toHaveLength(1);
    expect(mocks.startAttempt).not.toHaveBeenCalled();
  });

  it("with nothing next (Test passed) the reason has its own line", () => {
    render(<LevelDetailPanel level={L1} completed={ids(1)} result={{ passed: true, attempted: true }} startLock={{ reason: BLOCKED_MESSAGE }} />);
    const line = screen.getByText(BLOCKED_MESSAGE);
    expect(line.id).toBe("level-01-fixture-lock");
    for (const button of realButtons("Practice again")) expect(button.getAttribute("aria-describedby")).toContain(line.id);
  });
});

describe("phone gating", () => {
  it("the device query is coarse pointer below lg, and CSS swaps the real form for the phone button", () => {
    expect(PHONE_QUERY).toBe("(pointer: coarse) and (max-width: 1023px)");
    render(<LevelDetailPanel level={L1} completed={ids(1, 2)} />);
    const form = realButtons("Start Practice 3")[0].closest("form")!;
    expect(form.className).toContain("[@media(pointer:coarse)_and_(max-width:1023px)]:hidden");
    const phone = phoneButtons("Start Practice 3")[0].closest('[data-slot="phone-start"]')!;
    expect(phone.className).toMatch(/(^| )hidden( |$)/);
    expect(phone.className).toContain("[@media(pointer:coarse)_and_(max-width:1023px)]:flex");
  });

  it("tapping Start or Practice again on the phone shows the message (polite) and calls no action", async () => {
    const user = userEvent.setup();
    render(<LevelDetailPanel level={L1} completed={ids(1, 2)} />);
    const start = phoneButtons("Start Practice 3")[0];
    expect(start.getAttribute("type")).toBe("button");
    expect(start.closest("form")).toBeNull();
    await user.click(start);
    const status = within(start.closest('[data-slot="phone-start"]') as HTMLElement).getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toBe(phoneStartMessage);
    await user.click(phoneButtons("Practice again")[0]);
    expect(screen.getAllByText(phoneStartMessage)).toHaveLength(2);
    expect(mocks.startAttempt).not.toHaveBeenCalled();
  });

  it("with a lock the phone buttons are aria-disabled, described by the reason, and show no phone message", async () => {
    const user = userEvent.setup();
    render(<LevelDetailPanel level={L1} completed={ids(1, 2)} startLock={{ reason: BLOCKED_MESSAGE }} />);
    for (const button of [...phoneButtons("Start Practice 3"), ...phoneButtons("Practice again")]) {
      expect(button.getAttribute("aria-disabled")).toBe("true");
      const describedBy = button.getAttribute("aria-describedby")!;
      expect(document.getElementById(describedBy)?.textContent).toBe(BLOCKED_MESSAGE);
      await user.click(button);
    }
    expect(screen.queryByText(phoneStartMessage)).toBeNull();
    expect(mocks.startAttempt).not.toHaveBeenCalled();
  });

  it("the phone status comes after the button", () => {
    render(<LevelDetailPanel level={L1} completed={ids(1, 2)} />);
    const slot = phoneButtons("Start Practice 3")[0].closest('[data-slot="phone-start"]')!;
    expect(slot.lastElementChild?.getAttribute("role")).toBe("status");
  });
});

describe("LevelDetailPanel eyebrow, read-only states and records", () => {
  const eyebrow = () => document.querySelector('[data-slot="panel-eyebrow"]')?.textContent;

  it.each([
    ["active", "Level 1 · Active"],
    ["passed", "Level 1 · Passed"],
    ["locked", "Level 1 · Locked"],
    ["under_construction", "Level 1 · Under Construction"],
  ] as const)("state %s: eyebrow %s", (state, text) => {
    render(<LevelDetailPanel level={L1} state={state} />);
    expect(eyebrow()).toBe(text);
  });

  it("locked: the reason, no Start or Practice again, no rows", () => {
    render(<LevelDetailPanel level={L4} state="locked" completed={ids(4)} />);
    expect(screen.getByText("Pass Test Level 3 to unlock.")).toBeTruthy();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("Under Construction: the Tag, no Start", () => {
    render(<LevelDetailPanel level={L4} state="under_construction" />);
    expect(document.querySelector('[data-slot="under-construction-tag"]')?.textContent).toBe("Under Construction");
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("the heading takes programmatic focus (tabIndex -1)", () => {
    render(<LevelDetailPanel level={L1} />);
    expect(screen.getByRole("heading", { level: 2 }).getAttribute("tabindex")).toBe("-1");
  });

  it("record time and best score per row, the phone caption too; — without an attempt", () => {
    const rec = { itemId: "L01-P2", attemptId: "a", seconds: 3725, receivedAt: "2026-11-02T01:10:00Z", score: 60 };
    render(<LevelDetailPanel level={L1} completed={ids(1, 2)} records={new Map([["L01-P2", rec]])} bestScores={new Map([["L01-P2", 85]])} />);
    const times = [...document.querySelectorAll('[data-slot="record-time"]')].map((cell) => cell.textContent);
    expect(times).toEqual(["—", "1:02:05", "—", "—", "—", "—"]);
    expect(screen.getByText("Best 85 · 1:02:05")).toBeTruthy();
  });
});

describe("LevelDetailPanel Test row with the real Level 1 and without a Test", () => {
  it("real L01 (P1 + L01-T), P1 done: Test locked, 4 to go, no unavailable line", async () => {
    const { fondasi } = await import("@/content/levels/01-fondasi");
    render(<LevelDetailPanel level={fondasi} completed={new Set(["L01-P1"])} />);
    expect(screen.getByText("Test opens after 5 practices — 4 to go.")).toBeTruthy();
    expect(screen.queryByText(TEST_UNAVAILABLE_LINE)).toBeNull();
  });

  it("a V1 level without a Test explains why the Test is unavailable", () => {
    const noTest = { ...L1, items: L1.items.filter((item) => item.kind !== "test") };
    render(<LevelDetailPanel level={noTest} completed={ids(1, 1)} />);
    expect(screen.getByText(TEST_UNAVAILABLE_LINE)).toBeTruthy();
    expect(screen.getByText("The Test for this level isn't ready yet.")).toBeTruthy();
  });
});

describe("LevelDetailPanel Materi (5.7)", () => {
  it("puts the next Practice's Materi before its Start button, and opens it in a sheet", async () => {
    const { fondasi } = await import("@/content/levels/01-fondasi");
    render(<LevelDetailPanel level={fondasi} />);
    const trigger = screen.getByRole("button", { name: "Materi · 4 kartu, Practice 1" });
    const [start] = realButtons("Start Practice 1");
    expect(trigger.compareDocumentPosition(start) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Start never waits for the Materi.
    expect((start as HTMLButtonElement).disabled).toBe(false);

    await userEvent.click(trigger);
    const sheet = screen.getByRole("dialog", { name: "Materi Practice 1" });
    expect(within(sheet).getAllByRole("article")).toHaveLength(4);
    expect(within(sheet).getByRole("heading", { name: /Rumus dimulai dengan/ })).toBeTruthy();
    await userEvent.click(within(sheet).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps Materi on every practice row with content, done ones included", () => {
    render(<LevelDetailPanel level={L1} completed={ids(1, 2)} />);
    for (const n of [1, 2, 3, 4, 5]) {
      expect(screen.getAllByRole("button", { name: `Materi · 2 kartu, Practice ${n}` }), `P${n}`).toHaveLength(1);
    }
  });
});
