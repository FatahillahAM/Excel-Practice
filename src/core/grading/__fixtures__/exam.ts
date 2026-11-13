import { KEY_TOLERANCE, type Check } from "../../content/checks";
import { SNAPSHOT_VERSION, type ExamSnapshot, type Tip } from "../../content/level-module";
import type { CellReading, WorkbookReading } from "../workbook-reading";

/**
 * A synthetic exam shaped like L01-P1 (4 questions, 20/25/25/30 points, the
 * same checks), small enough to write readings by hand: Data!H2:H3, I2:I3,
 * J2:J3 and O2:P3. Snapshot v2: hint quota 3, one hint and a Tip per question.
 */

const tip = (id: string, shortcut: string): Tip => ({ id, title: `Tip ${id}`, body: `Isi Tip ${id}.`, shortcuts: [shortcut] });

const value: Check = { name: "value_equals_key", tolerance: KEY_TOLERANCE };
const base: Check[] = [{ name: "formula_present" }, { name: "not_hard_coded" }, value];

export const SNAPSHOT: ExamSnapshot = {
  version: SNAPSHOT_VERSION,
  contentVersion: 1,
  scenarioId: "baut-sinar-presisi",
  seed: 42,
  hintQuota: 3,
  questions: [
    { number: 1, prompt: "Total", points: 20, sheet: "Data", range: "H2:H3", checks: base, key: { H2: 1200, H3: 12178.14 * 1.04 }, hints: ["Kalikan dua kolom."], tip: tip("tip-total", "Ctrl+D") },
    {
      number: 2,
      prompt: "Overhead",
      points: 25,
      sheet: "Data",
      range: "I2:I3",
      checks: [...base, { name: "uses_reference", ref: "$L$2" }],
      key: { I2: 500, I3: 750 },
      hints: ["Kunci tarifnya."],
      tip: tip("tip-overhead", "F4"),
    },
    {
      number: 3,
      prompt: "Porsi",
      points: 25,
      sheet: "Data",
      range: "J2:J3",
      checks: [...base, { name: "uses_functions", functions: ["SUM"] }],
      key: { J2: 0.4, J3: 0.6 },
      hints: ["Kunci range SUM."],
      tip: tip("tip-porsi", "Ctrl+Shift+%"),
    },
    {
      number: 4,
      prompt: "Simulasi",
      points: 30,
      sheet: "Data",
      range: "O2:P3",
      checks: [...base, { name: "uses_reference", ref: "$N2" }],
      key: { O2: 10.2, P2: 10.5, O3: "Lini A", P3: 0 },
      hints: ["Pakai referensi campuran."],
      tip: tip("tip-simulasi", "Ctrl+R"),
    },
  ],
};

export const formula = (text: string, cached: CellReading["value"]): CellReading => ({
  formula: text,
  value: cached,
  type:
    cached === null
      ? "empty"
      : typeof cached === "number"
        ? "number"
        : typeof cached === "boolean"
          ? "boolean"
          : "string",
});

export const typed = (cached: number | string): CellReading => ({
  formula: null,
  value: cached,
  type: typeof cached === "number" ? "number" : "string",
});

/**
 * The formula that passes every check of `SNAPSHOT` in an answer cell, by its
 * column: the L01-P1 formulas, filled down (and right in O:P).
 */
export function correctFormula(ref: string): string {
  const [, column, row] = /^([A-Z]+)(\d+)$/.exec(ref)!;
  switch (column) {
    case "H":
      return `=E${row}*G${row}`;
    case "I":
      return `=E${row}*$L$2`;
    case "J":
      return `=E${row}/SUM($E$2:$E$3)`;
    default:
      return `=$N${row}*(1+${column}$1)`;
  }
}

/** Every answer cell holds the formula that passes all five checks, its cached value the key. */
export function correctCells(snapshot: ExamSnapshot = SNAPSHOT): Record<string, CellReading> {
  const cells: Record<string, CellReading> = {};
  for (const question of snapshot.questions) {
    for (const [ref, key] of Object.entries(question.key)) cells[ref] = formula(correctFormula(ref), key);
  }
  return cells;
}

export function readingOf(data: Record<string, CellReading>, extraSheets: WorkbookReading["sheets"] = {}): WorkbookReading {
  return { sheets: { Instructions: {}, Data: data, ...extraSheets }, properties: {}, vbaModuleHashes: null };
}
