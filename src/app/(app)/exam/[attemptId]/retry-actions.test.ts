import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  }),
  getSessionUser: vi.fn(),
  readAttempt: vi.fn(),
  changeStatus: vi.fn(),
  createServiceClient: vi.fn(),
  scheduleGrading: vi.fn(),
}));
const SUPABASE = { session: true };
const SERVICE = { service: true };
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/adapters/supabase/auth", () => ({ getSessionUser: mocks.getSessionUser }));
vi.mock("@/adapters/supabase/server", () => ({ createClient: async () => SUPABASE }));
vi.mock("@/adapters/supabase/service", () => ({ createServiceClient: mocks.createServiceClient }));
vi.mock("@/app/api/submissions/grading", () => ({ scheduleGrading: mocks.scheduleGrading }));
vi.mock("@/adapters/supabase/attempts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/adapters/supabase/attempts")>();
  return { isAttemptId: actual.isAttemptId, readAttempt: mocks.readAttempt, changeStatus: mocks.changeStatus };
});

import { retryGrading, type RetryState } from "./retry-actions";

const ID = "0b9e0d6c-3f1a-4c2e-9d55-8a7b6c5d4e3f";
const IDLE: RetryState = { status: "idle" };

const attempt = (status: string) => ({
  id: ID,
  itemId: "L01-P1",
  status,
  templateVersion: 1,
  startedAt: "2026-11-02T01:00:00+00:00",
  receivedAt: "2026-11-02T01:01:00+00:00",
  gradingRequestedAt: "2026-11-02T01:01:00+00:00",
});

function form(attemptId: string | null = ID): FormData {
  const data = new FormData();
  if (attemptId !== null) data.set("attemptId", attemptId);
  return data;
}

let logs: ReturnType<typeof vi.spyOn>;
let errors: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  logs = vi.spyOn(console, "log").mockImplementation(() => {});
  errors = vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.getSessionUser.mockResolvedValue({ id: "user-1", email: null });
  mocks.readAttempt.mockResolvedValue({ ok: true, value: attempt("grading_failed") });
  mocks.createServiceClient.mockReturnValue(SERVICE);
  mocks.changeStatus.mockResolvedValue({ outcome: "changed", status: "received" });
});
afterEach(() => {
  vi.restoreAllMocks();
  for (const mock of Object.values(mocks)) mock.mockClear();
  mocks.getSessionUser.mockReset();
  mocks.readAttempt.mockReset();
  mocks.changeStatus.mockReset();
  mocks.createServiceClient.mockReset();
});

const lines = (spy: ReturnType<typeof vi.spyOn>) => spy.mock.calls.map((call: unknown[]) => JSON.parse(String(call[0])));

describe("retryGrading", () => {
  it("moves the owner's grading_failed attempt to received on the service role, then schedules a retry run", async () => {
    expect(await retryGrading(IDLE, form())).toEqual({ status: "retried" });
    expect(mocks.readAttempt).toHaveBeenCalledWith(SUPABASE, ID);
    expect(mocks.changeStatus).toHaveBeenCalledWith(
      SERVICE,
      ID,
      "grading_failed",
      "retry_grading",
      "attempt.retry_grading_failed",
    );
    expect(mocks.scheduleGrading).toHaveBeenCalledWith("retry", ID);
    expect(lines(logs)).toEqual([{ event: "attempt.grading_retried", attemptId: ID }]);
    expect(errors).not.toHaveBeenCalled();
  });

  it("without a session: Login, back to this exam, before any read", async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    await expect(retryGrading(IDLE, form())).rejects.toMatchObject({
      url: `/login?next=${encodeURIComponent(`/exam/${ID}`)}`,
    });
    expect(mocks.readAttempt).not.toHaveBeenCalled();
    expect(mocks.changeStatus).not.toHaveBeenCalled();
  });

  it.each([null, "", "not-a-uuid", `${ID}/x`])("is error for a malformed id (%s), without a read", async (id) => {
    expect(await retryGrading(IDLE, form(id))).toEqual({ status: "error" });
    expect(mocks.readAttempt).not.toHaveBeenCalled();
    expect(lines(errors)).toEqual([{ event: "attempt.retry_grading_failed", code: "bad_id" }]);
  });

  it("is error, with nothing written, for an attempt that is missing or someone else's, or when the read fails", async () => {
    mocks.readAttempt.mockResolvedValue({ ok: true, value: null });
    expect(await retryGrading(IDLE, form())).toEqual({ status: "error" });
    mocks.readAttempt.mockResolvedValue({ ok: false });
    expect(await retryGrading(IDLE, form())).toEqual({ status: "error" });
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
    expect(mocks.changeStatus).not.toHaveBeenCalled();
  });

  it.each(["open", "received", "graded", "abandoned", "closed"])("is unchanged, writing nothing, while %s", async (status) => {
    mocks.readAttempt.mockResolvedValue({ ok: true, value: attempt(status) });
    expect(await retryGrading(IDLE, form())).toEqual({ status: "unchanged" });
    expect(mocks.changeStatus).not.toHaveBeenCalled();
    expect(mocks.scheduleGrading).not.toHaveBeenCalled();
  });

  it.each(["lost", "refused"])("is unchanged when the compare-and-set is %s (another device, Abandon)", async (outcome) => {
    mocks.changeStatus.mockResolvedValue({ outcome });
    expect(await retryGrading(IDLE, form())).toEqual({ status: "unchanged" });
    expect(mocks.scheduleGrading).not.toHaveBeenCalled();
  });

  it("is error when the write fails (logged by the adapter)", async () => {
    mocks.changeStatus.mockResolvedValue({ outcome: "failed" });
    expect(await retryGrading(IDLE, form())).toEqual({ status: "error" });
    expect(mocks.scheduleGrading).not.toHaveBeenCalled();
  });

  it("is error without the service env", async () => {
    mocks.createServiceClient.mockReturnValue(null);
    expect(await retryGrading(IDLE, form())).toEqual({ status: "error" });
    expect(mocks.changeStatus).not.toHaveBeenCalled();
    expect(lines(errors)).toEqual([{ event: "attempt.retry_grading_failed", attemptId: ID, code: "service_env_missing" }]);
  });

  it("is error, logged as threw, when anything throws", async () => {
    mocks.changeStatus.mockRejectedValue(new TypeError("fetch failed"));
    expect(await retryGrading(IDLE, form())).toEqual({ status: "error" });
    expect(lines(errors)).toEqual([{ event: "attempt.retry_grading_failed", code: "threw", name: "TypeError" }]);
    expect(mocks.scheduleGrading).not.toHaveBeenCalled();
  });
});
