import { cellRef } from "@/core/content/a1";
import { KEY_TOLERANCE, type Check } from "@/core/content/checks";
import {
  DATA_SHEET,
  INSTRUCTIONS_CELLS,
  INSTRUCTIONS_SHEET,
  type ExamCellValue,
  type ExamQuestion,
  type GeneratedExam,
  type Tip,
} from "@/core/content/level-module";
import type { Random } from "@/core/content/random";
import type { LogikaScenario } from "./scenarios";

/**
 * What every Level 2 item shares: the QC batches it draws (Data A1:G{n+1},
 * n = 12–20), the limits drawn from them (so both outcomes of each IF occur),
 * the parameter block N2:O6 (label in N, value in O), the base checks and the
 * Instructions layout. Draw order is part of the content: changing it changes
 * every exam (bump contentVersion).
 */

export const DATA_HEADERS = ["Kode Batch", "Lini", "Shift", "Produk", "Unit Diproduksi", "Unit Cacat", "Downtime (menit)"] as const;

export const MIN_BATCHES = 12;
export const MAX_BATCHES = 20;
/** Unit Cacat is at most this share of Unit Diproduksi. */
const MAX_DEFECT_SHARE = 0.03;
/** The share of batches drawn with no defect (Unit Cacat 0), and with no downtime (0 menit). */
const ZERO_DEFECT_CHANCE = 0.25;
const ZERO_DOWNTIME_CHANCE = 0.25;

export const FINISH_LINE = "Kalau sudah selesai, klik Finish. File tidak perlu disimpan dulu: Finish mengirim salinannya.";

/** The parameter labels (column N); the values sit next to them in column O. */
export const PARAM_LABELS = {
  target: "Target Unit",
  defects: "Batas Unit Cacat",
  downtime: "Batas Downtime (menit)",
  shift: "Shift Dipantau",
  line: "Lini Audit",
  downtimeLow: "Batas Downtime Sedang (menit)",
  ratio: "Batas Cacat per Menit",
} as const;

export interface Batch {
  code: string;
  line: string;
  shift: string;
  product: string;
  units: number;
  defects: number;
  downtime: number;
}

export const valueCheck: Check = { name: "value_equals_key", tolerance: KEY_TOLERANCE };
export const BASE_CHECKS: Check[] = [{ name: "formula_present" }, { name: "not_hard_coded" }, valueCheck];
export const usesFunctions = (...functions: string[]): Check => ({ name: "uses_functions", functions });
export const usesReference = (ref: string): Check => ({ name: "uses_reference", ref });

/** A fresh copy (mutable `shortcuts`) of a constant Tip. */
export const tipOf = (tip: Tip): Tip => ({ ...tip, shortcuts: [...tip.shortcuts] });

/** n batches in draw order: n, then per row line, shift, product, units, defects, downtime. */
export function drawBatches(random: Random, scenario: LogikaScenario): Batch[] {
  const n = random.int(MIN_BATCHES, MAX_BATCHES);
  return Array.from({ length: n }, (_, i) => {
    const line = random.pick(scenario.lines);
    const shift = random.pick(scenario.shifts);
    const product = random.pick(scenario.products);
    const units = random.int(product.units.min, product.units.max);
    const maxDefects = Math.max(1, Math.floor(units * MAX_DEFECT_SHARE));
    const defects = random.next() < ZERO_DEFECT_CHANCE ? 0 : random.int(1, maxDefects);
    const downtime = random.next() < ZERO_DOWNTIME_CHANCE ? 0 : random.int(scenario.downtime.min, scenario.downtime.max);
    return { code: `${scenario.batchPrefix}-${String(i + 1).padStart(2, "0")}`, line, shift, product: product.name, units, defects, downtime };
  });
}

/**
 * A limit between the drawn values: a multiple of `step` strictly between two
 * neighbouring distinct values, so 25–75 % of the values lie above it and none
 * is equal to it (`>` and `>=` give the same answer). When no multiple fits,
 * the lower neighbour itself (equality then follows the prompt's operator).
 */
export function splitLimit(random: Random, values: readonly number[], step: number): number {
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  if (sorted.length < 2) return sorted[0] ?? 0;
  const n = values.length;
  const indices = sorted.map((_, i) => i).slice(0, -1);
  const fair = indices.filter((i) => {
    const above = values.filter((value) => value > sorted[i]).length;
    return above >= Math.ceil(n * 0.25) && above <= Math.floor(n * 0.75);
  });
  const order = random.shuffle(fair.length > 0 ? fair : indices);
  for (const i of order) {
    const low = sorted[i];
    const high = sorted[i + 1];
    const candidate = Math.round(Math.ceil((low + high) / 2 / step) * step * 1e6) / 1e6;
    if (candidate > low && candidate < high) return candidate;
    const below = Math.round(Math.floor((low + high) / 2 / step) * step * 1e6) / 1e6;
    if (below > low && below < high) return below;
  }
  return sorted[order[0]];
}

/** A batch's Data cells A…G, in `DATA_HEADERS` order. */
const batchValues = (batch: Batch): ExamCellValue[] => [batch.code, batch.line, batch.shift, batch.product, batch.units, batch.defects, batch.downtime];

/** Data A1:G{n+1} (headers, then one row per batch), the answer headers in row 1 from H, and the parameters N2:O{k+1}. */
export function dataCells(
  batches: readonly Batch[],
  answerHeaders: readonly string[],
  params: readonly (readonly [string, ExamCellValue])[],
): Record<string, ExamCellValue> {
  const data: Record<string, ExamCellValue> = {};
  DATA_HEADERS.forEach((header, c) => (data[cellRef(c + 1, 1)] = header));
  batches.forEach((batch, i) => batchValues(batch).forEach((value, c) => (data[cellRef(c + 1, i + 2)] = value)));
  answerHeaders.forEach((header, c) => (data[cellRef(8 + c, 1)] = header));
  params.forEach(([label, value], r) => {
    data[`N${r + 2}`] = label;
    data[`O${r + 2}`] = value;
  });
  return data;
}

/** `{ H2: f(batch 1), H3: … }`: one key per batch row in column `letter`. */
export function columnKey(letter: string, batches: readonly Batch[], value: (batch: Batch) => ExamCellValue): Record<string, ExamCellValue> {
  return Object.fromEntries(batches.map((batch, i) => [`${letter}${i + 2}`, value(batch)]));
}

/** The exam: Instructions (title, scenario with `extra`, the prompts on B6…, the Finish line after them) and Data. */
export function examOf(
  title: string,
  scenario: LogikaScenario,
  batches: readonly Batch[],
  extra: string,
  data: Record<string, ExamCellValue>,
  questions: ExamQuestion[],
): GeneratedExam {
  const last = batches.length + 1;
  const instructions: Record<string, string> = {
    [INSTRUCTIONS_CELLS.title]: `${title} — ${scenario.title}`,
    [INSTRUCTIONS_CELLS.scenario]:
      `${scenario.story}\n` +
      `Data ${batches.length} batch ada di sheet "Data" (A1:G${last}); batas yang dipakai soal ada di N2:O${1 + Object.keys(data).filter((ref) => /^O\d+$/.test(ref)).length}. ${extra}` +
      "Tulis jawabanmu di sel yang disebut tiap soal, lalu klik Finish.",
  };
  questions.forEach((question) => {
    instructions[INSTRUCTIONS_CELLS.lines[question.number - 1]] = `${question.number}. ${question.prompt}`;
  });
  instructions[INSTRUCTIONS_CELLS.lines[questions.length]] = FINISH_LINE;
  return { cells: { [INSTRUCTIONS_SHEET]: instructions, [DATA_SHEET]: data }, questions };
}
