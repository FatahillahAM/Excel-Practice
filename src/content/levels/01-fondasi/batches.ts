import { cellRef } from "@/core/content/a1";
import type { ExamCellValue, Tip } from "@/core/content/level-module";
import type { Random } from "@/core/content/random";
import { DATA_HEADERS, MAX_BATCHES, MIN_BATCHES } from "./practice-1";
import type { FondasiScenario } from "./scenarios";

/**
 * The production batches L01-P2..P4 draw (the same Data A1:G{n+1} shape as
 * L01-P1 and the Test, n = 12–20), and small helpers those practices share.
 * L01-P1 and the Test keep their own draws: their committed Excel fixtures
 * depend on them.
 */

export interface Batch {
  code: string;
  line: string;
  shift: string;
  product: string;
  units: number;
  defects: number;
  cost: number;
}

/** Unit Cacat is at most this share of Unit Diproduksi. */
const MAX_DEFECT_SHARE = 0.04;
/** Redraws of a repeated Unit Diproduksi before a repeat is kept (`distinctUnits`). */
const MAX_REDRAWS = 50;

export const FINISH_LINE = "Kalau sudah selesai, klik Finish. File tidak perlu disimpan dulu: Finish mengirim salinannya.";

/** A fresh copy (mutable `shortcuts`) of a constant Tip. */
export const tipOf = (tip: Tip): Tip => ({ ...tip, shortcuts: [...tip.shortcuts] });

/**
 * n batches in draw order: n, the products (shuffled, each with its cost),
 * then per row line, shift, product, units, defects. With `distinctUnits`, a
 * Unit Diproduksi already drawn is drawn again (so a sort by it has no ties).
 * Draw order is part of the content: changing it changes every exam.
 */
export function drawBatches(random: Random, scenario: FondasiScenario, options: { distinctUnits?: boolean } = {}): Batch[] {
  const n = random.int(MIN_BATCHES, MAX_BATCHES);
  const products = random.shuffle(scenario.products).map((product) => ({
    name: product.name,
    units: product.units,
    cost: random.int(Math.round(product.cost.min * 100), Math.round(product.cost.max * 100)) / 100,
  }));
  const seen = new Set<number>();
  return Array.from({ length: n }, (_, i) => {
    const line = random.pick(scenario.lines);
    const shift = random.pick(scenario.shifts);
    const product = random.pick(products);
    let units = random.int(product.units.min, product.units.max);
    for (let redraw = 0; options.distinctUnits === true && seen.has(units) && redraw < MAX_REDRAWS; redraw++) {
      units = random.int(product.units.min, product.units.max);
    }
    seen.add(units);
    return {
      code: `${scenario.batchPrefix}-${String(i + 1).padStart(2, "0")}`,
      line,
      shift,
      product: product.name,
      units,
      defects: random.int(0, Math.floor(units * MAX_DEFECT_SHARE)),
      cost: product.cost,
    };
  });
}

/** A batch's Data cells A…G, in `DATA_HEADERS` order. */
export const batchValues = (batch: Batch): ExamCellValue[] => [
  batch.code,
  batch.line,
  batch.shift,
  batch.product,
  batch.units,
  batch.defects,
  batch.cost,
];

/** Data A1:G{n+1}: the headers, then one row per batch. */
export function batchCells(batches: readonly Batch[]): Record<string, ExamCellValue> {
  const data: Record<string, ExamCellValue> = {};
  DATA_HEADERS.forEach((header, c) => (data[cellRef(c + 1, 1)] = header));
  batches.forEach((batch, i) => batchValues(batch).forEach((value, c) => (data[cellRef(c + 1, i + 2)] = value)));
  return data;
}
