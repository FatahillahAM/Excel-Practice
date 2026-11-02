import { findAttemptByTokenHash, markReceived, type AttemptStatus } from "../../../../adapters/supabase/attempts";
import { createServiceClient } from "../../../../adapters/supabase/service";
import { RejectionCode } from "../../../../core/submission/rejection-codes";
import { fingerprintMatches, identifyMacroSubmission } from "./inspect";

/** A server fault, not a reason the file is refused (outside the AD-6 rejection codes). */
const INTERNAL_ERROR = "INTERNAL_ERROR";

export type MacroBody =
  /** `status`: the attempt's status after this post (`received` for a first Finish). */
  | { ok: true; data: { status: AttemptStatus } }
  | { ok: false; code: RejectionCode | typeof INTERNAL_ERROR };

/** One JSON log line (Consistency Conventions › Logging): never file bytes, tokens or emails. */
export interface MacroLog {
  attemptId: string | null;
  channel: "macro";
  code: RejectionCode | typeof INTERNAL_ERROR | null;
  /** First 12 hex of SHA-256 of the file's `WHE_AttemptToken`; `scripts/spike-s1.ts` prints the same value. */
  tokenSha256: string | null;
  /** Whether this post moved the attempt from `open` to `received`. */
  received: boolean;
}

/**
 * `POST /api/submissions/macro` (AD-6): the Finish macro posts the workbook's
 * bytes as `application/octet-stream` with header `X-Attempt-Token`. No
 * session: the token authenticates, and the attempt is found by its hash
 * through the service-role client (AD-9). Decision order: (1) `NOT_EXCEL`,
 * (2) `IDENTITY_ALTERED`, (3) `NOT_THIS_ATTEMPT`, (4) `IDENTITY_ALTERED`
 * against the attempt's `template_version`; then `open` → `received`
 * (compare-and-set), any other status → accepted without change. Entry 3 adds
 * `ALREADY_GRADED` / `ATTEMPT_CLOSED`. No file bytes are stored yet.
 */
export async function POST(request: Request): Promise<Response> {
  const bytes = new Uint8Array(await request.arrayBuffer());
  const log: MacroLog = { attemptId: null, channel: "macro", code: null, tokenSha256: null, received: false };
  const answer = (status: number, body: MacroBody): Response => {
    if (!body.ok) log.code = body.code;
    console.log(JSON.stringify(log));
    return Response.json(body, { status });
  };
  const reject = (code: RejectionCode) => answer(400, { ok: false, code });
  const fail = (event: string, detail?: string) => {
    console.error(JSON.stringify({ event, attemptId: log.attemptId, ...(detail ? { code: detail } : {}) }));
    return answer(500, { ok: false, code: INTERNAL_ERROR });
  };

  const identified = await identifyMacroSubmission(bytes, request.headers.get("x-attempt-token"));
  log.tokenSha256 = identified.tokenSha256;
  if (!identified.ok) return reject(identified.code);

  let service;
  try {
    service = createServiceClient();
  } catch (error) {
    return fail("macro.service_client_failed", errorName(error));
  }
  if (service === null) return fail("macro.service_env_missing");

  // AD-6 (3): the attempt is found by the file's token.
  const found = await findAttemptByTokenHash(service, identified.tokenSha256Hex);
  if (!found.ok) return fail("macro.lookup_failed");
  const attempt = found.value;
  if (attempt === null) return reject(RejectionCode.NOT_THIS_ATTEMPT);
  log.attemptId = attempt.id;

  // AD-6 (4): the VBA fingerprint of the attempt's own template version.
  let matches: boolean;
  try {
    matches = fingerprintMatches(identified.reading, attempt.templateVersion);
  } catch (error) {
    return fail("macro.template_version_unknown", errorName(error));
  }
  if (!matches) return reject(RejectionCode.IDENTITY_ALTERED);

  if (attempt.status !== "open") return answer(200, { ok: true, data: { status: attempt.status } });
  const marked = await markReceived(service, attempt.id);
  if (!marked.ok) return fail("macro.mark_received_failed");
  // `value: false`: another post moved it first; the file is accepted all the same.
  log.received = marked.value;
  return answer(200, { ok: true, data: { status: "received" } });
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}
