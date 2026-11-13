import { describe, expect, it, vi } from "vitest";
import { SNAPSHOT, correctCells, readingOf, typed } from "./__fixtures__/exam";
import { gradeAttempt, type CompleteOutcome, type GradingAttempt, type GradingPorts } from "./grade-attempt";
import { resultSchema } from "./result";
import type { WorkbookReading } from "./workbook-reading";

const ID = "0b9e0d6c-3f1a-4c2e-9d55-8a7b6c5d4e3f";
const BYTES = new Uint8Array([1, 2, 3]);
const STAMP = "2026-11-10T01:05:00+00:00";

function ports(overrides: {
  attempt?: GradingAttempt | null | "fail";
  file?: Uint8Array | null | "fail";
  reading?: WorkbookReading | "throw";
  complete?: CompleteOutcome;
} = {}) {
  const attempt =
    overrides.attempt === undefined ? { status: "received" as const, snapshot: SNAPSHOT, gradingRequestedAt: STAMP, hintsUsed: 0 } : overrides.attempt;
  const file = overrides.file === undefined ? BYTES : overrides.file;
  const reading = overrides.reading ?? readingOf(correctCells());
  const p = {
    load: vi.fn(async () => (attempt === "fail" ? { ok: false as const } : { ok: true as const, value: attempt })),
    readSubmission: vi.fn(async () => (file === "fail" ? { ok: false as const } : { ok: true as const, value: file })),
    readWorkbook: vi.fn(async () => {
      if (reading === "throw") throw new Error("Not an Excel workbook");
      return reading;
    }),
    complete: vi.fn(async () => overrides.complete ?? ("changed" as const)),
  } satisfies GradingPorts;
  return p;
}

/** A snapshot as Start wrote it before 3.4 (v1): not graded (U5). */
const V1_SNAPSHOT = {
  contentVersion: SNAPSHOT.contentVersion,
  scenarioId: SNAPSHOT.scenarioId,
  seed: SNAPSHOT.seed,
  questions: SNAPSHOT.questions.map((question) => Object.fromEntries(Object.entries(question).filter(([key]) => key !== "hints" && key !== "tip"))),
};

const run = (p: GradingPorts) => gradeAttempt(ID, p);

describe("gradeAttempt", () => {
  it("all correct: writes grade_ok with a 100 Result from the received attempt's file", async () => {
    const p = ports();
    const outcome = await run(p);
    expect(outcome).toEqual({ outcome: "graded", log: { attemptId: ID, outcome: "graded", score: 100, reason: null } });
    expect(p.load).toHaveBeenCalledWith(ID);
    expect(p.readSubmission).toHaveBeenCalledWith(ID);
    expect(p.readWorkbook).toHaveBeenCalledWith(BYTES);
    expect(p.complete).toHaveBeenCalledTimes(1);
    const [id, event, result, stamp] = p.complete.mock.calls[0] as unknown as [string, string, unknown, unknown];
    // The write matches the stamp this run loaded: a run superseded by Try again or a restart is lost.
    expect([id, event, stamp]).toEqual([ID, "grade_ok", STAMP]);
    expect(resultSchema.parse(result)).toMatchObject({ score: 100, correctCount: 4, questionCount: 4 });
  });

  it("copies each question's Tip from the snapshot into the Result", async () => {
    const p = ports();
    await run(p);
    const [, , result] = p.complete.mock.calls[0] as unknown as [string, string, unknown];
    const parsed = resultSchema.parse(result);
    expect(parsed.questions.map((q) => q.tip)).toEqual(SNAPSHOT.questions.map((q) => q.tip));
  });

  it("typed numbers in one range: graded with a lower score", async () => {
    const cells = correctCells();
    cells.H2 = typed(1200);
    const p = ports({ reading: readingOf(cells) });
    expect((await run(p)).log).toMatchObject({ outcome: "graded", score: 80 });
  });

  it("passes the loaded hintsUsed to grade()", async () => {
    const p = ports({ attempt: { status: "received", snapshot: SNAPSHOT, gradingRequestedAt: STAMP, hintsUsed: 2 } });
    expect((await gradeAttempt(ID, p)).log.score).toBe(90);
    const [, , result] = p.complete.mock.calls[0] as unknown as [string, string, unknown];
    expect(resultSchema.parse(result)).toMatchObject({ hintsUsed: 2, hintPenalty: 10, score: 90 });
  });

  it("a loaded hintsUsed above the snapshot's hintQuota: grading_failed (grade_threw)", async () => {
    const p = ports({ attempt: { status: "received", snapshot: SNAPSHOT, gradingRequestedAt: STAMP, hintsUsed: 4 } });
    expect((await gradeAttempt(ID, p)).log).toMatchObject({ outcome: "grading_failed", reason: "grade_threw" });
    expect(p.complete).toHaveBeenCalledWith(ID, "grade_error", null, STAMP);
  });

  it.each([
    ["a null snapshot (tracer attempt)", { attempt: { status: "received" as const, snapshot: null, gradingRequestedAt: STAMP, hintsUsed: 0 } }, "snapshot_invalid"],
    ["a stored v1 snapshot (no version, hintQuota, hints or Tips)", { attempt: { status: "received" as const, snapshot: V1_SNAPSHOT, gradingRequestedAt: STAMP, hintsUsed: 0 } }, "snapshot_invalid"],
    ["a snapshot failing examSnapshotSchema", { attempt: { status: "received" as const, snapshot: { ...SNAPSHOT, seed: -1 }, gradingRequestedAt: STAMP, hintsUsed: 0 } }, "snapshot_invalid"],
    ["an unreadable workbook", { reading: "throw" as const }, "file_unreadable"],
  ])("%s: writes grade_error with no Result", async (_, overrides, reason) => {
    const p = ports(overrides);
    expect(await run(p)).toEqual({ outcome: "grading_failed", log: { attemptId: ID, outcome: "grading_failed", score: null, reason } });
    expect(p.complete).toHaveBeenCalledWith(ID, "grade_error", null, STAMP);
  });

  it("a missing submission-1: grading_failed at once (file_missing), nothing a restart could fix", async () => {
    const p = ports({ file: null });
    expect(await run(p)).toEqual({
      outcome: "grading_failed",
      log: { attemptId: ID, outcome: "grading_failed", score: null, reason: "file_missing" },
    });
    expect(p.readWorkbook).not.toHaveBeenCalled();
    expect(p.complete).toHaveBeenCalledWith(ID, "grade_error", null, STAMP);
  });

  it("passes a null stamp through for a row received before the stamp existed", async () => {
    const p = ports({ attempt: { status: "received", snapshot: SNAPSHOT, gradingRequestedAt: null, hintsUsed: 0 } });
    expect((await run(p)).outcome).toBe("graded");
    expect((p.complete.mock.calls[0] as unknown[])[3]).toBeNull();
  });

  it("grade() throwing (a bug): grade_error, grade_threw", async () => {
    const broken = { ...SNAPSHOT };
    // Passes examSnapshotSchema (the range is only a string ≥ 2 there) but grade() cannot expand it.
    broken.questions = SNAPSHOT.questions.map((q, i) => (i === 0 ? { ...q, range: "H3:H2" } : q));
    const p = ports({ attempt: { status: "received", snapshot: broken, gradingRequestedAt: STAMP, hintsUsed: 0 } });
    expect((await run(p)).log).toMatchObject({ outcome: "grading_failed", reason: "grade_threw" });
    expect(p.complete).toHaveBeenCalledWith(ID, "grade_error", null, STAMP);
  });

  it.each(["open", "graded", "grading_failed", "abandoned", "closed"] as const)(
    "skips an attempt in %s without reading or writing",
    async (status) => {
      const p = ports({ attempt: { status, snapshot: SNAPSHOT, gradingRequestedAt: STAMP, hintsUsed: 0 } });
      expect(await run(p)).toMatchObject({ outcome: "skipped", log: { reason: "not_received" } });
      expect(p.readSubmission).not.toHaveBeenCalled();
      expect(p.complete).not.toHaveBeenCalled();
    },
  );

  it("skips an attempt that does not exist", async () => {
    const p = ports({ attempt: null });
    expect(await run(p)).toMatchObject({ outcome: "skipped", log: { reason: "not_found" } });
  });

  it("the store does not answer: nothing is written and the attempt stays received", async () => {
    let p = ports({ attempt: "fail" });
    expect((await run(p)).log).toMatchObject({ outcome: "failed", reason: "load_failed" });
    expect(p.complete).not.toHaveBeenCalled();
    p = ports({ file: "fail" });
    expect((await run(p)).log).toMatchObject({ outcome: "failed", reason: "file_read_failed" });
    expect(p.complete).not.toHaveBeenCalled();
    p = ports({ complete: "failed" });
    expect((await run(p)).log).toMatchObject({ outcome: "failed", reason: "write_failed", score: null });
    p = ports({ reading: "throw", complete: "failed" });
    expect((await run(p)).log).toMatchObject({ outcome: "failed", reason: "write_failed" });
  });

  it("a lost compare-and-set (Abandon came first): the Result is discarded", async () => {
    expect((await run(ports({ complete: "lost" }))).log).toEqual({ attemptId: ID, outcome: "lost", score: null, reason: "lost" });
    expect((await run(ports({ reading: "throw", complete: "lost" }))).log).toMatchObject({ outcome: "lost" });
  });
});
