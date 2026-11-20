import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  listStreakDays: vi.fn(),
  listFreezes: vi.fn(),
  readTimeZone: vi.fn(),
}));
vi.mock("next/navigation", () => ({ unstable_rethrow: () => {} }));
vi.mock("@/adapters/supabase/auth", () => ({ getSessionUser: mocks.getSessionUser }));
vi.mock("@/adapters/supabase/server", () => ({ createClient: async () => ({ session: true }) }));
vi.mock("@/adapters/supabase/attempts", () => ({ listProgressAttempts: vi.fn() }));
vi.mock("@/adapters/supabase/freezes", () => ({ listFreezes: mocks.listFreezes, listStreakDays: mocks.listStreakDays }));
vi.mock("@/adapters/supabase/profiles", () => ({ readTimeZone: mocks.readTimeZone }));

import { listProgressAttempts } from "@/adapters/supabase/attempts";
import { PRACTICE_85 } from "@/core/grading/__fixtures__/results";
import { loadNewRecord, loadRecords, loadStreak } from "./progress";

const NOW = new Date("2026-11-19T13:00:00Z"); // 20:00 in Jakarta, Thursday
const logged = () => vi.mocked(console.error).mock.calls.map((c) => JSON.parse(c[0] as string));

beforeEach(() => {
  mocks.getSessionUser.mockResolvedValue({ id: "user-1", email: null });
  mocks.readTimeZone.mockResolvedValue({ ok: true, timeZone: "Asia/Jakarta" });
  mocks.listStreakDays.mockResolvedValue({ ok: true, value: ["2026-11-17", "2026-11-18"] });
  mocks.listFreezes.mockResolvedValue({ ok: true, value: ["2026-11-16"] });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("loadStreak", () => {
  it("derives the streak in the profile's zone from the graded read and the freezes", async () => {
    const view = await loadStreak(NOW);
    // 17 and 18 Nov graded (streak_days); 16 Nov frozen; today at risk.
    expect(view).toMatchObject({ today: "2026-11-19", count: 3, todaySafe: false, frozenToday: false, msLeft: 4 * 3_600_000, freezesLeft: 1 });
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
    mocks.listFreezes.mockResolvedValue({ ok: true, value: [] });
    mocks.listStreakDays.mockResolvedValue({ ok: false });
    expect(await loadStreak(NOW)).toBe("failed");
  });

  it("failed, not thrown, for a zone the runtime does not know", async () => {
    mocks.readTimeZone.mockResolvedValue({ ok: true, timeZone: "Mars/Olympus" });
    expect(await loadStreak(NOW)).toBe("failed");
    expect(logged().at(-1)).toEqual({ event: "streak.load_failed", name: "RangeError" });
  });
});

describe("loadRecords / loadNewRecord", () => {
  const row = (id: string, startedAt: string, receivedAt: string) => ({ id, itemId: "L01-P1", result: PRACTICE_85, startedAt, receivedAt });
  const rows = [row("a", "2026-11-01T01:00:00Z", "2026-11-01T01:05:00Z"), row("b", "2026-11-02T01:00:00Z", "2026-11-02T01:04:00Z")];

  it("derive records, progress and the badge from the one progress read", async () => {
    vi.mocked(listProgressAttempts).mockResolvedValue({ ok: true, value: rows });
    const view = await loadRecords();
    expect(view).not.toBe("failed");
    if (view === "failed") return;
    expect(view.records.get("L01-P1")).toMatchObject({ attemptId: "b", seconds: 240 });
    expect(view.progress[0].practicesDone.has(1)).toBe(true);
    expect(await loadNewRecord("b")).toBe(true);
    expect(await loadNewRecord("a")).toBe(false);
  });

  it("a failed read: records failed, the badge hidden", async () => {
    vi.mocked(listProgressAttempts).mockResolvedValue({ ok: false });
    expect(await loadRecords()).toBe("failed");
    expect(await loadNewRecord("b")).toBe(false);
  });
});
