import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  redirect: vi.fn(),
  getSessionUser: vi.fn(),
  createServiceClient: vi.fn(),
  readAttempt: vi.fn(),
  changeStatus: vi.fn(),
  loadForGrading: vi.fn(),
  downloadSubmissionFile: vi.fn(),
  /** The next `readWorkbook` call throws (a forced grading failure). */
  failNextRead: { value: false },
}));
const SUPABASE = { session: true };
const SERVICE = { service: true };
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/adapters/supabase/auth", () => ({ getSessionUser: mocks.getSessionUser }));
vi.mock("@/adapters/supabase/server", () => ({ createClient: async () => SUPABASE }));
vi.mock("@/adapters/supabase/service", () => ({ createServiceClient: mocks.createServiceClient }));
vi.mock("@/adapters/supabase/attempts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/adapters/supabase/attempts")>();
  return {
    isAttemptId: actual.isAttemptId,
    readAttempt: mocks.readAttempt,
    changeStatus: mocks.changeStatus,
    loadForGrading: mocks.loadForGrading,
    downloadSubmissionFile: mocks.downloadSubmissionFile,
  };
});
vi.mock("@/adapters/workbook/read", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/adapters/workbook/read")>();
  return {
    readWorkbook: async (bytes: Uint8Array) => {
      if (mocks.failNextRead.value) {
        mocks.failNextRead.value = false;
        throw new Error("Storage handed back a broken stream");
      }
      return actual.readWorkbook(bytes);
    },
  };
});

import type { AttemptEvent, AttemptStatus } from "@/adapters/supabase/attempts";
import { scheduleGrading } from "@/app/api/submissions/grading";
import { buildFixture, expectedResult, fixtureSnapshot } from "@/content/levels/01-fondasi/__fixtures__/l01-p1";
import type { Result } from "@/core/grading";
import { transition } from "@/core/services/attempts";
import { retryGrading } from "./retry-actions";

// Forced failure end to end (U4, Try again): an in-memory attempt row, the
// real state machine (`transition`) behind the fake compare-and-set, and the
// real grading (`gradeAttempt` → `grade`) of the L01-P1 `correct` golden
// fixture. The first run's workbook read throws → `grading_failed`; Try again
// moves it back to `received` and schedules a run, which grades it.

const ID = "0b9e0d6c-3f1a-4c2e-9d55-8a7b6c5d4e3f";
const snapshot = fixtureSnapshot();
let file: Uint8Array;

/** The attempt as the database holds it. */
let row: { status: AttemptStatus; result: Result | null };

beforeAll(async () => {
  file = await buildFixture("correct");
});

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  row = { status: "received", result: null };
  mocks.getSessionUser.mockResolvedValue({ id: "user-1", email: null });
  mocks.createServiceClient.mockReturnValue(SERVICE);
  mocks.readAttempt.mockImplementation(async () => ({
    ok: true,
    value: {
      id: ID,
      itemId: "L01-P1",
      status: row.status,
      templateVersion: 1,
      startedAt: "2026-11-10T01:00:00+00:00",
      receivedAt: "2026-11-10T01:05:00+00:00",
      gradingRequestedAt: "2026-11-10T01:05:00+00:00",
    },
  }));
  mocks.loadForGrading.mockImplementation(async () => ({ ok: true, value: { status: row.status, snapshot, gradingRequestedAt: null, hintsUsed: 0 } }));
  mocks.downloadSubmissionFile.mockImplementation(async () => ({ ok: true, value: file }));
  mocks.changeStatus.mockImplementation(
    async (_client: unknown, _id: string, from: AttemptStatus, event: AttemptEvent, _log: string, options: { result?: Result } = {}) => {
      const next = transition(from, event);
      if (!next.ok) return { outcome: "refused" };
      if (row.status !== from) return { outcome: "lost" };
      row = { status: next.to, result: options.result ?? row.result };
      return { outcome: "changed", status: next.to };
    },
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const mock of [mocks.after, mocks.getSessionUser, mocks.createServiceClient, mocks.readAttempt, mocks.changeStatus]) {
    mock.mockReset();
  }
  mocks.failNextRead.value = false;
});

/** Runs the `after()` task scheduled last. */
async function runScheduled(): Promise<unknown> {
  const task = mocks.after.mock.calls.at(-1)![0] as () => Promise<unknown>;
  return task();
}

function form(): FormData {
  const data = new FormData();
  data.set("attemptId", ID);
  return data;
}

describe("grading fails, Try again, graded", () => {
  it("ends graded with the correct fixture's Result, and a second Try again changes nothing", async () => {
    // The accepted file's run: the workbook read fails.
    mocks.failNextRead.value = true;
    scheduleGrading("upload", ID);
    expect(await runScheduled()).toBe("grading_failed");
    expect(row).toEqual({ status: "grading_failed", result: null });

    // Try again: back to received, one run scheduled.
    expect(await retryGrading({ status: "idle" }, form())).toEqual({ status: "retried" });
    expect(row.status).toBe("received");
    expect(mocks.after).toHaveBeenCalledTimes(2);

    // The retry run grades the same stored file.
    expect(await runScheduled()).toBe("graded");
    expect(row.status).toBe("graded");
    expect(row.result).toEqual(expectedResult("correct", snapshot));

    // Nothing is left to retry.
    expect(await retryGrading({ status: "retried" }, form())).toEqual({ status: "unchanged" });
    expect(mocks.after).toHaveBeenCalledTimes(2);
    expect(row.result).toEqual(expectedResult("correct", snapshot));
  });
});
