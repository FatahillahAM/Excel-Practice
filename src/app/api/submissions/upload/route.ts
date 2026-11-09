import { getSessionUser, type SessionUser } from "@/adapters/supabase/auth";
import { SubmissionFault, submit, type SubmitResult } from "@/core/submission";
import { RouteFault, bodyFault, errorName, isOctetStream, readSubmissionBody, submissionResponse } from "../http";
import { serviceSubmissionPorts } from "../service-ports";

/**
 * `POST /api/submissions/upload` (AD-6, CAP-4): the Upload Dropzone posts the
 * picked file's bytes as `application/octet-stream`. In order:
 *
 * 1. the session: none → 401 `UNAUTHENTICATED`, before the body is read;
 * 2. the content type: anything but `application/octet-stream` → 415
 *    `UNSUPPORTED_MEDIA_TYPE` (so no cross-site "simple" POST gets this far);
 * 3. the body within the macro's limit (413);
 * 4. `submit(…, { kind: "upload" })` on service-role ports (AD-9) that treat
 *    an attempt of anyone but the session user as not found
 *    (`NOT_THIS_ATTEMPT`). The attempt is the one the file's token names
 *    (AD-6 step 3), never an id in the URL.
 *
 * Envelope, HTTP mapping and logs are the macro's (`../http.ts`); every
 * answer logs one line, and any throw answers 500 `INTERNAL_ERROR` with an
 * `upload.*` error log.
 */
export async function POST(request: Request): Promise<Response> {
  let user: SessionUser | null;
  try {
    user = await getSessionUser();
  } catch (error) {
    return internalError("upload.session_failed", error);
  }
  if (!user) return bodyFault(RouteFault.UNAUTHENTICATED, "upload");
  if (!isOctetStream(request)) return bodyFault(RouteFault.UNSUPPORTED_MEDIA_TYPE, "upload");

  const bytes = await readSubmissionBody(request, "upload");
  if (bytes instanceof Response) return bytes;

  const { ports, fault } = serviceSubmissionPorts("upload", user.id);
  let result: SubmitResult;
  try {
    result = await submit(bytes, { kind: "upload" }, ports);
  } catch (error) {
    return internalError("upload.submit_failed", error);
  }
  return submissionResponse(result, "upload", fault());
}

function internalError(event: string, error: unknown): Response {
  console.error(JSON.stringify({ event, attemptId: null, code: errorName(error) }));
  return bodyFault(SubmissionFault.INTERNAL_ERROR, "upload");
}
