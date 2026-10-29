import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { S2_FIXTURE, S2_MODFINISH_SHA256 } from "./__fixtures__/s2-expected";
import { buildVbaProject, bytes, type ModuleSpec } from "./__fixtures__/vba-project";
import { readWorkbook } from "./read";
import { patchTemplate, vbaProjectSha256 } from "./template-patch";
import { matchesTemplate, pinnedModules, templates } from "./templates";
import { EMPTY_MODULE_SHA256, readVbaModuleHashes, readVbaModuleSources } from "./vba";

// Runs the patcher on each committed template, so the real Finish button markup
// (drawing, legacyDrawing, controls) is covered and not only the synthetic fixture.

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
/** Spike S3: a v1 file Excel 2021 saved after a sheet was added and the VBA editor opened (`__fixtures__/README.md`). */
const S3_FIXTURE = "src/adapters/workbook/__fixtures__/s3-excel2021.xlsm";
const UNTOUCHED_PREFIXES = ["xl/drawings/", "xl/ctrlProps/", "xl/worksheets/_rels/"];

/** Sheet XML with the `<sheetData>` element cut out: everything the patcher must not change. */
function outsideSheetData(xml: string): string {
  return xml.replace(/<sheetData\b[^>]*?(?:\/>|>[\s\S]*?<\/sheetData>)/, "<sheetData/>");
}

describe.each(Object.entries(templates))("template v%s", (version, template) => {
  it("pins exactly the modules the adapter fingerprints as not empty in the committed file", async () => {
    const hashes = (await readWorkbook(await readFile(path.join(repoRoot, template.file)))).vbaModuleHashes;
    expect(hashes).not.toBeNull();
    expect(pinnedModules(hashes!)).toEqual(template.vbaModules);
    expect(Object.keys(template.vbaModules).length).toBeGreaterThan(0);
    for (const hash of Object.values(template.vbaModules)) expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(matchesTemplate(hashes, Number(version))).toBe(true);
  });

  it("keeps vbaProject.bin bytes, button parts and sheet tails when patched, and still matches", async () => {
    const bytes = await readFile(path.join(repoRoot, template.file));

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
    // Byte check at generation only: the patcher must not touch the part. Identity never compares these bytes.
    expect(await vbaProjectSha256(patched)).toBe(await vbaProjectSha256(bytes));
    expect(matchesTemplate((await readWorkbook(patched)).vbaModuleHashes, Number(version))).toBe(true);

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

describe("matchesTemplate", () => {
  it("matches the Excel-saved S3 file to v1 despite an added sheet and rewritten vbaProject.bin bytes", async () => {
    const template = await readFile(path.join(repoRoot, templates[1].file));
    const saved = await readFile(path.join(repoRoot, S3_FIXTURE));
    expect(await vbaProjectSha256(saved)).not.toBe(await vbaProjectSha256(template));
    const reading = await readWorkbook(saved);
    expect(Object.keys(reading.sheets)).toEqual(["Instructions", "Sheet1", "Data"]);
    // The added sheet's document module is new and empty, so it is not pinned.
    expect(reading.vbaModuleHashes?.Sheet3).toBe(EMPTY_MODULE_SHA256);
    expect(matchesTemplate(reading.vbaModuleHashes, 1)).toBe(true);
  });

  it("does not match the S2 file to v1: it carries the S1-era modFinish that S3 replaced", async () => {
    const hashes = (await readWorkbook(await readFile(path.join(repoRoot, S2_FIXTURE)))).vbaModuleHashes;
    expect(hashes?.modFinish).toBe(S2_MODFINISH_SHA256);
    expect(S2_MODFINISH_SHA256).not.toBe(templates[1].vbaModules.modFinish);
    expect(matchesTemplate(hashes, 1)).toBe(false);
  });

  /** A project carrying the v1 template's real modFinish source, rewritten by the `cfb` package. */
  async function projectWith(modules: (modFinish: Uint8Array) => ModuleSpec[]): Promise<Uint8Array> {
    const zip = await JSZip.loadAsync(await readFile(path.join(repoRoot, templates[1].file)));
    const sources = readVbaModuleSources(await zip.file("xl/vbaProject.bin")!.async("uint8array"));
    return buildVbaProject({ modules: modules(sources!.get("modFinish")!) });
  }

  const emptySheet = (name: string): ModuleSpec => ({
    name,
    source: `Attribute VB_Name = "${name}"\r\nAttribute VB_Base = "0{00020820-0000-0000-C000-000000000046}"\r\n`,
    document: true,
  });

  it("matches with modules the template does not pin: a new sheet's empty module, an extra standard module", async () => {
    const bin = await projectWith((modFinish) => [
      emptySheet("ThisWorkbook"),
      emptySheet("Sheet1"),
      emptySheet("Sheet3"),
      { name: "modFinish", source: modFinish },
      { name: "Module1", source: "Sub Extra()\r\nEnd Sub\r\n" },
    ]);
    const hashes = readVbaModuleHashes(bin);
    expect(hashes?.Sheet3).toBe(EMPTY_MODULE_SHA256);
    expect(matchesTemplate(hashes, 1)).toBe(true);
  });

  it("matches when only line endings, trailing blanks and Attribute lines of modFinish differ", async () => {
    const bin = await projectWith((modFinish) => {
      const source = Buffer.from(modFinish).toString("latin1").replace(/\r\n/g, "  \n") + "\r\n\r\n";
      return [{ name: "modFinish", source: `Attribute VB_Description = "x"\r\n${source}` }];
    });
    expect(matchesTemplate(readVbaModuleHashes(bin), 1)).toBe(true);
  });

  it("does not match when one character of modFinish changes", async () => {
    const bin = await projectWith((modFinish) => {
      const source = Buffer.from(modFinish).toString("latin1");
      expect(source).toContain("MsgBox msg");
      return [{ name: "modFinish", source: bytes(source.replace("MsgBox msg", "MsgBox msh")) }];
    });
    expect(matchesTemplate(readVbaModuleHashes(bin), 1)).toBe(false);
  });

  it("does not match without the pinned module, or without a readable VBA project", async () => {
    const bin = await projectWith(() => [emptySheet("ThisWorkbook"), { name: "Module1", source: "Sub A()\r\nEnd Sub" }]);
    expect(matchesTemplate(readVbaModuleHashes(bin), 1)).toBe(false);
    expect(matchesTemplate({ ModFinish: templates[1].vbaModules.modFinish }, 1)).toBe(false);
    expect(matchesTemplate(null, 1)).toBe(false);
  });

  it("throws for a version that is not in the registry", () => {
    expect(() => matchesTemplate({}, 99)).toThrow(/not in the registry/);
  });
});
