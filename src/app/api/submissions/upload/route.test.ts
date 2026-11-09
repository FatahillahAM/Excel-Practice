import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  createServiceClient: vi.fn(),
  findAttemptByTokenHash: vi.fn(),
  markReceived: vi.fn(),
  storeSubmissionFile: vi.fn(),
  after: vi.fn(),
}));
// Grading runs in `after()` (../grading.ts): captured here, never run.
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@/adapters/supabase/auth", () => ({ getSessionUser: mocks.getSessionUser }));
vi.mock("@/adapters/supabase/service", () => ({ createServiceClient: mocks.createServiceClient }));
vi.mock("@/adapters/supabase/attempts", () => ({
  findAttemptByTokenHash: mocks.findAttemptByTokenHash,
  markReceived: mocks.markReceived,
  storeSubmissionFile: mocks.storeSubmissionFile,
  changeStatus: vi.fn(),
  downloadSubmissionFile: vi.fn(),
  loadForGrading: vi.fn(),
}));

import { readWorkbook } from "@/adapters/workbook/read";
import { CURRENT_TEMPLATE_VERSION } from "@/adapters/workbook/templates";
import { tokenSha256, tokenSha256Hex } from "@/adapters/workbook/token";
import { MAX_SUBMISSION_BYTES, RejectionCode } from "@/core/submission";
import {
  PDF_BYTES,
  asDocx,
  asXlsx,
  loadTemplate,
  newToken,
  patched,
  readS3Fixture,
  streamOf,
  withEditedModFinish,
  type Template,
} from "../__fixtures__/files";
import { POST as macroPOST } from "../macro/route";
import { POST } from "./route";

// The I/O matrix of the upload path (entry 5), posted to the route handler
// with the session and the service-role adapters mocked. The session has no
// write access of its own (`supabase/tests`): the route checks the owner.

const ENDPOINT = "https://example.test/api/submissions/upload";
const USER_ID = "user-1";
const SERVICE = { service: true };
const ATTEMPT_ID = "0b9e0d6c-3f1a-4c2e-9d55-8a7b6c5d4e3f";
const ACCEPTED = { ok: true, data: { status: "received", duplicate: false } };

let template: Template;
beforeAll(async () => {
  template = await loadTemplate();
});

/** The attempt the lookup finds, by default `open` on the current template. */
function attemptFound(status = "open", templateVersion = CURRENT_TEMPLATE_VERSION) {
  mocks.findAttemptByTokenHash.mockResolvedValue({
    ok: true,
    value: { id: ATTEMPT_ID, userId: USER_ID, status, templateVersion },
  });
}

beforeEach(() => {
  mocks.getSessionUser.mockResolvedValue({ id: USER_ID, email: null });
  mocks.createServiceClient.mockImplementation(() => SERVICE);
  attemptFound();
  mocks.markReceived.mockResolvedValue({ ok: true, value: true });
  mocks.storeSubmissionFile.mockResolvedValue("stored");
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const mock of Object.values(mocks)) mock.mockReset();
});

interface Posted {
  status: number;
  body: unknown;
  text: string;
  logLines: string[];
}

async function post(
  body: Uint8Array | ReadableStream<Uint8Array>,
  extraHeaders: Record<string, string> = {},
  handler: (request: Request) => Promise<Response> = POST,
  endpoint = ENDPOINT,
): Promise<Posted> {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const headers: Record<string, string> = { "content-type": "application/octet-stream", ...extraHeaders };
  // An empty content type stands for none sent.
  if (headers["content-type"] === "") delete headers["content-type"];
  const init: RequestInit & { duplex?: "half" } =
    body instanceof ReadableStream
      ? { method: "POST", headers, body, duplex: "half" }
      : { method: "POST", headers, body: Buffer.from(body) };
  const response = await handler(new Request(endpoint, init));
  const logLines = log.mock.calls.map((args) => args.map(String).join(" "));
  log.mockRestore();
  const text = await response.text();
  return { status: response.status, body: JSON.parse(text), text, logLines };
}

/** The single JSON log line, with `channel: "upload"` and none of `tokens` in it. */
function logOf(posted: Posted, ...tokens: (string | null | undefined)[]): Record<string, unknown> {
  expect(posted.logLines).toHaveLength(1);
  const [line] = posted.logLines;
  for (const token of tokens) if (token) expect(line).not.toContain(token);
  const log = JSON.parse(line) as Record<string, unknown>;
  expect(log.channel).toBe("upload");
  expect(Object.keys(log).sort()).toEqual(["attemptId", "channel", "code", "duplicate", "received", "tokenSha256"]);
  return log;
}

describe("POST /api/submissions/upload: session and content type", () => {
  it("answers 401 UNAUTHENTICATED without a session, before reading the body or creating the service client", async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    const { stream, pulled } = streamOf(1024 * 1024);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const before = pulled();
    const posted = await post(stream);
    expect(posted.status).toBe(401);
    expect(posted.text).toBe(JSON.stringify({ ok: false, code: "UNAUTHENTICATED" }));
    expect(pulled()).toBe(before);
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
    expect(mocks.findAttemptByTokenHash).not.toHaveBeenCalled();
    expect(logOf(posted)).toEqual({
      attemptId: null,
      channel: "upload",
      code: "UNAUTHENTICATED",
      tokenSha256: null,
      received: false,
      duplicate: false,
    });
  });

  it("creates the service client only after the session check passed", async () => {
    expect((await post(await patched(template, newToken()))).status).toBe(200);
    expect(mocks.createServiceClient).toHaveBeenCalledTimes(1);
    expect(mocks.getSessionUser.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.createServiceClient.mock.invocationCallOrder[0],
    );
  });

  it("answers 500 INTERNAL_ERROR when the session read throws", async () => {
    mocks.getSessionUser.mockRejectedValue(new TypeError("fetch failed"));
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const posted = await post(await patched(template, newToken()));
    expect(posted.status).toBe(500);
    expect(posted.text).toBe(JSON.stringify({ ok: false, code: "INTERNAL_ERROR" }));
    expect(logOf(posted)).toMatchObject({ code: "INTERNAL_ERROR" });
    expect(JSON.parse(String(errors.mock.calls[0][0]))).toEqual({
      event: "upload.session_failed",
      attemptId: null,
      code: "TypeError",
    });
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });

  it.each([
    ["no content type", ""],
    ["text/plain (a cross-site simple POST)", "text/plain"],
    ["multipart/form-data", "multipart/form-data; boundary=x"],
  ])("answers 415 UNSUPPORTED_MEDIA_TYPE for %s, before reading the body", async (_, type) => {
    const { stream, pulled } = streamOf(1024 * 1024);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const before = pulled();
    const posted = await post(stream, { "content-type": type });
    expect(posted.status).toBe(415);
    expect(posted.text).toBe(JSON.stringify({ ok: false, code: "UNSUPPORTED_MEDIA_TYPE" }));
    expect(pulled()).toBe(before);
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
    expect(logOf(posted)).toMatchObject({ code: "UNSUPPORTED_MEDIA_TYPE" });
  });

  it("accepts application/octet-stream with parameters, in any case", async () => {
    const posted = await post(await patched(template, newToken()), { "content-type": "Application/Octet-Stream; x=1" });
    expect(posted.status).toBe(200);
  });
});

describe("POST /api/submissions/upload: accepted", () => {
  it("finds the attempt by the file's token through the service role, stores submission-1, then moves it to received", async () => {
    const token = newToken();
    const file = await patched(template, token);
    const posted = await post(file);

    expect(posted.status).toBe(200);
    expect(posted.text).toBe(JSON.stringify(ACCEPTED));
    expect(mocks.findAttemptByTokenHash).toHaveBeenCalledWith(SERVICE, tokenSha256Hex(token));
    expect(mocks.storeSubmissionFile).toHaveBeenCalledWith(SERVICE, ATTEMPT_ID, 1, file, { replace: true });
    expect(mocks.markReceived).toHaveBeenCalledWith(SERVICE, ATTEMPT_ID);
    expect(mocks.storeSubmissionFile.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.markReceived.mock.invocationCallOrder[0],
    );
    expect(logOf(posted, token, tokenSha256Hex(token))).toEqual({
      attemptId: ATTEMPT_ID,
      channel: "upload",
      code: null,
      tokenSha256: tokenSha256(token),
      received: true,
      duplicate: false,
    });
  });

  it("needs no X-Attempt-Token header (the upload skips that check)", async () => {
    const token = newToken();
    const posted = await post(await patched(template, token), { "x-attempt-token": newToken() });
    expect(posted.status).toBe(200);
  });

  it("accepts the Excel-saved S3 file", async () => {
    const file = await readS3Fixture();
    const token = (await readWorkbook(file)).properties.WHE_AttemptToken;
    const posted = await post(file);
    expect(posted.status).toBe(200);
    expect(logOf(posted, token)).toMatchObject({ code: null, received: true });
  });

  it.each(["received", "grading_failed"])("answers 200 duplicate for an attempt already %s, storing nothing", async (status) => {
    attemptFound(status);
    const posted = await post(await patched(template, newToken()));
    expect(posted.status).toBe(200);
    expect(posted.text).toBe(JSON.stringify({ ok: true, data: { status, duplicate: true } }));
    expect(mocks.storeSubmissionFile).not.toHaveBeenCalled();
    expect(mocks.markReceived).not.toHaveBeenCalled();
    expect(logOf(posted)).toMatchObject({ duplicate: true, received: false });
  });
});

/** Each wrong file of the matrix, and how to arrange the lookup for it. */
const REFUSALS: [string, (token: string) => Promise<Uint8Array>, () => void, RejectionCode][] = [
  ["an empty file", async () => new Uint8Array(0), () => {}, RejectionCode.NOT_EXCEL],
  ["a PDF", async () => PDF_BYTES, () => {}, RejectionCode.NOT_EXCEL],
  ["a Word document", (token) => asDocx(template, token), () => {}, RejectionCode.NOT_EXCEL],
  ["a Save-As .xlsx", (token) => asXlsx(template, token), () => {}, RejectionCode.IDENTITY_ALTERED],
  ["a file without a token", () => patched(template, ""), () => {}, RejectionCode.IDENTITY_ALTERED],
  ["an edited modFinish", (token) => withEditedModFinish(template, token), () => {}, RejectionCode.IDENTITY_ALTERED],
  [
    "an old file (no attempt has its token)",
    (token) => patched(template, token),
    () => mocks.findAttemptByTokenHash.mockResolvedValue({ ok: true, value: null }),
    RejectionCode.NOT_THIS_ATTEMPT,
  ],
  ["a graded attempt's file", (token) => patched(template, token), () => attemptFound("graded"), RejectionCode.ALREADY_GRADED],
  [
    "an abandoned attempt's file",
    (token) => patched(template, token),
    () => attemptFound("abandoned"),
    RejectionCode.ATTEMPT_CLOSED,
  ],
  ["a closed attempt's file", (token) => patched(template, token), () => attemptFound("closed"), RejectionCode.ATTEMPT_CLOSED],
];

describe("POST /api/submissions/upload: one fixture per code", () => {
  it.each(REFUSALS)("refuses %s with 400 and its code, leaving the attempt as it is", async (_, make, arrange, code) => {
    arrange();
    const token = newToken();
    const posted = await post(await make(token));
    expect(posted.status).toBe(400);
    expect(posted.text).toBe(JSON.stringify({ ok: false, code }));
    expect(mocks.storeSubmissionFile).not.toHaveBeenCalled();
    expect(mocks.markReceived).not.toHaveBeenCalled();
    expect(logOf(posted, token)).toMatchObject({ code, received: false });
  });

  it("refuses another user's token with NOT_THIS_ATTEMPT: the attempt's user_id is not the session user's", async () => {
    mocks.findAttemptByTokenHash.mockResolvedValue({
      ok: true,
      value: { id: ATTEMPT_ID, userId: "someone-else", status: "open", templateVersion: CURRENT_TEMPLATE_VERSION },
    });
    const token = newToken();
    const posted = await post(await patched(template, token));
    expect(posted.status).toBe(400);
    expect(posted.text).toBe(JSON.stringify({ ok: false, code: RejectionCode.NOT_THIS_ATTEMPT }));
    expect(mocks.findAttemptByTokenHash).toHaveBeenCalledWith(SERVICE, tokenSha256Hex(token));
    expect(mocks.storeSubmissionFile).not.toHaveBeenCalled();
    expect(mocks.markReceived).not.toHaveBeenCalled();
    // Their attempt id never reaches the log.
    expect(logOf(posted, token)).toMatchObject({ attemptId: null, code: "NOT_THIS_ATTEMPT" });
  });

  it.each(["graded", "abandoned"])("refuses another user's %s attempt with NOT_THIS_ATTEMPT too", async (status) => {
    mocks.findAttemptByTokenHash.mockResolvedValue({
      ok: true,
      value: { id: ATTEMPT_ID, userId: "someone-else", status, templateVersion: CURRENT_TEMPLATE_VERSION },
    });
    const posted = await post(await patched(template, newToken()));
    expect(posted.body).toEqual({ ok: false, code: RejectionCode.NOT_THIS_ATTEMPT });
  });
});

describe("POST /api/submissions/upload: size limit", () => {
  const TOO_LARGE = JSON.stringify({ ok: false, code: "FILE_TOO_LARGE" });

  it("refuses a Content-Length over 4 MiB with 413 without reading the body", async () => {
    const { stream, pulled } = streamOf(MAX_SUBMISSION_BYTES + 1);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const before = pulled();
    const posted = await post(stream, { "content-length": String(MAX_SUBMISSION_BYTES + 1) });
    expect(posted.status).toBe(413);
    expect(posted.text).toBe(TOO_LARGE);
    expect(pulled()).toBe(before);
    expect(mocks.findAttemptByTokenHash).not.toHaveBeenCalled();
    expect(logOf(posted)).toEqual({
      attemptId: null,
      channel: "upload",
      code: "FILE_TOO_LARGE",
      tokenSha256: null,
      received: false,
      duplicate: false,
    });
  });

  it("refuses a streamed body past 4 MiB without Content-Length, and stops reading", async () => {
    const { stream, pulled } = streamOf(MAX_SUBMISSION_BYTES * 4);
    const posted = await post(stream);
    expect(posted.status).toBe(413);
    expect(posted.text).toBe(TOO_LARGE);
    expect(pulled()).toBeLessThan((MAX_SUBMISSION_BYTES * 4) / (64 * 1024));
  });
});

describe("POST /api/submissions/upload: server faults", () => {
  /** Posts the file from Start and checks the 500 envelope, one log line and one error line without the token. */
  async function expectInternalError(event: string, extra: Record<string, unknown> = {}) {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const token = newToken();
    const posted = await post(await patched(template, token));
    expect(posted.status).toBe(500);
    expect(posted.text).toBe(JSON.stringify({ ok: false, code: "INTERNAL_ERROR" }));
    expect(logOf(posted, token)).toMatchObject({ code: "INTERNAL_ERROR", received: false });
    expect(errors).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(errors.mock.calls[0][0]))).toMatchObject({ event, ...extra });
    expect(String(errors.mock.calls[0][0])).not.toContain(token);
  }

  it("answers 500 when the file cannot be stored, without moving the attempt", async () => {
    mocks.storeSubmissionFile.mockResolvedValue("failed");
    await expectInternalError("upload.store_failed", { attemptId: ATTEMPT_ID });
    expect(mocks.markReceived).not.toHaveBeenCalled();
  });

  it("answers 500 when the status change fails, after storing the file and attempting the change", async () => {
    mocks.markReceived.mockResolvedValue({ ok: false });
    await expectInternalError("upload.mark_received_failed", { attemptId: ATTEMPT_ID });
    expect(mocks.storeSubmissionFile).toHaveBeenCalledWith(SERVICE, ATTEMPT_ID, 1, expect.any(Uint8Array), {
      replace: true,
    });
    expect(mocks.markReceived).toHaveBeenCalledWith(SERVICE, ATTEMPT_ID);
  });

  it("answers 500 when the lookup fails", async () => {
    mocks.findAttemptByTokenHash.mockResolvedValue({ ok: false });
    await expectInternalError("upload.lookup_failed");
  });

  it("answers 500 when the secret key is not set", async () => {
    mocks.createServiceClient.mockImplementation(() => null);
    await expectInternalError("upload.service_env_missing");
  });

  it("answers 500 when the service client cannot be created", async () => {
    mocks.createServiceClient.mockImplementation(() => {
      throw new Error("Invalid supabaseUrl");
    });
    await expectInternalError("upload.service_client_failed", { code: "Error" });
  });

  it("answers 500 when submit() throws", async () => {
    mocks.findAttemptByTokenHash.mockRejectedValue(new RangeError("boom"));
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const posted = await post(await patched(template, newToken()));
    expect(posted.status).toBe(500);
    expect(posted.text).toBe(JSON.stringify({ ok: false, code: "INTERNAL_ERROR" }));
    expect(logOf(posted)).toMatchObject({ code: "INTERNAL_ERROR" });
    expect(JSON.parse(String(errors.mock.calls[0][0]))).toEqual({
      event: "upload.submit_failed",
      attemptId: null,
      code: "RangeError",
    });
  });
});

describe("POST /api/submissions/upload: grading", () => {
  it("schedules grading once in after() when the file moves the attempt to received", async () => {
    const token = newToken();
    const posted = await post(await patched(template, token));
    expect(posted.body).toEqual(ACCEPTED);
    expect(mocks.after).toHaveBeenCalledTimes(1);
    expect(mocks.after.mock.calls[0][0]).toBeTypeOf("function");
  });

  it.each(["received", "grading_failed"])("does not schedule grading for a duplicate (%s)", async (status) => {
    attemptFound(status);
    await post(await patched(template, newToken()));
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("does not schedule grading for a refusal, a lost compare-and-set or a server fault", async () => {
    await post(PDF_BYTES);
    attemptFound("graded");
    await post(await patched(template, newToken()));
    attemptFound();
    mocks.storeSubmissionFile.mockResolvedValue("failed");
    vi.spyOn(console, "error").mockImplementation(() => {});
    await post(await patched(template, newToken()));
    expect(mocks.after).not.toHaveBeenCalled();
  });
});

describe("parity: macro and upload answer the same file the same way (Consistency Conventions › Testing)", () => {
  const ACCEPT: [string, (token: string) => Promise<Uint8Array>, () => void, null][] = [
    ["the file from Start", (token) => patched(template, token), () => {}, null],
    ["a duplicate", (token) => patched(template, token), () => attemptFound("received"), null],
  ];

  it.each([...ACCEPT, ...REFUSALS])("%s", async (_, make, arrange, code) => {
    const token = newToken();
    const file = await make(token);
    arrange();
    const macro = await post(file, { "x-attempt-token": token }, macroPOST, "https://example.test/api/submissions/macro");
    const macroScheduled = mocks.after.mock.calls.length;
    arrange();
    const upload = await post(file);
    const uploadScheduled = mocks.after.mock.calls.length - macroScheduled;

    // Both channels schedule grading through the same function: once for a fresh accept, never otherwise.
    const fresh = code === null && macro.body !== null && (macro.body as { data?: { duplicate?: boolean } }).data?.duplicate === false;
    expect(macroScheduled).toBe(fresh ? 1 : 0);
    expect(uploadScheduled).toBe(macroScheduled);

    expect(upload.status).toBe(macro.status);
    expect(upload.text).toBe(macro.text);
    expect(upload.status).toBe(code === null ? 200 : 400);
    if (code !== null) expect(upload.body).toEqual({ ok: false, code });
    const strip = (line: string) => ({ ...JSON.parse(line), channel: undefined });
    expect(strip(upload.logLines[0])).toEqual(strip(macro.logLines[0]));
  });
});
