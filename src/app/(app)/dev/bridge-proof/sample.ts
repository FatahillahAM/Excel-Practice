import type { CellValue, TemplatePatch } from "../../../../adapters/workbook/template-patch";

/**
 * The bridge proof's exam: one manufacturing table on `Data` (shape of
 * `scripts/spike-s1.ts`) and one prompt, a SUMIFS typed into `Data!I2`, so the
 * proof row shows the formula the server read back. Not a level: no grading.
 */

const DATA_HEADER: CellValue[] = ["Kode Batch", "Lini", "Shift", "Produk", "Unit Diproduksi", "Unit Cacat", "Biaya per Unit"];
const DATA_ROWS: CellValue[][] = [
  ["B-2610-01", "Lini A", "Pagi", "Baut M8", 1200, 18, 1250.5],
  ["B-2610-02", "Lini A", "Malam", "Baut M8", 1150, 41, 1250.5],
  ["B-2610-03", "Lini B", "Pagi", "Mur M8", 980, 9, 875.25],
  ["B-2610-04", "Lini B", "Malam", "Mur M8", 1010, 22, 875.25],
  ["B-2610-05", "Lini C", "Pagi", "Ring Plat 10 mm", 2300, 35, 310],
  ["B-2610-06", "Lini C", "Malam", "Ring Plat 10 mm", 2150, 74, 310],
  ["B-2610-07", "Lini A", "Pagi", "Baut M10", 870, 12, 1680.75],
  ["B-2610-08", "Lini A", "Malam", "Baut M10", 905, 31, 1680.75],
  ["B-2610-09", "Lini B", "Pagi", "Mur M10", 760, 6, 1120],
  ["B-2610-10", "Lini C", "Malam", "Ring Plat 12 mm", 1980, 58, 365.5],
];

/** Where the user types the answer: column I, next to its label in column H. */
export const ANSWER_SHEET = "Data";
export const ANSWER_REF = "I2";

const COLUMNS = "ABCDEFG";

function dataCells(): Record<string, CellValue> {
  const cells: Record<string, CellValue> = {};
  for (const [r, row] of [DATA_HEADER, ...DATA_ROWS].entries()) {
    for (const [c, value] of row.entries()) cells[`${COLUMNS[c]}${r + 1}`] = value;
  }
  cells.H1 = "Pertanyaan";
  cells.I1 = "Jawaban";
  cells.H2 = "Total Unit Diproduksi Lini A, shift Pagi";
  return cells;
}

export const bridgeProofCells: TemplatePatch["cells"] = {
  Instructions: {
    B2: "Bukti Jembatan — Rekap Produksi PT Maju & Jaya",
    B4:
      "PT Maju & Jaya mencatat produksi tiga lini selama dua shift.\n" +
      'Gunakan sheet "Data" untuk menjawab soal di bawah, lalu klik Finish.',
    B6: `1. Di sel ${ANSWER_SHEET}!${ANSWER_REF}, tulis rumus SUMIFS yang menghitung total Unit Diproduksi untuk Lini A pada shift Pagi.`,
    B7: "2. Klik tombol Finish. File tidak perlu disimpan dulu: Finish mengirim salinannya.",
  },
  [ANSWER_SHEET]: dataCells(),
};
