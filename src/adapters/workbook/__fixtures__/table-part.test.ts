import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { generateExamWorkbook } from "../generate";
import { readWorkbook } from "../read";
import { matchesTemplate } from "../templates";
import { writeTablePart } from "./table-part";

async function base(): Promise<Uint8Array> {
  const { bytes } = await generateExamWorkbook({
    token: "A".repeat(43),
    serverUrl: "https://example.invalid",
    cells: { Data: { A1: "Kode Batch", B1: "Unit", A2: "B-01", B2: 10, A3: "B-02", B3: 20 } },
  });
  return bytes;
}

describe("writeTablePart (test fixture)", () => {
  it("adds Tables that readWorkbook reads back, leaving cells and the VBA project as they were", async () => {
    const before = await readWorkbook(await base());
    let bytes = await writeTablePart(await base(), "Data", { name: "Table1", ref: "A1:B3", columns: ["Kode Batch", "Unit"] });
    bytes = await writeTablePart(bytes, "Data", { name: "Tanpa Judul", ref: "D5:E6", columns: ["Column1", "Column2"], headerRow: false });
    const reading = await readWorkbook(bytes);
    expect(reading.tables).toEqual({
      Instructions: [],
      Data: [
        { name: "Table1", ref: "A1:B3", headerRow: true, totalsRow: false, columns: ["Kode Batch", "Unit"] },
        { name: "Tanpa Judul", ref: "D5:E6", headerRow: false, totalsRow: false, columns: ["Column1", "Column2"] },
      ],
    });
    expect(reading.sheets).toEqual(before.sheets);
    expect(matchesTemplate(reading.vbaModuleHashes, 1)).toBe(true);
    const zip = await JSZip.loadAsync(bytes);
    expect(await zip.file("[Content_Types].xml")!.async("string")).toContain('PartName="/xl/tables/table2.xml"');
  });
});
