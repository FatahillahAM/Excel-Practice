import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  readResult: vi.fn(),
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
vi.mock("@/adapters/supabase/attempts", () => ({ readResult: mocks.readResult }));

import { shellMessages } from "@/messages/id";
import ResultsPage from "./page";

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

let errors: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  mocks.getSessionUser.mockResolvedValue({ id: "user-1", email: null });
  errors = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  mocks.getSessionUser.mockReset();
  mocks.readResult.mockReset();
  mocks.notFound.mockClear();
  mocks.redirect.mockClear();
});

describe("Results page", () => {
  it("shows the heading, the item, the score out of 100 and x of y correct", async () => {
    mocks.readResult.mockResolvedValue({ ok: true, value: { itemId: "L01-P1", result: RESULT } });
    const html = await render();
    expect(html).toMatch(/<h1[^>]*>Results<\/h1>/);
    expect(html).toContain("Level 1 · Practice 1");
    expect(html).toMatch(/75<span[^>]*>\/100<\/span>/);
    expect(html).toContain("3 of 4 correct");
    expect(html).toMatch(/<a [^>]*href="\/dashboard"[^>]*>Back to Dashboard<\/a>/);
    expect(mocks.readResult).toHaveBeenCalledWith(SUPABASE, ID);
  });

  it("is notFound without a stored Result (another user's attempt, not graded, or graded by SQL)", async () => {
    mocks.readResult.mockResolvedValue({ ok: true, value: null });
    await expect(render()).rejects.toMatchObject({ notFound: true });
  });

  it("shows the first-load alert and logs results.load_failed for a Result that fails resultSchema", async () => {
    mocks.readResult.mockResolvedValue({ ok: true, value: { itemId: "L01-P1", result: { ...RESULT, score: 100 } } });
    const html = await render();
    expect(html).toContain('role="alert"');
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
});
