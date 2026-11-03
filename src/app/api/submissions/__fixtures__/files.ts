import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { buildVbaProject, type ModuleSpec } from "../../../../adapters/workbook/__fixtures__/vba-project";
import { patchTemplate } from "../../../../adapters/workbook/template-patch";
import { CURRENT_TEMPLATE_VERSION, templates } from "../../../../adapters/workbook/templates";
import { readVbaModuleSources } from "../../../../adapters/workbook/vba";

/**
 * Test files for the submission routes (tests only): workbooks patched from
 * the committed current template, and the wrong files of the I/O matrix.
 */

export const repoRoot = fileURLToPath(new URL("../../../../..", import.meta.url));
export const VBA_PROJECT_PART = "xl/vbaProject.bin";
/** Excel-saved v1 (spike S3): a sheet added and the VBA editor opened before Save As. */
export const S3_FIXTURE = "src/adapters/workbook/__fixtures__/s3-excel2021.xlsm";
const XLSM_MAIN = "application/vnd.ms-excel.sheet.macroEnabled.main+xml";

export const newToken = () => randomBytes(32).toString("base64url");

export interface Template {
  bytes: Uint8Array;
  modFinish: Uint8Array;
}

export async function loadTemplate(): Promise<Template> {
  const bytes = await readFile(path.join(repoRoot, templates[CURRENT_TEMPLATE_VERSION].file));
  const zip = await JSZip.loadAsync(bytes);
  const sources = readVbaModuleSources(await zip.file(VBA_PROJECT_PART)!.async("uint8array"));
  return { bytes, modFinish: sources!.get("modFinish")! };
}

export async function readS3Fixture(): Promise<Uint8Array> {
  return Uint8Array.from(await readFile(path.join(repoRoot, S3_FIXTURE)));
}

/** The current template patched with this token, as Start makes it. */
export function patched(template: Template, token: string): Promise<Uint8Array> {
  return patchTemplate(template.bytes, {
    properties: {
      WHE_AttemptToken: token,
      WHE_ServerUrl: "https://example.test",
      WHE_TemplateVersion: String(CURRENT_TEMPLATE_VERSION),
    },
    cells: { Instructions: { B2: "Judul" }, Data: { A1: "Lini", B1: "Unit", A2: "A", B2: 1200 } },
  });
}

export async function editZip(bytes: Uint8Array, edit: (zip: JSZip) => Promise<void> | void): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(bytes);
  await edit(zip);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

export const emptyDocumentModule = (name: string): ModuleSpec => ({
  name,
  source: `Attribute VB_Name = "${name}"\r\nAttribute VB_Base = "0{00020820-0000-0000-C000-000000000046}"\r\n`,
  document: true,
});

/** The patched file with an edited `modFinish`. */
export async function withEditedModFinish(template: Template, token: string): Promise<Uint8Array> {
  const edited = new Uint8Array([...template.modFinish, ...Buffer.from("\r\n' edited\r\n", "latin1")]);
  return editZip(await patched(template, token), (zip) => {
    zip.file(
      VBA_PROJECT_PART,
      buildVbaProject({ modules: [emptyDocumentModule("ThisWorkbook"), { name: "modFinish", source: edited }] }),
    );
  });
}

/** The patched file with its main part's content type (and, for a non-workbook, its main part) changed. */
export async function asPackage(
  template: Template,
  token: string,
  contentType: string,
  mainPart = "xl/workbook.xml",
): Promise<Uint8Array> {
  return editZip(await patched(template, token), async (zip) => {
    const types = await zip.file("[Content_Types].xml")!.async("string");
    zip.file(
      "[Content_Types].xml",
      types.replace(
        `<Override PartName="/xl/workbook.xml" ContentType="${XLSM_MAIN}"/>`,
        `<Override PartName="/${mainPart}" ContentType="${contentType}"/>`,
      ),
    );
    if (mainPart !== "xl/workbook.xml") {
      zip.remove("xl/workbook.xml");
      zip.file(mainPart, new Uint8Array([0x83, 0x01, 0x00]));
      const rels = await zip.file("_rels/.rels")!.async("string");
      zip.file("_rels/.rels", rels.replace('Target="xl/workbook.xml"', `Target="${mainPart}"`));
    }
  });
}

/** A Save-As `.xlsx` copy: the main part says "not macro-enabled". */
export const asXlsx = (template: Template, token: string) =>
  asPackage(template, token, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml");

/** A Word document: an OOXML package without a workbook. */
export const asDocx = (template: Template, token: string) =>
  asPackage(template, token, "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml", "word/document.xml");

/** A PDF's first bytes: not a zip at all. */
export const PDF_BYTES = new Uint8Array(Buffer.from("%PDF-1.7\n%âãÏÓ\n1 0 obj\n<< /Type /Catalog >>\nendobj\n", "latin1"));

/** A body stream of `total` bytes in 64 KiB chunks; `pulled()` counts the chunks read. */
export function streamOf(total: number) {
  let sent = 0;
  let pulls = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulls += 1;
      if (sent >= total) return controller.close();
      const size = Math.min(64 * 1024, total - sent);
      sent += size;
      controller.enqueue(new Uint8Array(size));
    },
  });
  return { stream, pulled: () => pulls };
}
