import { createHash } from "node:crypto";
import path from "node:path";
import JSZip from "jszip";

/**
 * Template patching for WorkbookIO (AD-4). The `.xlsm` stays a zip of the parts
 * Excel wrote: only `docProps/custom.xml` and the targeted sheet XML are edited,
 * in place, as text. Strings go in as inline strings, so `sharedStrings.xml` and
 * `calcChain.xml` are never touched, and `xl/vbaProject.bin` keeps its bytes.
 */

export type CellValue = string | number;

export interface TemplatePatch {
  /** Custom document properties to set. Each must already exist in the template as a Text property. */
  properties: Readonly<Record<string, string>>;
  /** Values per sheet name, keyed by A1 reference (`B4`). */
  cells: Readonly<Record<string, Readonly<Record<string, CellValue>>>>;
}

const VBA_PROJECT_PART = "xl/vbaProject.bin";
const CUSTOM_PROPERTIES_PART = "docProps/custom.xml";
const WORKBOOK_PART = "xl/workbook.xml";
const WORKBOOK_RELS_PART = "xl/_rels/workbook.xml.rels";
const RELATIONSHIPS_NS =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

const MAX_ROW = 1_048_576;
const MAX_COLUMN = 16_384;

export async function patchTemplate(
  bytes: Uint8Array,
  patch: TemplatePatch,
): Promise<Uint8Array> {
  const writesBySheet = Object.entries(patch.cells).map(
    ([sheetName, cells]) => [sheetName, planSheetWrites(sheetName, cells)] as const,
  );
  const zip = await JSZip.loadAsync(bytes);

  const propertyNames = Object.keys(patch.properties);
  if (propertyNames.length > 0) {
    const xml = await readPart(zip, CUSTOM_PROPERTIES_PART);
    if (xml === null) {
      throw new Error(
        `Custom document property "${propertyNames[0]}" not found: template has no ${CUSTOM_PROPERTIES_PART}`,
      );
    }
    writePart(zip, CUSTOM_PROPERTIES_PART, setCustomProperties(xml, patch.properties));
  }

  if (writesBySheet.length > 0) {
    const sheetParts = await readSheetParts(zip);
    for (const [sheetName, rows] of writesBySheet) {
      const part = sheetParts.get(sheetName);
      if (part === undefined) {
        throw new Error(`Sheet "${sheetName}" not found in template`);
      }
      const xml = await readPart(zip, part);
      if (xml === null) {
        throw new Error(`Sheet "${sheetName}" points to missing part ${part}`);
      }
      writePart(zip, part, patchSheetXml(xml, sheetName, rows));
    }
  }

  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

/** Lowercase hex SHA-256 of `xl/vbaProject.bin` (the template fingerprint, AD-4/AD-6). */
export async function vbaProjectSha256(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const file = zip.file(VBA_PROJECT_PART);
  if (file === null) {
    throw new Error(`${VBA_PROJECT_PART} not found: not a macro-enabled workbook`);
  }
  const data = await file.async("uint8array");
  return createHash("sha256").update(data).digest("hex");
}

// ---------------------------------------------------------------------------
// Zip parts

async function readPart(zip: JSZip, name: string): Promise<string | null> {
  const file = zip.file(name);
  return file === null ? null : file.async("string");
}

function writePart(zip: JSZip, name: string, text: string): void {
  const old = zip.file(name);
  zip.file(name, text, {
    createFolders: false,
    date: old?.date,
    comment: old?.comment,
    dosPermissions: old?.dosPermissions,
    unixPermissions: old?.unixPermissions,
  });
}

// ---------------------------------------------------------------------------
// Custom document properties

const PROPERTY_RE = /<property\b([^>]*)>([\s\S]*?)<\/property>/g;
const LPWSTR_RE = /^(\s*)<([A-Za-z_][\w.-]*:)?lpwstr\b([^>]*?)(?:\/>|>[\s\S]*?<\/\2lpwstr>)(\s*)$/;

function setCustomProperties(
  xml: string,
  properties: Readonly<Record<string, string>>,
): string {
  for (const [name, value] of Object.entries(properties)) {
    if (INVALID_XML_CHAR_RE.test(value)) {
      throw new Error(`Custom document property "${name}": value contains a control character XML cannot hold`);
    }
  }
  const pending = new Set(Object.keys(properties));
  const out = xml.replace(PROPERTY_RE, (whole, attrs: string, body: string) => {
    const name = attributeValue(attrs, "name");
    if (name === null || !pending.has(name)) return whole;
    pending.delete(name);
    const value = LPWSTR_RE.exec(body);
    if (value === null) {
      throw new Error(`Custom document property "${name}" is not a Text property`);
    }
    const [, lead, prefix = "", valueAttrs, trail] = value;
    const text = escapeXml(properties[name]);
    return `<property${attrs}>${lead}<${prefix}lpwstr${valueAttrs.trimEnd()}>${text}</${prefix}lpwstr>${trail}</property>`;
  });
  const [missing] = pending;
  if (missing !== undefined) {
    throw new Error(`Custom document property "${missing}" not found in template`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Workbook → sheet part

const SHEET_RE = /<sheet\b([^>]*?)\/?>/g;
const RELATIONSHIP_RE = /<Relationship\b([^>]*?)\/?>/g;

async function readSheetParts(zip: JSZip): Promise<Map<string, string>> {
  const workbook = await readPart(zip, WORKBOOK_PART);
  const rels = await readPart(zip, WORKBOOK_RELS_PART);
  if (workbook === null || rels === null) {
    throw new Error(`Template has no ${workbook === null ? WORKBOOK_PART : WORKBOOK_RELS_PART}`);
  }

  const prefix = namespacePrefix(workbook, RELATIONSHIPS_NS);
  if (prefix === null) {
    throw new Error(`${WORKBOOK_PART} does not declare the relationships namespace`);
  }

  const targets = new Map<string, string>();
  for (const [, attrs] of rels.matchAll(RELATIONSHIP_RE)) {
    const id = attributeValue(attrs, "Id");
    const target = attributeValue(attrs, "Target");
    if (id !== null && target !== null) targets.set(id, resolvePartName(target));
  }

  const parts = new Map<string, string>();
  for (const [, attrs] of workbook.matchAll(SHEET_RE)) {
    const name = attributeValue(attrs, "name");
    const id = attributeValue(attrs, `${prefix}:id`);
    const part = id === null ? undefined : targets.get(id);
    if (name !== null && part !== undefined) parts.set(name, part);
  }
  return parts;
}

function namespacePrefix(xml: string, namespace: string): string | null {
  for (const [, prefix, uri] of xml.matchAll(/\sxmlns:([\w.-]+)\s*=\s*"([^"]*)"/g)) {
    if (uri === namespace) return prefix;
  }
  return null;
}

/** Relationship targets in workbook.xml.rels are relative to `xl/` unless absolute. */
function resolvePartName(target: string): string {
  return target.startsWith("/")
    ? path.posix.normalize(target).slice(1)
    : path.posix.normalize(path.posix.join("xl", target));
}

// ---------------------------------------------------------------------------
// Cell plan

interface CellWrite {
  ref: string;
  column: number;
  value: CellValue;
}

interface RowWrite {
  row: number;
  cells: CellWrite[];
}

const REF_RE = /^([A-Z]{1,3})([1-9][0-9]*)$/;
// XML 1.0 forbids C0 controls other than tab, LF and CR, and U+FFFE/U+FFFF.
const INVALID_XML_CHAR_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/;

function planSheetWrites(
  sheetName: string,
  cells: Readonly<Record<string, CellValue>>,
): RowWrite[] {
  const rows = new Map<number, Map<number, CellWrite>>();
  for (const [rawRef, value] of Object.entries(cells)) {
    const ref = rawRef.toUpperCase();
    const where = `${sheetName}!${rawRef}`;
    const parsed = parseRef(ref);
    if (parsed === null) throw new Error(`Cell ${where}: invalid cell reference`);
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new Error(`Cell ${where}: number must be finite, got ${value}`);
    }
    if (typeof value !== "number" && typeof value !== "string") {
      throw new Error(`Cell ${where}: value must be a string or a number`);
    }
    if (typeof value === "string" && INVALID_XML_CHAR_RE.test(value)) {
      throw new Error(`Cell ${where}: text contains a control character XML cannot hold`);
    }
    const row = rows.get(parsed.row) ?? new Map<number, CellWrite>();
    if (row.has(parsed.column)) throw new Error(`Cell ${where}: written twice`);
    row.set(parsed.column, { ref, column: parsed.column, value });
    rows.set(parsed.row, row);
  }
  return [...rows]
    .sort(([a], [b]) => a - b)
    .map(([row, byColumn]) => ({
      row,
      cells: [...byColumn.values()].sort((a, b) => a.column - b.column),
    }));
}

function parseRef(ref: string): { row: number; column: number } | null {
  const match = REF_RE.exec(ref);
  if (match === null) return null;
  let column = 0;
  for (const letter of match[1]) column = column * 26 + (letter.charCodeAt(0) - 64);
  const row = Number(match[2]);
  return row <= MAX_ROW && column <= MAX_COLUMN ? { row, column } : null;
}

// ---------------------------------------------------------------------------
// Sheet XML, edited in place

interface ElementMatch {
  start: number;
  end: number;
  raw: string;
  attrs: string;
  /** `null` for a self-closing element. */
  body: string | null;
  index: number;
}

const SHEET_DATA_OPEN_RE = /<sheetData\b([^>]*?)(\/?)>/;
const ROW_RE = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g;
const CELL_RE = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
const FORMULA_RE = /<f\b/;
const STALE_VALUE_ATTR_RE = /\s+(?:t|cm|vm)\s*=\s*(?:"[^"]*"|'[^']*')/g;

function patchSheetXml(xml: string, sheetName: string, rows: RowWrite[]): string {
  const open = SHEET_DATA_OPEN_RE.exec(xml);
  if (open === null) throw new Error(`Sheet "${sheetName}" has no <sheetData>`);
  const innerStart = open.index + open[0].length;

  if (open[2] === "/") {
    const inner = rows.map(newRowXml).join("");
    return `${xml.slice(0, open.index)}<sheetData${open[1].trimEnd()}>${inner}</sheetData>${xml.slice(innerStart)}`;
  }

  const innerEnd = xml.indexOf("</sheetData>", innerStart);
  if (innerEnd < 0) throw new Error(`Sheet "${sheetName}" has an unclosed <sheetData>`);
  const inner = xml.slice(innerStart, innerEnd);
  const existing = scanElements(inner, ROW_RE, (attrs) => {
    const r = attributeValue(attrs, "r");
    const row = r === null ? NaN : Number(r);
    if (!Number.isInteger(row)) {
      throw new Error(`Sheet "${sheetName}": <row> without a numeric r attribute is not supported`);
    }
    return row;
  }, `Sheet "${sheetName}": rows`);

  const merged = mergeElements(
    inner,
    existing,
    rows.map((write) => ({ index: write.row, write })),
    (row, { write }) => patchRowXml(row, write, sheetName),
    ({ write }) => newRowXml(write),
  );
  return xml.slice(0, innerStart) + merged + xml.slice(innerEnd);
}

function patchRowXml(row: ElementMatch, write: RowWrite, sheetName: string): string {
  if (row.body === null) {
    return `<row${row.attrs.trimEnd()}>${write.cells.map(newCellXml).join("")}</row>`;
  }
  const existing = scanElements(row.body, CELL_RE, (attrs) => {
    const ref = attributeValue(attrs, "r");
    const parsed = ref === null ? null : parseRef(ref);
    if (parsed === null) {
      throw new Error(`Sheet "${sheetName}" row ${write.row}: <c> without a valid r attribute is not supported`);
    }
    return parsed.column;
  }, `Sheet "${sheetName}" row ${write.row}: cells`);

  const body = mergeElements(
    row.body,
    existing,
    write.cells.map((cell) => ({ index: cell.column, cell })),
    (element, { cell }) => {
      if (element.body !== null && FORMULA_RE.test(element.body)) {
        throw new Error(
          `Cell ${sheetName}!${cell.ref} holds a formula; overwriting it would leave calcChain.xml stale`,
        );
      }
      const attrs = element.attrs.replace(STALE_VALUE_ATTR_RE, "");
      return cellXml(element.body === null ? attrs.trimEnd() : attrs, cell);
    },
    ({ cell }) => newCellXml(cell),
  );
  return `<row${row.attrs}>${body}</row>`;
}

function newRowXml(write: RowWrite): string {
  return `<row r="${write.row}">${write.cells.map(newCellXml).join("")}</row>`;
}

function newCellXml(cell: CellWrite): string {
  return cellXml(` r="${cell.ref}"`, cell);
}

function cellXml(attrs: string, cell: CellWrite): string {
  if (typeof cell.value === "number") {
    return `<c${attrs}><v>${String(cell.value)}</v></c>`;
  }
  return `<c${attrs} t="inlineStr"><is><t xml:space="preserve">${escapeCellText(cell.value)}</t></is></c>`;
}

function scanElements(
  content: string,
  re: RegExp,
  indexOf: (attrs: string) => number,
  label: string,
): ElementMatch[] {
  const elements: ElementMatch[] = [];
  for (const match of content.matchAll(re)) {
    const index = indexOf(match[1]);
    const previous = elements.at(-1);
    if (previous !== undefined && index <= previous.index) {
      throw new Error(`${label} are not in ascending order`);
    }
    elements.push({
      start: match.index,
      end: match.index + match[0].length,
      raw: match[0],
      attrs: match[1],
      body: match[2] ?? null,
      index,
    });
  }
  return elements;
}

/**
 * Walks existing elements and sorted targets together: a target with the same
 * index replaces its element, a missing one is inserted in order. Bytes between
 * and around untouched elements are copied as they are.
 */
function mergeElements<T extends { index: number }>(
  content: string,
  elements: ElementMatch[],
  targets: T[],
  update: (element: ElementMatch, target: T) => string,
  create: (target: T) => string,
): string {
  let out = "";
  let position = 0;
  let next = 0;
  for (const element of elements) {
    out += content.slice(position, element.start);
    while (next < targets.length && targets[next].index < element.index) {
      out += create(targets[next++]);
    }
    if (next < targets.length && targets[next].index === element.index) {
      out += update(element, targets[next++]);
    } else {
      out += element.raw;
    }
    position = element.end;
  }
  while (next < targets.length) out += create(targets[next++]);
  return out + content.slice(position);
}

// ---------------------------------------------------------------------------
// XML text

function attributeValue(attrs: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(?:^|\\s)${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(attrs);
  return match === null ? null : unescapeXml(match[1] ?? match[2]);
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Cell text: line breaks become LF (what Excel stores for Alt+Enter), and a
 * literal `_xHHHH_` is protected because Excel decodes that pattern in `<t>`.
 */
function escapeCellText(text: string): string {
  return escapeXml(
    text.replace(/\r\n?/g, "\n").replace(/_(?=x[0-9A-Fa-f]{4}_)/g, "_x005F_"),
  );
}

function unescapeXml(text: string): string {
  return text.replace(/&(lt|gt|amp|quot|apos|#x[0-9A-Fa-f]+|#[0-9]+);/g, (whole, entity: string) => {
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
