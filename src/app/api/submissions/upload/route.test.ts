import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
  findAttemptByTokenHash: vi.fn(),
  markReceived: vi.fn(),
  storeSubmissionFile: vi.fn(),
}));
vi.mock("../../../../adapters/supabase/auth", () => ({ getSessionUser: mocks.getSessionUser }));
vi.mock("../../../../adapters/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("../../../../adapters/supabase/service", () => ({ createServiceClient: mocks.createServiceClient }));
vi.mock("../../../../adapters/supabase/attempts", () => ({
  findAttemptByTokenHash: mocks.findAttemptByTokenHash,
  markReceived: mocks.markReceived,
  storeSubmissionFile: mocks.storeSubmissionFile,
}));

import { readWorkbook } from "../../../../adapters/workbook/read";
import { CURRENT_TEMPLATE_VERSION } from "../../../../adapters/workbook/templates";
import { tokenSha256, tokenSha256Hex } from "../../../../adapters/workbook/token";
import { MAX_SUBMISSION_BYTES, RejectionCode } from "../../../../core/submission";
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
// with the session mocked; RLS itself is covered by `supabase/tests`.

const ENDPOINT = "https://example.test/api/submissions/upload";
const SESSION = { session: true };
const SERVICE = { service: true };
const ATTEMPT_ID = "0b9e0d6c-3f1a-4c2e-9d55-8a7b6c5d4e3f";
const ACCEPTED = { ok: true, data: { status: "received", duplicate: false } };

let template: Template;
beforeAll(async () => {
  template = await loadTemplate();
});

/** The attempt the lookup finds, by default `open` on the current template. */
function attemptFound(status = "open", templateVersion = CURRENT_TEMPLATE_VERSION) {
  mocks.findAttemptByTokenHash.mockResolvedValue({ ok: true, value: { id: ATTEMPT_ID, status, templateVersion } });
}

beforeEach(() => {
  mocks.getSessionUser.mockResolvedValue({ id: "user-1", email: null });
  mocks.createClient.mockResolvedValue(SESSION);
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

describe("POST /api/submissions/upload: session", () => {
  it("answers 401 UNAUTHENTICATED without a session, before reading the body or touching the database", async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    const { stream, pulled } = streamOf(1024 * 1024);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const before = pulled();
    const posted = await post(stream);
    expect(posted.status).toBe(401);
    expect(posted.text).toBe(JSON.stringify({ ok: false, code: "UNAUTHENTICATED" }));
    expect(pulled()).toBe(before);
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.findAttemptByTokenHash).not.toHaveBeenCalled();
  });

  it("never uses the service role", async () => {
    const token = newToken();
    expect((await post(await patched(template, token))).status).toBe(200);
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });
});

describe("POST /api/submissions/upload: accepted", () => {
  it("finds the attempt by the file's token through the session, stores submission-1, then moves it to received", async () => {
    const token = newToken();
    const file = await patched(template, token);
    const posted = await post(file);

    expect(posted.status).toBe(200);
    expect(posted.text).toBe(JSON.stringify(ACCEPTED));
    expect(mocks.findAttemptByTokenHash).toHaveBeenCalledWith(SESSION, tokenSha256Hex(token));
    expect(mocks.storeSubmissionFile).toHaveBeenCalledWith(SESSION, ATTEMPT_ID, 1, file, { replace: true });
    expect(mocks.markReceived).toHaveBeenCalledWith(SESSION, ATTEMPT_ID);
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

  it("refuses another user's token with NOT_THIS_ATTEMPT: the session's lookup does not see their attempt", async () => {
    // RLS: the owner-only select policy hides the other user's row (supabase/tests).
    mocks.findAttemptByTokenHash.mockImplementation(async (client: unknown) =>
      client === SESSION ? { ok: true, value: null } : { ok: true, value: { id: ATTEMPT_ID, status: "open", templateVersion: 1 } },
    );
    const token = newToken();
    const posted = await post(await patched(template, token));
    expect(posted.status).toBe(400);
    expect(posted.text).toBe(JSON.stringify({ ok: false, code: RejectionCode.NOT_THIS_ATTEMPT }));
    expect(mocks.findAttemptByTokenHash).toHaveBeenCalledWith(SESSION, tokenSha256Hex(token));
    expect(logOf(posted, token)).toMatchObject({ attemptId: null, code: "NOT_THIS_ATTEMPT" });
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
  it.each([
    ["the file cannot be stored", () => mocks.storeSubmissionFile.mockResolvedValue("failed"), "upload.store_failed", false],
    ["the status change fails", () => mocks.markReceived.mockResolvedValue({ ok: false }), "upload.mark_received_failed", true],
    ["the lookup fails", () => mocks.findAttemptByTokenHash.mockResolvedValue({ ok: false }), "upload.lookup_failed", false],
  ])("answers 500 INTERNAL_ERROR when %s, and logs it without the token", async (_, arrange, event, stored) => {
    arrange();
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const token = newToken();
    const posted = await post(await patched(template, token));
    expect(posted.status).toBe(500);
    expect(posted.text).toBe(JSON.stringify({ ok: false, code: "INTERNAL_ERROR" }));
    expect(logOf(posted, token)).toMatchObject({ code: "INTERNAL_ERROR", received: false });
    expect(errors).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(errors.mock.calls[0][0]))).toMatchObject({ event });
    expect(String(errors.mock.calls[0][0])).not.toContain(token);
    if (!stored) expect(mocks.markReceived).not.toHaveBeenCalled();
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
    arrange();
    const upload = await post(file);

    expect(upload.status).toBe(macro.status);
    expect(upload.text).toBe(macro.text);
    expect(upload.status).toBe(code === null ? 200 : 400);
    if (code !== null) expect(upload.body).toEqual({ ok: false, code });
    const strip = (line: string) => ({ ...JSON.parse(line), channel: undefined });
    expect(strip(upload.logLines[0])).toEqual(strip(macro.logLines[0]));
  });
});
