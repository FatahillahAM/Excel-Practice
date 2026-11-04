import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  }),
  revalidatePath: vi.fn(),
  getSessionUser: vi.fn(),
  abandon: vi.fn(),
}));
const SUPABASE = { session: true };
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("../../../adapters/supabase/auth", () => ({ getSessionUser: mocks.getSessionUser }));
vi.mock("../../../adapters/supabase/server", () => ({ createClient: async () => SUPABASE }));
vi.mock("../../../adapters/supabase/attempts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../adapters/supabase/attempts")>();
  return { isAttemptId: actual.isAttemptId, abandon: mocks.abandon };
});

import { abandonAttempt, type AbandonState } from "./abandon-actions";

const ID = "0b9e0d6c-3f1a-4c2e-9d55-8a7b6c5d4e3f";
const IDLE: AbandonState = { status: "idle" };
const CHANGED = { outcome: "changed", status: "abandoned" };

function form(attemptId: string | null = ID): FormData {
  const data = new FormData();
  if (attemptId !== null) data.set("attemptId", attemptId);
  return data;
}

let logs: { mock: { calls: unknown[][] } };
let errors: { mock: { calls: unknown[][] } };
beforeEach(() => {
  mocks.getSessionUser.mockResolvedValue({ id: "user-1", email: null });
  logs = vi.spyOn(console, "log").mockImplementation(() => {});
  errors = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  mocks.getSessionUser.mockReset();
  mocks.abandon.mockReset();
  mocks.revalidatePath.mockClear();
  mocks.redirect.mockClear();
});

function expectRevalidated() {
  expect(mocks.revalidatePath.mock.calls).toEqual([["/dashboard"], ["/levels"]]);
}

function logged(spy: { mock: { calls: unknown[][] } }): Record<string, unknown>[] {
  return spy.mock.calls.map(([line]) => JSON.parse(String(line)));
}

describe("abandonAttempt", () => {
  it("changed: done, Dashboard and /levels re-rendered, logs attempt.abandoned", async () => {
    mocks.abandon.mockResolvedValue(CHANGED);
    expect(await abandonAttempt(IDLE, form())).toEqual({ status: "done" });
    expect(mocks.abandon).toHaveBeenCalledWith(SUPABASE, ID);
    expectRevalidated();
    expect(logged(logs)).toEqual([{ event: "attempt.abandoned", attemptId: ID }]);
  });

  it("lost then changed: one retry from the new status", async () => {
    mocks.abandon.mockResolvedValueOnce({ outcome: "lost" }).mockResolvedValueOnce(CHANGED);
    expect(await abandonAttempt(IDLE, form())).toEqual({ status: "done" });
    expect(mocks.abandon).toHaveBeenCalledTimes(2);
    expectRevalidated();
  });

  it("lost twice: error, no third try, the card stays", async () => {
    mocks.abandon.mockResolvedValue({ outcome: "lost" });
    expect(await abandonAttempt(IDLE, form())).toEqual({ status: "error" });
    expect(mocks.abandon).toHaveBeenCalledTimes(2);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(logged(errors)).toEqual([{ event: "attempt.abandon_failed", attemptId: ID, code: "lost" }]);
  });

  it.each(["refused", "not_found"])("%s (graded or abandoned elsewhere): done and re-rendered, no message", async (outcome) => {
    mocks.abandon.mockResolvedValue({ outcome });
    expect(await abandonAttempt(IDLE, form())).toEqual({ status: "done" });
    expect(mocks.abandon).toHaveBeenCalledTimes(1);
    expectRevalidated();
    expect(logs.mock.calls).toHaveLength(0);
  });

  it("failed: error, nothing re-rendered", async () => {
    mocks.abandon.mockResolvedValue({ outcome: "failed" });
    expect(await abandonAttempt(IDLE, form())).toEqual({ status: "error" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(logged(errors)).toEqual([{ event: "attempt.abandon_failed", attemptId: ID, code: "failed" }]);
  });

  it("a throw is an error, never an error page", async () => {
    mocks.abandon.mockRejectedValue(new TypeError("fetch failed"));
    expect(await abandonAttempt(IDLE, form())).toEqual({ status: "error" });
    expect(logged(errors)).toEqual([{ event: "attempt.abandon_failed", code: "threw", name: "TypeError" }]);
  });

  it("without a session: Login, then back to Dashboard", async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    await expect(abandonAttempt(IDLE, form())).rejects.toMatchObject({ url: "/login" });
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
    expect(mocks.abandon).not.toHaveBeenCalled();
  });

  it.each([null, "", "not-a-uuid"])("a bad attempt id (%s) is an error without a query", async (id) => {
    expect(await abandonAttempt(IDLE, form(id))).toEqual({ status: "error" });
    expect(mocks.abandon).not.toHaveBeenCalled();
    expect(logged(errors)).toEqual([{ event: "attempt.abandon_failed", code: "bad_id" }]);
  });

  it("logs no token, hash or email", async () => {
    mocks.abandon.mockResolvedValue(CHANGED);
    await abandonAttempt(IDLE, form());
    for (const line of [...logs.mock.calls, ...errors.mock.calls]) {
      expect(String(line[0])).not.toMatch(/token|sha256|@/i);
    }
  });
});
