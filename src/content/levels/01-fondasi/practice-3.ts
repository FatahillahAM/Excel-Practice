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
  type MateriCard,
  type Tip,
} from "@/core/content/level-module";
import { createRandom } from "@/core/content/random";
import { FINISH_LINE, batchCells, batchValues, drawBatches, tipOf, type Batch } from "./batches";
import { DATA_HEADERS } from "./practice-1";
import type { FondasiScenario } from "./scenarios";

/**
 * Level 1 · Practice 3 (`L01-P3`): Sort through formulas. Data A1:G{n+1}
 * holds the batches (n = 12–20, every Unit Diproduksi different, so no sort
 * has ties). Each answer is one dynamic-array formula in a top-left cell that
 * spills over its range (`spills`); the order of the original rows is never
 * checked. Three questions, 100 points:
 *
 * | # | Points | Answer      | Expected formula (anchor)              |
 * |---|--------|-------------|----------------------------------------|
 * | 1 | 30     | I2:I{n+1}   | `=SORT(E2:E{n+1},1,-1)`                |
 * | 2 | 35     | K2:K{n+1}   | `=SORTBY(A2:A{n+1},E2:E{n+1},-1)`      |
 * | 3 | 35     | M2:S{n+1}   | `=SORT(A2:G{n+1},5,1)`                 |
 *
 * Columns H, J and L stay empty, so a spill never runs into another answer
 * and Ctrl+T on the data still finds A1:G{n+1}. Structured references
 * (`Table1[Unit Diproduksi]`) pass as well: no check compares reference text.
 */

export const P3_HEADERS = { sortedUnits: "Unit Urut Terbesar", sortedCodes: "Batch Urut Unit Terbesar" } as const;

const valueCheck: Check = { name: "value_equals_key", tolerance: KEY_TOLERANCE };
const spillChecks = (fn: string): Check[] => [
  { name: "formula_present" },
  { name: "not_hard_coded" },
  { name: "uses_functions", functions: [fn] },
  { name: "spills" },
  valueCheck,
];

/** The Tips of L01-P3 (Excel 2021 features only). */
export const P3_TIPS = {
  sort: {
    id: "l01-sort-rumus",
    title: "Urutkan tanpa mengubah data asli",
    body:
      "SORT dan SORTBY menampilkan salinan yang sudah urut, jadi data asli tetap di tempatnya. " +
      "Kalau muncul #SPILL!, ada sel terisi di area hasil: kosongkan dulu. Sort manual yang terlanjur mengacak tabel bisa dibatalkan dengan Ctrl+Z.",
    shortcuts: ["Ctrl+Z"],
  },
  sortby: {
    id: "l01-sortby-kunci",
    title: "SORTBY: urutkan kolom berdasarkan kolom lain",
    body:
      "SORTBY berguna saat kolom yang ditampilkan berbeda dari kolom kunci urutannya, misalnya kode batch diurutkan dari jumlah unitnya. " +
      "Argumen urutan 1 berarti terkecil dulu, -1 berarti terbesar dulu. Klik sel hasil lalu Ctrl+[ untuk melompat ke sel yang dirujuk rumusnya.",
    shortcuts: ["Ctrl+["],
  },
  manual: {
    id: "l01-sort-manual",
    title: "Sort manual lewat menu Data",
    body:
      "Untuk mengurutkan tabel aslinya, klik satu sel di kolom kunci lalu Data → Sort Smallest to Largest atau Sort Largest to Smallest. " +
      "Excel ikut memindahkan seluruh baris asal tidak ada kolom kosong di tengah data. Alt+A+S+S membuka kotak Sort untuk beberapa kunci sekaligus.",
    shortcuts: ["Alt+A"],
  },
} as const satisfies Record<string, Tip>;

const col = (letter: string) => columnNumber(letter);

function generate(seed: number, scenario: FondasiScenario): GeneratedExam {
  const random = createRandom(seed);
  // Draw order is part of the content: changing it changes every exam (bump contentVersion).
  const batches = drawBatches(random, scenario, { distinctUnits: true });
  const n = batches.length;
  const last = n + 1;

  const data = batchCells(batches);
  data.I1 = P3_HEADERS.sortedUnits;
  data.K1 = P3_HEADERS.sortedCodes;
  DATA_HEADERS.forEach((header, c) => (data[cellRef(col("M") + c, 1)] = header));

  // A stable sort, as Excel's SORT and SORTBY keep the original order of ties.
  const byUnits = (direction: 1 | -1) => [...batches].sort((a: Batch, b: Batch) => direction * (a.units - b.units));
  const descending = byUnits(-1);
  const ascending = byUnits(1);
  const columnKey = (letter: string, values: ExamCellValue[]) => Object.fromEntries(values.map((value, i) => [`${letter}${i + 2}`, value]));
  const tableKey: Record<string, ExamCellValue> = {};
  ascending.forEach((batch, r) => batchValues(batch).forEach((value, c) => (tableKey[cellRef(col("M") + c, r + 2)] = value)));

  const questions: ExamQuestion[] = [
    {
      number: 1,
      prompt:
        `Di I2, tulis satu rumus SORT yang menampilkan semua "Unit Diproduksi" dari yang terbesar ke yang terkecil. ` +
        `Hasilnya tumpah (spill) sendiri sampai I${last}; jangan mengurutkan data aslinya.`,
      points: 30,
      sheet: DATA_SHEET,
      range: `I2:I${last}`,
      checks: spillChecks("SORT"),
      key: columnKey("I", descending.map((batch) => batch.units)),
      hints: [
        "Cukup satu rumus di I2: hasilnya mengisi sel di bawahnya sendiri, jadi I3 dan seterusnya harus dibiarkan kosong.",
        "SORT butuh range yang mau diurutkan, nomor kolom kunci di dalam range itu, dan arah urutan. Range yang hanya satu kolom berarti nomor kolomnya 1.",
        "Untuk urutan dari terbesar, isi argumen arah dengan angka negatif satu. Rangenya isi kolom Unit Diproduksi tanpa judul kolom.",
      ],
      tip: tipOf(P3_TIPS.sort),
    },
    {
      number: 2,
      prompt:
        `Di K2, tulis satu rumus SORTBY yang menampilkan semua "Kode Batch", diurutkan dari "Unit Diproduksi" terbesar. ` +
        `Hasilnya tumpah sendiri sampai K${last}.`,
      points: 35,
      sheet: DATA_SHEET,
      range: `K2:K${last}`,
      checks: spillChecks("SORTBY"),
      key: columnKey("K", descending.map((batch) => batch.code)),
      hints: [
        "Yang ditampilkan Kode Batch, tetapi urutannya ditentukan kolom lain: Unit Diproduksi.",
        "SORTBY menerima range yang ditampilkan, lalu range kunci urutan dan arahnya. Kedua range harus sama panjang dan mulai di baris yang sama.",
        "Pakai isi kolom Kode Batch sebagai range pertama dan isi kolom Unit Diproduksi sebagai kunci, dengan arah terbesar dulu.",
      ],
      tip: tipOf(P3_TIPS.sortby),
    },
    {
      number: 3,
      prompt:
        `Di M2, tulis satu rumus SORT yang menampilkan seluruh baris data A2:G${last}, diurutkan dari "Unit Diproduksi" terkecil. ` +
        `Hasilnya tumpah sendiri sampai S${last}, di bawah judul kolom M1:S1.`,
      points: 35,
      sheet: DATA_SHEET,
      range: `M2:S${last}`,
      checks: spillChecks("SORT"),
      key: tableKey,
      hints: [
        "SORT bisa mengurutkan banyak kolom sekaligus: setiap baris tetap utuh, hanya urutannya yang berubah.",
        "Nomor kolom kunci dihitung dari kolom pertama range yang diurutkan, bukan dari kolom A sheet. Hitung di urutan ke berapa Unit Diproduksi berada.",
        "Arah urutan terkecil dulu adalah 1, sama dengan bawaan SORT. Rangenya seluruh isi data tanpa baris judul.",
      ],
      tip: tipOf(P3_TIPS.manual),
    },
  ];

  const instructions: Record<string, string> = {
    [INSTRUCTIONS_CELLS.title]: `Level 1 · Practice 3 — ${scenario.title}`,
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

/** The Materi of L01-P3 (5.7): read before Start and on the Exam screen; its examples use other cells and numbers than the questions. */
export const P3_MATERI: readonly MateriCard[] = [
  {
    id: "l01-p3-sort",
    title: "SORT: urut naik atau turun",
    concept:
      "SORT menampilkan salinan data yang sudah urut; data aslinya tidak berubah. Argumen ketiga `1` berarti naik (kecil ke besar), `-1` turun (besar ke kecil). Kalau range-nya beberapa kolom, argumen kedua memilih kolom kuncinya.",
    example: { formula: "=SORT(C2:C9,1,1)", note: "isi C2:C9 dari yang terkecil ke yang terbesar." },
    steps: [
      "Klik satu sel kosong untuk hasilnya.",
      "Ketik `=SORT(` → blok range yang mau diurutkan.",
      "Ketik `,1,1)` untuk naik atau `,1,-1)` untuk turun → [[Enter]].",
    ],
    shortcuts: [],
  },
  {
    id: "l01-p3-sortby",
    title: "SORTBY: urut berdasarkan kolom lain",
    concept:
      "SORTBY menampilkan satu kolom, tapi urutannya diambil dari kolom lain. Misalnya nama operator diurutkan dari jam kerjanya.",
    example: { formula: "=SORTBY(B2:B9,D2:D9,1)", note: "operator di kolom B, urut dari jam kerja di kolom D yang paling sedikit." },
    steps: [
      "Ketik `=SORTBY(` → blok kolom yang mau ditampilkan.",
      "Ketik `,` → blok kolom kunci urutannya (jumlah barisnya harus sama).",
      "Ketik `,1)` atau `,-1)` → [[Enter]].",
    ],
    shortcuts: [],
  },
  {
    id: "l01-p3-spill",
    title: "Spill: cukup satu sel",
    concept:
      "Rumus SORT dan SORTBY mengisi banyak sel sekaligus dari satu sel (spill). Sel di bawahnya jangan diisi: kalau terhalang, muncul `#SPILL!`.",
    example: { formula: "=SORT(F2:F7,1,-1)", note: "ditulis di H2 saja; H3 sampai H7 terisi sendiri." },
    steps: [
      "Tulis rumus hanya di sel paling atas.",
      "Kalau muncul `#SPILL!`, klik selnya untuk melihat sel yang menghalangi.",
      "Kosongkan sel penghalang dengan [[Delete]]: hasilnya langsung muncul.",
    ],
    shortcuts: ["Delete"],
  },
];

export const practice3: LevelItem<FondasiScenario> = {
  id: "L01-P3",
  kind: "practice",
  number: 3,
  materi: P3_MATERI,
  generate,
};
