import type { SupabaseClient } from "@supabase/supabase-js";
import { findAttemptByTokenHash, markReceived, storeSubmissionFile } from "../../../../adapters/supabase/attempts";
import { createServiceClient } from "../../../../adapters/supabase/service";
import { workbookPort } from "../../../../adapters/workbook/submission";
import { submit, type SubmissionLog, type SubmissionPorts } from "../../../../core/submission";
import { errorName, readSubmissionBody, submissionResponse, type FaultLog, type SubmissionBody } from "../http";

/** The macro's answer: the envelope both submission routes share (`../http.ts`). */
export type MacroBody = SubmissionBody;

/** One JSON log line (Consistency Conventions › Logging): never file bytes, tokens or emails. */
export type MacroLog = SubmissionLog;

/**
 * `POST /api/submissions/macro` (AD-6): the Finish macro posts the workbook's
 * bytes as `application/octet-stream` with header `X-Attempt-Token`. No
 * session: the token authenticates, and the ports use the service-role client
 * (AD-9). The rules are `submit()`'s (core); this handler only wires the
 * ports. Body limit, envelope, HTTP mapping and logs are `../http.ts`, shared
 * with upload: 200 accepted (also a duplicate), 400 an AD-6 rejection code,
 * 413 `FILE_TOO_LARGE`, 500 `INTERNAL_ERROR`. The Finish macro treats only
 * 200 with `"ok":true` as success.
 */
export async function POST(request: Request): Promise<Response> {
  const bytes = await readSubmissionBody(request, "macro");
  if (bytes instanceof Response) return bytes;

  // The service client is created on the first port call, so a file refused in
  // steps (1)–(2) never needs the secret key.
  let service: SupabaseClient | undefined;
  let serviceFault: FaultLog | null = null;
  const serviceClient = (): SupabaseClient | null => {
    if (service !== undefined) return service;
    if (serviceFault !== null) return null;
    try {
      const client = createServiceClient();
      if (client === null) serviceFault = { event: "macro.service_env_missing" };
      else service = client;
    } catch (error) {
      serviceFault = { event: "macro.service_client_failed", code: errorName(error) };
    }
    return service ?? null;
  };

  const ports: SubmissionPorts = {
    workbook: workbookPort,
    attempts: {
      findByTokenHash: async (hash) => {
        const client = serviceClient();
        return client === null ? { ok: false } : findAttemptByTokenHash(client, hash);
      },
      markReceived: async (attemptId) => {
        const client = serviceClient();
        return client === null ? { ok: false } : markReceived(client, attemptId);
      },
    },
    files: {
      storeSubmission: async (attemptId, n, file) => {
        const client = serviceClient();
        if (client === null) return "failed";
        // Upsert: `submit()` stores only while the attempt is `open` (never for a duplicate).
        const stored = await storeSubmissionFile(client, attemptId, n, file, { replace: true });
        return stored === "failed" ? "failed" : "stored";
      },
    },
  };

  const result = await submit(bytes, { kind: "macro", headerToken: request.headers.get("x-attempt-token") }, ports);
  return submissionResponse(result, "macro", serviceFault);
}
