import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ set: vi.fn(), getSessionUser: vi.fn() }));

vi.mock("next/headers", () => ({ cookies: async () => ({ set: mocks.set }) }));
vi.mock("../adapters/supabase/auth", () => ({ getSessionUser: mocks.getSessionUser }));

import { saveReduceMotion, saveTheme } from "./preferences-actions";

afterEach(() => {
  vi.unstubAllEnvs();
  mocks.set.mockReset();
  mocks.getSessionUser.mockReset();
});

const signedIn = () => mocks.getSessionUser.mockResolvedValue({ id: "user-1", email: null });

describe("saveTheme", () => {
  it("writes the theme cookie for a signed-in user", async () => {
    signedIn();
    expect(await saveTheme("light")).toEqual({ ok: true });
    expect(mocks.set).toHaveBeenCalledWith(
      "theme",
      "light",
      expect.objectContaining({ path: "/", maxAge: 31_536_000, sameSite: "lax", httpOnly: true }),
    );
  });

  it("rejects an unknown value without writing", async () => {
    signedIn();
    expect(await saveTheme("xyz")).toEqual({ ok: false, code: "INVALID_INPUT" });
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("writes nothing without a session", async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    expect(await saveTheme("dark")).toEqual({ ok: false, code: "UNAUTHENTICATED" });
    expect(mocks.set).not.toHaveBeenCalled();
  });
});

describe("saveReduceMotion", () => {
  it.each(["on", "system"])("writes %s", async (value) => {
    signedIn();
    expect(await saveReduceMotion(value)).toEqual({ ok: true });
    expect(mocks.set).toHaveBeenCalledWith("reduce_motion", value, expect.objectContaining({ maxAge: 31_536_000 }));
  });

  it("rejects off (the switch writes system instead)", async () => {
    signedIn();
    expect(await saveReduceMotion("off")).toEqual({ ok: false, code: "INVALID_INPUT" });
    expect(mocks.set).not.toHaveBeenCalled();
  });
});

describe("secure flag", () => {
  it.each([
    ["production", true],
    ["development", false],
    ["test", false],
  ] as const)("NODE_ENV=%s → secure %s", async (env, secure) => {
    vi.stubEnv("NODE_ENV", env);
    signedIn();
    expect(await saveTheme("light")).toEqual({ ok: true });
    expect(await saveReduceMotion("on")).toEqual({ ok: true });
    expect(mocks.set).toHaveBeenNthCalledWith(1, "theme", "light", expect.objectContaining({ secure }));
    expect(mocks.set).toHaveBeenNthCalledWith(2, "reduce_motion", "on", expect.objectContaining({ secure }));
  });
});
