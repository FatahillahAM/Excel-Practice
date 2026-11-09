import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  findOpenAttempt: vi.fn(),
  createClient: vi.fn(),
}));
const SUPABASE = { session: true };
vi.mock("next/navigation", () => ({
  unstable_rethrow: (error: unknown) => {
    if ((error as { url?: string })?.url) throw error;
  },
}));
vi.mock("@/adapters/supabase/auth", () => ({ getSessionUser: mocks.getSessionUser }));
vi.mock("@/adapters/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/adapters/supabase/attempts", () => ({ findOpenAttempt: mocks.findOpenAttempt }));

import { attemptCardView, attemptTitle, loadOpenAttempt } from "./open-attempt";

const ID = "0b9e0d6c-3f1a-4c2e-9d55-8a7b6c5d4e3f";
const ATTEMPT = {
  id: ID,
  itemId: "L01-P1",
  status: "open" as const,
  templateVersion: 1,
  startedAt: "2026-11-02T01:00:00+00:00",
  receivedAt: null,
};

beforeEach(() => {
  mocks.getSessionUser.mockResolvedValue({ id: "user-1", email: null });
  mocks.createClient.mockResolvedValue(SUPABASE);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  mocks.getSessionUser.mockReset();
  mocks.findOpenAttempt.mockReset();
  mocks.createClient.mockReset();
});

describe("attemptCardView", () => {
  it("open: 'Practice 1 · Level 1', 'mm:ss since Start', Resume to the exam screen without ?download=1", () => {
    expect(attemptCardView(ATTEMPT, 754)).toEqual({
      title: "Practice 1 · Level 1",
      time: "12:34",
      caption: "since Start",
      resumeHref: `/exam/${ID}`,
    });
  });

  it.each(["received", "grading_failed"] as const)("%s: 'File received — grading…' instead of the time", (status) => {
    const view = attemptCardView({ ...ATTEMPT, status }, 754);
    expect(view.caption).toBe("File received — grading…");
    expect(view.time).toBeNull();
    expect(view.title).toBe("Practice 1 · Level 1");
    expect(view.resumeHref).toBe(`/exam/${ID}`);
  });

  it("an unknown item keeps its id as the title; an hour or more shows h:mm:ss", () => {
    expect(attemptTitle("L99-P1")).toBe("L99-P1");
    expect(attemptCardView(ATTEMPT, 3725).time).toBe("1:02:05");
  });
});

describe("loadOpenAttempt", () => {
  it("reads the session user's attempt in progress, with the seconds since Start at request time", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-02T01:12:34.600Z"));
    mocks.findOpenAttempt.mockResolvedValue({ ok: true, value: ATTEMPT });
    expect(await loadOpenAttempt()).toEqual({ attempt: ATTEMPT, elapsed: 754 });
    expect(mocks.findOpenAttempt).toHaveBeenCalledWith(SUPABASE, "user-1");
  });

  it("is null without an attempt in progress, and without a session (no query)", async () => {
    mocks.findOpenAttempt.mockResolvedValue({ ok: true, value: null });
    expect(await loadOpenAttempt()).toBeNull();
    mocks.findOpenAttempt.mockClear();
    mocks.getSessionUser.mockResolvedValue(null);
    expect(await loadOpenAttempt()).toBeNull();
    expect(mocks.findOpenAttempt).not.toHaveBeenCalled();
  });

  it("is 'failed' when the read fails or anything throws", async () => {
    mocks.findOpenAttempt.mockResolvedValue({ ok: false });
    expect(await loadOpenAttempt()).toBe("failed");
    mocks.createClient.mockRejectedValue(new TypeError("cookies"));
    expect(await loadOpenAttempt()).toBe("failed");
    expect(console.error).toHaveBeenCalledWith(JSON.stringify({ event: "attempt.load_open_failed", name: "TypeError" }));
  });

  it("lets Next's redirect/interrupt errors through without logging", async () => {
    const interrupt = Object.assign(new Error("NEXT_REDIRECT"), { url: "/login" });
    mocks.getSessionUser.mockRejectedValue(interrupt);
    await expect(loadOpenAttempt()).rejects.toBe(interrupt);
    expect(console.error).not.toHaveBeenCalled();
  });
});
