import JSZip from "jszip";
import { columnIndex, columnLetters } from "@/core/grading/formula";
import { readSheetParts } from "../template-patch";

/**
 * Test only: writes answer cells into a sheet part of a workbook as Excel
 * saves them, so the golden fixtures exercise `readWorkbook` on every form a
 * graded cell can take. Cells go into their rows in column order (rows that
 * do not exist yet are inserted in row order); a cell that already exists is
 * refused. Forms:
 *
 * - `<f>` with a cached `<v>` (a number, or text as `t="str"`);
 * - Excel's shared formula: the master `<f t="shared" ref="H2:H13" si="0">`
 *   with the text, the other cells `<f t="shared" si="0"/>` (text empty);
 * - an error value: `t="e"` with the code in `<v>`;
 * - `<f>` without `<v>`: a formula Excel has not calculated;
 * - no `<f>`: a value typed in.
 */

export type FixtureValue = number | string | { error: string } | null;

export interface FixtureCell {
  /** Formula text as Excel stores it (no leading `=`); omit for a shared child or a typed value. */
  formula?: string;
  /** Shared formula: `ref` (the master's range) only on the master. */
  shared?: { si: number; ref?: string };
  /** Cached value; `null` writes no `<v>` (uncalculated formula). */
  value: FixtureValue;
}

/** Cells of one sheet by A1 reference. */
export type FixtureCells = Readonly<Record<string, FixtureCell>>;

export const typedValue = (value: number | string): FixtureCell => ({ value });
export const formulaCell = (formula: string, value: FixtureValue): FixtureCell => ({ formula, value });

/**
 * One formula filled over `range` (`H2:H13`, `O2:R5`) as Excel saves a fill:
 * the master (top-left) holds the text, every cell a cached value from `valueOf`.
 */
export function sharedFill(range: string, si: number, formula: string, valueOf: (ref: string) => FixtureValue): Record<string, FixtureCell> {
  const [first, last = first] = range.split(":");
  const start = splitRef(first);
  const end = splitRef(last);
  const cells: Record<string, FixtureCell> = {};
  for (let row = start.row; row <= end.row; row++) {
    for (let column = start.column; column <= end.column; column++) {
      const ref = `${columnLetters(column)}${row}`;
      const master = row === start.row && column === start.column;
      cells[ref] = master
        ? { formula, shared: { si, ref: range }, value: valueOf(ref) }
        : { shared: { si }, value: valueOf(ref) };
    }
  }
  return cells;
}

export async function writeFormulaCells(bytes: Uint8Array, sheetName: string, cells: FixtureCells): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(bytes);
  const part = (await readSheetParts(zip)).get(sheetName);
  if (part === undefined) throw new Error(`writeFormulaCells: no sheet ${sheetName}`);
  const xml = await zip.file(part)!.async("string");
  zip.file(part, insertCells(xml, cells));
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

// ---------------------------------------------------------------------------

const ROW_RE = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g;
const CELL_RE = /<c\b([^>]*?)(?:\/>|>[\s\S]*?<\/c>)/g;

function insertCells(xml: string, cells: FixtureCells): string {
  const byRow = new Map<number, { column: number; xml: string }[]>();
  for (const [ref, cell] of Object.entries(cells)) {
    const { row, column } = splitRef(ref);
    const list = byRow.get(row) ?? [];
    list.push({ column, xml: cellXml(ref, cell) });
    byRow.set(row, list);
  }
  for (const list of byRow.values()) list.sort((a, b) => a.column - b.column);

  xml = xml.replace(/<sheetData\b([^>]*?)\s*\/>/, "<sheetData$1></sheetData>");
  const open = xml.indexOf("<sheetData");
  const close = xml.indexOf("</sheetData>");
  if (open < 0 || close < 0) throw new Error("writeFormulaCells: no <sheetData>");
  const head = xml.slice(0, xml.indexOf(">", open) + 1);
  const inner = xml.slice(head.length, close);

  let out = "";
  let position = 0;
  const pending = [...byRow.keys()].sort((a, b) => a - b);
  const newRow = (row: number) => `<row r="${row}">${byRow.get(row)!.map((cell) => cell.xml).join("")}</row>`;
  for (const match of inner.matchAll(ROW_RE)) {
    const row = Number(attr(match[1], "r"));
    out += inner.slice(position, match.index);
    while (pending.length > 0 && pending[0] < row) out += newRow(pending.shift()!);
    if (pending[0] === row) {
      pending.shift();
      out += `<row${match[1].replace(/\s*\/$/, "")}>${mergeRow(match[2] ?? "", byRow.get(row)!, row)}</row>`;
    } else {
      out += match[0];
    }
    position = match.index + match[0].length;
  }
  out += inner.slice(position);
  for (const row of pending) out += newRow(row);
  return head + out + xml.slice(close);
}

function mergeRow(body: string, added: { column: number; xml: string }[], row: number): string {
  let out = "";
  let position = 0;
  let next = 0;
  for (const match of body.matchAll(CELL_RE)) {
    const column = splitRef(attr(match[1], "r")!).column;
    out += body.slice(position, match.index);
    while (next < added.length && added[next].column < column) out += added[next++].xml;
    if (next < added.length && added[next].column === column) throw new Error(`writeFormulaCells: row ${row} already has column ${column}`);
    out += match[0];
    position = match.index + match[0].length;
  }
  out += body.slice(position);
  while (next < added.length) out += added[next++].xml;
  return out;
}

function cellXml(ref: string, cell: FixtureCell): string {
  const { value } = cell;
  const hasFormula = cell.formula !== undefined || cell.shared !== undefined;
  let type = "";
  if (typeof value === "object" && value !== null) type = ' t="e"';
  else if (typeof value === "string") type = hasFormula ? ' t="str"' : ' t="inlineStr"';
  let f = "";
  if (hasFormula) {
    const shared = cell.shared === undefined ? "" : ` t="shared"${cell.shared.ref === undefined ? "" : ` ref="${cell.shared.ref}"`} si="${cell.shared.si}"`;
    f = cell.formula === undefined ? `<f${shared}/>` : `<f${shared}>${escapeXml(cell.formula)}</f>`;
  }
  let v = "";
  if (typeof value === "number") v = `<v>${String(value)}</v>`;
  else if (typeof value === "string") v = hasFormula ? `<v>${escapeXml(value)}</v>` : `<is><t>${escapeXml(value)}</t></is>`;
  else if (value !== null) v = `<v>${escapeXml(value.error)}</v>`;
  return `<c r="${ref}"${type}>${f}${v}</c>`;
}

function splitRef(ref: string): { row: number; column: number } {
  const match = /^([A-Z]{1,3})([1-9][0-9]*)$/.exec(ref);
  if (match === null) throw new Error(`writeFormulaCells: bad reference ${ref}`);
  return { column: columnIndex(match[1]), row: Number(match[2]) };
}

function attr(attrs: string, name: string): string | null {
  const match = new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs);
  return match === null ? null : match[1];
}

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
