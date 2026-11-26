import JSZip from "jszip";
import path from "node:path";
import { readSheetParts } from "../template-patch";

/**
 * Test only: adds an Excel Table (ListObject) to a sheet of a workbook as
 * Excel 2021 saves one (the spike file `table-excel2021.xlsm`): the part
 * `xl/tables/tableN.xml` (`ref`, `autoFilter`, `tableColumns` named after the
 * header text, no `headerRowCount` when the header row is on), its content
 * type, a relationship in the sheet's rels part and `<tableParts>` at the end
 * of the sheet. The header and data cells themselves are not touched: the
 * generated Data already holds them, as when a user presses Ctrl+T.
 */

export interface FixtureTable {
  /** `name` and `displayName` (`Table1`). */
  name: string;
  /** Range with the header row (`A1:G13`). */
  ref: string;
  /** Column names, in order: the header text. */
  columns: readonly string[];
  /** `false` writes `headerRowCount="0"` (Ctrl+T without "My table has headers"). Default `true`. */
  headerRow?: boolean;
}

const TABLE_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml";
const TABLE_REL_TYPE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/table";
const RELS_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';

export async function writeTablePart(bytes: Uint8Array, sheetName: string, table: FixtureTable): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(bytes);
  const sheetPart = (await readSheetParts(zip)).get(sheetName);
  if (sheetPart === undefined) throw new Error(`writeTablePart: no sheet ${sheetName}`);

  let n = 1;
  while (zip.file(`xl/tables/table${n}.xml`) !== null) n++;
  const tablePart = `xl/tables/table${n}.xml`;
  const header = table.headerRow === false ? ' headerRowCount="0"' : "";
  zip.file(
    tablePart,
    `${XML_HEAD}<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="${n}" name="${escapeXml(table.name)}" displayName="${escapeXml(table.name)}" ref="${table.ref}"${header} totalsRowShown="0">` +
      `<autoFilter ref="${table.ref}"/><tableColumns count="${table.columns.length}">` +
      table.columns.map((name, i) => `<tableColumn id="${i + 1}" name="${escapeXml(name)}"/>`).join("") +
      '</tableColumns><tableStyleInfo name="TableStyleMedium2" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/></table>',
  );

  const typesFile = zip.file("[Content_Types].xml");
  if (typesFile === null) throw new Error("writeTablePart: no [Content_Types].xml");
  const types = await typesFile.async("string");
  zip.file("[Content_Types].xml", types.replace("</Types>", `<Override PartName="/${tablePart}" ContentType="${TABLE_CONTENT_TYPE}"/></Types>`));

  const relsPart = path.posix.join(path.posix.dirname(sheetPart), "_rels", `${path.posix.basename(sheetPart)}.rels`);
  const existing = zip.file(relsPart);
  const rels = existing === null ? `${XML_HEAD}<Relationships xmlns="${RELS_NS}"></Relationships>` : await existing.async("string");
  let id = 1;
  while (rels.includes(`Id="rIdT${id}"`)) id++;
  const rId = `rIdT${id}`;
  const target = path.posix.relative(path.posix.dirname(sheetPart), tablePart);
  zip.file(relsPart, rels.replace(/<\/Relationships>\s*$/, `<Relationship Id="${rId}" Type="${TABLE_REL_TYPE}" Target="${target}"/></Relationships>`));

  const sheet = await zip.file(sheetPart)!.async("string");
  const part = `<tablePart xmlns:r="${R_NS}" r:id="${rId}"/>`;
  let next: string;
  if (/<tableParts\b[^>]*>/.test(sheet)) {
    next = sheet
      .replace(/<tableParts\b[^>]*count="(\d+)"/, (_, count: string) => `<tableParts count="${Number(count) + 1}"`)
      .replace("</tableParts>", `${part}</tableParts>`);
  } else {
    const block = `<tableParts count="1">${part}</tableParts>`;
    // <tableParts> comes after everything but <extLst> (ECMA-376 CT_Worksheet order).
    next = sheet.includes("<extLst") ? sheet.replace("<extLst", `${block}<extLst`) : sheet.replace("</worksheet>", `${block}</worksheet>`);
  }
  zip.file(sheetPart, next);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
