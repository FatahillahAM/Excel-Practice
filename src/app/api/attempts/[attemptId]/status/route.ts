import { readAttempt, type AttemptStatus } from "@/adapters/supabase/attempts";
import { getSessionUser } from "@/adapters/supabase/auth";
import { UNAUTHENTICATED } from "@/adapters/supabase/auth-rules";
import { createClient } from "@/adapters/supabase/server";
import { elapsedSeconds } from "@/core/services/attempts";

export interface AttemptStatusData {
  status: AttemptStatus;
  /** Server time since Start (AD-8), whole seconds. */
  elapsedSeconds: number;
  /** The Result to move to once graded (epic 3); always `null` until grading exists. */
  resultId: string | null;
}

export type AttemptStatusBody = { ok: true; data: AttemptStatusData } | { ok: false; code: string };

/**
 * `GET /api/attempts/<attemptId>/status` (AD-11): what the exam screen polls
 * every 2 s. Through the user's session; someone else's attempt is
 * `NOT_FOUND`. Never cached.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ attemptId: string }> }): Promise<Response> {
  const { attemptId } = await params;
  const user = await getSessionUser();
  if (!user) return json({ ok: false, code: UNAUTHENTICATED }, 401);

  const attempt = await readAttempt(await createClient(), attemptId);
  if (!attempt.ok) return json({ ok: false, code: "INTERNAL_ERROR" }, 500);
  if (attempt.value === null) return json({ ok: false, code: "NOT_FOUND" }, 404);

  const data: AttemptStatusData = {
    status: attempt.value.status,
    elapsedSeconds: elapsedSeconds(attempt.value.startedAt, Date.now()),
    resultId: null,
  };
  return json({ ok: true, data }, 200);
}

function json(body: AttemptStatusBody, status: number): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}
