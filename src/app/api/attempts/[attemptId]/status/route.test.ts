import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  readAttempt: vi.fn(),
  hasValidResult: vi.fn(),
  claimGradingRestart: vi.fn(),
  createServiceClient: vi.fn(),
  loadForGrading: vi.fn(),
  changeStatus: vi.fn(),
  after: vi.fn(),
}));
const SUPABASE = { session: true };
const SERVICE = { service: true };
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@/adapters/supabase/auth", () => ({ getSessionUser: mocks.getSessionUser }));
vi.mock("@/adapters/supabase/server", () => ({ createClient: async () => SUPABASE }));
vi.mock("@/adapters/supabase/service", () => ({ createServiceClient: mocks.createServiceClient }));
vi.mock("@/adapters/supabase/attempts", () => ({
  readAttempt: mocks.readAttempt,
  hasValidResult: mocks.hasValidResult,
  claimGradingRestart: mocks.claimGradingRestart,
  // The grading run the restart schedules (`runGrading`), as far as this test lets it go.
  loadForGrading: mocks.loadForGrading,
  changeStatus: mocks.changeStatus,
  downloadSubmissionFile: vi.fn(),
}));

import { GET } from "./route";

const ID = "0b9e0d6c-3f1a-4c2e-9d55-8a7b6c5d4e3f";
const NOW = Date.parse("2026-11-02T01:02:05.900Z");

/** Received 65 s before NOW; grading requested 10 s before NOW unless given. */
const attempt = (status: string, gradingRequestedAt: string | null = "2026-11-02T01:01:55+00:00", gradingRestarts = 0) => ({
  id: ID,
  itemId: "L01-P1",
  status,
  templateVersion: 1,
  startedAt: "2026-11-02T01:00:00+00:00",
  receivedAt: status === "open" ? null : "2026-11-02T01:01:00+00:00",
  gradingRequestedAt: status === "open" ? null : gradingRequestedAt,
  gradingRestarts,
});

const get = () =>
  GET(new Request(`https://example.test/api/attempts/${ID}/status`), { params: Promise.resolve({ attemptId: ID }) });

let logs: ReturnType<typeof vi.spyOn>;
let errors: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  logs = vi.spyOn(console, "log").mockImplementation(() => {});
  errors = vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.getSessionUser.mockResolvedValue({ id: "user-1", email: null });
  mocks.createServiceClient.mockReturnValue(SERVICE);
  mocks.claimGradingRestart.mockResolvedValue({ ok: true, value: false });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  for (const mock of Object.values(mocks)) mock.mockReset();
});

const lines = (spy: ReturnType<typeof vi.spyOn>) => spy.mock.calls.map((call: unknown[]) => JSON.parse(String(call[0])));

describe("GET /api/attempts/<attemptId>/status", () => {
  it.each(["open", "received"])("answers %s with whole seconds since Start and no result, uncached", async (status) => {
    mocks.readAttempt.mockResolvedValue({ ok: true, value: attempt(status) });
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: true, data: { status, elapsedSeconds: 125, resultId: null } });
    expect(mocks.readAttempt).toHaveBeenCalledWith(SUPABASE, ID);
  });

  it.each(["open", "received", "grading_failed", "abandoned"])("does not look for a Result while %s", async (status) => {
    mocks.readAttempt.mockResolvedValue({ ok: true, value: attempt(status) });
    await get();
    expect(mocks.hasValidResult).not.toHaveBeenCalled();
  });

  it("answers graded with resultId = the attempt id when the stored Result is valid", async () => {
    mocks.readAttempt.mockResolvedValue({ ok: true, value: attempt("graded") });
    mocks.hasValidResult.mockResolvedValue({ ok: true, value: true });
    const res = await get();
    expect(await res.json()).toEqual({ ok: true, data: { status: "graded", elapsedSeconds: 125, resultId: ID } });
    expect(mocks.hasValidResult).toHaveBeenCalledWith(SUPABASE, ID);
  });

  it("answers graded without a valid stored Result (graded by SQL, or failing resultSchema) with resultId null", async () => {
    mocks.readAttempt.mockResolvedValue({ ok: true, value: attempt("graded") });
    mocks.hasValidResult.mockResolvedValue({ ok: true, value: false });
    expect(await (await get()).json()).toEqual({ ok: true, data: { status: "graded", elapsedSeconds: 125, resultId: null } });
  });

  it("answers 500 when the Result cannot be read", async () => {
    mocks.readAttempt.mockResolvedValue({ ok: true, value: attempt("graded") });
    mocks.hasValidResult.mockResolvedValue({ ok: false });
    expect((await get()).status).toBe(500);
  });

  it("answers 401 without a session", async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    const res = await get();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ ok: false, code: "UNAUTHENTICATED" });
    expect(mocks.readAttempt).not.toHaveBeenCalled();
  });

  it("answers 404 NOT_FOUND for someone else's attempt (RLS hides it)", async () => {
    mocks.readAttempt.mockResolvedValue({ ok: true, value: null });
    const res = await get();
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, code: "NOT_FOUND" });
  });

  it("answers 500 when the read fails", async () => {
    mocks.readAttempt.mockResolvedValue({ ok: false });
    const res = await get();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, code: "INTERNAL_ERROR" });
  });

  describe("U4: restarting a grading stuck in received", () => {
    // 15 s and 16 s before NOW (01:02:05.900): elapsed 15 and 16 whole seconds.
    const STUCK = "2026-11-02T01:01:50+00:00";

    it("does not claim under 15 s since the grading was requested", async () => {
      mocks.readAttempt.mockResolvedValue({ ok: true, value: attempt("received", "2026-11-02T01:01:51+00:00") });
      expect((await get()).status).toBe(200);
      expect(mocks.createServiceClient).not.toHaveBeenCalled();
      expect(mocks.claimGradingRestart).not.toHaveBeenCalled();
      expect(mocks.after).not.toHaveBeenCalled();
    });

    it("schedules exactly one restart run when the claim wins, answering as before", async () => {
      mocks.readAttempt.mockResolvedValue({ ok: true, value: attempt("received", STUCK) });
      mocks.claimGradingRestart.mockResolvedValue({ ok: true, value: true });
      mocks.loadForGrading.mockResolvedValue({ ok: true, value: null });
      const res = await get();
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, data: { status: "received", elapsedSeconds: 125, resultId: null } });
      expect(mocks.claimGradingRestart).toHaveBeenCalledWith(SERVICE, ID);
      expect(mocks.after).toHaveBeenCalledTimes(1);
      expect(lines(logs)).toEqual([{ event: "grading.restart_scheduled", attemptId: ID }]);

      // The scheduled task grades this attempt on the service role, logged as `restart`.
      const task = mocks.after.mock.calls[0][0] as () => Promise<unknown>;
      await expect(task()).resolves.toBe("skipped");
      expect(mocks.loadForGrading).toHaveBeenCalledWith(SERVICE, ID);
      expect(lines(logs).at(-1)).toEqual({
        event: "grading.done",
        attemptId: ID,
        channel: "restart",
        outcome: "skipped",
        score: null,
      });
    });

    it("falls back to received_at for a row without grading_requested_at", async () => {
      mocks.readAttempt.mockResolvedValue({ ok: true, value: attempt("received", null) });
      await get();
      expect(mocks.claimGradingRestart).toHaveBeenCalledWith(SERVICE, ID);
    });

    it("schedules nothing when the claim is lost (another poll within 15 s)", async () => {
      mocks.readAttempt.mockResolvedValue({ ok: true, value: attempt("received", STUCK) });
      mocks.claimGradingRestart.mockResolvedValue({ ok: true, value: false });
      expect((await get()).status).toBe(200);
      expect(mocks.after).not.toHaveBeenCalled();
    });

    it("schedules nothing and still answers 200 when the claim fails or throws", async () => {
      mocks.readAttempt.mockResolvedValue({ ok: true, value: attempt("received", STUCK) });
      mocks.claimGradingRestart.mockResolvedValue({ ok: false });
      const res = await get();
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, data: { status: "received", elapsedSeconds: 125, resultId: null } });
      mocks.claimGradingRestart.mockRejectedValue(new TypeError("fetch failed"));
      expect((await get()).status).toBe(200);
      expect(mocks.after).not.toHaveBeenCalled();
      expect(lines(errors)).toEqual([{ event: "grading.restart_failed", attemptId: ID, code: "TypeError" }]);
    });

    it("schedules nothing and answers 200 without the service env, logging that once per process", async () => {
      mocks.readAttempt.mockResolvedValue({ ok: true, value: attempt("received", STUCK) });
      mocks.createServiceClient.mockReturnValue(null);
      expect((await get()).status).toBe(200);
      expect((await get()).status).toBe(200);
      expect(mocks.claimGradingRestart).not.toHaveBeenCalled();
      expect(mocks.after).not.toHaveBeenCalled();
      expect(lines(errors)).toEqual([{ event: "grading.service_env_missing", attemptId: ID, channel: "restart" }]);
    });

    it("does not touch the service role under 15 s, even with the cap reached", async () => {
      mocks.readAttempt.mockResolvedValue({ ok: true, value: attempt("received", "2026-11-02T01:01:51+00:00", 3) });
      expect((await get()).status).toBe(200);
      expect(mocks.createServiceClient).not.toHaveBeenCalled();
      expect(mocks.changeStatus).not.toHaveBeenCalled();
    });

    it("at the cap (3 restarts), moves the attempt to grading_failed instead of claiming, and answers grading_failed", async () => {
      mocks.readAttempt.mockResolvedValue({ ok: true, value: attempt("received", STUCK, 3) });
      mocks.changeStatus.mockResolvedValue({ outcome: "changed", status: "grading_failed" });
      const res = await get();
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, data: { status: "grading_failed", elapsedSeconds: 125, resultId: null } });
      expect(mocks.changeStatus).toHaveBeenCalledWith(SERVICE, ID, "received", "grade_error", "grading.restart_cap_failed", {
        gradingRequestedAt: STUCK,
      });
      expect(mocks.claimGradingRestart).not.toHaveBeenCalled();
      expect(mocks.after).not.toHaveBeenCalled();
      expect(lines(errors)).toEqual([{ event: "grading.restart_cap_reached", attemptId: ID, restarts: 3 }]);
    });

    it("at the cap, a lost or failed escalation answers received as before", async () => {
      mocks.readAttempt.mockResolvedValue({ ok: true, value: attempt("received", STUCK, 3) });
      for (const outcome of ["lost", "failed"]) {
        mocks.changeStatus.mockResolvedValue({ outcome });
        expect(await (await get()).json()).toEqual({ ok: true, data: { status: "received", elapsedSeconds: 125, resultId: null } });
      }
      expect(mocks.claimGradingRestart).not.toHaveBeenCalled();
    });

    it("under the cap (2 restarts), claims as usual", async () => {
      mocks.readAttempt.mockResolvedValue({ ok: true, value: attempt("received", STUCK, 2) });
      await get();
      expect(mocks.claimGradingRestart).toHaveBeenCalledTimes(1);
      expect(mocks.changeStatus).not.toHaveBeenCalled();
    });

    it.each(["open", "grading_failed", "graded"])("does not claim while %s", async (status) => {
      mocks.readAttempt.mockResolvedValue({ ok: true, value: attempt(status, STUCK) });
      mocks.hasValidResult.mockResolvedValue({ ok: true, value: true });
      expect((await get()).status).toBe(200);
      expect(mocks.claimGradingRestart).not.toHaveBeenCalled();
      expect(mocks.after).not.toHaveBeenCalled();
    });
  });
});
