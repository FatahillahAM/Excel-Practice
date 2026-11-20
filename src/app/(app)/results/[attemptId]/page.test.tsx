import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findItem: vi.fn(),
  realFindItem: (() => null) as (itemId: string) => unknown,
  getSessionUser: vi.fn(),
  readResult: vi.fn(),
  listProgressAttempts: vi.fn(),
  notFound: vi.fn(() => {
    throw Object.assign(new Error("NEXT_HTTP_ERROR_FALLBACK;404"), { notFound: true });
  }),
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  }),
}));
const SUPABASE = { session: true };
vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
  unstable_rethrow: (error: unknown) => {
    if ((error as { url?: string })?.url || (error as { notFound?: boolean })?.notFound) throw error;
  },
}));
vi.mock("@/adapters/supabase/auth", () => ({ getSessionUser: mocks.getSessionUser }));
vi.mock("@/adapters/supabase/server", () => ({ createClient: async () => SUPABASE }));
vi.mock("@/adapters/supabase/attempts", () => ({ readResult: mocks.readResult, listProgressAttempts: mocks.listProgressAttempts }));
vi.mock("@/content/levels", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/content/levels")>();
  mocks.realFindItem = actual.findItem;
  return { ...actual, findItem: (itemId: string) => mocks.findItem(itemId) };
});

import { PRACTICE_64, PRACTICE_85, TEST_72, TEST_88 } from "@/core/grading/__fixtures__/results";
import { shellMessages } from "@/messages/id";
import ResultsPage, { generateMetadata } from "./page";

const ID = "0b9e0d6c-3f1a-4c2e-9d55-8a7b6c5d4e3f";
const RESULT = {
  version: 1,
  contentVersion: 1,
  scenarioId: "baut-sinar-presisi",
  hintsUsed: 0,
  hintPenalty: 0,
  pointsEarned: 75,
  score: 75,
  correctCount: 3,
  questionCount: 4,
  questions: [
    { number: 1, points: 20, pointsAwarded: 20, correct: true, reasonText: null, tip: null },
    { number: 2, points: 25, pointsAwarded: 0, correct: false, reasonText: "Sel I3 berisi nilai yang diketik, bukan rumus.", tip: null },
    { number: 3, points: 25, pointsAwarded: 25, correct: true, reasonText: null, tip: null },
    { number: 4, points: 30, pointsAwarded: 30, correct: true, reasonText: null, tip: null },
  ],
};

/** Renders the page's streamed part (the async component inside Suspense) to HTML. */
async function render(): Promise<string> {
  const page = ResultsPage({ params: Promise.resolve({ attemptId: ID }) }) as ReactElement<{ children: ReactElement }>;
  const suspense = page.props.children as ReactElement<{ children: ReactElement }>;
  const results = suspense.props.children as ReactElement<object>;
  const Component = results.type as (props: object) => Promise<ReactElement>;
  return renderToStaticMarkup(await Component(results.props));
}

const STARTED = "2026-11-02T01:00:00+00:00";
const RECEIVED = "2026-11-02T01:06:48+00:00";
const stored = (result: unknown, itemId = "L01-P1", receivedAt: string | null = RECEIVED) => ({
  ok: true,
  value: { itemId, result, startedAt: STARTED, receivedAt },
});
const title = async () => (await generateMetadata({ params: Promise.resolve({ attemptId: ID }) })).title;

let errors: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  mocks.getSessionUser.mockResolvedValue({ id: "user-1", email: null });
  mocks.findItem.mockImplementation(mocks.realFindItem);
  mocks.listProgressAttempts.mockResolvedValue({ ok: true, value: [] });
  errors = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  mocks.getSessionUser.mockReset();
  mocks.readResult.mockReset();
  mocks.listProgressAttempts.mockReset();
  mocks.notFound.mockClear();
  mocks.redirect.mockClear();
});

describe("Results page", () => {
  it("shows the outcome heading, the level label, the deduction, x of y correct and the time", async () => {
    mocks.readResult.mockResolvedValue(stored(PRACTICE_85));
    const html = await render();
    expect(html).toMatch(/<h1[^>]*id="results-heading"[^>]*tabindex="-1"[^>]*>Practice 1 — 85\/100<\/h1>/);
    expect(html).toContain('Level 1 — <span lang="id">Fondasi</span>');
    expect(html).toMatch(/Hint ×3<\/span> <span[^>]*>−15<\/span>/);
    expect(html).toMatch(/>4<\/span> <span[^>]*>of 4 correct<\/span>/);
    expect(html).toMatch(/>06:48<\/span> <span[^>]*>time<\/span>/);
    expect(html).toContain('data-variant="pass"');
    expect(html).toContain('data-mode="live"');
    expect(html).toContain(">Semua benar!</p>");
    expect(html.match(/data-slot="tips-card"/g)).toHaveLength(4);
    expect(html).toContain("Tip 1 of 4");
    expect(html).toMatch(/<a [^>]*href="\/dashboard"[^>]*>Back to Dashboard<\/a>/);
    expect(mocks.readResult).toHaveBeenCalledWith(SUPABASE, ID);
  });

  it("shows New record when this attempt beats every earlier one of the item (shared progress read)", async () => {
    mocks.readResult.mockResolvedValue(stored(PRACTICE_64));
    const earlier = { id: "older", itemId: "L01-P1", result: PRACTICE_64, startedAt: "2026-11-01T01:00:00+00:00", receivedAt: "2026-11-01T01:10:00+00:00" };
    const self = { id: ID, itemId: "L01-P1", result: PRACTICE_64, startedAt: STARTED, receivedAt: RECEIVED };
    mocks.listProgressAttempts.mockResolvedValue({ ok: true, value: [earlier, self] });
    expect(await render()).toMatch(/data-slot="new-record"[^>]*>New record<\/span>/);
    expect(mocks.listProgressAttempts).toHaveBeenCalledWith(SUPABASE, "user-1");
  });

  it("no New record for the first attempt, and none (Results still render) when the progress read fails", async () => {
    mocks.readResult.mockResolvedValue(stored(PRACTICE_64));
    mocks.listProgressAttempts.mockResolvedValue({ ok: true, value: [{ id: ID, itemId: "L01-P1", result: PRACTICE_64, startedAt: STARTED, receivedAt: RECEIVED }] });
    expect(await render()).not.toContain("New record");
    mocks.listProgressAttempts.mockResolvedValue({ ok: false });
    const html = await render();
    expect(html).not.toContain("New record");
    expect(html).toContain("Practice 1 — 64/100");
  });

  it("lists the wrong answers with their reasons and a See tip anchor", async () => {
    mocks.readResult.mockResolvedValue(stored(PRACTICE_64));
    const html = await render();
    expect(html).toMatch(/<h1[^>]*>Practice 1 — 64\/100<\/h1>/);
    expect(html).toContain('data-variant="calm"');
    expect(html.match(/data-slot="wrong-answer-row"/g)).toHaveLength(2);
    expect(html).toContain(PRACTICE_64.questions[1].reasonText);
    expect(html).toMatch(/<a [^>]*href="#tip-2"[^>]*>See tip<\/a>/);
    expect(html).toContain('id="tip-2"');
    expect(html).not.toContain("Semua benar!");
    expect(html).toContain("No hints");
  });

  it("renders a legacy Result without Tips, and hides the time without received_at", async () => {
    mocks.readResult.mockResolvedValue(stored(RESULT, "L01-P1", null));
    const html = await render();
    expect(html).toMatch(/<h1[^>]*>Practice 1 — 75\/100<\/h1>/);
    expect(html).toMatch(/>3<\/span> <span[^>]*>of 4 correct<\/span>/);
    expect(html).not.toContain('data-slot="time"');
    expect(html).not.toContain("See tip");
    expect(html).not.toContain('aria-roledescription="carousel"');
  });

  it("shows a Test with the Test heading, label and document title", async () => {
    const real = mocks.realFindItem("L01-P1") as { level: object; item: object };
    mocks.findItem.mockReturnValue({ level: real.level, item: { ...real.item, id: "L01-T", kind: "test", number: 1 } });
    mocks.readResult.mockResolvedValue(stored(TEST_88, "L01-T"));
    const passed = await render();
    expect(passed).toMatch(/<h1[^>]*>Test passed — 88\/100<\/h1>/);
    expect(passed).toContain('Test · Level 1 — <span lang="id">Fondasi</span>');
    expect(passed).toContain('data-kind="test"');
    expect(await title()).toBe("Test passed — 88/100 · WORKING HARD with EXCEL");
    expect(mocks.findItem).toHaveBeenCalledWith("L01-T");

    mocks.readResult.mockResolvedValue(stored(TEST_72, "L01-T"));
    expect(await render()).toMatch(/<h1[^>]*>Test not passed — 72\/100, needs 80<\/h1>/);
    expect(await title()).toBe("Test not passed — 72/100, needs 80 · WORKING HARD with EXCEL");
  });

  it("server-renders the static frame for a ≥ 80 Result: no motion trigger and no fire", async () => {
    mocks.readResult.mockResolvedValue(stored(PRACTICE_85));
    const practice = await render();
    expect(practice).toContain('data-glow="true"');
    expect(practice).not.toContain("data-animate");
    expect(practice).not.toContain("data-scene");
    expect(practice).not.toContain("fire-effect");

    const real = mocks.realFindItem("L01-P1") as { level: object; item: object };
    mocks.findItem.mockReturnValue({ level: real.level, item: { ...real.item, id: "L01-T", kind: "test", number: 1 } });
    mocks.readResult.mockResolvedValue(stored(TEST_88, "L01-T"));
    const test = await render();
    expect(test).not.toContain("data-animate");
    expect(test).not.toContain("data-scene");
    expect(test).not.toContain("fire-effect");
    expect(test).not.toContain("fire-tint");
    expect(test).not.toContain("score-badge-back");
  });

  it("labels an item the registry does not know by its id", async () => {
    mocks.readResult.mockResolvedValue(stored(PRACTICE_85, "L09-P9"));
    const html = await render();
    expect(html).toMatch(/<h1[^>]*>L09-P9 — 85\/100<\/h1>/);
    expect(html).toMatch(/data-slot="level-label"[^>]*>L09-P9<\/p>/);
  });

  it("is notFound without a stored Result (another user's attempt, not graded, or graded by SQL)", async () => {
    mocks.readResult.mockResolvedValue({ ok: true, value: null });
    await expect(render()).rejects.toMatchObject({ notFound: true });
  });

  it("shows the first-load alert and logs results.load_failed for a Result that fails resultSchema", async () => {
    mocks.readResult.mockResolvedValue(stored({ ...RESULT, score: 100 }));
    const html = await render();
    expect(html).toContain('role="alert"');
    expect(html).toMatch(/<h1[^>]*id="results-heading"[^>]*tabindex="-1"[^>]*>Results<\/h1>/);
    expect(html).toContain(shellMessages.firstLoadFailed);
    expect(html).toContain(`href="/results/${ID}"`);
    expect(html).not.toContain("/100");
    expect(errors).toHaveBeenCalledWith(JSON.stringify({ event: "results.load_failed", attemptId: ID, code: "result_invalid" }));
  });

  it("shows the first-load alert when the read fails", async () => {
    mocks.readResult.mockResolvedValue({ ok: false });
    expect(await render()).toContain(shellMessages.firstLoadFailed);
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it("sends a visitor without a session to Login, back to these Results", async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    await expect(render()).rejects.toMatchObject({ url: `/login?next=${encodeURIComponent(`/results/${ID}`)}` });
    expect(mocks.readResult).not.toHaveBeenCalled();
  });

  describe("document title", () => {
    it("carries the outcome once the Result is read", async () => {
      mocks.readResult.mockResolvedValue(stored(PRACTICE_85));
      expect(await title()).toBe("Practice 1 — 85/100 · WORKING HARD with EXCEL");
      mocks.readResult.mockResolvedValue(stored(PRACTICE_85, "L09-P9"));
      expect(await title()).toBe("L09-P9 — 85/100 · WORKING HARD with EXCEL");
    });

    it("is Results, not indexed, for a failed read, an invalid Result and no Result", async () => {
      mocks.readResult.mockResolvedValue({ ok: false });
      expect(await generateMetadata({ params: Promise.resolve({ attemptId: ID }) })).toEqual({
        title: "Results · WORKING HARD with EXCEL",
        robots: { index: false },
      });
      mocks.readResult.mockResolvedValue(stored({ ...RESULT, score: 100 }));
      expect(await title()).toBe("Results · WORKING HARD with EXCEL");
      mocks.readResult.mockResolvedValue({ ok: true, value: null });
      expect(await title()).toBe("Results · WORKING HARD with EXCEL");
      expect(mocks.notFound).not.toHaveBeenCalled();
    });

    it("is Results without a session, and never redirects", async () => {
      mocks.getSessionUser.mockResolvedValue(null);
      expect(await title()).toBe("Results · WORKING HARD with EXCEL");
      expect(mocks.redirect).not.toHaveBeenCalled();
      expect(mocks.readResult).not.toHaveBeenCalled();
    });
  });
});
