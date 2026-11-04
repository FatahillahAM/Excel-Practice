/** A1 references without `$`: column letters ↔ numbers, and the cells of a range. */

export const CELL_RE = /^([A-Z]{1,3})([1-9]\d{0,6})$/;
export const RANGE_RE = /^[A-Z]{1,3}[1-9]\d{0,6}(:[A-Z]{1,3}[1-9]\d{0,6})?$/;

/** Excel's last column (XFD) and row. */
const MAX_COLUMN = 16384;
const MAX_ROW = 1048576;

/** `A` → 1, `Z` → 26, `AA` → 27. */
export function columnNumber(letters: string): number {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

/** 1 → `A`, 27 → `AA`. */
export function columnLetters(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > MAX_COLUMN) throw new Error(`No column ${n}`);
  let letters = "";
  for (let rest = n; rest > 0; rest = Math.floor((rest - 1) / 26)) {
    letters = String.fromCharCode(65 + ((rest - 1) % 26)) + letters;
  }
  return letters;
}

export function cellRef(column: number, row: number): string {
  return `${columnLetters(column)}${row}`;
}

/** `{ column, row }` of an A1 cell, or `null` when it is not one inside Excel's grid. */
export function parseCell(ref: string): { column: number; row: number } | null {
  const match = CELL_RE.exec(ref);
  if (!match) return null;
  const column = columnNumber(match[1]);
  const row = Number(match[2]);
  return column <= MAX_COLUMN && row <= MAX_ROW ? { column, row } : null;
}

/**
 * The cells of `H2:H13` or `O2:R6` (or one cell), row by row, left to right;
 * `null` when the range is malformed, reversed, or larger than `maxCells`.
 */
export function expandRange(range: string, maxCells = 10_000): string[] | null {
  if (!RANGE_RE.test(range)) return null;
  const [startRef, endRef = startRef] = range.split(":");
  const start = parseCell(startRef);
  const end = parseCell(endRef);
  if (!start || !end || end.column < start.column || end.row < start.row) return null;
  const count = (end.column - start.column + 1) * (end.row - start.row + 1);
  if (count > maxCells) return null;
  const cells: string[] = [];
  for (let row = start.row; row <= end.row; row++) {
    for (let column = start.column; column <= end.column; column++) cells.push(cellRef(column, row));
  }
  return cells;
}
