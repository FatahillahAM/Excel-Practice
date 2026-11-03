import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_SUBMISSION_BYTES, type SubmissionLog, type SubmitResult } from "../../../core/submission";
import { streamOf } from "./__fixtures__/files";
import { bodyFault, readBoundedBody, readSubmissionBody, submissionResponse } from "./http";

afterEach(() => {
  vi.restoreAllMocks();
});

const ID = "0b9e0d6c-3f1a-4c2e-9d55-8a7b6c5d4e3f";

function log(channel: "macro" | "upload", fields: Partial<SubmissionLog> = {}): SubmissionLog {
  return { attemptId: ID, channel, code: null, tokenSha256: "0123456789ab", received: false, duplicate: false, ...fields };
}

async function answered(response: Response) {
  return { status: response.status, text: await response.text() };
}

function request(body: BodyInit | ReadableStream<Uint8Array> | null, headers: Record<string, string> = {}): Request {
  const init: RequestInit & { duplex?: "half" } =
    body instanceof ReadableStream ? { method: "POST", headers, body, duplex: "half" } : { method: "POST", headers, body };
  return new Request("https://example.test/api/submissions/upload", init);
}

describe.each(["macro", "upload"] as const)("submissionResponse (%s)", (channel) => {
  it.each([
    [
      "accepted",
      { ok: true, status: "received", duplicate: false, log: log(channel, { received: true }) },
      200,
      { ok: true, data: { status: "received", duplicate: false } },
    ],
    [
      "a duplicate",
      { ok: true, status: "grading_failed", duplicate: true, log: log(channel, { duplicate: true }) },
      200,
      { ok: true, data: { status: "grading_failed", duplicate: true } },
    ],
    [
      "a rejection code",
      { ok: false, code: "NOT_THIS_ATTEMPT", log: log(channel, { code: "NOT_THIS_ATTEMPT" }) },
      400,
      { ok: false, code: "NOT_THIS_ATTEMPT" },
    ],
    [
      "too large",
      { ok: false, code: "FILE_TOO_LARGE", log: log(channel, { code: "FILE_TOO_LARGE" }) },
      413,
      { ok: false, code: "FILE_TOO_LARGE" },
    ],
  ] as [string, SubmitResult, number, object][])("answers %s with %s and one log line", async (_, result, status, body) => {
    const out = vi.spyOn(console, "log").mockImplementation(() => {});
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await answered(submissionResponse(result, channel));
    expect(response).toEqual({ status, text: JSON.stringify(body) });
    expect(out).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(out.mock.calls[0][0]))).toEqual(result.log);
    expect(errors).not.toHaveBeenCalled();
  });

  it("answers INTERNAL_ERROR with 500 and logs <channel>.<failure>", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const result: SubmitResult = {
      ok: false,
      code: "INTERNAL_ERROR",
      failure: "store_failed",
      log: log(channel, { code: "INTERNAL_ERROR" }),
    };
    expect(await answered(submissionResponse(result, channel))).toEqual({
      status: 500,
      text: JSON.stringify({ ok: false, code: "INTERNAL_ERROR" }),
    });
    expect(JSON.parse(String(errors.mock.calls[0][0]))).toEqual({ event: `${channel}.store_failed`, attemptId: ID });
  });

  it("logs the route's own fault event when given", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const result: SubmitResult = { ok: false, code: "INTERNAL_ERROR", failure: "lookup_failed", log: log(channel) };
    submissionResponse(result, channel, { event: "x.missing", code: "Error" });
    expect(JSON.parse(String(errors.mock.calls[0][0]))).toEqual({ event: "x.missing", attemptId: ID, code: "Error" });
  });

  it("refuses a body before submit() with the same envelope and log line", async () => {
    const out = vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await answered(bodyFault("FILE_TOO_LARGE", channel))).toEqual({
      status: 413,
      text: JSON.stringify({ ok: false, code: "FILE_TOO_LARGE" }),
    });
    expect(await answered(bodyFault("INTERNAL_ERROR", channel))).toEqual({
      status: 500,
      text: JSON.stringify({ ok: false, code: "INTERNAL_ERROR" }),
    });
    expect(out.mock.calls.map(([line]) => JSON.parse(String(line)))).toEqual([
      { attemptId: null, channel, code: "FILE_TOO_LARGE", tokenSha256: null, received: false, duplicate: false },
      { attemptId: null, channel, code: "INTERNAL_ERROR", tokenSha256: null, received: false, duplicate: false },
    ]);
  });

  it("logs <channel>.body_read_failed when the stream breaks mid-body", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    let sent = false;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent) return controller.error(new TypeError("terminated"));
        sent = true;
        controller.enqueue(new Uint8Array(16));
      },
    });
    const out = await readSubmissionBody(request(stream), channel);
    expect(out).toBeInstanceOf(Response);
    expect((out as Response).status).toBe(500);
    expect(JSON.parse(String(errors.mock.calls[0][0]))).toEqual({
      event: `${channel}.body_read_failed`,
      attemptId: null,
      code: "TypeError",
    });
  });
});

describe("readBoundedBody", () => {
  it("reads a body within the limit, also in chunks", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    expect(await readBoundedBody(request(bytes), 5)).toEqual(bytes);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 2));
        controller.enqueue(bytes.slice(2));
        controller.close();
      },
    });
    expect(await readBoundedBody(request(stream), 5)).toEqual(bytes);
  });

  it("reads a missing body as empty", async () => {
    expect(await readBoundedBody(request(null), 5)).toEqual(new Uint8Array(0));
  });

  it("refuses a Content-Length over the limit without reading", async () => {
    const { stream, pulled } = streamOf(MAX_SUBMISSION_BYTES + 1);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const before = pulled();
    expect(
      await readBoundedBody(request(stream, { "content-length": String(MAX_SUBMISSION_BYTES + 1) }), MAX_SUBMISSION_BYTES),
    ).toBeNull();
    expect(pulled()).toBe(before);
  });

  it("stops reading a stream past the limit, whatever its Content-Length says", async () => {
    const { stream, pulled } = streamOf(MAX_SUBMISSION_BYTES * 4);
    expect(await readBoundedBody(request(stream, { "content-length": "100" }), MAX_SUBMISSION_BYTES)).toBeNull();
    expect(pulled()).toBeLessThan((MAX_SUBMISSION_BYTES * 4) / (64 * 1024));
  });

  it("refuses a body of exactly the limit + 1 and accepts the limit", async () => {
    expect(await readBoundedBody(request(new Uint8Array(11)), 10)).toBeNull();
    expect((await readBoundedBody(request(new Uint8Array(10)), 10))?.byteLength).toBe(10);
  });

  it("returns a Response from readSubmissionBody for a body too large", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const out = await readSubmissionBody(request(new Uint8Array(MAX_SUBMISSION_BYTES + 1)), "upload");
    expect((out as Response).status).toBe(413);
  });
});
