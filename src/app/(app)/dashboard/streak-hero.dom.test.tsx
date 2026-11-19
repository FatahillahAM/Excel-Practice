// @vitest-environment jsdom
import "@/test/dom";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ loadStreak: vi.fn(), freezeToday: vi.fn(), router: { refresh: vi.fn() } }));
vi.mock("next/navigation", () => ({ unstable_rethrow: () => {}, useRouter: () => mocks.router }));
vi.mock("../progress", () => ({ loadStreak: mocks.loadStreak }));
vi.mock("./freeze-actions", () => ({ freezeToday: mocks.freezeToday }));

import type { DayState } from "@/core/progress";
import { shellMessages, streakMessages } from "@/messages/id";
import type { StreakView } from "../progress";
import { timeLeftLabel } from "./freeze-controls";
import { StreakHero, StreakHeroView } from "./streak-hero";

const WEEK: DayState[] = [
  { date: "2026-11-16", status: "done" },
  { date: "2026-11-17", status: "frozen" },
  { date: "2026-11-18", status: "done" },
  { date: "2026-11-19", status: "pending" },
  { date: "2026-11-20", status: "future" },
  { date: "2026-11-21", status: "future" },
  { date: "2026-11-22", status: "future" },
];

const view = (over: Partial<StreakView> = {}): StreakView => ({
  today: "2026-11-19",
  count: 3,
  todaySafe: false,
  frozenToday: false,
  msLeft: (4 * 60 + 30) * 60_000 + 59_000,
  week: WEEK,
  freezesLeft: 1,
  ...over,
});

const hero = () => screen.getByRole("region", { name: "Streak" });
const numeral = () => hero().querySelector('[data-slot="streak-numeral"]')!;
const useFreeze = () => screen.queryByRole("button", { name: "Use freeze" });

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  mocks.loadStreak.mockReset();
  mocks.freezeToday.mockReset();
  mocks.router.refresh.mockReset();
});

describe("Streak Hero", () => {
  it("safe: the numeral, Safe today, freezes left, no Use freeze and no risk pill", () => {
    render(<StreakHeroView view={view({ todaySafe: true, week: WEEK.map((d, i) => (i === 3 ? { ...d, status: "done" } : d)) })} />);
    expect(hero().getAttribute("data-state")).toBe("safe");
    expect(numeral().textContent).toContain("3");
    expect(numeral().className).not.toContain("saturate");
    expect(within(hero()).getByText("Safe today")).toBeTruthy();
    expect(within(hero()).getByText("1 of 2 freezes left")).toBeTruthy();
    expect(useFreeze()).toBeNull();
    expect(hero().querySelector('[data-slot="risk-pill"]')).toBeNull();
  });

  it("at risk: desaturated numeral, \"Xh Ym left\" (not a live region), Use freeze", () => {
    render(<StreakHeroView view={view()} />);
    expect(hero().getAttribute("data-state")).toBe("at_risk");
    expect(numeral().className).toContain("saturate");
    const risk = hero().querySelector('[data-slot="risk-pill"]')!;
    expect(risk.textContent).toContain("4h 30m left");
    expect(risk.closest("[aria-live],[role=status]")).toBeNull();
    const button = useFreeze()!;
    expect(button.getAttribute("type")).toBe("submit");
    expect(button.hasAttribute("aria-disabled")).toBe(false);
  });

  it("Week Strip: Monday → Sunday, each day named in full with its state", () => {
    render(<StreakHeroView view={view()} />);
    const days = within(screen.getByRole("list", { name: "This week" })).getAllByRole("listitem");
    expect(days.map((d) => d.textContent)).toEqual([
      "MMonday: practised",
      "TTuesday: frozen",
      "WWednesday: practised",
      "?Today: not yet",
      "FFriday: upcoming",
      "SSaturday: upcoming",
      "SSunday: upcoming",
    ]);
  });

  it("frozen today: Frozen today, no Use freeze, no risk pill", () => {
    render(<StreakHeroView view={view({ frozenToday: true, freezesLeft: 0 })} />);
    expect(hero().getAttribute("data-state")).toBe("frozen");
    expect(within(hero()).getByText("Frozen today")).toBeTruthy();
    expect(within(hero()).getByText("0 of 2 freezes left")).toBeTruthy();
    expect(useFreeze()).toBeNull();
    expect(hero().querySelector('[data-slot="risk-pill"]')).toBeNull();
  });

  it("zero: 0, no risk pill, Use freeze still offered but de-emphasised", () => {
    render(<StreakHeroView view={view({ count: 0, freezesLeft: 2 })} />);
    expect(hero().getAttribute("data-state")).toBe("zero");
    expect(numeral().textContent).toContain("0");
    expect(hero().querySelector('[data-slot="risk-pill"]')).toBeNull();
    expect(useFreeze()!.className).toContain("bg-transparent");
  });

  it("quota used: Use freeze aria-disabled, focusable, its reason in aria-describedby, posts nothing", () => {
    render(<StreakHeroView view={view({ freezesLeft: 0 })} />);
    const button = useFreeze()!;
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(button.getAttribute("type")).toBe("button");
    const reason = document.getElementById(button.getAttribute("aria-describedby")!)!;
    expect(reason.textContent).toContain(streakMessages.quotaUsed);
    button.click();
    expect(mocks.freezeToday).not.toHaveBeenCalled();
  });

  it("server part: renders the loaded view; a failed load shows the first-load message; no session renders nothing", async () => {
    mocks.loadStreak.mockResolvedValue(view({ count: 7, todaySafe: true }));
    const { unmount } = render((await StreakHero()) as ReactElement);
    expect(numeral().textContent).toContain("7");
    unmount();
    mocks.loadStreak.mockResolvedValue("failed");
    render((await StreakHero()) as ReactElement);
    expect(screen.getByRole("alert").textContent).toContain(shellMessages.firstLoadFailed);
    mocks.loadStreak.mockResolvedValue(null);
    expect(await StreakHero()).toBeNull();
  });

  it.each([
    ["safe", streakMessages.alreadySafe],
    ["quota_used", streakMessages.quotaUsed],
    ["day_changed", streakMessages.dayChanged],
  ] as const)("refused %s: the reason in an alert tied to the button", async (reason, text) => {
    mocks.freezeToday.mockResolvedValue({ status: "refused", reason });
    render(<StreakHeroView view={view()} />);
    await userEvent.setup().click(useFreeze()!);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(text);
    expect(useFreeze()!.getAttribute("aria-describedby")).toBe(alert.id);
    const sent = mocks.freezeToday.mock.calls[0][0] as FormData;
    expect(sent.get("expectedDate")).toBe("2026-11-19");
  });

  it("error: the failure message in the alert", async () => {
    mocks.freezeToday.mockResolvedValue({ status: "error" });
    render(<StreakHeroView view={view()} />);
    await userEvent.setup().click(useFreeze()!);
    expect((await screen.findByRole("alert")).textContent).toBe(streakMessages.freezeFailed);
  });

  it("pending: \"Freezing…\", disabled", async () => {
    let resolve!: (v: unknown) => void;
    mocks.freezeToday.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<StreakHeroView view={view()} />);
    await userEvent.setup().click(useFreeze()!);
    const button = await screen.findByRole("button", { name: "Freezing…" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    await act(async () => resolve({ status: "done" }));
    expect(useFreeze()).toBeTruthy();
  });

  it("countdown: ticks each minute, refreshes the page once at local midnight", async () => {
    vi.useFakeTimers();
    render(<StreakHeroView view={view({ msLeft: 2 * 60_000 + 30_000 })} />);
    const risk = () => hero().querySelector('[data-slot="risk-pill"]')!.textContent;
    expect(risk()).toBe("0h 2m left");
    await act(async () => void (await vi.advanceTimersByTimeAsync(60_000)));
    expect(risk()).toBe("0h 1m left");
    await act(async () => void (await vi.advanceTimersByTimeAsync(60_000)));
    expect(risk()).toBe("0h 0m left");
    expect(mocks.router.refresh).not.toHaveBeenCalled();
    await act(async () => void (await vi.advanceTimersByTimeAsync(30_000)));
    expect(mocks.router.refresh).toHaveBeenCalledTimes(1);
    await act(async () => void (await vi.advanceTimersByTimeAsync(5 * 60_000)));
    expect(mocks.router.refresh).toHaveBeenCalledTimes(1);
  });

  it("timeLeftLabel rounds down to the minute", () => {
    expect(timeLeftLabel(0)).toBe("0h 0m left");
    expect(timeLeftLabel(59_999)).toBe("0h 0m left");
    expect(timeLeftLabel(25 * 3_600_000)).toBe("25h 0m left");
  });
});
