import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  abandon,
  ATTEMPT_COLUMNS,
  changeStatus,
  claimGradingRestart,
  createAttempt,
  deleteOpenAttempt,
  downloadGeneratedFile,
  downloadSubmissionFile,
  findAttemptByTokenHash,
  findOpenAttempt,
  findOpenAttemptId,
  generatedFilePath,
  hasValidResult,
  loadForGrading,
  markReceived,
  readAttempt,
  readResult,
  storeSubmissionFile,
  submissionFilePath,
  uploadGeneratedFile,
  writeSnapshot,
  XLSM_CONTENT_TYPE,
} from "./attempts";

type Result = { data: unknown; error: { code: string; message: string } | null };

const ID = "0b9e0d6c-3f1a-4c2e-9d55-8a7b6c5d4e3f";
const HASH = "a".repeat(64);

/**
 * A PostgREST query builder that records every call and answers `result` at
 * the end of the chain (an array: one answer per query, in order).
 */
function fakeClient(result: Result | Result[] | (() => Promise<Result>)) {
  const calls: [string, unknown[]][] = [];
  let query = 0;
  const answer = () =>
    typeof result === "function"
      ? result()
      : Promise.resolve(Array.isArray(result) ? result[query++] : result);
  const builder: Record<string, unknown> = {};
  for (const name of ["select", "insert", "update", "delete", "eq", "in", "is"]) {
    builder[name] = (...args: unknown[]) => (calls.push([name, args]), builder);
  }
  for (const name of ["single", "maybeSingle"]) {
    builder[name] = (...args: unknown[]) => (calls.push([name, args]), answer());
  }
  builder.then = (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) => answer().then(resolve, reject);
  const from = vi.fn(() => builder);
  return { client: { from } as unknown as SupabaseClient, from, calls };
}

let errors: { mock: { calls: unknown[][] } };
beforeEach(() => {
  errors = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

function expectNoHashLogged() {
  for (const [line] of errors.mock.calls) expect(String(line)).not.toContain(HASH);
}

describe("createAttempt", () => {
  const attempt = { itemId: "L01-P1", tokenSha256: HASH, templateVersion: 1 };

  it("inserts only item, token hash and template version (never the snapshot), and returns the new id", async () => {
    const { client, from, calls } = fakeClient({ data: { id: ID }, error: null });
    expect(await createAttempt(client, attempt)).toEqual({ ok: true, id: ID });
    expect(from).toHaveBeenCalledWith("attempts");
    expect(calls).toEqual([
      ["insert", [{ item_id: "L01-P1", token_sha256: HASH, template_version: 1 }]],
      ["select", ["id"]],
      ["single", []],
    ]);
  });

  it("maps the unique violation of the in-progress index to open_attempt_exists", async () => {
    const { client } = fakeClient({
      data: null,
      error: { code: "23505", message: 'duplicate key value violates unique constraint "attempts_one_in_progress_idx"' },
    });
    expect(await createAttempt(client, attempt)).toEqual({ ok: false, reason: "open_attempt_exists" });
  });

  it("treats any other unique violation (the token hash) as a failure", async () => {
    const { client } = fakeClient({
      data: null,
      error: { code: "23505", message: 'duplicate key value violates unique constraint "attempts_token_sha256_key"' },
    });
    expect(await createAttempt(client, attempt)).toEqual({ ok: false, reason: "failed" });
  });

  it("fails on any other error or a throw, and logs no hash", async () => {
    const denied = fakeClient({ data: null, error: { code: "42501", message: "denied" } });
    expect(await createAttempt(denied.client, attempt)).toEqual({ ok: false, reason: "failed" });
    const threw = fakeClient(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await createAttempt(threw.client, attempt)).toEqual({ ok: false, reason: "failed" });
    expect(errors).toHaveBeenCalledTimes(2);
    expectNoHashLogged();
  });
});

describe("writeSnapshot", () => {
  const snapshot = {
    contentVersion: 1,
    scenarioId: "baut-sinar-presisi",
    seed: 42,
    questions: [
      {
        number: 1,
        prompt: "Di H2:H3, hitung Total Biaya.",
        points: 100,
        sheet: "Data",
        range: "H2:H3",
        checks: [{ name: "value_equals_key" as const, tolerance: 1e-9 }],
        key: { H2: 10, H3: 20 },
      },
    ],
  };

  it("sets the snapshot of the user's attempt only while it is still null", async () => {
    const { client, calls } = fakeClient({ data: [{ id: ID }], error: null });
    expect(await writeSnapshot(client, ID, "user-1", snapshot)).toBe(true);
    expect(calls).toEqual([
      ["update", [{ snapshot }]],
      ["eq", ["id", ID]],
      ["eq", ["user_id", "user-1"]],
      ["is", ["snapshot", null]],
      ["select", ["id"]],
    ]);
  });

  it.each([
    ["no row matched", { data: [], error: null }],
    ["the database refused", { data: null, error: { code: "42501", message: "denied" } }],
  ])("fails when %s, and logs no key", async (_, result) => {
    const { client } = fakeClient(result as Result);
    expect(await writeSnapshot(client, ID, "user-1", snapshot)).toBe(false);
    expect(errors).toHaveBeenCalledTimes(1);
    expect(String(errors.mock.calls[0][0])).not.toContain("H2");
  });

  it("fails on a throw", async () => {
    const { client } = fakeClient(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await writeSnapshot(client, ID, "user-1", snapshot)).toBe(false);
  });
});

describe("deleteOpenAttempt", () => {
  it("deletes the attempt only while it is open", async () => {
    const { client, calls } = fakeClient({ data: [{ id: ID }], error: null });
    expect(await deleteOpenAttempt(client, ID)).toBe(true);
    expect(calls).toEqual([
      ["delete", []],
      ["eq", ["id", ID]],
      ["eq", ["status", "open"]],
      ["select", ["id"]],
    ]);
  });

  it("is false when no row was deleted (no longer open, or not the user's)", async () => {
    expect(await deleteOpenAttempt(fakeClient({ data: [], error: null }).client, ID)).toBe(false);
  });

  it("is false when the delete fails", async () => {
    const { client } = fakeClient({ data: null, error: { code: "42501", message: "denied" } });
    expect(await deleteOpenAttempt(client, ID)).toBe(false);
  });
});

describe("findOpenAttempt", () => {
  const row = {
    id: ID,
    item_id: "L01-P1",
    status: "received",
    template_version: 1,
    started_at: "2026-11-02T01:00:00+00:00",
    received_at: "2026-11-02T01:10:00+00:00",
    grading_requested_at: "2026-11-02T01:12:00+00:00",
    grading_restarts: 1,
  };

  it("reads the user's attempt in open, received or grading_failed, with the attempt columns", async () => {
    const { client, calls } = fakeClient({ data: row, error: null });
    expect(await findOpenAttempt(client, "user-1")).toEqual({
      ok: true,
      value: {
        id: ID,
        itemId: "L01-P1",
        status: "received",
        templateVersion: 1,
        startedAt: row.started_at,
        receivedAt: row.received_at,
        gradingRequestedAt: row.grading_requested_at,
        gradingRestarts: 1,
      },
    });
    expect(calls).toEqual([
      ["select", [ATTEMPT_COLUMNS]],
      ["eq", ["user_id", "user-1"]],
      ["in", ["status", ["open", "received", "grading_failed"]]],
      ["maybeSingle", []],
    ]);
  });

  it("is null without one, not ok on an error or a throw", async () => {
    expect(await findOpenAttempt(fakeClient({ data: null, error: null }).client, "user-1")).toEqual({ ok: true, value: null });
    const failed = fakeClient({ data: null, error: { code: "08006", message: "x" } });
    expect(await findOpenAttempt(failed.client, "user-1")).toEqual({ ok: false });
    const threw = fakeClient(() => Promise.reject(new TypeError("fetch failed")));
    expect(await findOpenAttempt(threw.client, "user-1")).toEqual({ ok: false });
    expect(errors).toHaveBeenCalledTimes(2);
  });
});

describe("findOpenAttemptId", () => {
  it("is the id of findOpenAttempt's row (one query)", async () => {
    const { client, from } = fakeClient({
      data: { id: ID, item_id: "L01-P1", status: "open", template_version: 1, started_at: "2026-11-02T01:00:00+00:00", received_at: null },
      error: null,
    });
    expect(await findOpenAttemptId(client, "user-1")).toEqual({ ok: true, value: ID });
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("is null without one and not ok on an error", async () => {
    expect(await findOpenAttemptId(fakeClient({ data: null, error: null }).client, "user-1")).toEqual({ ok: true, value: null });
    const failed = fakeClient({ data: null, error: { code: "08006", message: "x" } });
    expect(await findOpenAttemptId(failed.client, "user-1")).toEqual({ ok: false });
  });
});

describe("readAttempt", () => {
  const row = {
    id: ID,
    item_id: "L01-P1",
    status: "open",
    template_version: 1,
    started_at: "2026-11-02T01:00:00+00:00",
    received_at: null,
    grading_requested_at: null,
    grading_restarts: 0,
  };

  it("maps the row", async () => {
    const { client, calls } = fakeClient({ data: row, error: null });
    expect(await readAttempt(client, ID)).toEqual({
      ok: true,
      value: {
        id: ID,
        itemId: "L01-P1",
        status: "open",
        templateVersion: 1,
        startedAt: row.started_at,
        receivedAt: null,
        gradingRequestedAt: null,
        gradingRestarts: 0,
      },
    });
    expect(calls[1]).toEqual(["eq", ["id", ID]]);
  });

  it("is null for an attempt RLS hides (not the owner, or none)", async () => {
    expect(await readAttempt(fakeClient({ data: null, error: null }).client, ID)).toEqual({ ok: true, value: null });
  });

  it("is null for a segment that is not a uuid, without asking the database", async () => {
    const { client, from } = fakeClient({ data: row, error: null });
    expect(await readAttempt(client, "not-a-uuid")).toEqual({ ok: true, value: null });
    expect(from).not.toHaveBeenCalled();
  });

  it("is not ok when the read fails", async () => {
    expect(await readAttempt(fakeClient({ data: null, error: { code: "PGRST301", message: "jwt" } }).client, ID)).toEqual({
      ok: false,
    });
  });
});

describe("attempt files", () => {
  function fakeStorage(answers: { upload?: Result; download?: Result }) {
    const upload = vi.fn(async () => answers.upload ?? { data: {}, error: null });
    const download = vi.fn(async () => answers.download ?? { data: null, error: null });
    const from = vi.fn(() => ({ upload, download }));
    return { client: { storage: { from } } as unknown as SupabaseClient, from, upload, download };
  }

  it("stores the generated file once at <attemptId>/generated.xlsm", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const { client, from, upload } = fakeStorage({});
    expect(await uploadGeneratedFile(client, ID, bytes)).toBe(true);
    expect(generatedFilePath(ID)).toBe(`${ID}/generated.xlsm`);
    expect(from).toHaveBeenCalledWith("attempt-files");
    expect(upload).toHaveBeenCalledWith(`${ID}/generated.xlsm`, bytes, { contentType: XLSM_CONTENT_TYPE, upsert: false });
  });

  it("reports a failed upload", async () => {
    const { client } = fakeStorage({ upload: { data: null, error: { code: "403", message: "row-level security" } } });
    expect(await uploadGeneratedFile(client, ID, new Uint8Array([1]))).toBe(false);
  });

  it("stores a submission once at <attemptId>/submission-<n>.xlsm", async () => {
    const bytes = new Uint8Array([4, 5, 6]);
    const { client, from, upload } = fakeStorage({});
    expect(await storeSubmissionFile(client, ID, 1, bytes)).toBe("stored");
    expect(submissionFilePath(ID, 1)).toBe(`${ID}/submission-1.xlsm`);
    expect(from).toHaveBeenCalledWith("attempt-files");
    expect(upload).toHaveBeenCalledWith(`${ID}/submission-1.xlsm`, bytes, { contentType: XLSM_CONTENT_TYPE, upsert: false });
  });

  it("upserts submission-<n> with replace: true", async () => {
    const bytes = new Uint8Array([7]);
    const { client, upload } = fakeStorage({});
    expect(await storeSubmissionFile(client, ID, 1, bytes, { replace: true })).toBe("stored");
    expect(upload).toHaveBeenCalledWith(`${ID}/submission-1.xlsm`, bytes, { contentType: XLSM_CONTENT_TYPE, upsert: true });
  });

  it.each([
    ["statusCode 409", { statusCode: "409", error: "Duplicate", message: "The resource already exists" }],
    ["status 409", { status: 409, message: "exists" }],
    ["code ResourceAlreadyExists", { status: 400, code: "ResourceAlreadyExists", message: "exists" }],
    ["error Duplicate", { error: "Duplicate", message: "The resource already exists" }],
  ])("reports an existing submission (%s) as exists, without replacing it", async (_, error) => {
    const { client, upload } = fakeStorage({ upload: { data: null, error } as unknown as Result });
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await storeSubmissionFile(client, ID, 1, new Uint8Array([1]))).toBe("exists");
    expect(upload).toHaveBeenCalledTimes(1);
    expect(errors).not.toHaveBeenCalled();
  });

  it("reports and logs a failed submission store", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fakeStorage({ upload: { data: null, error: { code: "403", message: "row-level security" } } });
    expect(await storeSubmissionFile(client, ID, 1, new Uint8Array([1]))).toBe("failed");
    expect(errors).toHaveBeenCalledWith(JSON.stringify({ event: "attempt.submission_store_failed", code: "403" }));
    const throwing = { storage: { from: () => ({ upload: async () => { throw new TypeError("fetch failed"); } }) } };
    expect(await storeSubmissionFile(throwing as unknown as SupabaseClient, ID, 1, new Uint8Array([1]))).toBe("failed");
    expect(errors).toHaveBeenLastCalledWith(JSON.stringify({ event: "attempt.submission_store_failed", code: "TypeError" }));
  });

  it("refuses a submission number that is not a positive integer", () => {
    expect(() => submissionFilePath(ID, 0)).toThrow();
    expect(() => submissionFilePath(ID, 1.5)).toThrow();
  });

  it("reads the stored bytes back", async () => {
    const { client, download } = fakeStorage({ download: { data: new Blob([new Uint8Array([7, 8, 9])]), error: null } });
    expect(await downloadGeneratedFile(client, ID)).toEqual(new Uint8Array([7, 8, 9]));
    expect(download).toHaveBeenCalledWith(`${ID}/generated.xlsm`);
  });

  it("is null when the file cannot be read", async () => {
    const { client } = fakeStorage({ download: { data: null, error: { code: "404", message: "not found" } } });
    expect(await downloadGeneratedFile(client, ID)).toBeNull();
  });
});

describe("findAttemptByTokenHash (service role)", () => {
  it("finds the attempt by the full token hash", async () => {
    const { client, calls } = fakeClient({ data: { id: ID, user_id: "user-1", status: "open", template_version: 1 }, error: null });
    expect(await findAttemptByTokenHash(client, HASH)).toEqual({
      ok: true,
      value: { id: ID, userId: "user-1", status: "open", templateVersion: 1 },
    });
    expect(calls).toEqual([
      ["select", ["id, user_id, status, template_version"]],
      ["eq", ["token_sha256", HASH]],
      ["maybeSingle", []],
    ]);
  });

  it("is null for a token no attempt has, not ok on an error, and logs no hash", async () => {
    expect(await findAttemptByTokenHash(fakeClient({ data: null, error: null }).client, HASH)).toEqual({ ok: true, value: null });
    const failed = fakeClient({ data: null, error: { code: "08006", message: HASH } });
    expect(await findAttemptByTokenHash(failed.client, HASH)).toEqual({ ok: false });
    expectNoHashLogged();
  });
});

describe("markReceived (service role)", () => {
  it("is a compare-and-set from open to received", async () => {
    const { client, calls } = fakeClient({ data: [{ id: ID }], error: null });
    expect(await markReceived(client, ID)).toEqual({ ok: true, value: true });
    expect(calls).toEqual([
      ["update", [{ status: "received" }]],
      ["eq", ["id", ID]],
      ["eq", ["status", "open"]],
      ["select", ["id"]],
    ]);
  });

  it("changes nothing when the attempt is no longer open", async () => {
    expect(await markReceived(fakeClient({ data: [], error: null }).client, ID)).toEqual({ ok: true, value: false });
  });

  it("is not ok when the update fails or throws", async () => {
    expect(await markReceived(fakeClient({ data: null, error: { code: "42501", message: "x" } }).client, ID)).toEqual({ ok: false });
    const threw = fakeClient(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await markReceived(threw.client, ID)).toEqual({ ok: false });
  });
});

describe("changeStatus (AD-5)", () => {
  it("asks the state machine, then writes with a compare-and-set on the old status", async () => {
    const { client, calls } = fakeClient({ data: [{ id: ID }], error: null });
    expect(await changeStatus(client, ID, "received", "abandon")).toEqual({ outcome: "changed", status: "abandoned" });
    expect(calls).toEqual([
      ["update", [{ status: "abandoned" }]],
      ["eq", ["id", ID]],
      ["eq", ["status", "received"]],
      ["select", ["id"]],
    ]);
  });

  it("sends no query for a transition AD-5 refuses", async () => {
    for (const [from, event] of [
      ["graded", "abandon"],
      ["open", "grade_ok"],
      ["abandoned", "submit_accepted"],
    ] as const) {
      const { client, from: fromTable } = fakeClient({ data: [{ id: ID }], error: null });
      expect(await changeStatus(client, ID, from, event)).toEqual({ outcome: "refused" });
      expect(fromTable).not.toHaveBeenCalled();
    }
  });

  it("is lost when no row matched the old status, failed on an error or a throw", async () => {
    expect(await changeStatus(fakeClient({ data: [], error: null }).client, ID, "open", "abandon")).toEqual({ outcome: "lost" });
    const denied = fakeClient({ data: null, error: { code: "42501", message: "x" } });
    expect(await changeStatus(denied.client, ID, "open", "abandon")).toEqual({ outcome: "failed" });
    const threw = fakeClient(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await changeStatus(threw.client, ID, "open", "abandon")).toEqual({ outcome: "failed" });
    expect(errors).toHaveBeenCalledTimes(2);
  });
});

describe("claimGradingRestart (service role, U4)", () => {
  function fakeRpc(answer: () => Promise<Result>) {
    const rpc = vi.fn(answer);
    return { client: { rpc } as unknown as SupabaseClient, rpc };
  }

  it("calls claim_grading_restart with the attempt id and is true for the winner", async () => {
    const { client, rpc } = fakeRpc(async () => ({ data: true, error: null }));
    expect(await claimGradingRestart(client, ID)).toEqual({ ok: true, value: true });
    expect(rpc).toHaveBeenCalledWith("claim_grading_restart", { p_attempt_id: ID });
  });

  it("is false when the claim matched no row (within 15 s, or not received)", async () => {
    expect(await claimGradingRestart(fakeRpc(async () => ({ data: false, error: null })).client, ID)).toEqual({
      ok: true,
      value: false,
    });
  });

  it("is false for a segment that is not a uuid, without asking the database", async () => {
    const { client, rpc } = fakeRpc(async () => ({ data: true, error: null }));
    expect(await claimGradingRestart(client, "not-a-uuid")).toEqual({ ok: true, value: false });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("is not ok on an error or a throw, logged as attempt.claim_restart_failed with the code", async () => {
    const failed = fakeRpc(async () => ({ data: null, error: { code: "42501", message: "denied" } }));
    expect(await claimGradingRestart(failed.client, ID)).toEqual({ ok: false });
    const threw = fakeRpc(() => Promise.reject(new TypeError("fetch failed")));
    expect(await claimGradingRestart(threw.client, ID)).toEqual({ ok: false });
    expect(errors.mock.calls.map(([line]) => JSON.parse(String(line)))).toEqual([
      { event: "attempt.claim_restart_failed", code: "42501" },
      { event: "attempt.claim_restart_failed", code: "TypeError" },
    ]);
  });
});

describe("abandon (session)", () => {
  const row = (status: string) => ({
    id: ID,
    item_id: "L01-P1",
    status,
    template_version: 1,
    started_at: "2026-11-02T01:00:00+00:00",
    received_at: status === "open" ? null : "2026-11-02T01:10:00+00:00",
  });

  it.each(["open", "received", "grading_failed"])("moves %s to abandoned with a compare-and-set", async (status) => {
    const { client, calls } = fakeClient([
      { data: row(status), error: null },
      { data: [{ id: ID }], error: null },
    ]);
    expect(await abandon(client, ID)).toEqual({ outcome: "changed", status: "abandoned" });
    expect(calls.slice(-4)).toEqual([
      ["update", [{ status: "abandoned" }]],
      ["eq", ["id", ID]],
      ["eq", ["status", status]],
      ["select", ["id"]],
    ]);
  });

  it.each(["graded", "abandoned", "closed"])("refuses %s without an update", async (status) => {
    const { client, calls } = fakeClient([{ data: row(status), error: null }]);
    expect(await abandon(client, ID)).toEqual({ outcome: "refused" });
    expect(calls.some(([name]) => name === "update")).toBe(false);
  });

  it("is lost when the status changed between the read and the write", async () => {
    const { client } = fakeClient([
      { data: row("open"), error: null },
      { data: [], error: null },
    ]);
    expect(await abandon(client, ID)).toEqual({ outcome: "lost" });
  });

  it("is not_found for an attempt RLS hides, failed when the read fails", async () => {
    expect(await abandon(fakeClient([{ data: null, error: null }]).client, ID)).toEqual({ outcome: "not_found" });
    const failed = fakeClient([{ data: null, error: { code: "08006", message: "x" } }]);
    expect(await abandon(failed.client, ID)).toEqual({ outcome: "failed" });
  });
});

describe("changeStatus with a Result (grading)", () => {
  const RESULT = { version: 1, score: 100 } as never;

  it("writes the Result in the same compare-and-set UPDATE as graded", async () => {
    const { client, calls } = fakeClient({ data: [{ id: ID }], error: null });
    expect(await changeStatus(client, ID, "received", "grade_ok", "grading.x", { result: RESULT })).toEqual({
      outcome: "changed",
      status: "graded",
    });
    expect(calls).toEqual([
      ["update", [{ status: "graded", result: RESULT }]],
      ["eq", ["id", ID]],
      ["eq", ["status", "received"]],
      ["select", ["id"]],
    ]);
  });

  it("also matches the grading request's stamp the run loaded, so a superseded run is lost", async () => {
    const stamp = "2026-11-10T01:05:00+00:00";
    const { client, calls } = fakeClient({ data: [], error: null });
    expect(
      await changeStatus(client, ID, "received", "grade_ok", "grading.x", { result: RESULT, gradingRequestedAt: stamp }),
    ).toEqual({ outcome: "lost" });
    expect(calls).toEqual([
      ["update", [{ status: "graded", result: RESULT }]],
      ["eq", ["id", ID]],
      ["eq", ["status", "received"]],
      ["eq", ["grading_requested_at", stamp]],
      ["select", ["id"]],
    ]);
    const legacy = fakeClient({ data: [{ id: ID }], error: null });
    expect(await changeStatus(legacy.client, ID, "received", "grade_error", "grading.x", { gradingRequestedAt: null })).toEqual({
      outcome: "changed",
      status: "grading_failed",
    });
    expect(legacy.calls[3]).toEqual(["is", ["grading_requested_at", null]]);
  });

  it("writes grading_failed without a Result, and nothing for a refused edge", async () => {
    const { client, calls } = fakeClient({ data: [{ id: ID }], error: null });
    expect(await changeStatus(client, ID, "received", "grade_error")).toEqual({ outcome: "changed", status: "grading_failed" });
    expect(calls[0]).toEqual(["update", [{ status: "grading_failed" }]]);
    const refused = fakeClient({ data: [{ id: ID }], error: null });
    expect(await changeStatus(refused.client, ID, "abandoned", "grade_ok", undefined, { result: RESULT })).toEqual({ outcome: "refused" });
    expect(refused.from).not.toHaveBeenCalled();
  });

  it("refuses a Result on any transition whose next status is not graded, before any query", async () => {
    for (const [from, event] of [
      ["received", "grade_error"],
      ["received", "abandon"],
      ["open", "submit_accepted"],
    ] as const) {
      const { client, from: fromSpy } = fakeClient({ data: [{ id: ID }], error: null });
      expect(await changeStatus(client, ID, from, event, undefined, { result: RESULT })).toEqual({ outcome: "refused" });
      expect(fromSpy).not.toHaveBeenCalled();
    }
  });
});

describe("loadForGrading (service role)", () => {
  it("reads status, snapshot and the grading request's stamp by id", async () => {
    const snapshot = { contentVersion: 1 };
    const stamp = "2026-11-10T01:05:00+00:00";
    const { client, calls } = fakeClient({ data: { status: "received", snapshot, grading_requested_at: stamp }, error: null });
    expect(await loadForGrading(client, ID)).toEqual({
      ok: true,
      value: { status: "received", snapshot, gradingRequestedAt: stamp },
    });
    expect(calls).toEqual([
      ["select", ["status, snapshot, grading_requested_at"]],
      ["eq", ["id", ID]],
      ["maybeSingle", []],
    ]);
  });

  it("is null without a row (or for a malformed id), not ok on an error or a throw", async () => {
    expect(await loadForGrading(fakeClient({ data: null, error: null }).client, ID)).toEqual({ ok: true, value: null });
    const unused = fakeClient({ data: null, error: null });
    expect(await loadForGrading(unused.client, "nope")).toEqual({ ok: true, value: null });
    expect(unused.from).not.toHaveBeenCalled();
    expect(await loadForGrading(fakeClient({ data: null, error: { code: "08006", message: "x" } }).client, ID)).toEqual({ ok: false });
    expect(errors).toHaveBeenLastCalledWith(JSON.stringify({ event: "attempt.load_for_grading_failed", code: "08006" }));
    const threw = fakeClient(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await loadForGrading(threw.client, ID)).toEqual({ ok: false });
  });
});

describe("downloadSubmissionFile (service role)", () => {
  function storage(answer: Result | (() => Promise<Result>)) {
    const download = vi.fn(typeof answer === "function" ? answer : async () => answer);
    const from = vi.fn(() => ({ download }));
    return { client: { storage: { from } } as unknown as SupabaseClient, from, download };
  }

  it("reads submission-1's bytes", async () => {
    const { client, from, download } = storage({ data: new Blob([new Uint8Array([1, 2])]), error: null } as unknown as Result);
    expect(await downloadSubmissionFile(client, ID)).toEqual({ ok: true, value: new Uint8Array([1, 2]) });
    expect(from).toHaveBeenCalledWith("attempt-files");
    expect(download).toHaveBeenCalledWith(`${ID}/submission-1.xlsm`);
  });

  it.each([
    ["status 404", { status: 404, message: "Not Found" }],
    ["statusCode 404 (HTTP 400)", { status: 400, statusCode: "404", message: "Object not found" }],
    ["NoSuchKey", { status: 400, code: "NoSuchKey", message: "x" }],
  ])("is null when the object is missing (%s)", async (_, error) => {
    const { client } = storage({ data: null, error } as unknown as Result);
    expect(await downloadSubmissionFile(client, ID)).toEqual({ ok: true, value: null });
    expect(errors).not.toHaveBeenCalled();
  });

  it("is not ok when Storage fails or throws", async () => {
    const { client } = storage({ data: null, error: { status: 500, message: "boom" } } as unknown as Result);
    expect(await downloadSubmissionFile(client, ID)).toEqual({ ok: false });
    expect(errors).toHaveBeenLastCalledWith(JSON.stringify({ event: "attempt.submission_download_failed", code: "500" }));
    const threw = storage(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await downloadSubmissionFile(threw.client, ID)).toEqual({ ok: false });
  });

  it("is null for a malformed attempt id, without asking Storage", async () => {
    const { client, from } = storage({ data: null, error: null });
    expect(await downloadSubmissionFile(client, "../other/submission")).toEqual({ ok: true, value: null });
    expect(from).not.toHaveBeenCalled();
  });
});

describe("readResult (session)", () => {
  it("reads item and result of the user's attempt", async () => {
    const result = { version: 1 };
    const { client, calls } = fakeClient({ data: { item_id: "L01-P1", result }, error: null });
    expect(await readResult(client, ID)).toEqual({ ok: true, value: { itemId: "L01-P1", result } });
    expect(calls).toEqual([
      ["select", ["item_id, result"]],
      ["eq", ["id", ID]],
      ["maybeSingle", []],
    ]);
  });

  it("is null for no row (RLS), a null result, or a malformed id; not ok on an error", async () => {
    expect(await readResult(fakeClient({ data: null, error: null }).client, ID)).toEqual({ ok: true, value: null });
    expect(await readResult(fakeClient({ data: { item_id: "L01-P1", result: null }, error: null }).client, ID)).toEqual({
      ok: true,
      value: null,
    });
    const unused = fakeClient({ data: null, error: null });
    expect(await readResult(unused.client, "x")).toEqual({ ok: true, value: null });
    expect(unused.from).not.toHaveBeenCalled();
    expect(await readResult(fakeClient({ data: null, error: { code: "42501", message: "x" } }).client, ID)).toEqual({ ok: false });
  });
});

describe("hasValidResult (session)", () => {
  const VALID = {
    version: 1,
    contentVersion: 1,
    scenarioId: "baut-sinar-presisi",
    hintsUsed: 0,
    hintPenalty: 0,
    pointsEarned: 20,
    score: 20,
    correctCount: 1,
    questionCount: 2,
    questions: [
      { number: 1, points: 20, pointsAwarded: 20, correct: true, reasonText: null, tip: null },
      { number: 2, points: 80, pointsAwarded: 0, correct: false, reasonText: "Sel B2 masih kosong.", tip: null },
    ],
  };
  const row = (result: unknown) => fakeClient({ data: { item_id: "L01-P1", result }, error: null }).client;

  it("is true only for a stored Result that passes resultSchema", async () => {
    expect(await hasValidResult(row(VALID), ID)).toEqual({ ok: true, value: true });
  });

  it("is false for no Result, and for one failing resultSchema (logged without its content)", async () => {
    expect(await hasValidResult(row(null), ID)).toEqual({ ok: true, value: false });
    expect(await hasValidResult(fakeClient({ data: null, error: null }).client, ID)).toEqual({ ok: true, value: false });
    expect(await hasValidResult(row({ ...VALID, score: 99 }), ID)).toEqual({ ok: true, value: false });
    expect(await hasValidResult(row({ version: 1 }), ID)).toEqual({ ok: true, value: false });
    expect(errors).toHaveBeenLastCalledWith(JSON.stringify({ event: "attempt.result_invalid", code: "schema" }));
  });

  it("is not ok when the read fails", async () => {
    expect(await hasValidResult(fakeClient({ data: null, error: { code: "08006", message: "x" } }).client, ID)).toEqual({
      ok: false,
    });
  });
});
