import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createServiceClient: vi.fn(), rpc: vi.fn() }));
vi.mock("../../../../adapters/supabase/service", () => ({ createServiceClient: mocks.createServiceClient }));

import { buildVbaProject, type ModuleSpec } from "../../../../adapters/workbook/__fixtures__/vba-project";
import { readWorkbook } from "../../../../adapters/workbook/read";
import { patchTemplate, readSheetParts, vbaProjectSha256 } from "../../../../adapters/workbook/template-patch";
import { CURRENT_TEMPLATE_VERSION, templates } from "../../../../adapters/workbook/templates";
import { readVbaModuleSources } from "../../../../adapters/workbook/vba";
import { REJECTION_CODES, RejectionCode } from "../../../../core/submission/rejection-codes";
import { tokenSha256, tokenSha256Hex } from "./inspect";
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

beforeEach(() => {
  // The service-role client (bridge proof): by default a row with the file's hash exists.
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.createServiceClient.mockImplementation(() => ({ rpc: mocks.rpc }));
});

afterEach(() => {
  vi.restoreAllMocks();
  mocks.rpc.mockReset();
  mocks.createServiceClient.mockReset();
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
      proofRecorded: true,
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

// Bridge proof (story 1.9): what the server read is recorded on the proof row
// with the file token's hash; the macro's answer never changes.

const SUMIFS = 'SUMIFS(E2:E11,B2:B11,"Lini A",C2:C11,"Pagi")';

/** What Excel writes after the user types the SUMIFS into `Data!I2` (formula plus cached value). */
async function withSumifsInI2(bytes: Uint8Array): Promise<Uint8Array> {
  return editZip(bytes, async (zip) => {
    const part = (await readSheetParts(zip)).get("Data")!;
    const xml = await zip.file(part)!.async("string");
    const edited = xml.replace(
      /(<row r="2"[^>]*>[\s\S]*?)(<\/row>)/,
      `$1<c r="I2"><f>${SUMIFS.replaceAll('"', "&quot;")}</f><v>2070</v></c>$2`,
    );
    expect(edited).not.toBe(xml);
    zip.file(part, edited);
  });
}

interface RpcArgs {
  p_token_sha256: string;
  p_bytes: number;
  p_token_matches: boolean;
  p_fingerprint_matches: boolean;
  p_formulas: { sheet: string; ref: string; formula: string }[];
}

function rpcArgs(call = 0): RpcArgs {
  const [name, args] = mocks.rpc.mock.calls[call];
  expect(name).toBe("record_bridge_proof_receipt");
  return args as RpcArgs;
}

describe("POST /api/submissions/macro (bridge proof)", () => {
  it("records a Finish of a downloaded file: hash, size, both matches and the SUMIFS in Data!I2", async () => {
    const token = newToken();
    const file = await withSumifsInI2(await patched(token));
    const posted = await post(file, token);

    expect(posted.status).toBe(200);
    expectRawText(posted, { ok: true, data: { bytes: file.byteLength, tokenMatches: true, fingerprintMatches: true } });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(rpcArgs()).toEqual({
      p_token_sha256: tokenSha256Hex(token),
      p_bytes: file.byteLength,
      p_token_matches: true,
      p_fingerprint_matches: true,
      p_formulas: [{ sheet: "Data", ref: "I2", formula: SUMIFS }],
    });
    const log = logOf(posted, token, tokenSha256Hex(token));
    expect(log).toMatchObject({ code: null, tokenSha256: tokenSha256(token), proofRecorded: true });
  });

  it("records each Finish of the same file (the database adds one to receive_count)", async () => {
    const token = newToken();
    const file = await withSumifsInI2(await patched(token));
    const first = await post(file, token);
    const second = await post(file, token);

    expect(second.text).toBe(first.text);
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(rpcArgs(1)).toEqual(rpcArgs(0));
    expect(logOf(second, token)).toMatchObject({ proofRecorded: true });
  });

  it("answers as S3 for a token no download issued, and logs proofRecorded: false", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    const file = Uint8Array.from(await readFile(path.join(repoRoot, S3_FIXTURE)));
    const token = (await readWorkbook(file)).properties.WHE_AttemptToken;
    const posted = await post(file, token);

    expect(posted.status).toBe(200);
    expectRawText(posted, { ok: true, data: { bytes: file.byteLength, tokenMatches: true, fingerprintMatches: true } });
    expect(rpcArgs().p_token_sha256).toBe(tokenSha256Hex(token));
    expect(logOf(posted, token)).toMatchObject({ code: null, proofRecorded: false });
  });

  it("still records a header that is not the file's token, with tokenMatches false", async () => {
    const token = newToken();
    const header = newToken();
    const posted = await post(await patched(token), header);

    expectRawText(posted, { ok: false, code: RejectionCode.IDENTITY_ALTERED });
    expect(rpcArgs()).toMatchObject({
      p_token_sha256: tokenSha256Hex(token),
      p_token_matches: false,
      p_fingerprint_matches: true,
    });
    expect(logOf(posted, token, header)).toMatchObject({ code: "IDENTITY_ALTERED", proofRecorded: true });
  });

  it("still records an edited modFinish, with fingerprintMatches false", async () => {
    const token = newToken();
    const edited = new Uint8Array([...templateModFinish, ...Buffer.from("\r\n' edited\r\n", "latin1")]);
    const file = await editZip(await patched(token), (zip) => {
      zip.file(
        VBA_PROJECT_PART,
        buildVbaProject({ modules: [emptyDocumentModule("ThisWorkbook"), { name: "modFinish", source: edited }] }),
      );
    });
    const posted = await post(file, token);

    expectRawText(posted, { ok: false, code: RejectionCode.IDENTITY_ALTERED });
    expect(rpcArgs()).toMatchObject({ p_token_matches: true, p_fingerprint_matches: false });
    expect(logOf(posted, token)).toMatchObject({ proofRecorded: true });
  });

  it.each([
    ["a file without a token", async () => patched(""), ""],
    ["a malformed file token", async () => patched("TEMPLATE"), "TEMPLATE"],
    ["bytes that are not a workbook", async () => Uint8Array.from(randomBytes(2048)), newToken()],
  ])("records nothing for %s", async (_, make, header) => {
    const posted = await post(await make(), header);
    expect(posted.status).toBe(400);
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(logOf(posted)).toMatchObject({ proofRecorded: false });
  });

  it.each([
    ["the database answers with an error", () => mocks.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "x" } })],
    ["the call to the database throws", () => mocks.rpc.mockRejectedValue(new TypeError("fetch failed"))],
    ["the secret key is not set", () => mocks.createServiceClient.mockImplementation(() => null)],
    [
      "the client cannot be created",
      () =>
        mocks.createServiceClient.mockImplementation(() => {
          throw new Error("Invalid supabaseUrl");
        }),
    ],
  ])("answers from the inspection alone when %s", async (_, arrange) => {
    arrange();
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const token = newToken();
    const file = await withSumifsInI2(await patched(token));
    const posted = await post(file, token);

    expect(posted.status).toBe(200);
    expectRawText(posted, { ok: true, data: { bytes: file.byteLength, tokenMatches: true, fingerprintMatches: true } });
    expect(logOf(posted, token)).toMatchObject({ code: null, proofRecorded: false });
    expect(errors).toHaveBeenCalled();
    for (const [line] of errors.mock.calls) {
      expect(String(line)).not.toContain(token);
      expect(String(line)).not.toContain(tokenSha256Hex(token));
    }
  });

  it("sends at most 20 formula cells", async () => {
    const token = newToken();
    const file = await editZip(await patched(token), async (zip) => {
      const part = (await readSheetParts(zip)).get("Data")!;
      const xml = await zip.file(part)!.async("string");
      const rows = Array.from({ length: 25 }, (_, i) => `<row r="${i + 20}"><c r="I${i + 20}"><f>SUM(B2)</f><v>1</v></c></row>`);
      zip.file(part, xml.replace("</sheetData>", `${rows.join("")}</sheetData>`));
    });
    const posted = await post(file, token);

    expect(posted.status).toBe(200);
    const formulas = rpcArgs().p_formulas;
    expect(formulas).toHaveLength(20);
    expect(formulas[0]).toEqual({ sheet: "Data", ref: "I20", formula: "SUM(B2)" });
  });
});
