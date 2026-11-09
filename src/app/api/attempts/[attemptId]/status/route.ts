import { readAttempt, readResult, type AttemptStatus } from "@/adapters/supabase/attempts";
import { getSessionUser } from "@/adapters/supabase/auth";
import { UNAUTHENTICATED } from "@/adapters/supabase/auth-rules";
import { createClient } from "@/adapters/supabase/server";
import { elapsedSeconds } from "@/core/services/attempts";

export interface AttemptStatusData {
  status: AttemptStatus;
  /** Server time since Start (AD-8), whole seconds. */
  elapsedSeconds: number;
  /** The Result to move to (`/results/<resultId>`): the attempt id once it is `graded` with a stored Result, else `null`. */
  resultId: string | null;
}

export type AttemptStatusBody = { ok: true; data: AttemptStatusData } | { ok: false; code: string };

/**
 * `GET /api/attempts/<attemptId>/status` (AD-11): what the exam screen polls
 * every 2 s. Through the user's session; someone else's attempt is
 * `NOT_FOUND`. Once `graded`, the Result's id is the attempt's id, given only
 * when the stored Result is there (a row graded by SQL before results existed
 * has none). Never cached.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ attemptId: string }> }): Promise<Response> {
  const { attemptId } = await params;
  const user = await getSessionUser();
  if (!user) return json({ ok: false, code: UNAUTHENTICATED }, 401);

  const supabase = await createClient();
  const attempt = await readAttempt(supabase, attemptId);
  if (!attempt.ok) return json({ ok: false, code: "INTERNAL_ERROR" }, 500);
  if (attempt.value === null) return json({ ok: false, code: "NOT_FOUND" }, 404);

  let resultId: string | null = null;
  if (attempt.value.status === "graded") {
    const stored = await readResult(supabase, attempt.value.id);
    if (!stored.ok) return json({ ok: false, code: "INTERNAL_ERROR" }, 500);
    resultId = stored.value === null ? null : attempt.value.id;
  }

  const data: AttemptStatusData = {
    status: attempt.value.status,
    elapsedSeconds: elapsedSeconds(attempt.value.startedAt, Date.now()),
    resultId,
  };
  return json({ ok: true, data }, 200);
}

function json(body: AttemptStatusBody, status: number): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}
