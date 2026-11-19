// @vitest-environment jsdom
import "@/test/dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  listResultsForTips: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  unstable_rethrow: (error: unknown) => {
    if ((error as { url?: string })?.url) throw error;
  },
}));
vi.mock("@/adapters/supabase/auth", () => ({ getSessionUser: mocks.getSessionUser }));
vi.mock("@/adapters/supabase/server", () => ({ createClient: async () => ({ session: true }) }));
vi.mock("@/adapters/supabase/attempts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/adapters/supabase/attempts")>()),
  listResultsForTips: mocks.listResultsForTips,
}));

import { PARTIAL_TIPS, PRACTICE_85, V1_NO_TIPS } from "@/core/grading/__fixtures__/results";
import { shellMessages } from "@/messages/id";
import { TipsList, TipsSkeleton } from "./tips-list";

const row = (id: string, result: unknown, extra: object = {}) => ({ id, itemId: "L01-P1", result, startedAt: "2026-11-02T01:00:00+00:00", ...extra });
const CHANGED = {
  ...PRACTICE_85,
  questions: PRACTICE_85.questions.map((q, i) => (i === 0 && q.tip ? { ...q, tip: { ...q.tip, id: "l99-lain", title: "Jumlahkan dengan SUM" } } : q)),
};

async function show() {
  return render((await TipsList()) as ReactElement);
}
const titles = () => screen.queryAllByRole("heading", { level: 3 }).map((h) => h.textContent);

beforeEach(() => {
  mocks.getSessionUser.mockResolvedValue({ id: "user-1", email: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  mocks.getSessionUser.mockReset();
  mocks.listResultsForTips.mockReset();
  mocks.redirect.mockClear();
});

describe("Tips & Tricks", () => {
  it("renders each Tip once from overlapping Results, with its level and no Soal line", async () => {
    mocks.listResultsForTips.mockResolvedValue({
      ok: true,
      value: [row("b", PRACTICE_85, { startedAt: "2026-11-03T01:00:00+00:00" }), row("a", PARTIAL_TIPS), row("v1", V1_NO_TIPS)],
    });
    await show();
    expect(titles()).toHaveLength(4);
    expect(new Set(titles()).size).toBe(4);
    expect(screen.getByText("4 tips").getAttribute("aria-live")).toBe("polite");
    const cards = screen.getAllByRole("listitem").filter((li) => li.querySelector('[data-slot="tips-card"]'));
    expect(within(cards[0]).getByText("Level 1")).toBeTruthy();
    expect(screen.queryByText(/Soal/)).toBeNull();
    expect(screen.getByRole("option", { name: "All levels" })).toBeTruthy();
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["All levels", "Level 1"]);
  });

  it("drops an invalid Result and logs it; an unknown item has no level tag", async () => {
    mocks.listResultsForTips.mockResolvedValue({ ok: true, value: [row("bad", { version: 9 }), row("x", PRACTICE_85, { itemId: "L77-P1" })] });
    await show();
    expect(titles()).toHaveLength(4);
    expect(screen.queryByText("Level 1")).toBeNull();
    expect(vi.mocked(console.error).mock.calls.map((c) => JSON.parse(c[0] as string))).toEqual([{ event: "tips.result_invalid", attemptId: "bad" }]);
  });

  it("narrows by level and search (case-insensitive), and Clear filters restores", async () => {
    mocks.listResultsForTips.mockResolvedValue({ ok: true, value: [row("b", PRACTICE_85), row("c", CHANGED, { itemId: "L77-P1", startedAt: "2026-11-01T00:00:00Z" })] });
    await show();
    expect(titles()).toHaveLength(5);
    fireEvent.change(screen.getByLabelText("Level"), { target: { value: "1" } });
    expect(titles()).toHaveLength(4);
    fireEvent.change(screen.getByLabelText("Search tips"), { target: { value: "  CTRL+D " } });
    expect(titles()).toEqual(["Isi rumus ke bawah sekaligus"]);
    fireEvent.change(screen.getByLabelText("Search tips"), { target: { value: "sum" } });
    expect(titles()).toEqual([]);
    expect(screen.getByText(shellMessages.tipsNoMatch(1, "sum"))).toBeTruthy();
    expect(screen.getByText("0 tips")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(titles()).toHaveLength(5);
    expect((screen.getByLabelText("Search tips") as HTMLInputElement).value).toBe("");
  });

  it("uses the newer row's content when two rows share a Tip id", async () => {
    const tipOf = (title: string) => ({
      ...PRACTICE_85,
      questions: PRACTICE_85.questions.map((q, i) => ({ ...q, tip: i === 0 && q.tip ? { ...q.tip, id: "kunci-sel", title } : null })),
    });
    mocks.listResultsForTips.mockResolvedValue({
      ok: true,
      value: [row("new", tipOf("Isi B"), { startedAt: "2026-11-03T01:00:00+00:00" }), row("old", tipOf("Isi A"))],
    });
    await show();
    expect(titles()).toEqual(["Isi B"]);
  });

  it("offers only All levels when every card's item is unknown, and still shows the cards", async () => {
    mocks.listResultsForTips.mockResolvedValue({ ok: true, value: [row("x", PRACTICE_85, { itemId: "L77-P1" })] });
    await show();
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["All levels"]);
    expect(titles()).toHaveLength(4);
  });

  it("shows the search-only no-match line", async () => {
    mocks.listResultsForTips.mockResolvedValue({ ok: true, value: [row("b", PRACTICE_85)] });
    await show();
    fireEvent.change(screen.getByLabelText("Search tips"), { target: { value: "xyz" } });
    expect(screen.getByText(shellMessages.tipsNoMatch(null, "xyz")).textContent).toBe(shellMessages.tipsNoMatch(null, "xyz"));
  });

  it("shows the empty line when there are no rows at all", async () => {
    mocks.listResultsForTips.mockResolvedValue({ ok: true, value: [] });
    await show();
    expect(screen.getByText(shellMessages.tipsEmpty)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Go to Dashboard" }).getAttribute("href")).toBe("/dashboard");
  });

  it("shows the empty line with a Dashboard link and no filter controls", async () => {
    mocks.listResultsForTips.mockResolvedValue({ ok: true, value: [row("v1", V1_NO_TIPS)] });
    await show();
    expect(screen.getByText(shellMessages.tipsEmpty)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Go to Dashboard" }).getAttribute("href")).toBe("/dashboard");
    expect(screen.queryByLabelText("Level")).toBeNull();
    expect(screen.queryByLabelText("Search tips")).toBeNull();
  });

  it("shows the first-load alert with Try again when the read fails", async () => {
    mocks.listResultsForTips.mockResolvedValue({ ok: false });
    await show();
    expect(screen.getByRole("alert").textContent).toBe(shellMessages.firstLoadFailed);
    expect(screen.getByRole("link", { name: "Try again" }).getAttribute("href")).toBe("/tips");
  });

  it("sends a visitor without a session to login with next=/tips", async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    await expect(TipsList()).rejects.toMatchObject({ url: expect.stringContaining("next=%2Ftips") });
  });

  it("renders a card-grid skeleton hidden from assistive tech", () => {
    const { container } = render(<TipsSkeleton />);
    expect(container.querySelector('[data-slot="tips-skeleton"]')!.getAttribute("aria-hidden")).toBe("true");
  });
});
