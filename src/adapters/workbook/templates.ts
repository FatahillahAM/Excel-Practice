import { createHash } from "node:crypto";
import { EMPTY_MODULE_SHA256, type VbaModuleHashes } from "./vba.ts";

/**
 * Exam template registry (AD-4). Each version is one file under
 * `assets/templates/` plus the VBA fingerprint of the modules it pins: per
 * module whose normalized source is not empty, the SHA-256 of that source
 * (`readVbaModuleHashes`). A submitted workbook that does not match its
 * attempt's version is IDENTITY_ALTERED (AD-6); so is one with code in a
 * module the template does not pin (`matchesTemplate`). The bytes of
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

/**
 * Option statements a module may hold and still count as having no code. Excel
 * with "Require Variable Declaration" writes `Option Explicit` into every new
 * module, including a new sheet's. One line per kind, at most once each.
 */
const OPTION_STATEMENT_KINDS: readonly (readonly string[])[] = [
  ["Option Explicit"],
  ["Option Compare Binary", "Option Compare Text", "Option Compare Database"],
  ["Option Base 0", "Option Base 1"],
  ["Option Private Module"],
];

/**
 * Hashes of every normalized source (lines joined with LF, as `vba.ts`
 * normalizes) made only of option statements, in any order, each kind at most
 * once. The VBA editor writes keywords with this case and single spaces.
 */
const OPTION_ONLY_SHA256: ReadonlySet<string> = (() => {
  const hashes = new Set<string>();
  const extend = (lines: string[], used: ReadonlySet<number>) => {
    OPTION_STATEMENT_KINDS.forEach((variants, kind) => {
      if (used.has(kind)) return;
      for (const line of variants) {
        const next = [...lines, line];
        hashes.add(createHash("sha256").update(next.join("\n"), "latin1").digest("hex"));
        extend(next, new Set([...used, kind]));
      }
    });
  };
  extend([], new Set());
  return hashes;
})();

/** Whether an unpinned module holds no code: empty, or only option statements. */
function holdsNoCode(hash: string): boolean {
  return hash === EMPTY_MODULE_SHA256 || OPTION_ONLY_SHA256.has(hash);
}

/** The modules a template pins: those whose normalized source is not empty. */
export function pinnedModules(hashes: VbaModuleHashes): Record<string, string> {
  return Object.fromEntries(Object.entries(hashes).filter(([, hash]) => hash !== EMPTY_MODULE_SHA256));
}

/**
 * Whether a workbook's VBA fingerprint matches template `version` (AD-4): its
 * VBA project is present and readable (`hashes` not `null`), every pinned
 * module is present with an equal hash, and every module the template does not
 * pin normalizes to empty (`EMPTY_MODULE_SHA256`) or to option statements only
 * (`Option Explicit`, …): a new sheet's module passes, code added to
 * ThisWorkbook, a sheet or a new module does not.
 * Throws for a version that is not in the registry.
 */
export function matchesTemplate(hashes: VbaModuleHashes | null, version: number): boolean {
  const template = Object.hasOwn(templates, version) ? templates[version] : undefined;
  if (template === undefined) throw new Error(`Template version ${version} is not in the registry`);
  const pinned = Object.entries(template.vbaModules);
  if (pinned.length === 0) throw new Error(`Template version ${version} pins no VBA module`);
  if (hashes === null) return false;
  const pinnedOk = pinned.every(([name, hash]) => Object.hasOwn(hashes, name) && hashes[name] === hash);
  const othersEmpty = Object.entries(hashes).every(
    ([name, hash]) => Object.hasOwn(template.vbaModules, name) || holdsNoCode(hash),
  );
  return pinnedOk && othersEmpty;
}
