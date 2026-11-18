// @vitest-environment jsdom
import "@/test/dom";
import { render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  listGradedResults: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  }),
}));
const SUPABASE = { session: true };
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  unstable_rethrow: (error: unknown) => {
    if ((error as { url?: string })?.url) throw error;
  },
}));
vi.mock("@/adapters/supabase/auth", () => ({ getSessionUser: mocks.getSessionUser }));
vi.mock("@/adapters/supabase/server", () => ({ createClient: async () => SUPABASE }));
vi.mock("@/adapters/supabase/attempts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/adapters/supabase/attempts")>()),
  listGradedResults: mocks.listGradedResults,
}));

import { PRACTICE_64, PRACTICE_85, TEST_88 } from "@/core/grading/__fixtures__/results";
import { shellMessages } from "@/messages/id";
import { HistoryList, HistorySkeleton } from "./history-list";

const row = (id: string, result: unknown, extra: object = {}) => ({
  id,
  itemId: "L01-P1",
  status: "graded",
  result,
  startedAt: "2026-11-02T01:00:00+00:00",
  receivedAt: "2026-11-02T01:06:48+00:00",
  ...extra,
});

async function show() {
  return render((await HistoryList()) as ReactElement);
}

beforeEach(() => {
  mocks.getSessionUser.mockResolvedValue({ id: "user-1", email: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  mocks.getSessionUser.mockReset();
  mocks.listGradedResults.mockReset();
  mocks.redirect.mockClear();
});

describe("History list", () => {
  it("renders rows in order, each one link to its detail", async () => {
    mocks.listGradedResults.mockResolvedValue({
      ok: true,
      value: [
        row("c", PRACTICE_85),
        row("b", TEST_88, { itemId: "L99-T", status: "closed", receivedAt: null }),
        row("a", PRACTICE_64),
      ],
    });
    await show();
    const links = screen.getAllByRole("link");
    expect(links[0].getAttribute("aria-label")).toBe(
      `Level 1 · Practice 1, ${links[0].querySelector('[data-slot="history-date"]')!.textContent}, score 85/100, time 06:48`,
    );
    expect(screen.getByRole("link", { name: /^L99-T, .+, score 88\/100, time —$/ })).toBe(links[1]);
    expect(links[0].querySelector('[data-slot="history-time"]')!.textContent).toBe("06:48 time");
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/history/c", "/history/b", "/history/a"]);
    expect(within(links[0]).getByText("Level 1 · Practice 1")).toBeTruthy();
    expect(within(links[0]).getByText("85/100")).toBeTruthy();
    expect(within(links[0]).getByText("06:48")).toBeTruthy();
    expect(links[0].querySelector('[data-slot="history-date"]')!.textContent).toMatch(/2026/);
    expect(within(links[1]).getByText("L99-T")).toBeTruthy();
    expect(within(links[1]).getByText("88/100")).toBeTruthy();
    expect(within(links[1]).getByText("—")).toBeTruthy();
    expect(links[0].className).toContain("hover:bg-muted");
    expect(mocks.listGradedResults).toHaveBeenCalledWith(SUPABASE, "user-1");
  });

  it("leaves out rows whose Result is invalid", async () => {
    mocks.listGradedResults.mockResolvedValue({ ok: true, value: [row("bad", { version: 1 }), row("ok", PRACTICE_85)] });
    await show();
    expect(screen.getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["/history/ok"]);
  });

  it("shows one line and a Dashboard link when empty (incl. only invalid rows)", async () => {
    mocks.listGradedResults.mockResolvedValue({ ok: true, value: [row("bad", { version: 1 })] });
    await show();
    expect(screen.getByText(shellMessages.historyEmpty)).toBeTruthy();
    expect(screen.getByRole("link").getAttribute("href")).toBe("/dashboard");
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("shows the first-load alert with Try again when the read fails", async () => {
    mocks.listGradedResults.mockResolvedValue({ ok: false });
    await show();
    expect(screen.getByRole("alert").textContent).toBe(shellMessages.firstLoadFailed);
    expect(screen.getByRole("link", { name: "Try again" }).getAttribute("href")).toBe("/history");
  });

  it("shows the failure state and logs history.load_failed (not the adapter's event) when the session read throws", async () => {
    mocks.getSessionUser.mockRejectedValue(new TypeError("net"));
    await show();
    expect(screen.getByRole("alert").textContent).toBe(shellMessages.firstLoadFailed);
    const events = (console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((c) => JSON.parse(String(c[0])).event);
    expect(events).toEqual(["history.load_failed"]);
  });

  it("shows rows of other statuses never, even if the read returned them", async () => {
    mocks.listGradedResults.mockResolvedValue({ ok: true, value: [row("o", PRACTICE_85, { status: "received" }), row("ok", PRACTICE_85)] });
    await show();
    expect(screen.getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["/history/ok"]);
  });

  it("redirects to login with next=/history without a session", async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    await expect(HistoryList()).rejects.toMatchObject({ url: "/login?next=%2Fhistory" });
    expect(mocks.listGradedResults).not.toHaveBeenCalled();
  });

  it("has a hidden list-shaped Skeleton", () => {
    const { container } = render(<HistorySkeleton />);
    const skeleton = container.querySelector('[data-slot="history-skeleton"]')!;
    expect(skeleton.getAttribute("aria-hidden")).toBe("true");
    expect(skeleton.querySelectorAll(".bg-muted").length).toBeGreaterThan(1);
  });
});
