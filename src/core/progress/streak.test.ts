import { describe, expect, it } from "vitest";
import type { GradedAttempt } from "./level-progress";
import { addDays, freezesLeft, isoWeekStart, localDate, streak } from "./streak";

const JAKARTA = "Asia/Jakarta"; // UTC+7, no DST
const NEW_YORK = "America/New_York"; // DST

const at = (receivedAt: string | null, score = 50): GradedAttempt => ({ itemId: "L01-P1", score, startedAt: "2026-11-01T00:00:00Z", receivedAt });
/** What `streak_days` returns: the distinct local dates of graded attempts with a `received_at`. */
const days = (attempts: GradedAttempt[], zone: string) => [
  ...new Set(attempts.flatMap((a) => (a.receivedAt ? [localDate(a.receivedAt, zone)] : []))),
];
/** An instant at local `time` on `date` in Jakarta. */
const jkt = (date: string, time = "12:00:00") => `${date}T${time}+07:00`;

describe("localDate", () => {
  it("is the date in the zone, not UTC", () => {
    expect(localDate("2026-11-18T18:00:00Z", JAKARTA)).toBe("2026-11-19");
    expect(localDate("2026-11-18T18:00:00Z", "UTC")).toBe("2026-11-18");
  });

  it("splits days at local midnight", () => {
    expect(localDate(jkt("2026-11-18", "23:59:59"), JAKARTA)).toBe("2026-11-18");
    expect(localDate(jkt("2026-11-19", "00:00:00"), JAKARTA)).toBe("2026-11-19");
  });

  it("helpers: addDays across months, ISO Monday", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(isoWeekStart("2026-11-19")).toBe("2026-11-16"); // Thursday → Monday
    expect(isoWeekStart("2026-11-22")).toBe("2026-11-16"); // Sunday → same week's Monday
    expect(isoWeekStart("2026-11-16")).toBe("2026-11-16");
  });
});

describe("streak", () => {
  const now = new Date(jkt("2026-11-19", "20:00:00"));
  const run = (attempts: GradedAttempt[], freezes: string[] = [], when = now, zone = JAKARTA) =>
    streak({ gradedDays: days(attempts, zone), freezes, now: when, zone });

  it("safe today: today and the two days before count 3", () => {
    const s = run([at(jkt("2026-11-19")), at(jkt("2026-11-18")), at(jkt("2026-11-17"))]);
    expect(s).toMatchObject({ today: "2026-11-19", count: 3, todaySafe: true, frozenToday: false });
  });

  it("at risk: yesterday and the day before count 2, with time left until local midnight", () => {
    const s = run([at(jkt("2026-11-18")), at(jkt("2026-11-17"))]);
    expect(s).toMatchObject({ count: 2, todaySafe: false, frozenToday: false, msLeft: 4 * 3_600_000 });
  });

  it("missed: only three days ago is 0", () => {
    expect(run([at(jkt("2026-11-16"))]).count).toBe(0);
  });

  it("counts any score (Practice again included) and ignores attempts without received_at", () => {
    expect(run([at(jkt("2026-11-19"), 0), at(null)]).count).toBe(1);
  });

  it("a freeze bridges a day: Monday graded, Tuesday frozen, Wednesday graded is 3", () => {
    const s = run([at(jkt("2026-11-16")), at(jkt("2026-11-18"))], ["2026-11-17"], new Date(jkt("2026-11-18", "21:00:00")));
    expect(s.count).toBe(3);
  });

  it("frozen today: today counts, not safe", () => {
    const s = run([at(jkt("2026-11-18"))], ["2026-11-19"]);
    expect(s).toMatchObject({ count: 2, todaySafe: false, frozenToday: true });
  });

  it("midnight: 23:59:59 and 00:00:00 local are different days", () => {
    const before = run([at(jkt("2026-11-18", "23:59:59"))], [], new Date(jkt("2026-11-19", "00:00:00")));
    expect(before).toMatchObject({ count: 1, todaySafe: false, msLeft: 24 * 3_600_000 });
    const after = run([at(jkt("2026-11-19", "00:00:00"))], [], new Date(jkt("2026-11-19", "00:00:01")));
    expect(after).toMatchObject({ count: 1, todaySafe: true });
  });

  it("UTC vs local: 18:00Z on the 18th is the 19th in Jakarta", () => {
    expect(run([at("2026-11-18T18:00:00Z")]).todaySafe).toBe(true);
  });

  it("DST: a 25-hour day (New York, 1 Nov 2026) stays one day; time left is to the real midnight", () => {
    // 1 Nov 2026 00:00 EDT (-4) to 2 Nov 00:00 EST (-5) is 25 h.
    const noon = new Date("2026-11-01T12:00:00-05:00");
    const s = run([at("2026-10-31T23:30:00-04:00"), at("2026-11-01T00:30:00-04:00"), at("2026-11-01T23:30:00-05:00")], [], noon, NEW_YORK);
    expect(s).toMatchObject({ count: 2, todaySafe: true, msLeft: 12 * 3_600_000 });
    const early = new Date("2026-11-01T00:30:00-04:00");
    expect(run([], [], early, NEW_YORK).msLeft).toBe(24.5 * 3_600_000);
  });

  it("DST: a 23-hour day (New York, 8 Mar 2026)", () => {
    const early = new Date("2026-03-08T00:30:00-05:00");
    expect(run([], [], early, NEW_YORK).msLeft).toBe(22.5 * 3_600_000);
    expect(localDate("2026-03-08T03:00:00-04:00", NEW_YORK)).toBe("2026-03-08");
  });

  it("Week Strip: Monday → Sunday with done / frozen / missed / pending / future", () => {
    const s = run([at(jkt("2026-11-16")), at(jkt("2026-11-18"))], ["2026-11-17"]);
    expect(s.week).toEqual([
      { date: "2026-11-16", status: "done" },
      { date: "2026-11-17", status: "frozen" },
      { date: "2026-11-18", status: "done" },
      { date: "2026-11-19", status: "pending" },
      { date: "2026-11-20", status: "future" },
      { date: "2026-11-21", status: "future" },
      { date: "2026-11-22", status: "future" },
    ]);
  });

  it("spans all history across weeks", () => {
    const days = Array.from({ length: 20 }, (_, i) => at(jkt(addDays("2026-11-19", -i))));
    expect(run(days).count).toBe(20);
  });
});

it("an unknown zone throws (loadStreak turns it into the first-load message)", () => {
  expect(() => streak({ gradedDays: [], freezes: [], now: new Date(), zone: "Mars/Olympus" })).toThrow(RangeError);
});

describe("freezesLeft", () => {
  const now = new Date(jkt("2026-11-19")); // Thursday; week 16–22 Nov
  it("counts this ISO week only (Monday reset)", () => {
    expect(freezesLeft({ freezes: [], now, zone: JAKARTA })).toBe(2);
    expect(freezesLeft({ freezes: ["2026-11-14", "2026-11-15"], now, zone: JAKARTA })).toBe(2);
    expect(freezesLeft({ freezes: ["2026-11-15", "2026-11-16"], now, zone: JAKARTA })).toBe(1);
    expect(freezesLeft({ freezes: ["2026-11-16", "2026-11-19"], now, zone: JAKARTA })).toBe(0);
  });

  it("the week is the zone's: Sunday 23:30 local is still last week", () => {
    const sundayNight = new Date(jkt("2026-11-22", "23:30:00"));
    expect(freezesLeft({ freezes: ["2026-11-16", "2026-11-17"], now: sundayNight, zone: JAKARTA })).toBe(0);
    const monday = new Date(jkt("2026-11-23", "00:00:00"));
    expect(freezesLeft({ freezes: ["2026-11-16", "2026-11-17"], now: monday, zone: JAKARTA })).toBe(2);
  });
});
