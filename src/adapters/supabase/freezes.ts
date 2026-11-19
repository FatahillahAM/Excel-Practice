import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Read } from "./attempts";

/**
 * `freezes` and `use_freeze` (migration 20261119000001), on the user's
 * session (RLS: the owner reads their rows; `use_freeze` acts for
 * `auth.uid()` only, AD-9). The database owns "today" (the user's zone, its
 * clock) and every freeze rule; this adapter only reads and maps.
 *
 * Log lines carry an event and the database error code only.
 */

const FREEZES = "freezes";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** What `use_freeze` answers (see the migration for the order of checks). */
export const FREEZE_CODES = ["frozen", "already_frozen", "safe", "quota_used", "no_profile", "no_session"] as const;

export type FreezeCode = (typeof FREEZE_CODES)[number];

const freezeAnswerSchema = z.object({
  code: z.enum(FREEZE_CODES),
  localDate: z.string().regex(DATE_RE).nullable(),
  left: z.number().int().min(0),
});

export type FreezeAnswer = z.infer<typeof freezeAnswerSchema>;

/** The user's freeze dates (`YYYY-MM-DD`, oldest first); `ok: false` when the database could not answer (`freeze.list_failed`). */
export async function listFreezes(supabase: SupabaseClient, userId: string): Promise<Read<string[]>> {
  try {
    const { data, error } = await supabase.from(FREEZES).select("local_date").eq("user_id", userId).order("local_date", { ascending: true });
    if (error) {
      logError("freeze.list_failed", error.code);
      return { ok: false };
    }
    const rows = Array.isArray(data) ? (data as { local_date: unknown }[]) : [];
    return { ok: true, value: rows.map((row) => row.local_date).filter((d): d is string => typeof d === "string" && DATE_RE.test(d)) };
  } catch (error) {
    logError("freeze.list_failed", errorName(error));
    return { ok: false };
  }
}

/**
 * Freezes today through `use_freeze`. `ok: false` when the database could
 * not answer or answered something unexpected (`freeze.use_failed`).
 */
export async function spendFreeze(supabase: SupabaseClient): Promise<Read<FreezeAnswer>> {
  try {
    const { data, error } = await supabase.rpc("use_freeze");
    if (error) {
      logError("freeze.use_failed", error.code);
      return { ok: false };
    }
    const parsed = freezeAnswerSchema.safeParse(data);
    if (!parsed.success) {
      logError("freeze.use_failed", "bad_answer");
      return { ok: false };
    }
    return { ok: true, value: parsed.data };
  } catch (error) {
    logError("freeze.use_failed", errorName(error));
    return { ok: false };
  }
}

function logError(event: string, code: string | undefined): void {
  console.error(JSON.stringify({ event, code: code ?? "unknown" }));
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}
