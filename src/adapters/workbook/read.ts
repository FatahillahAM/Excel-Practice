import { XMLParser, XMLValidator } from "fast-xml-parser";
import JSZip from "jszip";
import { columnIndex, columnLetters, normalizeFormula, shiftFormula } from "./formula.ts";
import { readSheetParts, resolvePartName } from "./template-patch.ts";
import { readVbaModuleHashes, type VbaModuleHashes } from "./vba.ts";

/**
 * Workbook reading for WorkbookIO (AD-4): what a saved `.xlsm`/`.xlsx` holds per
 * cell (normalized formula text with shared formulas expanded, cached value and
 * its type), its custom document properties and the VBA fingerprint (per
 * module, the SHA-256 of its normalized source; see `vba.ts`). Only the cells' own XML is trusted: `<dimension>` and
 * row `spans` can be stale (S1) and are ignored.
 *
 * `WorkbookReading` lives here during the spike; it moves to `src/core` with
 * grading (epic 3).
 */

export type CellType = "number" | "string" | "boolean" | "error" | "empty";

export interface CellReading {
  /** Normalized formula text (see `normalizeFormula`), or `null` for a value typed in or spilled into the cell. */
  formula: string | null;
  /** Cached value; an error is its code (`#N/A`); `null` when the cell holds a formula Excel has not calculated. */
  value: number | string | boolean | null;
  type: CellType;
}

export interface WorkbookReading {
  /** Per sheet name, per A1 reference (`H3`): only cells with a formula or a value. */
  sheets: Record<string, Record<string, CellReading>>;
  /** Custom document properties as text. */
  properties: Record<string, string>;
  /**
   * Per VBA module (MODULENAMEUNICODE), lowercase hex SHA-256 of its normalized source (AD-4);
   * `null` when `xl/vbaProject.bin` is missing or is not a readable VBA project. Compare with `matchesTemplate`.
   */
  vbaModuleHashes: VbaModuleHashes | null;
}

/** The bytes are not an OOXML workbook (AD-6 `NOT_EXCEL`); the message says why. */
export class NotAWorkbookError extends Error {
  constructor(reason: string) {
    super(`Not an Excel workbook: ${reason}`);
    this.name = "NotAWorkbookError";
  }
}

const WORKBOOK_PART = "xl/workbook.xml";
const WORKBOOK_RELS_PART = "xl/_rels/workbook.xml.rels";
const CUSTOM_PROPERTIES_PART = "docProps/custom.xml";
const VBA_PROJECT_PART = "xl/vbaProject.bin";
const SHARED_STRINGS_TYPE_SUFFIX = "/sharedStrings";

export async function readWorkbook(bytes: Uint8Array): Promise<WorkbookReading> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch (error) {
    throw new NotAWorkbookError(`the file is not a zip archive (${(error as Error).message})`);
  }
  for (const part of [WORKBOOK_PART, WORKBOOK_RELS_PART]) {
    if (zip.file(part) === null) throw new NotAWorkbookError(`${part} is missing`);
  }

  const sheetParts = await readSheetParts(zip);
  const sharedStrings = await readSharedStrings(zip);
  const sheets = new Map<string, Record<string, CellReading>>();
  for (const [name, part] of sheetParts) {
    const xml = await readPart(zip, part);
    if (xml === null) throw new NotAWorkbookError(`sheet "${name}" points to missing part ${part}`);
    sheets.set(name, readSheet(name, parseXml(xml, part), sharedStrings));
  }

  return {
    sheets: Object.fromEntries(sheets),
    properties: await readCustomProperties(zip),
    vbaModuleHashes: await readVbaFingerprint(zip),
  };
}

/** A missing or unreadable VBA project is not a reason to refuse the workbook here: it never matches a template (AD-6). */
async function readVbaFingerprint(zip: JSZip): Promise<VbaModuleHashes | null> {
  const file = zip.file(VBA_PROJECT_PART);
  if (file === null) return null;
  let bytes: Uint8Array;
  try {
    bytes = await file.async("uint8array");
  } catch {
    return null;
  }
  return readVbaModuleHashes(bytes);
}

// ---------------------------------------------------------------------------
// Sheet cells

interface RawCell {
  ref: string;
  row: number;
  column: number;
  node: XmlNode;
}

interface SharedMaster {
  text: string;
  row: number;
  column: number;
}

const REF_RE = /^([A-Z]{1,3})([1-9][0-9]*)$/i;
const MAX_ROW = 1_048_576;
const MAX_COLUMN = 16_384;

function readSheet(
  sheetName: string,
  doc: XmlNode,
  sharedStrings: readonly string[],
): Record<string, CellReading> {
  // A chartsheet or dialogsheet has no <sheetData>: no cells.
  const sheetData = child(child(doc, "worksheet"), "sheetData");
  const cells: RawCell[] = [];
  let rowNumber = 0;
  for (const row of children(sheetData, "row")) {
    const r = attr(row, "r");
    rowNumber = r === null ? rowNumber + 1 : Number(r);
    if (!Number.isInteger(rowNumber) || rowNumber < 1) {
      throw new Error(`Sheet "${sheetName}": <row r="${r}"> is not a row number`);
    }
    let column = 0;
    for (const cell of children(row, "c")) {
      const ref = attr(cell, "r");
      let cellRow = rowNumber;
      if (ref === null) {
        column += 1;
      } else {
        const match = REF_RE.exec(ref);
        column = match === null ? 0 : columnIndex(match[1]);
        cellRow = match === null ? 0 : Number(match[2]);
        if (column < 1 || column > MAX_COLUMN || cellRow > MAX_ROW) {
          throw new Error(`Sheet "${sheetName}": <c r="${ref}"> is not a cell reference`);
        }
      }
      cells.push({ ref: `${columnLetters(column)}${cellRow}`, row: cellRow, column, node: cell });
    }
  }

  // Masters sit at the top-left of their range, so they come first in row
  // order; collecting them in a pass of their own does not rely on it.
  const masters = new Map<string, SharedMaster>();
  for (const cell of cells) {
    const f = child(cell.node, "f");
    if (f !== undefined && attr(f, "t") === "shared" && text(f) !== "") {
      const si = attr(f, "si") ?? "";
      if (masters.has(si)) {
        throw new Error(`Cell ${sheetName}!${cell.ref}: shared formula si="${si}" has a second master cell`);
      }
      masters.set(si, { text: text(f), row: cell.row, column: cell.column });
    }
  }

  const out = new Map<string, CellReading>();
  for (const cell of cells) {
    const where = `${sheetName}!${cell.ref}`;
    const formula = cellFormula(cell, masters, where);
    const { value, type } = cellValue(cell.node, sharedStrings, where);
    if (formula === null && type === "empty") continue;
    out.set(cell.ref, { formula, value, type });
  }
  return Object.fromEntries(out);
}

function cellFormula(cell: RawCell, masters: Map<string, SharedMaster>, where: string): string | null {
  const f = child(cell.node, "f");
  if (f === undefined) return null;
  let formula = text(f);
  if (attr(f, "t") === "shared" && formula === "") {
    const si = attr(f, "si");
    const master = si === null ? undefined : masters.get(si);
    if (master === undefined) throw new Error(`Cell ${where}: shared formula si="${si}" has no master cell`);
    formula = shiftFormula(master.text, cell.row - master.row, cell.column - master.column);
  }
  // A data table (`t="dataTable"`) has no formula text of its own.
  return formula.trim() === "" ? null : normalizeFormula(formula);
}

const NUMBER_RE = /^[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/;

function cellValue(
  node: XmlNode,
  sharedStrings: readonly string[],
  where: string,
): Pick<CellReading, "value" | "type"> {
  const t = attr(node, "t") ?? "n";
  if (t === "inlineStr") {
    const is = child(node, "is");
    return is === undefined ? EMPTY : { value: richText(is), type: "string" };
  }
  const v = child(node, "v");
  if (v === undefined) return EMPTY;
  const raw = text(v);
  switch (t) {
    case "n": {
      const trimmed = raw.trim();
      if (trimmed === "") return EMPTY;
      if (!NUMBER_RE.test(trimmed)) throw new Error(`Cell ${where}: value "${raw}" is not a number`);
      return { value: Number(trimmed), type: "number" };
    }
    case "s": {
      if (raw.trim() === "") throw new Error(`Cell ${where}: shared string index is empty`);
      const index = Number(raw.trim());
      const value = Number.isInteger(index) ? sharedStrings[index] : undefined;
      if (value === undefined) throw new Error(`Cell ${where}: shared string ${raw} does not exist`);
      return { value, type: "string" };
    }
    case "str":
      return { value: decodeEscapes(raw), type: "string" };
    case "b":
      if (raw.trim() !== "0" && raw.trim() !== "1") throw new Error(`Cell ${where}: boolean "${raw}" is not 0 or 1`);
      return { value: raw.trim() === "1", type: "boolean" };
    case "e":
      return { value: raw, type: "error" };
    case "d":
      // ISO 8601 date text; Excel itself stores dates as serial numbers.
      return { value: raw, type: "string" };
    default:
      throw new Error(`Cell ${where}: unknown cell type t="${t}"`);
  }
}

const EMPTY = { value: null, type: "empty" } as const;

// ---------------------------------------------------------------------------
// Shared strings, custom properties

async function readSharedStrings(zip: JSZip): Promise<string[]> {
  const rels = parseXml((await readPart(zip, WORKBOOK_RELS_PART))!, WORKBOOK_RELS_PART);
  const relationship = children(child(rels, "Relationships"), "Relationship").find((rel) =>
    (attr(rel, "Type") ?? "").endsWith(SHARED_STRINGS_TYPE_SUFFIX),
  );
  const target = relationship === undefined ? null : attr(relationship, "Target");
  if (target === null) return [];
  const part = resolvePartName(target);
  const xml = await readPart(zip, part);
  if (xml === null) throw new NotAWorkbookError(`${part} is missing`);
  return children(child(parseXml(xml, part), "sst"), "si").map(richText);
}

/** Text of an `<si>` or `<is>`: its `<t>`, or its rich text runs `<r><t>` joined; phonetic `<rPh>` is not text. */
function richText(node: XmlNode): string {
  const runs = children(node, "r").map((run) => decodeEscapes(text(child(run, "t"))));
  return decodeEscapes(text(child(node, "t"))) + runs.join("");
}

/** `_xHHHH_` stands for the character U+HHHH in cell text (ECMA-376 ST_Xstring); `_x005F_` escapes the underscore. */
function decodeEscapes(value: string): string {
  return value.replace(/_x([0-9A-Fa-f]{4})_/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

async function readCustomProperties(zip: JSZip): Promise<Record<string, string>> {
  const xml = await readPart(zip, CUSTOM_PROPERTIES_PART);
  if (xml === null) return {};
  const properties = new Map<string, string>();
  for (const property of children(child(parseXml(xml, CUSTOM_PROPERTIES_PART), "Properties"), "property")) {
    const name = attr(property, "name");
    // The value is the one child element (`vt:lpwstr`, `vt:i4`, `vt:bool`, …).
    const valueKey = Object.keys(property).find((key) => !key.startsWith("@_") && key !== "#text");
    if (name !== null && valueKey !== undefined) properties.set(name, text(property[valueKey] as XmlNode));
  }
  return Object.fromEntries(properties);
}

// ---------------------------------------------------------------------------
// XML

type XmlNode = { [key: string]: unknown };

const ARRAY_TAGS = new Set(["row", "c", "si", "r", "property", "Relationship"]);

// Entities are decoded by `text`/`attr` below, so numeric references (`&#10;`)
// are handled too and no DOCTYPE entity is ever expanded.
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: false,
  alwaysCreateTextNode: true,
  removeNSPrefix: true,
  processEntities: false,
  isArray: (name, _path, _leaf, isAttribute) => !isAttribute && ARRAY_TAGS.has(name),
});

function parseXml(xml: string, part: string): XmlNode {
  // The parser itself accepts truncated or non-XML text and returns what it got.
  const valid = XMLValidator.validate(xml);
  if (valid !== true) {
    throw new NotAWorkbookError(`${part} is not well-formed XML (${valid.err.msg}, line ${valid.err.line})`);
  }
  try {
    return parser.parse(xml) as XmlNode;
  } catch (error) {
    throw new NotAWorkbookError(`${part} is not well-formed XML (${(error as Error).message})`);
  }
}

function child(node: XmlNode | undefined, name: string): XmlNode | undefined {
  const value = node?.[name];
  if (Array.isArray(value)) return value[0] as XmlNode | undefined;
  return typeof value === "object" && value !== null ? (value as XmlNode) : undefined;
}

function children(node: XmlNode | undefined, name: string): XmlNode[] {
  const value = node?.[name];
  return Array.isArray(value) ? (value as XmlNode[]) : [];
}

function text(node: XmlNode | undefined): string {
  const value = node?.["#text"];
  return typeof value === "string" ? decodeXml(value) : "";
}

function attr(node: XmlNode, name: string): string | null {
  const value = node[`@_${name}`];
  return typeof value === "string" ? decodeXml(value) : null;
}

function decodeXml(value: string): string {
  return value.replace(/&(lt|gt|amp|quot|apos|#x[0-9A-Fa-f]+|#[0-9]+);/g, (_, entity: string) => {
    switch (entity) {
      case "lt":
        return "<";
      case "gt":
        return ">";
      case "amp":
        return "&";
      case "quot":
        return '"';
      case "apos":
        return "'";
      default:
        return String.fromCodePoint(
          entity[1] === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10),
        );
    }
  });
}

async function readPart(zip: JSZip, name: string): Promise<string | null> {
  const file = zip.file(name);
  return file === null ? null : file.async("string");
}
