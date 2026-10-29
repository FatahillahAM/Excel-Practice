import { EMPTY_MODULE_SHA256, type VbaModuleHashes } from "./vba.ts";

/**
 * Exam template registry (AD-4). Each version is one file under
 * `assets/templates/` plus the VBA fingerprint of the modules it pins: per
 * module whose normalized source is not empty, the SHA-256 of that source
 * (`readVbaModuleHashes`). A submitted workbook that does not match its
 * attempt's version is IDENTITY_ALTERED (AD-6). The bytes of
 * `xl/vbaProject.bin` are never compared: Excel rewrites them on every save (S2).
 *
 * Values come only from the adapter run on the committed `.xlsm`
 * (`pinnedModules`); `templates.test.ts` recomputes them.
 */

export interface TemplateInfo {
  /** Path from the repo root. */
  file: string;
  /** Per pinned module (MODULENAMEUNICODE), lowercase hex SHA-256 of its normalized source. */
  vbaModules: Readonly<Record<string, string>>;
}

export const templates: Readonly<Record<number, TemplateInfo>> = {
  1: {
    file: "assets/templates/exam.v1.xlsm",
    vbaModules: {
      modFinish: "e8579897d34cb249d4ab70d628c925a37a0ea5e0fa6d35a14ea319b8b04ecc81",
    },
  },
};

export const CURRENT_TEMPLATE_VERSION = 1;

/** The modules a template pins: those whose normalized source is not empty. */
export function pinnedModules(hashes: VbaModuleHashes): Record<string, string> {
  return Object.fromEntries(Object.entries(hashes).filter(([, hash]) => hash !== EMPTY_MODULE_SHA256));
}

/**
 * Whether a workbook's VBA fingerprint matches template `version`: its VBA
 * project is present and readable (`hashes` not `null`) and every pinned module
 * is present with an equal hash. Modules the template does not pin are ignored.
 * Throws for a version that is not in the registry.
 */
export function matchesTemplate(hashes: VbaModuleHashes | null, version: number): boolean {
  const template = Object.hasOwn(templates, version) ? templates[version] : undefined;
  if (template === undefined) throw new Error(`Template version ${version} is not in the registry`);
  const pinned = Object.entries(template.vbaModules);
  if (pinned.length === 0) throw new Error(`Template version ${version} pins no VBA module`);
  if (hashes === null) return false;
  return pinned.every(([name, hash]) => Object.hasOwn(hashes, name) && hashes[name] === hash);
}
