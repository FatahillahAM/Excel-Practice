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
import type { FondasiScenario } from "./scenarios";

/**
 * Level 1 · Test (`L01-T`): the skills of Level 1 together on the same table
 * of production batches as L01-P1 (Data A1:G{n+1}, n = 12–20), with the
 * target of good units per batch in `N2`, P1:Q{p+1} the products with their
 * base cost and R1:U1 four cost increases. No time limit; passing is
 * `isPassingScore` (≥ 80). Six questions, 100 points:
 *
 * | # | Points | Answer        | Expected formula (top cell)    |
 * |---|--------|---------------|--------------------------------|
 * | 1 | 15     | H2:H{n+1}     | `=E2-F2`                       |
 * | 2 | 15     | I2:I{n+1}     | `=H2-$N$2`                     |
 * | 3 | 15     | J2:J{n+1}     | `=H2/SUM($H$2:$H${n+1})`       |
 * | 4 | 20     | K2:K{n+1}     | `=RANK.EQ(H2,$H$2:$H${n+1})`   |
 * | 5 | 20     | R2:U{p+1}     | `=$Q2*(1+R$1)`                 |
 * | 6 | 15     | N4            | `=MAX(H2:H{n+1})`              |
 *
 * Question 4 is the formula form of "Sort": the batch's place when sorted by
 * Unit Baik, largest first (ties share a place, as RANK.EQ does). The Excel
 * Table question joins in 5.2, with its checker. Prompts never reveal `$` or
 * F4; each question has 3 hints and one fixed Tip (`TEST_TIPS`), plain text
 * that draws nothing from `random`.
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

/** The Tips of L01-T: four shared with L01-P1 (same id, same card) and two of its own (Excel 2021 features only). */
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
  autosum: {
    id: "l01-autosum-cepat",
    title: "Ringkasan cepat dengan AutoSum",
    body:
      "Klik sel kosong di bawah atau di samping angka lalu tekan Alt+= untuk menulis SUM otomatis. " +
      "Panah kecil di tombol AutoSum (Home → Editing) juga punya Max, Min, Average, dan Count Numbers.",
    shortcuts: ["Alt+="],
  },
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
  data.H1 = TEST_ANSWER_HEADERS.good;
  data.I1 = TEST_ANSWER_HEADERS.gap;
  data.J1 = TEST_ANSWER_HEADERS.share;
  data.K1 = TEST_ANSWER_HEADERS.rank;
  data.M2 = TARGET_LABEL;
  data.N2 = target;
  data.M4 = MAX_LABEL;
  data.P1 = TEST_GRID_HEADERS.product;
  data.Q1 = TEST_GRID_HEADERS.baseCost;
  increases.forEach((increase, c) => (data[cellRef(col("R") + c, 1)] = increase));
  products.forEach((product, r) => {
    data[`P${r + 2}`] = product.name;
    data[`Q${r + 2}`] = product.cost;
  });

  const totalGood = good.reduce((sum, value) => sum + value, 0);
  const columnKey = (letter: string, value: (goodUnits: number) => number) =>
    Object.fromEntries(good.map((goodUnits, i) => [`${letter}${i + 2}`, value(goodUnits)]));
  const gridKey: Record<string, number> = {};
  products.forEach((product, r) => {
    increases.forEach((increase, c) => (gridKey[cellRef(col("R") + c, r + 2)] = product.cost * (1 + increase)));
  });
  const gridLast = products.length + 1;

  const questions: ExamQuestion[] = [
    {
      number: 1,
      prompt:
        `Di H2:H${last}, hitung ${TEST_ANSWER_HEADERS.good} tiap batch: "Unit Diproduksi" dikurangi "Unit Cacat". ` +
        `Tulis satu rumus di H2, lalu salin ke bawah sampai H${last}.`,
      points: 15,
      sheet: DATA_SHEET,
      range: `H2:H${last}`,
      checks: BASE_CHECKS,
      key: columnKey("H", (goodUnits) => goodUnits),
      hints: [
        "Unit Baik cukup dihitung dari dua kolom di baris yang sama: Unit Diproduksi dan Unit Cacat.",
        "Rumus dimulai dengan = dan merujuk sel di baris yang sama, bukan angka yang diketik.",
        `Kedua referensi harus ikut bergeser per baris, jadi tidak perlu tanda $. Setelah H2 benar, blok H2:H${last} lalu tekan Ctrl+D.`,
      ],
      tip: tipOf(TEST_TIPS.fill),
    },
    {
      number: 2,
      prompt:
        `Di I2:I${last}, hitung ${TEST_ANSWER_HEADERS.gap} tiap batch: ${TEST_ANSWER_HEADERS.good} (kolom H) dikurangi target di sel N2. ` +
        `Hasil negatif berarti batch itu di bawah target. Rumus di I2 harus tetap benar saat disalin ke bawah sampai I${last}.`,
      points: 15,
      sheet: DATA_SHEET,
      range: `I2:I${last}`,
      checks: [...BASE_CHECKS, { name: "uses_reference", ref: "$N$2" }],
      key: columnKey("I", (goodUnits) => goodUnits - target),
      hints: [
        "Targetnya hanya ada di satu sel, N2. Kalau rumus disalin ke bawah, referensi biasa ikut bergeser ke N3, N4, dan seterusnya, yang kosong.",
        "Tanda $ mengunci referensi: $ di depan huruf mengunci kolom, $ di depan angka mengunci baris.",
        "Di rumus I2, klik referensi target lalu tekan F4 sampai kolom dan barisnya sama-sama terkunci. Unit Baik dibiarkan tanpa $ karena harus ikut turun per baris.",
      ],
      tip: tipOf(TEST_TIPS.lock),
    },
    {
      number: 3,
      prompt:
        `Di J2:J${last}, hitung ${TEST_ANSWER_HEADERS.share} tiap batch: ${TEST_ANSWER_HEADERS.good} batch itu dibagi total ` +
        `${TEST_ANSWER_HEADERS.good} semua batch (pakai SUM atas H2:H${last}). Rumus di J2 harus tetap benar saat disalin ke bawah sampai J${last}.`,
      points: 15,
      sheet: DATA_SHEET,
      range: `J2:J${last}`,
      checks: [...BASE_CHECKS, { name: "uses_functions", functions: ["SUM"] }, { name: "uses_reference", ref: `$H$2:$H$${last}` }],
      key: columnKey("J", (goodUnits) => goodUnits / totalGood),
      hints: [
        "Porsi = Unit Baik batch itu dibagi total Unit Baik semua batch. Pembilangnya berubah per baris, penyebutnya selalu total yang sama.",
        "Kalau range di dalam SUM tidak dikunci, range itu ikut bergeser saat disalin ke bawah, jadi totalnya tidak lagi mencakup semua batch.",
        `Di dalam SUM, blok range H2:H${last} lalu tekan F4 sekali supaya awal dan akhir range sama-sama terkunci. Unit Baik di pembilang tetap tanpa $.`,
      ],
      tip: tipOf(TEST_TIPS.percent),
    },
    {
      number: 4,
      prompt:
        `Di K2:K${last}, tulis ${TEST_ANSWER_HEADERS.rank} tiap batch kalau diurutkan dari ${TEST_ANSWER_HEADERS.good} terbesar: ` +
        `terbesar = 1. Pakai fungsi RANK.EQ dan jangan mengurutkan tabelnya. Rumus di K2 harus tetap benar saat disalin ke bawah sampai K${last}.`,
      points: 20,
      sheet: DATA_SHEET,
      range: `K2:K${last}`,
      checks: [...BASE_CHECKS, { name: "uses_functions", functions: ["RANK.EQ"] }, { name: "uses_reference", ref: `$H$2:$H$${last}` }],
      key: columnKey("K", (goodUnits) => rankEq(goodUnits, good)),
      hints: [
        "RANK.EQ butuh dua hal: angka yang mau dirangking (Unit Baik batch itu) dan daftar semua Unit Baik sebagai pembanding.",
        "Tanpa argumen ketiga, RANK.EQ memberi peringkat 1 untuk angka terbesar. Batch dengan Unit Baik sama mendapat peringkat yang sama.",
        `Daftar pembanding harus selalu H2:H${last} di setiap baris: kunci range itu dengan F4. Angka yang dirangking tetap tanpa $ supaya ikut turun.`,
      ],
      tip: tipOf(TEST_TIPS.rank),
    },
    {
      number: 5,
      prompt:
        `Di R2:U${gridLast}, buat simulasi kenaikan biaya: "${TEST_GRID_HEADERS.baseCost}" di kolom Q dikali (1 + persentase kenaikan di R1:U1). ` +
        `Kenaikan ditulis dalam desimal: 0.02 artinya 2%. Tulis satu rumus di R2 yang tetap benar saat disalin ke kanan dan ke bawah sampai U${gridLast}.`,
      points: 20,
      sheet: DATA_SHEET,
      range: `R2:U${gridLast}`,
      checks: [...BASE_CHECKS, { name: "uses_reference", ref: "$Q2" }, { name: "uses_reference", ref: "R$1" }],
      key: gridKey,
      hints: [
        `Setiap sel di R2:U${gridLast} memakai Biaya Dasar di kolom Q pada baris yang sama dan persentase kenaikan di baris 1 pada kolom yang sama.`,
        "Saat disalin ke kanan, rujukan ke kolom Q tidak boleh pindah kolom; saat disalin ke bawah, rujukan ke baris 1 tidak boleh pindah baris. Hanya satu bagian tiap referensi yang dikunci.",
        "Tekan F4 berulang untuk berganti bentuk referensi: A1 → $A$1 → A$1 → $A1. Untuk Biaya Dasar kunci kolomnya saja, untuk persentase kunci barisnya saja. " +
          `Setelah R2 benar, blok R2:U2 lalu Ctrl+R, kemudian blok R2:U${gridLast} lalu Ctrl+D.`,
      ],
      tip: tipOf(TEST_TIPS.mixed),
    },
    {
      number: 6,
      prompt: `Di N4, tampilkan ${MAX_LABEL} dari semua batch dengan fungsi MAX atas H2:H${last}.`,
      points: 15,
      sheet: DATA_SHEET,
      range: "N4",
      checks: [...BASE_CHECKS, { name: "uses_functions", functions: ["MAX"] }],
      key: { N4: Math.max(...good) },
      hints: [
        "Angka tertinggi cukup dicari dari satu kolom: Unit Baik.",
        "Jangan ketik angkanya: kalau data berubah, hasilnya harus ikut berubah.",
        `MAX menerima satu range. Tulis rumusnya di N4 dengan range H2:H${last}; rumus ini tidak disalin, jadi $ tidak wajib.`,
      ],
      tip: tipOf(TEST_TIPS.autosum),
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
