import { DATA_SHEET, type ExamQuestion, type GeneratedExam, type LevelItem } from "@/core/content/level-module";
import { createRandom, type Random } from "@/core/content/random";
import { BASE_CHECKS, usesIfOrIfs, drawCovering, type Outcomes, PARAM_LABELS, columnKey, dataCells, drawBatches, examOf, splitLimit, tipOf, usesFunctions, usesReference } from "./batches";
import { ANSWER_HEADERS, P1_TIPS, TEXT } from "./practice-1";
import { P2_HEADERS, P2_TEXT, P2_TIPS } from "./practice-2";
import { P3_HEADERS, P3_TEXT, P3_TIPS } from "./practice-3";
import { P4_HEADERS, P4_TEXT, P4_TIPS } from "./practice-4";
import type { LogikaScenario } from "./scenarios";

/**
 * Level 2 · Test (`L02-T`): six questions (the instruction-line cap) over the
 * whole level, no time limit, passed at 80. O2 target, O3 defect limit, O4
 * downtime limit. Every outcome of every question occurs (`TEST_OUTCOMES`).
 * Q1, Q4 and Q6 require IF or IFS (`uses_any_function`).
 *
 * | # | Points | Answer    | Expected formula (top cell)                            |
 * |---|--------|-----------|--------------------------------------------------------|
 * | 1 | 15     | H2:H{n+1} | `=IF(E2>=$O$2,"Capai","Kurang")`                       |
 * | 2 | 15     | I2:I{n+1} | `=IF(AND(E2>=$O$2,F2<=$O$3),"Lolos","Tahan")`          |
 * | 3 | 15     | J2:J{n+1} | `=IF(OR(F2>$O$3,G2>$O$4),"Ya","Tidak")`                |
 * | 4 | 20     | K2:K{n+1} | `=IFS(F2=0,"A",F2<=$O$3,"B",TRUE,"C")` (or nested IF)  |
 * | 5 | 20     | L2:L{n+1} | `=IFERROR(E2/F2,"Tanpa Cacat")`                        |
 * | 6 | 15     | M2:M{n+1} | `=IF(G2>$O$4,"Cek mesin","")`                          |
 *
 * Tips are the practices' own cards (one id, one card).
 */

export const TEST_TIPS = {
  args: P1_TIPS.args,
  and: P2_TIPS.and,
  or: P2_TIPS.or,
  order: P3_TIPS.order,
  iferror: P4_TIPS.iferror,
  blank: P1_TIPS.blank,
} as const;

export const TEST_HEADERS = [ANSWER_HEADERS.target, P2_HEADERS.qc, P2_HEADERS.action, P3_HEADERS.grade, P4_HEADERS.perDefect, ANSWER_HEADERS.note] as const;

/** Every outcome each question's keys must show (`outcomeOf`): every generated exam has them all. */
export const TEST_OUTCOMES: Outcomes = [[TEXT.reached, TEXT.short], [P2_TEXT.pass, P2_TEXT.hold], [P2_TEXT.yes, P2_TEXT.no], [P3_TEXT.a, P3_TEXT.b, P3_TEXT.c], [P4_TEXT.noDefect, "number"], [TEXT.check, ""]];

function generate(seed: number, scenario: LogikaScenario): GeneratedExam {
  const random = createRandom(seed);
  return drawCovering(TEST_OUTCOMES, () => build(random, scenario));
}

function build(random: Random, scenario: LogikaScenario): GeneratedExam {
  const batches = drawBatches(random, scenario);
  const target = splitLimit(random, batches.map((b) => b.units), 10);
  // Split the batches with defects, so grade B (1 … the limit) and C both occur.
  const defectLimit = splitLimit(random, batches.map((b) => b.defects).filter((value) => value > 0), 1);
  const downtimeLimit = splitLimit(random, batches.map((b) => b.downtime), 5);
  const last = batches.length + 1;

  const data = dataCells(batches, TEST_HEADERS, [
    [PARAM_LABELS.target, target],
    [PARAM_LABELS.defects, defectLimit],
    [PARAM_LABELS.downtime, downtimeLimit],
  ]);
  const copied = (cell: string) => `Rumus di ${cell}2 harus tetap benar saat disalin ke bawah sampai ${cell}${last}.`;

  const questions: ExamQuestion[] = [
    {
      number: 1,
      prompt: `Di H2:H${last}, isi ${ANSWER_HEADERS.target}: "${TEXT.reached}" bila "Unit Diproduksi" minimal ${PARAM_LABELS.target} di O2, selain itu "${TEXT.short}". ${copied("H")}`,
      points: 15,
      sheet: DATA_SHEET,
      range: `H2:H${last}`,
      checks: [...BASE_CHECKS, usesIfOrIfs, usesReference("$O$2")],
      key: columnKey("H", batches, (b) => (b.units >= target ? TEXT.reached : TEXT.short)),
      hints: [
        "Satu syarat, dua hasil teks: itu bentuk dasar IF.",
        "Minimal sama dengan ditulis >=, dan kedua hasilnya teks dalam tanda kutip.",
        "Target ada di satu sel; kunci dengan F4 sebelum menyalin rumus.",
      ],
      tip: tipOf(TEST_TIPS.args),
    },
    {
      number: 2,
      prompt:
        `Di I2:I${last}, isi ${P2_HEADERS.qc}: "${P2_TEXT.pass}" bila "Unit Diproduksi" minimal ${PARAM_LABELS.target} di O2 dan "Unit Cacat" paling banyak ${PARAM_LABELS.defects} di O3, ` +
        `selain itu "${P2_TEXT.hold}". Pakai AND. ${copied("I")}`,
      points: 15,
      sheet: DATA_SHEET,
      range: `I2:I${last}`,
      checks: [...BASE_CHECKS, usesFunctions("AND"), usesReference("$O$2"), usesReference("$O$3")],
      key: columnKey("I", batches, (b) => (b.units >= target && b.defects <= defectLimit ? P2_TEXT.pass : P2_TEXT.hold)),
      hints: [
        "Dua syarat harus benar bersamaan, jadi keduanya masuk ke AND.",
        "AND menjadi syarat IF. Paling banyak berarti <=.",
        "Kunci sel target dan sel batas cacat dengan F4.",
      ],
      tip: tipOf(TEST_TIPS.and),
    },
    {
      number: 3,
      prompt:
        `Di J2:J${last}, isi ${P2_HEADERS.action}: "${P2_TEXT.yes}" bila "Unit Cacat" lebih dari ${PARAM_LABELS.defects} di O3 atau "Downtime (menit)" lebih dari ${PARAM_LABELS.downtime} di O4, ` +
        `selain itu "${P2_TEXT.no}". Pakai OR. ${copied("J")}`,
      points: 15,
      sheet: DATA_SHEET,
      range: `J2:J${last}`,
      checks: [...BASE_CHECKS, usesFunctions("OR"), usesReference("$O$3"), usesReference("$O$4")],
      key: columnKey("J", batches, (b) => (b.defects > defectLimit || b.downtime > downtimeLimit ? P2_TEXT.yes : P2_TEXT.no)),
      hints: [
        "Cukup salah satu masalah terjadi, jadi syaratnya OR.",
        "OR berisi dua perbandingan dengan tanda >, lalu menjadi syarat IF.",
        "Kedua batas ada di sel tetap di kolom O; kunci dengan F4.",
      ],
      tip: tipOf(TEST_TIPS.or),
    },
    {
      number: 4,
      prompt:
        `Di K2:K${last}, isi ${P3_HEADERS.grade}: "${P3_TEXT.a}" bila "Unit Cacat" 0, "${P3_TEXT.b}" bila "Unit Cacat" paling banyak ${PARAM_LABELS.defects} di O3, selain itu "${P3_TEXT.c}". ` +
        `Boleh IFS atau IF bertingkat. ${copied("K")}`,
      points: 20,
      sheet: DATA_SHEET,
      range: `K2:K${last}`,
      checks: [...BASE_CHECKS, usesIfOrIfs, usesReference("$O$3")],
      key: columnKey("K", batches, (b) => (b.defects === 0 ? P3_TEXT.a : b.defects <= defectLimit ? P3_TEXT.b : P3_TEXT.c)),
      hints: [
        "Tiga hasil dari satu kolom: cek cacat nol lebih dulu, baru batas cacat.",
        "Dengan IFS, hasil terakhir diberi syarat TRUE; dengan IF bertingkat, IF kedua ada di bagian hasil salah.",
        "Batas cacat dikunci dengan F4; angka nol boleh ditulis langsung.",
      ],
      tip: tipOf(TEST_TIPS.order),
    },
    {
      number: 5,
      prompt:
        `Di L2:L${last}, hitung ${P4_HEADERS.perDefect}: "Unit Diproduksi" dibagi "Unit Cacat"; batch tanpa cacat berisi "${P4_TEXT.noDefect}". Pakai IFERROR. ${copied("L")}`,
      points: 20,
      sheet: DATA_SHEET,
      range: `L2:L${last}`,
      checks: [...BASE_CHECKS, usesFunctions("IFERROR")],
      key: columnKey("L", batches, (b) => (b.defects === 0 ? P4_TEXT.noDefect : b.units / b.defects)),
      hints: [
        "Pembagian dengan cacat nol menghasilkan #DIV/0!.",
        "IFERROR membungkus pembagiannya; bagian keduanya teks pengganti dalam tanda kutip.",
        "Tidak ada sel tetap di soal ini. Salin ke bawah setelah baris pertama benar.",
      ],
      tip: tipOf(TEST_TIPS.iferror),
    },
    {
      number: 6,
      prompt:
        `Di M2:M${last}, isi ${ANSWER_HEADERS.note}: "${TEXT.check}" bila "Downtime (menit)" lebih dari ${PARAM_LABELS.downtime} di O4; bila tidak, biarkan selnya tampak kosong dengan teks kosong. ${copied("M")}`,
      points: 15,
      sheet: DATA_SHEET,
      range: `M2:M${last}`,
      checks: [...BASE_CHECKS, usesIfOrIfs, usesReference("$O$4")],
      key: columnKey("M", batches, (b) => (b.downtime > downtimeLimit ? TEXT.check : "")),
      hints: [
        "Sel yang tampak kosong tetap berisi rumus; hanya hasilnya yang kosong.",
        "Teks kosong adalah dua tanda kutip tanpa isi, dipakai sebagai hasil bila syarat salah.",
        "Batas downtime dikunci dengan F4 sebelum menyalin.",
      ],
      tip: tipOf(TEST_TIPS.blank),
    },
  ];

  return examOf("Level 2 · Test", scenario, batches, "Test ini tanpa batas waktu; lulus dengan skor 80. ", data, questions);
}

export const levelTest: LevelItem<LogikaScenario> = {
  id: "L02-T",
  kind: "test",
  number: 6,
  generate,
};
