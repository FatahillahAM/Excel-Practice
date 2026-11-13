import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { examSnapshotSchema } from "@/core/content/level-module";
import { hintState, type HintState } from "@/core/services/attempts";
import { isAttemptId, type Read } from "./attempts";

/**
 * `hint_reveals` and `reveal_hint` (migration 20261113000001).
 *
 * Service role ONLY (AD-9): both functions take the service-role client
 * (`service.ts`), because the quota and the hint texts live in the attempt's
 * snapshot, which the session cannot read. Callers use them only after their
 * session read (RLS) proved the attempt is the user's: the exam page's hint
 * state, and the exam screen's hint Server Action. Nothing here reaches the
 * browser except the texts of hints already revealed.
 *
 * Log lines carry an event and the database error code: never hint texts,
 * keys or tokens.
 */

const HINT_REVEALS = "hint_reveals";

/** What `reveal_hint` answers (see the migration for the order of checks). */
export const REVEAL_CODES = [
  "revealed",
  "already",
  "quota_used",
  "no_more_hints",
  "out_of_order",
  "not_open",
  "not_found",
  "no_question",
  "snapshot_invalid",
] as const;

export type RevealCode = (typeof REVEAL_CODES)[number];

const revealAnswerSchema = z.object({
  code: z.enum(REVEAL_CODES),
  question: z.number().int(),
  hintIndex: z.number().int(),
  hint: z.string().nullable(),
  used: z.number().int().min(0),
  quota: z.number().int().min(0),
});

export type RevealAnswer = z.infer<typeof revealAnswerSchema>;

/**
 * The attempt's hint state (quota, soal, revealed hints with their texts, in
 * reveal order) from its snapshot and `hint_reveals` rows. `value: null` when
 * there is no such attempt or its snapshot is missing or not a valid v2
 * snapshot; `ok: false` when the database could not answer
 * (`hint.state_read_failed`).
 */
export async function readHintState(service: SupabaseClient, attemptId: string): Promise<Read<HintState | null>> {
  if (!isAttemptId(attemptId)) return { ok: true, value: null };
  try {
    const attempt = await service.from("attempts").select("snapshot").eq("id", attemptId).maybeSingle();
    if (attempt.error) {
      logError("hint.state_read_failed", attempt.error.code);
      return { ok: false };
    }
    if (!attempt.data) return { ok: true, value: null };
    const snapshot = examSnapshotSchema.safeParse((attempt.data as { snapshot?: unknown }).snapshot);
    if (!snapshot.success) return { ok: true, value: null };

    const rows = await service
      .from(HINT_REVEALS)
      .select("question_number, hint_index")
      .eq("attempt_id", attemptId)
      .order("revealed_at", { ascending: true })
      .order("hint_index", { ascending: true });
    if (rows.error) {
      logError("hint.state_read_failed", rows.error.code);
      return { ok: false };
    }
    const list = Array.isArray(rows.data) ? (rows.data as { question_number: number; hint_index: number }[]) : [];
    return { ok: true, value: hintState(snapshot.data, list) };
  } catch (error) {
    logError("hint.state_read_failed", errorName(error));
    return { ok: false };
  }
}

/**
 * Reveals hint `hintIndex` (0-based) of soal `question` through
 * `reveal_hint`, which locks the attempt and records only the next index
 * while the attempt is `open` and the quota allows. A malformed id is
 * `not_found` without asking the database; `ok: false` when the database
 * could not answer or answered something unexpected (`hint.reveal_failed`).
 */
export async function revealHint(
  service: SupabaseClient,
  attemptId: string,
  question: number,
  hintIndex: number,
): Promise<Read<RevealAnswer>> {
  if (!isAttemptId(attemptId)) {
    return { ok: true, value: { code: "not_found", question, hintIndex, hint: null, used: 0, quota: 0 } };
  }
  try {
    const { data, error } = await service.rpc("reveal_hint", {
      p_attempt_id: attemptId,
      p_question: question,
      p_hint_index: hintIndex,
    });
    if (error) {
      logError("hint.reveal_failed", error.code);
      return { ok: false };
    }
    const parsed = revealAnswerSchema.safeParse(data);
    if (!parsed.success) {
      logError("hint.reveal_failed", "bad_answer");
      return { ok: false };
    }
    return { ok: true, value: parsed.data };
  } catch (error) {
    logError("hint.reveal_failed", errorName(error));
    return { ok: false };
  }
}

function logError(event: string, code: string | undefined): void {
  console.error(JSON.stringify({ event, code: code ?? "unknown" }));
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}
