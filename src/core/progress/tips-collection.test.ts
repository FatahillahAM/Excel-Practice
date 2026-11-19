import { describe, expect, it } from "vitest";
import { buildResult, PRACTICE_85, RESULT_TIPS, V1_NO_TIPS } from "@/core/grading/__fixtures__/results";
import type { Result, Tip } from "@/core/grading/result";
import { filterTips, tipLevels, tipsCollection, type CollectedTip, type TipSourceRow } from "./tips-collection";

const tip = (id: string, title = `Judul ${id}`, extra: Partial<Tip> = {}): Tip => ({ id, title, body: `Isi ${id}.`, shortcuts: [], ...extra });

function withTips(tips: (Tip | null)[]): Result {
  const base = buildResult();
  return { ...base, questions: base.questions.map((q, i) => ({ ...q, tip: tips[i] ?? null })) };
}

const row = (attemptId: string, startedAt: string, result: Result, itemId = "L01-P1"): TipSourceRow => ({ attemptId, itemId, startedAt, result });
const level1 = (itemId: string) => (itemId.startsWith("L01") ? 1 : itemId.startsWith("L02") ? 2 : null);
const ids = (tips: CollectedTip[]) => tips.map((t) => t.tip.id);

describe("tipsCollection", () => {
  it("keeps one card per Tip id across overlapping attempts (4 + 4, 2 shared → 6)", () => {
    const older = withTips([tip("a"), tip("b"), tip("c"), tip("d")]);
    const newer = withTips([tip("c"), tip("d"), tip("e"), tip("f")]);
    const out = tipsCollection([row("2", "2026-11-02T00:00:00Z", newer), row("1", "2026-11-01T00:00:00Z", older)], level1);
    expect(ids(out)).toEqual(["c", "d", "e", "f", "a", "b"]);
    expect(out.every((t) => t.levelNumber === 1)).toBe(true);
  });

  it("trusts the given (database) order: the first row's content wins", () => {
    const neu = row("2", "2026-11-02T00:00:00.000002Z", withTips([tip("kunci-sel", "B")]));
    const old = row("1", "2026-11-02T00:00:00.000001Z", withTips([tip("kunci-sel", "A")]));
    expect(tipsCollection([neu, old], level1)[0].tip.title).toBe("B");
  });

  it("takes the level of the first (newest) row's item", () => {
    const neu = row("2", "2026-11-02T00:00:00Z", withTips([tip("x")]), "L02-P1");
    const old = row("1", "2026-11-01T00:00:00Z", withTips([tip("x")]), "L01-P1");
    expect(tipsCollection([neu, old], level1)[0].levelNumber).toBe(2);
  });

  it("is not thrown off by an invalid started_at", () => {
    const out = tipsCollection([row("2", "not a date", withTips([tip("x", "B")])), row("1", "", withTips([tip("x", "A"), tip("y")]))], level1);
    expect(out.map((t) => t.tip.title)).toEqual(["B", "Judul y"]);
  });

  it("skips questions without a Tip (Result v1) and keeps the others", () => {
    expect(tipsCollection([row("1", "2026-11-01T00:00:00Z", V1_NO_TIPS)], level1)).toEqual([]);
    expect(ids(tipsCollection([row("1", "2026-11-01T00:00:00Z", withTips([null, tip("b"), null, tip("d")]))], level1))).toEqual(["b", "d"]);
  });

  it("gives an unknown item no level", () => {
    expect(tipsCollection([row("1", "2026-11-01T00:00:00Z", PRACTICE_85, "L77-P1")], level1)[0].levelNumber).toBeNull();
  });

  it("keeps Tips from beyond the 50 newest attempts", () => {
    const rows = Array.from({ length: 120 }, (_, i) =>
      row(String(i).padStart(3, "0"), new Date(Date.UTC(2026, 0, 1) - i * 60_000).toISOString(), withTips([tip(i === 119 ? "oldest" : "common")])),
    );
    expect(ids(tipsCollection(rows, level1))).toEqual(["common", "oldest"]);
  });

  it("is empty without rows", () => {
    expect(tipsCollection([], level1)).toEqual([]);
  });
});

describe("filterTips / tipLevels", () => {
  const tips: CollectedTip[] = [
    { tip: RESULT_TIPS[0], levelNumber: 1 },
    { tip: tip("sum", "Jumlahkan dengan SUM"), levelNumber: 2 },
    { tip: RESULT_TIPS[1], levelNumber: 1 },
    { tip: tip("lain", "Lain"), levelNumber: null },
  ];

  it("filters by level; 'all' keeps every card", () => {
    expect(ids(filterTips(tips, { level: 1, query: "" }))).toEqual(["l01-isi-rumus-sekaligus", "l01-kunci-sel-f4"]);
    expect(filterTips(tips, { level: "all", query: "" })).toHaveLength(4);
  });

  it("searches shortcut, title and body, case-insensitive and trimmed", () => {
    expect(ids(filterTips(tips, { level: "all", query: "ctrl+d" }))).toEqual(["l01-isi-rumus-sekaligus"]);
    expect(ids(filterTips(tips, { level: "all", query: "sum" }))).toEqual(["sum"]);
    expect(ids(filterTips(tips, { level: "all", query: "  KUNCI " }))).toEqual(["l01-kunci-sel-f4"]);
    expect(ids(filterTips(tips, { level: "all", query: "$a$1" }))).toEqual(["l01-kunci-sel-f4"]);
  });

  it("collapses inner whitespace and ignores diacritics", () => {
    const more: CollectedTip[] = [
      { tip: tip("salin", "Salin cepat", { body: "Tekan Ctrl C lalu Ctrl V." }), levelNumber: 1 },
      { tip: tip("kafe", "Daftar café"), levelNumber: 1 },
    ];
    expect(ids(filterTips(more, { level: "all", query: "ctrl  c" }))).toEqual(["salin"]);
    expect(ids(filterTips(more, { level: "all", query: "CAFE" }))).toEqual(["kafe"]);
    expect(ids(filterTips(more, { level: "all", query: "café" }))).toEqual(["kafe"]);
  });

  it("combines level and search (AND)", () => {
    expect(filterTips(tips, { level: 1, query: "sum" })).toEqual([]);
    expect(filterTips(tips, { level: 1, query: "xyz" })).toEqual([]);
    expect(ids(filterTips(tips, { level: 2, query: "SUM" }))).toEqual(["sum"]);
  });

  it("lists the levels that have cards, ascending", () => {
    expect(tipLevels(tips)).toEqual([1, 2]);
    expect(tipLevels([])).toEqual([]);
  });
});
