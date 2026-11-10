import { describe, expect, it, vi } from "vitest";
import { SNAPSHOT, correctCells, readingOf, typed } from "./__fixtures__/exam";
import { gradeAttempt, type CompleteOutcome, type GradingAttempt, type GradingPorts } from "./grade-attempt";
import { resultSchema } from "./result";
import type { WorkbookReading } from "./workbook-reading";

const ID = "0b9e0d6c-3f1a-4c2e-9d55-8a7b6c5d4e3f";
const BYTES = new Uint8Array([1, 2, 3]);

function ports(overrides: {
  attempt?: GradingAttempt | null | "fail";
  file?: Uint8Array | null | "fail";
  reading?: WorkbookReading | "throw";
  complete?: CompleteOutcome;
} = {}) {
  const attempt = overrides.attempt === undefined ? { status: "received" as const, snapshot: SNAPSHOT } : overrides.attempt;
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

const run = (p: GradingPorts) => gradeAttempt(ID, p, { hintsUsed: 0 });

describe("gradeAttempt", () => {
  it("all correct: writes grade_ok with a 100 Result from the received attempt's file", async () => {
    const p = ports();
    const outcome = await run(p);
    expect(outcome).toEqual({ outcome: "graded", log: { attemptId: ID, outcome: "graded", score: 100, reason: null } });
    expect(p.load).toHaveBeenCalledWith(ID);
    expect(p.readSubmission).toHaveBeenCalledWith(ID);
    expect(p.readWorkbook).toHaveBeenCalledWith(BYTES);
    expect(p.complete).toHaveBeenCalledTimes(1);
    const [id, event, result] = p.complete.mock.calls[0] as unknown as [string, string, unknown];
    expect([id, event]).toEqual([ID, "grade_ok"]);
    expect(resultSchema.parse(result)).toMatchObject({ score: 100, correctCount: 4, questionCount: 4 });
  });

  it("typed numbers in one range: graded with a lower score", async () => {
    const cells = correctCells();
    cells.H2 = typed(1200);
    const p = ports({ reading: readingOf(cells) });
    expect((await run(p)).log).toMatchObject({ outcome: "graded", score: 80 });
  });

  it("passes hintsUsed to grade()", async () => {
    const p = ports();
    expect((await gradeAttempt(ID, p, { hintsUsed: 2 })).log.score).toBe(90);
  });

  it.each([
    ["a null snapshot (tracer attempt)", { attempt: { status: "received" as const, snapshot: null } }, "snapshot_invalid"],
    ["a snapshot failing examSnapshotSchema", { attempt: { status: "received" as const, snapshot: { ...SNAPSHOT, seed: -1 } } }, "snapshot_invalid"],
    ["an unreadable workbook", { reading: "throw" as const }, "file_unreadable"],
  ])("%s: writes grade_error with no Result", async (_, overrides, reason) => {
    const p = ports(overrides);
    expect(await run(p)).toEqual({ outcome: "grading_failed", log: { attemptId: ID, outcome: "grading_failed", score: null, reason } });
    expect(p.complete).toHaveBeenCalledWith(ID, "grade_error", null);
  });

  it("a missing submission-1: a retryable fault (file_missing), nothing written, the attempt stays received", async () => {
    const p = ports({ file: null });
    expect(await run(p)).toEqual({ outcome: "failed", log: { attemptId: ID, outcome: "failed", score: null, reason: "file_missing" } });
    expect(p.readWorkbook).not.toHaveBeenCalled();
    expect(p.complete).not.toHaveBeenCalled();
  });

  it("grade() throwing (a bug): grade_error, grade_threw", async () => {
    const broken = { ...SNAPSHOT };
    // Passes examSnapshotSchema (the range is only a string ≥ 2 there) but grade() cannot expand it.
    broken.questions = SNAPSHOT.questions.map((q, i) => (i === 0 ? { ...q, range: "H3:H2" } : q));
    const p = ports({ attempt: { status: "received", snapshot: broken } });
    expect((await run(p)).log).toMatchObject({ outcome: "grading_failed", reason: "grade_threw" });
    expect(p.complete).toHaveBeenCalledWith(ID, "grade_error", null);
  });

  it.each(["open", "graded", "grading_failed", "abandoned", "closed"] as const)(
    "skips an attempt in %s without reading or writing",
    async (status) => {
      const p = ports({ attempt: { status, snapshot: SNAPSHOT } });
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
