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
    out.push({ itemId: row.itemId, score: parsed.data.score, startedAt: row.startedAt, receivedAt: row.receivedAt });
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
}

/**
 * Every curriculum level's state from graded attempts and the registry.
 * Level 1 is open; Level N+1 opens when Test N is passed. A level without a
 * module in the registry, or of phase `next`, is Under Construction (and
 * opens nothing after it). An open level is passed once its Test is passed,
 * else active. Unknown items are ignored.
 */
export function levelProgress(attempts: readonly GradedAttempt[], modules: readonly LevelModule[]): LevelProgress[] {
  const byNumber = new Map(modules.map((mod) => [mod.number, mod]));
  const done = new Map<number, Set<number>>();
  const passed = new Set<number>();
  for (const attempt of attempts) {
    for (const mod of modules) {
      const item = mod.items.find((candidate) => candidate.id === attempt.itemId);
      if (!item) continue;
      if (item.kind === "practice") {
        const set = done.get(mod.number) ?? new Set<number>();
        set.add(item.number);
        done.set(mod.number, set);
      } else if (isPassingScore(attempt.score)) {
        passed.add(mod.number);
      }
    }
  }

  let open = true;
  return CURRICULUM.map(({ number, name }) => {
    const mod = byNumber.get(number);
    const testPassed = passed.has(number);
    const practicesDone: ReadonlySet<number> = done.get(number) ?? new Set<number>();
    let state: LevelState;
    if (!mod || mod.phase === "next") state = "under_construction";
    else if (!open) state = "locked";
    else state = testPassed ? "passed" : "active";
    open = open && mod !== undefined && mod.phase !== "next" && testPassed;
    return { number, name: mod?.name ?? name, state, practicesDone, testPassed };
  });
}
