import { DATA_SHEET, type ExamQuestion, type GeneratedExam, type LevelItem, type MateriCard, type Tip } from "@/core/content/level-module";
import { createRandom, type Random } from "@/core/content/random";
import { BASE_CHECKS, usesIfOrIfs, drawCovering, type Outcomes, PARAM_LABELS, columnKey, dataCells, drawBatches, examOf, splitLimit, tipOf, usesFunctions, usesReference } from "./batches";
import type { LogikaScenario } from "./scenarios";

/**
 * Level 2 · Practice 5 (`L02-P5`): IF, AND/OR, IFS and IFERROR mixed. O2
 * target, O3 defect limit, O4 downtime limit; at least one batch without
 * downtime.
 *
 * | # | Points | Answer    | Expected formula (top cell)                                   |
 * |---|--------|-----------|---------------------------------------------------------------|
 * | 1 | 25     | H2:H{n+1} | `=IF(AND(E2>=$O$2,G2<=$O$4),"Lancar","Terganggu")`            |
 * | 2 | 25     | I2:I{n+1} | `=IFS(G2>$O$4,"Tinggi",G2>0,"Rendah",TRUE,"Tidak Ada")`       |
 * | 3 | 25     | J2:J{n+1} | `=IFERROR((E2-F2)/G2,"Tanpa Downtime")`                       |
 * | 4 | 25     | K2:K{n+1} | `=IF(OR(H2="Terganggu",F2>$O$3),"Ya","Tidak")`                |
 *
 * Q2 requires IF or IFS (either); Q4 may read the answer column H (or recompute it).
 */

export const P5_HEADERS = { line: "Status Lini", repair: "Prioritas Perbaikan", goodPerMinute: "Unit Baik per Menit", review: "Tinjau" } as const;
export const P5_TEXT = {
  smooth: "Lancar",
  disturbed: "Terganggu",
  high: "Tinggi",
  low: "Rendah",
  none: "Tidak Ada",
  noDowntime: "Tanpa Downtime",
  yes: "Ya",
  no: "Tidak",
} as const;

export const P5_TIPS = {
  evaluate: {
    id: "l02-evaluate-formula",
    title: "Lihat langkah hitung rumus dengan Evaluate Formula",
    body:
      "Di tab Formulas, Evaluate Formula menjalankan rumus selangkah demi selangkah: syarat AND atau OR berubah menjadi TRUE atau FALSE, lalu IF memilih hasilnya. " +
      "Cara cepat membukanya: Alt lalu M, V.",
    shortcuts: ["F9"],
  },
  conditions: {
    id: "l02-tiga-kategori",
    title: "Tiga kategori dari satu kolom",
    body:
      "Untuk tiga kategori dari satu angka, IFS dan IF bertingkat sama benarnya. Tulis syarat dari yang paling ketat, dan tutup dengan hasil untuk sisanya. " +
      "Nol juga angka: syarat lebih dari nol memisahkan baris yang tidak punya downtime.",
    shortcuts: ["Alt+Enter"],
  },
  parentheses: {
    id: "l02-kurung-sebelum-bagi",
    title: "Kurung dulu, baru bagi",
    body:
      "Excel menghitung kali dan bagi sebelum tambah dan kurang. Bila selisih dua sel yang harus dibagi, bungkus selisihnya dengan kurung. " +
      "Saat mengetik, Excel mewarnai pasangan kurung supaya mudah dicek.",
    shortcuts: ["F2"],
  },
  chain: {
    id: "l02-rujuk-kolom-hasil",
    title: "Rumus boleh merujuk kolom hasil rumus lain",
    body:
      "Kolom yang sudah berisi hasil IF bisa dipakai lagi sebagai syarat rumus berikutnya, jadi syarat yang sama tidak perlu ditulis ulang. " +
      "Ctrl+[ memilih sel yang dirujuk rumus aktif, untuk mengecek rumus itu membaca kolom yang benar.",
    shortcuts: ["Ctrl+["],
  },
} as const satisfies Record<string, Tip>;

/** Every outcome each question's keys must show (`outcomeOf`): every generated exam has them all. */
export const P5_OUTCOMES: Outcomes = [[P5_TEXT.smooth, P5_TEXT.disturbed], [P5_TEXT.high, P5_TEXT.low, P5_TEXT.none], [P5_TEXT.noDowntime, "number"], [P5_TEXT.yes, P5_TEXT.no]];

function generate(seed: number, scenario: LogikaScenario): GeneratedExam {
  const random = createRandom(seed);
  return drawCovering(P5_OUTCOMES, () => build(random, scenario));
}

function build(random: Random, scenario: LogikaScenario): GeneratedExam {
  const batches = drawBatches(random, scenario);
  if (!batches.some((b) => b.downtime === 0)) batches[random.int(0, batches.length - 1)].downtime = 0;
  const target = splitLimit(random, batches.map((b) => b.units), 10);
  const defectLimit = splitLimit(random, batches.map((b) => b.defects), 1);
  const downtimeLimit = splitLimit(random, batches.map((b) => b.downtime), 5);
  const last = batches.length + 1;

  const data = dataCells(batches, Object.values(P5_HEADERS), [
    [PARAM_LABELS.target, target],
    [PARAM_LABELS.defects, defectLimit],
    [PARAM_LABELS.downtime, downtimeLimit],
  ]);

  const smooth = (b: (typeof batches)[number]) => b.units >= target && b.downtime <= downtimeLimit;

  const questions: ExamQuestion[] = [
    {
      number: 1,
      prompt:
        `Di H2:H${last}, isi ${P5_HEADERS.line}: "${P5_TEXT.smooth}" bila "Unit Diproduksi" minimal ${PARAM_LABELS.target} di O2 dan "Downtime (menit)" paling lama ${PARAM_LABELS.downtime} di O4, ` +
        `selain itu "${P5_TEXT.disturbed}". Rumus di H2 harus tetap benar saat disalin ke bawah sampai H${last}.`,
      points: 25,
      sheet: DATA_SHEET,
      range: `H2:H${last}`,
      checks: [...BASE_CHECKS, usesFunctions("AND"), usesReference("$O$2"), usesReference("$O$4")],
      key: columnKey("H", batches, (b) => (smooth(b) ? P5_TEXT.smooth : P5_TEXT.disturbed)),
      hints: [
        "Lancar butuh dua syarat benar bersamaan: target tercapai dan downtime tidak lewat batas.",
        "Dua syarat sekaligus berarti AND di dalam IF. Paling lama berarti <=.",
        "Target dan batas downtime dikunci dengan F4 sebelum rumus disalin.",
      ],
      tip: tipOf(P5_TIPS.evaluate),
    },
    {
      number: 2,
      prompt:
        `Di I2:I${last}, isi ${P5_HEADERS.repair}: "${P5_TEXT.high}" bila "Downtime (menit)" lebih dari batas di O4, "${P5_TEXT.low}" bila downtime-nya lebih dari 0, ` +
        `selain itu "${P5_TEXT.none}". Boleh IFS atau IF bertingkat. Rumus di I2 harus tetap benar saat disalin ke bawah sampai I${last}.`,
      points: 25,
      sheet: DATA_SHEET,
      range: `I2:I${last}`,
      checks: [...BASE_CHECKS, usesIfOrIfs, usesReference("$O$4")],
      key: columnKey("I", batches, (b) => (b.downtime > downtimeLimit ? P5_TEXT.high : b.downtime > 0 ? P5_TEXT.low : P5_TEXT.none)),
      hints: [
        "Tiga hasil dari satu kolom Downtime: cek yang paling lama dulu, lalu yang lebih dari nol.",
        "Dengan IFS, hasil terakhir diberi syarat TRUE. Dengan IF bertingkat, hasil terakhir adalah bagian salah dari IF kedua.",
        "Batas downtime dikunci dengan F4; angka nol boleh ditulis langsung.",
      ],
      tip: tipOf(P5_TIPS.conditions),
    },
    {
      number: 3,
      prompt:
        `Di J2:J${last}, hitung ${P5_HEADERS.goodPerMinute}: selisih "Unit Diproduksi" dan "Unit Cacat", dibagi "Downtime (menit)". ` +
        `Batch tanpa downtime berisi "${P5_TEXT.noDowntime}"; pakai IFERROR. Salin rumus di J2 ke bawah sampai J${last}.`,
      points: 25,
      sheet: DATA_SHEET,
      range: `J2:J${last}`,
      checks: [...BASE_CHECKS, usesFunctions("IFERROR")],
      key: columnKey("J", batches, (b) => (b.downtime === 0 ? P5_TEXT.noDowntime : (b.units - b.defects) / b.downtime)),
      hints: [
        "Unit baik adalah Unit Diproduksi dikurangi Unit Cacat. Hasil pengurangan itu yang dibagi downtime.",
        "Tanpa kurung, Excel membagi dulu baru mengurangi. Kurung pengurangannya sebelum dibagi.",
        "Pembagian dengan downtime nol menghasilkan error; bungkus seluruh pembagian dengan IFERROR dan teks penggantinya.",
      ],
      tip: tipOf(P5_TIPS.parentheses),
    },
    {
      number: 4,
      prompt:
        `Di K2:K${last}, isi ${P5_HEADERS.review}: "${P5_TEXT.yes}" bila ${P5_HEADERS.line} di kolom H "${P5_TEXT.disturbed}" atau "Unit Cacat" lebih dari ${PARAM_LABELS.defects} di O3, ` +
        `selain itu "${P5_TEXT.no}". Rumus di K2 harus tetap benar saat disalin ke bawah sampai K${last}.`,
      points: 25,
      sheet: DATA_SHEET,
      range: `K2:K${last}`,
      checks: [...BASE_CHECKS, usesFunctions("OR"), usesReference("$O$3")],
      key: columnKey("K", batches, (b) => (!smooth(b) || b.defects > defectLimit ? P5_TEXT.yes : P5_TEXT.no)),
      hints: [
        "Cukup salah satu syarat benar: status linenya terganggu, atau cacatnya lewat batas. Itu tugas OR.",
        "Hasil soal 1 di kolom H bisa dibandingkan langsung dengan teks statusnya, dalam tanda kutip.",
        "Batas cacat dikunci dengan F4; sel kolom H dan Unit Cacat di baris yang sama tidak.",
      ],
      tip: tipOf(P5_TIPS.chain),
    },
  ];

  return examOf("Level 2 · Practice 5", scenario, batches, "", data, questions);
}

/** The Materi of L02-P5 (5.7): a recap of the level on other cells and situations (raw material, packing). */
export const P5_MATERI: readonly MateriCard[] = [
  {
    id: "l02-p5-gabung",
    title: "Gabungkan `IF`, `AND`, `OR`",
    concept: "`AND` dan `OR` menjadi syarat `IF`. Pakai `AND` bila semua syarat wajib, `OR` bila cukup satu.",
    example: { formula: '=IF(OR(K4="Rusak",L4<5),"Pesan","-")', note: "bahan baku di K4 rusak atau stok di L4 di bawah 5 → \"Pesan\"." },
    steps: ["Tentukan dulu: semua syarat wajib, atau cukup satu?", "Cek bagian syarat dengan [[F9]], lalu [[Esc]]."],
    shortcuts: ["F9", "Esc"],
  },
  {
    id: "l02-p5-kurung",
    title: "Urutan hitung dan kurung",
    concept: "Excel menghitung `*` dan `/` sebelum `+` dan `-`. Kurung memaksa bagian di dalamnya dihitung lebih dulu.",
    example: { formula: "=(B6+C6)/D6", note: "jumlah dua karton dibagi jam kemas di D6." },
    steps: ["Tulis bagian yang harus dihitung dulu di dalam kurung.", "Excel mewarnai pasangan kurung saat kamu mengetik."],
    shortcuts: ["F2"],
  },
  {
    id: "l02-p5-rujuk-hasil",
    title: "Merujuk kolom hasil rumus",
    concept: "Kolom berisi hasil `IF` bisa dipakai lagi sebagai syarat rumus lain, misalnya membandingkannya dengan teks status.",
    example: { formula: '=IF(M4="Pesan",N4*2,0)', note: "kolom M hasil rumus lain; baris \"Pesan\" dipesan dua kali lipat." },
    steps: ["Klik sel hasil rumus lain saat menulis syarat.", "[[Ctrl+[]] memilih sel yang dirujuk rumus aktif."],
    shortcuts: ["Ctrl+["],
  },
];

export const practice5: LevelItem<LogikaScenario> = {
  id: "L02-P5",
  kind: "practice",
  number: 5,
  materi: P5_MATERI,
  generate,
};
