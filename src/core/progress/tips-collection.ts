import type { Result, Tip } from "@/core/grading/result";

/** One stored attempt whose Result already passed `resultSchema`. */
export interface TipSourceRow {
  attemptId: string;
  itemId: string;
  startedAt: string;
  result: Result;
}

/** One card of the Tips & Tricks collection. */
export interface CollectedTip {
  tip: Tip;
  /** The level of the newest attempt's item; `null` when the item is not in the registry. */
  levelNumber: number | null;
}

export interface TipFilter {
  level: number | "all";
  query: string;
}

/** Newest first: `started_at desc, id desc` (the adapter's order, applied again here). */
function newestFirst(a: TipSourceRow, b: TipSourceRow): number {
  const ta = Date.parse(a.startedAt);
  const tb = Date.parse(b.startedAt);
  if (ta !== tb) return (Number.isNaN(tb) ? -Infinity : tb) - (Number.isNaN(ta) ? -Infinity : ta);
  return a.attemptId < b.attemptId ? 1 : a.attemptId > b.attemptId ? -1 : 0;
}

/**
 * The Tips collection (CAP-8, AD-7): every Tip stored on the given Results,
 * one card per Tip id. When an id appears more than once, the newest attempt's
 * content and level win. Questions without a Tip (Result v1) add nothing.
 * Output is newest-first-seen. Pure: no I/O, no clock.
 */
export function tipsCollection(rows: readonly TipSourceRow[], levelOf: (itemId: string) => number | null): CollectedTip[] {
  const seen = new Set<string>();
  const out: CollectedTip[] = [];
  for (const row of [...rows].sort(newestFirst)) {
    const levelNumber = levelOf(row.itemId);
    for (const question of row.result.questions) {
      const tip = question.tip;
      if (!tip || seen.has(tip.id)) continue;
      seen.add(tip.id);
      out.push({ tip, levelNumber });
    }
  }
  return out;
}

function normalize(text: string): string {
  return text.trim().toLocaleLowerCase("id-ID");
}

/** Level filter AND search (title, body, any shortcut; case-insensitive in `id-ID`, trimmed). */
export function filterTips(tips: readonly CollectedTip[], filter: TipFilter): CollectedTip[] {
  const query = normalize(filter.query);
  return tips.filter(({ tip, levelNumber }) => {
    if (filter.level !== "all" && levelNumber !== filter.level) return false;
    if (query === "") return true;
    return [tip.title, tip.body, ...tip.shortcuts].some((text) => normalize(text).includes(query));
  });
}

/** The levels that have at least one card, ascending (cards without a level are left out). */
export function tipLevels(tips: readonly CollectedTip[]): number[] {
  const levels = new Set<number>();
  for (const { levelNumber } of tips) if (levelNumber !== null) levels.add(levelNumber);
  return [...levels].sort((a, b) => a - b);
}
