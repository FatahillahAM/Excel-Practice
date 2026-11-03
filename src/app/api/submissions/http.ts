import type { AttemptStatus } from "../../../core/services/attempts";
import {
  MAX_SUBMISSION_BYTES,
  SubmissionFault,
  type Channel,
  type SubmissionCode,
  type SubmissionLog,
  type SubmitResult,
} from "../../../core/submission";

/**
 * The HTTP side both submission routes share (AD-6): the bounded body, the
 * envelope, the status mapping and the log lines. `submit()` (core) decides;
 * this module only reads the body and answers. 200 accepted (also a
 * duplicate), 400 an AD-6 rejection code, 413 `FILE_TOO_LARGE`, 500
 * `INTERNAL_ERROR`. The Finish macro treats only 200 with `"ok":true` as
 * success and matches the raw text byte for byte, so the body is compact JSON
 * in this key order.
 */

/**
 * Answers a route gives before `submit()` runs, outside the AD-6
 * `RejectionCode`s: no session (401) and a body that is not
 * `application/octet-stream` (415, upload only).
 */
export const RouteFault = {
  UNAUTHENTICATED: "UNAUTHENTICATED",
  UNSUPPORTED_MEDIA_TYPE: "UNSUPPORTED_MEDIA_TYPE",
} as const;

export type RouteFault = (typeof RouteFault)[keyof typeof RouteFault];

/** Every code a submission route can answer. */
export type SubmissionRouteCode = SubmissionCode | RouteFault;

export type SubmissionBody =
  /** `status`: the attempt's status after this post; `duplicate`: it was already `received`/`grading_failed`. */
  | { ok: true; data: { status: AttemptStatus; duplicate: boolean } }
  | { ok: false; code: SubmissionRouteCode };

/** The log line of every answer: `SubmissionLog`, whose code may also be a route fault. */
export type SubmissionRouteLog = Omit<SubmissionLog, "code"> & { code: SubmissionRouteCode | null };

const FAULT_STATUS: Record<SubmissionFault | RouteFault, number> = {
  FILE_TOO_LARGE: 413,
  INTERNAL_ERROR: 500,
  UNAUTHENTICATED: 401,
  UNSUPPORTED_MEDIA_TYPE: 415,
};

export type ChannelKind = Channel["kind"];

/** A server fault's error log, `<channel>.<failure>` unless the route names another (e.g. a missing secret key). */
export type FaultLog = { event: string; code?: string };

/** The result of `submit()` as HTTP: one JSON log line, plus one error line for an `INTERNAL_ERROR`. */
export function submissionResponse(result: SubmitResult, channel: ChannelKind, fault: FaultLog | null = null): Response {
  if (result.ok) {
    return answer(200, { ok: true, data: { status: result.status, duplicate: result.duplicate } }, result.log);
  }
  if (result.code === SubmissionFault.INTERNAL_ERROR) {
    const { event, code } = fault ?? { event: `${channel}.${result.failure ?? "internal_error"}` };
    console.error(JSON.stringify({ event, attemptId: result.log.attemptId, ...(code ? { code } : {}) }));
    return answer(500, { ok: false, code: result.code }, result.log);
  }
  if (result.code === SubmissionFault.FILE_TOO_LARGE) return answer(413, { ok: false, code: result.code }, result.log);
  return answer(400, { ok: false, code: result.code }, result.log);
}

/**
 * An answer without `submit()`'s result (no session, wrong content type, body
 * too large or unreadable, a fault around `submit()`): the same envelope and
 * one log line. 401, 415, 413 or 500 by code.
 */
export function bodyFault(code: SubmissionFault | RouteFault, channel: ChannelKind): Response {
  const log: SubmissionRouteLog = {
    attemptId: null,
    channel,
    code,
    tokenSha256: null,
    received: false,
    duplicate: false,
  };
  return answer(FAULT_STATUS[code], { ok: false, code }, log);
}

/** Whether the request says its body is `application/octet-stream` (parameters ignored). */
export function isOctetStream(request: Request): boolean {
  const type = request.headers.get("content-type");
  return type !== null && type.split(";")[0].trim().toLowerCase() === "application/octet-stream";
}

/**
 * The request's bytes within `MAX_SUBMISSION_BYTES`, or the response that
 * refuses them: 413 when too large, 500 when the stream broke mid-body (the
 * client went away), logged as `<channel>.body_read_failed`.
 */
export async function readSubmissionBody(request: Request, channel: ChannelKind): Promise<Uint8Array | Response> {
  let bytes: Uint8Array | null;
  try {
    bytes = await readBoundedBody(request, MAX_SUBMISSION_BYTES);
  } catch (error) {
    console.error(JSON.stringify({ event: `${channel}.body_read_failed`, attemptId: null, code: errorName(error) }));
    return bodyFault(SubmissionFault.INTERNAL_ERROR, channel);
  }
  return bytes === null ? bodyFault(SubmissionFault.FILE_TOO_LARGE, channel) : bytes;
}

/**
 * The body, or `null` when it is larger than `max`: a `Content-Length` over the
 * limit is refused without reading; otherwise the stream is read until it
 * passes the limit, then cancelled (a missing or false length is not trusted).
 */
export async function readBoundedBody(request: Request, max: number): Promise<Uint8Array | null> {
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

export function errorName(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

/** One JSON log line (Consistency Conventions › Logging: never file bytes, tokens or emails), then the answer. */
function answer(status: number, body: SubmissionBody, log: SubmissionRouteLog): Response {
  console.log(JSON.stringify(log));
  return Response.json(body, { status });
}
