import { cellRef, columnNumber } from "@/core/content/a1";
import { KEY_TOLERANCE, type Check } from "@/core/content/checks";
import {
  DATA_SHEET,
  INSTRUCTIONS_CELLS,
  INSTRUCTIONS_SHEET,
  type ExamCellValue,
  type ExamQuestion,
  type GeneratedExam,
  type LevelItem,
  type Tip,
} from "@/core/content/level-module";
import { createRandom } from "@/core/content/random";
import { DATA_HEADERS, MAX_BATCHES, MIN_BATCHES, TIPS } from "./practice-1";
import { P2_TIPS } from "./practice-2";
import type { FondasiScenario } from "./scenarios";

/**
 * Level 1 · Test (`L01-T`): the skills of Level 1 together on the same table
 * of production batches as L01-P1 (Data A1:G{n+1}, n = 12–20). Column H
 * stays empty, so Ctrl+T on the data finds exactly A1:G{n+1} and the answer
 * columns I:L lie outside the Table (their `$` references are never
 * rewritten as structured references). The target of good units per batch is
 * in `O2`, Q1:R{p+1} the products with their base cost and S1:V1 four cost
 * increases. No time limit; passing is `isPassingScore` (≥ 80). Six
 * questions, 100 points (5.2: the Excel Table joins question 6, so the
 * instruction lines stay within B6:B12):
 *
 * | # | Points | Answer        | Expected formula (top cell)    |
 * |---|--------|---------------|--------------------------------|
 * | 1 | 15     | I2:I{n+1}     | `=E2-F2`                       |
 * | 2 | 15     | J2:J{n+1}     | `=I2-$O$2`                     |
 * | 3 | 15     | K2:K{n+1}     | `=I2/SUM($I$2:$I${n+1})`       |
 * | 4 | 15     | L2:L{n+1}     | `=RANK.EQ(I2,$I$2:$I${n+1})`   |
 * | 5 | 20     | S2:V{p+1}     | `=$R2*(1+S$1)`                 |
 * | 6 | 20     | O4            | Table over A1:G{n+1}, then `=MAX(I2:I{n+1})` |
 *
 * Question 4 is the formula form of "Sort": the batch's place when sorted by
 * Unit Baik, largest first (ties share a place, as RANK.EQ does). Question 6
 * checks the Excel Table first (`is_table`: range with header row, header
 * row on, the data headers as column names). Prompts never reveal `$` or F4;
 * each question has 3 hints and one fixed Tip (`TEST_TIPS`), plain text that
 * draws nothing from `random`.
 */

export const TEST_ANSWER_HEADERS = {
  good: "Unit Baik",
  gap: "Selisih Target",
  share: "Porsi Unit Baik",
  rank: "Peringkat",
} as const;
export const TEST_GRID_HEADERS = { product: "Produk", baseCost: "Biaya Dasar" } as const;
export const TARGET_LABEL = "Target Unit Baik per Batch";
export const MAX_LABEL = "Unit Baik Tertinggi";

/** Unit Cacat is at most this share of Unit Diproduksi. */
const MAX_DEFECT_SHARE = 0.04;

const FINISH_LINE = "Kalau sudah selesai, klik Finish. File tidak perlu disimpan dulu: Finish mengirim salinannya.";

const valueCheck: Check = { name: "value_equals_key", tolerance: KEY_TOLERANCE };
const BASE_CHECKS: Check[] = [{ name: "formula_present" }, { name: "not_hard_coded" }, valueCheck];

const col = (letter: string) => columnNumber(letter);

/** The Tips of L01-T: four shared with L01-P1 and the Table card of L01-P2 (same id, same card), and one of its own (Excel 2021 features only). */
export const TEST_TIPS = {
  fill: TIPS.fill,
  lock: TIPS.lock,
  percent: TIPS.percent,
  rank: {
    id: "l01-urutan-tanpa-sort",
    title: "Cek urutan tanpa mengacak tabel",
    body:
      "Peringkat lewat rumus membuat urutan terlihat tanpa memindahkan baris. Untuk mencocokkan, salin tabel ke sheet lain, " +
      "klik satu sel di kolom yang dirangking lalu Data → Sort Largest to Smallest: baris paling atas harus peringkat 1. " +
      "Ctrl+Shift+L memasang tombol filter untuk melihat batch tertentu saja.",
    shortcuts: ["Ctrl+Shift+L"],
  },
  mixed: TIPS.mixed,
  table: P2_TIPS.table,
} as const satisfies Record<string, Tip>;

/** A fresh copy (mutable `shortcuts`) of a constant Tip. */
const tipOf = (tip: Tip): Tip => ({ ...tip, shortcuts: [...tip.shortcuts] });

/** RANK.EQ(value, values) in descending order: 1 + how many values are larger. */
export function rankEq(value: number, values: readonly number[]): number {
  return 1 + values.filter((other) => other > value).length;
}

function generate(seed: number, scenario: FondasiScenario): GeneratedExam {
  const random = createRandom(seed);

  // Draw order is part of the content: changing it changes every exam (bump contentVersion).
  const n = random.int(MIN_BATCHES, MAX_BATCHES);
  const products = random.shuffle(scenario.products).map((product) => ({
    name: product.name,
    units: product.units,
    cost: random.int(Math.round(product.cost.min * 100), Math.round(product.cost.max * 100)) / 100,
  }));
  const start = random.pick([2, 3, 4, 5]);
  const step = random.pick([2, 3, 5]);
  const increases = [0, 1, 2, 3].map((i) => (start + i * step) / 100);

  const rows = Array.from({ length: n }, (_, i) => {
    const product = random.pick(products);
    const units = random.int(product.units.min, product.units.max);
    return {
      code: `${scenario.batchPrefix}-${String(i + 1).padStart(2, "0")}`,
      line: random.pick(scenario.lines),
      shift: random.pick(scenario.shifts),
      product: product.name,
      units,
      defects: random.int(0, Math.floor(units * MAX_DEFECT_SHARE)),
      cost: product.cost,
    };
  });
  const good = rows.map((row) => row.units - row.defects);
  // The target: the mean of Unit Baik rounded to tens, so some batches are above it and some below.
  const target = Math.round(good.reduce((sum, value) => sum + value, 0) / n / 10) * 10;

  const last = n + 1;
  const data: Record<string, ExamCellValue> = {};
  DATA_HEADERS.forEach((header, c) => (data[cellRef(c + 1, 1)] = header));
  rows.forEach((row, i) => {
    [row.code, row.line, row.shift, row.product, row.units, row.defects, row.cost].forEach(
      (value, c) => (data[cellRef(c + 1, i + 2)] = value),
    );
  });
  data.I1 = TEST_ANSWER_HEADERS.good;
  data.J1 = TEST_ANSWER_HEADERS.gap;
  data.K1 = TEST_ANSWER_HEADERS.share;
  data.L1 = TEST_ANSWER_HEADERS.rank;
  data.N2 = TARGET_LABEL;
  data.O2 = target;
  data.N4 = MAX_LABEL;
  data.Q1 = TEST_GRID_HEADERS.product;
  data.R1 = TEST_GRID_HEADERS.baseCost;
  increases.forEach((increase, c) => (data[cellRef(col("S") + c, 1)] = increase));
  products.forEach((product, r) => {
    data[`Q${r + 2}`] = product.name;
    data[`R${r + 2}`] = product.cost;
  });

  const totalGood = good.reduce((sum, value) => sum + value, 0);
  const columnKey = (letter: string, value: (goodUnits: number) => number) =>
    Object.fromEntries(good.map((goodUnits, i) => [`${letter}${i + 2}`, value(goodUnits)]));
  const gridKey: Record<string, number> = {};
  products.forEach((product, r) => {
    increases.forEach((increase, c) => (gridKey[cellRef(col("S") + c, r + 2)] = product.cost * (1 + increase)));
  });
  const gridLast = products.length + 1;

  const questions: ExamQuestion[] = [
    {
      number: 1,
      prompt:
        `Di I2:I${last}, hitung ${TEST_ANSWER_HEADERS.good} tiap batch: "Unit Diproduksi" dikurangi "Unit Cacat". ` +
        `Tulis satu rumus di I2, lalu salin ke bawah sampai I${last}.`,
      points: 15,
      sheet: DATA_SHEET,
      range: `I2:I${last}`,
      checks: BASE_CHECKS,
      key: columnKey("I", (goodUnits) => goodUnits),
      hints: [
        "Unit Baik cukup dihitung dari dua kolom di baris yang sama: Unit Diproduksi dan Unit Cacat.",
        "Rumus dimulai dengan = dan merujuk sel di baris yang sama, bukan angka yang diketik.",
        `Kedua referensi harus ikut bergeser per baris, jadi tidak perlu tanda $. Setelah I2 benar, blok I2:I${last} lalu tekan Ctrl+D.`,
      ],
      tip: tipOf(TEST_TIPS.fill),
    },
    {
      number: 2,
      prompt:
        `Di J2:J${last}, hitung ${TEST_ANSWER_HEADERS.gap} tiap batch: ${TEST_ANSWER_HEADERS.good} (kolom I) dikurangi target di sel O2. ` +
        `Hasil negatif berarti batch itu di bawah target. Rumus di J2 harus tetap benar saat disalin ke bawah sampai J${last}.`,
      points: 15,
      sheet: DATA_SHEET,
      range: `J2:J${last}`,
      checks: [...BASE_CHECKS, { name: "uses_reference", ref: "$O$2" }],
      key: columnKey("J", (goodUnits) => goodUnits - target),
      hints: [
        "Targetnya hanya ada di satu sel, O2. Kalau rumus disalin ke bawah, referensi biasa ikut bergeser ke O3, O4, dan seterusnya, yang bukan target.",
        "Tanda $ mengunci referensi: $ di depan huruf mengunci kolom, $ di depan angka mengunci baris.",
        "Di rumus J2, klik referensi target lalu tekan F4 sampai kolom dan barisnya sama-sama terkunci. Unit Baik dibiarkan tanpa $ karena harus ikut turun per baris.",
      ],
      tip: tipOf(TEST_TIPS.lock),
    },
    {
      number: 3,
      prompt:
        `Di K2:K${last}, hitung ${TEST_ANSWER_HEADERS.share} tiap batch: ${TEST_ANSWER_HEADERS.good} batch itu dibagi total ` +
        `${TEST_ANSWER_HEADERS.good} semua batch (pakai SUM atas I2:I${last}). Rumus di K2 harus tetap benar saat disalin ke bawah sampai K${last}.`,
      points: 15,
      sheet: DATA_SHEET,
      range: `K2:K${last}`,
      checks: [...BASE_CHECKS, { name: "uses_functions", functions: ["SUM"] }, { name: "uses_reference", ref: `$I$2:$I$${last}` }],
      key: columnKey("K", (goodUnits) => goodUnits / totalGood),
      hints: [
        "Porsi = Unit Baik batch itu dibagi total Unit Baik semua batch. Pembilangnya berubah per baris, penyebutnya selalu total yang sama.",
        "Kalau range di dalam SUM tidak dikunci, range itu ikut bergeser saat disalin ke bawah, jadi totalnya tidak lagi mencakup semua batch.",
        `Di dalam SUM, blok range I2:I${last} lalu tekan F4 sekali supaya awal dan akhir range sama-sama terkunci. Unit Baik di pembilang tetap tanpa $.`,
      ],
      tip: tipOf(TEST_TIPS.percent),
    },
    {
      number: 4,
      prompt:
        `Di L2:L${last}, tulis ${TEST_ANSWER_HEADERS.rank} tiap batch kalau diurutkan dari ${TEST_ANSWER_HEADERS.good} terbesar: ` +
        `terbesar = 1. Pakai fungsi RANK.EQ dan jangan mengurutkan tabelnya. Rumus di L2 harus tetap benar saat disalin ke bawah sampai L${last}.`,
      points: 15,
      sheet: DATA_SHEET,
      range: `L2:L${last}`,
      checks: [...BASE_CHECKS, { name: "uses_functions", functions: ["RANK.EQ"] }, { name: "uses_reference", ref: `$I$2:$I$${last}` }],
      key: columnKey("L", (goodUnits) => rankEq(goodUnits, good)),
      hints: [
        "RANK.EQ butuh dua hal: angka yang mau dirangking (Unit Baik batch itu) dan daftar semua Unit Baik sebagai pembanding.",
        "Tanpa argumen ketiga, RANK.EQ memberi peringkat 1 untuk angka terbesar. Batch dengan Unit Baik sama mendapat peringkat yang sama.",
        `Daftar pembanding harus selalu I2:I${last} di setiap baris: kunci range itu dengan F4. Angka yang dirangking tetap tanpa $ supaya ikut turun.`,
      ],
      tip: tipOf(TEST_TIPS.rank),
    },
    {
      number: 5,
      prompt:
        `Di S2:V${gridLast}, buat simulasi kenaikan biaya: "${TEST_GRID_HEADERS.baseCost}" di kolom R dikali (1 + persentase kenaikan di S1:V1). ` +
        `Kenaikan ditulis dalam desimal: 0.02 artinya 2%. Tulis satu rumus di S2 yang tetap benar saat disalin ke kanan dan ke bawah sampai V${gridLast}.`,
      points: 20,
      sheet: DATA_SHEET,
      range: `S2:V${gridLast}`,
      checks: [...BASE_CHECKS, { name: "uses_reference", ref: "$R2" }, { name: "uses_reference", ref: "S$1" }],
      key: gridKey,
      hints: [
        `Setiap sel di S2:V${gridLast} memakai Biaya Dasar di kolom R pada baris yang sama dan persentase kenaikan di baris 1 pada kolom yang sama.`,
        "Saat disalin ke kanan, rujukan ke kolom R tidak boleh pindah kolom; saat disalin ke bawah, rujukan ke baris 1 tidak boleh pindah baris. Hanya satu bagian tiap referensi yang dikunci.",
        "Tekan F4 berulang untuk berganti bentuk referensi: A1 → $A$1 → A$1 → $A1. Untuk Biaya Dasar kunci kolomnya saja, untuk persentase kunci barisnya saja. " +
          `Setelah S2 benar, blok S2:V2 lalu Ctrl+R, kemudian blok S2:V${gridLast} lalu Ctrl+D.`,
      ],
      tip: tipOf(TEST_TIPS.mixed),
    },
    {
      number: 6,
      prompt:
        `Ubah data A1:G${last} jadi Excel Table, dengan judul kolom di baris 1 sebagai header. ` +
        `Lalu di O4, tampilkan ${MAX_LABEL} dari semua batch dengan fungsi MAX atas I2:I${last}.`,
      points: 20,
      sheet: DATA_SHEET,
      range: "O4",
      checks: [{ name: "is_table", ref: `A1:G${last}`, headers: [...DATA_HEADERS] }, ...BASE_CHECKS, { name: "uses_functions", functions: ["MAX"] }],
      key: { O4: Math.max(...good) },
      hints: [
        "Excel Table dibuat dari data yang judul kolomnya ada di baris pertama. Kolom H yang kosong menjadi batas kanannya, jadi Unit Baik dan jawaban lain tidak ikut masuk.",
        "Klik satu sel di dalam data lalu buat Table dari tab Insert atau dengan shortcut, dengan pilihan bahwa data punya header dicentang.",
        `Untuk angka tertinggi, MAX menerima satu range: Unit Baik di I2:I${last}. Rumus ini tidak disalin, jadi $ tidak wajib.`,
      ],
      tip: tipOf(TEST_TIPS.table),
    },
  ];

  const instructions: Record<string, string> = {
    [INSTRUCTIONS_CELLS.title]: `Level 1 · Test — ${scenario.title}`,
    [INSTRUCTIONS_CELLS.scenario]:
      `${scenario.story}\n` +
      `Data ${n} batch ada di sheet "Data" (A1:G${last}). Test ini tanpa batas waktu; lulus dengan skor 80. ` +
      "Tulis jawabanmu di sel yang disebut tiap soal, lalu klik Finish.",
  };
  questions.forEach((question) => {
    instructions[INSTRUCTIONS_CELLS.lines[question.number - 1]] = `${question.number}. ${question.prompt}`;
  });
  instructions[INSTRUCTIONS_CELLS.lines[questions.length]] = FINISH_LINE;

  return { cells: { [INSTRUCTIONS_SHEET]: instructions, [DATA_SHEET]: data }, questions };
}

export const levelTest: LevelItem<FondasiScenario> = {
  id: "L01-T",
  kind: "test",
  number: 6,
  generate,
};
