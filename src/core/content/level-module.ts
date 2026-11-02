import { z } from "zod";

/**
 * The `LevelModule` contract (AD-2), minimal for the tracer: a level, its
 * items and the cells each item's exam workbook gets. Entry 8 adds
 * `generate(seed, scenario)`, the scenario bank, questions, answer key, hints
 * and Tips; until then an item's cells are fixed (`examCells()`).
 *
 * Engine code reads levels only through `src/content/levels/index.ts`.
 */

/** One cell value written into the exam workbook: text or a number. */
export type ExamCellValue = string | number;

/** Cells per sheet name, then per A1 reference (`{ Data: { A1: "Lini" } }`). */
export type ExamCells = Readonly<Record<string, Readonly<Record<string, ExamCellValue>>>>;

export type LevelPhase = "v1" | "next";
export type LevelItemKind = "practice" | "test";

export interface LevelItem {
  /** `L01-P1` … `L09-T` (Consistency Conventions › Naming). */
  id: string;
  kind: LevelItemKind;
  /** Practice 1–5; the Test is item 6. */
  number: number;
  /** Instructions and Data cells of this item's exam workbook. */
  examCells(): ExamCells;
}

export interface LevelModule {
  /** Folder name: `01-fondasi`. */
  id: string;
  number: number;
  /** Curriculum name (Indonesian): `Fondasi`. */
  name: string;
  phase: LevelPhase;
  /** Hints per attempt (CAP-7). */
  hintQuota: number;
  items: readonly LevelItem[];
}

/** Item ids, as the `attempts.item_id` check in migration 20261102000001. */
export const ITEM_ID_RE = /^L\d{2}-(P[1-5]|T)$|^UA$/;

const A1_REF_RE = /^[A-Z]{1,3}[1-9]\d{0,6}$/;

const cellValueSchema = z.union([z.string(), z.number().finite()]);

/** The output of `examCells()`: at least one sheet, A1 references only. */
export const examCellsSchema = z.record(
  z.string().min(1).max(31),
  z.record(z.string().regex(A1_REF_RE), cellValueSchema),
);

const levelItemSchema = z.object({
  id: z.string().regex(ITEM_ID_RE),
  kind: z.enum(["practice", "test"]),
  number: z.number().int().min(1).max(6),
  examCells: z.custom<() => ExamCells>((value) => typeof value === "function", "examCells must be a function"),
});

/** The static shape of a `LevelModule`, checked when the module loads (Consistency Conventions › Validation). */
export const levelModuleSchema = z
  .object({
    id: z.string().regex(/^\d{2}-[a-z0-9]+(-[a-z0-9]+)*$/),
    number: z.number().int().min(1).max(99),
    name: z.string().min(1),
    phase: z.enum(["v1", "next"]),
    hintQuota: z.number().int().min(0),
    items: z.array(levelItemSchema),
  })
  .superRefine((level, ctx) => {
    const nn = String(level.number).padStart(2, "0");
    if (!level.id.startsWith(`${nn}-`)) {
      ctx.addIssue({ code: "custom", path: ["id"], message: `Level ${level.number} lives in a folder starting with ${nn}-` });
    }
    const seen = new Set<string>();
    level.items.forEach((item, index) => {
      const expected = item.kind === "practice" ? `L${nn}-P${item.number}` : `L${nn}-T`;
      if (item.kind === "practice" && item.number > 5) {
        ctx.addIssue({ code: "custom", path: ["items", index, "number"], message: "Practices are numbered 1–5" });
      }
      if (item.kind === "test" && item.number !== 6) {
        ctx.addIssue({ code: "custom", path: ["items", index, "number"], message: "The Test is item 6" });
      }
      if (item.id !== expected) {
        ctx.addIssue({ code: "custom", path: ["items", index, "id"], message: `Item id must be ${expected}` });
      }
      if (seen.has(item.id)) {
        ctx.addIssue({ code: "custom", path: ["items", index, "id"], message: `Duplicate item ${item.id}` });
      }
      seen.add(item.id);
    });
  });

/** Validates a level module at load time and returns it unchanged; throws on a malformed module. */
export function defineLevelModule(level: LevelModule): LevelModule {
  levelModuleSchema.parse(level);
  return level;
}

/** UI label of an item: "Practice 1", "Test". */
export function itemLabel(item: Pick<LevelItem, "kind" | "number">): string {
  return item.kind === "practice" ? `Practice ${item.number}` : "Test";
}
