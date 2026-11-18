import { HISTORY_LIMIT, type StoredHistoryRow } from "@/adapters/supabase/attempts";
import { itemLabel } from "@/core/content/level-module";
import { resultSchema } from "@/core/grading";
import { attemptDurationSeconds, type AttemptStatus } from "@/core/services/attempts";
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
  /** The row link's accessible name: "Level 1 · Practice 1, 2 Nov 2026 08.00, score 85/100, time 06:48". */
  accessibleName: string;
}

/** The statuses whose Result History lists and opens (U6: `graded` or `closed`). */
export const LISTABLE_STATUSES: readonly AttemptStatus[] = ["graded", "closed"];
export function isListable(status: AttemptStatus | undefined): boolean {
  return status !== undefined && LISTABLE_STATUSES.includes(status);
}

const DATE = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" });

/**
 * Stored rows → History rows. A Result that fails `resultSchema` is dropped
 * and logged (`history.result_invalid`, without its content); the rest stay,
 * capped at `HISTORY_LIMIT` after filtering (the adapter reads a little more).
 */
export function toHistoryRows(rows: readonly StoredHistoryRow[]): HistoryRow[] {
  const out: HistoryRow[] = [];
  for (const row of rows) {
    if (out.length >= HISTORY_LIMIT) break;
    if (!isListable(row.status)) continue;
    const parsed = resultSchema.safeParse(row.result);
    if (!parsed.success) {
      console.error(JSON.stringify({ event: "history.result_invalid", attemptId: row.id }));
      continue;
    }
    const found = findItem(row.itemId);
    const started = new Date(row.startedAt);
    const seconds = attemptDurationSeconds(row.startedAt, row.receivedAt);
    const label = found ? `Level ${found.level.number} · ${itemLabel(found.item)}` : row.itemId;
    const date = Number.isNaN(started.getTime()) ? "—" : DATE.format(started);
    const score = `${parsed.data.score}/100`;
    const time = seconds === null ? "—" : formatElapsed(seconds);
    out.push({
      id: row.id,
      href: `/history/${encodeURIComponent(row.id)}`,
      label,
      date,
      score,
      time,
      accessibleName: `${label}, ${date}, score ${score}, time ${time}`,
    });
  }
  return out;
}
