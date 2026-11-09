import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSessionUser: vi.fn(), readAttempt: vi.fn() }));
const SUPABASE = { session: true };
vi.mock("@/adapters/supabase/auth", () => ({ getSessionUser: mocks.getSessionUser }));
vi.mock("@/adapters/supabase/server", () => ({ createClient: async () => SUPABASE }));
vi.mock("@/adapters/supabase/attempts", () => ({ readAttempt: mocks.readAttempt }));

import { GET } from "./route";

const ID = "0b9e0d6c-3f1a-4c2e-9d55-8a7b6c5d4e3f";
const NOW = Date.parse("2026-11-02T01:02:05.900Z");

const attempt = (status: string) => ({
  id: ID,
  itemId: "L01-P1",
  status,
  templateVersion: 1,
  startedAt: "2026-11-02T01:00:00+00:00",
  receivedAt: status === "open" ? null : "2026-11-02T01:01:00+00:00",
});

const get = () =>
  GET(new Request(`https://example.test/api/attempts/${ID}/status`), { params: Promise.resolve({ attemptId: ID }) });

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  mocks.getSessionUser.mockResolvedValue({ id: "user-1", email: null });
});

afterEach(() => {
  vi.useRealTimers();
  mocks.getSessionUser.mockReset();
  mocks.readAttempt.mockReset();
});

describe("GET /api/attempts/<attemptId>/status", () => {
  it.each(["open", "received"])("answers %s with whole seconds since Start and no result, uncached", async (status) => {
    mocks.readAttempt.mockResolvedValue({ ok: true, value: attempt(status) });
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: true, data: { status, elapsedSeconds: 125, resultId: null } });
    expect(mocks.readAttempt).toHaveBeenCalledWith(SUPABASE, ID);
  });

  it("answers 401 without a session", async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    const res = await get();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ ok: false, code: "UNAUTHENTICATED" });
    expect(mocks.readAttempt).not.toHaveBeenCalled();
  });

  it("answers 404 NOT_FOUND for someone else's attempt (RLS hides it)", async () => {
    mocks.readAttempt.mockResolvedValue({ ok: true, value: null });
    const res = await get();
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, code: "NOT_FOUND" });
  });

  it("answers 500 when the read fails", async () => {
    mocks.readAttempt.mockResolvedValue({ ok: false });
    const res = await get();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, code: "INTERNAL_ERROR" });
  });
});
