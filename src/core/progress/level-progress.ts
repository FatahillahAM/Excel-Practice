import type { LevelModule } from "@/core/content/level-module";
import { isPassingScore, resultSchema } from "@/core/grading";

/**
 * The progress model (AD-7): derived per request from the user's graded
 * attempts, never stored. `toGradedAttempts` is the one parse of the shared
 * read (`listProgressAttempts`) that the Level Path, streak (4.2), gates
 * (4.3) and records (4.4) build on; `levelProgress` turns it into the state
 * of every curriculum level.
 */

/** A graded attempt with a valid stored Result: what every progress derivation reads. */
export interface GradedAttempt {
  /** The attempt id (the tie-break after `receivedAt` for records, 4.4). */
  id: string;
  itemId: string;
  score: number;
  startedAt: string;
  receivedAt: string | null;
}

/** The stored-row shape `toGradedAttempts` reads (the adapter's `ProgressAttemptRow`). */
export interface GradedAttemptSource {
  id: string;
  itemId: string;
  result: unknown;
  startedAt: string;
  receivedAt: string | null;
}

/**
 * Rows → graded attempts, in the given order. A Result that fails
 * `resultSchema` is dropped and logged (`progress.result_invalid`, the
 * attempt id only, never the content).
 */
export function toGradedAttempts(rows: readonly GradedAttemptSource[]): GradedAttempt[] {
  const out: GradedAttempt[] = [];
  for (const row of rows) {
    const parsed = resultSchema.safeParse(row.result);
    if (!parsed.success) {
      console.error(JSON.stringify({ event: "progress.result_invalid", attemptId: row.id }));
      continue;
    }
    out.push({ id: row.id, itemId: row.itemId, score: parsed.data.score, startedAt: row.startedAt, receivedAt: row.receivedAt });
  }
  return out;
}

/** The main path of the curriculum (`level-curriculum.md` › Peta level), Level 1–9; Ujian Akhir follows. */
export const CURRICULUM: readonly { number: number; name: string }[] = [
  { number: 1, name: "Fondasi" },
  { number: 2, name: "Logika" },
  { number: 3, name: "Hitung bersyarat" },
  { number: 4, name: "Cari data" },
  { number: 5, name: "Rapikan data" },
  { number: 6, name: "Rumus modern" },
  { number: 7, name: "Pivot" },
  { number: 8, name: "Lintas file" },
  { number: 9, name: "Summary" },
];
export const FINAL_EXAM_NAME = "Ujian Akhir";

export type LevelState = "passed" | "active" | "locked" | "under_construction";

export interface LevelProgress {
  number: number;
  name: string;
  state: LevelState;
  /** Practice numbers (1–5) with at least one graded attempt, any score. */
  practicesDone: ReadonlySet<number>;
  /** The level's Test has a graded attempt scoring ≥ `PASS_SCORE`. */
  testPassed: boolean;
  /** The level's Test has a graded attempt, any score ("Try the Test again" when not passed). */
  testAttempted: boolean;
}

/** The last level of V1: passing its Test ends V1 ("Level 4 complete — Level 5 is coming soon"). */
export const V1_LAST_LEVEL = 4;

/** Distinct practices with a graded attempt that open the level's Test (CAP-9). */
export const PRACTICES_FOR_TEST = 5;

/**
 * Every curriculum level's state from graded attempts and the registry.
 * Level 1 is open; Level N+1 opens when Test N is passed. A level without a
 * module in the registry, or of phase `next`, is Under Construction (and
 * opens nothing after it), and so is every level after `V1_LAST_LEVEL` (V1
 * ends there). An open level is passed once its Test is passed, else active.
 * Unknown items are ignored. Practice again only adds attempts to items
 * already counted, so it never changes pips, the gate or a level's state.
 */
export function levelProgress(attempts: readonly GradedAttempt[], modules: readonly LevelModule[]): LevelProgress[] {
  const byNumber = new Map(modules.map((mod) => [mod.number, mod]));
  const done = new Map<number, Set<number>>();
  const passed = new Set<number>();
  const attempted = new Set<number>();
  for (const attempt of attempts) {
    for (const mod of modules) {
      const item = mod.items.find((candidate) => candidate.id === attempt.itemId);
      if (!item) continue;
      if (item.kind === "practice") {
        const set = done.get(mod.number) ?? new Set<number>();
        set.add(item.number);
        done.set(mod.number, set);
      } else {
        attempted.add(mod.number);
        if (isPassingScore(attempt.score)) passed.add(mod.number);
      }
    }
  }

  let open = true;
  return CURRICULUM.map(({ number, name }) => {
    const mod = byNumber.get(number);
    const testPassed = passed.has(number);
    const practicesDone: ReadonlySet<number> = done.get(number) ?? new Set<number>();
    let state: LevelState;
    const buildable = mod !== undefined && mod.phase !== "next" && number <= V1_LAST_LEVEL;
    if (!buildable) state = "under_construction";
    else if (!open) state = "locked";
    else state = testPassed ? "passed" : "active";
    open = open && buildable && testPassed;
    return { number, name: mod?.name ?? name, state, practicesDone, testPassed, testAttempted: attempted.has(number) };
  });
}

/** The sidebar's curriculum count (parked 4.5): the active level and passed levels of the 9. */
export interface CurriculumSummary {
  /** The first active level; the last passed one when none is active (after V1 ends); else 1. */
  activeLevel: number;
  passed: number;
  total: number;
}

/** `levelProgress` → the sidebar's "L{n}" badge and "{passed} of 9 levels passed" (AD-7, nothing stored). */
export function curriculumSummary(progress: readonly Pick<LevelProgress, "number" | "state">[]): CurriculumSummary {
  const passed = progress.filter((level) => level.state === "passed");
  const active = progress.find((level) => level.state === "active");
  return {
    activeLevel: active?.number ?? passed.at(-1)?.number ?? 1,
    passed: passed.length,
    total: CURRICULUM.length,
  };
}

/** Level 4's Test is passed: V1 is complete and nothing new opens. */
export function v1Complete(progress: readonly Pick<LevelProgress, "number" | "state">[]): boolean {
  return progress.find((level) => level.number === V1_LAST_LEVEL)?.state === "passed";
}

/** Why Start refuses an item (no attempt is created). */
export type StartRefusal = "unknown_item" | "under_construction" | "level_locked" | "test_locked" | "practice_locked";

export type StartCheck =
  | { ok: true; practiceAgain: boolean }
  /** `toGo`: practices still to do, with `test_locked`. */
  | { ok: false; reason: StartRefusal; toGo?: number };

/**
 * Whether `itemId` may be started now (the server Start gate, CAP-9): the
 * item is in `modules`, its level is active or passed, and a Test needs
 * `PRACTICES_FOR_TEST` practices done. Practices go in order: practice N
 * needs every earlier practice with content done (as the panel's "next");
 * a done practice or a passed Test is a Practice again; a failed Test can be
 * retaken at once. An item id of a curriculum level without content is
 * Under Construction; anything else unknown is `unknown_item`. An open
 * attempt is not checked here (the database allows one at a time).
 */
export function canStart(progress: readonly LevelProgress[], modules: readonly LevelModule[], itemId: string): StartCheck {
  for (const mod of modules) {
    const item = mod.items.find((candidate) => candidate.id === itemId);
    if (!item) continue;
    const level = progress.find((entry) => entry.number === mod.number);
    if (!level || level.state === "under_construction") return { ok: false, reason: "under_construction" };
    if (level.state === "locked") return { ok: false, reason: "level_locked" };
    if (item.kind === "practice") {
      if (level.practicesDone.has(item.number)) return { ok: true, practiceAgain: true };
      const skipped = mod.items.some(
        (other) => other.kind === "practice" && other.number < item.number && !level.practicesDone.has(other.number),
      );
      return skipped ? { ok: false, reason: "practice_locked" } : { ok: true, practiceAgain: false };
    }
    if (level.practicesDone.size < PRACTICES_FOR_TEST) {
      return { ok: false, reason: "test_locked", toGo: PRACTICES_FOR_TEST - level.practicesDone.size };
    }
    return { ok: true, practiceAgain: level.testPassed };
  }
  const match = /^L(\d{2})-(P[1-5]|T)$/.exec(itemId);
  const level = match ? progress.find((entry) => entry.number === Number(match[1])) : undefined;
  if (level?.state === "under_construction") return { ok: false, reason: "under_construction" };
  return { ok: false, reason: "unknown_item" };
}
