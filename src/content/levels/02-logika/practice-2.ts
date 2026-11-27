import { DATA_SHEET, type ExamQuestion, type GeneratedExam, type LevelItem, type MateriCard, type Tip } from "@/core/content/level-module";
import { createRandom, type Random } from "@/core/content/random";
import { BASE_CHECKS, drawCovering, type Outcomes, PARAM_LABELS, columnKey, dataCells, drawBatches, examOf, splitLimit, tipOf, usesFunctions, usesReference } from "./batches";
import type { LogikaScenario } from "./scenarios";

/**
 * Level 2 · Practice 2 (`L02-P2`): AND and OR inside IF. O2 target, O3
 * defect limit, O4 downtime limit, O5 the monitored shift, O6 the audited line.
 *
 * | # | Points | Answer    | Expected formula (top cell)                              |
 * |---|--------|-----------|----------------------------------------------------------|
 * | 1 | 30     | H2:H{n+1} | `=IF(AND(E2>=$O$2,F2<=$O$3),"Lolos","Tahan")`            |
 * | 2 | 30     | I2:I{n+1} | `=IF(OR(F2>$O$3,G2>$O$4),"Ya","Tidak")`                  |
 * | 3 | 20     | J2:J{n+1} | `=IF(AND(C2=$O$5,G2>$O$4),"Prioritas","Normal")`         |
 * | 4 | 20     | K2:K{n+1} | `=IF(OR(B2=$O$6,F2=0),"Ambil","Tidak")`                  |
 *
 * Each question requires the function it teaches (AND or OR); IF or IFS
 * around it are both accepted.
 */

export const P2_HEADERS = { qc: "Lolos QC", action: "Perlu Tindakan", priority: "Prioritas Shift", sample: "Sampel Audit" } as const;
export const P2_TEXT = { pass: "Lolos", hold: "Tahan", yes: "Ya", no: "Tidak", priority: "Prioritas", normal: "Normal", take: "Ambil" } as const;

export const P2_TIPS = {
  and: {
    id: "l02-and-semua-syarat",
    title: "AND: semua syarat harus terpenuhi",
    body:
      "AND menghasilkan TRUE hanya bila setiap syarat di dalamnya benar. Untuk mengecek, blok bagian AND di formula bar lalu tekan F9: Excel menampilkan TRUE atau FALSE untuk baris itu. " +
      "Tekan Esc supaya rumusnya tidak berubah.",
    shortcuts: ["F9", "Esc"],
  },
  or: {
    id: "l02-or-salah-satu-syarat",
    title: "OR: cukup satu syarat benar",
    body:
      "OR menghasilkan TRUE bila minimal satu syarat benar, dan FALSE hanya bila semuanya salah. " +
      "AND dan OR sendiri hanya memberi TRUE atau FALSE; bungkus dengan IF untuk mengubahnya menjadi teks yang mudah dibaca.",
    shortcuts: ["F2"],
  },
  text: {
    id: "l02-bandingkan-teks",
    title: "Bandingkan teks dengan sel, bukan ketikan",
    body:
      "Perbandingan teks dengan = tidak membedakan huruf besar dan kecil, tapi spasi berlebih membuatnya gagal. " +
      "Merujuk sel yang berisi nama shift atau lini lebih aman daripada mengetik namanya di rumus, dan cukup mengganti isi sel itu untuk memantau yang lain.",
    shortcuts: ["F4"],
  },
  mix: {
    id: "l02-campur-teks-dan-angka",
    title: "Satu OR, syarat teks dan angka sekaligus",
    body:
      "Syarat di dalam OR boleh berbeda jenis: satu membandingkan teks, yang lain angka. Pisahkan tiap syarat dengan koma (atau titik koma bila Excel memakai pemisah itu). " +
      "Setelah rumus di baris pertama benar, klik dua kali kotak kecil di pojok kanan bawah sel untuk menyalinnya sampai baris terakhir data.",
    shortcuts: ["Ctrl+D"],
  },
} as const satisfies Record<string, Tip>;

/** Every outcome each question's keys must show (`outcomeOf`): every generated exam has them all. */
export const P2_OUTCOMES: Outcomes = [[P2_TEXT.pass, P2_TEXT.hold], [P2_TEXT.yes, P2_TEXT.no], [P2_TEXT.priority, P2_TEXT.normal], [P2_TEXT.take, P2_TEXT.no]];

function generate(seed: number, scenario: LogikaScenario): GeneratedExam {
  const random = createRandom(seed);
  return drawCovering(P2_OUTCOMES, () => build(random, scenario));
}

function build(random: Random, scenario: LogikaScenario): GeneratedExam {
  const batches = drawBatches(random, scenario);
  const target = splitLimit(random, batches.map((b) => b.units), 10);
  const defectLimit = splitLimit(random, batches.map((b) => b.defects), 1);
  const downtimeLimit = splitLimit(random, batches.map((b) => b.downtime), 5);
  // The shift with the most long stops (scenario order on a tie), so question 3 has a "Prioritas" when any batch has one.
  const longStops = (shift: string) => batches.filter((b) => b.shift === shift && b.downtime > downtimeLimit).length;
  const shift = scenario.shifts.reduce((best, candidate) => (longStops(candidate) > longStops(best) ? candidate : best));
  const line = random.pick([...new Set(batches.map((b) => b.line))]);
  const last = batches.length + 1;

  const data = dataCells(batches, Object.values(P2_HEADERS), [
    [PARAM_LABELS.target, target],
    [PARAM_LABELS.defects, defectLimit],
    [PARAM_LABELS.downtime, downtimeLimit],
    [PARAM_LABELS.shift, shift],
    [PARAM_LABELS.line, line],
  ]);

  const questions: ExamQuestion[] = [
    {
      number: 1,
      prompt:
        `Di H2:H${last}, isi ${P2_HEADERS.qc}: tulis "${P2_TEXT.pass}" bila "Unit Diproduksi" minimal ${PARAM_LABELS.target} di O2 dan sekaligus "Unit Cacat" paling banyak ${PARAM_LABELS.defects} di O3; ` +
        `selain itu "${P2_TEXT.hold}". Pakai AND. Rumus di H2 harus tetap benar saat disalin ke bawah sampai H${last}.`,
      points: 30,
      sheet: DATA_SHEET,
      range: `H2:H${last}`,
      checks: [...BASE_CHECKS, usesFunctions("AND"), usesReference("$O$2"), usesReference("$O$3")],
      key: columnKey("H", batches, (b) => (b.units >= target && b.defects <= defectLimit ? P2_TEXT.pass : P2_TEXT.hold)),
      hints: [
        "Ada dua syarat yang harus benar bersamaan: unitnya mencapai target dan cacatnya tidak lewat batas. Dua syarat sekaligus itu tugas AND.",
        "AND ditaruh sebagai syarat IF. Paling banyak berarti <=, minimal berarti >=.",
        "Target dan batas cacat masing-masing ada di satu sel; kunci keduanya dengan F4. Kolom data di baris yang sama tetap tanpa $.",
      ],
      tip: tipOf(P2_TIPS.and),
    },
    {
      number: 2,
      prompt:
        `Di I2:I${last}, isi ${P2_HEADERS.action}: tulis "${P2_TEXT.yes}" bila "Unit Cacat" lebih dari batas di O3 atau "Downtime (menit)" lebih dari batas di O4; ` +
        `bila keduanya tidak, "${P2_TEXT.no}". Pakai OR. Rumus di I2 harus tetap benar saat disalin ke bawah sampai I${last}.`,
      points: 30,
      sheet: DATA_SHEET,
      range: `I2:I${last}`,
      checks: [...BASE_CHECKS, usesFunctions("OR"), usesReference("$O$3"), usesReference("$O$4")],
      key: columnKey("I", batches, (b) => (b.defects > defectLimit || b.downtime > downtimeLimit ? P2_TEXT.yes : P2_TEXT.no)),
      hints: [
        "Batch perlu tindakan cukup bila salah satu masalah terjadi: cacatnya kelewat batas, atau downtime-nya terlalu lama.",
        "OR berisi dua perbandingan yang dipisah koma, lalu OR itu menjadi syarat IF.",
        "Kedua batas ada di sel tetap di kolom O; kunci dengan F4 sebelum menyalin.",
      ],
      tip: tipOf(P2_TIPS.or),
    },
    {
      number: 3,
      prompt:
        `Di J2:J${last}, isi ${P2_HEADERS.priority}: tulis "${P2_TEXT.priority}" bila "Shift" sama dengan ${PARAM_LABELS.shift} di O5 dan "Downtime (menit)" lebih dari batas di O4; ` +
        `selain itu "${P2_TEXT.normal}". Rumus di J2 harus tetap benar saat disalin ke bawah sampai J${last}.`,
      points: 20,
      sheet: DATA_SHEET,
      range: `J2:J${last}`,
      checks: [...BASE_CHECKS, usesFunctions("AND"), usesReference("$O$5"), usesReference("$O$4")],
      key: columnKey("J", batches, (b) => (b.shift === shift && b.downtime > downtimeLimit ? P2_TEXT.priority : P2_TEXT.normal)),
      hints: [
        "Dua syarat yang harus benar bersamaan: shift-nya shift yang dipantau, dan downtime-nya lewat batas.",
        "Shift dibandingkan dengan sel yang berisi nama shift, pakai tanda =. Jangan ketik nama shift-nya di rumus.",
        "Sel nama shift dan sel batas downtime sama-sama dikunci dengan F4; kolom Shift dan Downtime di baris yang sama tidak.",
      ],
      tip: tipOf(P2_TIPS.text),
    },
    {
      number: 4,
      prompt:
        `Di K2:K${last}, isi ${P2_HEADERS.sample}: tulis "${P2_TEXT.take}" bila "Lini" sama dengan ${PARAM_LABELS.line} di O6 atau "Unit Cacat" sama dengan 0; ` +
        `selain itu "${P2_TEXT.no}". Rumus di K2 harus tetap benar saat disalin ke bawah sampai K${last}.`,
      points: 20,
      sheet: DATA_SHEET,
      range: `K2:K${last}`,
      checks: [...BASE_CHECKS, usesFunctions("OR"), usesReference("$O$6")],
      key: columnKey("K", batches, (b) => (b.line === line || b.defects === 0 ? P2_TEXT.take : P2_TEXT.no)),
      hints: [
        "Sampel diambil bila salah satu syarat benar: lininya lini audit, atau batch itu tanpa cacat sama sekali.",
        "Satu syarat membandingkan teks Lini dengan sel lini audit, satu lagi membandingkan Unit Cacat dengan angka nol. Keduanya masuk ke satu OR.",
        "Sel lini audit dikunci dengan F4; angka nol boleh ditulis langsung di syarat.",
      ],
      tip: tipOf(P2_TIPS.mix),
    },
  ];

  return examOf("Level 2 · Practice 2", scenario, batches, "", data, questions);
}

/** The Materi of L02-P2 (5.7): examples on other cells and situations (temperature, humidity, warehouse). */
export const P2_MATERI: readonly MateriCard[] = [
  {
    id: "l02-p2-and",
    title: "`AND`: semua syarat benar",
    concept: "`AND` memberi `TRUE` hanya bila setiap syarat di dalamnya benar. Taruh `AND` sebagai syarat `IF` supaya hasilnya teks yang jelas.",
    example: { formula: '=IF(AND(C4>=20,C4<=25),"Aman","Cek")', note: "suhu gudang di C4 harus di antara 20 dan 25." },
    steps: ["Ketik `=IF(AND(` → syarat 1 → `,` → syarat 2 → `)`.", "Lanjutkan `,` hasil benar `,` hasil salah `)` → [[Enter]]."],
    shortcuts: ["Enter"],
  },
  {
    id: "l02-p2-or",
    title: "`OR`: cukup satu syarat benar",
    concept: "`OR` memberi `TRUE` bila minimal satu syarat benar, dan `FALSE` hanya bila semuanya salah.",
    example: { formula: '=IF(OR(D6>70,D6<30),"Atur","Pas")', note: "kelembapan di D6 terlalu tinggi atau terlalu rendah → \"Atur\"." },
    steps: ["Blok bagian `OR(...)` di formula bar → [[F9]] untuk melihat `TRUE`/`FALSE`.", "Tekan [[Esc]] supaya rumus tidak berubah."],
    shortcuts: ["F9", "Esc"],
  },
  {
    id: "l02-p2-teks-di-sel",
    title: "Syarat teks merujuk sel",
    concept: "Bandingkan teks dengan sel yang berisi kata kuncinya, jangan diketik di rumus. Ganti isi sel itu, semua hasil ikut berubah.",
    example: { formula: '=IF(A9=$M$1,"Ya","")', note: "nama gudang di A9 dibandingkan dengan pilihan di M1." },
    steps: ["Tulis kata kunci di satu sel.", "Di rumus, klik sel itu → [[F4]] supaya terkunci."],
    shortcuts: ["F4"],
  },
];

export const practice2: LevelItem<LogikaScenario> = {
  id: "L02-P2",
  kind: "practice",
  number: 2,
  materi: P2_MATERI,
  generate,
};
