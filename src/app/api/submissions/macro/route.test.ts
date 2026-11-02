import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  findAttemptByTokenHash: vi.fn(),
  markReceived: vi.fn(),
}));
vi.mock("../../../../adapters/supabase/service", () => ({ createServiceClient: mocks.createServiceClient }));
vi.mock("../../../../adapters/supabase/attempts", () => ({
  findAttemptByTokenHash: mocks.findAttemptByTokenHash,
  markReceived: mocks.markReceived,
}));

import { buildVbaProject, type ModuleSpec } from "../../../../adapters/workbook/__fixtures__/vba-project";
import { readWorkbook } from "../../../../adapters/workbook/read";
import { patchTemplate, vbaProjectSha256 } from "../../../../adapters/workbook/template-patch";
import { CURRENT_TEMPLATE_VERSION, templates } from "../../../../adapters/workbook/templates";
import { readVbaModuleSources } from "../../../../adapters/workbook/vba";
import { REJECTION_CODES, RejectionCode } from "../../../../core/submission/rejection-codes";
import { tokenSha256, tokenSha256Hex } from "../../../../adapters/workbook/token";
import { POST } from "./route";

// Each server-side row of the S3 I/O matrix, posted to the route handler with
// files made by `patchTemplate` from the committed current template.

const repoRoot = fileURLToPath(new URL("../../../../..", import.meta.url));
const VBA_PROJECT_PART = "xl/vbaProject.bin";
/** Excel-saved v1 (spike S3): a sheet added and the VBA editor opened before Save As. */
const S3_FIXTURE = "src/adapters/workbook/__fixtures__/s3-excel2021.xlsm";
const ENDPOINT = "https://example.test/api/submissions/macro";

let templateBytes: Uint8Array;
let templateModFinish: Uint8Array;

beforeAll(async () => {
  templateBytes = await readFile(path.join(repoRoot, templates[CURRENT_TEMPLATE_VERSION].file));
  const zip = await JSZip.loadAsync(templateBytes);
  const sources = readVbaModuleSources(await zip.file(VBA_PROJECT_PART)!.async("uint8array"));
  templateModFinish = sources!.get("modFinish")!;
});

const SERVICE = { service: true };
const ATTEMPT_ID = "0b9e0d6c-3f1a-4c2e-9d55-8a7b6c5d4e3f";

/** The attempt the lookup finds, by default `open` on the current template. */
function attemptFound(status = "open", templateVersion = CURRENT_TEMPLATE_VERSION) {
  mocks.findAttemptByTokenHash.mockResolvedValue({ ok: true, value: { id: ATTEMPT_ID, status, templateVersion } });
}

beforeEach(() => {
  mocks.createServiceClient.mockImplementation(() => SERVICE);
  attemptFound();
  mocks.markReceived.mockResolvedValue({ ok: true, value: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  mocks.createServiceClient.mockReset();
  mocks.findAttemptByTokenHash.mockReset();
  mocks.markReceived.mockReset();
});

const newToken = () => randomBytes(32).toString("base64url");

function patched(token: string): Promise<Uint8Array> {
  return patchTemplate(templateBytes, {
    properties: {
      WHE_AttemptToken: token,
      WHE_ServerUrl: "https://example.test",
      WHE_TemplateVersion: String(CURRENT_TEMPLATE_VERSION),
    },
    cells: { Instructions: { B2: "Judul" }, Data: { A1: "Lini", B1: "Unit", A2: "A", B2: 1200 } },
  });
}

async function editZip(bytes: Uint8Array, edit: (zip: JSZip) => Promise<void> | void): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(bytes);
  await edit(zip);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

const emptyDocumentModule = (name: string): ModuleSpec => ({
  name,
  source: `Attribute VB_Name = "${name}"\r\nAttribute VB_Base = "0{00020820-0000-0000-C000-000000000046}"\r\n`,
  document: true,
});

/** What Excel does when the user adds a sheet and opens the VBA editor: a new sheet part and a rewritten VBA project. */
async function withAddedSheet(bytes: Uint8Array): Promise<Uint8Array> {
  const bin = buildVbaProject({
    modules: [
      emptyDocumentModule("ThisWorkbook"),
      emptyDocumentModule("Sheet1"),
      emptyDocumentModule("Sheet2"),
      emptyDocumentModule("Sheet3"),
      { name: "modFinish", source: templateModFinish, pcodeFill: 0x5a },
    ],
  });
  return editZip(bytes, async (zip) => {
    zip.file(VBA_PROJECT_PART, bin);
    zip.file(
      "xl/worksheets/sheet3.xml",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' +
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
        '<row r="1"><c r="A1"><v>42</v></c></row></sheetData></worksheet>',
    );
    const workbook = await zip.file("xl/workbook.xml")!.async("string");
    zip.file("xl/workbook.xml", workbook.replace("</sheets>", '<sheet name="Sheet3" sheetId="3" r:id="rId99"/></sheets>'));
    const rels = await zip.file("xl/_rels/workbook.xml.rels")!.async("string");
    zip.file(
      "xl/_rels/workbook.xml.rels",
      rels.replace(
        "</Relationships>",
        '<Relationship Id="rId99" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/></Relationships>',
      ),
    );
    const types = await zip.file("[Content_Types].xml")!.async("string");
    zip.file(
      "[Content_Types].xml",
      types.replace(
        "</Types>",
        '<Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
      ),
    );
  });
}

interface Posted {
  status: number;
  body: unknown;
  /** The raw response text, which the Finish macro matches byte for byte. */
  text: string;
  logLines: string[];
}

async function post(body: Uint8Array, token?: string | null): Promise<Posted> {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const headers: Record<string, string> = { "content-type": "application/octet-stream" };
  if (token != null) headers["x-attempt-token"] = token;
  const response = await POST(new Request(ENDPOINT, { method: "POST", headers, body: Buffer.from(body) }));
  const logLines = log.mock.calls.map((args) => args.map(String).join(" "));
  log.mockRestore();
  const text = await response.text();
  return { status: response.status, body: JSON.parse(text), text, logLines };
}

/**
 * The Finish macro reads the answer with byte-exact substrings (`"ok":true`,
 * `"ok":false`, `"code":"`), so the raw text must be compact JSON in this key order.
 */
function expectRawText(posted: Posted, expected: object): void {
  expect(posted.text).toBe(JSON.stringify(expected));
  if ((expected as { ok: boolean }).ok) {
    expect(posted.text).toContain('"ok":true');
  } else {
    expect(posted.text).toContain('"ok":false');
    expect(posted.text).toContain(`"code":"${(expected as { code: string }).code}"`);
  }
}

/** The single JSON log line, checked against the Logging convention: none of `tokens` (file or header) appears in it. */
function logOf(posted: Posted, ...tokens: (string | null | undefined)[]): Record<string, unknown> {
  expect(posted.logLines).toHaveLength(1);
  const [line] = posted.logLines;
  expect(line).not.toContain("\n");
  for (const token of tokens) if (token) expect(line).not.toContain(token);
  const log = JSON.parse(line) as Record<string, unknown>;
  expect(log.channel).toBe("macro");
  expect(Object.keys(log).sort()).toEqual(["attemptId", "channel", "code", "received", "tokenSha256"]);
  return log;
}

describe("rejection codes (AD-6)", () => {
  it("are the five AD-6 codes", () => {
    expect([...REJECTION_CODES].sort()).toEqual(
      ["ALREADY_GRADED", "ATTEMPT_CLOSED", "IDENTITY_ALTERED", "NOT_EXCEL", "NOT_THIS_ATTEMPT"],
    );
  });
});

const ACCEPTED = { ok: true, data: { status: "received" } };

describe("POST /api/submissions/macro: Finish", () => {
  it("moves an open attempt found by the file's token hash to received, and logs attemptId and received: true", async () => {
    const token = newToken();
    const file = await patched(token);
    const posted = await post(file, token);

    expect(posted.status).toBe(200);
    expect(posted.body).toEqual(ACCEPTED);
    expectRawText(posted, ACCEPTED);
    expect(mocks.findAttemptByTokenHash).toHaveBeenCalledWith(SERVICE, tokenSha256Hex(token));
    expect(mocks.markReceived).toHaveBeenCalledWith(SERVICE, ATTEMPT_ID);
    expect(logOf(posted, token, tokenSha256Hex(token))).toEqual({
      attemptId: ATTEMPT_ID,
      channel: "macro",
      code: null,
      tokenSha256: tokenSha256(token),
      received: true,
    });
  });

  it.each(["received", "grading_failed", "graded", "abandoned", "closed"])(
    "answers 200 without a change for an attempt already %s",
    async (status) => {
      attemptFound(status);
      const token = newToken();
      const posted = await post(await patched(token), token);

      expect(posted.status).toBe(200);
      expectRawText(posted, { ok: true, data: { status } });
      expect(mocks.markReceived).not.toHaveBeenCalled();
      expect(logOf(posted, token)).toMatchObject({ attemptId: ATTEMPT_ID, code: null, received: false });
    },
  );

  it("answers the attempt's current status when the compare-and-set lost to another change", async () => {
    mocks.markReceived.mockResolvedValue({ ok: true, value: false });
    mocks.findAttemptByTokenHash
      .mockResolvedValueOnce({ ok: true, value: { id: ATTEMPT_ID, status: "open", templateVersion: CURRENT_TEMPLATE_VERSION } })
      .mockResolvedValueOnce({ ok: true, value: { id: ATTEMPT_ID, status: "abandoned", templateVersion: CURRENT_TEMPLATE_VERSION } });
    const token = newToken();
    const posted = await post(await patched(token), token);
    expect(posted.status).toBe(200);
    expectRawText(posted, { ok: true, data: { status: "abandoned" } });
    expect(mocks.findAttemptByTokenHash).toHaveBeenCalledTimes(2);
    expect(logOf(posted, token)).toMatchObject({ attemptId: ATTEMPT_ID, received: false });
  });

  it("answers 500 when the re-read after a lost compare-and-set fails", async () => {
    mocks.markReceived.mockResolvedValue({ ok: true, value: false });
    mocks.findAttemptByTokenHash
      .mockResolvedValueOnce({ ok: true, value: { id: ATTEMPT_ID, status: "open", templateVersion: CURRENT_TEMPLATE_VERSION } })
      .mockResolvedValueOnce({ ok: false });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const token = newToken();
    const posted = await post(await patched(token), token);
    expect(posted.status).toBe(500);
    expectRawText(posted, { ok: false, code: "INTERNAL_ERROR" });
  });

  it("still matches after a sheet is added and Excel rewrites the VBA project", async () => {
    const token = newToken();
    const original = await patched(token);
    const file = await withAddedSheet(original);
    expect(await vbaProjectSha256(file)).not.toBe(await vbaProjectSha256(original));

    const posted = await post(file, token);
    expect(posted.status).toBe(200);
    expect(posted.body).toEqual(ACCEPTED);
    expect(logOf(posted, token)).toMatchObject({ code: null, received: true });
  });

  it("accepts the Excel-saved S3 file (sheet added, VBA editor opened) when an attempt has its token", async () => {
    const file = Uint8Array.from(await readFile(path.join(repoRoot, S3_FIXTURE)));
    const token = (await readWorkbook(file)).properties.WHE_AttemptToken;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const posted = await post(file, token);
    expect(posted.status).toBe(200);
    expect(posted.body).toEqual(ACCEPTED);
    expect(logOf(posted, token)).toMatchObject({ code: null, tokenSha256: tokenSha256(token), received: true });
  });
});

describe("POST /api/submissions/macro: refusals", () => {
  it.each([
    ["an empty body", async () => new Uint8Array(0)],
    ["bytes that are not a zip", async () => Uint8Array.from(randomBytes(2048))],
    ["a zip without a workbook", async () => editZip(await patched(newToken()), (zip) => void zip.remove("xl/workbook.xml"))],
    [
      "a workbook the reader cannot read",
      async () =>
        editZip(await patched(newToken()), async (zip) => {
          const part = "xl/worksheets/sheet1.xml";
          zip.file(part, (await zip.file(part)!.async("string")).replace("<sheetData", "<sheetData><broken"));
        }),
    ],
  ])("refuses %s with NOT_EXCEL, before any lookup", async (_, make) => {
    const token = newToken();
    const posted = await post(await make(), token);
    expect(posted.status).toBe(400);
    expect(posted.body).toEqual({ ok: false, code: RejectionCode.NOT_EXCEL });
    expectRawText(posted, { ok: false, code: RejectionCode.NOT_EXCEL });
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
    expect(logOf(posted, token)).toEqual({
      attemptId: null,
      channel: "macro",
      code: "NOT_EXCEL",
      tokenSha256: null,
      received: false,
    });
  });

  it.each([
    ["no header", (token: string) => ({ file: token, header: null })],
    ["an empty header", (token: string) => ({ file: token, header: "" })],
    ["a header with another token", (token: string) => ({ file: token, header: newToken() })],
    ["a file without a token", () => ({ file: "", header: "" })],
    ["a malformed file token, even when the header repeats it", () => ({ file: "TEMPLATE", header: "TEMPLATE" })],
  ])("refuses %s with IDENTITY_ALTERED, before any lookup", async (_, tokens) => {
    const { file: fileToken, header } = tokens(newToken());
    const posted = await post(await patched(fileToken), header);
    expect(posted.status).toBe(400);
    expect(posted.body).toEqual({ ok: false, code: RejectionCode.IDENTITY_ALTERED });
    expectRawText(posted, { ok: false, code: RejectionCode.IDENTITY_ALTERED });
    expect(mocks.findAttemptByTokenHash).not.toHaveBeenCalled();
    const log = logOf(posted, fileToken, header);
    expect(log).toMatchObject({ attemptId: null, code: "IDENTITY_ALTERED", received: false });
    expect(log.tokenSha256).toBe(fileToken === "" ? null : tokenSha256(fileToken));
  });

  it("refuses a token no attempt has (an old file, spike S1/S3) with NOT_THIS_ATTEMPT", async () => {
    mocks.findAttemptByTokenHash.mockResolvedValue({ ok: true, value: null });
    const file = Uint8Array.from(await readFile(path.join(repoRoot, S3_FIXTURE)));
    const token = (await readWorkbook(file)).properties.WHE_AttemptToken;
    const posted = await post(file, token);

    expect(posted.status).toBe(400);
    expectRawText(posted, { ok: false, code: RejectionCode.NOT_THIS_ATTEMPT });
    expect(mocks.findAttemptByTokenHash).toHaveBeenCalledWith(SERVICE, tokenSha256Hex(token));
    expect(mocks.markReceived).not.toHaveBeenCalled();
    expect(logOf(posted, token)).toEqual({
      attemptId: null,
      channel: "macro",
      code: "NOT_THIS_ATTEMPT",
      tokenSha256: tokenSha256(token),
      received: false,
    });
  });

  it("refuses an edited modFinish with IDENTITY_ALTERED and leaves the attempt open", async () => {
    const token = newToken();
    const edited = new Uint8Array([...templateModFinish, ...Buffer.from("\r\n' edited\r\n", "latin1")]);
    const file = await editZip(await patched(token), (zip) => {
      zip.file(
        VBA_PROJECT_PART,
        buildVbaProject({ modules: [emptyDocumentModule("ThisWorkbook"), { name: "modFinish", source: edited }] }),
      );
    });
    const posted = await post(file, token);
    expect(posted.status).toBe(400);
    expectRawText(posted, { ok: false, code: RejectionCode.IDENTITY_ALTERED });
    expect(mocks.markReceived).not.toHaveBeenCalled();
    expect(logOf(posted, token)).toMatchObject({ attemptId: ATTEMPT_ID, code: "IDENTITY_ALTERED", received: false });
  });

  it("refuses a workbook without a VBA project with IDENTITY_ALTERED", async () => {
    const token = newToken();
    const file = await editZip(await patched(token), (zip) => void zip.remove(VBA_PROJECT_PART));
    const posted = await post(file, token);
    expect(posted.status).toBe(400);
    expect(posted.body).toEqual({ ok: false, code: RejectionCode.IDENTITY_ALTERED });
    expect(mocks.markReceived).not.toHaveBeenCalled();
    expect(logOf(posted, token)).toMatchObject({ attemptId: ATTEMPT_ID, code: "IDENTITY_ALTERED" });
  });
});

describe("POST /api/submissions/macro: server faults", () => {
  it.each([
    ["the secret key is not set", () => mocks.createServiceClient.mockImplementation(() => null)],
    [
      "the client cannot be created",
      () =>
        mocks.createServiceClient.mockImplementation(() => {
          throw new Error("Invalid supabaseUrl");
        }),
    ],
    ["the lookup fails", () => mocks.findAttemptByTokenHash.mockResolvedValue({ ok: false })],
    ["the attempt's template version is not in the registry", () => attemptFound("open", 999)],
    ["the status change fails", () => mocks.markReceived.mockResolvedValue({ ok: false })],
  ])("answers 500 INTERNAL_ERROR when %s, and logs it without the token", async (_, arrange) => {
    arrange();
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const token = newToken();
    const posted = await post(await patched(token), token);

    expect(posted.status).toBe(500);
    expectRawText(posted, { ok: false, code: "INTERNAL_ERROR" });
    expect(logOf(posted, token)).toMatchObject({ code: "INTERNAL_ERROR", received: false });
    expect(errors).toHaveBeenCalledTimes(1);
    for (const [line] of errors.mock.calls) {
      expect(String(line)).not.toContain(token);
      expect(String(line)).not.toContain(tokenSha256Hex(token));
    }
  });
});
