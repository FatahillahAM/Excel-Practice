import { DATA_SHEET, type ExamQuestion, type GeneratedExam, type LevelItem, type MateriCard, type Tip } from "@/core/content/level-module";
import { createRandom, type Random } from "@/core/content/random";
import { BASE_CHECKS, drawCovering, type Outcomes, PARAM_LABELS, columnKey, dataCells, drawBatches, examOf, splitLimit, tipOf, usesFunctions, usesReference, type Batch } from "./batches";
import type { LogikaScenario } from "./scenarios";

/**
 * Level 2 · Practice 4 (`L02-P4`): IFERROR. Some batches have no defect
 * (Unit Cacat 0) and some no downtime (0 menit), so a plain division gives
 * #DIV/0! there; at least one of each is guaranteed. O2 the limit of defects
 * per downtime minute (two decimals).
 *
 * | # | Points | Answer    | Expected formula (top cell)                                     |
 * |---|--------|-----------|-----------------------------------------------------------------|
 * | 1 | 40     | H2:H{n+1} | `=IFERROR(E2/F2,"Tanpa Cacat")`                                 |
 * | 2 | 30     | I2:I{n+1} | `=IFERROR(F2/G2,0)`                                             |
 * | 3 | 30     | J2:J{n+1} | `=IFERROR(IF(F2/G2>$O$2,"Cek","OK"),"Tanpa Downtime")`          |
 *
 * Every question requires IFERROR: an IF that tests for 0 first gives the
 * same values but is not what this practice teaches.
 */

export const P4_HEADERS = { perDefect: "Unit per Cacat", perMinute: "Cacat per Menit", status: "Status Downtime" } as const;
export const P4_TEXT = { noDefect: "Tanpa Cacat", check: "Cek", ok: "OK", noDowntime: "Tanpa Downtime" } as const;

export const P4_TIPS = {
  iferror: {
    id: "l02-iferror-ganti-error",
    title: "IFERROR mengganti error dengan nilai pilihanmu",
    body:
      "IFERROR punya dua bagian: rumus yang mungkin error, lalu nilai pengganti bila errornya muncul. Bila rumusnya tidak error, hasil aslinya yang tampil. " +
      "Pengganti boleh teks atau angka.",
    shortcuts: ["F2"],
  },
  zero: {
    id: "l02-pengganti-angka-nol",
    title: "Pengganti angka supaya kolom tetap bisa dijumlah",
    body:
      "Pengganti berupa angka (misalnya nol) membuat kolom tetap berisi angka, jadi SUM atau AVERAGE di bawahnya tidak ikut error. " +
      "Setelah kolomnya terisi, tekan Ctrl+Shift+! untuk format angka dengan dua desimal.",
    shortcuts: ["Ctrl+Shift+!"],
  },
  outer: {
    id: "l02-iferror-paling-luar",
    title: "Taruh IFERROR paling luar",
    body:
      "Bila error bisa muncul di dalam syarat IF, bungkus seluruh IF dengan IFERROR. Error dari bagian mana pun di dalamnya lalu diganti satu nilai yang sama. " +
      "Hati-hati: IFERROR juga menyembunyikan salah ketik, jadi cek dulu rumus intinya tanpa IFERROR.",
    shortcuts: ["F9"],
  },
} as const satisfies Record<string, Tip>;

/** At least one batch with `field` 0: the first batch drawn for it is set to 0 when none is. */
function ensureZero(random: Random, batches: Batch[], field: "defects" | "downtime"): void {
  if (batches.some((b) => b[field] === 0)) return;
  batches[random.int(0, batches.length - 1)][field] = 0;
}

/** Every outcome each question's keys must show (`outcomeOf`): every generated exam has them all. */
export const P4_OUTCOMES: Outcomes = [[P4_TEXT.noDefect, "number"], [0, "number"], [P4_TEXT.noDowntime, P4_TEXT.check, P4_TEXT.ok]];

function generate(seed: number, scenario: LogikaScenario): GeneratedExam {
  const random = createRandom(seed);
  return drawCovering(P4_OUTCOMES, () => build(random, scenario));
}

function build(random: Random, scenario: LogikaScenario): GeneratedExam {
  const batches = drawBatches(random, scenario);
  ensureZero(random, batches, "defects");
  ensureZero(random, batches, "downtime");
  const ratios = batches.filter((b) => b.downtime > 0).map((b) => b.defects / b.downtime);
  const ratioLimit = splitLimit(random, ratios, 0.01);
  const last = batches.length + 1;

  const data = dataCells(batches, Object.values(P4_HEADERS), [[PARAM_LABELS.ratio, ratioLimit]]);

  const questions: ExamQuestion[] = [
    {
      number: 1,
      prompt:
        `Di H2:H${last}, hitung ${P4_HEADERS.perDefect}: "Unit Diproduksi" dibagi "Unit Cacat". Batch tanpa cacat membuat pembagian error; ` +
        `pakai IFERROR supaya baris itu berisi "${P4_TEXT.noDefect}". Salin rumus di H2 ke bawah sampai H${last}.`,
      points: 40,
      sheet: DATA_SHEET,
      range: `H2:H${last}`,
      checks: [...BASE_CHECKS, usesFunctions("IFERROR")],
      key: columnKey("H", batches, (b) => (b.defects === 0 ? P4_TEXT.noDefect : b.units / b.defects)),
      hints: [
        "Pembagian dengan nol menghasilkan #DIV/0!. Coba dulu pembagiannya saja dan lihat baris mana yang error.",
        "IFERROR membungkus pembagian itu. Bagian kedua IFERROR adalah teks pengganti, ditulis dalam tanda kutip.",
        "Tidak ada sel tetap di soal ini, jadi tidak perlu $. Setelah baris pertama benar, salin ke bawah dengan Ctrl+D.",
      ],
      tip: tipOf(P4_TIPS.iferror),
    },
    {
      number: 2,
      prompt:
        `Di I2:I${last}, hitung ${P4_HEADERS.perMinute}: "Unit Cacat" dibagi "Downtime (menit)". Batch tanpa downtime membuat pembagian error; ` +
        `pakai IFERROR supaya baris itu berisi angka 0. Salin rumus di I2 ke bawah sampai I${last}.`,
      points: 30,
      sheet: DATA_SHEET,
      range: `I2:I${last}`,
      checks: [...BASE_CHECKS, usesFunctions("IFERROR")],
      key: columnKey("I", batches, (b) => (b.downtime === 0 ? 0 : b.defects / b.downtime)),
      hints: [
        "Yang dibagi Unit Cacat, pembaginya Downtime. Baris dengan downtime nol yang membuat error.",
        "Pengganti di soal ini angka, bukan teks, jadi ditulis tanpa tanda kutip.",
        "Bungkus pembagiannya dengan IFERROR, lalu salin ke bawah sampai baris terakhir data.",
      ],
      tip: tipOf(P4_TIPS.zero),
    },
    {
      number: 3,
      prompt:
        `Di J2:J${last}, isi ${P4_HEADERS.status}: tulis "${P4_TEXT.check}" bila "Unit Cacat" dibagi "Downtime (menit)" lebih dari ${PARAM_LABELS.ratio} di O2, selain itu "${P4_TEXT.ok}"; ` +
        `batch tanpa downtime berisi "${P4_TEXT.noDowntime}". Pakai IF di dalam IFERROR. Rumus di J2 harus tetap benar saat disalin ke bawah sampai J${last}.`,
      points: 30,
      sheet: DATA_SHEET,
      range: `J2:J${last}`,
      checks: [...BASE_CHECKS, usesFunctions("IFERROR"), usesReference("$O$2")],
      key: columnKey("J", batches, (b) => (b.downtime === 0 ? P4_TEXT.noDowntime : b.defects / b.downtime > ratioLimit ? P4_TEXT.check : P4_TEXT.ok)),
      hints: [
        "Syarat IF-nya memakai pembagian yang sama dengan soal 2, lalu dibandingkan dengan batas di O2.",
        "Pada baris tanpa downtime, syarat IF sendiri sudah error. Karena itu IFERROR membungkus seluruh IF, bukan hanya pembagiannya.",
        "Batas di O2 dikunci dengan F4 supaya tidak bergeser saat disalin.",
      ],
      tip: tipOf(P4_TIPS.outer),
    },
  ];

  return examOf("Level 2 · Practice 4", scenario, batches, "", data, questions);
}

/** The Materi of L02-P4 (5.7): examples on other cells and situations (material per order, scrap per hour). */
export const P4_MATERI: readonly MateriCard[] = [
  {
    id: "l02-p4-div0",
    title: "Kenapa muncul `#DIV/0!`",
    concept: "Pembagian dengan nol atau sel kosong tidak punya hasil, jadi Excel menampilkan `#DIV/0!`. Error ini ikut menular ke rumus lain yang memakai sel itu.",
    example: { formula: "=C5/D5", note: "error bila jumlah order di D5 masih 0." },
    steps: ["Tulis dulu rumus intinya tanpa pengaman.", "Cari baris yang error: biasanya pembaginya nol."],
    shortcuts: ["Enter"],
  },
  {
    id: "l02-p4-iferror",
    title: "`IFERROR`: rumus, lalu pengganti",
    concept: "`IFERROR` menampilkan hasil rumus bila tidak error, dan nilai pengganti bila error. Pengganti boleh teks dalam kutip atau angka.",
    example: { formula: '=IFERROR(B3/C3,"Belum ada")', note: "scrap per jam; bila jam di C3 nol → \"Belum ada\"." },
    steps: ["Ketik `=IFERROR(` → rumus inti → `,` → pengganti → `)`.", "Salin ke bawah dengan [[Ctrl+D]]."],
    shortcuts: ["Ctrl+D"],
  },
  {
    id: "l02-p4-iferror-luar",
    title: "`IFERROR` membungkus `IF`",
    concept: "Bila error bisa muncul di syarat `IF`, taruh `IFERROR` paling luar supaya seluruh `IF` terlindungi.",
    example: { formula: '=IFERROR(IF(B9/C9>2,"Boros","Hemat"),"-")', note: "rasio bahan per order; baris tanpa order → \"-\"." },
    steps: ["Tulis `IF` sampai benar dulu.", "Klik di depan `IF` → ketik `IFERROR(` → ke akhir rumus → `,` pengganti `)`."],
    shortcuts: ["F2"],
  },
];

export const practice4: LevelItem<LogikaScenario> = {
  id: "L02-P4",
  kind: "practice",
  number: 4,
  materi: P4_MATERI,
  generate,
};
