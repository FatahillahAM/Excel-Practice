import { DATA_SHEET, type ExamQuestion, type GeneratedExam, type LevelItem, type MateriCard, type Tip } from "@/core/content/level-module";
import { createRandom, type Random } from "@/core/content/random";
import { BASE_CHECKS, usesIfOrIfs, drawCovering, type Outcomes, PARAM_LABELS, columnKey, dataCells, drawBatches, examOf, splitLimit, tipOf, usesReference } from "./batches";
import type { LogikaScenario } from "./scenarios";

/**
 * Level 2 · Practice 1 (`L02-P1`): IF. Data A1:G{n+1} holds the QC batches
 * (n = 12–20), O2 the target, O3 the defect limit, O4 the downtime limit.
 * Four questions, each filled down its column:
 *
 * | # | Points | Answer    | Expected formula (top cell)            |
 * |---|--------|-----------|----------------------------------------|
 * | 1 | 25     | H2:H{n+1} | `=IF(E2>=$O$2,"Capai","Kurang")`       |
 * | 2 | 25     | I2:I{n+1} | `=IF(F2>$O$3,"NG","OK")`               |
 * | 3 | 25     | J2:J{n+1} | `=IF(E2>$O$2,E2-$O$2,0)`               |
 * | 4 | 25     | K2:K{n+1} | `=IF(G2>$O$4,"Cek mesin","")`          |
 *
 * Every question requires IF or IFS (`uses_any_function`): either is
 * accepted, MAX, REPT or arithmetic tricks are not. Q4's key is "" for most rows: Excel's own
 * empty text result (`t="str"`, `<v></v>`), which the Excel fixture pins.
 */

export const ANSWER_HEADERS = { target: "Status Target", defects: "Status Cacat", surplus: "Unit Lebih", note: "Catatan Mesin" } as const;
export const TEXT = { reached: "Capai", short: "Kurang", ng: "NG", ok: "OK", check: "Cek mesin" } as const;

/** The Tips of L02-P1, constants so one id is always one card (Excel 2021 features only). */
export const P1_TIPS = {
  args: {
    id: "l02-argumen-if-ctrl-a",
    title: "Isi argumen IF lewat kotak dialog",
    body:
      "Ketik =IF( lalu tekan Ctrl+A: kotak Function Arguments terbuka dengan isian Logical_test, Value_if_true dan Value_if_false, lengkap dengan hasil sementaranya. " +
      "Lupa nama fungsinya? Shift+F3 membuka Insert Function.",
    shortcuts: ["Ctrl+A", "Shift+F3"],
  },
  quotes: {
    id: "l02-teks-dalam-kutip",
    title: "Teks di dalam rumus selalu pakai tanda kutip",
    body:
      "Hasil berupa teks ditulis di antara tanda kutip ganda, sedangkan angka dan referensi sel tidak. Tanpa kutip, Excel mengira teks itu nama dan hasilnya #NAME?. " +
      "Tekan F2 untuk mengedit rumus langsung di sel dan cek pasangan kutipnya.",
    shortcuts: ["F2"],
  },
  calc: {
    id: "l02-hitung-di-dalam-if",
    title: "IF bisa mengembalikan hasil hitungan",
    body:
      "Value_if_true dan Value_if_false tidak harus teks: isinya boleh angka atau rumus kecil seperti selisih dua sel. " +
      "Setelah rumus di baris pertama benar, blok sampai baris terakhir lalu Ctrl+D.",
    shortcuts: ["Ctrl+D"],
  },
  blank: {
    id: "l02-hasil-kosong",
    title: "Hasil kosong yang rapi",
    body:
      'Dua tanda kutip tanpa isi ("") membuat sel tampak kosong, padahal isinya tetap rumus. ' +
      "Tekan Ctrl+` untuk menampilkan semua rumus di sheet dan memastikan sel yang tampak kosong itu memang berisi rumus; tekan lagi untuk kembali.",
    shortcuts: ["Ctrl+`"],
  },
} as const satisfies Record<string, Tip>;

/** Every outcome each question's keys must show (`outcomeOf`): every generated exam has them all. */
export const P1_OUTCOMES: Outcomes = [[TEXT.reached, TEXT.short], [TEXT.ng, TEXT.ok], [0, "number"], [TEXT.check, ""]];

function generate(seed: number, scenario: LogikaScenario): GeneratedExam {
  const random = createRandom(seed);
  return drawCovering(P1_OUTCOMES, () => build(random, scenario));
}

function build(random: Random, scenario: LogikaScenario): GeneratedExam {
  const batches = drawBatches(random, scenario);
  const target = splitLimit(random, batches.map((b) => b.units), 10);
  const defectLimit = splitLimit(random, batches.map((b) => b.defects), 1);
  const downtimeLimit = splitLimit(random, batches.map((b) => b.downtime), 5);
  const last = batches.length + 1;

  const data = dataCells(batches, Object.values(ANSWER_HEADERS), [
    [PARAM_LABELS.target, target],
    [PARAM_LABELS.defects, defectLimit],
    [PARAM_LABELS.downtime, downtimeLimit],
  ]);

  const questions: ExamQuestion[] = [
    {
      number: 1,
      prompt:
        `Di H2:H${last}, isi ${ANSWER_HEADERS.target}: tulis "${TEXT.reached}" bila "Unit Diproduksi" minimal sama dengan ${PARAM_LABELS.target} di O2, selain itu "${TEXT.short}". ` +
        `Tulis satu rumus di H2 yang tetap benar saat disalin ke bawah sampai H${last}.`,
      points: 25,
      sheet: DATA_SHEET,
      range: `H2:H${last}`,
      checks: [...BASE_CHECKS, usesIfOrIfs, usesReference("$O$2")],
      key: columnKey("H", batches, (b) => (b.units >= target ? TEXT.reached : TEXT.short)),
      hints: [
        "IF punya tiga bagian: syarat yang dicek, hasil bila syarat benar, dan hasil bila syarat salah. Di sini syaratnya membandingkan Unit Diproduksi dengan target.",
        "Minimal sama dengan ditulis >=. Kedua hasilnya teks, jadi masing-masing ditulis di antara tanda kutip.",
        "Target hanya ada di satu sel, jadi kunci referensinya dengan F4 supaya tidak bergeser saat rumus disalin. Unit Diproduksi dibiarkan tanpa $ supaya ikut turun per baris.",
      ],
      tip: tipOf(P1_TIPS.args),
    },
    {
      number: 2,
      prompt:
        `Di I2:I${last}, isi ${ANSWER_HEADERS.defects}: tulis "${TEXT.ng}" bila "Unit Cacat" lebih dari ${PARAM_LABELS.defects} di O3, selain itu "${TEXT.ok}". ` +
        `Rumus di I2 harus tetap benar saat disalin ke bawah sampai I${last}.`,
      points: 25,
      sheet: DATA_SHEET,
      range: `I2:I${last}`,
      checks: [...BASE_CHECKS, usesIfOrIfs, usesReference("$O$3")],
      key: columnKey("I", batches, (b) => (b.defects > defectLimit ? TEXT.ng : TEXT.ok)),
      hints: [
        "Syaratnya: Unit Cacat di baris yang sama dibandingkan dengan batas cacat. Lebih dari berarti tanda >, bukan >=.",
        "Urutan hasil mengikuti syarat: hasil pertama untuk syarat yang benar (cacatnya kelewat batas), hasil kedua untuk sisanya.",
        "Batas cacat cuma ada di satu sel; kunci referensinya dengan F4 sebelum menyalin rumus ke bawah.",
      ],
      tip: tipOf(P1_TIPS.quotes),
    },
    {
      number: 3,
      prompt:
        `Di J2:J${last}, hitung ${ANSWER_HEADERS.surplus}: bila "Unit Diproduksi" lebih dari ${PARAM_LABELS.target} di O2, hasilnya selisih keduanya; bila tidak, hasilnya 0. ` +
        `Rumus di J2 harus tetap benar saat disalin ke bawah sampai J${last}.`,
      points: 25,
      sheet: DATA_SHEET,
      range: `J2:J${last}`,
      checks: [...BASE_CHECKS, usesIfOrIfs, usesReference("$O$2")],
      key: columnKey("J", batches, (b) => (b.units > target ? b.units - target : 0)),
      hints: [
        "Hasil IF tidak harus teks. Bila syarat benar, hasilnya pengurangan: Unit Diproduksi dikurangi target.",
        "Bila syarat salah, hasilnya angka nol, ditulis tanpa tanda kutip supaya tetap angka.",
        "Target dipakai dua kali di rumus ini, di syarat dan di pengurangan; kunci keduanya dengan F4.",
      ],
      tip: tipOf(P1_TIPS.calc),
    },
    {
      number: 4,
      prompt:
        `Di K2:K${last}, isi ${ANSWER_HEADERS.note}: tulis "${TEXT.check}" bila "Downtime (menit)" lebih dari ${PARAM_LABELS.downtime} di O4; bila tidak, biarkan selnya tampak kosong dengan teks kosong. ` +
        `Rumus di K2 harus tetap benar saat disalin ke bawah sampai K${last}.`,
      points: 25,
      sheet: DATA_SHEET,
      range: `K2:K${last}`,
      checks: [...BASE_CHECKS, usesIfOrIfs, usesReference("$O$4")],
      key: columnKey("K", batches, (b) => (b.downtime > downtimeLimit ? TEXT.check : "")),
      hints: [
        "Sel yang tampak kosong tetap harus berisi rumus. Yang kosong hanya hasilnya, jadi jangan hapus rumus di baris yang downtime-nya rendah.",
        "Teks kosong adalah dua tanda kutip tanpa apa pun di antaranya. Itu menjadi hasil bila syarat salah.",
        "Batas downtime ada di satu sel; kunci referensinya dengan F4, lalu salin rumusnya ke bawah.",
      ],
      tip: tipOf(P1_TIPS.blank),
    },
  ];

  return examOf("Level 2 · Practice 1", scenario, batches, "", data, questions);
}

/** The Materi of L02-P1 (5.7): its examples use other cells and situations (oven temperature, pressure) than the questions. */
export const P1_MATERI: readonly MateriCard[] = [
  {
    id: "l02-p1-if-tiga-bagian",
    title: "`IF`: syarat, hasil benar, hasil salah",
    concept: "`IF` mengecek satu syarat lalu memilih salah satu dari dua hasil. Syaratnya perbandingan seperti `>`, `<`, `>=`, `<=`, `=` atau `<>`.",
    example: { formula: '=IF(C3<180,"Dingin","Siap")', note: 'suhu oven di C3 di bawah 180 → "Dingin", selain itu "Siap".' },
    steps: ["Klik sel hasil → ketik `=IF(`.", "Tulis syarat → `,` → hasil benar → `,` → hasil salah → `)` → [[Enter]].", "Teks hasil selalu di antara tanda kutip."],
    shortcuts: ["Enter"],
  },
  {
    id: "l02-p1-if-batas-terkunci",
    title: "Batas di satu sel, dikunci `$`",
    concept: "Simpan batas di satu sel lalu rujuk sel itu, jangan ketik angkanya di rumus. Sel batas dikunci supaya tidak bergeser saat rumus di-copy ke bawah.",
    example: { formula: '=IF(D5>$B$1,"Tinggi","Normal")', note: "tekanan di D5 dibandingkan batas di B1 yang dikunci." },
    steps: ["Saat mengetik rumus, taruh kursor di sel batas → [[F4]] (laptop: [[Fn+F4]]).", "Isi baris pertama → blok sampai bawah → [[Ctrl+D]]."],
    shortcuts: ["F4", "Ctrl+D"],
  },
  {
    id: "l02-p1-if-angka-dan-kosong",
    title: "Hasil angka dan hasil kosong",
    concept: 'Hasil `IF` boleh angka atau hitungan, bukan cuma teks. Dua tanda kutip tanpa isi (`""`) membuat sel tampak kosong, tapi rumusnya tetap ada.',
    example: { formula: '=IF(B7="Retur",C7*2,"")', note: 'baris retur dihitung dua kali lipat, baris lain tampak kosong.' },
    steps: ["Angka hasil ditulis tanpa kutip.", "`Formulas > Show Formulas` menampilkan rumus di sel yang tampak kosong."],
    shortcuts: ["Ctrl+`"],
  },
];

export const practice1: LevelItem<LogikaScenario> = {
  id: "L02-P1",
  kind: "practice",
  number: 1,
  materi: P1_MATERI,
  generate,
};
