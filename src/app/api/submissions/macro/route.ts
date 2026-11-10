import { submit, type SubmissionLog } from "@/core/submission";
import { scheduleGrading } from "../grading";
import { readSubmissionBody, submissionResponse, type SubmissionBody } from "../http";
import { serviceSubmissionPorts } from "../service-ports";

/** The macro's answer: the envelope both submission routes share (`../http.ts`). */
export type MacroBody = SubmissionBody;

/** One JSON log line (Consistency Conventions › Logging): never file bytes, tokens or emails. */
export type MacroLog = SubmissionLog;

/**
 * `POST /api/submissions/macro` (AD-6): the Finish macro posts the workbook's
 * bytes as `application/octet-stream` with header `X-Attempt-Token`. No
 * session: the token authenticates, and the ports use the service-role client
 * (AD-9, `../service-ports.ts`). The rules are `submit()`'s (core); this
 * handler only wires the ports. Body limit, envelope, HTTP mapping and logs
 * are `../http.ts`, shared with upload: 200 accepted (also a duplicate), 400
 * an AD-6 rejection code, 413 `FILE_TOO_LARGE`, 500 `INTERNAL_ERROR`. The
 * Finish macro treats only 200 with `"ok":true` as success. A file that moved
 * the attempt to `received` schedules grading after the response
 * (`../grading.ts`, shared with upload); a duplicate or a refusal does not.
 */
export async function POST(request: Request): Promise<Response> {
  const bytes = await readSubmissionBody(request, "macro");
  if (bytes instanceof Response) return bytes;

  const { ports, fault } = serviceSubmissionPorts("macro");
  const result = await submit(bytes, { kind: "macro", headerToken: request.headers.get("x-attempt-token") }, ports);
  if (result.ok && result.log.received && result.log.attemptId !== null) scheduleGrading("macro", result.log.attemptId);
  return submissionResponse(result, "macro", fault());
}
