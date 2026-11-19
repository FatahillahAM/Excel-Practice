import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  }),
  revalidatePath: vi.fn(),
  getSessionUser: vi.fn(),
  spendFreeze: vi.fn(),
}));
const SUPABASE = { session: true };
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/adapters/supabase/auth", () => ({ getSessionUser: mocks.getSessionUser }));
vi.mock("@/adapters/supabase/server", () => ({ createClient: async () => SUPABASE }));
vi.mock("@/adapters/supabase/freezes", () => ({ spendFreeze: mocks.spendFreeze }));

import { freezeToday } from "./freeze-actions";

const answer = (code: string) => ({ ok: true, value: { code, localDate: "2026-11-19", left: 0 } });

let errors: { mock: { calls: unknown[][] } };
beforeEach(() => {
  mocks.getSessionUser.mockResolvedValue({ id: "user-1", email: null });
  vi.spyOn(console, "log").mockImplementation(() => {});
  errors = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  mocks.redirect.mockClear();
  mocks.revalidatePath.mockReset();
  mocks.getSessionUser.mockReset();
  mocks.spendFreeze.mockReset();
});

describe("freezeToday", () => {
  it.each(["frozen", "already_frozen"])("%s: done, on the session client, Dashboard re-rendered", async (code) => {
    mocks.spendFreeze.mockResolvedValue(answer(code));
    expect(await freezeToday()).toEqual({ status: "done" });
    expect(mocks.spendFreeze).toHaveBeenCalledWith(SUPABASE);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it.each(["safe", "quota_used"] as const)("%s: refused with the reason", async (code) => {
    mocks.spendFreeze.mockResolvedValue(answer(code));
    expect(await freezeToday()).toEqual({ status: "refused", reason: code });
  });

  it("no_profile, a failed call or a throw: error", async () => {
    mocks.spendFreeze.mockResolvedValue(answer("no_profile"));
    expect(await freezeToday()).toEqual({ status: "error" });
    mocks.spendFreeze.mockResolvedValue({ ok: false });
    expect(await freezeToday()).toEqual({ status: "error" });
    mocks.spendFreeze.mockRejectedValue(new TypeError("x"));
    expect(await freezeToday()).toEqual({ status: "error" });
    expect(JSON.parse(errors.mock.calls.at(-1)![0] as string)).toEqual({ event: "freeze.use_failed", code: "threw", name: "TypeError" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("without a session: Login, then back to Dashboard; nothing written", async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    await expect(freezeToday()).rejects.toMatchObject({ url: expect.stringContaining("/login") });
    expect(mocks.spendFreeze).not.toHaveBeenCalled();
  });
});
