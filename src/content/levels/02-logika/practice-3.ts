import { DATA_SHEET, type ExamQuestion, type GeneratedExam, type LevelItem, type MateriCard, type Tip } from "@/core/content/level-module";
import { createRandom } from "@/core/content/random";
import { BASE_CHECKS, PARAM_LABELS, columnKey, dataCells, drawBatches, examOf, splitLimit, tipOf, usesFunctions, usesReference } from "./batches";
import type { LogikaScenario } from "./scenarios";

/**
 * Level 2 · Practice 3 (`L02-P3`): nested IF and IFS. O2 target, O3 defect
 * limit, O4 the high downtime limit, O5 the medium one (below O4).
 *
 * | # | Points | Answer    | Expected formula (top cell)                                          |
 * |---|--------|-----------|----------------------------------------------------------------------|
 * | 1 | 35     | H2:H{n+1} | `=IF(F2=0,"A",IF(F2<=$O$3,"B","C"))`                                 |
 * | 2 | 35     | I2:I{n+1} | `=IFS(G2>$O$4,"Tinggi",G2>$O$5,"Sedang",TRUE,"Rendah")`              |
 * | 3 | 30     | J2:J{n+1} | `=IF(AND(E2>=$O$2,F2<=$O$3),3,IF(E2>=$O$2,2,1))`                     |
 *
 * Q1 teaches nested IF and requires IF; Q2 teaches IFS and requires it; Q3
 * accepts either (no `uses_functions`).
 */

export const P3_HEADERS = { grade: "Grade Cacat", downtime: "Kategori Downtime", score: "Poin Batch" } as const;
export const P3_TEXT = { a: "A", b: "B", c: "C", high: "Tinggi", medium: "Sedang", low: "Rendah" } as const;

export const P3_TIPS = {
  nested: {
    id: "l02-if-bertingkat",
    title: "IF bertingkat: satu IF di dalam IF lain",
    body:
      "Untuk tiga hasil, IF kedua ditaruh di bagian Value_if_false IF pertama. Hitung tanda kurungnya: setiap IF membuka satu kurung yang harus ditutup di akhir. " +
      "Alt+Enter di formula bar memecah rumus panjang menjadi beberapa baris tanpa mengubah hasilnya.",
    shortcuts: ["Alt+Enter"],
  },
  ifs: {
    id: "l02-ifs-ditutup-true",
    title: "IFS: pasangan syarat dan hasil, ditutup TRUE",
    body:
      "IFS membaca pasangan syarat-hasil dari kiri dan berhenti di syarat pertama yang benar. Tanpa pasangan terakhir dengan syarat TRUE, baris yang tidak cocok dengan syarat mana pun menghasilkan #N/A. " +
      "Ketik =IFS( lalu Ctrl+Shift+A untuk menuliskan nama argumennya sebagai panduan.",
    shortcuts: ["Ctrl+Shift+A"],
  },
  order: {
    id: "l02-urutan-syarat",
    title: "Syarat paling ketat ditulis paling awal",
    body:
      "IF bertingkat dan IFS sama-sama berhenti di syarat pertama yang benar. Karena itu syarat yang paling ketat (yang memberi nilai tertinggi) ditaruh paling depan; " +
      "kalau syarat longgar ditulis duluan, syarat ketat di belakangnya tidak pernah terbaca.",
    shortcuts: ["F2"],
  },
} as const satisfies Record<string, Tip>;

function generate(seed: number, scenario: LogikaScenario): GeneratedExam {
  const random = createRandom(seed);
  const batches = drawBatches(random, scenario);
  const target = splitLimit(random, batches.map((b) => b.units), 10);
  const defectLimit = splitLimit(random, batches.map((b) => b.defects), 1);
  // Both downtime limits split the batches that stopped (downtime > 0), so every category occurs.
  const stopped = batches.map((b) => b.downtime).filter((value) => value > 0);
  const downtimeHigh = splitLimit(random, stopped, 5);
  const below = stopped.filter((value) => value < downtimeHigh);
  const downtimeMedium = Math.max(0, Math.min(splitLimit(random, [0, ...below], 5), downtimeHigh - 1));
  const last = batches.length + 1;

  const data = dataCells(batches, Object.values(P3_HEADERS), [
    [PARAM_LABELS.target, target],
    [PARAM_LABELS.defects, defectLimit],
    [PARAM_LABELS.downtime, downtimeHigh],
    [PARAM_LABELS.downtimeLow, downtimeMedium],
  ]);

  const grade = (defects: number) => (defects === 0 ? P3_TEXT.a : defects <= defectLimit ? P3_TEXT.b : P3_TEXT.c);
  const category = (downtime: number) => (downtime > downtimeHigh ? P3_TEXT.high : downtime > downtimeMedium ? P3_TEXT.medium : P3_TEXT.low);

  const questions: ExamQuestion[] = [
    {
      number: 1,
      prompt:
        `Di H2:H${last}, isi ${P3_HEADERS.grade} dengan IF bertingkat (IF di dalam IF): "${P3_TEXT.a}" bila "Unit Cacat" 0, "${P3_TEXT.b}" bila "Unit Cacat" paling banyak ${PARAM_LABELS.defects} di O3, ` +
        `selain itu "${P3_TEXT.c}". Rumus di H2 harus tetap benar saat disalin ke bawah sampai H${last}.`,
      points: 35,
      sheet: DATA_SHEET,
      range: `H2:H${last}`,
      checks: [...BASE_CHECKS, usesFunctions("IF"), usesReference("$O$3")],
      key: columnKey("H", batches, (b) => grade(b.defects)),
      hints: [
        "Ada tiga kemungkinan hasil, sedangkan satu IF hanya memberi dua. Hasil kedua IF pertama diisi dengan IF lain.",
        "Mulai dari syarat paling ketat: cacat nol. Bila bukan nol, IF kedua mengecek apakah cacatnya masih dalam batas.",
        "Batas cacat dikunci dengan F4. Pastikan jumlah kurung tutup di akhir sama dengan jumlah IF.",
      ],
      tip: tipOf(P3_TIPS.nested),
    },
    {
      number: 2,
      prompt:
        `Di I2:I${last}, isi ${P3_HEADERS.downtime} dengan IFS: "${P3_TEXT.high}" bila "Downtime (menit)" lebih dari ${PARAM_LABELS.downtime} di O4, "${P3_TEXT.medium}" bila lebih dari ${PARAM_LABELS.downtimeLow} di O5, ` +
        `selain itu "${P3_TEXT.low}". Rumus di I2 harus tetap benar saat disalin ke bawah sampai I${last}.`,
      points: 35,
      sheet: DATA_SHEET,
      range: `I2:I${last}`,
      checks: [...BASE_CHECKS, usesFunctions("IFS"), usesReference("$O$4"), usesReference("$O$5")],
      key: columnKey("I", batches, (b) => category(b.downtime)),
      hints: [
        "IFS berisi pasangan syarat dan hasil. Pasangan pertama untuk downtime tertinggi, pasangan kedua untuk downtime sedang.",
        "Untuk hasil \"selain itu\", tambahkan pasangan terakhir dengan syarat TRUE supaya tidak ada baris yang berakhir #N/A.",
        "Kedua batas downtime ada di sel tetap; kunci masing-masing dengan F4 sebelum menyalin rumus.",
      ],
      tip: tipOf(P3_TIPS.ifs),
    },
    {
      number: 3,
      prompt:
        `Di J2:J${last}, hitung ${P3_HEADERS.score}: 3 bila "Unit Diproduksi" minimal ${PARAM_LABELS.target} di O2 dan "Unit Cacat" paling banyak batas di O3; ` +
        `2 bila hanya targetnya tercapai; selain itu 1. Boleh IF bertingkat atau IFS. Rumus di J2 harus tetap benar saat disalin ke bawah sampai J${last}.`,
      points: 30,
      sheet: DATA_SHEET,
      range: `J2:J${last}`,
      checks: [...BASE_CHECKS, usesReference("$O$2"), usesReference("$O$3")],
      key: columnKey("J", batches, (b) => (b.units >= target && b.defects <= defectLimit ? 3 : b.units >= target ? 2 : 1)),
      hints: [
        "Poin 3 butuh dua syarat sekaligus, jadi syarat pertama memakai AND. Poin 2 cukup satu syarat: targetnya tercapai.",
        "Cek poin 3 lebih dulu. Kalau poin 2 dicek duluan, batch yang layak dapat 3 akan berhenti di 2.",
        "Hasilnya angka, jadi tanpa tanda kutip. Target dan batas cacat dikunci dengan F4.",
      ],
      tip: tipOf(P3_TIPS.order),
    },
  ];

  return examOf("Level 2 · Practice 3", scenario, batches, "", data, questions);
}

/** The Materi of L02-P3 (5.7): examples on other cells and situations (exam scores, oven temperature). */
export const P3_MATERI: readonly MateriCard[] = [
  {
    id: "l02-p3-if-bertingkat",
    title: "`IF` bertingkat untuk tiga hasil",
    concept: "Satu `IF` memberi dua hasil. Untuk tiga hasil, taruh `IF` kedua di bagian hasil salah `IF` pertama.",
    example: { formula: '=IF(B4>=85,"Mahir",IF(B4>=70,"Cukup","Ulang"))', note: "nilai pelatihan operator di B4 dibagi tiga tingkat." },
    steps: ["Tulis `IF` pertama sampai koma kedua.", "Ketik `IF(` lagi untuk hasil salah → lengkapi → tutup dua kurung `))`.", "[[Alt+Enter]] di formula bar memecah rumus panjang."],
    shortcuts: ["Alt+Enter"],
  },
  {
    id: "l02-p3-ifs",
    title: "`IFS`: daftar syarat-hasil",
    concept: "`IFS` membaca pasangan syarat-hasil dari kiri dan berhenti di syarat pertama yang benar. Pasangan terakhir `TRUE` menjadi hasil \"selain itu\".",
    example: { formula: '=IFS(D3>250,"Panas",D3>200,"Hangat",TRUE,"Dingin")', note: "suhu oven di D3 dibagi tiga kategori." },
    steps: ["Ketik `=IFS(` → syarat 1 `,` hasil 1 `,` syarat 2 `,` hasil 2.", "Akhiri dengan `TRUE,` hasil lainnya `)` → [[Enter]]."],
    shortcuts: ["Ctrl+Shift+A"],
  },
  {
    id: "l02-p3-urutan",
    title: "Urutan syarat menentukan hasil",
    concept: "Excel berhenti di syarat pertama yang benar, jadi syarat paling ketat ditulis paling awal.",
    example: { formula: '=IFS(C8>=1000,"Emas",C8>=500,"Perak",TRUE,"-")', note: "kalau `C8>=500` ditulis duluan, 1000 ke atas ikut jadi \"Perak\"." },
    steps: ["Urutkan syarat dari yang paling ketat.", "Cek satu baris dengan [[F9]] pada tiap syarat, lalu [[Esc]]."],
    shortcuts: ["F9", "Esc"],
  },
];

export const practice3: LevelItem<LogikaScenario> = {
  id: "L02-P3",
  kind: "practice",
  number: 3,
  materi: P3_MATERI,
  generate,
};
