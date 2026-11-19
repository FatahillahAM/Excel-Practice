import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The Start gate (CAP-9) on fixture Levels 1–4 (the registry has no Test
 * content until epic 5): refused items create nothing; done items start again
 * as Practice again through the same path.
 */
const mocks = vi.hoisted(() => ({
  createAttempt: vi.fn(),
  listProgressAttempts: vi.fn(),
  generateExamWorkbook: vi.fn(),
  registry: null as null | import("@/core/content/level-module").LevelModule[],
}));
const SUPABASE = { session: true };
const ID = "0b9e0d6c-3f1a-4c2e-9d55-8a7b6c5d4e3f";

vi.mock("next/headers", () => ({ headers: async () => new Headers({ origin: "https://example.test" }) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  },
}));
vi.mock("@/adapters/supabase/auth", () => ({ getSessionUser: async () => ({ id: "user-1", email: null }) }));
vi.mock("@/adapters/supabase/server", () => ({ createClient: async () => SUPABASE }));
vi.mock("@/adapters/supabase/profiles", () => ({
  readTimeZone: async () => ({ ok: true, timeZone: "Asia/Jakarta" }),
  ensureProfile: async () => "exists",
}));
vi.mock("@/adapters/supabase/attempts", () => ({
  createAttempt: mocks.createAttempt,
  deleteOpenAttempt: async () => true,
  findOpenAttemptId: async () => ({ ok: true, value: null }),
  listProgressAttempts: mocks.listProgressAttempts,
  uploadGeneratedFile: async () => true,
  writeSnapshot: async () => true,
}));
vi.mock("@/adapters/supabase/service", () => ({ createServiceClient: () => ({ service: true }) }));
vi.mock("@/adapters/workbook/generate", () => ({ generateExamWorkbook: mocks.generateExamWorkbook }));
vi.mock("@/content/levels", async () => {
  const { FIXTURE_LEVELS } = await import("@/core/content/__fixtures__/levels");
  mocks.registry = [...FIXTURE_LEVELS];
  return {
    // Mutated in place per test (`setRegistry`), so the action reads the current list.
    levels: mocks.registry,
    findItem: (itemId: string) => {
      for (const level of mocks.registry!) {
        const item = level.items.find((candidate) => candidate.id === itemId);
        if (item) return { level, item };
      }
      return null;
    },
  };
});

import { FIXTURE_LEVELS, fixtureLevel } from "@/core/content/__fixtures__/levels";
import type { LevelModule } from "@/core/content/level-module";
import { SCORE_79, SCORE_80 } from "@/core/grading/__fixtures__/results";
import { startAttempt } from "./start-actions";

const graded = (itemId: string, result: unknown, i = 0) => ({
  id: `a-${itemId}-${i}`,
  itemId,
  result,
  startedAt: "2026-11-02T01:00:00Z",
  receivedAt: "2026-11-02T01:10:00Z",
});
const fivePractices = (level = 1) => [1, 2, 3, 4, 5].map((n) => graded(`L0${level}-P${n}`, SCORE_79));

async function start(itemId: string) {
  const data = new FormData();
  data.set("itemId", itemId);
  data.set("timeZone", "Asia/Jakarta");
  try {
    return await startAttempt({ status: "idle" }, data);
  } catch (error) {
    return { redirected: (error as { url?: string }).url };
  }
}

function setRegistry(modules: readonly LevelModule[]) {
  mocks.registry!.splice(0, mocks.registry!.length, ...modules);
}

let errors: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  setRegistry(FIXTURE_LEVELS);
  mocks.createAttempt.mockResolvedValue({ ok: true, id: ID });
  mocks.generateExamWorkbook.mockResolvedValue({ bytes: new Uint8Array([1]), templateVersion: 1 });
  mocks.listProgressAttempts.mockResolvedValue({ ok: true, value: [] });
  vi.spyOn(console, "log").mockImplementation(() => {});
  errors = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  mocks.createAttempt.mockReset();
  mocks.generateExamWorkbook.mockReset();
  mocks.listProgressAttempts.mockReset();
});

describe("startAttempt gate", () => {
  it("refuses a locked Test (4 practices) with a typed reason and creates nothing", async () => {
    mocks.listProgressAttempts.mockResolvedValue({ ok: true, value: fivePractices().slice(0, 4) });
    expect(await start("L01-T")).toEqual({ status: "refused", reason: "test_locked", toGo: 1 });
    expect(mocks.generateExamWorkbook).not.toHaveBeenCalled();
    expect(mocks.createAttempt).not.toHaveBeenCalled();
    expect(errors.mock.calls.map((c: unknown[]) => JSON.parse(String(c[0])))).toEqual([
      { event: "attempt.start_refused", itemId: "L01-T", reason: "test_locked" },
    ]);
  });

  it("starts the Test after 5 practices", async () => {
    mocks.listProgressAttempts.mockResolvedValue({ ok: true, value: fivePractices() });
    expect(await start("L01-T")).toEqual({ redirected: `/exam/${ID}?download=1` });
    expect(mocks.createAttempt).toHaveBeenCalledWith(SUPABASE, expect.objectContaining({ itemId: "L01-T" }));
  });

  it("refuses a practice of a locked level", async () => {
    mocks.listProgressAttempts.mockResolvedValue({ ok: true, value: [...fivePractices(), graded("L01-T", SCORE_79)] });
    expect(await start("L02-P1")).toEqual({ status: "refused", reason: "level_locked" });
    expect(mocks.createAttempt).not.toHaveBeenCalled();
  });

  it("opens Level 2 once Test 1 scores 80", async () => {
    mocks.listProgressAttempts.mockResolvedValue({ ok: true, value: [...fivePractices(), graded("L01-T", SCORE_80)] });
    expect(await start("L02-P1")).toEqual({ redirected: `/exam/${ID}?download=1` });
  });

  it("retakes a failed Test at once", async () => {
    mocks.listProgressAttempts.mockResolvedValue({ ok: true, value: [...fivePractices(), graded("L01-T", SCORE_79)] });
    expect(await start("L01-T")).toEqual({ redirected: `/exam/${ID}?download=1` });
  });

  it("L1 passed with a registry lacking L2: L02-P1 refused as Under Construction", async () => {
    setRegistry([FIXTURE_LEVELS[0]]);
    mocks.listProgressAttempts.mockResolvedValue({ ok: true, value: [...fivePractices(), graded("L01-T", SCORE_80)] });
    expect(await start("L02-P1")).toEqual({ status: "refused", reason: "under_construction" });
    expect(mocks.createAttempt).not.toHaveBeenCalled();
  });

  it("L4 passed: L05-P1 refused (V1 ends), even with a Level 5 module", async () => {
    setRegistry([...FIXTURE_LEVELS, fixtureLevel(5)]);
    const value = [1, 2, 3, 4].flatMap((n) => [...fivePractices(n), graded(`L0${n}-T`, SCORE_80)]);
    mocks.listProgressAttempts.mockResolvedValue({ ok: true, value });
    expect(await start("L05-P1")).toEqual({ status: "refused", reason: "under_construction" });
    expect(mocks.createAttempt).not.toHaveBeenCalled();
  });

  it("a crafted L01-P5 on a new account is refused (practice order)", async () => {
    expect(await start("L01-P5")).toEqual({ status: "refused", reason: "practice_locked" });
    expect(mocks.generateExamWorkbook).not.toHaveBeenCalled();
    expect(mocks.createAttempt).not.toHaveBeenCalled();
  });

  it("starts a done practice again (Practice again) through the same path", async () => {
    mocks.listProgressAttempts.mockResolvedValue({ ok: true, value: [graded("L01-P1", SCORE_80)] });
    expect(await start("L01-P1")).toEqual({ redirected: `/exam/${ID}?download=1` });
    expect(mocks.createAttempt).toHaveBeenCalledWith(SUPABASE, expect.objectContaining({ itemId: "L01-P1" }));
  });
});
