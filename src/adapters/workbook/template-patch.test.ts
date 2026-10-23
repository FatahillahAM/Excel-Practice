import { createHash } from "node:crypto";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { patchTemplate, vbaProjectSha256, type TemplatePatch } from "./template-patch";

// A synthetic .xlsm shaped like an Excel 2021 save: Instructions lives in
// sheet2.xml so the lookup has to go through workbook.xml.rels, not sheet order.

const CUSTOM_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' +
  '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
  '<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="WHE_AttemptToken"><vt:lpwstr>TEMPLATE</vt:lpwstr></property>' +
  '<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="3" name="WHE_ServerUrl"><vt:lpwstr>TEMPLATE</vt:lpwstr></property>' +
  '<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="4" name="WHE_TemplateVersion"><vt:lpwstr>TEMPLATE</vt:lpwstr></property>' +
  "</Properties>";

const WORKBOOK_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' +
  '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
  '<sheets><sheet name="Data" sheetId="2" r:id="rId1"/><sheet name="Instructions" sheetId="1" r:id="rId2"/></sheets>' +
  "</workbook>";

const WORKBOOK_RELS_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>' +
  '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="/xl/worksheets/sheet1.xml"/>' +
  "</Relationships>";

const SHEET_HEAD =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' +
  '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac">' +
  '<dimension ref="A2:C9"/><sheetViews><sheetView workbookViewId="0"/></sheetViews>';
const SHEET_TAIL = '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>';

const INSTRUCTIONS_ROWS =
  '<row r="2" spans="2:2" x14ac:dyDescent="0.25"><c r="B2" s="3" t="s"><v>0</v></c></row>' +
  '<row r="4" spans="2:2" x14ac:dyDescent="0.25"><c r="B4" s="5"/></row>' +
  '<row r="6" spans="1:3" x14ac:dyDescent="0.25"><c r="A6" s="1"/><c r="C6" s="1"/></row>' +
  '<row r="9" ht="30" customHeight="1" x14ac:dyDescent="0.25"/>';

const DATA_SHEET_XML = `${SHEET_HEAD}<sheetData/>${SHEET_TAIL}`;
const OTHER_PARTS: Record<string, string> = {
  "[Content_Types].xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<Types/>',
  "_rels/.rels": "<Relationships/>",
  "xl/sharedStrings.xml": '<sst count="1" uniqueCount="1"><si><t>TEMPLATE</t></si></sst>',
  "xl/calcChain.xml": '<calcChain><c r="A1" i="1"/></calcChain>',
  "xl/styles.xml": "<styleSheet/>",
};
const VBA_PROJECT = Uint8Array.from({ length: 4096 }, (_, i) => (i * 37 + 11) % 256);

interface TemplateOptions {
  customXml?: string;
  instructionsRows?: string;
}

async function makeTemplate(options: TemplateOptions = {}): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", OTHER_PARTS["[Content_Types].xml"]);
  zip.file("_rels/.rels", OTHER_PARTS["_rels/.rels"], { createFolders: false });
  zip.file("docProps/custom.xml", options.customXml ?? CUSTOM_XML, { createFolders: false });
  zip.file("xl/workbook.xml", WORKBOOK_XML, { createFolders: false });
  zip.file("xl/_rels/workbook.xml.rels", WORKBOOK_RELS_XML, { createFolders: false });
  zip.file(
    "xl/worksheets/sheet2.xml",
    `${SHEET_HEAD}<sheetData>${options.instructionsRows ?? INSTRUCTIONS_ROWS}</sheetData>${SHEET_TAIL}`,
    { createFolders: false },
  );
  zip.file("xl/worksheets/sheet1.xml", DATA_SHEET_XML, { createFolders: false });
  for (const name of ["xl/sharedStrings.xml", "xl/calcChain.xml", "xl/styles.xml"]) {
    zip.file(name, OTHER_PARTS[name], { createFolders: false });
  }
  zip.file("xl/vbaProject.bin", VBA_PROJECT, { createFolders: false });
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

async function readText(bytes: Uint8Array, name: string): Promise<string> {
  const file = (await JSZip.loadAsync(bytes)).file(name);
  if (file === null) throw new Error(`missing ${name}`);
  return file.async("string");
}

async function sheetData(bytes: Uint8Array, part: string): Promise<string> {
  const xml = await readText(bytes, part);
  const match = /<sheetData>([\s\S]*)<\/sheetData>/.exec(xml);
  if (match === null) throw new Error(`no sheetData in ${part}`);
  return match[1];
}

const PROPERTIES = {
  WHE_AttemptToken: "tok_abc-123",
  WHE_ServerUrl: "https://example.test",
  WHE_TemplateVersion: "1",
};

const NORMAL_PATCH: TemplatePatch = {
  properties: PROPERTIES,
  cells: {
    Instructions: { B2: "Judul", B4: "Skenario", B6: "Soal 1", B7: "Soal 2", B10: "Soal 5" },
    Data: { C1: "Unit", A1: "Lini", A2: "A", C2: 1250.5, B1: "Shift", B2: -3 },
  },
};

describe("patchTemplate", () => {
  it("fills properties and cells, and leaves every other part and vbaProject.bin unchanged", async () => {
    const template = await makeTemplate();
    const patched = await patchTemplate(template, NORMAL_PATCH);

    const custom = await readText(patched, "docProps/custom.xml");
    expect(custom).toBe(
      CUSTOM_XML.replace(
        'name="WHE_AttemptToken"><vt:lpwstr>TEMPLATE',
        'name="WHE_AttemptToken"><vt:lpwstr>tok_abc-123',
      )
        .replace('name="WHE_ServerUrl"><vt:lpwstr>TEMPLATE', 'name="WHE_ServerUrl"><vt:lpwstr>https://example.test')
        .replace('name="WHE_TemplateVersion"><vt:lpwstr>TEMPLATE', 'name="WHE_TemplateVersion"><vt:lpwstr>1'),
    );

    const data = await sheetData(patched, "xl/worksheets/sheet1.xml");
    expect(data).toBe(
      '<row r="1">' +
        '<c r="A1" t="inlineStr"><is><t xml:space="preserve">Lini</t></is></c>' +
        '<c r="B1" t="inlineStr"><is><t xml:space="preserve">Shift</t></is></c>' +
        '<c r="C1" t="inlineStr"><is><t xml:space="preserve">Unit</t></is></c>' +
        "</row>" +
        '<row r="2">' +
        '<c r="A2" t="inlineStr"><is><t xml:space="preserve">A</t></is></c>' +
        '<c r="B2"><v>-3</v></c>' +
        '<c r="C2"><v>1250.5</v></c>' +
        "</row>",
    );

    const instructions = await readText(patched, "xl/worksheets/sheet2.xml");
    expect(instructions).toContain(
      '<row r="2" spans="2:2" x14ac:dyDescent="0.25"><c r="B2" s="3" t="inlineStr"><is><t xml:space="preserve">Judul</t></is></c></row>',
    );
    expect(instructions.startsWith(SHEET_HEAD)).toBe(true);
    expect(instructions.endsWith(SHEET_TAIL)).toBe(true);

    const before = await JSZip.loadAsync(template);
    const after = await JSZip.loadAsync(patched);
    expect(Object.keys(after.files)).toEqual(Object.keys(before.files));
    const edited = new Set(["docProps/custom.xml", "xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml"]);
    for (const name of Object.keys(before.files).filter((n) => !edited.has(n))) {
      const original = await before.file(name)!.async("uint8array");
      expect(await after.file(name)!.async("uint8array"), name).toEqual(original);
    }
    expect(await vbaProjectSha256(patched)).toBe(await vbaProjectSha256(template));
  });

  it("keeps the style of an empty styled cell", async () => {
    const patched = await patchTemplate(await makeTemplate(), {
      properties: {},
      cells: { Instructions: { B4: "Skenario" } },
    });
    expect(await sheetData(patched, "xl/worksheets/sheet2.xml")).toContain(
      '<row r="4" spans="2:2" x14ac:dyDescent="0.25"><c r="B4" s="5" t="inlineStr"><is><t xml:space="preserve">Skenario</t></is></c></row>',
    );
  });

  it("inserts missing rows and cells in row and column order", async () => {
    const patched = await patchTemplate(await makeTemplate(), {
      properties: {},
      cells: { Instructions: { B9: "Soal 4", B7: "Soal 2", B6: "Soal 1", D6: 4, B10: "Soal 5" } },
    });
    expect(await sheetData(patched, "xl/worksheets/sheet2.xml")).toBe(
      '<row r="2" spans="2:2" x14ac:dyDescent="0.25"><c r="B2" s="3" t="s"><v>0</v></c></row>' +
        '<row r="4" spans="2:2" x14ac:dyDescent="0.25"><c r="B4" s="5"/></row>' +
        '<row r="6" spans="1:3" x14ac:dyDescent="0.25"><c r="A6" s="1"/>' +
        '<c r="B6" t="inlineStr"><is><t xml:space="preserve">Soal 1</t></is></c>' +
        '<c r="C6" s="1"/><c r="D6"><v>4</v></c></row>' +
        '<row r="7"><c r="B7" t="inlineStr"><is><t xml:space="preserve">Soal 2</t></is></c></row>' +
        '<row r="9" ht="30" customHeight="1" x14ac:dyDescent="0.25">' +
        '<c r="B9" t="inlineStr"><is><t xml:space="preserve">Soal 4</t></is></c></row>' +
        '<row r="10"><c r="B10" t="inlineStr"><is><t xml:space="preserve">Soal 5</t></is></c></row>',
    );
  });

  it("escapes special characters, normalizes line breaks and preserves spaces", async () => {
    const patched = await patchTemplate(await makeTemplate(), {
      properties: { WHE_ServerUrl: 'https://x.test/?a=1&b="2"<' },
      cells: { Data: { A1: ' a < b & "c"\r\nd\re\nf_x0041_ ' } },
    });
    expect(await sheetData(patched, "xl/worksheets/sheet1.xml")).toBe(
      '<row r="1"><c r="A1" t="inlineStr"><is><t xml:space="preserve"> a &lt; b &amp; &quot;c&quot;\nd\ne\nf_x005F_x0041_ </t></is></c></row>',
    );
    expect(await readText(patched, "docProps/custom.xml")).toContain(
      'name="WHE_ServerUrl"><vt:lpwstr>https://x.test/?a=1&amp;b=&quot;2&quot;&lt;</vt:lpwstr>',
    );
  });

  it("rejects text XML cannot hold", async () => {
    await expect(
      patchTemplate(await makeTemplate(), { properties: {}, cells: { Data: { A1: "bell\u0007" } } }),
    ).rejects.toThrow(/Data!A1/);
  });

  it("keeps a namespace declared on the property value element", async () => {
    const vt = 'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"';
    const template = await makeTemplate({ customXml: CUSTOM_XML.replaceAll("<vt:lpwstr>", `<vt:lpwstr ${vt}>`) });
    const patched = await patchTemplate(template, { properties: PROPERTIES, cells: {} });
    expect(await readText(patched, "docProps/custom.xml")).toContain(
      `name="WHE_AttemptToken"><vt:lpwstr ${vt}>tok_abc-123</vt:lpwstr>`,
    );
  });

  it("rejects a property that is not Text", async () => {
    const template = await makeTemplate({
      customXml: CUSTOM_XML.replace("<vt:lpwstr>TEMPLATE</vt:lpwstr></property></Properties>", "<vt:i4>1</vt:i4></property></Properties>"),
    });
    await expect(patchTemplate(template, { properties: PROPERTIES, cells: {} })).rejects.toThrow(
      /"WHE_TemplateVersion" is not a Text property/,
    );
  });

  it("names a property the template does not have", async () => {
    const template = await makeTemplate({
      customXml: CUSTOM_XML.replace(/<property [^>]*name="WHE_ServerUrl">.*?<\/property>/, ""),
    });
    await expect(patchTemplate(template, { properties: PROPERTIES, cells: {} })).rejects.toThrow(
      /"WHE_ServerUrl" not found/,
    );
  });

  it("names a sheet the template does not have", async () => {
    await expect(
      patchTemplate(await makeTemplate(), { properties: {}, cells: { Instruksi: { B2: "x" } } }),
    ).rejects.toThrow(/Sheet "Instruksi" not found/);
  });

  it("refuses to overwrite a formula cell", async () => {
    const template = await makeTemplate({
      instructionsRows: '<row r="4"><c r="B4" s="5"><f>SUM(A1:A2)</f><v>3</v></c></row>',
    });
    await expect(
      patchTemplate(template, { properties: {}, cells: { Instructions: { B4: "x" } } }),
    ).rejects.toThrow(/Instructions!B4 holds a formula/);
  });

  it.each([NaN, Infinity, -Infinity])("rejects the non-finite number %s and names the cell", async (value) => {
    await expect(
      patchTemplate(await makeTemplate(), { properties: {}, cells: { Data: { C2: value } } }),
    ).rejects.toThrow(/Data!C2: number must be finite/);
  });
});

describe("vbaProjectSha256", () => {
  it("hashes the bytes of xl/vbaProject.bin", async () => {
    const expected = createHash("sha256").update(VBA_PROJECT).digest("hex");
    expect(await vbaProjectSha256(await makeTemplate())).toBe(expected);
  });

  it("fails for a workbook without VBA", async () => {
    const zip = new JSZip();
    zip.file("xl/workbook.xml", WORKBOOK_XML);
    const bytes = await zip.generateAsync({ type: "uint8array" });
    await expect(vbaProjectSha256(bytes)).rejects.toThrow(/xl\/vbaProject\.bin not found/);
  });
});
