import { KEY_TOLERANCE, type Check } from "@/core/content/checks";
import {
  DATA_SHEET,
  INSTRUCTIONS_CELLS,
  INSTRUCTIONS_SHEET,
  type ExamQuestion,
  type GeneratedExam,
  type LevelItem,
  type MateriCard,
  type Tip,
} from "@/core/content/level-module";
import { createRandom } from "@/core/content/random";
import { FINISH_LINE, batchCells, drawBatches, tipOf } from "./batches";
import type { FondasiScenario } from "./scenarios";

/**
 * Level 1 · Practice 4 (`L01-P4`): Filter through formulas. Data A1:G{n+1}
 * holds the batches (n = 12–20), N2 a line that has batches and N3 a unit
 * limit some batches are above and some not. The filtered lists are spilled
 * FILTER results (`spills`), the counts COUNTIF; the AutoFilter a user may
 * click is never read. Four questions, 100 points:
 *
 * | # | Points | Answer      | Expected formula                       |
 * |---|--------|-------------|----------------------------------------|
 * | 1 | 30     | I2:I{a+1}   | `=FILTER(A2:A{n+1},B2:B{n+1}=N2)`      |
 * | 2 | 30     | K2:K{b+1}   | `=FILTER(A2:A{n+1},E2:E{n+1}>N3)`      |
 * | 3 | 20     | N5          | `=COUNTIF(B2:B{n+1},N2)`               |
 * | 4 | 20     | N6          | `=COUNTIF(E2:E{n+1},">"&N3)`           |
 *
 * a = batches of the line (at least 1), b = batches above the limit (1 to n - 1). The
 * prompts name only the anchor cell: the end of a FILTER spill would give
 * away the count Questions 3 and 4 ask for.
 */

export const P4_LABELS = {
  line: "Lini Dipilih",
  limit: "Batas Unit",
  lineCount: "Jumlah Batch Lini Dipilih",
  aboveCount: "Jumlah Batch di Atas Batas",
  lineList: "Batch Lini Dipilih",
  aboveList: "Batch di Atas Batas",
} as const;

const valueCheck: Check = { name: "value_equals_key", tolerance: KEY_TOLERANCE };
const BASE_CHECKS: Check[] = [{ name: "formula_present" }, { name: "not_hard_coded" }];
const filterChecks: Check[] = [...BASE_CHECKS, { name: "uses_functions", functions: ["FILTER"] }, { name: "spills" }, valueCheck];
const countChecks: Check[] = [...BASE_CHECKS, { name: "uses_functions", functions: ["COUNTIF"] }, valueCheck];

/** The Tips of L01-P4 (Excel 2021 features only). */
export const P4_TIPS = {
  filter: {
    id: "l01-filter-rumus",
    title: "FILTER: daftar yang ikut berubah",
    body:
      "FILTER menampilkan baris yang memenuhi syarat dan langsung berubah kalau isi sel syaratnya diganti. " +
      "Coba ganti Lini Dipilih: daftar dan jumlahnya ikut menyesuaikan. Kalau tidak ada yang cocok, FILTER menampilkan #CALC!.",
    shortcuts: [],
  },
  autofilter: {
    id: "l01-autofilter-cepat",
    title: "Filter cepat dengan Ctrl+Shift+L",
    body:
      "Klik satu sel di data lalu tekan Ctrl+Shift+L untuk memasang tombol filter di judul kolom. " +
      "Pilih nilai di tombol itu untuk melihat baris tertentu saja; tekan Ctrl+Shift+L lagi untuk melepas semua filter.",
    shortcuts: ["Ctrl+Shift+L"],
  },
  statusBar: {
    id: "l01-status-bar-count",
    title: "Cek jumlah lewat status bar",
    body:
      "Blok sel hasil lalu lihat Count di status bar bawah: angkanya bisa dipakai untuk mengecek hasil COUNTIF. " +
      "Klik kanan status bar untuk menambah Sum, Average, atau Max.",
    shortcuts: [],
  },
  criteria: {
    id: "l01-syarat-dari-sel",
    title: "Syarat perbandingan dari sebuah sel",
    body:
      "Di COUNTIF, syarat seperti lebih dari ditulis sebagai teks operator yang digabung dengan sel memakai &. " +
      "Dengan begitu batasnya cukup diganti di selnya, tanpa mengubah rumus. Ctrl+` menampilkan semua rumus di sheet untuk mengeceknya.",
    shortcuts: ["Ctrl+`"],
  },
} as const satisfies Record<string, Tip>;

function generate(seed: number, scenario: FondasiScenario): GeneratedExam {
  const random = createRandom(seed);
  // Draw order is part of the content: changing it changes every exam (bump contentVersion).
  const batches = drawBatches(random, scenario);
  const n = batches.length;
  const last = n + 1;
  const line = random.pick(batches).line;
  // The limit: below the (j+1)-th largest Unit Diproduksi, rounded down to tens, so at least three and at most n - 1 batches are above it (else the smallest Unit Diproduksi).
  const descending = batches.map((batch) => batch.units).sort((a, b) => b - a);
  const j = random.int(2, n - 3);
  let limit = Math.floor((descending[j] - 1) / 10) * 10;
  if (descending.filter((units) => units > limit).length >= n) limit = descending[n - 1];

  const data = batchCells(batches);
  data.I1 = P4_LABELS.lineList;
  data.K1 = P4_LABELS.aboveList;
  data.M2 = P4_LABELS.line;
  data.N2 = line;
  data.M3 = P4_LABELS.limit;
  data.N3 = limit;
  data.M5 = P4_LABELS.lineCount;
  data.M6 = P4_LABELS.aboveCount;

  const ofLine = batches.filter((batch) => batch.line === line).map((batch) => batch.code);
  const above = batches.filter((batch) => batch.units > limit).map((batch) => batch.code);
  const listKey = (letter: string, codes: string[]) => Object.fromEntries(codes.map((code, i) => [`${letter}${i + 2}`, code]));
  const listRange = (letter: string, count: number) => (count === 1 ? `${letter}2` : `${letter}2:${letter}${count + 1}`);

  const questions: ExamQuestion[] = [
    {
      number: 1,
      prompt:
        `Di I2, tulis satu rumus FILTER yang menampilkan "Kode Batch" semua batch dari lini di sel N2. ` +
        "Hasilnya tumpah (spill) sendiri ke bawah, sesuai jumlah batch yang cocok.",
      points: 30,
      sheet: DATA_SHEET,
      range: listRange("I", ofLine.length),
      checks: filterChecks,
      key: listKey("I", ofLine),
      hints: [
        "Cukup satu rumus di I2. Sel di bawahnya harus kosong supaya hasilnya bisa tumpah.",
        "FILTER butuh dua hal: range yang ditampilkan, dan syarat berupa perbandingan satu kolom dengan sesuatu. Kedua range harus sama panjang.",
        "Syaratnya kolom Lini dibandingkan dengan sel N2 memakai tanda sama dengan. Rujuk sel N2, jangan ketik nama lininya.",
      ],
      tip: tipOf(P4_TIPS.filter),
    },
    {
      number: 2,
      prompt:
        `Di K2, tulis satu rumus FILTER yang menampilkan "Kode Batch" semua batch dengan "Unit Diproduksi" lebih dari batas di sel N3. ` +
        "Hasilnya tumpah sendiri ke bawah.",
      points: 30,
      sheet: DATA_SHEET,
      range: listRange("K", above.length),
      checks: filterChecks,
      key: listKey("K", above),
      hints: [
        "Bentuknya sama dengan soal 1, hanya syaratnya yang berbeda: kolom Unit Diproduksi dibandingkan dengan batas.",
        "Lebih dari berarti batch yang unitnya sama persis dengan batas tidak ikut tampil.",
        "Pakai tanda lebih besar antara isi kolom Unit Diproduksi dan sel N3. Urutan hasil FILTER mengikuti urutan baris data.",
      ],
      tip: tipOf(P4_TIPS.autofilter),
    },
    {
      number: 3,
      prompt: `Di N5, hitung ${P4_LABELS.lineCount} dengan fungsi COUNTIF: berapa batch yang "Lini"-nya sama dengan sel N2.`,
      points: 20,
      sheet: DATA_SHEET,
      range: "N5",
      checks: countChecks,
      key: { N5: ofLine.length },
      hints: [
        "COUNTIF menghitung sel dalam satu range yang memenuhi satu syarat.",
        "Range-nya kolom Lini; syaratnya cukup sel N2, karena COUNTIF membandingkan dengan sama dengan bila tanpa operator.",
        "Hasilnya harus sama dengan jumlah baris yang tampil di soal 1. Kalau berbeda, cek lagi range-nya.",
      ],
      tip: tipOf(P4_TIPS.statusBar),
    },
    {
      number: 4,
      prompt: `Di N6, hitung ${P4_LABELS.aboveCount} dengan fungsi COUNTIF: berapa batch yang "Unit Diproduksi"-nya lebih dari batas di sel N3.`,
      points: 20,
      sheet: DATA_SHEET,
      range: "N6",
      checks: countChecks,
      key: { N6: above.length },
      hints: [
        "Range-nya kolom Unit Diproduksi; syaratnya lebih dari batas di N3.",
        "Syarat dengan operator ditulis sebagai teks dalam tanda kutip. Supaya batasnya tetap diambil dari N3, gabungkan teks operator dengan sel N3 memakai &.",
        "Hasilnya harus sama dengan jumlah baris yang tampil di soal 2.",
      ],
      tip: tipOf(P4_TIPS.criteria),
    },
  ];

  const instructions: Record<string, string> = {
    [INSTRUCTIONS_CELLS.title]: `Level 1 · Practice 4 — ${scenario.title}`,
    [INSTRUCTIONS_CELLS.scenario]:
      `${scenario.story}\n` +
      `Data ${n} batch ada di sheet "Data" (A1:G${last}); lini dan batas unit yang dipakai ada di N2 dan N3. ` +
      "Tulis jawabanmu di sel yang disebut tiap soal, lalu klik Finish.",
  };
  questions.forEach((question) => {
    instructions[INSTRUCTIONS_CELLS.lines[question.number - 1]] = `${question.number}. ${question.prompt}`;
  });
  instructions[INSTRUCTIONS_CELLS.lines[questions.length]] = FINISH_LINE;

  return { cells: { [INSTRUCTIONS_SHEET]: instructions, [DATA_SHEET]: data }, questions };
}

/** The Materi of L01-P4 (5.7): read before Start and on the Exam screen; its examples use other cells and numbers than the questions. */
export const P4_MATERI: readonly MateriCard[] = [
  {
    id: "l01-p4-filter",
    title: "FILTER dengan satu syarat",
    concept:
      "FILTER menampilkan baris yang memenuhi syarat saja. Syaratnya perbandingan satu kolom: `=` untuk sama dengan, `>` untuk lebih dari.",
    example: { formula: "=FILTER(A2:A9,D2:D9>50)", note: "kode di kolom A yang nilai kolom D-nya lebih dari 50." },
    steps: [
      "Ketik `=FILTER(` → blok kolom yang mau ditampilkan.",
      "Ketik `,` → tulis syaratnya, misalnya blok D2:D9 lalu ketik `>50`.",
      "Ketik `)` → [[Enter]]: hasilnya spill ke bawah.",
    ],
    shortcuts: [],
  },
  {
    id: "l01-p4-countif",
    title: "COUNTIF untuk teks dan `\">\"&sel`",
    concept:
      "COUNTIF menghitung sel yang cocok dengan satu syarat. Syarat teks cukup ditulis dalam tanda kutip, misalnya `=COUNTIF(C2:C9,\"Malam\")`. Syarat perbandingan digabung dengan sel pakai `&`.",
    example: { formula: "=COUNTIF(F2:F9,\">\"&H1)", note: "berapa nilai di F2:F9 yang lebih dari isi H1." },
    steps: [
      "Ketik `=COUNTIF(` → blok range yang mau dihitung → `,`.",
      "Ketik `\">\"&` → klik sel batasnya → `)` → [[Enter]].",
    ],
    shortcuts: [],
  },
  {
    id: "l01-p4-syarat-dari-sel",
    title: "Syarat diambil dari sel, bukan diketik",
    concept:
      "Taruh syarat di sel sendiri lalu rujuk selnya, jangan ketik nilainya di rumus. Kalau isi sel syarat diganti, hasil FILTER dan COUNTIF ikut berubah.",
    example: { formula: "=FILTER(A2:A9,C2:C9=H1)", note: "baris yang shift-nya sama dengan isi H1." },
    steps: [
      "Tulis syarat di sel kosong, misalnya `Malam` di H1.",
      "Di rumus, klik H1 alih-alih mengetik `\"Malam\"`.",
      "Uji: ganti isi H1, lalu lihat hasilnya ikut berubah.",
    ],
    shortcuts: [],
  },
];

export const practice4: LevelItem<FondasiScenario> = {
  id: "L01-P4",
  kind: "practice",
  number: 4,
  materi: P4_MATERI,
  generate,
};
