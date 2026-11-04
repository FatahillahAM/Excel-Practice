import { z } from "zod";
import { scenarioSchema } from "../../../core/content/level-module";

/**
 * The Level 1 scenario bank (AD-2): production batches of a factory. Every
 * scenario fills the same Data columns (Kode Batch, Lini, Shift, Produk, Unit
 * Diproduksi, Unit Cacat, Biaya per Unit); they differ in company, lines,
 * shifts, products and ranges. All companies are fictional.
 */

const intRange = z
  .object({ min: z.number().int().positive(), max: z.number().int().positive() })
  .strict()
  .refine((r) => r.min <= r.max, "min <= max");

/** Rupiah with at most two decimals. */
const rupiah = z
  .number()
  .positive()
  .refine((n) => Math.abs(Math.round(n * 100) - n * 100) < 1e-6, "At most two decimals");

const costRange = z
  .object({ min: rupiah, max: rupiah })
  .strict()
  .refine((r) => r.min <= r.max, "min <= max");

const distinct = (names: readonly string[]) => new Set(names).size === names.length;

export const fondasiScenarioSchema = scenarioSchema
  .extend({
    company: z.string().trim().min(1).max(60),
    /** Prefix of the batch codes (`SBP-01`). */
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
            /** Biaya per Unit (Rp), drawn once per product and attempt. */
            cost: costRange,
          })
          .strict(),
      )
      .min(3)
      .max(5)
      .refine((products) => distinct(products.map((p) => p.name)), "Products are distinct"),
    /** Tarif overhead per unit (Rp, whole rupiah), `Data!L2`. */
    overheadRate: intRange,
  })
  .strict();

export type FondasiScenario = z.infer<typeof fondasiScenarioSchema>;

export const scenarios: FondasiScenario[] = [
  {
    id: "baut-sinar-presisi",
    title: "Rekap Batch PT Sinar Baja Presisi",
    company: "PT Sinar Baja Presisi",
    story: "PT Sinar Baja Presisi membuat baut dan mur untuk bengkel otomotif. Kepala produksi minta kamu merapikan biaya tiap batch minggu ini.",
    batchPrefix: "SBP",
    lines: ["Lini A", "Lini B", "Lini C"],
    shifts: ["Pagi", "Malam"],
    products: [
      { name: "Baut M8", units: { min: 800, max: 1500 }, cost: { min: 1150.5, max: 1350.75 } },
      { name: "Baut M10", units: { min: 600, max: 1200 }, cost: { min: 1580.25, max: 1790 } },
      { name: "Mur M8", units: { min: 900, max: 1600 }, cost: { min: 820, max: 940.5 } },
      { name: "Mur M10", units: { min: 700, max: 1300 }, cost: { min: 1050.25, max: 1190.75 } },
    ],
    overheadRate: { min: 90, max: 160 },
  },
  {
    id: "botol-plastik-tirta",
    title: "Biaya Batch CV Tirta Plastindo",
    company: "CV Tirta Plastindo",
    story: "CV Tirta Plastindo mencetak botol dan tutup plastik untuk pabrik air minum. Tim PPIC butuh rekap biaya dan porsi produksi tiap batch.",
    batchPrefix: "TPL",
    lines: ["Mesin 1", "Mesin 2"],
    shifts: ["Shift 1", "Shift 2", "Shift 3"],
    products: [
      { name: "Botol 600 ml", units: { min: 3000, max: 6000 }, cost: { min: 310.5, max: 365.25 } },
      { name: "Botol 1500 ml", units: { min: 1500, max: 3500 }, cost: { min: 540, max: 610.75 } },
      { name: "Tutup Ulir", units: { min: 5000, max: 9000 }, cost: { min: 45.5, max: 62.25 } },
    ],
    overheadRate: { min: 12, max: 30 },
  },
  {
    id: "roti-mentari",
    title: "Produksi Harian Mentari Bakery",
    company: "Mentari Bakery",
    story: "Mentari Bakery memanggang roti untuk minimarket di sekitar kota. Pemilik ingin tahu biaya tiap batch dan simulasi kalau harga bahan naik.",
    batchPrefix: "MB",
    lines: ["Oven 1", "Oven 2", "Oven 3"],
    shifts: ["Subuh", "Siang"],
    products: [
      { name: "Roti Tawar", units: { min: 200, max: 450 }, cost: { min: 6200, max: 7100.5 } },
      { name: "Roti Sobek", units: { min: 150, max: 380 }, cost: { min: 8400.25, max: 9300 } },
      { name: "Donat Gula", units: { min: 300, max: 700 }, cost: { min: 2150.75, max: 2600 } },
      { name: "Bolu Pandan", units: { min: 100, max: 250 }, cost: { min: 11500, max: 12800.5 } },
    ],
    overheadRate: { min: 250, max: 600 },
  },
  {
    id: "kardus-karya-kemas",
    title: "Batch Kardus PT Karya Kemas Mandiri",
    company: "PT Karya Kemas Mandiri",
    story: "PT Karya Kemas Mandiri membuat kardus gelombang untuk pengiriman e-commerce. Supervisor produksi minta rekap biaya batch bulan ini.",
    batchPrefix: "KKM",
    lines: ["Corrugator 1", "Corrugator 2"],
    shifts: ["Pagi", "Sore", "Malam"],
    products: [
      { name: "Kardus S", units: { min: 2000, max: 4500 }, cost: { min: 1850, max: 2100.5 } },
      { name: "Kardus M", units: { min: 1500, max: 3500 }, cost: { min: 2650.25, max: 2980 } },
      { name: "Kardus L", units: { min: 1000, max: 2500 }, cost: { min: 3700.75, max: 4150 } },
    ],
    overheadRate: { min: 120, max: 260 },
  },
  {
    id: "sepatu-langkah-jaya",
    title: "Rekap Batch CV Langkah Jaya",
    company: "CV Langkah Jaya",
    story: "CV Langkah Jaya menjahit sepatu kerja dan sandal untuk pabrik. Bagian keuangan minta kamu menghitung biaya batch dan simulasi kenaikan biaya.",
    batchPrefix: "LJ",
    lines: ["Lini Jahit 1", "Lini Jahit 2", "Lini Jahit 3", "Lini Jahit 4"],
    shifts: ["Pagi", "Siang"],
    products: [
      { name: "Sepatu Safety", units: { min: 80, max: 220 }, cost: { min: 145000, max: 162500.5 } },
      { name: "Sepatu PDH", units: { min: 60, max: 180 }, cost: { min: 118000.25, max: 131000 } },
      { name: "Sandal Karet", units: { min: 200, max: 500 }, cost: { min: 24500, max: 28750.75 } },
    ],
    overheadRate: { min: 2500, max: 6000 },
  },
  {
    id: "cat-warna-abadi",
    title: "Batch Cat PT Warna Abadi Kimia",
    company: "PT Warna Abadi Kimia",
    story: "PT Warna Abadi Kimia mencampur cat tembok dan cat kayu dalam batch. Manajer pabrik ingin melihat biaya overhead dan porsi produksi tiap batch.",
    batchPrefix: "WAK",
    lines: ["Mixer A", "Mixer B", "Mixer C"],
    shifts: ["Shift 1", "Shift 2"],
    products: [
      { name: "Cat Tembok 5 kg", units: { min: 300, max: 800 }, cost: { min: 68500, max: 74200.5 } },
      { name: "Cat Tembok 25 kg", units: { min: 80, max: 240 }, cost: { min: 312000, max: 338500.25 } },
      { name: "Cat Kayu 1 kg", units: { min: 400, max: 900 }, cost: { min: 41200.75, max: 45800 } },
      { name: "Plamir 1 kg", units: { min: 250, max: 650 }, cost: { min: 18900, max: 21350.5 } },
      { name: "Thinner 1 L", units: { min: 350, max: 850 }, cost: { min: 22400.25, max: 24900 } },
    ],
    overheadRate: { min: 1500, max: 4200 },
  },
  {
    id: "kabel-arus-prima",
    title: "Produksi Kabel PT Arus Prima Elektrindo",
    company: "PT Arus Prima Elektrindo",
    story: "PT Arus Prima Elektrindo memproduksi kabel listrik dalam gulungan. Kepala lini minta rekap biaya tiap batch sebelum rapat mingguan.",
    batchPrefix: "APE",
    lines: ["Extruder 1", "Extruder 2"],
    shifts: ["Pagi", "Malam"],
    products: [
      { name: "Kabel NYA 1,5 mm", units: { min: 150, max: 400 }, cost: { min: 235000, max: 252500.5 } },
      { name: "Kabel NYA 2,5 mm", units: { min: 120, max: 350 }, cost: { min: 368000.25, max: 391000 } },
      { name: "Kabel NYM 2x1,5 mm", units: { min: 90, max: 260 }, cost: { min: 512500, max: 548000.75 } },
    ],
    overheadRate: { min: 4000, max: 9500 },
  },
  {
    id: "keramik-tanah-liat",
    title: "Batch Keramik CV Tanah Liat Lestari",
    company: "CV Tanah Liat Lestari",
    story: "CV Tanah Liat Lestari membakar ubin dan pot keramik di tungku. Pemilik ingin tahu biaya tiap batch dan berapa porsi produksinya.",
    batchPrefix: "TLL",
    lines: ["Tungku 1", "Tungku 2", "Tungku 3"],
    shifts: ["Pagi", "Malam"],
    products: [
      { name: "Ubin 30x30", units: { min: 600, max: 1400 }, cost: { min: 7800, max: 8650.5 } },
      { name: "Ubin 40x40", units: { min: 400, max: 1000 }, cost: { min: 12400.25, max: 13600 } },
      { name: "Pot Bunga", units: { min: 150, max: 450 }, cost: { min: 18500, max: 21200.75 } },
      { name: "Genteng Glazur", units: { min: 800, max: 1800 }, cost: { min: 5600.5, max: 6350 } },
    ],
    overheadRate: { min: 300, max: 900 },
  },
  {
    id: "garmen-benang-emas",
    title: "Rekap Batch PT Benang Emas Garmen",
    company: "PT Benang Emas Garmen",
    story: "PT Benang Emas Garmen menjahit kaos dan kemeja seragam untuk perusahaan. Admin produksi minta kamu menyusun biaya per batch minggu ini.",
    batchPrefix: "BEG",
    lines: ["Line 1", "Line 2", "Line 3"],
    shifts: ["Shift A", "Shift B"],
    products: [
      { name: "Kaos Polo", units: { min: 300, max: 750 }, cost: { min: 38500, max: 42750.5 } },
      { name: "Kemeja Kerja", units: { min: 200, max: 520 }, cost: { min: 61200.25, max: 66900 } },
      { name: "Rompi Proyek", units: { min: 150, max: 400 }, cost: { min: 47800, max: 52300.75 } },
    ],
    overheadRate: { min: 1200, max: 3500 },
  },
  {
    id: "kopi-bukit-hijau",
    title: "Batch Sangrai Kopi Bukit Hijau",
    company: "Kopi Bukit Hijau",
    story: "Kopi Bukit Hijau menyangrai dan mengemas biji kopi untuk kafe. Pemilik minta rekap biaya batch dan simulasi kalau biaya per unit naik.",
    batchPrefix: "KBH",
    lines: ["Roaster 1", "Roaster 2"],
    shifts: ["Pagi", "Sore"],
    products: [
      { name: "Arabika 250 g", units: { min: 120, max: 320 }, cost: { min: 42500, max: 46800.5 } },
      { name: "Robusta 250 g", units: { min: 150, max: 380 }, cost: { min: 28400.25, max: 31200 } },
      { name: "Blend 1 kg", units: { min: 60, max: 160 }, cost: { min: 132000, max: 141500.75 } },
    ],
    overheadRate: { min: 800, max: 2400 },
  },
  {
    id: "furnitur-jati-makmur",
    title: "Produksi Mebel CV Jati Makmur",
    company: "CV Jati Makmur",
    story: "CV Jati Makmur merakit meja dan kursi kayu untuk sekolah. Kepala bengkel ingin melihat biaya, overhead, dan porsi produksi tiap batch.",
    batchPrefix: "JM",
    lines: ["Bengkel Potong", "Bengkel Rakit", "Bengkel Finishing"],
    shifts: ["Pagi", "Siang"],
    products: [
      { name: "Meja Siswa", units: { min: 40, max: 120 }, cost: { min: 385000, max: 412500.5 } },
      { name: "Kursi Siswa", units: { min: 60, max: 180 }, cost: { min: 214000.25, max: 236000 } },
      { name: "Meja Guru", units: { min: 10, max: 40 }, cost: { min: 742000, max: 789500.75 } },
      { name: "Lemari Kelas", units: { min: 8, max: 30 }, cost: { min: 1185000, max: 1248000.5 } },
    ],
    overheadRate: { min: 15000, max: 42000 },
  },
  {
    id: "sabun-bersih-sentosa",
    title: "Batch Sabun PT Bersih Sentosa",
    company: "PT Bersih Sentosa",
    story: "PT Bersih Sentosa membuat sabun cuci dan sabun mandi dalam batch. Tim produksi butuh rekap biaya batch untuk laporan bulanan.",
    batchPrefix: "BS",
    lines: ["Reaktor 1", "Reaktor 2", "Reaktor 3"],
    shifts: ["Pagi", "Sore", "Malam"],
    products: [
      { name: "Sabun Batang", units: { min: 2000, max: 5000 }, cost: { min: 2850, max: 3150.5 } },
      { name: "Sabun Cair 500 ml", units: { min: 800, max: 2200 }, cost: { min: 9400.25, max: 10350 } },
      { name: "Deterjen 1 kg", units: { min: 600, max: 1800 }, cost: { min: 14200, max: 15650.75 } },
    ],
    overheadRate: { min: 150, max: 500 },
  },
];
