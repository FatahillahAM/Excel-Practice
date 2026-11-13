import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  createServiceClient: vi.fn(),
  changeStatus: vi.fn(),
  downloadSubmissionFile: vi.fn(),
  loadForGrading: vi.fn(),
  readWorkbook: vi.fn(),
}));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@/adapters/supabase/service", () => ({ createServiceClient: mocks.createServiceClient }));
vi.mock("@/adapters/supabase/attempts", () => ({
  changeStatus: mocks.changeStatus,
  downloadSubmissionFile: mocks.downloadSubmissionFile,
  loadForGrading: mocks.loadForGrading,
}));
vi.mock("@/adapters/workbook/read", () => ({ readWorkbook: mocks.readWorkbook }));

import { SNAPSHOT, correctCells, readingOf, typed } from "@/core/grading/__fixtures__/exam";
import { buildFixture, fixtureSnapshot } from "@/content/levels/01-fondasi/__fixtures__/l01-p1";
import { resultSchema } from "@/core/grading";
import { runGrading, scheduleGrading } from "./grading";

const ID = "0b9e0d6c-3f1a-4c2e-9d55-8a7b6c5d4e3f";
const SERVICE = { service: true };
const BYTES = new Uint8Array([9, 9]);
const STAMP = "2026-11-10T01:05:00+00:00";

let logs: ReturnType<typeof vi.spyOn>;
let errors: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  logs = vi.spyOn(console, "log").mockImplementation(() => {});
  errors = vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.createServiceClient.mockReturnValue(SERVICE);
  mocks.loadForGrading.mockResolvedValue({
    ok: true,
    value: { status: "received", snapshot: SNAPSHOT, gradingRequestedAt: STAMP, hintsUsed: 0 },
  });
  mocks.downloadSubmissionFile.mockResolvedValue({ ok: true, value: BYTES });
  mocks.readWorkbook.mockResolvedValue(readingOf(correctCells()));
  mocks.changeStatus.mockImplementation(async (_c, _id, _from, event) => ({
    outcome: "changed",
    status: event === "grade_ok" ? "graded" : "grading_failed",
  }));
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const mock of Object.values(mocks)) mock.mockReset();
});

const lines = (spy: ReturnType<typeof vi.spyOn>) => spy.mock.calls.map((call: unknown[]) => JSON.parse(String(call[0])));

describe("scheduleGrading", () => {
  it("runs nothing now: it hands one task to after()", async () => {
    scheduleGrading("macro", ID);
    expect(mocks.after).toHaveBeenCalledTimes(1);
    expect(mocks.loadForGrading).not.toHaveBeenCalled();
    const task = mocks.after.mock.calls[0][0] as () => Promise<unknown>;
    await expect(task()).resolves.toBe("graded");
    expect(lines(logs)).toEqual([{ event: "grading.done", attemptId: ID, channel: "macro", outcome: "graded", score: 100 }]);
  });
});

describe("scheduleGrading for Try again and the U4 restart", () => {
  it.each(["retry", "restart"] as const)("logs %s as the channel", async (source) => {
    scheduleGrading(source, ID);
    expect(mocks.after).toHaveBeenCalledTimes(1);
    const task = mocks.after.mock.calls[0][0] as () => Promise<unknown>;
    await expect(task()).resolves.toBe("graded");
    expect(lines(logs)).toEqual([{ event: "grading.done", attemptId: ID, channel: source, outcome: "graded", score: 100 }]);
  });

  it("logs the source on a failure line too", async () => {
    mocks.readWorkbook.mockRejectedValue(new Error("Not an Excel workbook"));
    expect(await runGrading("retry", ID)).toBe("grading_failed");
    expect(lines(errors)).toEqual([{ event: "grading.file_unreadable", attemptId: ID, channel: "retry" }]);
  });
});

describe("runGrading", () => {
  it("grades on the service role: loads, downloads submission-1, reads it, writes graded + Result in one compare-and-set", async () => {
    expect(await runGrading("upload", ID)).toBe("graded");
    expect(mocks.loadForGrading).toHaveBeenCalledWith(SERVICE, ID);
    expect(mocks.downloadSubmissionFile).toHaveBeenCalledWith(SERVICE, ID, 1);
    expect(mocks.readWorkbook).toHaveBeenCalledWith(BYTES);
    expect(mocks.changeStatus).toHaveBeenCalledTimes(1);
    const [client, id, from, event, , options] = mocks.changeStatus.mock.calls[0];
    expect([client, id, from, event]).toEqual([SERVICE, ID, "received", "grade_ok"]);
    expect(resultSchema.parse(options.result)).toMatchObject({ score: 100, correctCount: 4 });
    expect(resultSchema.parse(options.result).questions.map((q) => q.tip)).toEqual(SNAPSHOT.questions.map((q) => q.tip));
    // The compare-and-set also matches the stamp loaded at run start (a stale run is lost).
    expect(options.gradingRequestedAt).toBe(STAMP);
    expect(errors).not.toHaveBeenCalled();
  });

  describe("hints (hintsUsed from load: the attempt's hint_reveals count)", () => {
    /** The real WorkbookIO on the L01-P1 `correct` golden fixture (all four questions right). */
    async function gradeCorrectL01P1(hintsUsed: number) {
      const actual = await vi.importActual<typeof import("@/adapters/workbook/read")>("@/adapters/workbook/read");
      mocks.readWorkbook.mockImplementation((bytes: Uint8Array) => actual.readWorkbook(bytes));
      mocks.downloadSubmissionFile.mockResolvedValue({ ok: true, value: await buildFixture("correct") });
      mocks.loadForGrading.mockResolvedValue({
        ok: true,
        value: { status: "received", snapshot: fixtureSnapshot(), gradingRequestedAt: STAMP, hintsUsed },
      });
      return runGrading("upload", ID);
    }

    it("L01-P1 all correct with 3 hints: writes a Result with hintsUsed 3, hintPenalty 15, score 85", async () => {
      expect(await gradeCorrectL01P1(3)).toBe("graded");
      const [, , , event, , options] = mocks.changeStatus.mock.calls[0];
      expect(event).toBe("grade_ok");
      expect(resultSchema.parse(options.result)).toMatchObject({
        hintsUsed: 3,
        hintPenalty: 15,
        pointsEarned: 100,
        score: 85,
        correctCount: 4,
      });
      expect(lines(logs)).toEqual([{ event: "grading.done", attemptId: ID, channel: "upload", outcome: "graded", score: 85 }]);
    }, 20_000);

    it("4 hints above the snapshot's quota of 3: grading_failed (grade_threw), no Result", async () => {
      expect(await gradeCorrectL01P1(4)).toBe("grading_failed");
      expect(mocks.changeStatus).toHaveBeenCalledWith(SERVICE, ID, "received", "grade_error", "attempt.grade_error_failed", {
        gradingRequestedAt: STAMP,
      });
      expect(lines(errors)).toEqual([{ event: "grading.grade_threw", attemptId: ID, channel: "upload" }]);
    }, 20_000);
  });

  it("logs a lower score for typed numbers", async () => {
    const cells = correctCells();
    cells.O2 = typed(10.2);
    mocks.readWorkbook.mockResolvedValue(readingOf(cells));
    await runGrading("macro", ID);
    expect(lines(logs)[0]).toMatchObject({ outcome: "graded", score: 70 });
  });

  it("writes grading_failed without a Result and logs grading.file_unreadable when the workbook cannot be read", async () => {
    mocks.readWorkbook.mockRejectedValue(new Error("Not an Excel workbook"));
    expect(await runGrading("macro", ID)).toBe("grading_failed");
    expect(mocks.changeStatus).toHaveBeenCalledWith(SERVICE, ID, "received", "grade_error", "attempt.grade_error_failed", {
      gradingRequestedAt: STAMP,
    });
    expect(lines(errors)).toEqual([{ event: "grading.file_unreadable", attemptId: ID, channel: "macro" }]);
    expect(lines(logs)[0]).toMatchObject({ outcome: "grading_failed", score: null });
  });

  it("logs grading.snapshot_invalid for a tracer attempt without a snapshot", async () => {
    mocks.loadForGrading.mockResolvedValue({ ok: true, value: { status: "received", snapshot: null, gradingRequestedAt: STAMP, hintsUsed: 0 } });
    expect(await runGrading("macro", ID)).toBe("grading_failed");
    expect(lines(errors)[0].event).toBe("grading.snapshot_invalid");
  });

  it("logs grading.snapshot_invalid for an attempt whose stored snapshot is v1 (no version, hintQuota, hints or Tips)", async () => {
    const omit = (object: object, ...keys: string[]) => Object.fromEntries(Object.entries(object).filter(([key]) => !keys.includes(key)));
    const v1 = { ...omit(SNAPSHOT, "version", "hintQuota"), questions: SNAPSHOT.questions.map((q) => omit(q, "hints", "tip")) };
    mocks.loadForGrading.mockResolvedValue({ ok: true, value: { status: "received", snapshot: v1, gradingRequestedAt: STAMP, hintsUsed: 0 } });
    expect(await runGrading("macro", ID)).toBe("grading_failed");
    expect(mocks.changeStatus).toHaveBeenCalledWith(SERVICE, ID, "received", "grade_error", "attempt.grade_error_failed", {
      gradingRequestedAt: STAMP,
    });
    expect(lines(errors)[0].event).toBe("grading.snapshot_invalid");
  });

  it("maps a lost compare-and-set (Abandon, or a newer run, came first) to lost, logged as grading.lost at info level, not an error", async () => {
    mocks.changeStatus.mockResolvedValue({ outcome: "lost" });
    expect(await runGrading("macro", ID)).toBe("lost");
    expect(errors).not.toHaveBeenCalled();
    expect(lines(logs)).toEqual([
      { event: "grading.lost", attemptId: ID, channel: "macro" },
      { event: "grading.done", attemptId: ID, channel: "macro", outcome: "lost", score: null },
    ]);
  });

  it("maps a failed compare-and-set to failed (grading.write_failed, an error)", async () => {
    mocks.changeStatus.mockResolvedValue({ outcome: "failed" });
    expect(await runGrading("macro", ID)).toBe("failed");
    expect(lines(errors)[0].event).toBe("grading.write_failed");
  });

  it("a missing submission-1: grading_failed at once (Try again, not a restart), logged grading.file_missing", async () => {
    mocks.downloadSubmissionFile.mockResolvedValue({ ok: true, value: null });
    expect(await runGrading("upload", ID)).toBe("grading_failed");
    expect(mocks.changeStatus).toHaveBeenCalledWith(SERVICE, ID, "received", "grade_error", "attempt.grade_error_failed", {
      gradingRequestedAt: STAMP,
    });
    expect(lines(errors)).toEqual([{ event: "grading.file_missing", attemptId: ID, channel: "upload" }]);
  });

  it("does not log an error for a skipped attempt (a duplicate or Abandon)", async () => {
    mocks.loadForGrading.mockResolvedValue({ ok: true, value: { status: "abandoned", snapshot: SNAPSHOT, gradingRequestedAt: STAMP, hintsUsed: 0 } });
    expect(await runGrading("macro", ID)).toBe("skipped");
    expect(errors).not.toHaveBeenCalled();
    expect(mocks.changeStatus).not.toHaveBeenCalled();
  });

  it("fails without the secret key, and never throws", async () => {
    mocks.createServiceClient.mockReturnValue(null);
    expect(await runGrading("macro", ID)).toBe("failed");
    expect(lines(errors)[0].event).toBe("grading.service_env_missing");
    mocks.createServiceClient.mockImplementation(() => {
      throw new TypeError("bad url");
    });
    expect(await runGrading("upload", ID)).toBe("failed");
    expect(lines(errors)[1]).toEqual({ event: "grading.threw", attemptId: ID, channel: "upload", code: "TypeError" });
  });

  it("logs no file bytes, key values or tokens, on success and on every failing path", async () => {
    const TOKEN = "tok_Zq81secretAttemptToken";
    const SECRET_BYTES = new TextEncoder().encode("PK-SECRET-WORKBOOK-BYTES");
    mocks.downloadSubmissionFile.mockResolvedValue({ ok: true, value: SECRET_BYTES });
    const leaky = (name: string) => Object.assign(new Error(`${TOKEN} key 12665.2656 bytes PK-SECRET-WORKBOOK-BYTES`), { name });

    // Graded, all correct.
    await runGrading("macro", ID);
    // Wrong values: graded with reasons (which never carry the key).
    const cells = correctCells();
    cells.H2 = { formula: "=1", value: 1, type: "number" };
    cells.O3 = { formula: "=2", value: "Lini B", type: "string" };
    mocks.readWorkbook.mockResolvedValueOnce(readingOf(cells));
    expect(await runGrading("macro", ID)).toBe("graded");
    // Unreadable: the reader's error message carries secrets.
    mocks.readWorkbook.mockRejectedValueOnce(leaky("Error"));
    expect(await runGrading("upload", ID)).toBe("grading_failed");
    // grade() throwing: a snapshot range grade() cannot expand.
    const broken = { ...SNAPSHOT, questions: SNAPSHOT.questions.map((q, i) => (i === 0 ? { ...q, range: "H3:H2" } : q)) };
    mocks.loadForGrading.mockResolvedValueOnce({ ok: true, value: { status: "received", snapshot: broken, gradingRequestedAt: STAMP, hintsUsed: 0 } });
    expect(await runGrading("macro", ID)).toBe("grading_failed");
    // Anything else throwing.
    mocks.loadForGrading.mockRejectedValueOnce(leaky("TypeError"));
    expect(await runGrading("upload", ID)).toBe("failed");

    const events = [...lines(logs), ...lines(errors)].map((line) => line.event);
    expect(events).toEqual(expect.arrayContaining(["grading.file_unreadable", "grading.grade_threw", "grading.threw"]));
    const all = [...logs.mock.calls, ...errors.mock.calls].map(([line]) => String(line)).join("\n");
    for (const secret of ["12665", "1200", "Lini A", TOKEN, "PK-SECRET", Array.from(SECRET_BYTES).join(",")]) {
      expect(all).not.toContain(secret);
    }
  });
});
