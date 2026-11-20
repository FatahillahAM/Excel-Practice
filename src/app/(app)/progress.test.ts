import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  listStreakDays: vi.fn(),
  listFreezes: vi.fn(),
  readTimeZone: vi.fn(),
  throwBestScores: false,
  throwSummary: false,
}));
vi.mock("@/core/progress", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/core/progress")>();
  return {
    ...real,
    bestScores: (...args: Parameters<typeof real.bestScores>) => {
      if (mocks.throwBestScores) throw new RangeError("x");
      return real.bestScores(...args);
    },
    curriculumSummary: (...args: Parameters<typeof real.curriculumSummary>) => {
      if (mocks.throwSummary) throw new RangeError("x");
      return real.curriculumSummary(...args);
    },
  };
});
vi.mock("next/navigation", () => ({ unstable_rethrow: () => {} }));
vi.mock("@/adapters/supabase/auth", () => ({ getSessionUser: mocks.getSessionUser }));
vi.mock("@/adapters/supabase/server", () => ({ createClient: async () => ({ session: true }) }));
vi.mock("@/adapters/supabase/attempts", () => ({ listProgressAttempts: vi.fn(), listRecordAttempts: vi.fn(), listItemDurations: vi.fn() }));
vi.mock("@/adapters/supabase/freezes", () => ({ listFreezes: mocks.listFreezes, listStreakDays: mocks.listStreakDays }));
vi.mock("@/adapters/supabase/profiles", () => ({ readTimeZone: mocks.readTimeZone }));

import { listItemDurations, listProgressAttempts, listRecordAttempts } from "@/adapters/supabase/attempts";
import { PRACTICE_85, SCORE_79 } from "@/core/grading/__fixtures__/results";
import { loadCurriculumSummary, loadLevelMap, loadNewRecord, loadRecords, loadStreak } from "./progress";

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

describe("loadRecords", () => {
  const row = (id: string, itemId: string, score: unknown, startedAt: string, receivedAt: string) => ({ id, itemId, score, startedAt, receivedAt });

  beforeEach(() => {
    vi.mocked(listProgressAttempts).mockResolvedValue({ ok: true, value: [] });
    vi.mocked(listRecordAttempts).mockReset();
  });

  it("derives records from the narrow read, in the profile's zone; drops a bad score; logs orphan items", async () => {
    vi.mocked(listRecordAttempts).mockResolvedValue({
      ok: true,
      value: [
        row("a", "L01-P1", 85, "2026-11-01T01:00:00Z", "2026-11-01T01:05:00Z"),
        row("b", "L01-P1", 70, "2026-11-02T01:00:00Z", "2026-11-02T01:04:00Z"),
        row("c", "L01-P1", "x", "2026-11-03T01:00:00Z", "2026-11-03T01:01:00Z"),
        row("o", "L99-P1", 50, "2026-11-03T01:00:00Z", "2026-11-03T01:01:00Z"),
      ],
    });
    const view = await loadRecords();
    if (view === "failed") throw new Error("failed");
    expect(view.records.get("L01-P1")).toMatchObject({ attemptId: "b", seconds: 240, score: 70 });
    expect(view.timeZone).toBe("Asia/Jakarta");
    expect(view.progress).toHaveLength(9);
    expect(logged()).toContainEqual({ event: "records.orphan_items", itemIds: ["L99-P1"] });
    expect(listRecordAttempts).toHaveBeenCalledWith({ session: true }, "user-1");
  });

  it("falls back to Asia/Jakarta without a profile zone", async () => {
    vi.mocked(listRecordAttempts).mockResolvedValue({ ok: true, value: [] });
    mocks.readTimeZone.mockResolvedValue({ ok: true, timeZone: null });
    expect(await loadRecords()).toMatchObject({ timeZone: "Asia/Jakarta" });
    mocks.readTimeZone.mockResolvedValue({ ok: true, timeZone: "Asia/Makassar" });
    expect(await loadRecords()).toMatchObject({ timeZone: "Asia/Makassar" });
  });

  it("no session: empty records, nothing read", async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    const view = await loadRecords();
    if (view === "failed") throw new Error("failed");
    expect(view.records.size).toBe(0);
    expect(listRecordAttempts).not.toHaveBeenCalled();
  });

  it("failed on a failed read; a thrown read logs progress.load_failed", async () => {
    vi.mocked(listRecordAttempts).mockResolvedValue({ ok: false });
    expect(await loadRecords()).toBe("failed");
    vi.mocked(listRecordAttempts).mockRejectedValue(new TypeError("x"));
    expect(await loadRecords()).toBe("failed");
    expect(logged().at(-1)).toEqual({ event: "progress.load_failed", name: "TypeError" });
  });
});

describe("loadNewRecord", () => {
  const rows = [
    { id: "a", startedAt: "2026-11-01T01:00:00Z", receivedAt: "2026-11-01T01:05:00Z" },
    { id: "b", startedAt: "2026-11-02T01:00:00Z", receivedAt: "2026-11-02T01:04:00Z" },
  ];

  it("reads only that item's times and compares", async () => {
    vi.mocked(listItemDurations).mockResolvedValue({ ok: true, value: rows });
    expect(await loadNewRecord("L01-P1", "b")).toBe(true);
    expect(await loadNewRecord("L01-P1", "a")).toBe(false);
    expect(listItemDurations).toHaveBeenCalledWith({ session: true }, "user-1", "L01-P1");
  });

  it("false without a session, on a failed read, and on a thrown one (logged)", async () => {
    vi.mocked(listItemDurations).mockResolvedValue({ ok: false });
    expect(await loadNewRecord("L01-P1", "b")).toBe(false);
    vi.mocked(listItemDurations).mockRejectedValue(new TypeError("x"));
    expect(await loadNewRecord("L01-P1", "b")).toBe(false);
    expect(logged().at(-1)).toEqual({ event: "progress.load_failed", name: "TypeError" });
    mocks.getSessionUser.mockResolvedValue(null);
    expect(await loadNewRecord("L01-P1", "b")).toBe(false);
  });
});

describe("loadLevelMap", () => {
  const row = (id: string, itemId: string, result: unknown, startedAt: string, receivedAt: string) => ({ id, itemId, result, startedAt, receivedAt });

  beforeEach(() => {
    vi.mocked(listProgressAttempts).mockReset();
    vi.mocked(listRecordAttempts).mockReset();
    mocks.readTimeZone.mockClear();
    mocks.throwBestScores = false;
  });

  it("one graded-attempts read gives progress, records and bestScores; no time-zone or records read", async () => {
    vi.mocked(listProgressAttempts).mockResolvedValue({
      ok: true,
      value: [
        row("a", "L01-P1", PRACTICE_85, "2026-11-01T01:00:00Z", "2026-11-01T01:05:00Z"),
        row("b", "L01-P1", SCORE_79, "2026-11-02T01:00:00Z", "2026-11-02T01:04:00Z"),
      ],
    });
    const view = await loadLevelMap();
    if (view === "failed") throw new Error("failed");
    expect(view.progress).toHaveLength(9);
    expect(view.progress[0].practicesDone.has(1)).toBe(true);
    expect(view.records.get("L01-P1")).toMatchObject({ attemptId: "b", seconds: 240 });
    expect(view.bestScores.get("L01-P1")).toBe(85);
    expect(listProgressAttempts).toHaveBeenCalledTimes(1);
    expect(listRecordAttempts).not.toHaveBeenCalled();
    expect(mocks.readTimeZone).not.toHaveBeenCalled();
  });

  it("a failed or thrown progress read is failed (progress.load_failed logged on a throw)", async () => {
    vi.mocked(listProgressAttempts).mockResolvedValue({ ok: false });
    expect(await loadLevelMap()).toBe("failed");
    vi.mocked(listProgressAttempts).mockRejectedValue(new TypeError("x"));
    expect(await loadLevelMap()).toBe("failed");
    expect(logged().at(-1)).toEqual({ event: "progress.load_failed", name: "TypeError" });
  });

  it("a records-derived failure keeps the progress, with empty records and scores, and is logged", async () => {
    vi.mocked(listProgressAttempts).mockResolvedValue({
      ok: true,
      value: [row("a", "L01-P1", PRACTICE_85, "2026-11-01T01:00:00Z", "2026-11-01T01:05:00Z")],
    });
    mocks.throwBestScores = true;
    const view = await loadLevelMap();
    if (view === "failed") throw new Error("failed");
    expect(view.progress[0].practicesDone.has(1)).toBe(true);
    expect(view.records.size).toBe(0);
    expect(view.bestScores.size).toBe(0);
    expect(logged().at(-1)).toEqual({ event: "progress.load_failed", name: "RangeError" });
  });
});

describe("loadCurriculumSummary (the shell's sidebar count)", () => {
  afterEach(() => {
    mocks.throwSummary = false;
  });

  it("derives L1 and 0 of 9 for a new user", async () => {
    vi.mocked(listProgressAttempts).mockResolvedValue({ ok: true, value: [] });
    expect(await loadCurriculumSummary()).toEqual({ activeLevel: 1, passed: 0, total: 9 });
  });

  it("null when the progress read fails: the shell still renders", async () => {
    vi.mocked(listProgressAttempts).mockResolvedValue({ ok: false } as never);
    expect(await loadCurriculumSummary()).toBeNull();
  });

  it("null and progress.load_failed when the derivation throws, never a throw", async () => {
    vi.mocked(listProgressAttempts).mockResolvedValue({ ok: true, value: [] });
    mocks.throwSummary = true;
    expect(await loadCurriculumSummary()).toBeNull();
    expect(logged()).toContainEqual({ event: "progress.load_failed", name: "RangeError" });
  });
});
