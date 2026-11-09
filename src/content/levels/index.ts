import type { LevelItem, LevelModule } from "@/core/content/level-module";
import { fondasi } from "./01-fondasi";

/**
 * The level registry (AD-2): the only list of levels. The Level Map, gates
 * and Start read it; engine code never branches on a level id.
 */
export const levels: readonly LevelModule[] = [fondasi];

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
