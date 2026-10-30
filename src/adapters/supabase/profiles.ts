import type { SupabaseClient } from "@supabase/supabase-js";

export type EnsureProfileResult = "created" | "exists" | "skipped" | "failed";

const UNIQUE_VIOLATION = "23505";
/** The `time_zone` CHECK: 23514 when it is false, 22023 when `at time zone` raises on an unknown zone. */
const ZONE_REJECTED = new Set(["23514", "22023"]);

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
  // A zone ICU accepts but Postgres' tzdata does not: like no zone, sign-in
  // continues and the profile waits for a later sign-in.
  if (ZONE_REJECTED.has(insertError.code)) {
    console.warn(JSON.stringify({ event: "auth.profile_zone_rejected_by_db" }));
    return "skipped";
  }
  return "failed";
}

export type TimeZoneRead = { ok: true; timeZone: string | null } | { ok: false };

/**
 * The signed-in user's streak time zone (AD-8), read through their session
 * (RLS: owner-only). `timeZone: null` when no profile row exists yet.
 */
export async function readTimeZone(supabase: SupabaseClient, userId: string): Promise<TimeZoneRead> {
  const { data, error } = await supabase.from("profiles").select("time_zone").eq("id", userId).maybeSingle();
  if (error) {
    console.error(JSON.stringify({ event: "profile.read_failed", code: error.code }));
    return { ok: false };
  }
  const zone = (data as { time_zone?: unknown } | null)?.time_zone;
  return { ok: true, timeZone: typeof zone === "string" && zone.length > 0 ? zone : null };
}
