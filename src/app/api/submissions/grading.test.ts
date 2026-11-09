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
import { resultSchema } from "@/core/grading";
import { runGrading, scheduleGrading } from "./grading";

const ID = "0b9e0d6c-3f1a-4c2e-9d55-8a7b6c5d4e3f";
const SERVICE = { service: true };
const BYTES = new Uint8Array([9, 9]);

let logs: ReturnType<typeof vi.spyOn>;
let errors: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  logs = vi.spyOn(console, "log").mockImplementation(() => {});
  errors = vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.createServiceClient.mockReturnValue(SERVICE);
  mocks.loadForGrading.mockResolvedValue({ ok: true, value: { status: "received", snapshot: SNAPSHOT } });
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
    expect(errors).not.toHaveBeenCalled();
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
    expect(mocks.changeStatus).toHaveBeenCalledWith(SERVICE, ID, "received", "grade_error", "attempt.grade_error_failed", {});
    expect(lines(errors)).toEqual([{ event: "grading.file_unreadable", attemptId: ID, channel: "macro" }]);
    expect(lines(logs)[0]).toMatchObject({ outcome: "grading_failed", score: null });
  });

  it("logs grading.snapshot_invalid for a tracer attempt without a snapshot", async () => {
    mocks.loadForGrading.mockResolvedValue({ ok: true, value: { status: "received", snapshot: null } });
    expect(await runGrading("macro", ID)).toBe("grading_failed");
    expect(lines(errors)[0].event).toBe("grading.snapshot_invalid");
  });

  it("maps a lost compare-and-set to lost (grading.lost) and a failed one to failed", async () => {
    mocks.changeStatus.mockResolvedValue({ outcome: "lost" });
    expect(await runGrading("macro", ID)).toBe("lost");
    expect(lines(errors)[0].event).toBe("grading.lost");
    mocks.changeStatus.mockResolvedValue({ outcome: "failed" });
    expect(await runGrading("macro", ID)).toBe("failed");
    expect(lines(errors)[1].event).toBe("grading.write_failed");
  });

  it("does not log an error for a skipped attempt (a duplicate or Abandon)", async () => {
    mocks.loadForGrading.mockResolvedValue({ ok: true, value: { status: "abandoned", snapshot: SNAPSHOT } });
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

  it("logs no file bytes, key values or tokens", async () => {
    await runGrading("macro", ID);
    const all = [...logs.mock.calls, ...errors.mock.calls].map(([line]) => String(line)).join("\n");
    expect(all).not.toContain("12665");
    expect(all).not.toContain("1200");
  });
});
