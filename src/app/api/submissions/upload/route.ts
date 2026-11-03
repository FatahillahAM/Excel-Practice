import { findAttemptByTokenHash, markReceived, storeSubmissionFile } from "../../../../adapters/supabase/attempts";
import { getSessionUser } from "../../../../adapters/supabase/auth";
import { UNAUTHENTICATED } from "../../../../adapters/supabase/auth-rules";
import { createClient } from "../../../../adapters/supabase/server";
import { workbookPort } from "../../../../adapters/workbook/submission";
import { submit, type SubmissionPorts } from "../../../../core/submission";
import { readSubmissionBody, submissionResponse } from "../http";

/**
 * `POST /api/submissions/upload` (AD-6, CAP-4): the Upload Dropzone posts the
 * picked file's bytes as `application/octet-stream`. The session is checked
 * first, so a request without one is answered 401 `UNAUTHENTICATED` before
 * the body is read. The attempt is the one the file's token names (AD-6
 * step 3), never an id in the URL; the ports use the user's session (AD-9),
 * so RLS hides another user's attempt (`NOT_THIS_ATTEMPT`) and lets the owner
 * store `submission-1` and move `open` → `received` only. Body limit,
 * envelope, HTTP mapping and logs are the macro's (`../http.ts`).
 */
export async function POST(request: Request): Promise<Response> {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false, code: UNAUTHENTICATED }, { status: 401 });

  const bytes = await readSubmissionBody(request, "upload");
  if (bytes instanceof Response) return bytes;

  const supabase = await createClient();
  const ports: SubmissionPorts = {
    workbook: workbookPort,
    attempts: {
      findByTokenHash: (hash) => findAttemptByTokenHash(supabase, hash),
      markReceived: (attemptId) => markReceived(supabase, attemptId),
    },
    files: {
      storeSubmission: async (attemptId, n, file) => {
        // Upsert: `submit()` stores only while the attempt is `open` (never for a duplicate).
        const stored = await storeSubmissionFile(supabase, attemptId, n, file, { replace: true });
        return stored === "failed" ? "failed" : "stored";
      },
    },
  };

  const result = await submit(bytes, { kind: "upload" }, ports);
  return submissionResponse(result, "upload");
}
