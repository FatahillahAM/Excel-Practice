import { readFile } from "node:fs/promises";
import path from "node:path";
import { patchTemplate, type TemplatePatch } from "./template-patch.ts";
import { CURRENT_TEMPLATE_VERSION, templates } from "./templates.ts";

/**
 * `generate()` of WorkbookIO (AD-4): patches the current exam template with
 * one attempt's token, the server it posts to and the exam's cells. The bytes
 * Excel wrote stay as they are apart from the patched parts (`patchTemplate`),
 * so the Finish button and VBA survive and the fingerprint still matches
 * `templateVersion`, which the caller records with the attempt.
 */

export interface ExamWorkbookInput {
  /** `WHE_AttemptToken`: 32 random bytes, base64url without padding. */
  token: string;
  /** `WHE_ServerUrl`: the origin of the environment that generated the file (AD-13). */
  serverUrl: string;
  /** Instructions and Data cells, per sheet name and A1 reference. */
  cells: TemplatePatch["cells"];
}

export interface GeneratedWorkbook {
  bytes: Uint8Array;
  templateVersion: number;
}

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export async function generateExamWorkbook(input: ExamWorkbookInput): Promise<GeneratedWorkbook> {
  if (!TOKEN_RE.test(input.token)) throw new Error("Attempt token must be 32 bytes in base64url");
  const templateVersion = CURRENT_TEMPLATE_VERSION;
  // Repo-relative path: the project root is the working directory in `next start`,
  // on Vercel and in Vitest. The tracer cannot follow this computed path (it would
  // trace the whole project), so it is told to skip it and `next.config.ts`
  // ships the templates with each route that generates (`outputFileTracingIncludes`).
  const template = await readFile(path.join(/*turbopackIgnore: true*/ process.cwd(), templates[templateVersion].file));
  const bytes = await patchTemplate(template, {
    properties: {
      WHE_AttemptToken: input.token,
      WHE_ServerUrl: input.serverUrl,
      WHE_TemplateVersion: String(templateVersion),
    },
    cells: input.cells,
  });
  return { bytes, templateVersion };
}
