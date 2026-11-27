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
import { DATA_HEADERS } from "./practice-1";
import type { FondasiScenario } from "./scenarios";

/**
 * Level 1 · Practice 2 (`L01-P2`): Excel Table. Data A1:G{n+1} holds the
 * batches (n = 12–20); column H stays empty so Ctrl+T finds exactly the data.
 * J2:J5 label a summary whose answers go in K2:K5, outside the Table. Four
 * questions, 100 points:
 *
 * | # | Points | Answer | Checks beyond the formula and value      | Expected formula (one form)        |
 * |---|--------|--------|------------------------------------------|------------------------------------|
 * | 1 | 40     | K2     | `is_table` A1:G{n+1}, `uses_functions` SUM | `=SUM(Table1[Unit Diproduksi])`  |
 * | 2 | 20     | K3     | `uses_functions` SUM                     | `=SUM(Table1[Unit Cacat])`         |
 * | 3 | 20     | K4     | `uses_functions` COUNTA                  | `=COUNTA(Table1[Kode Batch])`      |
 * | 4 | 20     | K5     | `uses_functions` MAX                     | `=MAX(Table1[Unit Diproduksi])`    |
 *
 * Plain ranges (`=SUM(E2:E13)`) pass as well: the checks never compare
 * reference text here, so structured references and ranges both count. The
 * Table check is structural only (range with header row, header row on,
 * column names = the data headers), never its name or style.
 */

export const SUMMARY_LABELS = {
  units: "Total Unit Diproduksi",
  defects: "Total Unit Cacat",
  batches: "Jumlah Batch",
  max: "Unit Diproduksi Tertinggi",
} as const;

const valueCheck: Check = { name: "value_equals_key", tolerance: KEY_TOLERANCE };
const BASE_CHECKS: Check[] = [{ name: "formula_present" }, { name: "not_hard_coded" }];

/** The Tips of L01-P2 (Excel 2021 features only); `table` is shared with the Test, `autosum` was the Test's in 5.1. */
export const P2_TIPS = {
  table: {
    id: "l01-ctrl-t-table",
    title: "Jadikan data Excel Table dengan Ctrl+T",
    body:
      "Klik satu sel di dalam data lalu tekan Ctrl+T. Pastikan My table has headers dicentang, lalu OK. " +
      "Table ikut melebar saat baris baru ditambahkan, dan tombol filter langsung terpasang di judul kolom.",
    shortcuts: ["Ctrl+T"],
  },
  totalRow: {
    id: "l01-total-row-table",
    title: "Total Row tanpa mengetik rumus",
    body:
      "Klik satu sel di dalam Table lalu tekan Ctrl+Shift+T untuk memunculkan Total Row di bawah Table. " +
      "Klik sel di baris itu untuk memilih Sum, Count, Max, atau Average dari daftarnya.",
    shortcuts: ["Ctrl+Shift+T"],
  },
  columnName: {
    id: "l01-nama-kolom-table",
    title: "Rumus dengan nama kolom Table",
    body:
      "Saat mengetik rumus, blok isi satu kolom Table dengan mouse: Excel menulis nama kolomnya, misalnya Table1[Kode Batch], bukan alamat sel. " +
      "Rumus seperti ini tetap mencakup semua baris walau Table bertambah panjang. Ctrl+Space memilih isi kolom Table tempat kursor berada.",
    shortcuts: ["Ctrl+Space"],
  },
  autosum: {
    id: "l01-autosum-cepat",
    title: "Ringkasan cepat dengan AutoSum",
    body:
      "Klik sel kosong di bawah atau di samping angka lalu tekan Alt+= untuk menulis SUM otomatis. " +
      "Panah kecil di tombol AutoSum (Home → Editing) juga punya Max, Min, Average, dan Count Numbers.",
    shortcuts: ["Alt+="],
  },
} as const satisfies Record<string, Tip>;

function generate(seed: number, scenario: FondasiScenario): GeneratedExam {
  const random = createRandom(seed);
  // Draw order is part of the content: changing it changes every exam (bump contentVersion).
  const batches = drawBatches(random, scenario);
  const n = batches.length;
  const last = n + 1;

  const data = batchCells(batches);
  data.J2 = SUMMARY_LABELS.units;
  data.J3 = SUMMARY_LABELS.defects;
  data.J4 = SUMMARY_LABELS.batches;
  data.J5 = SUMMARY_LABELS.max;

  const tableCheck: Check = { name: "is_table", ref: `A1:G${last}`, headers: [...DATA_HEADERS] };
  const questions: ExamQuestion[] = [
    {
      number: 1,
      prompt:
        `Ubah data A1:G${last} jadi Excel Table, dengan judul kolom di baris 1 sebagai header. ` +
        `Lalu di K2, hitung ${SUMMARY_LABELS.units}: jumlah semua "Unit Diproduksi" dengan fungsi SUM.`,
      points: 40,
      sheet: DATA_SHEET,
      range: "K2",
      checks: [tableCheck, ...BASE_CHECKS, { name: "uses_functions", functions: ["SUM"] }, valueCheck],
      key: { K2: batches.reduce((sum, batch) => sum + batch.units, 0) },
      hints: [
        "Excel Table dibuat dari data yang judul kolomnya ada di baris pertama. Kolom kosong di sebelah kanan data menjadi batasnya, jadi tidak perlu memblok semuanya.",
        "Klik satu sel di dalam data lalu buat Table dari tab Insert atau dengan shortcut. Pastikan pilihan bahwa data punya header dicentang supaya baris 1 tidak berubah jadi Column1, Column2, dan seterusnya.",
        "Setelah Table jadi, tulis SUM di K2 atas seluruh isi kolom Unit Diproduksi, tanpa judul kolomnya. Memblok kolom itu dengan mouse membuat Excel menulis nama kolom Table.",
      ],
      tip: tipOf(P2_TIPS.table),
    },
    {
      number: 2,
      prompt: `Di K3, hitung ${SUMMARY_LABELS.defects}: jumlah semua "Unit Cacat" dengan fungsi SUM.`,
      points: 20,
      sheet: DATA_SHEET,
      range: "K3",
      checks: [...BASE_CHECKS, { name: "uses_functions", functions: ["SUM"] }, valueCheck],
      key: { K3: batches.reduce((sum, batch) => sum + batch.defects, 0) },
      hints: [
        "Totalnya diambil dari satu kolom saja: Unit Cacat.",
        "Jangan ketik angkanya: kalau data berubah, totalnya harus ikut berubah.",
        `SUM menerima satu range. Pakai isi kolom Unit Cacat dari baris 2 sampai baris ${last}, atau nama kolomnya di Table.`,
      ],
      tip: tipOf(P2_TIPS.totalRow),
    },
    {
      number: 3,
      prompt: `Di K4, hitung ${SUMMARY_LABELS.batches} dengan fungsi COUNTA atas kolom "Kode Batch" (tanpa judul kolomnya).`,
      points: 20,
      sheet: DATA_SHEET,
      range: "K4",
      checks: [...BASE_CHECKS, { name: "uses_functions", functions: ["COUNTA"] }, valueCheck],
      key: { K4: n },
      hints: [
        "Setiap batch punya satu Kode Batch, jadi jumlah batch sama dengan jumlah sel Kode Batch yang terisi.",
        "COUNTA menghitung sel yang tidak kosong, termasuk teks. COUNT hanya menghitung angka, jadi tidak cocok untuk kode.",
        "Kalau judul kolom ikut terhitung, hasilnya kelebihan satu. Pakai isi kolom saja, atau nama kolom Table yang memang tanpa judul.",
      ],
      tip: tipOf(P2_TIPS.columnName),
    },
    {
      number: 4,
      prompt: `Di K5, tampilkan ${SUMMARY_LABELS.max} dengan fungsi MAX atas kolom "Unit Diproduksi".`,
      points: 20,
      sheet: DATA_SHEET,
      range: "K5",
      checks: [...BASE_CHECKS, { name: "uses_functions", functions: ["MAX"] }, valueCheck],
      key: { K5: Math.max(...batches.map((batch) => batch.units)) },
      hints: [
        "Angka tertinggi cukup dicari dari satu kolom: Unit Diproduksi.",
        "Jangan ketik angkanya: kalau data berubah, hasilnya harus ikut berubah.",
        "MAX menerima satu range atau satu kolom Table. Rumus ini tidak disalin, jadi $ tidak wajib.",
      ],
      tip: tipOf(P2_TIPS.autosum),
    },
  ];

  const instructions: Record<string, string> = {
    [INSTRUCTIONS_CELLS.title]: `Level 1 · Practice 2 — ${scenario.title}`,
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

/** The Materi of L01-P2 (5.7): read before Start and on the Exam screen; its examples use other cells and numbers than the questions. */
export const P2_MATERI: readonly MateriCard[] = [
  {
    id: "l01-p2-ctrl-t",
    title: "Excel Table: [[Ctrl+T]] dan My table has headers",
    concept:
      "Excel Table mengubah range biasa jadi tabel bernama: ikut melebar saat baris baru ditambah, dan tiap kolom bisa dipanggil pakai namanya.",
    example: { formula: "=ROWS(Table1)", note: "jumlah baris data di Table1; baris judul tidak dihitung." },
    steps: [
      "Klik satu sel di dalam data.",
      "Tekan [[Ctrl+T]].",
      "Pastikan `My table has headers` dicentang → OK.",
    ],
    shortcuts: ["Ctrl+T"],
  },
  {
    id: "l01-p2-structured-reference",
    title: "Structured reference `Table1[Kolom]`",
    concept:
      "Di rumus, kolom Table ditulis dengan namanya, bukan alamat sel. Rumusnya tetap mencakup semua baris walau Table bertambah panjang.",
    example: { formula: "=AVERAGE(Table1[Jam Mesin])", note: "rata-rata seluruh isi kolom Jam Mesin." },
    steps: [
      "Ketik `=AVERAGE(`.",
      "Blok isi kolom Jam Mesin dengan mouse: Excel menulis `Table1[Jam Mesin]` sendiri.",
      "Ketik `)` → [[Enter]].",
    ],
    shortcuts: [],
  },
  {
    id: "l01-p2-sum-counta-max",
    title: "SUM, COUNTA, dan MAX pada kolom Table",
    concept:
      "SUM menjumlahkan angka, COUNTA menghitung sel yang terisi (teks juga dihitung), MAX mengambil nilai terbesar. Ketiganya bisa langsung diberi satu kolom Table.",
    example: { formula: "=MAX(Table1[Suhu Oven])", note: "suhu oven tertinggi dari semua baris Table." },
    steps: [
      "Klik sel di luar Table untuk hasilnya.",
      "Ketik `=MAX(` → blok kolom Suhu Oven → `)` → [[Enter]].",
      "Ganti `MAX` dengan `SUM` untuk total, atau `COUNTA` untuk menghitung baris yang terisi.",
    ],
    shortcuts: [],
  },
  {
    id: "l01-p2-autosum",
    title: "AutoSum dengan [[Alt+=]]",
    concept:
      "AutoSum menulis rumus SUM sendiri untuk angka di atas sel aktif. Cek dulu range yang ditebak Excel sebelum [[Enter]].",
    example: { formula: "=SUM(D2:D8)", note: "hasil AutoSum di D9: total D2 sampai D8." },
    steps: [
      "Klik sel kosong tepat di bawah kolom angka.",
      "Tekan [[Alt+=]].",
      "Periksa range yang diblok Excel → [[Enter]].",
    ],
    shortcuts: ["Alt+="],
  },
];

export const practice2: LevelItem<FondasiScenario> = {
  id: "L01-P2",
  kind: "practice",
  number: 2,
  materi: P2_MATERI,
  generate,
};
