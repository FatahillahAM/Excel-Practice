"use server";

import { redirect } from "next/navigation";
import { isAttemptId, readAttempt } from "@/adapters/supabase/attempts";
import { getSessionUser } from "@/adapters/supabase/auth";
import { loginRedirectPath } from "@/adapters/supabase/auth-rules";
import { revealHint as revealHintRpc } from "@/adapters/supabase/hints";
import { createClient } from "@/adapters/supabase/server";
import { createServiceClient } from "@/adapters/supabase/service";
import type { HintReveal } from "@/core/services/attempts";

/**
 * What the Hint Button learns from one press. `revealed` (a new hint, 5
 * points) and `already` (a double submit: that hint, no new deduction) carry
 * the hint; every answer from the database carries `used` and `quota`.
 * `quota_used`, `no_more_hints`, `out_of_order` and `not_open` wrote
 * nothing; `error`: nothing could be done now (the network message).
 */
export type HintActionState =
  | { status: "idle" }
  | { status: "error" }
  | { status: "not_open"; used?: number; quota?: number }
  | { status: "revealed" | "already"; reveal: HintReveal; used: number; quota: number }
  | { status: "quota_used" | "no_more_hints" | "out_of_order"; used: number; quota: number };

const FAILED = "hint.reveal_failed";
const MAX_QUESTION = 99;
const MAX_HINT_INDEX = 9;

/**
 * The exam screen's Hint Button (CAP-7, EXPERIENCE.md › Hint Button): reveals
 * hint `hintIndex` (0-based, the client's next index for that soal) of soal
 * `question` for the session user's attempt. Ownership and `open` come from
 * the session read (RLS); the write is `reveal_hint` on the service role
 * (AD-9: the session cannot read the snapshot or write `hint_reveals`), which
 * locks the attempt, checks `open` and the snapshot's quota again, and
 * records only the next index — so a double submit (same index) answers
 * `already` and spends nothing. Without a session: Login, then back to this
 * exam. A malformed id or numbers, someone else's attempt or any failure:
 * `error`, with nothing about the attempt. Hint texts never go to the log.
 */
export async function revealHint(_previous: HintActionState, formData: FormData): Promise<HintActionState> {
  let outcome: HintActionState | { redirectTo: string };
  try {
    outcome = await run(formData);
  } catch (error) {
    console.error(JSON.stringify({ event: FAILED, code: "threw", name: error instanceof Error ? error.name : typeof error }));
    return { status: "error" };
  }
  // Outside the try: `redirect()` throws on purpose.
  if ("redirectTo" in outcome) redirect(outcome.redirectTo);
  return outcome;
}

/** A whole number from a form field, within `min`…`max`; `null` otherwise. */
function intField(value: FormDataEntryValue | null, min: number, max: number): number | null {
  if (typeof value !== "string" || !/^\d{1,3}$/.test(value)) return null;
  const n = Number(value);
  return n >= min && n <= max ? n : null;
}

async function run(formData: FormData): Promise<HintActionState | { redirectTo: string }> {
  const attemptId = formData.get("attemptId");
  const validId = typeof attemptId === "string" && isAttemptId(attemptId) ? attemptId : null;

  const user = await getSessionUser();
  if (!user) {
    return { redirectTo: loginRedirectPath(validId === null ? "/dashboard" : `/exam/${validId}`, "") };
  }
  const question = intField(formData.get("question"), 1, MAX_QUESTION);
  const hintIndex = intField(formData.get("hintIndex"), 0, MAX_HINT_INDEX);
  if (validId === null || question === null || hintIndex === null) {
    console.error(JSON.stringify({ event: FAILED, code: "bad_input" }));
    return { status: "error" };
  }

  const supabase = await createClient();
  const read = await readAttempt(supabase, validId);
  // `!ok` was logged by the adapter; `null` is an attempt that is missing or not the user's.
  if (!read.ok || read.value === null) return { status: "error" };
  if (read.value.status !== "open") {
    console.log(JSON.stringify({ event: "hint.refused", attemptId: validId, code: "not_open" }));
    return { status: "not_open" };
  }

  const service = createServiceClient();
  if (service === null) {
    console.error(JSON.stringify({ event: FAILED, attemptId: validId, code: "service_env_missing" }));
    return { status: "error" };
  }

  const answer = await revealHintRpc(service, validId, question, hintIndex);
  // `!ok` was logged by the adapter with its database code.
  if (!answer.ok) return { status: "error" };
  const { code, used, quota, hint } = answer.value;
  switch (code) {
    case "revealed":
    case "already": {
      if (hint === null) {
        console.error(JSON.stringify({ event: FAILED, attemptId: validId, code: "no_text" }));
        return { status: "error" };
      }
      if (code === "revealed") {
        console.log(JSON.stringify({ event: "hint.revealed", attemptId: validId, question, hintIndex, used }));
      }
      return { status: code, reveal: { question, index: hintIndex, text: hint }, used, quota };
    }
    case "quota_used":
    case "no_more_hints":
    case "out_of_order":
      console.log(JSON.stringify({ event: "hint.refused", attemptId: validId, code }));
      return { status: code, used, quota };
    case "not_open":
      console.log(JSON.stringify({ event: "hint.refused", attemptId: validId, code }));
      return { status: "not_open", used, quota };
    default:
      // `not_found`, `no_question`, `snapshot_invalid`: the session read saw the attempt, so the data is off.
      console.error(JSON.stringify({ event: FAILED, attemptId: validId, code }));
      return { status: "error" };
  }
}
