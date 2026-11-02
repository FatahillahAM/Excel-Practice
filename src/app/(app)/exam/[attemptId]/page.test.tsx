import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  readAttempt: vi.fn(),
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
    if ((error as { url?: string; notFound?: boolean })?.url || (error as { notFound?: boolean })?.notFound) throw error;
  },
}));
vi.mock("../../../../adapters/supabase/auth", () => ({ getSessionUser: mocks.getSessionUser }));
vi.mock("../../../../adapters/supabase/server", () => ({ createClient: async () => SUPABASE }));
// The shell's title component resolves the `@/` alias, which Vitest does not; a plain <h1> stands in.
vi.mock("../../../../components/shell/page-title", () => ({
  PageTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
}));
vi.mock("../../../../adapters/supabase/attempts", () => ({ readAttempt: mocks.readAttempt }));

import { shellMessages } from "../../../../messages/id";
import ExamPage from "./page";

const ID = "0b9e0d6c-3f1a-4c2e-9d55-8a7b6c5d4e3f";
const ATTEMPT = {
  id: ID,
  itemId: "L01-P1",
  status: "open",
  templateVersion: 1,
  startedAt: "2026-11-02T01:00:00+00:00",
  receivedAt: null,
};

/** Renders the page's streamed part (the async component inside Suspense) to HTML. */
async function render(): Promise<string> {
  const page = ExamPage({ params: Promise.resolve({ attemptId: ID }) }) as ReactElement<{ children: ReactElement }>;
  const suspense = page.props.children as ReactElement<{ children: ReactElement }>;
  const exam = suspense.props.children as ReactElement<object>;
  const Component = exam.type as (props: object) => Promise<ReactElement>;
  return renderToStaticMarkup(await Component(exam.props));
}

beforeEach(() => {
  mocks.getSessionUser.mockResolvedValue({ id: "user-1", email: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  mocks.getSessionUser.mockReset();
  mocks.readAttempt.mockReset();
  mocks.notFound.mockClear();
  mocks.redirect.mockClear();
});

describe("Exam page", () => {
  it("titles a known item 'Level 1 · Practice 1' and shows the status line", async () => {
    mocks.readAttempt.mockResolvedValue({ ok: true, value: ATTEMPT });
    const html = await render();
    expect(html).toContain("Level 1 · Practice 1");
    expect(html).toContain("Excel is open — Practice 1");
    expect(html).toContain(`/exam/${ID}/download`);
    expect(mocks.readAttempt).toHaveBeenCalledWith(SUPABASE, ID);
  });

  it("is notFound for an attempt that is missing or not the user's", async () => {
    mocks.readAttempt.mockResolvedValue({ ok: true, value: null });
    await expect(render()).rejects.toMatchObject({ notFound: true });
    expect(mocks.notFound).toHaveBeenCalledTimes(1);
  });

  it("shows the first-load alert with Try again when the read fails", async () => {
    mocks.readAttempt.mockResolvedValue({ ok: false });
    const html = await render();
    expect(html).toContain('role="alert"');
    expect(html).toContain(shellMessages.firstLoadFailed);
    expect(html).toContain(`href="/exam/${ID}"`);
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it("sends a visitor without a session to Login, back to this exam", async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    await expect(render()).rejects.toMatchObject({ url: `/login?next=${encodeURIComponent(`/exam/${ID}`)}` });
    expect(mocks.readAttempt).not.toHaveBeenCalled();
  });
});
