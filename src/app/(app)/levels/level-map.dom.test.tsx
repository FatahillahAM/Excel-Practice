// @vitest-environment jsdom
import "@/test/dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("./start-actions", () => ({ startAttempt: vi.fn(async () => ({ status: "idle" as const })) }));

import { FIXTURE_LEVELS } from "@/core/content/__fixtures__/levels";
import { bestScores, levelProgress, records, type GradedAttempt } from "@/core/progress";
import { SHEET_CLASS } from "./level-map-client";
import { LevelMapView, SIDE_TRACK_NAME } from "./level-map";
import { lockedReason } from "./level-panel";

let n = 0;
const at = (itemId: string, score = 90, seconds = 600): GradedAttempt => {
  n += 1;
  const start = Date.parse("2026-11-02T01:00:00Z") + n * 3_600_000;
  return { id: `a${n}`, itemId, score, startedAt: new Date(start).toISOString(), receivedAt: new Date(start + seconds * 1000).toISOString() };
};
const practices = (level: number, count = 5) => Array.from({ length: count }, (_, i) => at(`L0${level}-P${i + 1}`));
const passLevel = (level: number) => [...practices(level), at(`L0${level}-T`, 90)];

function show(attempts: GradedAttempt[]) {
  return render(
    <LevelMapView
      progress={levelProgress(attempts, FIXTURE_LEVELS)}
      modules={FIXTURE_LEVELS}
      records={records(attempts)}
      bestScores={bestScores(attempts)}
    />,
  );
}
const path = () => screen.getByRole("navigation", { name: "Level path" });
const nodeButtons = () => within(path()).getAllByRole("button");
const states = () => nodeButtons().map((button) => button.getAttribute("data-state"));
const openSheet = () => [...document.querySelectorAll<HTMLElement>("[data-sheet]")].filter((sheet) => !sheet.hidden);

describe("Level Map node states (fixture progress)", () => {
  it("new account: L1 active, L2–4 locked, L5–9, Ujian Akhir and the side track Under Construction", () => {
    show([]);
    expect(states()).toEqual([
      "active",
      "locked",
      "locked",
      "locked",
      ...Array(5).fill("under_construction"),
      "under_construction",
      "under_construction",
    ]);
    const buttons = nodeButtons();
    expect(buttons.filter((button) => button.hasAttribute("aria-current"))).toHaveLength(1);
    expect(buttons[0].getAttribute("aria-current")).toBe("step");
    expect(buttons[9].textContent).toContain("Ujian Akhir");
    // The side track comes last in tab order.
    expect(buttons[10].textContent).toContain(SIDE_TRACK_NAME);
    expect(buttons[10].closest('[data-slot="side-track"]')).not.toBeNull();
  });

  it("names nodes from their visible spans and describes a locked node by its reason", () => {
    show([]);
    expect(screen.getByRole("button", { name: "Level 1 Fixture 1 Active 0/5 practices done" })).toBeTruthy();
    const l3 = nodeButtons()[2];
    expect(document.getElementById(l3.getAttribute("aria-describedby")!)?.textContent).toBe("Pass Test Level 2 to unlock.");
    expect(l3.getAttribute("aria-current")).toBeNull();
  });

  it("Test L1 passed: L1 passed, L2 active with aria-current", () => {
    show(passLevel(1));
    expect(states().slice(0, 4)).toEqual(["passed", "active", "locked", "locked"]);
    expect(nodeButtons()[1].getAttribute("aria-current")).toBe("step");
    expect(nodeButtons().filter((button) => button.hasAttribute("aria-current"))).toHaveLength(1);
  });

  it("V1 complete: L1–4 passed, no aria-current, Level 4's panel open with the V1 end line", () => {
    show([1, 2, 3, 4].flatMap(passLevel));
    expect(states().slice(0, 4)).toEqual(["passed", "passed", "passed", "passed"]);
    expect(nodeButtons().some((button) => button.hasAttribute("aria-current"))).toBe(false);
    expect(openSheet()).toHaveLength(1);
    expect(within(openSheet()[0]).getByText("Level 4 complete — Level 5 is coming soon")).toBeTruthy();
  });
});

describe("Level Map panel", () => {
  it("opens on the active level by default, with Start one click away and focus left alone", () => {
    show(practices(1, 2));
    const [sheet] = openSheet();
    expect(sheet.getAttribute("data-sheet")).toBe("1");
    expect(within(sheet).getByText(/Level 1 · Active/)).toBeTruthy();
    expect(within(sheet).getAllByRole("button", { name: "Start Practice 3" }).length).toBeGreaterThan(0);
    expect(document.activeElement).toBe(document.body);
    expect(nodeButtons()[0].getAttribute("aria-expanded")).toBe("true");
  });

  it("5 practices done: Start Test, eyebrow Active", () => {
    show(practices(1));
    const [sheet] = openSheet();
    expect(within(sheet).getAllByRole("button", { name: "Start Test" }).length).toBeGreaterThan(0);
    expect(sheet.querySelector('[data-slot="panel-eyebrow"]')?.textContent).toBe("Level 1 · Active");
  });

  it("a locked node opens a read-only panel with the reason and no Start; focus goes to its heading", async () => {
    const user = userEvent.setup();
    show([]);
    await user.click(nodeButtons()[2]);
    const [sheet] = openSheet();
    expect(sheet.getAttribute("data-sheet")).toBe("3");
    expect(sheet.querySelector('[data-slot="panel-eyebrow"]')?.textContent).toBe("Level 3 · Locked");
    expect(within(sheet).getByText(lockedReason(3))).toBeTruthy();
    expect(lockedReason(3)).toBe("Pass Test Level 2 to unlock.");
    expect(within(sheet).queryByRole("button", { name: /Start|Practice again/ })).toBeNull();
    expect(document.activeElement).toBe(within(sheet).getByRole("heading", { level: 2 }));
  });

  it("an Under Construction node (L5, Ujian Akhir, side track) shows the Tag and no Start", async () => {
    const user = userEvent.setup();
    show([]);
    for (const index of [4, 9, 10]) {
      await user.click(nodeButtons()[index]);
      const [sheet] = openSheet();
      expect(sheet.querySelector('[data-slot="under-construction-tag"]')?.textContent).toBe("Under Construction");
      expect(within(sheet).queryByRole("button", { name: /Start|Practice again/ })).toBeNull();
    }
  });

  it("Enter on a node opens it; Close and Escape return focus to the node", async () => {
    const user = userEvent.setup();
    show([]);
    const l2 = nodeButtons()[1];
    l2.focus();
    await user.keyboard("{Enter}");
    expect(openSheet()[0].getAttribute("data-sheet")).toBe("2");
    expect(document.activeElement?.tagName).toBe("H2");
    await user.click(within(openSheet()[0]).getByRole("button", { name: "Close" }));
    expect(openSheet()).toHaveLength(0);
    expect(document.activeElement).toBe(l2);
    expect(l2.getAttribute("aria-expanded")).toBe("false");

    const l5 = nodeButtons()[4];
    await user.click(l5);
    await user.keyboard("{Escape}");
    expect(openSheet()).toHaveLength(0);
    expect(document.activeElement).toBe(l5);
  });

  it("shows best score and record time per row", () => {
    const attempts = [at("L01-P1", 70, 754), at("L01-P1", 95, 900), at("L01-P2", 80, 65)];
    show(attempts);
    const [sheet] = openSheet();
    const rows = within(sheet).getAllByRole("row").slice(1);
    const cells = (row: HTMLElement) => [...row.querySelectorAll("td")].slice(1).map((td) => td.textContent);
    expect(cells(rows[0])).toEqual(["95", "12:34"]);
    expect(cells(rows[1])).toEqual(["80", "01:05"]);
    expect(cells(rows[2])).toEqual(["—", "—"]);
    expect(cells(rows[5])).toEqual(["—", "—"]);
  });

  it("on a phone the panel is a bottom sheet (coarse pointer below lg), with a Close button", () => {
    show([]);
    const [sheet] = openSheet();
    expect(sheet.className).toBe(SHEET_CLASS);
    for (const part of ["fixed", "inset-x-0", "bottom-0", "max-h-[85dvh]", "overflow-y-auto"]) {
      expect(sheet.className).toContain(`[@media(pointer:coarse)_and_(max-width:1023px)]:${part}`);
    }
    expect(sheet.className).toContain("lg:sticky");
    expect(within(sheet).getByRole("button", { name: "Close" })).toBeTruthy();
  });
});
