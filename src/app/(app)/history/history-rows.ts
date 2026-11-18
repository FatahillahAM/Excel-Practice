import type { StoredHistoryRow } from "@/adapters/supabase/attempts";
import { itemLabel } from "@/core/content/level-module";
import { resultSchema } from "@/core/grading";
import { attemptDurationSeconds } from "@/core/services/attempts";
import { formatElapsed } from "@/core/services/attempts/elapsed";
import { findItem } from "@/content/levels";

/** One History row as shown: every field already formatted. */
export interface HistoryRow {
  id: string;
  href: string;
  /** "Level 1 · Practice 1"; the item id when the item is no longer in the registry. */
  label: string;
  /** `started_at` in `id-ID`, Asia/Jakarta. */
  date: string;
  /** "85/100". */
  score: string;
  /** `formatElapsed(received_at − started_at)`; "—" without a duration. */
  time: string;
}

const DATE = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" });

/**
 * Stored rows → History rows. A Result that fails `resultSchema` is dropped
 * and logged (`history.result_invalid`, without its content); the rest stay.
 */
export function toHistoryRows(rows: readonly StoredHistoryRow[]): HistoryRow[] {
  const out: HistoryRow[] = [];
  for (const row of rows) {
    const parsed = resultSchema.safeParse(row.result);
    if (!parsed.success) {
      console.error(JSON.stringify({ event: "history.result_invalid", attemptId: row.id }));
      continue;
    }
    const found = findItem(row.itemId);
    const started = new Date(row.startedAt);
    const seconds = attemptDurationSeconds(row.startedAt, row.receivedAt);
    out.push({
      id: row.id,
      href: `/history/${encodeURIComponent(row.id)}`,
      label: found ? `Level ${found.level.number} · ${itemLabel(found.item)}` : row.itemId,
      date: Number.isNaN(started.getTime()) ? "—" : DATE.format(started),
      score: `${parsed.data.score}/100`,
      time: seconds === null ? "—" : formatElapsed(seconds),
    });
  }
  return out;
}
