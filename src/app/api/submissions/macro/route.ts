import type { SupabaseClient } from "@supabase/supabase-js";
import {
  findAttemptByTokenHash,
  markReceived,
  storeSubmissionFile,
  type AttemptStatus,
} from "../../../../adapters/supabase/attempts";
import { createServiceClient } from "../../../../adapters/supabase/service";
import { workbookPort } from "../../../../adapters/workbook/submission";
import {
  MAX_SUBMISSION_BYTES,
  SubmissionFault,
  submit,
  type SubmissionCode,
  type SubmissionLog,
  type SubmissionPorts,
} from "../../../../core/submission";

export type MacroBody =
  /** `status`: the attempt's status after this post; `duplicate`: it was already `received`/`grading_failed`. */
  | { ok: true; data: { status: AttemptStatus; duplicate: boolean } }
  | { ok: false; code: SubmissionCode };

/** One JSON log line (Consistency Conventions › Logging): never file bytes, tokens or emails. */
export type MacroLog = SubmissionLog;

/**
 * `POST /api/submissions/macro` (AD-6): the Finish macro posts the workbook's
 * bytes as `application/octet-stream` with header `X-Attempt-Token`. No
 * session: the token authenticates, and the ports use the service-role client
 * (AD-9). The rules are `submit()`'s (core); this handler only bounds the
 * body, wires the ports and maps the result to HTTP: 200 accepted (also a
 * duplicate), 400 an AD-6 rejection code, 413 `FILE_TOO_LARGE`, 500
 * `INTERNAL_ERROR`. The Finish macro treats only 200 with `"ok":true` as success.
 */
export async function POST(request: Request): Promise<Response> {
  const answer = (status: number, body: MacroBody, log: SubmissionLog): Response => {
    console.log(JSON.stringify(log));
    return Response.json(body, { status });
  };

  const bytes = await readBoundedBody(request, MAX_SUBMISSION_BYTES);
  if (bytes === null) {
    const log: SubmissionLog = {
      attemptId: null,
      channel: "macro",
      code: SubmissionFault.FILE_TOO_LARGE,
      tokenSha256: null,
      received: false,
      duplicate: false,
    };
    return answer(413, { ok: false, code: SubmissionFault.FILE_TOO_LARGE }, log);
  }

  // The service client is created on the first port call, so a file refused in
  // steps (1)–(2) never needs the secret key.
  let service: SupabaseClient | undefined;
  let serviceFault: { event: string; code?: string } | null = null;
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
        return client === null ? "failed" : storeSubmissionFile(client, attemptId, n, file);
      },
    },
  };

  const result = await submit(bytes, { kind: "macro", headerToken: request.headers.get("x-attempt-token") }, ports);
  if (result.ok) {
    return answer(200, { ok: true, data: { status: result.status, duplicate: result.duplicate } }, result.log);
  }
  if (result.code === SubmissionFault.INTERNAL_ERROR) {
    const { event, code }: { event: string; code?: string } = serviceFault ?? {
      event: `macro.${result.failure ?? "internal_error"}`,
    };
    console.error(JSON.stringify({ event, attemptId: result.log.attemptId, ...(code ? { code } : {}) }));
    return answer(500, { ok: false, code: result.code }, result.log);
  }
  if (result.code === SubmissionFault.FILE_TOO_LARGE) return answer(413, { ok: false, code: result.code }, result.log);
  return answer(400, { ok: false, code: result.code }, result.log);
}

/**
 * The body, or `null` when it is larger than `max`: a `Content-Length` over the
 * limit is refused without reading; otherwise the stream is read until it
 * passes the limit, then cancelled (a missing or false length is not trusted).
 */
async function readBoundedBody(request: Request, max: number): Promise<Uint8Array | null> {
  const declared = request.headers.get("content-length");
  if (declared !== null && /^\s*\d+\s*$/.test(declared) && Number(declared) > max) return null;
  if (request.body === null) return new Uint8Array(0);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}
