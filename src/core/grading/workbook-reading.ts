/**
 * `WorkbookReading` (AD-4): what the WorkbookIO adapter (`src/adapters/workbook/read.ts`)
 * reads from a saved workbook, and the only view of a submission `grade()` gets
 * (AD-3). The adapter produces it; core never touches workbook bytes.
 */

export type CellType = "number" | "string" | "boolean" | "error" | "empty";

export interface CellReading {
  /** Normalized formula text (shared formulas expanded), or `null` for a value typed in or spilled into the cell. */
  formula: string | null;
  /** Cached value; an error is its code (`#N/A`); `null` when the cell holds a formula Excel has not calculated. */
  value: number | string | boolean | null;
  type: CellType;
  /**
   * `true` when the cell lies in the range of an array formula over more than
   * one cell (a Ctrl+Shift+Enter array or a spilled dynamic array): the anchor
   * holds the formula, the other cells only its values. Absent otherwise.
   */
  array?: true;
}

export interface WorkbookReading {
  /** Per sheet name, per A1 reference (`H3`): only cells with a formula or a value. */
  sheets: Record<string, Record<string, CellReading>>;
  /** Custom document properties as text. */
  properties: Record<string, string>;
  /**
   * Per VBA module (MODULENAMEUNICODE), lowercase hex SHA-256 of its normalized source (AD-4);
   * `null` when `xl/vbaProject.bin` is missing or is not a readable VBA project.
   */
  vbaModuleHashes: Readonly<Record<string, string>> | null;
}
