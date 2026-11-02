"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  createAttempt,
  deleteOpenAttempt,
  findOpenAttemptId,
  uploadGeneratedFile,
} from "../../../adapters/supabase/attempts";
import { getSessionUser } from "../../../adapters/supabase/auth";
import { loginRedirectPath, normalizeTimeZone } from "../../../adapters/supabase/auth-rules";
import { ensureProfile, readTimeZone } from "../../../adapters/supabase/profiles";
import { createClient } from "../../../adapters/supabase/server";
import { generateExamWorkbook, type GeneratedWorkbook } from "../../../adapters/workbook/generate";
import { newAttemptToken, tokenSha256, tokenSha256Hex } from "../../../adapters/workbook/token";
import { findItem } from "../../../content/levels";
import type { StartError } from "../../../messages/id";

export type StartState =
  | { status: "idle" }
  | { status: "error"; error: StartError }
  /** Another attempt is in progress; `attemptId` links to its exam screen when it could be read. */
  | { status: "blocked"; attemptId: string | null };

const LEVELS_PATH = "/levels";

/**
 * Start (CAP-2): session → profile → item → token → generate → insert →
 * upload → the exam screen, which starts the download. Generation runs before
 * the insert, so a failed generation leaves no row; the upload runs after it
 * because the Storage policy needs the row; a failed upload deletes the row
 * again, since a row without a file would lock every other Start.
 */
export async function startAttempt(_previous: StartState, formData: FormData): Promise<StartState> {
  const user = await getSessionUser();
  if (!user) redirect(loginRedirectPath(LEVELS_PATH, ""));

  const supabase = await createClient();
  const profile = await requireProfile(supabase, user.id, formData.get("timeZone"));
  if (profile !== "ok") return { status: "error", error: profile };

  const itemId = formData.get("itemId");
  const found = typeof itemId === "string" ? findItem(itemId) : null;
  if (!found) {
    console.error(JSON.stringify({ event: "attempt.start_unknown_item" }));
    return { status: "error", error: "startFailed" };
  }

  const token = newAttemptToken();
  const hash = tokenSha256Hex(token);
  let generated: GeneratedWorkbook;
  try {
    generated = await generateExamWorkbook({
      token,
      serverUrl: requestOrigin(await headers()),
      cells: found.item.examCells(),
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "attempt.generate_failed",
        itemId: found.item.id,
        tokenSha256: tokenSha256(token),
        name: error instanceof Error ? error.name : typeof error,
      }),
    );
    return { status: "error", error: "startFailed" };
  }

  const created = await createAttempt(supabase, {
    itemId: found.item.id,
    tokenSha256: hash,
    templateVersion: generated.templateVersion,
  });
  if (!created.ok) {
    if (created.reason === "failed") return { status: "error", error: "startFailed" };
    const open = await findOpenAttemptId(supabase, user.id);
    return { status: "blocked", attemptId: open.ok ? open.value : null };
  }

  if (!(await uploadGeneratedFile(supabase, created.id, generated.bytes))) {
    const deleted = await deleteOpenAttempt(supabase, created.id);
    console.error(JSON.stringify({ event: "attempt.start_upload_failed", attemptId: created.id, deleted }));
    return { status: "error", error: "startFailed" };
  }

  console.log(
    JSON.stringify({
      event: "attempt.started",
      attemptId: created.id,
      itemId: found.item.id,
      templateVersion: generated.templateVersion,
      tokenSha256: tokenSha256(token),
    }),
  );
  redirect(`/exam/${created.id}?download=1`);
}

/**
 * Start needs a `profiles` row (`attempts.user_id` references it). A user who
 * signed in without a valid browser zone has none yet: create it now with the
 * zone this form sent.
 */
async function requireProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  rawTimeZone: FormDataEntryValue | null,
): Promise<"ok" | StartError> {
  const read = await readTimeZone(supabase, userId);
  if (!read.ok) return "startFailed";
  if (read.timeZone !== null) return "ok";
  const zone = normalizeTimeZone(typeof rawTimeZone === "string" ? rawTimeZone : null);
  const ensured = await ensureProfile(supabase, userId, zone);
  if (ensured === "created" || ensured === "exists") return "ok";
  if (ensured === "skipped") return "profileMissing";
  console.error(JSON.stringify({ event: "attempt.start_profile_failed" }));
  return "startFailed";
}

/**
 * `WHE_ServerUrl` (AD-13): the origin this request came to. A Server Action's
 * `Origin` header is checked by Next against the host, so it is the
 * environment the user is on; the forwarded host is the fallback.
 */
function requestOrigin(h: Headers): string {
  const origin = h.get("origin");
  if (origin) {
    try {
      const url = new URL(origin);
      if (url.protocol === "https:" || url.protocol === "http:") return url.origin;
    } catch {
      // fall through to the host headers
    }
  }
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) throw new Error("Request has no origin or host");
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  return new URL(`${proto}://${host}`).origin;
}
