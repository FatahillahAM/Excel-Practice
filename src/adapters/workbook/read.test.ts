import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { cellMismatch, S2_FIXTURE, S2_MODFINISH_SHA256, s2Expected } from "./__fixtures__/s2-expected";
import { NotAWorkbookError, readWorkbook } from "./read";
import { readSheetParts } from "./template-patch";
import { templates } from "./templates";
import { EMPTY_MODULE_SHA256 } from "./vba";

// A synthetic .xlsm shaped like an Excel 2021 save: shared strings, shared and
// dynamic-array formulas, and a stale <dimension>/spans as S1 found in files
// that were generated but not yet saved by Excel. Data lives in sheet2.xml so
// the lookup has to go through workbook.xml.rels.

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';
const MAIN_NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';

const WORKBOOK_XML =
  `${XML_HEAD}<workbook ${MAIN_NS} xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
  '<sheets><sheet name="Instructions" sheetId="1" r:id="rId1"/><sheet name="Data" sheetId="2" r:id="rId2"/></sheets>' +
  "</workbook>";

const WORKBOOK_RELS_XML =
  `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  '<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>' +
  '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
  "</Relationships>";

const SHARED_STRINGS_XML =
  `${XML_HEAD}<sst ${MAIN_NS} count="5" uniqueCount="5">` +
  "<si><t>Kode Batch</t></si>" +
  '<si><r><rPr><b/></rPr><t>Lini</t></r><r><t xml:space="preserve"> A</t></r><rPh sb="0" eb="4"><t>リニ</t></rPh></si>' +
  '<si><t xml:space="preserve">PT Maju &amp; Jaya\nbatch &lt; 2%&#10;"baik"</t></si>' +
  "<si><t>Lini B</t></si>" +
  "<si><t>Baris_x000D_baru _x005F_x0041_</t></si>" +
  "</sst>";

const CUSTOM_XML =
  `${XML_HEAD}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">` +
  '<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="WHE_AttemptToken"><vt:lpwstr>tok_abc-123</vt:lpwstr></property>' +
  '<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="3" name="WHE_ServerUrl"><vt:lpwstr>https://example.test/?a=1&amp;b=2</vt:lpwstr></property>' +
  '<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="4" name="WHE_TemplateVersion"><vt:lpwstr>1</vt:lpwstr></property>' +
  '<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="5" name="Angka"><vt:i4>42</vt:i4></property>' +
  "</Properties>";

function sheetXml(rows: string): string {
  return (
    `${XML_HEAD}<worksheet ${MAIN_NS} xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac">` +
    '<dimension ref="A1"/><sheetViews><sheetView workbookViewId="0"/></sheetViews>' +
    `<sheetData>${rows}</sheetData>` +
    '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>'
  );
}

const INSTRUCTIONS_ROWS =
  '<row r="2" spans="2:2" x14ac:dyDescent="0.25"><c r="B2" s="1" t="inlineStr"><is><t xml:space="preserve">Judul</t></is></c></row>' +
  '<row r="4" spans="2:2"><c r="B4" s="2"/></row>' +
  '<row r="6" spans="2:2"><c r="C6"><f>SUMIFS(Data!E2:E11,Data!B2:B11,"Lini A")</f><v>4125</v></c></row>' +
  '<row r="9" spans="2:2"><c r="C9"><f>SUM(Data!F2:F11)/SUM(Data!E2:E11)</f><v>2.2998872604284102E-2</v></c></row>' +
  '<row r="10" spans="2:2"><c r="C10"><v>226</v></c></row>';

const DATA_ROWS =
  '<row r="1" spans="1:1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>2</v></c><c r="C1" t="s"><v>4</v></c></row>' +
  '<row r="2" spans="1:1">' +
  '<c r="B2" t="s"><v>1</v></c>' +
  '<c r="H2"><f t="shared" ref="H2:H4" si="0">F2/E2</f><v>1.4999999999999999E-2</v></c>' +
  '<c r="I2" t="str"><f>IF(H2&gt;3%,"Periksa","OK")</f><v>OK</v></c>' +
  '<c r="J2"><f t="shared" ref="J2:J3" si="1">E2/SUM($E$2:$E$11)</f><v>9.0191657271702363E-2</v></c>' +
  '<c r="L2"><f>_xlfn.XLOOKUP("B-2610-05",A2:A11,F2:F11)</f><v>35</v></c>' +
  '<c r="M2"><f t="shared" ref="M2:N3" si="2">A2+$B$1+B$1</f><v>1</v></c>' +
  '<c r="N2"><f t="shared" si="2"/><v>2</v></c>' +
  '<c r="P2" t="b"><v>1</v></c>' +
  "</row>" +
  '<row r="3" spans="1:1">' +
  '<c r="B3" t="s"><v>3</v></c>' +
  '<c r="H3"><f t="shared" si="0"/><v>3.5652173913043476E-2</v></c>' +
  '<c r="J3"><f t="shared" si="1"/><v>8.6433670048853808E-2</v></c>' +
  '<c r="M3"><f t="shared" si="2"/><v>3</v></c>' +
  '<c r="N3"><f t="shared" si="2"/><v>4</v></c>' +
  '<c r="P3" t="b"><f>1&gt;2</f><v>0</v></c>' +
  "</row>" +
  '<row r="4" spans="1:1">' +
  '<c r="H4"><f t="shared" si="0"/><v>9.1836734693877559E-3</v></c>' +
  '<c r="L4" t="str"><f>_xlfn.IFS(L2&gt;30,"besar",TRUE,"kecil")</f><v>besar</v></c>' +
  '<c r="P4" t="e"><f>NA()</f><v>#N/A</v></c>' +
  "</row>" +
  '<row r="5"><c r="P5" t="e"><v>#DIV/0!</v></c></row>' +
  '<row r="6"><c r="L6" cm="1" t="str"><f t="array" ref="L6:L8">_xlfn.UNIQUE(B2:B11)</f><v>Lini A</v></c></row>' +
  '<row r="7"><c r="L7" t="str"><v>Lini B</v></c></row>' +
  '<row r="8"><c r="L8" t="str"><v>Lini C</v></c></row>';

/** Bytes that are not an MS-CFB container: a VBA project that cannot be read. */
const VBA_PROJECT = Uint8Array.from({ length: 4096 }, (_, i) => (i * 37 + 11) % 256);

async function makeWorkbook(overrides: Record<string, string | Uint8Array | null> = {}): Promise<Uint8Array> {
  const parts: Record<string, string | Uint8Array | null> = {
    "[Content_Types].xml": `${XML_HEAD}<Types/>`,
    "_rels/.rels": "<Relationships/>",
    "docProps/custom.xml": CUSTOM_XML,
    "xl/workbook.xml": WORKBOOK_XML,
    "xl/_rels/workbook.xml.rels": WORKBOOK_RELS_XML,
    "xl/worksheets/sheet1.xml": sheetXml(INSTRUCTIONS_ROWS),
    "xl/worksheets/sheet2.xml": sheetXml(DATA_ROWS),
    "xl/sharedStrings.xml": SHARED_STRINGS_XML,
    "xl/vbaProject.bin": VBA_PROJECT,
    ...overrides,
  };
  const zip = new JSZip();
  for (const [name, content] of Object.entries(parts)) {
    if (content !== null) zip.file(name, content, { createFolders: false });
  }
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

describe("readWorkbook", () => {
  it("expands shared formulas: the master is shifted to each child, $ parts stay", async () => {
    const { sheets } = await readWorkbook(await makeWorkbook());
    const data = sheets.Data;
    expect(data.H2).toEqual({ formula: "F2/E2", value: 0.015, type: "number" });
    expect(data.H3).toEqual({ formula: "F3/E3", value: 41 / 1150, type: "number" });
    expect(data.H4).toEqual({ formula: "F4/E4", value: 9 / 980, type: "number" });
    expect(data.J3.formula).toBe("E3/SUM($E$2:$E$11)");
    expect([data.M2, data.N2, data.M3, data.N3].map((cell) => cell.formula)).toEqual([
      "A2+$B$1+B$1",
      "B2+$B$1+C$1",
      "A3+$B$1+B$1",
      "B3+$B$1+C$1",
    ]);
  });

  it("drops _xlfn. prefixes from Excel 2010+ functions", async () => {
    const { sheets } = await readWorkbook(await makeWorkbook());
    expect(sheets.Data.L2).toEqual({ formula: 'XLOOKUP("B-2610-05",A2:A11,F2:F11)', value: 35, type: "number" });
    expect(sheets.Data.L4).toEqual({ formula: 'IFS(L2>30,"besar",TRUE,"kecil")', value: "besar", type: "string" });
  });

  it("reads a typed number as a value without formula", async () => {
    const { sheets } = await readWorkbook(await makeWorkbook());
    expect(sheets.Instructions.C10).toEqual({ formula: null, value: 226, type: "number" });
    expect(sheets.Instructions.C9).toEqual({
      formula: "SUM(DATA!F2:F11)/SUM(DATA!E2:E11)",
      value: 0.022998872604284102,
      type: "number",
    });
  });

  it("reads a formula string result (t=str) as a string", async () => {
    const { sheets } = await readWorkbook(await makeWorkbook());
    expect(sheets.Data.I2).toEqual({ formula: 'IF(H2>3%,"Periksa","OK")', value: "OK", type: "string" });
  });

  it("decodes _xHHHH_ in a formula string result", async () => {
    const bytes = await makeWorkbook({
      "xl/worksheets/sheet1.xml": sheetXml('<row r="1"><c r="A1" t="str"><f>"a"&amp;CHAR(13)</f><v>a_x000D_</v></c></row>'),
    });
    const { sheets } = await readWorkbook(bytes);
    expect(sheets.Instructions.A1).toEqual({ formula: '"a"&CHAR(13)', value: "a\r", type: "string" });
  });

  it("decodes entities exactly once, in shared and inline strings", async () => {
    const bytes = await makeWorkbook({
      "xl/sharedStrings.xml": `${XML_HEAD}<sst ${MAIN_NS}><si><t>R&amp;amp;D &amp;lt;5</t></si></sst>`,
      "xl/worksheets/sheet1.xml": sheetXml(
        '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="inlineStr"><is><t>R&amp;amp;D &amp;lt;5</t></is></c></row>',
      ),
      "xl/worksheets/sheet2.xml": sheetXml(""),
    });
    const { sheets } = await readWorkbook(bytes);
    expect(sheets.Instructions.A1.value).toBe("R&amp;D &lt;5");
    expect(sheets.Instructions.B1.value).toBe("R&amp;D &lt;5");
  });

  it("does not expand DOCTYPE entities", async () => {
    const bytes = await makeWorkbook({
      "xl/sharedStrings.xml": `${XML_HEAD}<!DOCTYPE sst [<!ENTITY x "boom">]><sst ${MAIN_NS}><si><t>&x;</t></si></sst>`,
      "xl/worksheets/sheet1.xml": sheetXml('<row r="1"><c r="A1" t="s"><v>0</v></c></row>'),
      "xl/worksheets/sheet2.xml": sheetXml(""),
    });
    const { sheets } = await readWorkbook(bytes);
    expect(sheets.Instructions.A1.value).toBe("&x;");
  });

  it("reads shared strings, joining rich text runs and decoding entities and _xHHHH_", async () => {
    const { sheets } = await readWorkbook(await makeWorkbook());
    expect(sheets.Data.A1).toEqual({ formula: null, value: "Kode Batch", type: "string" });
    expect(sheets.Data.B2).toEqual({ formula: null, value: "Lini A", type: "string" });
    expect(sheets.Data.B1.value).toBe('PT Maju & Jaya\nbatch < 2%\n"baik"');
    expect(sheets.Data.C1.value).toBe("Baris\rbaru _x0041_");
  });

  it("reads inline strings, as written by the template patcher", async () => {
    const { sheets } = await readWorkbook(await makeWorkbook());
    expect(sheets.Instructions.B2).toEqual({ formula: null, value: "Judul", type: "string" });
  });

  it("reads booleans and error codes", async () => {
    const { sheets } = await readWorkbook(await makeWorkbook());
    expect(sheets.Data.P2).toEqual({ formula: null, value: true, type: "boolean" });
    expect(sheets.Data.P3).toEqual({ formula: "1>2", value: false, type: "boolean" });
    expect(sheets.Data.P4).toEqual({ formula: "NA()", value: "#N/A", type: "error" });
    expect(sheets.Data.P5).toEqual({ formula: null, value: "#DIV/0!", type: "error" });
  });

  it("gives a spilled array its formula only at the anchor", async () => {
    const { sheets } = await readWorkbook(await makeWorkbook());
    expect(sheets.Data.L6).toEqual({ formula: "UNIQUE(B2:B11)", value: "Lini A", type: "string" });
    expect(sheets.Data.L7).toEqual({ formula: null, value: "Lini B", type: "string" });
    expect(sheets.Data.L8).toEqual({ formula: null, value: "Lini C", type: "string" });
  });

  it("ignores stale <dimension> and spans, and skips cells with only a style", async () => {
    const { sheets } = await readWorkbook(await makeWorkbook());
    expect(Object.keys(sheets)).toEqual(["Instructions", "Data"]);
    expect(Object.keys(sheets.Instructions)).toEqual(["B2", "C6", "C9", "C10"]);
    expect(Object.keys(sheets.Data)).toHaveLength(24);
  });

  it("positions cells and rows without an r attribute after the previous one", async () => {
    const bytes = await makeWorkbook({
      "xl/worksheets/sheet1.xml": sheetXml(
        '<row r="3"><c r="B3"><v>1</v></c><c><v>2</v></c></row><row><c><v>3</v></c><c r="D4"><v>4</v></c></row>',
      ),
    });
    const { sheets } = await readWorkbook(bytes);
    expect(Object.fromEntries(Object.entries(sheets.Instructions).map(([ref, cell]) => [ref, cell.value]))).toEqual({
      B3: 1,
      C3: 2,
      A4: 3,
      D4: 4,
    });
  });

  it("reads a formula Excel has not calculated as having no value", async () => {
    const bytes = await makeWorkbook({
      "xl/worksheets/sheet1.xml": sheetXml('<row r="1"><c r="A1"><f>SUM( b1:b3 )</f></c></row>'),
    });
    const { sheets } = await readWorkbook(bytes);
    expect(sheets.Instructions.A1).toEqual({ formula: "SUM(B1:B3)", value: null, type: "empty" });
  });

  it("returns custom properties and the VBA fingerprint per module", async () => {
    const template = await JSZip.loadAsync(await readFile(path.join(repoRoot, templates[1].file)));
    const vbaProject = await template.file("xl/vbaProject.bin")!.async("uint8array");
    const reading = await readWorkbook(await makeWorkbook({ "xl/vbaProject.bin": vbaProject }));
    expect(reading.properties).toEqual({
      WHE_AttemptToken: "tok_abc-123",
      WHE_ServerUrl: "https://example.test/?a=1&b=2",
      WHE_TemplateVersion: "1",
      Angka: "42",
    });
    expect(reading.vbaModuleHashes).toEqual({
      ThisWorkbook: EMPTY_MODULE_SHA256,
      Sheet1: EMPTY_MODULE_SHA256,
      Sheet2: EMPTY_MODULE_SHA256,
      modFinish: templates[1].vbaModules.modFinish,
    });
  });

  it("reads a workbook whose vbaProject.bin entry does not inflate, with no fingerprint", async () => {
    // A real VBA project, so only the failed inflate can make the fingerprint null.
    const template = await JSZip.loadAsync(await readFile(path.join(repoRoot, templates[1].file)));
    const vbaProject = await template.file("xl/vbaProject.bin")!.async("uint8array");
    const raw = await makeWorkbook({ "xl/vbaProject.bin": vbaProject });
    expect((await readWorkbook(raw)).vbaModuleHashes).not.toBeNull();
    // Overwrite the deflated data of xl/vbaProject.bin (after its local header) with bytes that are not deflate.
    const name = new TextEncoder().encode("xl/vbaProject.bin");
    let header = -1;
    for (let i = 0; i + 30 + name.length <= raw.length && header < 0; i++) {
      if (raw[i] === 0x50 && raw[i + 1] === 0x4b && raw[i + 2] === 0x03 && raw[i + 3] === 0x04) {
        const nameLength = raw[i + 26] | (raw[i + 27] << 8);
        if (nameLength === name.length && name.every((b, k) => raw[i + 30 + k] === b)) header = i;
      }
    }
    expect(header).toBeGreaterThanOrEqual(0);
    const extraLength = raw[header + 28] | (raw[header + 29] << 8);
    const dataStart = header + 30 + name.length + extraLength;
    raw.fill(0xff, dataStart, dataStart + 64);

    const reading = await readWorkbook(raw);
    expect(reading.vbaModuleHashes).toBeNull();
    expect(reading.sheets.Data.H3.formula).toBe("F3/E3");
  });

  it("reads a workbook whose vbaProject.bin is not a VBA project, with no fingerprint", async () => {
    const reading = await readWorkbook(await makeWorkbook());
    expect(reading.vbaModuleHashes).toBeNull();
    expect(reading.sheets.Data.H3.formula).toBe("F3/E3");
  });

  it("reads a workbook without macros, custom properties or shared strings", async () => {
    const reading = await readWorkbook(
      await makeWorkbook({
        "xl/vbaProject.bin": null,
        "docProps/custom.xml": null,
        "xl/sharedStrings.xml": null,
        "xl/_rels/workbook.xml.rels": WORKBOOK_RELS_XML.replace(/<Relationship Id="rId4"[^>]*\/>/, ""),
        "xl/worksheets/sheet2.xml": sheetXml('<row r="1"><c r="A1"><v>1</v></c></row>'),
      }),
    );
    expect(reading.vbaModuleHashes).toBeNull();
    expect(reading.properties).toEqual({});
    expect(reading.sheets.Data).toEqual({ A1: { formula: null, value: 1, type: "number" } });
  });

  describe("not a workbook", () => {
    it("rejects bytes that are not a zip", async () => {
      const bytes = new TextEncoder().encode("Kode Batch,Lini\nB-2610-01,Lini A\n");
      await expect(readWorkbook(bytes)).rejects.toThrow(NotAWorkbookError);
      await expect(readWorkbook(bytes)).rejects.toThrow(/not a zip archive/);
    });

    it("rejects a truncated zip", async () => {
      const bytes = await makeWorkbook();
      await expect(readWorkbook(bytes.slice(0, bytes.length - 40))).rejects.toThrow(/not a zip archive/);
    });

    it("rejects a zip without xl/workbook.xml", async () => {
      const bytes = await makeWorkbook({ "xl/workbook.xml": null });
      await expect(readWorkbook(bytes)).rejects.toThrow(NotAWorkbookError);
      await expect(readWorkbook(bytes)).rejects.toThrow(/xl\/workbook\.xml is missing/);
    });

    it("rejects a zip without workbook relationships", async () => {
      await expect(readWorkbook(await makeWorkbook({ "xl/_rels/workbook.xml.rels": null }))).rejects.toThrow(
        /xl\/_rels\/workbook\.xml\.rels is missing/,
      );
    });

    it("rejects a shared strings part that the relationships name but the zip lacks", async () => {
      const bytes = await makeWorkbook({ "xl/sharedStrings.xml": null });
      await expect(readWorkbook(bytes)).rejects.toThrow(NotAWorkbookError);
      await expect(readWorkbook(bytes)).rejects.toThrow(/xl\/sharedStrings\.xml is missing/);
    });

    it("rejects a truncated sheet part", async () => {
      const xml = sheetXml(DATA_ROWS);
      // Cut after a complete cell: the parser alone would return rows 1–2 without complaint.
      const bytes = await makeWorkbook({ "xl/worksheets/sheet2.xml": xml.slice(0, xml.indexOf('<c r="H2"')) });
      await expect(readWorkbook(bytes)).rejects.toThrow(NotAWorkbookError);
      await expect(readWorkbook(bytes)).rejects.toThrow(/xl\/worksheets\/sheet2\.xml is not well-formed XML/);
    });

    it("rejects a sheet part that is not XML", async () => {
      const bytes = await makeWorkbook({ "xl/worksheets/sheet2.xml": "Kode Batch,Lini\nB-2610-01,Lini A\n" });
      await expect(readWorkbook(bytes)).rejects.toThrow(/xl\/worksheets\/sheet2\.xml is not well-formed XML/);
    });

    it("rejects a sheet whose part is missing", async () => {
      await expect(readWorkbook(await makeWorkbook({ "xl/worksheets/sheet2.xml": null }))).rejects.toThrow(
        /sheet "Data" points to missing part xl\/worksheets\/sheet2\.xml/,
      );
    });
  });

  it("fails on a shared formula child without its master", async () => {
    const bytes = await makeWorkbook({
      "xl/worksheets/sheet1.xml": sheetXml('<row r="3"><c r="H3"><f t="shared" si="7"/><v>1</v></c></row>'),
    });
    await expect(readWorkbook(bytes)).rejects.toThrow(/Instructions!H3: shared formula si="7" has no master/);
  });

  it("fails on two master cells for one shared formula", async () => {
    const bytes = await makeWorkbook({
      "xl/worksheets/sheet1.xml": sheetXml(
        '<row r="2"><c r="H2"><f t="shared" ref="H2:H3" si="0">F2/E2</f><v>1</v></c>' +
          '<c r="P2"><f t="shared" ref="P2:P3" si="0">A1</f><v>1</v></c></row>',
      ),
    });
    await expect(readWorkbook(bytes)).rejects.toThrow(/Instructions!P2: shared formula si="0" has a second master/);
  });

  it("fails on an empty shared string index", async () => {
    const bytes = await makeWorkbook({
      "xl/worksheets/sheet1.xml": sheetXml('<row r="1"><c r="A1" t="s"><v></v></c></row>'),
    });
    await expect(readWorkbook(bytes)).rejects.toThrow(/Instructions!A1: shared string index is empty/);
  });

  it("fails on a shared string index that does not exist", async () => {
    const bytes = await makeWorkbook({
      "xl/worksheets/sheet1.xml": sheetXml('<row r="1"><c r="A1" t="s"><v>99</v></c></row>'),
    });
    await expect(readWorkbook(bytes)).rejects.toThrow(/Instructions!A1: shared string 99 does not exist/);
  });
});

// The real thing: the S1 file filled in and saved by Excel 2021 (README.md).
// It is committed, so a missing file fails instead of skipping.

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const fixturePath = path.join(repoRoot, S2_FIXTURE);

async function readFixture(): Promise<Uint8Array> {
  if (!existsSync(fixturePath)) {
    throw new Error(`Fixture ${S2_FIXTURE} is missing: create it with src/adapters/workbook/__fixtures__/README.md`);
  }
  return readFile(fixturePath);
}

describe("s2-excel2021.xlsm (saved by Excel 2021)", () => {
  it("matches the expected formula, value and type of every fixture cell", async () => {
    const reading = await readWorkbook(await readFixture());
    const mismatches: string[] = [];
    for (const [sheet, cells] of Object.entries(s2Expected)) {
      for (const [ref, expected] of Object.entries(cells)) {
        const problem = cellMismatch(reading.sheets[sheet]?.[ref], expected);
        if (problem !== null) mismatches.push(`${sheet}!${ref}: ${problem}`);
      }
    }
    expect(mismatches).toEqual([]);
    expect(reading.properties.WHE_TemplateVersion).toBe("1");
    // Excel rewrote vbaProject.bin on save; modFinish keeps the S1-era template's hash (vba.test.ts).
    expect(reading.vbaModuleHashes?.modFinish).toBe(S2_MODFINISH_SHA256);
  });

  it("stores what S2 reads: fill-down as shared formulas, UNIQUE as a spill anchor, _xlfn. prefixes", async () => {
    const zip = await JSZip.loadAsync(await readFixture());
    const part = (await readSheetParts(zip)).get("Data");
    const xml = part === undefined ? "" : ((await zip.file(part)?.async("string")) ?? "");
    // Excel saved H3:J3 as the shared masters (H2:J2 as plain formulas); rows 4–11 are their children.
    for (const column of "HIJ") {
      for (let row = 4; row <= 11; row++) {
        expect(xml, `${column}${row}`).toMatch(new RegExp(`<c r="${column}${row}"[^>]*><f t="shared" si="\\d+"/>`));
      }
    }
    expect(xml).toMatch(/<c r="L6"[^>]*><f t="array" ref="L6:L8">/);
    expect(xml).toContain("_xlfn.");
  });
});
