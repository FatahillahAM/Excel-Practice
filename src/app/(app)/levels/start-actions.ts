"use server";

import { randomInt } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  createAttempt,
  deleteOpenAttempt,
  findOpenAttemptId,
  uploadGeneratedFile,
  writeSnapshot,
} from "../../../adapters/supabase/attempts";
import { getSessionUser } from "../../../adapters/supabase/auth";
import { loginRedirectPath, normalizeTimeZone } from "../../../adapters/supabase/auth-rules";
import { ensureProfile, readTimeZone } from "../../../adapters/supabase/profiles";
import { createClient } from "../../../adapters/supabase/server";
import { createServiceClient } from "../../../adapters/supabase/service";
import { generateExamWorkbook, type GeneratedWorkbook } from "../../../adapters/workbook/generate";
import { newAttemptToken, tokenSha256, tokenSha256Hex } from "../../../adapters/workbook/token";
import {
  examSnapshotSchema,
  generatedExamSchema,
  type ExamSnapshot,
  type GeneratedExam,
} from "../../../core/content/level-module";
import { findItem } from "../../../content/levels";
import type { StartError } from "../../../messages/id";

export type StartState =
  | { status: "idle" }
  | { status: "error"; error: StartError }
  /** Another attempt is in progress; `attemptId` links to its exam screen when it could be read. */
  | { status: "blocked"; attemptId: string | null };

const LEVELS_PATH = "/levels";

/**
 * Start (CAP-2): session → profile → item → seed and scenario → content
 * `generate` and snapshot (validated) → token → workbook → session insert →
 * snapshot write on the service role (AD-9: the session has no privilege on
 * the answer key) → upload → the exam screen, which starts the download.
 * Generation runs before the insert, so a failed generation leaves no row. A
 * failed snapshot write or upload deletes the row again (through the session,
 * while it is `open`): a row without a snapshot could not be graded, and a
 * row without a file would lock every other Start. The snapshot is written
 * before the upload, so its failure leaves no file behind.
 */
export async function startAttempt(_previous: StartState, formData: FormData): Promise<StartState> {
  let outcome: StartState | { redirectTo: string };
  try {
    outcome = await start(formData);
  } catch (error) {
    // Anything that throws (session, profile, client, generation, storage) is a failed Start, never an error page.
    console.error(
      JSON.stringify({ event: "attempt.start_threw", name: error instanceof Error ? error.name : typeof error }),
    );
    return { status: "error", error: "startFailed" };
  }
  // Outside the try: `redirect()` throws on purpose.
  if ("redirectTo" in outcome) redirect(outcome.redirectTo);
  return outcome;
}

async function start(formData: FormData): Promise<StartState | { redirectTo: string }> {
  const user = await getSessionUser();
  if (!user) return { redirectTo: loginRedirectPath(LEVELS_PATH, "") };

  const supabase = await createClient();
  const profile = await requireProfile(supabase, user.id, formData.get("timeZone"));
  if (profile !== "ok") return { status: "error", error: profile };

  const itemId = formData.get("itemId");
  const found = typeof itemId === "string" ? findItem(itemId) : null;
  if (!found) {
    console.error(JSON.stringify({ event: "attempt.start_unknown_item" }));
    return { status: "error", error: "startFailed" };
  }
  const { level, item } = found;
  if (level.scenarios.length === 0) {
    console.error(JSON.stringify({ event: "attempt.start_no_scenarios", itemId: item.id }));
    return { status: "error", error: "startFailed" };
  }
  // Two independent uniform draws (CAP-6); the seed is a uint32 so it fits JSON exactly.
  const seed = randomInt(2 ** 32);
  const scenario = level.scenarios[randomInt(level.scenarios.length)];
  const context = { itemId: item.id, scenarioId: scenario.id, contentVersion: level.contentVersion };
  let exam: GeneratedExam;
  try {
    const parsed = generatedExamSchema.safeParse(item.generate(seed, scenario));
    if (!parsed.success) {
      console.error(JSON.stringify({ event: "attempt.start_invalid_exam", ...context }));
      return { status: "error", error: "startFailed" };
    }
    exam = parsed.data;
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "attempt.start_invalid_exam",
        ...context,
        name: error instanceof Error ? error.name : typeof error,
      }),
    );
    return { status: "error", error: "startFailed" };
  }
  const checkedSnapshot = examSnapshotSchema.safeParse({
    contentVersion: level.contentVersion,
    scenarioId: scenario.id,
    seed,
    questions: exam.questions,
  } satisfies ExamSnapshot);
  if (!checkedSnapshot.success) {
    console.error(JSON.stringify({ event: "attempt.start_invalid_exam", ...context, part: "snapshot" }));
    return { status: "error", error: "startFailed" };
  }
  const snapshot: ExamSnapshot = checkedSnapshot.data;

  const token = newAttemptToken();
  const hash = tokenSha256Hex(token);
  let generated: GeneratedWorkbook;
  try {
    generated = await generateExamWorkbook({
      token,
      serverUrl: requestOrigin(await headers()),
      cells: exam.cells,
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "attempt.generate_failed",
        ...context,
        tokenSha256: tokenSha256(token),
        name: error instanceof Error ? error.name : typeof error,
      }),
    );
    return { status: "error", error: "startFailed" };
  }

  const created = await createAttempt(supabase, {
    itemId: item.id,
    tokenSha256: hash,
    templateVersion: generated.templateVersion,
  });
  if (!created.ok) {
    if (created.reason === "failed") return { status: "error", error: "startFailed" };
    const open = await findOpenAttemptId(supabase, user.id);
    return { status: "blocked", attemptId: open.ok ? open.value : null };
  }

  const written = await writeStartSnapshot(user.id, created.id, snapshot);
  if (written !== "ok") {
    const deleted = await deleteOpenAttempt(supabase, created.id).catch(() => false);
    console.error(
      JSON.stringify({ event: "attempt.start_snapshot_failed", attemptId: created.id, code: written, deleted }),
    );
    return { status: "error", error: "startFailed" };
  }

  // A thrown upload is a failed one: the row must still be deleted.
  const stored = await uploadGeneratedFile(supabase, created.id, generated.bytes).catch(() => false);
  if (!stored) {
    const deleted = await deleteOpenAttempt(supabase, created.id);
    console.error(JSON.stringify({ event: "attempt.start_upload_failed", attemptId: created.id, deleted }));
    return { status: "error", error: "startFailed" };
  }

  console.log(
    JSON.stringify({
      // Which content the attempt got; never the key, nor the seed that rebuilds it.
      event: "attempt.started",
      attemptId: created.id,
      ...context,
      templateVersion: generated.templateVersion,
      tokenSha256: tokenSha256(token),
    }),
  );
  return { redirectTo: `/exam/${created.id}?download=1` };
}

/**
 * Writes the snapshot of the attempt the session just created, on the
 * service-role client (AD-9), created here per request like the submission
 * routes' (`service-ports.ts`): `ok`, or why it failed.
 */
async function writeStartSnapshot(
  userId: string,
  attemptId: string,
  snapshot: ExamSnapshot,
): Promise<"ok" | "service_env_missing" | "service_client_failed" | "write_failed"> {
  let service: ReturnType<typeof createServiceClient>;
  try {
    service = createServiceClient();
  } catch {
    return "service_client_failed";
  }
  if (service === null) return "service_env_missing";
  return (await writeSnapshot(service, attemptId, userId, snapshot)) ? "ok" : "write_failed";
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
