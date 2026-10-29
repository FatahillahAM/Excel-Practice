/**
 * Formula text for WorkbookIO reading (AD-4): the normal form graders compare,
 * and the reference shift that expands Excel's shared formulas.
 *
 * Both work on a small tokenizer that knows what must never change: string
 * literals ("…"), quoted sheet names ('…'), bracketed parts (structured
 * references, external workbook indexes) and function or defined names that
 * look like cell references (`LOG10(`).
 */

const MAX_ROW = 1_048_576;
const MAX_COLUMN = 16_384;

type TokenKind =
  | "string"
  | "quoted"
  | "bracket"
  | "error"
  | "space"
  | "cells"
  | "columns"
  | "rows"
  | "name"
  | "number"
  | "other";

interface Token {
  kind: TokenKind;
  text: string;
  /** For `cells` (one cell or `A1:B2`), `columns` (`A:C`) and `rows` (`1:3`). */
  parts?: RefPart[];
}

interface RefPart {
  absolute: boolean;
  /** 1-based column (`cells`, `columns`) or row (`rows`). */
  index: number;
  /** Only for `cells`. */
  row?: { absolute: boolean; index: number };
}

/**
 * The form formulas are compared in: no leading `=`; `_xlfn.`, `_xlws.` and
 * `_xlpm.` prefixes dropped; upper case and no whitespace outside string
 * literals. Inside quoted sheet names and brackets letters are upper-cased but
 * spaces kept, because they are part of the name.
 */
export function normalizeFormula(text: string): string {
  const body = text.replace(/^[ \t\r\n]*=/, "");
  let out = "";
  for (const token of tokenize(body)) {
    switch (token.kind) {
      case "string":
        out += token.text;
        break;
      case "space":
        break;
      case "name":
        out += token.text.replace(FUNCTION_PREFIX_RE, "").toUpperCase();
        break;
      default:
        out += token.text.toUpperCase();
    }
  }
  return out;
}

/**
 * Moves every relative cell, column and row reference by `dRow` rows and `dCol`
 * columns, as Excel does when it copies a formula; `$` parts stay put. A
 * reference pushed off the sheet becomes `#REF!`. Strings, quoted sheet names,
 * brackets and names are copied unchanged.
 */
export function shiftFormula(text: string, dRow: number, dCol: number): string {
  if (!Number.isInteger(dRow) || !Number.isInteger(dCol)) {
    throw new Error(`shiftFormula: offsets must be integers, got ${dRow}, ${dCol}`);
  }
  let out = "";
  for (const token of tokenize(text)) {
    out += token.parts === undefined ? token.text : shiftReference(token, dRow, dCol);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Shifting

function shiftReference(token: Token, dRow: number, dCol: number): string {
  const parts = token.parts!;
  const texts: string[] = [];
  for (const part of parts) {
    if (token.kind === "rows") {
      const row = part.absolute ? part.index : part.index + dRow;
      if (row < 1 || row > MAX_ROW) return "#REF!";
      texts.push(`${part.absolute ? "$" : ""}${row}`);
      continue;
    }
    const column = part.absolute ? part.index : part.index + dCol;
    if (column < 1 || column > MAX_COLUMN) return "#REF!";
    let text = `${part.absolute ? "$" : ""}${columnLetters(column)}`;
    if (part.row !== undefined) {
      const row = part.row.absolute ? part.row.index : part.row.index + dRow;
      if (row < 1 || row > MAX_ROW) return "#REF!";
      text += `${part.row.absolute ? "$" : ""}${row}`;
    }
    texts.push(text);
  }
  return texts.join(":");
}

export function columnLetters(column: number): string {
  let letters = "";
  for (let n = column; n > 0; n = Math.floor((n - 1) / 26)) {
    letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
  }
  return letters;
}

export function columnIndex(letters: string): number {
  let column = 0;
  for (const letter of letters.toUpperCase()) column = column * 26 + (letter.charCodeAt(0) - 64);
  return column;
}

// ---------------------------------------------------------------------------
// Tokenizer

const FUNCTION_PREFIX_RE = /^(?:_xl(?:fn|ws|pm)\.)+/i;

const IDENT_CHAR_RE = /[A-Za-z0-9_.\\?\u0080-￿]/;
const IDENT_RE = /[A-Za-z_\\\u0080-￿][A-Za-z0-9_.\\?\u0080-￿]*/y;
const NUMBER_RE = /(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?/y;
const SPACE_RE = /[ \t\r\n]+/y;
const ERROR_RE =
  /#(?:NULL!|DIV\/0!|VALUE!|REF!|NAME\?|NUM!|N\/A|GETTING_DATA|SPILL!|CALC!|FIELD!|BLOCKED!|CONNECT!|BUSY!|UNKNOWN!)/iy;
const CELL_RE = /(\$?)([A-Za-z]{1,3})(\$?)([0-9]{1,7})/y;
const COLUMNS_RE = /(\$?)([A-Za-z]{1,3}):(\$?)([A-Za-z]{1,3})/y;
const ROWS_RE = /(\$?)([0-9]{1,7}):(\$?)([0-9]{1,7})/y;
/** After a reference: anything that would make it part of a name, a function call or a sheet name. */
const REF_FOLLOWER_RE = /[A-Za-z0-9_.\\?(!\u0080-￿]/;

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const token = readToken(text, i);
    tokens.push(token);
    i += token.text.length;
  }
  return tokens;
}

function readToken(text: string, i: number): Token {
  const char = text[i];
  if (char === '"') return { kind: "string", text: readQuoted(text, i, '"') };
  if (char === "'") return { kind: "quoted", text: readQuoted(text, i, "'") };
  if (char === "[") return { kind: "bracket", text: readBracket(text, i) };
  if (char === "#") {
    const error = matchAt(ERROR_RE, text, i);
    return error === null ? { kind: "other", text: char } : { kind: "error", text: error[0] };
  }
  const space = matchAt(SPACE_RE, text, i);
  if (space !== null) return { kind: "space", text: space[0] };

  if (i === 0 || !IDENT_CHAR_RE.test(text[i - 1])) {
    const reference = readReference(text, i);
    if (reference !== null) return reference;
  }

  const name = matchAt(IDENT_RE, text, i);
  if (name !== null) return { kind: "name", text: name[0] };
  const number = matchAt(NUMBER_RE, text, i);
  if (number !== null) return { kind: "number", text: number[0] };
  return { kind: "other", text: char };
}

function readReference(text: string, i: number): Token | null {
  const columns = matchAt(COLUMNS_RE, text, i);
  if (columns !== null && endsReference(text, i + columns[0].length)) {
    const parts = [columnPart(columns[1], columns[2]), columnPart(columns[3], columns[4])];
    if (parts.every((part) => part.index <= MAX_COLUMN)) {
      return { kind: "columns", text: columns[0], parts };
    }
  }

  const rows = matchAt(ROWS_RE, text, i);
  if (rows !== null && endsReference(text, i + rows[0].length)) {
    const parts = [rowPart(rows[1], rows[2]), rowPart(rows[3], rows[4])];
    if (parts.every((part) => part.index >= 1 && part.index <= MAX_ROW)) {
      return { kind: "rows", text: rows[0], parts };
    }
  }

  const first = readCell(text, i);
  if (first === null) return null;
  let end = i + first.text.length;
  const parts = [first.part];
  if (text[end] === ":") {
    const second = readCell(text, end + 1);
    if (second !== null) {
      parts.push(second.part);
      end += 1 + second.text.length;
    }
  }
  return { kind: "cells", text: text.slice(i, end), parts };
}

function readCell(text: string, i: number): { text: string; part: RefPart } | null {
  const cell = matchAt(CELL_RE, text, i);
  if (cell === null || !endsReference(text, i + cell[0].length)) return null;
  const part = columnPart(cell[1], cell[2]);
  const row = Number(cell[4]);
  if (part.index > MAX_COLUMN || row < 1 || row > MAX_ROW) return null;
  return { text: cell[0], part: { ...part, row: { absolute: cell[3] === "$", index: row } } };
}

function columnPart(dollar: string, letters: string): RefPart {
  return { absolute: dollar === "$", index: columnIndex(letters) };
}

function rowPart(dollar: string, digits: string): RefPart {
  return { absolute: dollar === "$", index: Number(digits) };
}

function endsReference(text: string, end: number): boolean {
  return end >= text.length || !REF_FOLLOWER_RE.test(text[end]);
}

/** A run quoted with `quote`, where a doubled quote is an escaped one. Unclosed runs to the end. */
function readQuoted(text: string, start: number, quote: string): string {
  let i = start + 1;
  while (i < text.length) {
    if (text[i] === quote) {
      if (text[i + 1] === quote) {
        i += 2;
        continue;
      }
      return text.slice(start, i + 1);
    }
    i += 1;
  }
  return text.slice(start);
}

/** A bracketed run with nesting; `'` escapes the next character (structured references). */
function readBracket(text: string, start: number): string {
  let depth = 0;
  let i = start;
  while (i < text.length) {
    const char = text[i];
    if (char === "'") {
      i += 2;
      continue;
    }
    if (char === "[") depth += 1;
    if (char === "]") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
    i += 1;
  }
  return text.slice(start);
}

function matchAt(re: RegExp, text: string, i: number): RegExpExecArray | null {
  re.lastIndex = i;
  return re.exec(text);
}
