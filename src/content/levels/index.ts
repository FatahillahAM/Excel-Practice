import { LOAD_CHECK_SEED, itemFromId, sameTip, type LevelItem, type LevelItemKind, type LevelModule, type MateriCard, type Tip } from "@/core/content/level-module";
import { CURRICULUM } from "@/core/progress/level-progress";
import { fondasi } from "./01-fondasi";

/**
 * Throws when one Tip id has different content in two levels (the Tips
 * collection keys cards by id). Every item × scenario of each level is
 * generated at `LOAD_CHECK_SEED` (`defineLevelModule` already proved the
 * other seeds agree within a level).
 */
export function assertTipsAgreeAcrossLevels(modules: readonly LevelModule[]): void {
  const tips = new Map<string, { tip: Tip; level: string }>();
  for (const level of modules) {
    for (const item of level.items) {
      for (const scenario of level.scenarios) {
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

/** What Results, History and Exam show about an item: its kind and number, and its level. */
export interface ItemView {
  item: { kind: LevelItemKind; number: number } | null;
  level: { number: number; name: string } | null;
  /** The item's Materi cards (a Practice in the registry), else empty: the Exam screen's Materi button (5.7). */
  materi: readonly MateriCard[];
}

/**
 * The item and level of `itemId` from the registry; for an id the registry
 * no longer has (`L03-T` of a removed item), from the id itself (`itemFromId`)
 * and the curriculum's level name, so a Test still reads "Test passed" (no
 * stored kind, no migration). Both `null` for an id that is neither.
 */
export function itemView(itemId: string): ItemView {
  const found = findItem(itemId);
  if (found) {
    return {
      item: { kind: found.item.kind, number: found.item.number },
      level: { number: found.level.number, name: found.level.name },
      materi: found.item.kind === "practice" ? (found.item.materi ?? []) : [],
    };
  }
  const item = itemFromId(itemId);
  const level = item === null ? undefined : CURRICULUM.find((entry) => entry.number === Number(itemId.slice(1, 3)));
  return { item, level: level ? { number: level.number, name: level.name } : null, materi: [] };
}
