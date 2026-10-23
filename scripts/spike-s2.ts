/**
 * Spike S2: read the S1 file that Excel 2021 saved with the fixture formulas
 * (src/adapters/workbook/__fixtures__/README.md), print every fixture cell with
 * its normalized formula, value, type and whether it matches the expected
 * table, cross-check every cell against openpyxl, and print the saved file's
 * vbaProject.bin hash against the template registry.
 *
 *   node scripts/spike-s2.ts [--file <xlsm>] [--skip-openpyxl]
 */
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { cellMismatch, NUMBER_TOLERANCE, S2_FIXTURE, s2Expected } from "../src/adapters/workbook/__fixtures__/s2-expected.ts";
import { normalizeFormula } from "../src/adapters/workbook/formula.ts";
import { readWorkbook, type CellReading, type WorkbookReading } from "../src/adapters/workbook/read.ts";
import { CURRENT_TEMPLATE_VERSION, templates } from "../src/adapters/workbook/templates.ts";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

/** Prints every cell with a formula or a value as JSON: `{ sheet: { ref: { formula, value } } }`. */
const OPENPYXL_DUMP = String.raw`
import datetime, json, sys
from openpyxl import load_workbook
path = sys.argv[1]
formulas = load_workbook(path, data_only=False)
values = load_workbook(path, data_only=True)
out = {}
for ws in formulas.worksheets:
    if not hasattr(ws, "iter_rows"):
        continue
    cached = values[ws.title]
    cells = {}
    for row in ws.iter_rows():
        for cell in row:
            formula = getattr(cell.value, "text", cell.value) if cell.data_type == "f" else None
            value = cached[cell.coordinate].value
            if isinstance(value, (datetime.datetime, datetime.date, datetime.time, datetime.timedelta)):
                value = "(date) " + str(value)
            if formula is None and value is None:
                continue
            cells[cell.coordinate] = {"formula": formula, "value": value}
    out[ws.title] = cells
json.dump(out, sys.stdout)
`;

const { values: args } = parseArgs({
  options: {
    file: { type: "string", default: path.join(repoRoot, S2_FIXTURE) },
    "skip-openpyxl": { type: "boolean", default: false },
  },
});

const filePath = path.resolve(args.file);
const bytes = await readFile(filePath).catch((error: NodeJS.ErrnoException) => {
  if (error.code === "ENOENT") {
    fail(`File not found: ${filePath}\nCreate it with src/adapters/workbook/__fixtures__/README.md.`);
  }
  throw error;
});
const reading = await readWorkbook(bytes);
let failed = false;

console.log(`file: ${filePath}`);
console.log("");
console.log("Fixture cells (formula normalized; numbers within 1e-9):");
const rows: string[][] = [["cell", "formula", "value", "type", "result"]];
const expectedRefs = new Set<string>();
for (const [sheet, cells] of Object.entries(s2Expected)) {
  for (const [ref, expected] of Object.entries(cells)) {
    expectedRefs.add(`${sheet}!${ref}`);
    const actual = reading.sheets[sheet]?.[ref];
    const problem = cellMismatch(actual, expected);
    if (problem !== null) failed = true;
    rows.push([
      `${sheet}!${ref}`,
      actual?.formula ?? "-",
      actual === undefined ? "-" : JSON.stringify(actual.value),
      actual?.type ?? "-",
      problem === null ? "match" : `MISMATCH: ${problem}`,
    ]);
  }
}
printTable(rows);

const extras = Object.entries(reading.sheets).flatMap(([sheet, cells]) =>
  Object.keys(cells)
    .map((ref) => `${sheet}!${ref}`)
    .filter((where) => !expectedRefs.has(where)),
);
console.log("");
console.log(`Other cells in the file (not checked): ${extras.length === 0 ? "none" : extras.join(", ")}`);

console.log("");
console.log("Custom properties:");
for (const [name, value] of Object.entries(reading.properties)) console.log(`  ${name}: ${value}`);

console.log("");
const registered = templates[CURRENT_TEMPLATE_VERSION].vbaProjectSha256;
console.log(`vbaProject.bin saved file sha256:   ${reading.vbaProjectSha256 ?? "(no vbaProject.bin)"}`);
console.log(`vbaProject.bin registry v${CURRENT_TEMPLATE_VERSION} sha256: ${registered}`);
console.log(
  `vbaProject.bin after the Excel save: ${reading.vbaProjectSha256 === registered ? "unchanged (same as registry)" : "CHANGED (differs from registry)"} -- observation for S3, not a pass criterion`,
);

console.log("");
if (args["skip-openpyxl"]) {
  console.log("openpyxl cross-check: skipped (--skip-openpyxl)");
} else {
  const problems = crossCheckOpenpyxl(filePath, reading);
  if (problems.length > 0) failed = true;
  for (const problem of problems) console.log(`  MISMATCH ${problem}`);
}

console.log("");
console.log(failed ? "spike-s2: FAILED" : "spike-s2: all fixture cells match");
process.exit(failed ? 1 : 0);

// ---------------------------------------------------------------------------

/**
 * Reads the file with openpyxl (which expands shared formulas itself) and
 * compares every cell either reader sees: formula after normalization, and
 * cached value.
 */
function crossCheckOpenpyxl(file: string, ours: WorkbookReading): string[] {
  const result = spawnSync("python3", ["-I", "-c", OPENPYXL_DUMP, file], { encoding: "utf8", maxBuffer: 64 << 20 });
  if (result.error !== undefined || result.status !== 0) {
    fail(`openpyxl cross-check could not run (use --skip-openpyxl to skip): ${result.error?.message ?? result.stderr}`);
  }
  const theirs = JSON.parse(result.stdout) as Record<string, Record<string, { formula: string | null; value: unknown }>>;

  const problems: string[] = [];
  let compared = 0;
  for (const sheet of new Set([...Object.keys(ours.sheets), ...Object.keys(theirs)])) {
    const oursCells: Record<string, CellReading> = ours.sheets[sheet] ?? {};
    const theirsCells = theirs[sheet] ?? {};
    for (const ref of new Set([...Object.keys(oursCells), ...Object.keys(theirsCells)])) {
      compared += 1;
      const a = oursCells[ref];
      const b = theirsCells[ref];
      const formulaA = a?.formula ?? null;
      const formulaB = b?.formula == null ? null : normalizeFormula(b.formula);
      const valueA = a?.value ?? null;
      const valueB = b?.value ?? null;
      const sameValue =
        typeof valueA === "number" && typeof valueB === "number"
          ? Math.abs(valueA - valueB) <= NUMBER_TOLERANCE
          : valueA === valueB;
      if (formulaA !== formulaB || !sameValue) {
        problems.push(
          `${sheet}!${ref}: readWorkbook ${JSON.stringify([formulaA, valueA])} vs openpyxl ${JSON.stringify([formulaB, valueB])}`,
        );
      }
    }
  }
  console.log(
    `openpyxl cross-check: ${compared} cells compared, ${problems.length === 0 ? "all match" : `${problems.length} differ`}`,
  );
  return problems;
}

function printTable(table: string[][]): void {
  const widths = table[0].map((_, column) => Math.max(...table.map((row) => row[column].length)));
  for (const row of table) {
    console.log(`  ${row.map((cell, column) => (column === row.length - 1 ? cell : cell.padEnd(widths[column]))).join("  ")}`);
  }
}

function fail(message: string): never {
  console.error(`spike-s2: ${message}`);
  process.exit(1);
}
