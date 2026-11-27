/**
 * `WorkbookReading` (AD-4): what the WorkbookIO adapter (`src/adapters/workbook/read.ts`)
 * reads from a saved workbook, and the only view of a submission `grade()` gets
 * (AD-3). The adapter produces it; core never touches workbook bytes.
 */

export type CellType = "number" | "string" | "boolean" | "error" | "empty";

export interface CellReading {
  /** Normalized formula text (shared formulas expanded), or `null` for a value typed in or spilled into the cell. */
  formula: string | null;
  /**
   * Cached value; an error is its code (`#N/A`); `null` when the cell holds a
   * formula Excel has not calculated, or (with `type: "string"`) a formula's
   * text result saved with an empty cache (`t="str"`, `<v></v>`).
   */
  value: number | string | boolean | null;
  type: CellType;
  /**
   * `true` when the cell lies in the range of an array formula over more than
   * one cell (a Ctrl+Shift+Enter array or a spilled dynamic array): the anchor
   * holds the formula, the other cells only its values. Absent otherwise.
   */
  array?: true;
  /**
   * Only on the anchor (top-left cell) of such an array formula: the range its
   * values fill, A1 without `$` (`I2:I13`), as Excel saved it. A spilled
   * dynamic array's anchor carries the range of its last calculation.
   */
  arrayRef?: string;
}

/**
 * One Excel Table (ListObject) on a sheet (`xl/tables/tableN.xml`, linked from
 * the sheet's `<tableParts>`). Only its structure: no styling, no AutoFilter
 * state, no sort state.
 */
export interface TableReading {
  /** `displayName` (what formulas refer to: `Table1`), else `name`. */
  name: string;
  /** The Table's range, header row included and Total Row left out, A1 without `$` (`A1:G13`). */
  ref: string;
  /** Whether the Table has a Total Row below `ref` (`totalsRowCount` > 0). Absent in readings built by hand: none. */
  totalsRow?: boolean;
  /** Whether the Table has its header row on (`headerRowCount` ≠ 0). */
  headerRow: boolean;
  /** Column names in order (`tableColumn@name`): the header cells' text when the header row is on. */
  columns: string[];
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
  /**
   * Per sheet name, the Excel Tables on it, in `<tableParts>` order; a sheet
   * without Tables has none listed. A Table part that is missing or not
   * readable is left out (it counts as no Table). Absent in readings built by
   * hand (tests): no Tables.
   */
  tables?: Record<string, TableReading[]>;
}
