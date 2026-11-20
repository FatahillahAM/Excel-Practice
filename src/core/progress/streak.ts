/**
 * Streak and freezes (CAP-10, AD-7, AD-8): derived per request, never stored.
 * A day is the local date (`YYYY-MM-DD`) of an instant in the user's
 * `profiles.time_zone`; a week is ISO Monday–Sunday in that zone; `now` is
 * the server's clock. A day counts when it has a graded attempt (any score,
 * Practice again included; the database's `streak_days`, the same definition
 * as its freeze fence) or a freeze. The database enforces the freeze
 * rules (migration 20261119000001); this is display only, on the same
 * definitions.
 */

/** Freezes per ISO week; unused ones do not carry over. */
export const FREEZES_PER_WEEK = 2;

/** One day of the Week Strip (Monday first). */
export type DayStatus = "done" | "frozen" | "missed" | "pending" | "future";

export interface DayState {
  /** `YYYY-MM-DD` in the user's zone. */
  date: string;
  status: DayStatus;
}

export interface Streak {
  /** Today (`YYYY-MM-DD`) in the user's zone: what Use freeze sends back as the expected day. */
  today: string;
  /** Consecutive covered days ending today (when covered) or yesterday. */
  count: number;
  /** Today has a graded attempt. */
  todaySafe: boolean;
  /** Today has a freeze. */
  frozenToday: boolean;
  /**
   * The streak ended yesterday: today and yesterday are not covered, the day
   * before yesterday is. Derived, nothing stored: true on the one day after a
   * reset, until today is covered ("Streak restarted", EXPERIENCE.md).
   */
  restarted: boolean;
  /** Milliseconds until 00:00 of the next local day. */
  msLeft: number;
  /** This ISO week, Monday → Sunday. */
  week: DayState[];
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(zone: string): Intl.DateTimeFormat {
  let f = formatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    formatters.set(zone, f);
  }
  return f;
}

/** The wall-clock fields of `instant` in `zone`. Throws a RangeError for an unknown zone. */
function wallClock(instant: Date, zone: string): { y: number; m: number; d: number; h: number; min: number; s: number } {
  const parts: Record<string, string> = {};
  for (const part of formatter(zone).formatToParts(instant)) parts[part.type] = part.value;
  return { y: +parts.year, m: +parts.month, d: +parts.day, h: +parts.hour, min: +parts.minute, s: +parts.second };
}

/** The local date (`YYYY-MM-DD`) of `instant` in `zone`. */
export function localDate(instant: Date | string, zone: string): string {
  const { y, m, d } = wallClock(new Date(instant), zone);
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** `date` (`YYYY-MM-DD`) moved by `days` calendar days. */
export function addDays(date: string, days: number): string {
  const t = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10) + days);
  return new Date(t).toISOString().slice(0, 10);
}

/** The Monday (`YYYY-MM-DD`) of `date`'s ISO week. */
export function isoWeekStart(date: string): string {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(date, -((weekday + 6) % 7));
}

/** The instant of 00:00 local on `date` in `zone` (the first instant of that day, DST included). */
function startOfLocalDay(date: string, zone: string): number {
  const target = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10));
  // The zone's offset at a guess, applied twice, settles across a DST change.
  let guess = target;
  for (let i = 0; i < 3; i++) {
    const w = wallClock(new Date(guess), zone);
    const offset = Date.UTC(w.y, w.m - 1, w.d, w.h, w.min, w.s) - guess;
    const next = target - offset;
    if (next === guess) break;
    guess = next;
  }
  // A zone whose midnight does not exist that day starts at the first instant on that date.
  while (localDate(new Date(guess), zone) < date) guess += 60_000;
  return guess;
}

/** Streak, today's state, time left today and the Week Strip. */
export function streak({
  gradedDays,
  freezes,
  now,
  zone,
}: {
  /** Local dates (`YYYY-MM-DD`) with a graded attempt. */
  gradedDays: readonly string[];
  /** Freeze local dates (`YYYY-MM-DD`). */
  freezes: readonly string[];
  now: Date;
  zone: string;
}): Streak {
  const graded = new Set(gradedDays);
  const frozen = new Set(freezes);
  const covered = (date: string) => graded.has(date) || frozen.has(date);

  const today = localDate(now, zone);
  const todaySafe = graded.has(today);
  const frozenToday = frozen.has(today);

  let count = 0;
  for (let day = covered(today) ? today : addDays(today, -1); covered(day); day = addDays(day, -1)) count++;

  const yesterday = addDays(today, -1);
  const restarted = !covered(today) && !covered(yesterday) && covered(addDays(today, -2));

  const msLeft = Math.max(0, startOfLocalDay(addDays(today, 1), zone) - now.getTime());

  const monday = isoWeekStart(today);
  const week: DayState[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    let status: DayStatus;
    if (graded.has(date)) status = "done";
    else if (frozen.has(date)) status = "frozen";
    else if (date > today) status = "future";
    else if (date === today) status = "pending";
    else status = "missed";
    return { date, status };
  });

  return { today, count, todaySafe, frozenToday, restarted, msLeft, week };
}

/** Freezes left this ISO week (in `zone`, at `now`). */
export function freezesLeft({ freezes, now, zone }: { freezes: readonly string[]; now: Date; zone: string }): number {
  const monday = isoWeekStart(localDate(now, zone));
  const sunday = addDays(monday, 6);
  const used = freezes.filter((date) => date >= monday && date <= sunday).length;
  return Math.max(0, FREEZES_PER_WEEK - used);
}
