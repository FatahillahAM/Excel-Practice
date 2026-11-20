// @vitest-environment jsdom
import "@/test/dom";
import { render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadRecords: vi.fn(),
  loadOpenAttempt: vi.fn(),
  startAttempt: vi.fn(async () => ({ status: "idle" as const })),
}));
vi.mock("../progress", () => ({ loadRecords: mocks.loadRecords }));
vi.mock("../open-attempt", () => ({ loadOpenAttempt: mocks.loadOpenAttempt }));
vi.mock("../levels/start-actions", () => ({ startAttempt: mocks.startAttempt }));

import { FIXTURE_LEVELS } from "@/core/content/__fixtures__/levels";
import { levelProgress, records, type GradedAttempt } from "@/core/progress";
import { shellMessages } from "@/messages/id";
import { BLOCKED_MESSAGE } from "../levels/start-lock";
import { OPEN_ATTEMPT_UNKNOWN, RecordsList, RecordsSkeleton, RecordsView } from "./records-list";

const at = (id: string, itemId: string, seconds: number, day = 0, score = 85): GradedAttempt => {
  const start = Date.parse("2026-11-02T01:00:00Z") + day * 86_400_000;
  return { id, itemId, score, startedAt: new Date(start).toISOString(), receivedAt: new Date(start + seconds * 1000).toISOString() };
};
const practices = (level: number) => [1, 2, 3, 4, 5].map((n) => at(`p${level}${n}`, `L0${level}-P${n}`, 300 + n));

function show(attempts: GradedAttempt[], startLock?: { reason: string; attemptId?: string }) {
  return render(
    <RecordsView records={records(attempts)} progress={levelProgress(attempts, FIXTURE_LEVELS)} modules={FIXTURE_LEVELS} startLock={startLock} />,
  );
}
const rows = () => Array.from(document.querySelectorAll<HTMLElement>('[data-slot="record-row"]'));
const real = (row: HTMLElement) => within(row).queryAllByRole("button").filter((b) => b.closest("form") !== null);

afterEach(() => {
  mocks.loadRecords.mockReset();
  mocks.loadOpenAttempt.mockReset();
});

describe("RecordsView", () => {
  it("one row per item with its best time, date and score, in curriculum order (P1–P5, then Test)", () => {
    show([at("t", "L01-T", 180, 2, 60), ...practices(1), at("again", "L01-P1", 200, 1, 70)]);
    expect(rows().map((row) => row.dataset.item)).toEqual(["L01-P1", "L01-P2", "L01-P3", "L01-P4", "L01-P5", "L01-T"]);
    const first = rows()[0];
    expect(within(first).getByText("Practice 1")).toBeTruthy();
    expect(first.querySelector('[data-slot="record-time"]')!.textContent).toBe("03:20");
    expect(first.querySelector('[data-slot="record-score"]')!.textContent).toBe("70/100");
    expect(first.querySelector('[data-slot="record-date"]')!.textContent).toMatch(/2026/);
    // A failed Test still holds a record; its button retakes it.
    expect(rows()[5].querySelector('[data-slot="record-time"]')!.textContent).toBe("03:00");
    expect(real(rows()[5]).map((b) => b.textContent)).toEqual(["Try the Test again"]);
    expect(real(first).map((b) => b.textContent)).toEqual(["Practice again"]);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Level 1 — Fixture 1");
  });

  it("groups by level", () => {
    const passed = [...practices(1), at("t1", "L01-T", 400, 1, 90), at("l2", "L02-P1", 100, 2)];
    show(passed);
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Level 1 — Fixture 1", "Level 2 — Fixture 2"]);
    expect(real(rows().at(-1)!).map((b) => b.textContent)).toEqual(["Practice again"]);
  });

  it("locks Practice again while an attempt is in progress", () => {
    show([at("a", "L01-P1", 300)], { reason: BLOCKED_MESSAGE, attemptId: "open-1" });
    const [button] = real(rows()[0]);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText(BLOCKED_MESSAGE, { exact: false })).toBeTruthy();
  });

  it("no button where canStart refuses (a level that is locked)", () => {
    // L02-P1 attempted while Level 2 is still locked: the record shows, Start does not.
    show([at("x", "L02-P1", 120)]);
    expect(rows()).toHaveLength(1);
    expect(real(rows()[0])).toHaveLength(0);
  });

  it("formats the date in the given zone", () => {
    // Received 2 Nov 23:30 UTC: 3 Nov in Jakarta, 2 Nov in New York.
    const late = { id: "z", itemId: "L01-P1", score: 85, startedAt: "2026-11-02T23:25:00Z", receivedAt: "2026-11-02T23:30:00Z" };
    const date = (zone: string) => {
      const { unmount } = render(<RecordsView records={records([late])} progress={levelProgress([late], FIXTURE_LEVELS)} modules={FIXTURE_LEVELS} timeZone={zone} />);
      const text = document.querySelector('[data-slot="record-date"]')!.textContent;
      unmount();
      return text;
    };
    expect(date("Asia/Jakarta")).toMatch(/^3 /);
    expect(date("America/New_York")).toMatch(/^2 /);
    expect(date("Not/AZone")).toMatch(/^3 /);
  });

  it("empty: one line with a link to Dashboard", () => {
    show([]);
    const empty = document.querySelector('[data-slot="records-empty"]')!;
    expect(empty.textContent).toContain(shellMessages.recordsEmpty);
    expect(within(empty as HTMLElement).getByRole("link", { name: "Go to Dashboard" }).getAttribute("href")).toBe("/dashboard");
  });

  it("skeleton is decorative", () => {
    render(<RecordsSkeleton />);
    expect(document.querySelector('[data-slot="records-skeleton"]')!.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("RecordsList", () => {
  it("a failed read shows the first-load alert with Try again", async () => {
    mocks.loadRecords.mockResolvedValue("failed");
    mocks.loadOpenAttempt.mockResolvedValue(null);
    render((await RecordsList()) as ReactElement);
    expect(screen.getByRole("alert").textContent).toBe(shellMessages.firstLoadFailed);
    expect(screen.getByRole("link", { name: "Try again" }).getAttribute("href")).toBe("/records");
  });

  it("renders the loaded records", async () => {
    const attempts = [at("a", "L01-P1", 300)];
    mocks.loadRecords.mockResolvedValue({ records: records(attempts), progress: levelProgress(attempts, FIXTURE_LEVELS), timeZone: "Asia/Jakarta" });
    mocks.loadOpenAttempt.mockResolvedValue(null);
    render((await RecordsList()) as ReactElement);
    // The real registry: L01-P1 is in Level 1.
    expect(rows().map((row) => row.dataset.item)).toEqual(["L01-P1"]);
    expect(real(rows()[0])[0].getAttribute("aria-disabled")).toBeNull();
  });

  it("a failed open-attempt read locks Practice again (fail closed)", async () => {
    const attempts = [at("a", "L01-P1", 300)];
    mocks.loadRecords.mockResolvedValue({ records: records(attempts), progress: levelProgress(attempts, FIXTURE_LEVELS), timeZone: "Asia/Jakarta" });
    mocks.loadOpenAttempt.mockResolvedValue("failed");
    render((await RecordsList()) as ReactElement);
    expect(real(rows()[0])[0].getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText(OPEN_ATTEMPT_UNKNOWN)).toBeTruthy();
  });
});
