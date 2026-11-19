import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  listProgressAttempts: vi.fn(),
  listFreezes: vi.fn(),
  readTimeZone: vi.fn(),
}));
vi.mock("next/navigation", () => ({ unstable_rethrow: () => {} }));
vi.mock("@/adapters/supabase/auth", () => ({ getSessionUser: mocks.getSessionUser }));
vi.mock("@/adapters/supabase/server", () => ({ createClient: async () => ({ session: true }) }));
vi.mock("@/adapters/supabase/attempts", () => ({ listProgressAttempts: mocks.listProgressAttempts }));
vi.mock("@/adapters/supabase/freezes", () => ({ listFreezes: mocks.listFreezes }));
vi.mock("@/adapters/supabase/profiles", () => ({ readTimeZone: mocks.readTimeZone }));

import { PRACTICE_85 } from "@/core/grading/__fixtures__/results";
import { loadStreak } from "./progress";

const NOW = new Date("2026-11-19T13:00:00Z"); // 20:00 in Jakarta, Thursday
const row = (receivedAt: string) => ({ id: receivedAt, itemId: "L01-P1", result: PRACTICE_85, startedAt: receivedAt, receivedAt });
const logged = () => vi.mocked(console.error).mock.calls.map((c) => JSON.parse(c[0] as string));

beforeEach(() => {
  mocks.getSessionUser.mockResolvedValue({ id: "user-1", email: null });
  mocks.readTimeZone.mockResolvedValue({ ok: true, timeZone: "Asia/Jakarta" });
  mocks.listProgressAttempts.mockResolvedValue({ ok: true, value: [row("2026-11-17T18:00:00Z"), row("2026-11-17T02:00:00Z")] });
  mocks.listFreezes.mockResolvedValue({ ok: true, value: ["2026-11-16"] });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("loadStreak", () => {
  it("derives the streak in the profile's zone from the graded read and the freezes", async () => {
    const view = await loadStreak(NOW);
    // 17 Nov (09:00 local), 18 Nov (01:00 local) graded; 16 Nov frozen; today at risk.
    expect(view).toMatchObject({ count: 3, todaySafe: false, frozenToday: false, msLeft: 4 * 3_600_000, freezesLeft: 1 });
    expect(mocks.listFreezes).toHaveBeenCalledWith({ session: true }, "user-1");
  });

  it("null without a session", async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    expect(await loadStreak(NOW)).toBeNull();
  });

  it("failed when the zone is missing (streak.time_zone_missing) or any read fails", async () => {
    mocks.readTimeZone.mockResolvedValue({ ok: true, timeZone: null });
    expect(await loadStreak(NOW)).toBe("failed");
    expect(logged()).toContainEqual({ event: "streak.time_zone_missing" });
    mocks.readTimeZone.mockResolvedValue({ ok: true, timeZone: "Asia/Jakarta" });
    mocks.listFreezes.mockResolvedValue({ ok: false });
    expect(await loadStreak(NOW)).toBe("failed");
    mocks.listFreezes.mockRejectedValue(new TypeError("x"));
    expect(await loadStreak(NOW)).toBe("failed");
    expect(logged().at(-1)).toEqual({ event: "streak.load_failed", name: "TypeError" });
  });
});
