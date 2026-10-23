/**
 * Spike S1: patch the exam template with sample manufacturing data and a random
 * attempt token, write the result outside the repo, and check that
 * `xl/vbaProject.bin` came through unchanged.
 *
 *   node scripts/spike-s1.ts [--out <dir>] [--template <file>] [--server-url <url>]
 */
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { patchTemplate, vbaProjectSha256, type CellValue } from "../src/adapters/workbook/template-patch.ts";
import { CURRENT_TEMPLATE_VERSION, templates } from "../src/adapters/workbook/templates.ts";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const template = templates[CURRENT_TEMPLATE_VERSION];

const { values: args } = parseArgs({
  options: {
    out: { type: "string", default: path.join(tmpdir(), "excel-practice-spike-s1") },
    template: { type: "string" },
    // Production alias from entry 1; S1 only displays it, S3 posts to it.
    "server-url": { type: "string", default: "https://excel-practice-omega.vercel.app" },
  },
});

const outDir = path.resolve(args.out);
const fromRepo = path.relative(repoRoot, outDir);
if (fromRepo !== ".." && !fromRepo.startsWith(`..${path.sep}`) && !path.isAbsolute(fromRepo)) {
  fail(`--out must be outside the repo (patched files are never committed): ${outDir}`);
}

const templatePath = path.resolve(args.template ?? path.join(repoRoot, template.file));
const templateBytes = await readFile(templatePath).catch((error: NodeJS.ErrnoException) => {
  if (error.code === "ENOENT") {
    fail(`Template not found: ${templatePath}\nCreate it with assets/templates/README.md.`);
  }
  throw error;
});

const token = randomBytes(32).toString("base64url");

const DATA_HEADER = ["Kode Batch", "Lini", "Shift", "Produk", "Unit Diproduksi", "Unit Cacat", "Biaya per Unit"];
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

const COLUMNS = "ABCDEFG";
const data: Record<string, CellValue> = {};
for (const [r, row] of [DATA_HEADER, ...DATA_ROWS].entries()) {
  for (const [c, value] of row.entries()) data[`${COLUMNS[c]}${r + 1}`] = value;
}

const properties = {
  WHE_AttemptToken: token,
  WHE_ServerUrl: args["server-url"],
  WHE_TemplateVersion: String(CURRENT_TEMPLATE_VERSION),
};

const patched = await patchTemplate(templateBytes, {
  properties,
  cells: {
    Instructions: {
      B2: "Spike S1 — Rekap Produksi PT Maju & Jaya",
      B4:
        "PT Maju & Jaya mencatat produksi tiga lini selama dua shift.\n" +
        'Gunakan sheet "Data" untuk menjawab soal; batch dengan cacat < 2% dianggap "baik".',
      B6: "1. Hitung total Unit Diproduksi untuk Lini A.",
      B7: "2. Hitung total Unit Cacat untuk shift Malam.",
      B8: "3. Hitung rata-rata Biaya per Unit untuk produk Baut M8.",
      B9: "4. Hitung persentase cacat keseluruhan (Unit Cacat / Unit Diproduksi).",
      B10: '5. Tandai setiap batch dengan cacat > 3% sebagai "Periksa".',
    },
    Data: data,
  },
});

const templateHash = await vbaProjectSha256(templateBytes);
const outputHash = await vbaProjectSha256(patched);

console.log(`template:            ${templatePath}`);
console.log(`WHE_AttemptToken:    ${properties.WHE_AttemptToken}`);
console.log(`WHE_ServerUrl:       ${properties.WHE_ServerUrl}`);
console.log(`WHE_TemplateVersion: ${properties.WHE_TemplateVersion}`);
console.log(`vbaProject.bin template sha256: ${templateHash}`);
console.log(`vbaProject.bin output   sha256: ${outputHash}`);

if (outputHash !== templateHash) fail("vbaProject.bin changed during patching");

if (args.template !== undefined) {
  console.log("registry check:      skipped (--template given)");
} else if (template.vbaProjectSha256 === null) {
  console.log(`registry check:      not recorded yet; set templates[${CURRENT_TEMPLATE_VERSION}].vbaProjectSha256 = "${templateHash}"`);
} else if (template.vbaProjectSha256 !== templateHash) {
  fail(`registry sha256 ${template.vbaProjectSha256} does not match the template`);
} else {
  console.log("registry check:      match");
}

await mkdir(outDir, { recursive: true });
const outPath = path.join(outDir, `spike-s1-${token.slice(0, 8)}.xlsm`);
await writeFile(outPath, patched);
console.log(`output:              ${outPath}`);

function fail(message: string): never {
  console.error(`spike-s1: ${message}`);
  process.exit(1);
}
