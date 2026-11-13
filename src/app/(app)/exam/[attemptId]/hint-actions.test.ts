import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  }),
  getSessionUser: vi.fn(),
  readAttempt: vi.fn(),
  createServiceClient: vi.fn(),
  revealHint: vi.fn(),
}));
const SUPABASE = { session: true };
const SERVICE = { service: true };
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/adapters/supabase/auth", () => ({ getSessionUser: mocks.getSessionUser }));
vi.mock("@/adapters/supabase/server", () => ({ createClient: async () => SUPABASE }));
vi.mock("@/adapters/supabase/service", () => ({ createServiceClient: mocks.createServiceClient }));
vi.mock("@/adapters/supabase/hints", () => ({ revealHint: mocks.revealHint }));
vi.mock("@/adapters/supabase/attempts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/adapters/supabase/attempts")>();
  return { isAttemptId: actual.isAttemptId, readAttempt: mocks.readAttempt };
});

import { revealHint, type HintActionState } from "./hint-actions";

const ID = "0b9e0d6c-3f1a-4c2e-9d55-8a7b6c5d4e3f";
const IDLE: HintActionState = { status: "idle" };
const TEXT = "Kunci tarifnya dengan F4.";

const attempt = (status: string) => ({
  id: ID,
  itemId: "L01-P1",
  status,
  templateVersion: 1,
  startedAt: "2026-11-13T01:00:00+00:00",
  receivedAt: null,
  gradingRequestedAt: null,
  gradingRestarts: 0,
});

const answer = (code: string, extra: Partial<{ hint: string | null; used: number; quota: number }> = {}) => ({
  ok: true,
  value: { code, question: 2, hintIndex: 0, hint: null, used: 1, quota: 3, ...extra },
});

function form(fields: Record<string, string | null> = {}): FormData {
  const data = new FormData();
  const all = { attemptId: ID, question: "2", hintIndex: "0", ...fields };
  for (const [key, value] of Object.entries(all)) if (value !== null) data.set(key, value);
  return data;
}

let logs: ReturnType<typeof vi.spyOn>;
let errors: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  logs = vi.spyOn(console, "log").mockImplementation(() => {});
  errors = vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.getSessionUser.mockResolvedValue({ id: "user-1", email: null });
  mocks.readAttempt.mockResolvedValue({ ok: true, value: attempt("open") });
  mocks.createServiceClient.mockReturnValue(SERVICE);
  mocks.revealHint.mockResolvedValue(answer("revealed", { hint: TEXT }));
});
afterEach(() => {
  vi.restoreAllMocks();
  for (const mock of Object.values(mocks)) mock.mockClear();
  mocks.getSessionUser.mockReset();
  mocks.readAttempt.mockReset();
  mocks.createServiceClient.mockReset();
  mocks.revealHint.mockReset();
});

const lines = (spy: ReturnType<typeof vi.spyOn>) => spy.mock.calls.map((call: unknown[]) => JSON.parse(String(call[0])));

describe("revealHint (Server Action)", () => {
  it("reads the attempt through the session, then reveals on the service role", async () => {
    expect(await revealHint(IDLE, form())).toEqual({
      status: "revealed",
      reveal: { question: 2, index: 0, text: TEXT },
      used: 1,
      quota: 3,
    });
    expect(mocks.readAttempt).toHaveBeenCalledWith(SUPABASE, ID);
    expect(mocks.revealHint).toHaveBeenCalledWith(SERVICE, ID, 2, 0);
    expect(lines(logs)).toEqual([{ event: "hint.revealed", attemptId: ID, question: 2, hintIndex: 0, used: 1 }]);
    expect(errors).not.toHaveBeenCalled();
  });

  it("already: the same hint back, no new reveal logged", async () => {
    mocks.revealHint.mockResolvedValue(answer("already", { hint: TEXT }));
    expect(await revealHint(IDLE, form())).toEqual({
      status: "already",
      reveal: { question: 2, index: 0, text: TEXT },
      used: 1,
      quota: 3,
    });
    expect(logs).not.toHaveBeenCalled();
  });

  it.each(["quota_used", "no_more_hints", "out_of_order"] as const)("%s: passed through with used and quota, logged as refused", async (code) => {
    mocks.revealHint.mockResolvedValue(answer(code, { used: 3 }));
    expect(await revealHint(IDLE, form())).toEqual({ status: code, used: 3, quota: 3 });
    expect(lines(logs)).toEqual([{ event: "hint.refused", attemptId: ID, code }]);
  });

  it("not_open from the database (Finish came first)", async () => {
    mocks.revealHint.mockResolvedValue(answer("not_open", { used: 2 }));
    expect(await revealHint(IDLE, form())).toEqual({ status: "not_open", used: 2, quota: 3 });
    expect(lines(logs)).toEqual([{ event: "hint.refused", attemptId: ID, code: "not_open" }]);
  });

  it.each(["received", "grading_failed", "graded", "abandoned", "closed"])("not_open without calling the RPC for a %s attempt", async (status) => {
    mocks.readAttempt.mockResolvedValue({ ok: true, value: attempt(status) });
    expect(await revealHint(IDLE, form())).toEqual({ status: "not_open" });
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
    expect(mocks.revealHint).not.toHaveBeenCalled();
  });

  it.each(["not_found", "no_question", "snapshot_invalid"])("%s: error, logged hint.reveal_failed", async (code) => {
    mocks.revealHint.mockResolvedValue(answer(code));
    expect(await revealHint(IDLE, form())).toEqual({ status: "error" });
    expect(lines(errors)).toEqual([{ event: "hint.reveal_failed", attemptId: ID, code }]);
  });

  it("without a session: Login, then back to this exam", async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    await expect(revealHint(IDLE, form())).rejects.toMatchObject({ url: `/login?next=%2Fexam%2F${ID}` });
    expect(mocks.readAttempt).not.toHaveBeenCalled();
  });

  it.each([
    ["a malformed id", { attemptId: "nope" }],
    ["no id", { attemptId: null }],
    ["soal 0", { question: "0" }],
    ["soal 100", { question: "100" }],
    ["a fractional soal", { question: "1.5" }],
    ["a negative index", { hintIndex: "-1" }],
    ["index 10", { hintIndex: "10" }],
    ["no index", { hintIndex: null }],
  ])("%s: error, nothing read", async (_, fields) => {
    expect(await revealHint(IDLE, form(fields))).toEqual({ status: "error" });
    expect(mocks.readAttempt).not.toHaveBeenCalled();
    expect(mocks.revealHint).not.toHaveBeenCalled();
  });

  it("someone else's (or a missing) attempt, or a failed read: error with nothing about it", async () => {
    mocks.readAttempt.mockResolvedValue({ ok: true, value: null });
    expect(await revealHint(IDLE, form())).toEqual({ status: "error" });
    mocks.readAttempt.mockResolvedValue({ ok: false });
    expect(await revealHint(IDLE, form())).toEqual({ status: "error" });
    expect(mocks.revealHint).not.toHaveBeenCalled();
  });

  it("without the service env, a failed RPC, or a throw: error", async () => {
    mocks.createServiceClient.mockReturnValue(null);
    expect(await revealHint(IDLE, form())).toEqual({ status: "error" });
    expect(lines(errors)).toEqual([{ event: "hint.reveal_failed", attemptId: ID, code: "service_env_missing" }]);
    mocks.createServiceClient.mockReturnValue(SERVICE);
    mocks.revealHint.mockResolvedValue({ ok: false });
    expect(await revealHint(IDLE, form())).toEqual({ status: "error" });
    mocks.revealHint.mockRejectedValue(new TypeError("fetch failed"));
    expect(await revealHint(IDLE, form())).toEqual({ status: "error" });
    expect(lines(errors).at(-1)).toEqual({ event: "hint.reveal_failed", code: "threw", name: "TypeError" });
  });

  it("never logs a hint text", async () => {
    await revealHint(IDLE, form());
    mocks.revealHint.mockResolvedValue(answer("already", { hint: TEXT }));
    await revealHint(IDLE, form());
    const all = [...logs.mock.calls, ...errors.mock.calls].map(([line]) => String(line)).join("\n");
    expect(all).not.toContain(TEXT);
  });
});
