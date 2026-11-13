import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SNAPSHOT } from "@/core/grading/__fixtures__/exam";
import { readHintState, revealHint } from "./hints";

type Answer = { data: unknown; error: { code: string; message: string } | null };

const ID = "0b9e0d6c-3f1a-4c2e-9d55-8a7b6c5d4e3f";

/** A PostgREST builder recording every call; answers are handed out per query, in order. */
function fakeClient(answers: Answer[] | (() => Promise<Answer>)) {
  const calls: [string, unknown[]][] = [];
  let query = 0;
  const answer = () => (typeof answers === "function" ? answers() : Promise.resolve(answers[query++]));
  const builder: Record<string, unknown> = {};
  for (const name of ["select", "eq", "order"]) builder[name] = (...args: unknown[]) => (calls.push([name, args]), builder);
  builder.maybeSingle = (...args: unknown[]) => (calls.push(["maybeSingle", args]), answer());
  builder.then = (resolve: (a: Answer) => unknown, reject: (e: unknown) => unknown) => answer().then(resolve, reject);
  const from = vi.fn(() => builder);
  return { client: { from } as unknown as SupabaseClient, from, calls };
}

function fakeRpc(answer: () => Promise<Answer>) {
  const rpc = vi.fn(answer);
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

let errors: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  errors = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("readHintState (service role)", () => {
  it("reads the snapshot, then the reveals in reveal order, into a HintState", async () => {
    const { client, from, calls } = fakeClient([
      { data: { snapshot: SNAPSHOT }, error: null },
      { data: [{ question_number: 3, hint_index: 0 }, { question_number: 1, hint_index: 0 }], error: null },
    ]);
    expect(await readHintState(client, ID)).toEqual({
      ok: true,
      value: {
        quota: 3,
        used: 2,
        questions: SNAPSHOT.questions.map((q) => ({ number: q.number, hintCount: q.hints.length })),
        revealed: [
          { question: 3, index: 0, text: SNAPSHOT.questions[2].hints[0] },
          { question: 1, index: 0, text: SNAPSHOT.questions[0].hints[0] },
        ],
      },
    });
    expect(from.mock.calls).toEqual([["attempts"], ["hint_reveals"]]);
    expect(calls).toEqual([
      ["select", ["snapshot"]],
      ["eq", ["id", ID]],
      ["maybeSingle", []],
      ["select", ["question_number, hint_index"]],
      ["eq", ["attempt_id", ID]],
      ["order", ["revealed_at", { ascending: true }]],
      ["order", ["hint_index", { ascending: true }]],
    ]);
  });

  it("is null without the attempt, for a malformed id, or with a null or invalid snapshot", async () => {
    expect(await readHintState(fakeClient([{ data: null, error: null }]).client, ID)).toEqual({ ok: true, value: null });
    const unused = fakeClient([]);
    expect(await readHintState(unused.client, "nope")).toEqual({ ok: true, value: null });
    expect(unused.from).not.toHaveBeenCalled();
    expect(await readHintState(fakeClient([{ data: { snapshot: null }, error: null }]).client, ID)).toEqual({ ok: true, value: null });
    const v1 = fakeClient([{ data: { snapshot: { ...SNAPSHOT, version: 1 } }, error: null }]);
    expect(await readHintState(v1.client, ID)).toEqual({ ok: true, value: null });
    expect(v1.from).toHaveBeenCalledTimes(1);
  });

  it("is not ok when either read fails or throws (hint.state_read_failed)", async () => {
    expect(await readHintState(fakeClient([{ data: null, error: { code: "08006", message: "x" } }]).client, ID)).toEqual({ ok: false });
    expect(errors).toHaveBeenLastCalledWith(JSON.stringify({ event: "hint.state_read_failed", code: "08006" }));
    const second = fakeClient([
      { data: { snapshot: SNAPSHOT }, error: null },
      { data: null, error: { code: "42P01", message: "x" } },
    ]);
    expect(await readHintState(second.client, ID)).toEqual({ ok: false });
    expect(errors).toHaveBeenLastCalledWith(JSON.stringify({ event: "hint.state_read_failed", code: "42P01" }));
    const threw = fakeClient(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await readHintState(threw.client, ID)).toEqual({ ok: false });
    expect(errors).toHaveBeenLastCalledWith(JSON.stringify({ event: "hint.state_read_failed", code: "TypeError" }));
  });
});

describe("revealHint (service role)", () => {
  const revealed = { code: "revealed", question: 2, hintIndex: 0, hint: "Kunci tarifnya.", used: 1, quota: 3 };

  it("calls reveal_hint with the attempt, soal and index, and returns the parsed answer", async () => {
    const { client, rpc } = fakeRpc(async () => ({ data: revealed, error: null }));
    expect(await revealHint(client, ID, 2, 0)).toEqual({ ok: true, value: revealed });
    expect(rpc).toHaveBeenCalledWith("reveal_hint", { p_attempt_id: ID, p_question: 2, p_hint_index: 0 });
  });

  it.each(["already", "quota_used", "no_more_hints", "out_of_order", "not_open", "not_found", "no_question", "snapshot_invalid"])(
    "passes %s through",
    async (code) => {
      const answer = { ...revealed, code, hint: null };
      const { client } = fakeRpc(async () => ({ data: answer, error: null }));
      expect(await revealHint(client, ID, 2, 0)).toEqual({ ok: true, value: answer });
    },
  );

  it("is not_found for a malformed id without asking the database", async () => {
    const { client, rpc } = fakeRpc(async () => ({ data: revealed, error: null }));
    expect(await revealHint(client, "../x", 2, 0)).toEqual({
      ok: true,
      value: { code: "not_found", question: 2, hintIndex: 0, hint: null, used: 0, quota: 0 },
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("is not ok on a database error, an unexpected answer or a throw (hint.reveal_failed)", async () => {
    expect(await revealHint(fakeRpc(async () => ({ data: null, error: { code: "42501", message: "x" } })).client, ID, 1, 0)).toEqual({
      ok: false,
    });
    expect(errors).toHaveBeenLastCalledWith(JSON.stringify({ event: "hint.reveal_failed", code: "42501" }));
    expect(await revealHint(fakeRpc(async () => ({ data: { code: "weird" }, error: null })).client, ID, 1, 0)).toEqual({ ok: false });
    expect(errors).toHaveBeenLastCalledWith(JSON.stringify({ event: "hint.reveal_failed", code: "bad_answer" }));
    const threw = fakeRpc(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await revealHint(threw.client, ID, 1, 0)).toEqual({ ok: false });
    expect(errors).toHaveBeenLastCalledWith(JSON.stringify({ event: "hint.reveal_failed", code: "TypeError" }));
  });
});
