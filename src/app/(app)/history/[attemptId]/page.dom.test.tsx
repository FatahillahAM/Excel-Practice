// @vitest-environment jsdom
import "@/test/dom";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findItem: vi.fn(),
  realFindItem: (() => null) as (itemId: string) => unknown,
  getSessionUser: vi.fn(),
  readResult: vi.fn(),
  listGradedResults: vi.fn(),
  notFound: vi.fn(() => {
    throw Object.assign(new Error("NEXT_HTTP_ERROR_FALLBACK;404"), { notFound: true });
  }),
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  }),
}));
vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
  useRouter: () => ({}),
  unstable_rethrow: (error: unknown) => {
    if ((error as { url?: string })?.url || (error as { notFound?: boolean })?.notFound) throw error;
  },
}));
vi.mock("@/adapters/supabase/auth", () => ({ getSessionUser: mocks.getSessionUser }));
vi.mock("@/adapters/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/adapters/supabase/attempts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/adapters/supabase/attempts")>()),
  readResult: mocks.readResult,
  listGradedResults: mocks.listGradedResults,
}));
vi.mock("@/content/levels", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/content/levels")>();
  mocks.realFindItem = actual.findItem;
  return { ...actual, findItem: (itemId: string) => mocks.findItem(itemId) };
});

import { markResultsCountUp } from "@/components/results/count-up-marker";
import { PRACTICE_85, TEST_88, V1_NO_TIPS } from "@/core/grading/__fixtures__/results";
import type { Result } from "@/core/grading";
import { shellMessages } from "@/messages/id";
import { surfaceTitle } from "@/components/shell/nav-items";
import ResultsPage from "../../results/[attemptId]/page";
import { HistoryList } from "../history-list";
import HistoryDetailPage, { generateMetadata } from "./page";

const ID = "0b9e0d6c-3f1a-4c2e-9d55-8a7b6c5d4e3f";
const stored = (result: unknown, itemId = "L01-P1", status = "graded") => ({
  ok: true,
  value: { itemId, status, result, startedAt: "2026-11-02T01:00:00+00:00", receivedAt: "2026-11-02T01:06:48+00:00" },
});

type El = ReactElement<{ children: ReactElement | ReactElement[] }>;
/** The streamed part (async component inside Suspense) of a page, awaited. */
async function streamed(page: El): Promise<ReactElement> {
  const children = ([] as ReactElement[]).concat(page.props.children as ReactElement[]);
  const suspense = children.find((c) => (c.props as { fallback?: unknown })?.fallback !== undefined) as El;
  const inner = suspense.props.children as ReactElement<object>;
  return (inner.type as (p: object) => Promise<ReactElement>)(inner.props);
}
const params = () => ({ params: Promise.resolve({ attemptId: ID }) });
const historyDetail = async () => streamed(HistoryDetailPage(params()) as El);
const liveResults = async () => streamed(ResultsPage(params()) as El);

/** The Result text both screens must share: heading, counts, deduction, reasons, Tips. */
function contentOf(root: ParentNode) {
  const text = (sel: string) => Array.from(root.querySelectorAll(sel)).map((n) => n.textContent);
  return {
    heading: text("h1"),
    score: text('[data-slot="score-badge-score"]'),
    correct: text('[data-slot="correct-count"]'),
    deduction: text('[data-slot="deduction"]'),
    reasons: text('[data-slot="wrong-answer-row"]'),
    tips: text('[data-slot="tips-card"]'),
  };
}

beforeEach(() => {
  mocks.getSessionUser.mockResolvedValue({ id: "user-1", email: null });
  mocks.findItem.mockImplementation(mocks.realFindItem);
  vi.spyOn(console, "error").mockImplementation(() => {});
  window.sessionStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
  mocks.getSessionUser.mockReset();
  mocks.readResult.mockReset();
  mocks.listGradedResults.mockReset();
  mocks.findItem.mockReset();
  mocks.notFound.mockClear();
  mocks.redirect.mockClear();
});

describe("History detail", () => {
  it.each([
    ["PRACTICE_85", PRACTICE_85, "L01-P1", 85],
    ["TEST_88", TEST_88, "L01-T", 88],
    ["V1_NO_TIPS", V1_NO_TIPS, "L01-P1", V1_NO_TIPS.score],
  ] as [string, Result, string, number][])("%s: same content as live Results, static, no motion", async (_n, result, itemId, score) => {
    if (itemId === "L01-T") {
      mocks.findItem.mockImplementation(() => ({
        level: { number: 1, name: "Fondasi" },
        item: { id: "L01-T", kind: "test", number: 6 },
      }));
    }
    mocks.readResult.mockResolvedValue(stored(result, itemId));
    // The live page's markup for the same stored Result.
    const live = document.createElement("div");
    live.innerHTML = renderToStaticMarkup(await liveResults());

    // Even a leftover marker for this path must not start a count on History.
    markResultsCountUp(`/history/${ID}`);
    const before = document.activeElement;
    const { container } = render(await historyDetail());

    expect(contentOf(container)).toEqual(contentOf(live));
    expect(container.querySelector('[data-slot="score-badge-score"]')!.textContent).toBe(String(score));
    expect(container.querySelector('[data-slot="results"]')!.getAttribute("data-mode")).toBe("static");
    const badge = container.querySelector<HTMLElement>('[data-slot="score-badge"]')!;
    expect(badge.dataset.animate).toBeUndefined();
    expect(badge.dataset.count).toBeUndefined();
    expect(badge.dataset.glow).toBe("false");
    expect(container.querySelector("[data-fire]")).toBeNull();
    expect(document.activeElement).toBe(before);
    expect(document.activeElement?.tagName).not.toBe("H1");
  });

  it("has Back to History and the outcome as title", async () => {
    mocks.readResult.mockResolvedValue(stored(PRACTICE_85));
    const page = HistoryDetailPage(params()) as El;
    const html = renderToStaticMarkup(([] as ReactElement[]).concat(page.props.children as ReactElement[])[0]);
    expect(html).toMatch(/<a [^>]*href="\/history"[^>]*>Back to History<\/a>/);
    expect(String((await generateMetadata(params())).title)).toContain("Practice 1 — 85/100");
  });

  it("is 404 when there is no Result for the user (not theirs, none, bad id)", async () => {
    mocks.readResult.mockResolvedValue({ ok: true, value: null });
    await expect(historyDetail()).rejects.toMatchObject({ notFound: true });
    expect(mocks.notFound).toHaveBeenCalled();
  });

  it("redirects to login with next to the History detail without a session", async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    await expect(historyDetail()).rejects.toMatchObject({ url: `/login?next=${encodeURIComponent(`/history/${ID}`)}` });
    expect(mocks.readResult).not.toHaveBeenCalled();
  });

  it.each([
    ["an invalid Result", () => stored({ version: 1 })],
    ["status received", () => stored(PRACTICE_85, "L01-P1", "received")],
    ["status grading_failed", () => stored(PRACTICE_85, "L01-P1", "grading_failed")],
    ["status abandoned", () => stored(PRACTICE_85, "L01-P1", "abandoned")],
  ])("is 404 for what the list would not show: %s", async (_n, value) => {
    mocks.readResult.mockResolvedValue(value());
    await expect(historyDetail()).rejects.toMatchObject({ notFound: true });
    expect(String((await generateMetadata(params())).title)).toMatch(/^History/);
  });

  it("opens a closed attempt", async () => {
    mocks.readResult.mockResolvedValue(stored(PRACTICE_85, "L01-P1", "closed"));
    const { container } = render(await historyDetail());
    expect(container.querySelector('[data-slot="results"]')!.getAttribute("data-mode")).toBe("static");
  });

  it("shows the first-load alert under History when the read fails, Try again here, focus kept", async () => {
    mocks.readResult.mockResolvedValue({ ok: false });
    const before = document.activeElement;
    const { getByRole } = render(await historyDetail());
    expect(getByRole("heading", { level: 1 }).textContent).toBe("History");
    expect(getByRole("alert").textContent).toBe(shellMessages.firstLoadFailed);
    expect(getByRole("link", { name: "Try again" }).getAttribute("href")).toBe(`/history/${ID}`);
    expect(document.activeElement).toBe(before);
    expect((await generateMetadata(params())).title).toBe(surfaceTitle("History"));
  });

  it("a list row's href opens the same attempt in the detail page", async () => {
    mocks.listGradedResults.mockResolvedValue({
      ok: true,
      value: [{ id: ID, itemId: "L01-P1", status: "graded", result: PRACTICE_85, startedAt: stored(PRACTICE_85).value.startedAt, receivedAt: stored(PRACTICE_85).value.receivedAt }],
    });
    mocks.readResult.mockResolvedValue(stored(PRACTICE_85));
    const list = render((await HistoryList()) as ReactElement);
    const href = list.getByRole("link").getAttribute("href")!;
    list.unmount();
    const attemptId = decodeURIComponent(href.replace(/^\/history\//, ""));
    const page = HistoryDetailPage({ params: Promise.resolve({ attemptId }) }) as El;
    const { container } = render(await streamed(page));
    expect(mocks.readResult).toHaveBeenCalledWith(expect.anything(), ID);
    expect(container.querySelector('[data-slot="score-badge-score"]')!.textContent).toBe("85");
    expect(container.querySelector("h1")!.textContent).toBe("Practice 1 — 85/100");
  });
});
