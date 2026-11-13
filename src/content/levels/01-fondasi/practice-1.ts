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
import type { FondasiScenario } from "./scenarios";

/**
 * Level 1 · Practice 1 (`L01-P1`): `$` references on a table of production
 * batches. Data A1:G{n+1} holds the batches (n = 12–20), `L2` the overhead
 * rate, M1:N{p+1} the products with their base cost and O1:R1 four cost
 * increases. Four questions:
 *
 * | # | Points | Answer        | Expected formula (top cell)  |
 * |---|--------|---------------|------------------------------|
 * | 1 | 20     | H2:H{n+1}     | `=E2*G2`                     |
 * | 2 | 25     | I2:I{n+1}     | `=E2*$L$2`                   |
 * | 3 | 25     | J2:J{n+1}     | `=E2/SUM($E$2:$E${n+1})`     |
 * | 4 | 30     | O2:R{p+1}     | `=$N2*(1+O$1)`               |
 *
 * Prompts say what to compute and that the formula must still work when
 * copied; they still do not reveal `$` or F4: that is what the hints are for.
 * Each question has 3 hints (from nudge to method; the last names the `$`/F4
 * technique but never the full formula or a key value) and one fixed Tip
 * (`TIPS`). Hints and Tips are plain text: they draw nothing from `random`.
 */

export const DATA_HEADERS = ["Kode Batch", "Lini", "Shift", "Produk", "Unit Diproduksi", "Unit Cacat", "Biaya per Unit"] as const;
export const ANSWER_HEADERS = { total: "Total Biaya", overhead: "Biaya Overhead", share: "Porsi Produksi" } as const;
export const GRID_HEADERS = { product: "Produk", baseCost: "Biaya Dasar" } as const;
export const RATE_LABEL = "Tarif Overhead per Unit";

export const MIN_BATCHES = 12;
export const MAX_BATCHES = 20;
/** Unit Cacat is at most this share of Unit Diproduksi. */
const MAX_DEFECT_SHARE = 0.04;

const FINISH_LINE = "Kalau sudah selesai, klik Finish. File tidak perlu disimpan dulu: Finish mengirim salinannya.";

const valueCheck: Check = { name: "value_equals_key", tolerance: KEY_TOLERANCE };
const BASE_CHECKS: Check[] = [{ name: "formula_present" }, { name: "not_hard_coded" }, valueCheck];

const col = (letter: string) => columnNumber(letter);

/** The four Tips of L01-P1, constants so one id is always one card (Excel 2021 features only). */
export const TIPS = {
  fill: {
    id: "l01-isi-rumus-sekaligus",
    title: "Isi rumus ke bawah sekaligus",
    body:
      "Blok sel dari rumus paling atas sampai baris terakhir data, lalu tekan Ctrl+D: rumus di sel atas disalin ke semua sel yang diblok. " +
      "Cara lain: blok dulu seluruh range, ketik rumusnya, lalu tekan Ctrl+Enter supaya semua sel terisi sekaligus.",
    shortcuts: ["Ctrl+D", "Ctrl+Enter"],
  },
  lock: {
    id: "l01-kunci-sel-f4",
    title: "Kunci sel dengan F4",
    body:
      "Saat mengetik atau mengedit rumus, taruh kursor di referensi sel lalu tekan F4: A1 menjadi $A$1. " +
      "Tekan lagi untuk berganti A$1, $A1, lalu kembali A1. Di laptop, mungkin perlu Fn+F4.",
    shortcuts: ["F4"],
  },
  percent: {
    id: "l01-format-persen",
    title: "Tampilkan porsi sebagai persen",
    body:
      "Hasil pembagian seperti 0,25 lebih mudah dibaca sebagai 25%. Blok selnya lalu tekan Ctrl+Shift+%: hanya tampilannya yang berubah, nilainya tetap sama. " +
      "Untuk cek cepat, blok semua porsi dan lihat Sum di status bar: totalnya harus 100%.",
    shortcuts: ["Ctrl+Shift+%"],
  },
  mixed: {
    id: "l01-referensi-campuran",
    title: "Satu rumus untuk tabel dua arah",
    body:
      "Di tabel yang dibaca dari judul kiri dan judul atas, kunci kolom untuk judul kiri ($A2) dan baris untuk judul atas (B$1). " +
      "Tulis rumus di sel pojok kiri atas, blok baris pertama lalu Ctrl+R, kemudian blok seluruh tabel lalu Ctrl+D.",
    shortcuts: ["F4", "Ctrl+R", "Ctrl+D"],
  },
} as const satisfies Record<string, Tip>;

/** A fresh copy (mutable `shortcuts`) of a constant Tip. */
const tipOf = (tip: Tip): Tip => ({ ...tip, shortcuts: [...tip.shortcuts] });

function generate(seed: number, scenario: FondasiScenario): GeneratedExam {
  const random = createRandom(seed);

  // Draw order is part of the content: changing it changes every exam (bump contentVersion).
  const n = random.int(MIN_BATCHES, MAX_BATCHES);
  const products = random.shuffle(scenario.products).map((product) => ({
    name: product.name,
    units: product.units,
    cost: random.int(Math.round(product.cost.min * 100), Math.round(product.cost.max * 100)) / 100,
  }));
  const rate = random.int(scenario.overheadRate.min, scenario.overheadRate.max);
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

  const last = n + 1;
  const data: Record<string, ExamCellValue> = {};
  DATA_HEADERS.forEach((header, c) => (data[cellRef(c + 1, 1)] = header));
  rows.forEach((row, i) => {
    [row.code, row.line, row.shift, row.product, row.units, row.defects, row.cost].forEach(
      (value, c) => (data[cellRef(c + 1, i + 2)] = value),
    );
  });
  data.H1 = ANSWER_HEADERS.total;
  data.I1 = ANSWER_HEADERS.overhead;
  data.J1 = ANSWER_HEADERS.share;
  data.K2 = RATE_LABEL;
  data.L2 = rate;
  data.M1 = GRID_HEADERS.product;
  data.N1 = GRID_HEADERS.baseCost;
  increases.forEach((increase, c) => (data[cellRef(col("O") + c, 1)] = increase));
  products.forEach((product, r) => {
    data[`M${r + 2}`] = product.name;
    data[`N${r + 2}`] = product.cost;
  });

  const totalUnits = rows.reduce((sum, row) => sum + row.units, 0);
  const columnKey = (letter: string, value: (row: (typeof rows)[number]) => number) =>
    Object.fromEntries(rows.map((row, i) => [`${letter}${i + 2}`, value(row)]));
  const gridKey: Record<string, number> = {};
  products.forEach((product, r) => {
    increases.forEach((increase, c) => (gridKey[cellRef(col("O") + c, r + 2)] = product.cost * (1 + increase)));
  });
  const gridLast = products.length + 1;

  const questions: ExamQuestion[] = [
    {
      number: 1,
      prompt:
        `Di H2:H${last}, hitung ${ANSWER_HEADERS.total} tiap batch: "Unit Diproduksi" dikali "Biaya per Unit". ` +
        `Tulis satu rumus di H2, lalu salin ke bawah sampai H${last}.`,
      points: 20,
      sheet: DATA_SHEET,
      range: `H2:H${last}`,
      checks: BASE_CHECKS,
      key: columnKey("H", (row) => row.units * row.cost),
      hints: [
        "Total Biaya cukup dihitung dari dua kolom di baris yang sama: Unit Diproduksi dan Biaya per Unit.",
        "Di H2, ketik = lalu klik sel Unit Diproduksi baris 2, ketik *, lalu klik sel Biaya per Unit baris 2. Jangan ketik angkanya: rumus harus merujuk sel.",
        `Kedua referensi memang harus ikut bergeser per baris, jadi tidak perlu tanda $. Setelah H2 benar, blok H2:H${last} lalu tekan Ctrl+D.`,
      ],
      tip: tipOf(TIPS.fill),
    },
    {
      number: 2,
      prompt:
        `Di I2:I${last}, hitung ${ANSWER_HEADERS.overhead} tiap batch: "Unit Diproduksi" dikali tarif overhead per unit di sel L2. ` +
        `Tulis rumusnya di I2 supaya tetap benar saat disalin ke bawah sampai I${last}.`,
      points: 25,
      sheet: DATA_SHEET,
      range: `I2:I${last}`,
      checks: [...BASE_CHECKS, { name: "uses_reference", ref: "$L$2" }],
      key: columnKey("I", (row) => row.units * rate),
      hints: [
        "Tarif overhead hanya ada di satu sel, L2. Kalau rumus disalin ke bawah, referensi biasa ikut bergeser jadi L3, L4, dan seterusnya, padahal tarifnya cuma ada di L2.",
        "Tanda $ mengunci referensi: $ di depan huruf mengunci kolom, $ di depan angka mengunci baris. Referensi yang dikunci tidak bergeser saat disalin.",
        "Di rumus I2, klik referensi tarif overhead lalu tekan F4 sampai kolom dan barisnya sama-sama terkunci. Unit Diproduksi dibiarkan tanpa $ karena harus ikut turun per baris.",
      ],
      tip: tipOf(TIPS.lock),
    },
    {
      number: 3,
      prompt:
        `Di J2:J${last}, hitung ${ANSWER_HEADERS.share} tiap batch: "Unit Diproduksi" batch itu dibagi total "Unit Diproduksi" ` +
        `semua batch (pakai SUM atas E2:E${last}). Rumus di J2 harus tetap benar saat disalin ke bawah sampai J${last}.`,
      points: 25,
      sheet: DATA_SHEET,
      range: `J2:J${last}`,
      checks: [...BASE_CHECKS, { name: "uses_functions", functions: ["SUM"] }, { name: "uses_reference", ref: `$E$2:$E$${last}` }],
      key: columnKey("J", (row) => row.units / totalUnits),
      hints: [
        "Porsi = unit batch itu dibagi total unit semua batch. Pembilangnya berubah per baris, penyebutnya selalu total yang sama.",
        "Saat rumus disalin ke bawah, range di dalam SUM ikut bergeser kalau tidak dikunci, jadi total di baris bawah tidak lagi mencakup semua batch.",
        `Di dalam SUM, blok range E2:E${last} lalu tekan F4 sekali supaya awal dan akhir range sama-sama terkunci. Unit batch di pembilang tetap tanpa $.`,
      ],
      tip: tipOf(TIPS.percent),
    },
    {
      number: 4,
      prompt:
        `Di O2:R${gridLast}, buat simulasi kenaikan biaya: "${GRID_HEADERS.baseCost}" di kolom N dikali (1 + persentase kenaikan di O1:R1). ` +
        `Kenaikan di O1:R1 ditulis dalam desimal: 0.02 artinya 2%. ` +
        `Tulis satu rumus di O2 yang tetap benar saat disalin ke kanan dan ke bawah sampai R${gridLast}.`,
      points: 30,
      sheet: DATA_SHEET,
      range: `O2:R${gridLast}`,
      checks: [...BASE_CHECKS, { name: "uses_reference", ref: "$N2" }, { name: "uses_reference", ref: "O$1" }],
      key: gridKey,
      hints: [
        `Setiap sel di O2:R${gridLast} memakai dua angka: Biaya Dasar di kolom N pada baris yang sama, dan persentase kenaikan di baris 1 pada kolom yang sama.`,
        "Saat disalin ke kanan, rujukan ke kolom N tidak boleh pindah kolom; saat disalin ke bawah, rujukan ke baris 1 tidak boleh pindah baris. Ini referensi campuran: hanya satu bagian yang dikunci.",
        "Tekan F4 berulang untuk berganti bentuk: N2 → $N$2 → N$2 → $N2. Kunci kolomnya saja untuk Biaya Dasar dan barisnya saja untuk persentase, lalu isi O2 ke kanan (Ctrl+R) dan ke bawah (Ctrl+D).",
      ],
      tip: tipOf(TIPS.mixed),
    },
  ];

  const instructions: Record<string, string> = {
    [INSTRUCTIONS_CELLS.title]: `Level 1 · Practice 1 — ${scenario.title}`,
    [INSTRUCTIONS_CELLS.scenario]:
      `${scenario.story}\n` +
      `Data ${n} batch ada di sheet "Data" (A1:G${last}). Tulis jawabanmu di sel yang disebut tiap soal, lalu klik Finish.`,
  };
  questions.forEach((question) => {
    instructions[INSTRUCTIONS_CELLS.lines[question.number - 1]] = `${question.number}. ${question.prompt}`;
  });
  instructions[INSTRUCTIONS_CELLS.lines[questions.length]] = FINISH_LINE;

  return { cells: { [INSTRUCTIONS_SHEET]: instructions, [DATA_SHEET]: data }, questions };
}

export const practice1: LevelItem<FondasiScenario> = {
  id: "L01-P1",
  kind: "practice",
  number: 1,
  generate,
};
