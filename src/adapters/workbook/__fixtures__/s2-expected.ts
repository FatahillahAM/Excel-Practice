import type { CellReading, CellType } from "../read.ts";

/**
 * Spike S2 expected reading of `s2-excel2021.xlsm`: the S1 test file with the
 * formulas from `README.md` typed and filled down in Excel 2021, then saved.
 * Formulas are in normalized form; numbers match within `NUMBER_TOLERANCE`.
 */

export const S2_FIXTURE = "src/adapters/workbook/__fixtures__/s2-excel2021.xlsm";
export const NUMBER_TOLERANCE = 1e-9;

export interface ExpectedCell {
  formula: string | null;
  value: number | string | boolean;
  type: CellType;
}

// Data!A1:G11 as written by scripts/spike-s1.ts.
const DATA_HEADER = ["Kode Batch", "Lini", "Shift", "Produk", "Unit Diproduksi", "Unit Cacat", "Biaya per Unit"];
const DATA_ROWS: (string | number)[][] = [
  ["B-2610-01", "Lini A", "Pagi", "Baut M8", 1200, 18, 1250.5],
  ["B-2610-02", "Lini A", "Malam", "Baut M8", 1150, 41, 1250.5],
  ["B-2610-03", "Lini B", "Pagi", "Mur M8", 980, 9, 875.25],
  ["B-2610-04", "Lini B", "Malam", "Mur M8", 1010, 22, 875.25],
  ["B-2610-05", "Lini C", "Pagi", "Ring Plat 10 mm", 2300, 35, 310],
  ["B-2610-06", "Lini C", "Malam", "Ring Plat 10 mm", 2150, 74, 310],
  ["B-2610-07", "Lini A", "Pagi", "Baut M10", 870, 12, 1680.75],
  ["B-2610-08", "Lini A", "Malam", "Baut M10", 905, 31, 1680.75],
  ["B-2610-09", "Lini B", "Pagi", "Mur M10", 760, 6, 1120],
  ["B-2610-10", "Lini C", "Malam", "Ring Plat 12 mm", 1980, 58, 365.5],
];

function value(v: string | number): ExpectedCell {
  return { formula: null, value: v, type: typeof v === "number" ? "number" : "string" };
}

function formula(text: string, v: string | number): ExpectedCell {
  return { formula: text, value: v, type: typeof v === "number" ? "number" : "string" };
}

function buildData(): Record<string, ExpectedCell> {
  const cells: Record<string, ExpectedCell> = {};
  for (const [r, row] of [DATA_HEADER, ...DATA_ROWS].entries()) {
    for (const [c, v] of row.entries()) cells[`${"ABCDEFG"[c]}${r + 1}`] = value(v);
  }
  const produced = DATA_ROWS.map((row) => row[4] as number);
  const defects = DATA_ROWS.map((row) => row[5] as number);
  const totalProduced = produced.reduce((a, b) => a + b, 0);
  for (const [i, units] of produced.entries()) {
    const r = i + 2;
    const rate = defects[i] / units;
    cells[`H${r}`] = formula(`F${r}/E${r}`, rate);
    cells[`I${r}`] = formula(`IF(H${r}>3%,"Periksa","OK")`, rate > 0.03 ? "Periksa" : "OK");
    cells[`J${r}`] = formula(`E${r}/SUM($E$2:$E$11)`, units / totalProduced);
  }
  cells.L2 = formula('XLOOKUP("B-2610-05",A2:A11,F2:F11)', 35);
  cells.L3 = formula('INDEX(F2:F11,MATCH("B-2610-08",A2:A11,0))', 31);
  cells.L4 = formula('IFS(L2>30,"besar",TRUE,"kecil")', "besar");
  cells.L5 = formula('IFERROR(VLOOKUP("X",A2:F11,6,FALSE),"tidak ada")', "tidak ada");
  cells.L6 = formula("UNIQUE(B2:B11)", "Lini A");
  cells.L7 = value("Lini B");
  cells.L8 = value("Lini C");
  return cells;
}

export const s2Expected: Readonly<Record<string, Readonly<Record<string, ExpectedCell>>>> = {
  Instructions: {
    C6: formula('SUMIFS(DATA!E2:E11,DATA!B2:B11,"Lini A")', 4125),
    C7: formula('SUMIFS(DATA!F2:F11,DATA!C2:C11,"Malam")', 226),
    C8: formula('AVERAGEIFS(DATA!G2:G11,DATA!D2:D11,"Baut M8")', 1250.5),
    // Typed with a shifted parenthesis; same value. Excel 2021 saved it as a
    // one-cell dynamic-array formula (`<f t="array" ref="C9">`, `cm="1"`).
    C9: formula("SUM(DATA!F2:F11/SUM(DATA!E2:E11))", 0.022998872604284102),
    C10: value(226),
  },
  Data: buildData(),
};

/** Why `actual` differs from `expected`, or `null` when it matches. */
export function cellMismatch(actual: CellReading | undefined, expected: ExpectedCell): string | null {
  if (actual === undefined) return "cell is empty or missing";
  const problems: string[] = [];
  if (actual.formula !== expected.formula) {
    problems.push(`formula ${JSON.stringify(actual.formula)} ≠ ${JSON.stringify(expected.formula)}`);
  }
  if (actual.type !== expected.type) problems.push(`type ${actual.type} ≠ ${expected.type}`);
  const sameValue =
    typeof actual.value === "number" && typeof expected.value === "number"
      ? Math.abs(actual.value - expected.value) <= NUMBER_TOLERANCE
      : actual.value === expected.value;
  if (!sameValue) problems.push(`value ${JSON.stringify(actual.value)} ≠ ${JSON.stringify(expected.value)}`);
  return problems.length === 0 ? null : problems.join("; ");
}
