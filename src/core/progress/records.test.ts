import { describe, expect, it } from "vitest";
import type { GradedAttempt } from "./level-progress";
import { isNewRecord, records } from "./records";

const START = Date.parse("2026-11-02T01:00:00Z");
let seq = 0;
/** An attempt of `seconds`, received `day` days after 2 Nov. */
function at(itemId: string, seconds: number | null, day: number, score = 85, id = `a${++seq}`): GradedAttempt {
  const started = START + day * 86_400_000;
  return {
    id,
    itemId,
    score,
    startedAt: new Date(started).toISOString(),
    receivedAt: seconds === null ? null : new Date(started + seconds * 1000).toISOString(),
  };
}

describe("records", () => {
  it("first attempt: the record, no badge", () => {
    const first = at("L01-P1", 300, 0);
    expect(records([first]).get("L01-P1")).toMatchObject({ attemptId: first.id, seconds: 300, score: 85, receivedAt: first.receivedAt });
    expect(isNewRecord([first], first.id)).toBe(false);
  });

  it("faster: new record with the badge; Practice again counts", () => {
    const a = at("L01-P1", 300, 0);
    const b = at("L01-P1", 250, 1, 70);
    const c = at("L01-P1", 200, 2, 90);
    expect(records([a, b]).get("L01-P1")).toMatchObject({ attemptId: b.id, seconds: 250, score: 70 });
    expect(isNewRecord([a, b], b.id)).toBe(true);
    expect(records([a, b, c]).get("L01-P1")?.seconds).toBe(200);
    expect(isNewRecord([a, b, c], c.id)).toBe(true);
  });

  it.each([
    ["tie", 250],
    ["slower", 280],
  ])("%s: record stays, no badge", (_name, seconds) => {
    const a = at("L01-P1", 300, 0);
    const b = at("L01-P1", 250, 1);
    const c = at("L01-P1", seconds, 2);
    expect(records([a, b, c]).get("L01-P1")?.attemptId).toBe(b.id);
    expect(isNewRecord([a, b, c], c.id)).toBe(false);
  });

  it("must beat every earlier attempt, not only the previous one", () => {
    const a = at("L01-P1", 200, 0);
    const b = at("L01-P1", 300, 1);
    const c = at("L01-P1", 250, 2);
    expect(isNewRecord([a, b, c], c.id)).toBe(false);
  });

  it("practice and Test are separate; a failed Test counts", () => {
    const p = at("L01-P1", 300, 0);
    const t = at("L01-T", 180, 1, 60);
    const map = records([p, t]);
    expect(map.size).toBe(2);
    expect(map.get("L01-T")).toMatchObject({ seconds: 180, score: 60 });
    expect(isNewRecord([p, t], t.id)).toBe(false);
  });

  it("an old Results shows the badge as it was then (input order does not matter)", () => {
    const a = at("L01-P1", 300, 0);
    const b = at("L01-P1", 250, 1);
    expect(isNewRecord([b, a], a.id)).toBe(false);
    expect(isNewRecord([b, a], b.id)).toBe(true);
  });

  it("same received_at: id breaks the tie", () => {
    const a = at("L01-P1", 300, 0, 85, "x1");
    const b = { ...at("L01-P1", 250, 0, 85, "x2"), receivedAt: a.receivedAt, startedAt: new Date(Date.parse(a.receivedAt!) - 250_000).toISOString() };
    expect(isNewRecord([b, a], "x2")).toBe(true);
    expect(isNewRecord([b, a], "x1")).toBe(false);
  });

  it("ignores attempts without a time; unknown ids are no record", () => {
    const open = at("L01-P1", null, 0);
    const bad = { ...at("L01-P2", 100, 0), startedAt: "nope" };
    expect(records([open, bad]).size).toBe(0);
    expect(isNewRecord([open], open.id)).toBe(false);
    expect(isNewRecord([], "missing")).toBe(false);
  });

  it("empty: no records", () => {
    expect(records([]).size).toBe(0);
  });
});
