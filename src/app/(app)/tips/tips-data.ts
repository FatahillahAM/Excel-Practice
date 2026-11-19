import type { StoredTipRow } from "@/adapters/supabase/attempts";
import { resultSchema } from "@/core/grading";
import { tipsCollection, type CollectedTip, type TipSourceRow } from "@/core/progress";
import { findItem } from "@/content/levels";

/**
 * Stored rows → the Tips collection. A Result that fails `resultSchema` is
 * dropped and logged (`tips.result_invalid`, without its content); the level
 * of each card comes from the registry (`null` for an unknown item).
 */
export function toCollectedTips(rows: readonly StoredTipRow[]): CollectedTip[] {
  const valid: TipSourceRow[] = [];
  for (const row of rows) {
    const parsed = resultSchema.safeParse(row.result);
    if (!parsed.success) {
      console.error(JSON.stringify({ event: "tips.result_invalid", attemptId: row.id }));
      continue;
    }
    valid.push({ attemptId: row.id, itemId: row.itemId, startedAt: row.startedAt, result: parsed.data });
  }
  return tipsCollection(valid, (itemId) => findItem(itemId)?.level.number ?? null);
}
