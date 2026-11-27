import { z } from "zod";
import { scenarioSchema } from "@/core/content/level-module";

/**
 * The Level 2 scenario bank (AD-2): production batches checked by QC. Every
 * scenario fills the same Data columns (Kode Batch, Lini, Shift, Produk, Unit
 * Diproduksi, Unit Cacat, Downtime (menit)); they differ in company, lines,
 * shifts, products and ranges. The limits the questions test against (target,
 * defect and downtime limits) are drawn from each attempt's own data, so both
 * outcomes of every IF occur. All companies are fictional.
 */

const intRange = z
  .object({ min: z.number().int().positive(), max: z.number().int().positive() })
  .strict()
  .refine((r) => r.min <= r.max, "min <= max");

const distinct = (names: readonly string[]) => new Set(names).size === names.length;

export const logikaScenarioSchema = scenarioSchema
  .extend({
    company: z.string().trim().min(1).max(60),
    /** Prefix of the batch codes (`KRP-01`). */
    batchPrefix: z.string().regex(/^[A-Z]{2,4}$/),
    lines: z.array(z.string().trim().min(1).max(20)).min(2).max(4).refine(distinct, "Lines are distinct"),
    shifts: z.array(z.string().trim().min(1).max(20)).min(2).max(3).refine(distinct, "Shifts are distinct"),
    products: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(40),
            /** Unit Diproduksi per batch. */
            units: intRange,
          })
          .strict(),
      )
      .min(3)
      .max(5)
      .refine((products) => distinct(products.map((p) => p.name)), "Products are distinct"),
    /** Downtime (menit) of a batch with a stop; some batches have none (0). */
    downtime: intRange,
  })
  .strict();

export type LogikaScenario = z.infer<typeof logikaScenarioSchema>;

export const scenarios: LogikaScenario[] = [
  {
    id: "kemasan-karton-prima",
    title: "QC Kemasan PT Karton Prima",
    company: "PT Karton Prima",
    story: "PT Karton Prima membuat kardus untuk pabrik makanan. Supervisor QC ingin status tiap batch terisi otomatis, bukan diketik satu per satu.",
    batchPrefix: "KRP",
    lines: ["Lini 1", "Lini 2", "Lini 3"],
    shifts: ["Pagi", "Siang", "Malam"],
    products: [
      { name: "Kardus A4", units: { min: 900, max: 1600 } },
      { name: "Kardus Mi", units: { min: 1200, max: 2200 } },
      { name: "Kardus Susu", units: { min: 800, max: 1500 } },
      { name: "Kardus Telur", units: { min: 600, max: 1200 } },
    ],
    downtime: { min: 5, max: 95 },
  },
  {
    id: "kabel-nusa-elektrik",
    title: "Inspeksi Kabel CV Nusa Elektrik",
    company: "CV Nusa Elektrik",
    story: "CV Nusa Elektrik memproduksi gulungan kabel listrik. Kepala QC butuh kolom status yang langsung menandai batch bermasalah.",
    batchPrefix: "NE",
    lines: ["Extruder 1", "Extruder 2"],
    shifts: ["Pagi", "Malam"],
    products: [
      { name: "Kabel NYA 1,5", units: { min: 300, max: 700 } },
      { name: "Kabel NYA 2,5", units: { min: 250, max: 600 } },
      { name: "Kabel NYM 2x1,5", units: { min: 200, max: 500 } },
    ],
    downtime: { min: 10, max: 120 },
  },
  {
    id: "roti-mentari-pagi",
    title: "Batch Roti PT Mentari Pagi",
    company: "PT Mentari Pagi",
    story: "PT Mentari Pagi memanggang roti tawar dan roti manis untuk minimarket. Tim produksi ingin tahu batch mana yang mencapai target dan mana yang perlu dicek.",
    batchPrefix: "MP",
    lines: ["Oven A", "Oven B", "Oven C"],
    shifts: ["Subuh", "Pagi", "Sore"],
    products: [
      { name: "Roti Tawar", units: { min: 1500, max: 2600 } },
      { name: "Roti Cokelat", units: { min: 1200, max: 2200 } },
      { name: "Roti Keju", units: { min: 1000, max: 1900 } },
    ],
    downtime: { min: 5, max: 60 },
  },
  {
    id: "sepatu-langkah-jaya",
    title: "QC Sepatu CV Langkah Jaya",
    company: "CV Langkah Jaya",
    story: "CV Langkah Jaya menjahit sepatu kerja untuk proyek konstruksi. Supervisor ingin label otomatis untuk batch yang lolos dan yang harus diperiksa ulang.",
    batchPrefix: "LJ",
    lines: ["Jahit 1", "Jahit 2", "Jahit 3"],
    shifts: ["Pagi", "Siang"],
    products: [
      { name: "Safety Boot", units: { min: 120, max: 300 } },
      { name: "Sepatu PDH", units: { min: 150, max: 350 } },
      { name: "Sepatu Karet", units: { min: 200, max: 450 } },
    ],
    downtime: { min: 10, max: 90 },
  },
  {
    id: "cat-warna-abadi",
    title: "Produksi Cat PT Warna Abadi",
    company: "PT Warna Abadi",
    story: "PT Warna Abadi mengisi cat tembok ke kaleng 5 kg. Kepala lini minta kolom keputusan QC yang tidak perlu diubah manual tiap minggu.",
    batchPrefix: "WA",
    lines: ["Mixer 1", "Mixer 2", "Mixer 3", "Mixer 4"],
    shifts: ["Pagi", "Malam"],
    products: [
      { name: "Cat Putih 5 kg", units: { min: 400, max: 900 } },
      { name: "Cat Abu 5 kg", units: { min: 300, max: 700 } },
      { name: "Cat Krem 5 kg", units: { min: 250, max: 650 } },
      { name: "Cat Biru 5 kg", units: { min: 200, max: 500 } },
    ],
    downtime: { min: 15, max: 110 },
  },
  {
    id: "botol-kaca-bening",
    title: "Inspeksi Botol CV Kaca Bening",
    company: "CV Kaca Bening",
    story: "CV Kaca Bening mencetak botol kaca untuk sirup dan kecap. Tim QC mencatat unit cacat dan downtime tungku tiap batch.",
    batchPrefix: "KB",
    lines: ["Tungku 1", "Tungku 2", "Tungku 3"],
    shifts: ["Pagi", "Sore", "Malam"],
    products: [
      { name: "Botol Sirup", units: { min: 2000, max: 3800 } },
      { name: "Botol Kecap", units: { min: 1800, max: 3200 } },
      { name: "Botol Saus", units: { min: 1500, max: 3000 } },
    ],
    downtime: { min: 20, max: 150 },
  },
  {
    id: "komponen-motor-tangguh",
    title: "QC Komponen PT Motor Tangguh",
    company: "PT Motor Tangguh",
    story: "PT Motor Tangguh membubut komponen rem dan kopling sepeda motor. Engineer QC ingin batch yang lewat batas cacat langsung terlihat.",
    batchPrefix: "MT",
    lines: ["CNC 1", "CNC 2", "CNC 3"],
    shifts: ["Pagi", "Malam"],
    products: [
      { name: "Kampas Rem", units: { min: 500, max: 1100 } },
      { name: "Plat Kopling", units: { min: 400, max: 900 } },
      { name: "Tromol", units: { min: 150, max: 400 } },
      { name: "Cakram", units: { min: 200, max: 450 } },
    ],
    downtime: { min: 5, max: 80 },
  },
  {
    id: "minuman-segar-alami",
    title: "Lini Minuman PT Segar Alami",
    company: "PT Segar Alami",
    story: "PT Segar Alami mengisi teh dan jus ke botol plastik. Supervisor produksi butuh tanda otomatis untuk batch dengan downtime panjang.",
    batchPrefix: "SA",
    lines: ["Filling 1", "Filling 2"],
    shifts: ["Pagi", "Siang", "Malam"],
    products: [
      { name: "Teh Melati 350 ml", units: { min: 3000, max: 5200 } },
      { name: "Jus Jeruk 250 ml", units: { min: 2500, max: 4500 } },
      { name: "Air Mineral 600 ml", units: { min: 4000, max: 6500 } },
    ],
    downtime: { min: 10, max: 75 },
  },
  {
    id: "garmen-benang-emas",
    title: "QC Garmen CV Benang Emas",
    company: "CV Benang Emas",
    story: "CV Benang Emas menjahit seragam kerja pabrik. Kepala QC ingin keputusan lolos atau tahan ditulis dengan rumus supaya konsisten.",
    batchPrefix: "BE",
    lines: ["Line Jahit A", "Line Jahit B", "Line Jahit C"],
    shifts: ["Pagi", "Siang"],
    products: [
      { name: "Kemeja Kerja", units: { min: 250, max: 600 } },
      { name: "Celana Kerja", units: { min: 200, max: 550 } },
      { name: "Wearpack", units: { min: 100, max: 300 } },
    ],
    downtime: { min: 5, max: 70 },
  },
  {
    id: "pupuk-tani-subur",
    title: "Pengantongan PT Tani Subur",
    company: "PT Tani Subur",
    story: "PT Tani Subur mengantongi pupuk granul 50 kg. Tim produksi ingin status target dan catatan mesin terisi sendiri dari data batch.",
    batchPrefix: "TS",
    lines: ["Bagging 1", "Bagging 2", "Bagging 3"],
    shifts: ["Pagi", "Sore", "Malam"],
    products: [
      { name: "Urea 50 kg", units: { min: 600, max: 1300 } },
      { name: "NPK 50 kg", units: { min: 500, max: 1100 } },
      { name: "ZA 50 kg", units: { min: 400, max: 900 } },
    ],
    downtime: { min: 15, max: 100 },
  },
  {
    id: "keramik-lantai-indah",
    title: "Sortir Keramik PT Lantai Indah",
    company: "PT Lantai Indah",
    story: "PT Lantai Indah membakar keramik lantai di kiln. Tim sortir mencatat unit retak sebagai cacat dan ingin grade tiap batch terisi otomatis.",
    batchPrefix: "LI",
    lines: ["Kiln 1", "Kiln 2"],
    shifts: ["Pagi", "Malam"],
    products: [
      { name: "Keramik 40x40", units: { min: 1500, max: 2800 } },
      { name: "Keramik 50x50", units: { min: 1200, max: 2400 } },
      { name: "Keramik 60x60", units: { min: 800, max: 1800 } },
    ],
    downtime: { min: 20, max: 130 },
  },
];
