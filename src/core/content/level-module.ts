import { z } from "zod";
import { expandRange } from "./a1";
import { checkSchema, findM365Functions } from "./checks";
import { isSeed } from "./random";

/**
 * The `LevelModule` contract (AD-2): a level, its scenario bank, its items,
 * and per item `generate(seed, scenario)` → the exam's Instructions and Data
 * cells plus its questions (points, answer range, declared checks, key,
 * ordered hints and one Tip). Everything is validated when the module loads
 * (`defineLevelModule`), so a malformed module fails at import and in the
 * tests, never at Start. Hints and Tips live only in the snapshot (AD-9).
 *
 * Engine code reads levels only through `src/content/levels/index.ts`.
 */

/** One cell value written into the exam workbook: text or a number. */
export type ExamCellValue = string | number;

/** Cells per sheet name, then per A1 reference (`{ Data: { A1: "Lini" } }`). */
export type ExamCells = Readonly<Record<string, Readonly<Record<string, ExamCellValue>>>>;

export type LevelPhase = "v1" | "next";
export type LevelItemKind = "practice" | "test";

/** The fields every scenario has; a level's own scenario schema extends them. */
export interface Scenario {
  /** Kebab-case, unique in the level: the snapshot's `scenarioId`. */
  id: string;
  title: string;
  story: string;
}

/** One question of a generated exam (AD-3). */
export interface ExamQuestion {
  /** 1…n, in order; prompt `n` is Instructions line `n`. */
  number: number;
  prompt: string;
  /** Integer > 0; the questions of an exam sum to 100. */
  points: number;
  /** The sheet the answer cells are on. */
  sheet: string;
  /** Answer cells, A1 without `$`: `H2:H13`, `O2:R6`, `I2`. */
  range: string;
  /** Declared checks (names from `CHECKERS`); `grade()` (epic 3) runs them. */
  checks: z.infer<typeof checkSchema>[];
  /** The expected value of every cell of `range`, and of no other cell. */
  key: Readonly<Record<string, ExamCellValue>>;
  /** 1–`MAX_HINTS_PER_QUESTION` hints in Indonesian, from nudge to method; never a key value or the full formula. */
  hints: string[];
  /** The question's Tip (CAP-8); one id means one Tip content across the level. */
  tip: Tip;
}

export interface GeneratedExam {
  cells: ExamCells;
  questions: ExamQuestion[];
}

/** What Start stores with the attempt (AD-3): enough to grade it later without re-generating. */
export interface ExamSnapshot {
  /** `SNAPSHOT_VERSION`; a snapshot of another version is not graded. */
  version: typeof SNAPSHOT_VERSION;
  contentVersion: number;
  scenarioId: string;
  seed: number;
  /** The level's `hintQuota` at Start (CAP-7). */
  hintQuota: number;
  questions: ExamQuestion[];
}

export interface LevelItem<S extends Scenario = Scenario> {
  /** `L01-P1` … `L09-T` (Consistency Conventions › Naming). */
  id: string;
  kind: LevelItemKind;
  /** Practice 1–5; the Test is item 6. */
  number: number;
  /** Pure and deterministic: draws only from `createRandom(seed)`. Same seed and scenario, same exam. */
  generate(seed: number, scenario: S): GeneratedExam;
}

export interface LevelModule<S extends Scenario = Scenario> {
  /** Folder name: `01-fondasi`. */
  id: string;
  number: number;
  /** Curriculum name (Indonesian): `Fondasi`. */
  name: string;
  phase: LevelPhase;
  /** Bumped with every content change (AD-10); stored in each attempt's snapshot. */
  contentVersion: number;
  /** Curriculum functions of the level, in Excel's own (English) names (`level-curriculum.md`). */
  functions: readonly string[];
  /** Hints per attempt (CAP-7). */
  hintQuota: number;
  /** The scenario bank, shared by the level's items (≥10 in V1). */
  scenarios: readonly S[];
  /** The level's scenario shape (extends `scenarioSchema`); every scenario must pass it. */
  scenarioSchema: z.ZodType<S>;
  items: readonly LevelItem<S>[];
}

/** Item ids, as the `attempts.item_id` check in migration 20261102000001. */
export const ITEM_ID_RE = /^L\d{2}-(P[1-5]|T)$|^UA$/;

/** The sheets of template v1 (`assets/templates/README.md` › Layout v1). */
export const INSTRUCTIONS_SHEET = "Instructions";
export const DATA_SHEET = "Data";
export const TEMPLATE_SHEETS: readonly string[] = [INSTRUCTIONS_SHEET, DATA_SHEET];

/**
 * The Instructions cells of template v1, the content ↔ template contract:
 * B2 title, B4 scenario, B6:B10 lines (the prompts "1. …", then e.g. the
 * Finish line). A v2 layout changes this together with the template.
 */
export const INSTRUCTIONS_CELLS = {
  title: "B2",
  scenario: "B4",
  lines: ["B6", "B7", "B8", "B9", "B10"],
} as const;

/**
 * At most 4 questions: prompts take lines B6:B9, and the last line (B10) is
 * kept for the Finish line, so no item can write past `INSTRUCTIONS_CELLS.lines`.
 */
export const MAX_QUESTIONS = INSTRUCTIONS_CELLS.lines.length - 1;
export const TOTAL_POINTS = 100;
/** Practices in V1 have at least this many scenarios (AD-2). */
export const MIN_SCENARIOS_V1 = 10;
/** The seed `defineLevelModule` generates every (item, scenario) with. */
export const LOAD_CHECK_SEED = 1;
/** Hints per question, at most (and at least 1). */
export const MAX_HINTS_PER_QUESTION = 3;
/** The `ExamSnapshot` shape version: 2 adds `version`, `hintQuota`, and hints and a Tip per question. */
export const SNAPSHOT_VERSION = 2;

const MAX_ANSWER_CELLS = 2000;
const A1_REF_RE = /^[A-Z]{1,3}[1-9]\d{0,6}$/;
const KEBAB_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ALLOWED_INSTRUCTIONS = new Set<string>([
  INSTRUCTIONS_CELLS.title,
  INSTRUCTIONS_CELLS.scenario,
  ...INSTRUCTIONS_CELLS.lines,
]);

const cellValueSchema = z.union([z.string(), z.number().finite()]);

/** Exam cells: at least one sheet, each with at least one cell, A1 references only. */
export const examCellsSchema = z
  .record(
    z.string().min(1).max(31),
    z
      .record(z.string().regex(A1_REF_RE), cellValueSchema)
      .refine((cells) => Object.keys(cells).length > 0, "A sheet needs at least one cell"),
  )
  .refine((sheets) => Object.keys(sheets).length > 0, "At least one sheet");

/** The base scenario: kebab id, title, story. Levels extend it with their own fields. */
export const scenarioSchema = z.object({
  id: z.string().regex(KEBAB_RE).max(64),
  title: z.string().trim().min(1).max(120),
  story: z.string().trim().min(1).max(1000),
});

/** A Tip (CAP-8): what Results shows under a question and the Tips collection keeps, by `id`. */
export const tipSchema = z
  .object({
    /** Kebab-case: one id is one Tip content across the level (the Tips collection dedupes by id). */
    id: z.string().regex(KEBAB_RE).max(64),
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(2000),
    /** Keyboard shortcuts, in Excel's own key names joined with `+` (`Ctrl+Shift+%`, `F4`). */
    shortcuts: z.array(z.string().trim().min(1).max(40)).max(10),
  })
  .strict();

export type Tip = z.infer<typeof tipSchema>;

/** One hint: Indonesian text, not blank. */
export const hintSchema = z.string().trim().min(1).max(500);

export const examQuestionSchema = z
  .object({
    number: z.number().int().min(1).max(MAX_QUESTIONS),
    prompt: z.string().trim().min(1).max(1000),
    points: z.number().int().positive(),
    sheet: z.string().min(1).max(31),
    range: z.string().min(2),
    checks: z.array(checkSchema).min(1),
    key: z.record(z.string().regex(A1_REF_RE), cellValueSchema),
    hints: z.array(hintSchema).min(1).max(MAX_HINTS_PER_QUESTION),
    tip: tipSchema,
  })
  .strict();

function addPointsIssues(questions: readonly { number: number; points: number }[], ctx: z.RefinementCtx) {
  questions.forEach((question, index) => {
    if (question.number !== index + 1) {
      ctx.addIssue({ code: "custom", path: ["questions", index, "number"], message: `Question ${index + 1} must be number ${index + 1}` });
    }
  });
  const total = questions.reduce((sum, question) => sum + question.points, 0);
  if (total !== TOTAL_POINTS) {
    ctx.addIssue({ code: "custom", path: ["questions"], message: `Points sum to ${total}, not ${TOTAL_POINTS}` });
  }
}

function addM365Issue(text: string, path: (string | number)[], ctx: z.RefinementCtx) {
  const found = findM365Functions(text);
  if (found.length > 0) {
    ctx.addIssue({ code: "custom", path, message: `Microsoft 365-only function ${found.join(", ")} (Excel 2021 has none)` });
  }
}

/**
 * The output of `generate()`, as Start writes it into template v1 and stores
 * it (AD-3): only the Instructions and Data sheets; Instructions only in
 * `INSTRUCTIONS_CELLS`, with the title and scenario, prompt `n` on line `n`
 * as "n. …"; Data from A1; questions 1…n (n ≤ `MAX_QUESTIONS`) whose integer points sum
 * to 100, each with `value_equals_key` and a key covering exactly its answer
 * cells, which stay empty and belong to one question only; 1–3 hints and one
 * Tip per question, Tip ids unique in the exam; no Microsoft 365-only function
 * name anywhere (Instructions and Data text, prompts, `uses_functions`, hints,
 * Tip title, body and shortcuts).
 */
export const generatedExamSchema = z
  .object({ cells: examCellsSchema, questions: z.array(examQuestionSchema).min(1).max(MAX_QUESTIONS) })
  .strict()
  .superRefine((exam, ctx) => {
    const sheets = Object.keys(exam.cells);
    for (const sheet of sheets) {
      if (!TEMPLATE_SHEETS.includes(sheet)) {
        ctx.addIssue({ code: "custom", path: ["cells", sheet], message: `Template v1 has no sheet ${sheet}` });
      }
    }
    const instructions = exam.cells[INSTRUCTIONS_SHEET];
    const data = exam.cells[DATA_SHEET];
    if (!instructions) {
      ctx.addIssue({ code: "custom", path: ["cells", INSTRUCTIONS_SHEET], message: "Instructions sheet missing" });
    } else {
      for (const [ref, value] of Object.entries(instructions)) {
        if (!ALLOWED_INSTRUCTIONS.has(ref)) {
          ctx.addIssue({ code: "custom", path: ["cells", INSTRUCTIONS_SHEET, ref], message: `Template v1 writes no Instructions!${ref}` });
        }
        if (typeof value !== "string" || value.trim() === "") {
          ctx.addIssue({ code: "custom", path: ["cells", INSTRUCTIONS_SHEET, ref], message: "Instructions cells hold text" });
        } else {
          addM365Issue(value, ["cells", INSTRUCTIONS_SHEET, ref], ctx);
        }
      }
      for (const ref of [INSTRUCTIONS_CELLS.title, INSTRUCTIONS_CELLS.scenario]) {
        if (instructions[ref] === undefined) {
          ctx.addIssue({ code: "custom", path: ["cells", INSTRUCTIONS_SHEET, ref], message: `Instructions!${ref} missing` });
        }
      }
    }
    for (const [sheet, cells] of Object.entries(exam.cells)) {
      if (sheet === INSTRUCTIONS_SHEET) continue;
      for (const [ref, value] of Object.entries(cells)) {
        if (typeof value === "string") addM365Issue(value, ["cells", sheet, ref], ctx);
      }
    }
    if (!data || data.A1 === undefined) {
      ctx.addIssue({ code: "custom", path: ["cells", DATA_SHEET], message: "Data starts at A1" });
    }

    addPointsIssues(exam.questions, ctx);

    const answerCells = new Set<string>();
    const tipIds = new Set<string>();
    exam.questions.forEach((question, index) => {
      const at = (...rest: (string | number)[]) => ["questions", index, ...rest];
      addM365Issue(question.prompt, at("prompt"), ctx);
      question.hints.forEach((hint, h) => addM365Issue(hint, at("hints", h), ctx));
      addM365Issue(question.tip.title, at("tip", "title"), ctx);
      addM365Issue(question.tip.body, at("tip", "body"), ctx);
      question.tip.shortcuts.forEach((shortcut, k) => addM365Issue(shortcut, at("tip", "shortcuts", k), ctx));
      if (tipIds.has(question.tip.id)) {
        ctx.addIssue({ code: "custom", path: at("tip", "id"), message: `Tip ${question.tip.id} is used by two questions` });
      }
      tipIds.add(question.tip.id);
      const line = INSTRUCTIONS_CELLS.lines[question.number - 1];
      if (instructions && line && instructions[line] !== `${question.number}. ${question.prompt}`) {
        ctx.addIssue({ code: "custom", path: at("prompt"), message: `Instructions!${line} must be "${question.number}. " + the prompt` });
      }
      question.checks.forEach((check, c) => {
        if (check.name === "uses_functions") addM365Issue(check.functions.join(" "), at("checks", c), ctx);
      });
      if (!question.checks.some((check) => check.name === "value_equals_key")) {
        ctx.addIssue({ code: "custom", path: at("checks"), message: "Every question checks value_equals_key" });
      }
      if (question.sheet === INSTRUCTIONS_SHEET || !TEMPLATE_SHEETS.includes(question.sheet)) {
        ctx.addIssue({ code: "custom", path: at("sheet"), message: `Answers cannot go on ${question.sheet}` });
      }
      const cells = expandRange(question.range, MAX_ANSWER_CELLS);
      if (!cells) {
        ctx.addIssue({ code: "custom", path: at("range"), message: `Malformed answer range ${question.range}` });
        return;
      }
      const keyRefs = Object.keys(question.key);
      const inRange = new Set(cells);
      const missing = cells.filter((ref) => question.key[ref] === undefined);
      const extra = keyRefs.filter((ref) => !inRange.has(ref));
      if (missing.length > 0 || extra.length > 0) {
        ctx.addIssue({
          code: "custom",
          path: at("key"),
          message: `Key must cover exactly ${question.range} (missing ${missing.join(",") || "none"}, extra ${extra.join(",") || "none"})`,
        });
      }
      const written = exam.cells[question.sheet] ?? {};
      for (const ref of cells) {
        if (written[ref] !== undefined) {
          ctx.addIssue({ code: "custom", path: at("range"), message: `Answer cell ${question.sheet}!${ref} is written` });
        }
        const id = `${question.sheet}!${ref}`;
        if (answerCells.has(id)) {
          ctx.addIssue({ code: "custom", path: at("range"), message: `Answer cell ${id} belongs to two questions` });
        }
        answerCells.add(id);
      }
    });
  });

/**
 * `attempts.snapshot` (AD-3): snapshot version, content version, scenario,
 * seed, the level's hint quota and the questions with their keys, hints and
 * Tips. A snapshot without them (v1) fails here and is not graded (U5).
 */
export const examSnapshotSchema = z
  .object({
    version: z.literal(SNAPSHOT_VERSION),
    contentVersion: z.number().int().positive(),
    scenarioId: scenarioSchema.shape.id,
    seed: z.number().refine(isSeed, "Seed is a uint32"),
    hintQuota: z.number().int().min(0),
    questions: z.array(examQuestionSchema).min(1).max(MAX_QUESTIONS),
  })
  .strict()
  .superRefine((snapshot, ctx) => addPointsIssues(snapshot.questions, ctx));

const levelItemSchema = z.object({
  id: z.string().regex(ITEM_ID_RE),
  kind: z.enum(["practice", "test"]),
  number: z.number().int().min(1).max(6),
  generate: z.custom<LevelItem["generate"]>((value) => typeof value === "function", "generate must be a function"),
});

/** The static shape of a `LevelModule`, checked when the module loads (Consistency Conventions › Validation). */
export const levelModuleSchema = z
  .object({
    id: z.string().regex(/^\d{2}-[a-z0-9]+(-[a-z0-9]+)*$/),
    number: z.number().int().min(1).max(99),
    name: z.string().min(1),
    phase: z.enum(["v1", "next"]),
    contentVersion: z.number().int().positive(),
    functions: z.array(z.string().trim().min(1)).min(1),
    hintQuota: z.number().int().min(0),
    scenarios: z.array(scenarioSchema),
    scenarioSchema: z.custom<z.ZodType>(
      (value) => typeof (value as { safeParse?: unknown } | null)?.safeParse === "function",
      "scenarioSchema must be a zod schema",
    ),
    items: z.array(levelItemSchema),
  })
  .superRefine((level, ctx) => {
    const nn = String(level.number).padStart(2, "0");
    if (!level.id.startsWith(`${nn}-`)) {
      ctx.addIssue({ code: "custom", path: ["id"], message: `Level ${level.number} lives in a folder starting with ${nn}-` });
    }
    level.functions.forEach((name, index) => addM365Issue(name, ["functions", index], ctx));
    if (level.phase === "v1" && level.scenarios.length < MIN_SCENARIOS_V1) {
      ctx.addIssue({
        code: "custom",
        path: ["scenarios"],
        message: `A V1 level needs at least ${MIN_SCENARIOS_V1} scenarios, has ${level.scenarios.length}`,
      });
    }
    const scenarioIds = new Set<string>();
    level.scenarios.forEach((scenario, index) => {
      if (scenarioIds.has(scenario.id)) {
        ctx.addIssue({ code: "custom", path: ["scenarios", index, "id"], message: `Duplicate scenario ${scenario.id}` });
      }
      scenarioIds.add(scenario.id);
    });
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

/**
 * Validates a level module at load time and returns it unchanged; throws on a
 * malformed module: the static shape (`levelModuleSchema`), every scenario
 * against the level's `scenarioSchema`, and every item's `generate` once per
 * scenario (seed `LOAD_CHECK_SEED`) against `generatedExamSchema`, and that
 * one Tip id has one content across every generated item × scenario.
 */
export function defineLevelModule<S extends Scenario>(level: LevelModule<S>): LevelModule<S> {
  levelModuleSchema.parse(level);
  const problems: string[] = [];
  for (const scenario of level.scenarios) {
    const parsed = level.scenarioSchema.safeParse(scenario);
    if (!parsed.success) problems.push(`scenario ${scenario.id}: ${z.prettifyError(parsed.error)}`);
  }
  if (problems.length === 0) {
    const tips = new Map<string, { tip: Tip; where: string }>();
    for (const item of level.items) {
      for (const scenario of level.scenarios) {
        const where = `${item.id} × ${scenario.id}`;
        let exam: unknown;
        try {
          exam = item.generate(LOAD_CHECK_SEED, scenario);
        } catch (error) {
          problems.push(`${where}: generate threw ${error instanceof Error ? error.message : String(error)}`);
          continue;
        }
        const parsed = generatedExamSchema.safeParse(exam);
        if (!parsed.success) {
          problems.push(`${where}: ${z.prettifyError(parsed.error)}`);
          continue;
        }
        for (const question of parsed.data.questions) {
          const seen = tips.get(question.tip.id);
          if (seen === undefined) tips.set(question.tip.id, { tip: question.tip, where });
          else if (!sameTip(seen.tip, question.tip)) {
            problems.push(`${where}: Tip ${question.tip.id} differs from the one in ${seen.where} (one id, one Tip)`);
          }
        }
      }
    }
  }
  if (problems.length > 0) throw new Error(`Level ${level.id} is malformed:\n${problems.join("\n")}`);
  return level;
}

function sameTip(a: Tip, b: Tip): boolean {
  return (
    a.id === b.id &&
    a.title === b.title &&
    a.body === b.body &&
    a.shortcuts.length === b.shortcuts.length &&
    a.shortcuts.every((shortcut, i) => shortcut === b.shortcuts[i])
  );
}

/** UI label of an item: "Practice 1", "Test". */
export function itemLabel(item: Pick<LevelItem, "kind" | "number">): string {
  return item.kind === "practice" ? `Practice ${item.number}` : "Test";
}
