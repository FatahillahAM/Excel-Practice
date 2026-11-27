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
import { FINISH_LINE, tipOf } from "./batches";
import { TIPS } from "./practice-1";
import type { FondasiScenario } from "./scenarios";

/**
 * Level 1 · Practice 5 (`L01-P5`): mixed references and fill. Data A1:B{p+1}
 * holds the scenario's products (p = 3–5, shuffled) with their Unit per Jam,
 * C1:F1 four working-hour options, H1:K1 their labels, and M1:N{d+1} the
 * units of d days (d = 5–7). Three questions, 100 points:
 *
 * | # | Points | Answer      | Expected formula (top-left cell) |
 * |---|--------|-------------|----------------------------------|
 * | 1 | 40     | C2:F{p+1}   | `=$B2*C$1`                       |
 * | 2 | 30     | H2:K{p+1}   | `=C2/MAX(C$2:C${p+1})`           |
 * | 3 | 30     | O2:O{d+1}   | `=SUM($N$2:N2)`                  |
 *
 * Question 2 builds on question 1's results (its key comes from the right
 * capacities). Prompts never reveal `$` or F4: that is the hints' job.
 */

export const P5_HEADERS = { product: "Produk", rate: "Unit per Jam", day: "Hari", daily: "Unit Harian", running: "Total Berjalan" } as const;

const MIN_DAYS = 5;
const MAX_DAYS = 7;

const valueCheck: Check = { name: "value_equals_key", tolerance: KEY_TOLERANCE };
const BASE_CHECKS: Check[] = [{ name: "formula_present" }, { name: "not_hard_coded" }, valueCheck];

/** The Tips of L01-P5 (Excel 2021 features only); `mixed` is L01-P1's card. */
export const P5_TIPS = {
  mixed: TIPS.mixed,
  mixedRange: {
    id: "l01-range-campuran",
    title: "Kunci baris pada sebuah range",
    body:
      "Referensi campuran juga berlaku untuk range: kunci barisnya saja supaya range tetap mencakup baris yang sama saat disalin ke bawah, " +
      "tetapi ikut pindah kolom saat disalin ke kanan. Tekan F4 pada tiap ujung range sampai bentuknya pas.",
    shortcuts: ["F4"],
  },
  running: {
    id: "l01-total-berjalan",
    title: "Total berjalan dengan range yang memanjang",
    body:
      "Untuk total berjalan, kunci awal range dan biarkan ujungnya bebas: saat disalin ke bawah, range ikut memanjang satu baris setiap kali. " +
      "Klik dua kali kotak kecil di pojok kanan bawah sel (fill handle) untuk menyalin sampai baris terakhir data, atau blok lalu Ctrl+D.",
    shortcuts: ["Ctrl+D"],
  },
} as const satisfies Record<string, Tip>;

const col = (letter: string) => columnNumber(letter);

function generate(seed: number, scenario: FondasiScenario): GeneratedExam {
  const random = createRandom(seed);
  // Draw order is part of the content: changing it changes every exam (bump contentVersion).
  const products = random.shuffle(scenario.products).map((product) => ({
    name: product.name,
    // Unit per Jam: a batch's units spread over roughly a working day.
    rate: random.int(Math.max(1, Math.round(product.units.min / 10)), Math.max(1, Math.round(product.units.max / 8))),
  }));
  const firstHours = random.pick([6, 7, 8]);
  const hours = [0, 1, 2, 3].map((i) => firstHours + i);
  const days = random.int(MIN_DAYS, MAX_DAYS);
  const unitsRange = scenario.products[0].units;
  const daily = Array.from({ length: days }, () => random.int(unitsRange.min, unitsRange.max));

  const p = products.length;
  const gridLast = p + 1;
  const dayLast = days + 1;
  const data: Record<string, ExamCellValue> = {};
  data.A1 = P5_HEADERS.product;
  data.B1 = P5_HEADERS.rate;
  products.forEach((product, r) => {
    data[`A${r + 2}`] = product.name;
    data[`B${r + 2}`] = product.rate;
  });
  hours.forEach((h, c) => {
    data[cellRef(col("C") + c, 1)] = h;
    data[cellRef(col("H") + c, 1)] = `Porsi ${h} Jam`;
  });
  data.M1 = P5_HEADERS.day;
  data.N1 = P5_HEADERS.daily;
  data.O1 = P5_HEADERS.running;
  daily.forEach((units, r) => {
    data[`M${r + 2}`] = `Hari ${r + 1}`;
    data[`N${r + 2}`] = units;
  });

  const capacity = products.map((product) => hours.map((h) => product.rate * h));
  const capacityKey: Record<string, number> = {};
  const shareKey: Record<string, number> = {};
  hours.forEach((_, c) => {
    const max = Math.max(...capacity.map((row) => row[c]));
    capacity.forEach((row, r) => {
      capacityKey[cellRef(col("C") + c, r + 2)] = row[c];
      shareKey[cellRef(col("H") + c, r + 2)] = row[c] / max;
    });
  });
  const runningKey: Record<string, number> = {};
  let running = 0;
  daily.forEach((units, r) => {
    running += units;
    runningKey[`O${r + 2}`] = running;
  });

  const questions: ExamQuestion[] = [
    {
      number: 1,
      prompt:
        `Di C2:F${gridLast}, hitung kapasitas produksi: "${P5_HEADERS.rate}" di kolom B dikali jumlah jam kerja di C1:F1. ` +
        `Tulis satu rumus di C2 yang tetap benar saat disalin ke kanan dan ke bawah sampai F${gridLast}.`,
      points: 40,
      sheet: DATA_SHEET,
      range: `C2:F${gridLast}`,
      checks: [...BASE_CHECKS, { name: "uses_reference", ref: "$B2" }, { name: "uses_reference", ref: "C$1" }],
      key: capacityKey,
      hints: [
        `Setiap sel di C2:F${gridLast} memakai Unit per Jam di kolom B pada baris yang sama, dan jam kerja di baris 1 pada kolom yang sama.`,
        "Saat disalin ke kanan, rujukan ke kolom B tidak boleh pindah kolom; saat disalin ke bawah, rujukan ke baris 1 tidak boleh pindah baris. Hanya satu bagian tiap referensi yang dikunci.",
        "Tekan F4 berulang untuk berganti bentuk referensi: A1 → $A$1 → A$1 → $A1. Untuk Unit per Jam kunci kolomnya saja, untuk jam kerja kunci barisnya saja.",
      ],
      tip: tipOf(P5_TIPS.mixed),
    },
    {
      number: 2,
      prompt:
        `Di H2:K${gridLast}, hitung porsi tiap kapasitas di C2:F${gridLast} terhadap kapasitas terbesar di kolom yang sama (pakai MAX). ` +
        `Tulis satu rumus di H2 yang tetap benar saat disalin ke kanan dan ke bawah sampai K${gridLast}.`,
      points: 30,
      sheet: DATA_SHEET,
      range: `H2:K${gridLast}`,
      checks: [...BASE_CHECKS, { name: "uses_functions", functions: ["MAX"] }, { name: "uses_reference", ref: `C$2:C$${gridLast}` }],
      key: shareKey,
      hints: [
        "Porsi = kapasitas di sel itu dibagi kapasitas terbesar di kolomnya. Produk dengan kapasitas terbesar mendapat porsi 1.",
        "Range di dalam MAX harus selalu baris 2 sampai baris terakhir produk, tetapi ikut pindah kolom saat disalin ke kanan supaya tiap jam kerja dibandingkan dengan kolomnya sendiri.",
        "Di dalam MAX, kunci barisnya saja di kedua ujung range dengan F4; kapasitas di pembilang dibiarkan tanpa $.",
      ],
      tip: tipOf(P5_TIPS.mixedRange),
    },
    {
      number: 3,
      prompt:
        `Di O2:O${dayLast}, hitung ${P5_HEADERS.running}: jumlah "${P5_HEADERS.daily}" dari Hari 1 sampai hari di baris itu, dengan SUM. ` +
        `Tulis satu rumus di O2, lalu salin ke bawah sampai O${dayLast}.`,
      points: 30,
      sheet: DATA_SHEET,
      range: `O2:O${dayLast}`,
      checks: [...BASE_CHECKS, { name: "uses_functions", functions: ["SUM"] }, { name: "uses_reference", ref: "$N$2:N2" }],
      key: runningKey,
      hints: [
        "Total berjalan di suatu hari adalah jumlah semua Unit Harian dari hari pertama sampai hari itu.",
        "Range di dalam SUM selalu mulai dari baris Hari 1, tetapi ujungnya turun satu baris setiap kali rumus disalin ke bawah.",
        "Kunci awal range dengan F4 sampai kolom dan barisnya terkunci, dan biarkan ujung range tanpa $.",
      ],
      tip: tipOf(P5_TIPS.running),
    },
  ];

  const instructions: Record<string, string> = {
    [INSTRUCTIONS_CELLS.title]: `Level 1 · Practice 5 — ${scenario.title}`,
    [INSTRUCTIONS_CELLS.scenario]:
      `${scenario.story}\n` +
      `Produk dan Unit per Jam ada di sheet "Data" (A1:B${gridLast}), jam kerja di C1:F1, dan produksi ${days} hari di M1:N${dayLast}. ` +
      "Tulis jawabanmu di sel yang disebut tiap soal, lalu klik Finish.",
  };
  questions.forEach((question) => {
    instructions[INSTRUCTIONS_CELLS.lines[question.number - 1]] = `${question.number}. ${question.prompt}`;
  });
  instructions[INSTRUCTIONS_CELLS.lines[questions.length]] = FINISH_LINE;

  return { cells: { [INSTRUCTIONS_SHEET]: instructions, [DATA_SHEET]: data }, questions };
}

/** The Materi of L01-P5 (5.7): read before Start and on the Exam screen; its examples use other cells and numbers than the questions. */
export const P5_MATERI: readonly MateriCard[] = [
  {
    id: "l01-p5-tabel-dua-arah",
    title: "Referensi campuran untuk tabel dua arah",
    concept:
      "Di tabel dua arah, nilai baris ada di kolom kiri dan nilai kolom ada di baris atas. Kunci kolomnya saja di kiri (`$A2`) dan barisnya saja di atas (`B$1`).",
    example: { formula: "=$A2*B$1", note: "judul kiri × judul atas; tetap benar saat di-copy ke kanan dan ke bawah." },
    steps: [
      "Ketik rumus di sel kiri-atas tabel.",
      "Di `A2` tekan [[F4]] tiga kali sampai jadi `$A2`; di `B1` dua kali sampai jadi `B$1`.",
      "Blok seluruh tabel → [[Ctrl+D]] lalu [[Ctrl+R]].",
    ],
    shortcuts: ["F4", "Ctrl+D", "Ctrl+R"],
  },
  {
    id: "l01-p5-bagi-max-kolom",
    title: "Bagi dengan MAX kolom",
    concept:
      "Untuk membandingkan tiap nilai dengan yang terbesar di kolomnya, bagi dengan MAX kolom itu. Kunci barisnya saja, supaya range tetap saat di-copy ke bawah tapi ikut pindah kolom saat di-copy ke kanan.",
    example: { formula: "=B3/MAX(B$3:B$9)", note: "1 berarti nilai terbesar di kolom B; di-copy ke kanan jadi kolom C." },
    steps: [
      "Ketik `=B3/MAX(` → blok B3:B9.",
      "Tekan [[F4]] dua kali sampai jadi `B$3:B$9` → `)` → [[Enter]].",
      "Isi ke bawah dengan [[Ctrl+D]] dan ke kanan dengan [[Ctrl+R]].",
    ],
    shortcuts: ["F4"],
  },
  {
    id: "l01-p5-total-berjalan",
    title: "Total berjalan dengan `SUM($C$3:C3)`",
    concept:
      "Total berjalan menjumlahkan dari baris pertama sampai baris itu. Kunci awal range dengan `$`, biarkan ujungnya bebas supaya range memanjang saat di-copy ke bawah.",
    example: { formula: "=SUM($C$3:C3)", note: "di baris 4 jadi `SUM($C$3:C4)`, dan seterusnya." },
    steps: [
      "Ketik `=SUM(` → klik sel pertama → [[F4]] sampai jadi `$C$3`.",
      "Ketik `:` → klik sel yang sama lagi → `)` → [[Enter]].",
      "Klik dua kali fill handle, atau blok ke bawah → [[Ctrl+D]].",
    ],
    shortcuts: ["F4", "Ctrl+D"],
  },
];

export const practice5: LevelItem<FondasiScenario> = {
  id: "L01-P5",
  kind: "practice",
  number: 5,
  materi: P5_MATERI,
  generate,
};
