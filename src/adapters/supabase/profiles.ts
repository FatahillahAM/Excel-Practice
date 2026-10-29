import type { SupabaseClient } from "@supabase/supabase-js";

export type EnsureProfileResult = "created" | "exists" | "skipped" | "failed";

const UNIQUE_VIOLATION = "23505";

/**
 * Creates the signed-in user's `profiles` row once, with the browser's time
 * zone (AD-8). An existing row is never changed: `time_zone` is set at first
 * sign-in and immutable (the table grants no update). `timeZone === null`
 * (the browser sent no valid IANA zone) leaves a missing row for the next
 * sign-in instead of storing a guess.
 */
export async function ensureProfile(
  supabase: SupabaseClient,
  userId: string,
  timeZone: string | null,
): Promise<EnsureProfileResult> {
  const { data, error } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (error) return "failed";
  if (data) return "exists";
  if (timeZone === null) return "skipped";

  const { error: insertError } = await supabase.from("profiles").insert({ id: userId, time_zone: timeZone });
  if (!insertError) return "created";
  // A parallel sign-in created it first: the first zone wins.
  if (insertError.code === UNIQUE_VIOLATION) return "exists";
  return "failed";
}
