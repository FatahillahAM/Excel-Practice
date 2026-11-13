import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  readAttempt: vi.fn(),
  hasValidResult: vi.fn(),
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
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  unstable_rethrow: (error: unknown) => {
    if ((error as { url?: string; notFound?: boolean })?.url || (error as { notFound?: boolean })?.notFound) throw error;
  },
}));
vi.mock("@/adapters/supabase/auth", () => ({ getSessionUser: mocks.getSessionUser }));
vi.mock("@/adapters/supabase/server", () => ({ createClient: async () => SUPABASE }));
vi.mock("@/adapters/supabase/attempts", () => ({ readAttempt: mocks.readAttempt, hasValidResult: mocks.hasValidResult }));

import { examMessages, shellMessages } from "@/messages/id";
import ExamPage from "./page";

const ID = "0b9e0d6c-3f1a-4c2e-9d55-8a7b6c5d4e3f";
const ATTEMPT = {
  id: ID,
  itemId: "L01-P1",
  status: "open",
  templateVersion: 1,
  startedAt: "2026-11-02T01:00:00+00:00",
  receivedAt: null,
  gradingRequestedAt: null,
};

/** The text inside every `role="status"` live region of the markup. */
function liveRegionText(html: string): string {
  const regions = [...html.matchAll(/<(span|div|p)[^>]*role="status"[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => m[2]);
  return regions.join("\n");
}

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
  vi.useRealTimers();
  vi.restoreAllMocks();
  mocks.getSessionUser.mockReset();
  mocks.readAttempt.mockReset();
  mocks.hasValidResult.mockReset();
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

  it("renders the server's time since Start (12:34) outside the live regions, with a decorative Orbit", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-02T01:12:34.600Z"));
    mocks.readAttempt.mockResolvedValue({ ok: true, value: ATTEMPT });
    const html = await render();
    expect(html).toContain("12:34");
    const live = liveRegionText(html);
    expect(live).toContain("Excel is open — Practice 1");
    expect(live).toContain(examMessages.finishHint);
    expect(live).not.toContain("12:34");
    expect(html).toMatch(/<svg[^>]*viewBox="0 0 100 100"[^>]*aria-hidden="true"/);
    // `useMotionPreference()` is "reduce" on the server: no pause button until hydration.
    expect(html).not.toContain("Pause animation");
    expect(html).not.toContain("Play animation");
  });

  it("titles the page for screen readers only and links the Setup Guide", async () => {
    mocks.readAttempt.mockResolvedValue({ ok: true, value: ATTEMPT });
    const html = await render();
    expect(html).toContain('<h1 class="sr-only">Level 1 · Practice 1, in progress</h1>');
    expect(html).toContain("Finish not working?");
    expect(html).toMatch(/<a [^>]*href="\/setup-guide"[^>]*>Setup Guide<\/a>/);
  });

  it("shows the slow-grading message for a file received 20 s ago, not 5 s ago", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-02T01:10:20.000Z"));
    const received = (receivedAt: string) => ({ ...ATTEMPT, status: "received", receivedAt });

    mocks.readAttempt.mockResolvedValue({ ok: true, value: received("2026-11-02T01:10:00+00:00") });
    let html = await render();
    expect(liveRegionText(html)).toContain("File received — grading…");
    expect(liveRegionText(html)).toContain(examMessages.gradingSlow);
    expect(html).not.toContain(examMessages.finishHint);
    expect(html).not.toContain("10:20");
    expect(html).toMatch(/<svg[^>]*viewBox="0 0 100 100"/);

    mocks.readAttempt.mockResolvedValue({ ok: true, value: received("2026-11-02T01:10:15+00:00") });
    html = await render();
    expect(html).toContain("File received — grading…");
    expect(html).not.toContain(examMessages.gradingSlow);
  });

  it("counts the slow-grading message from grading_requested_at (a Try again), not from the first file", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-02T01:10:20.000Z"));
    mocks.readAttempt.mockResolvedValue({
      ok: true,
      value: {
        ...ATTEMPT,
        status: "received",
        receivedAt: "2026-11-02T01:00:00+00:00",
        gradingRequestedAt: "2026-11-02T01:10:15+00:00",
      },
    });
    const html = await render();
    expect(liveRegionText(html)).toContain("File received — grading…");
    expect(html).not.toContain(examMessages.gradingSlow);
  });

  it("grading failed: no slow message, no Orbit, the failure alert and a Try again button for this attempt", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-02T01:20:00.000Z"));
    mocks.readAttempt.mockResolvedValue({
      ok: true,
      value: { ...ATTEMPT, status: "grading_failed", receivedAt: "2026-11-02T01:10:00+00:00" },
    });
    const html = await render();
    expect(liveRegionText(html)).toContain("File received — grading failed.");
    expect(html).not.toContain(examMessages.gradingSlow);
    expect(html).not.toMatch(/<svg[^>]*viewBox="0 0 100 100"/);
    expect(html).toMatch(new RegExp(`<p role="alert" lang="id" class="[^"]*text-destructive[^"]*">${examMessages.gradingFailed}</p>`));
    expect(html).toMatch(/<button type="submit"[^>]*>Try again<\/button>/);
    expect(html).toContain(`name="attemptId" value="${ID}"`);
    expect(html).not.toContain("Back to Dashboard");
  });

  it("shows the Upload Dropzone while open: a file input for .xlsm/.xlsx, labelled, and no alert", async () => {
    mocks.readAttempt.mockResolvedValue({ ok: true, value: ATTEMPT });
    const html = await render();
    const inputs = [...html.matchAll(/<input[^>]*>/g)].map((m) => m[0]);
    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toContain('type="file"');
    expect(inputs[0]).toContain('accept=".xlsm,.xlsx"');
    expect(inputs[0]).not.toContain("multiple");
    expect(inputs[0]).not.toContain("disabled");
    expect(html).toMatch(/<label[^>]*>[\s\S]*?<input[^>]*type="file"[\s\S]*?Upload file \(\.xlsm\)<\/label>/);
    expect(html).not.toContain('role="alert"');
    expect(liveRegionText(html)).not.toContain("Uploading");
  });

  it.each(["received", "grading_failed"])("renders no Upload Dropzone once %s", async (status) => {
    mocks.readAttempt.mockResolvedValue({
      ok: true,
      value: { ...ATTEMPT, status, receivedAt: "2026-11-02T01:10:00+00:00" },
    });
    const html = await render();
    expect(html).not.toContain('type="file"');
    expect(html).not.toContain("Upload file (.xlsm)");
  });

  it("an abandoned attempt: no Orbit, no Dropzone, 'This attempt was abandoned.' and a link back to Dashboard", async () => {
    mocks.readAttempt.mockResolvedValue({ ok: true, value: { ...ATTEMPT, status: "abandoned" } });
    const html = await render();
    expect(liveRegionText(html)).toContain("This attempt was abandoned.");
    expect(html).not.toMatch(/<svg[^>]*viewBox="0 0 100 100"/);
    expect(html).not.toContain('type="file"');
    expect(html).not.toContain("Download again");
    expect(html).toMatch(/<a [^>]*href="\/dashboard"[^>]*>Back to Dashboard<\/a>/);
  });

  it("an open attempt has no link back to Dashboard", async () => {
    mocks.readAttempt.mockResolvedValue({ ok: true, value: ATTEMPT });
    expect(await render()).not.toContain("Back to Dashboard");
  });

  it("redirects a graded attempt with a valid stored Result to Results", async () => {
    mocks.readAttempt.mockResolvedValue({ ok: true, value: { ...ATTEMPT, status: "graded", receivedAt: "2026-11-02T01:10:00+00:00" } });
    mocks.hasValidResult.mockResolvedValue({ ok: true, value: true });
    await expect(render()).rejects.toMatchObject({ url: `/results/${ID}` });
    expect(mocks.hasValidResult).toHaveBeenCalledWith(SUPABASE, ID);
  });

  it("does not look for a Result before the attempt is graded", async () => {
    mocks.readAttempt.mockResolvedValue({ ok: true, value: { ...ATTEMPT, status: "received", receivedAt: "2026-11-02T01:10:00+00:00" } });
    await render();
    expect(mocks.hasValidResult).not.toHaveBeenCalled();
  });

  it("a graded attempt without a valid Result (graded by SQL): a calm line, no Orbit, Dashboard; fails when the read fails", async () => {
    const graded = { ...ATTEMPT, status: "graded", receivedAt: "2026-11-02T01:10:00+00:00" };
    mocks.readAttempt.mockResolvedValue({ ok: true, value: graded });
    mocks.hasValidResult.mockResolvedValue({ ok: true, value: false });
    const html = await render();
    expect(liveRegionText(html)).toContain("This attempt was graded without detailed results.");
    expect(html).not.toContain("File received — grading…");
    expect(html).not.toMatch(/<svg[^>]*viewBox="0 0 100 100"/);
    expect(html).not.toContain('type="file"');
    expect(html).toMatch(/<a [^>]*href="\/dashboard"[^>]*>Back to Dashboard<\/a>/);
    expect(mocks.redirect).not.toHaveBeenCalled();
    mocks.hasValidResult.mockResolvedValue({ ok: false });
    expect(await render()).toContain(shellMessages.firstLoadFailed);
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
