import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { buildVbaProject, type ModuleSpec } from "../../../../adapters/workbook/__fixtures__/vba-project";
import { readWorkbook } from "../../../../adapters/workbook/read";
import { patchTemplate, vbaProjectSha256 } from "../../../../adapters/workbook/template-patch";
import { CURRENT_TEMPLATE_VERSION, templates } from "../../../../adapters/workbook/templates";
import { readVbaModuleSources } from "../../../../adapters/workbook/vba";
import { REJECTION_CODES, RejectionCode } from "../../../../core/submission/rejection-codes";
import { tokenSha256 } from "./inspect";
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

afterEach(() => {
  vi.restoreAllMocks();
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
  expect(log.templateVersion).toBe(CURRENT_TEMPLATE_VERSION);
  return log;
}

describe("rejection codes (AD-6)", () => {
  it("are the five AD-6 codes", () => {
    expect([...REJECTION_CODES].sort()).toEqual(
      ["ALREADY_GRADED", "ATTEMPT_CLOSED", "IDENTITY_ALTERED", "NOT_EXCEL", "NOT_THIS_ATTEMPT"],
    );
  });
});

describe("POST /api/submissions/macro (spike S3)", () => {
  it("accepts a patched workbook whose header equals its token, and logs size, token hash and both matches", async () => {
    const token = newToken();
    const file = await patched(token);
    const posted = await post(file, token);

    expect(posted.status).toBe(200);
    const expected = { ok: true, data: { bytes: file.byteLength, tokenMatches: true, fingerprintMatches: true } };
    expect(posted.body).toEqual(expected);
    expectRawText(posted, expected);
    expect(logOf(posted, token)).toEqual({
      channel: "macro",
      code: null,
      bytes: file.byteLength,
      tokenSha256: tokenSha256(token),
      tokenMatches: true,
      fingerprintMatches: true,
      templateVersion: CURRENT_TEMPLATE_VERSION,
    });
  });

  it("logs the first 12 hex of the token's SHA-256", () => {
    expect(tokenSha256("abc")).toBe("ba7816bf8f01");
  });

  it("still matches after a sheet is added and Excel rewrites the VBA project", async () => {
    const token = newToken();
    const original = await patched(token);
    const file = await withAddedSheet(original);
    expect(await vbaProjectSha256(file)).not.toBe(await vbaProjectSha256(original));

    const posted = await post(file, token);
    expect(posted.status).toBe(200);
    expect(posted.body).toEqual({
      ok: true,
      data: { bytes: file.byteLength, tokenMatches: true, fingerprintMatches: true },
    });
    expect(logOf(posted, token)).toMatchObject({ code: null, fingerprintMatches: true });
  });

  it("accepts the Excel-saved S3 file (sheet added, VBA editor opened) posted with its own token", async () => {
    const file = Uint8Array.from(await readFile(path.join(repoRoot, S3_FIXTURE)));
    const token = (await readWorkbook(file)).properties.WHE_AttemptToken;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const posted = await post(file, token);
    expect(posted.status).toBe(200);
    expect(posted.body).toEqual({
      ok: true,
      data: { bytes: file.byteLength, tokenMatches: true, fingerprintMatches: true },
    });
    expect(logOf(posted, token)).toMatchObject({ code: null, tokenSha256: tokenSha256(token), fingerprintMatches: true });
  });

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
  ])("refuses %s with NOT_EXCEL", async (_, make) => {
    const token = newToken();
    const posted = await post(await make(), token);
    expect(posted.status).toBe(400);
    expect(posted.body).toEqual({ ok: false, code: RejectionCode.NOT_EXCEL });
    expectRawText(posted, { ok: false, code: RejectionCode.NOT_EXCEL });
    expect(logOf(posted, token)).toMatchObject({ code: "NOT_EXCEL", tokenSha256: null, tokenMatches: false });
  });

  it.each([
    ["no header", (token: string) => ({ file: token, header: null })],
    ["an empty header", (token: string) => ({ file: token, header: "" })],
    ["a header with another token", (token: string) => ({ file: token, header: newToken() })],
    ["a file without a token", () => ({ file: "", header: "" })],
    ["a malformed file token, even when the header repeats it", () => ({ file: "TEMPLATE", header: "TEMPLATE" })],
  ])("refuses %s with IDENTITY_ALTERED", async (_, tokens) => {
    const { file: fileToken, header } = tokens(newToken());
    const posted = await post(await patched(fileToken), header);
    expect(posted.status).toBe(400);
    expect(posted.body).toEqual({ ok: false, code: RejectionCode.IDENTITY_ALTERED });
    expectRawText(posted, { ok: false, code: RejectionCode.IDENTITY_ALTERED });
    const log = logOf(posted, fileToken, header);
    expect(log).toMatchObject({ code: "IDENTITY_ALTERED", tokenMatches: false, fingerprintMatches: true });
    expect(log.tokenSha256).toBe(fileToken === "" ? null : tokenSha256(fileToken));
  });

  it("refuses an edited modFinish with IDENTITY_ALTERED", async () => {
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
    expect(posted.body).toEqual({ ok: false, code: RejectionCode.IDENTITY_ALTERED });
    expect(logOf(posted, token)).toMatchObject({ code: "IDENTITY_ALTERED", tokenMatches: true, fingerprintMatches: false });
  });

  it("refuses a workbook without a VBA project with IDENTITY_ALTERED", async () => {
    const token = newToken();
    const file = await editZip(await patched(token), (zip) => void zip.remove(VBA_PROJECT_PART));
    const posted = await post(file, token);
    expect(posted.status).toBe(400);
    expect(posted.body).toEqual({ ok: false, code: RejectionCode.IDENTITY_ALTERED });
    expect(logOf(posted, token)).toMatchObject({ tokenMatches: true, fingerprintMatches: false });
  });
});
