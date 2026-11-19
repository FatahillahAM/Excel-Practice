import { LOAD_CHECK_SEED, sameTip, type LevelItem, type LevelModule, type Tip } from "@/core/content/level-module";
import { fondasi } from "./01-fondasi";

/**
 * Throws when one Tip id has different content in two levels (the Tips
 * collection keys cards by id). Each level already proved one id has one
 * content across its items × scenarios × seeds (`defineLevelModule`), so one
 * generate per item (first scenario, `LOAD_CHECK_SEED`) stands for the level.
 */
export function assertTipsAgreeAcrossLevels(modules: readonly LevelModule[]): void {
  const tips = new Map<string, { tip: Tip; level: string }>();
  for (const level of modules) {
    const scenario = level.scenarios[0];
    if (!scenario) continue;
    for (const item of level.items) {
      for (const question of item.generate(LOAD_CHECK_SEED, scenario).questions) {
        const seen = tips.get(question.tip.id);
        if (seen === undefined) tips.set(question.tip.id, { tip: question.tip, level: level.id });
        else if (seen.level !== level.id && !sameTip(seen.tip, question.tip)) {
          throw new Error(`Tip ${question.tip.id} differs between levels ${seen.level} and ${level.id} (one id, one Tip)`);
        }
      }
    }
  }
}

/**
 * The level registry (AD-2): the only list of levels. The Level Map, gates
 * and Start read it; engine code never branches on a level id.
 */
export const levels: readonly LevelModule[] = [fondasi];
assertTipsAgreeAcrossLevels(levels);

export interface FoundItem {
  level: LevelModule;
  item: LevelItem;
}

/** The level and item with this item id (`L01-P1`), or `null` when no level has it. */
export function findItem(itemId: string): FoundItem | null {
  for (const level of levels) {
    const item = level.items.find((candidate) => candidate.id === itemId);
    if (item) return { level, item };
  }
  return null;
}
