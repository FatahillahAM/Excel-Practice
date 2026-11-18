import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredHistoryRow } from "@/adapters/supabase/attempts";
import { PRACTICE_64, PRACTICE_85 } from "@/core/grading/__fixtures__/results";
import { toHistoryRows } from "./history-rows";

const row = (id: string, result: unknown, extra: Partial<StoredHistoryRow> = {}): StoredHistoryRow => ({
  id,
  itemId: "L01-P1",
  status: "graded",
  result,
  startedAt: "2026-11-02T01:00:00+00:00",
  receivedAt: "2026-11-02T01:06:48+00:00",
  ...extra,
});

let errors: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  errors = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("toHistoryRows", () => {
  it("maps label, Jakarta date, score, time and href, keeping order", () => {
    const rows = toHistoryRows([row("a", PRACTICE_85), row("b", PRACTICE_64, { status: "closed" })]);
    expect(rows.map((r) => r.id)).toEqual(["a", "b"]);
    expect(rows[0]).toMatchObject({ href: "/history/a", label: "Level 1 · Practice 1", score: "85/100", time: "06:48" });
    expect(rows[0].accessibleName).toBe(`Level 1 · Practice 1, ${rows[0].date}, score 85/100, time 06:48`);
    expect(rows[1].score).toBe("64/100");
    // 01:00 UTC is 08:00 in Jakarta.
    expect(rows[0].date).toMatch(/2 Nov 2026/);
    expect(rows[0].date).toMatch(/08[.:]00/);
  });

  it("shows — without received_at and the item id for an unknown item", () => {
    const [r] = toHistoryRows([row("a", PRACTICE_85, { receivedAt: null, itemId: "L99-P1" })]);
    expect(r.time).toBe("—");
    expect(r.label).toBe("L99-P1");
    expect(r.href).toBe("/history/a");
  });

  it("caps at 50 after dropping invalid rows: 5 invalid newest still leave 50 valid", () => {
    const stored = [
      ...Array.from({ length: 5 }, (_, i) => row(`bad${i}`, { version: 1 })),
      ...Array.from({ length: 65 }, (_, i) => row(`ok${i}`, PRACTICE_85)),
    ];
    const rows = toHistoryRows(stored);
    expect(rows).toHaveLength(50);
    expect(rows[0].id).toBe("ok0");
    expect(rows[49].id).toBe("ok49");
  });

  it("all-invalid newest rows do not hide older valid ones within the window", () => {
    const stored = [...Array.from({ length: 20 }, (_, i) => row(`bad${i}`, { version: 1 })), row("old", PRACTICE_64)];
    expect(toHistoryRows(stored).map((r) => r.id)).toEqual(["old"]);
  });

  it("drops rows whose status is not graded/closed", () => {
    expect(toHistoryRows([row("r", PRACTICE_85, { status: "received" }), row("c", PRACTICE_85, { status: "closed" })]).map((r) => r.id)).toEqual(["c"]);
  });

  it("drops and logs a Result that fails the schema, without its content", () => {
    const rows = toHistoryRows([row("bad", { version: 1, secret: "x" }), row("ok", PRACTICE_85)]);
    expect(rows.map((r) => r.id)).toEqual(["ok"]);
    expect(errors).toHaveBeenCalledTimes(1);
    const line = String(errors.mock.calls[0][0]);
    expect(JSON.parse(line)).toEqual({ event: "history.result_invalid", attemptId: "bad" });
  });
});
