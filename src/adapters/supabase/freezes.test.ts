import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listFreezes, spendFreeze } from "./freezes";

type Answer = { data: unknown; error: { code: string; message: string } | null };

function fakeClient(answer: () => Promise<Answer>) {
  const calls: [string, unknown[]][] = [];
  const builder: Record<string, unknown> = {};
  for (const name of ["select", "eq", "order"]) builder[name] = (...args: unknown[]) => (calls.push([name, args]), builder);
  builder.then = (resolve: (a: Answer) => unknown, reject: (e: unknown) => unknown) => answer().then(resolve, reject);
  const from = vi.fn(() => builder);
  const rpc = vi.fn(answer);
  return { client: { from, rpc } as unknown as SupabaseClient, from, rpc, calls };
}

let errors: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  errors = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("listFreezes", () => {
  it("reads the user's local dates, oldest first, dropping anything that is not a date", async () => {
    const { client, from, calls } = fakeClient(async () => ({
      data: [{ local_date: "2026-11-17" }, { local_date: "2026-11-19" }, { local_date: null }, { local_date: "x" }],
      error: null,
    }));
    expect(await listFreezes(client, "user-1")).toEqual({ ok: true, value: ["2026-11-17", "2026-11-19"] });
    expect(from).toHaveBeenCalledWith("freezes");
    expect(calls).toEqual([
      ["select", ["local_date"]],
      ["eq", ["user_id", "user-1"]],
      ["order", ["local_date", { ascending: true }]],
    ]);
  });

  it("is not ok when the read fails or throws (freeze.list_failed)", async () => {
    expect(await listFreezes(fakeClient(async () => ({ data: null, error: { code: "42P01", message: "x" } })).client, "u")).toEqual({ ok: false });
    expect(errors).toHaveBeenLastCalledWith(JSON.stringify({ event: "freeze.list_failed", code: "42P01" }));
    expect(await listFreezes(fakeClient(async () => Promise.reject(new TypeError("net"))).client, "u")).toEqual({ ok: false });
    expect(errors).toHaveBeenLastCalledWith(JSON.stringify({ event: "freeze.list_failed", code: "TypeError" }));
  });
});

describe("spendFreeze", () => {
  it.each(["frozen", "already_frozen", "safe", "quota_used"] as const)("maps %s", async (code) => {
    const answer = { code, localDate: "2026-11-19", left: 1 };
    const { client, rpc } = fakeClient(async () => ({ data: answer, error: null }));
    expect(await spendFreeze(client)).toEqual({ ok: true, value: answer });
    expect(rpc).toHaveBeenCalledWith("use_freeze");
  });

  it("maps no_profile with a null date", async () => {
    const answer = { code: "no_profile", localDate: null, left: 0 };
    expect(await spendFreeze(fakeClient(async () => ({ data: answer, error: null })).client)).toEqual({ ok: true, value: answer });
  });

  it("is not ok on an error, an unexpected answer or a throw (freeze.use_failed)", async () => {
    expect(await spendFreeze(fakeClient(async () => ({ data: null, error: { code: "42883", message: "x" } })).client)).toEqual({ ok: false });
    expect(errors).toHaveBeenLastCalledWith(JSON.stringify({ event: "freeze.use_failed", code: "42883" }));
    expect(await spendFreeze(fakeClient(async () => ({ data: { code: "weird" }, error: null })).client)).toEqual({ ok: false });
    expect(errors).toHaveBeenLastCalledWith(JSON.stringify({ event: "freeze.use_failed", code: "bad_answer" }));
    expect(await spendFreeze(fakeClient(async () => Promise.reject(new Error("x"))).client)).toEqual({ ok: false });
  });
});
