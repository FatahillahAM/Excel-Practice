import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { patchTemplate, vbaProjectSha256 } from "./template-patch";
import { templates } from "./templates";

// Runs the patcher on each committed template, so the real Finish button markup
// (drawing, legacyDrawing, controls) is covered and not only the synthetic fixture.

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const UNTOUCHED_PREFIXES = ["xl/drawings/", "xl/ctrlProps/", "xl/worksheets/_rels/"];

/** Sheet XML with the `<sheetData>` element cut out: everything the patcher must not change. */
function outsideSheetData(xml: string): string {
  return xml.replace(/<sheetData\b[^>]*?(?:\/>|>[\s\S]*?<\/sheetData>)/, "<sheetData/>");
}

describe.each(Object.entries(templates))("template v%s", (version, template) => {
  it("matches the registry hash and keeps VBA, button parts and sheet tails when patched", async () => {
    const bytes = await readFile(path.join(repoRoot, template.file));
    expect(await vbaProjectSha256(bytes)).toBe(template.vbaProjectSha256);

    const patched = await patchTemplate(bytes, {
      properties: {
        WHE_AttemptToken: "tok_registry-test",
        WHE_ServerUrl: "https://example.test",
        WHE_TemplateVersion: version,
      },
      cells: {
        Instructions: {
          B2: "Judul",
          B4: "Skenario & data",
          B6: "Soal 1",
          B7: "Soal 2",
          B8: "Soal 3",
          B9: "Soal 4",
          B10: "Soal 5",
        },
        Data: { A1: "Lini", B1: "Unit", A2: "A", B2: 1200 },
      },
    });
    expect(await vbaProjectSha256(patched)).toBe(template.vbaProjectSha256);

    const before = await JSZip.loadAsync(bytes);
    const after = await JSZip.loadAsync(patched);
    const buttonParts = Object.keys(before.files).filter((name) =>
      UNTOUCHED_PREFIXES.some((prefix) => name.startsWith(prefix)),
    );
    expect(buttonParts.length).toBeGreaterThan(0);
    for (const name of buttonParts) {
      expect(await after.file(name)?.async("uint8array"), name).toEqual(
        await before.file(name)!.async("uint8array"),
      );
    }

    const sheets = Object.keys(before.files).filter((name) => /^xl\/worksheets\/[^/]+\.xml$/.test(name));
    for (const name of sheets) {
      const original = await before.file(name)!.async("string");
      const result = (await after.file(name)?.async("string")) ?? "";
      expect(outsideSheetData(result), name).toBe(outsideSheetData(original));
    }
  });
});
