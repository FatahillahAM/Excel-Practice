import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { inspectWorkbook, workbookPort } from "./submission";
import { patchTemplate } from "./template-patch";
import { CURRENT_TEMPLATE_VERSION, templates } from "./templates";
import { tokenSha256Hex } from "./token";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const TOKEN = "A".repeat(43);
const XLSM_MAIN = "application/vnd.ms-excel.sheet.macroEnabled.main+xml";
const XLSX_MAIN = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml";

let file: Uint8Array;

beforeAll(async () => {
  const template = await readFile(path.join(repoRoot, templates[CURRENT_TEMPLATE_VERSION].file));
  file = await patchTemplate(template, {
    properties: {
      WHE_AttemptToken: TOKEN,
      WHE_ServerUrl: "https://example.test",
      WHE_TemplateVersion: String(CURRENT_TEMPLATE_VERSION),
    },
    cells: {},
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function edit(bytes: Uint8Array, change: (zip: JSZip) => Promise<void> | void): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(bytes);
  await change(zip);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

describe("workbook port for submit()", () => {
  it("inspects a generated .xlsm: its token and a fingerprint that matches its template", async () => {
    const inspection = await inspectWorkbook(file);
    expect(inspection).toMatchObject({ kind: "xlsm", token: TOKEN });
    if (inspection.kind !== "xlsm") throw new Error("unreachable");
    expect(workbookPort.fingerprintMatches(inspection.vba, CURRENT_TEMPLATE_VERSION)).toBe(true);
  });

  it("gives token null when the workbook has no WHE_AttemptToken", async () => {
    const bytes = await edit(file, (zip) => void zip.remove("docProps/custom.xml"));
    expect(await inspectWorkbook(bytes)).toMatchObject({ kind: "xlsm", token: null });
  });

  it("reports a spreadsheet that is not macro-enabled (.xlsx) as not_xlsm", async () => {
    const bytes = await edit(file, async (zip) => {
      const types = await zip.file("[Content_Types].xml")!.async("string");
      zip.file("[Content_Types].xml", types.replace(XLSM_MAIN, XLSX_MAIN));
    });
    expect(await inspectWorkbook(bytes)).toEqual({ kind: "not_xlsm" });
  });

  it("reports bytes that are not a workbook as not_excel, without logging", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await inspectWorkbook(new TextEncoder().encode("a,b\n1,2\n"))).toEqual({ kind: "not_excel" });
    const broken = await edit(file, (zip) => void zip.file("xl/workbook.xml", "<workbook"));
    expect(await inspectWorkbook(broken)).toEqual({ kind: "not_excel" });
    expect(errors).not.toHaveBeenCalled();
  });

  it("logs one line (event and error name, no token) for another reader error, and still answers not_excel", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    // A shared formula child without its master: a plain Error from the reader, not NotAWorkbookError.
    const bytes = await edit(file, async (zip) => {
      const part = "xl/worksheets/sheet2.xml";
      const xml = await zip.file(part)!.async("string");
      const orphan = '<row r="3"><c r="H3"><f t="shared" si="7"/><v>1</v></c></row>';
      expect(xml).toContain("<sheetData/>");
      zip.file(part, xml.replace("<sheetData/>", `<sheetData>${orphan}</sheetData>`));
    });
    expect(await inspectWorkbook(bytes)).toEqual({ kind: "not_excel" });
    expect(errors).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(errors.mock.calls[0][0]))).toEqual({ event: "workbook.inspect_failed", code: "Error" });
    expect(String(errors.mock.calls[0][0])).not.toContain(TOKEN);
  });

  it("hashes a token to the full SHA-256 hex the attempts table keys on", () => {
    expect(workbookPort.hashToken(TOKEN)).toBe(tokenSha256Hex(TOKEN));
    expect(workbookPort.hashToken(TOKEN)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("throws for a template version that is not in the registry", () => {
    expect(() => workbookPort.fingerprintMatches({}, 999)).toThrow(/not in the registry/);
  });
});
