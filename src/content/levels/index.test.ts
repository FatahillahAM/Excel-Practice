import { describe, expect, it } from "vitest";
import { examCellsSchema, ITEM_ID_RE, itemLabel, levelModuleSchema, defineLevelModule } from "../../core/content/level-module";
import { findItem, levels } from "./index";
import { ANSWER_REF, ANSWER_SHEET } from "./01-fondasi/practice-1";

describe("level registry", () => {
  it("lists Level 1 Fondasi (V1, 3 hints) with Practice 1", () => {
    expect(levels.map((level) => level.id)).toEqual(["01-fondasi"]);
    const [fondasi] = levels;
    expect(fondasi).toMatchObject({ number: 1, name: "Fondasi", phase: "v1", hintQuota: 3 });
    expect(fondasi.items.map((item) => item.id)).toEqual(["L01-P1"]);
    for (const level of levels) expect(levelModuleSchema.safeParse(level).success).toBe(true);
  });

  it("finds L01-P1 and nothing else", () => {
    const found = findItem("L01-P1");
    expect(found?.level.id).toBe("01-fondasi");
    expect(found?.item).toMatchObject({ id: "L01-P1", kind: "practice", number: 1 });
    expect(itemLabel(found!.item)).toBe("Practice 1");
    expect(findItem("L01-P2")).toBeNull();
    expect(findItem("")).toBeNull();
  });

  it("gives L01-P1 an Instructions sheet and the fixed Data table, with the answer cell left empty", () => {
    const cells = findItem("L01-P1")!.item.examCells();
    expect(examCellsSchema.safeParse(cells).success).toBe(true);
    expect(cells.Instructions.B2).toMatch(/^Level 1 · Practice 1/);
    expect(cells.Instructions.B6).toContain(`${ANSWER_SHEET}!${ANSWER_REF}`);
    expect(cells.Data.A1).toBe("Kode Batch");
    expect(cells.Data.E2).toBe(1200);
    expect(cells.Data.A11).toBe("B-2610-10");
    expect(cells[ANSWER_SHEET][ANSWER_REF]).toBeUndefined();
  });
});

describe("LevelModule schema", () => {
  const item = { id: "L01-P1", kind: "practice" as const, number: 1, examCells: () => ({ Data: { A1: "x" } }) };
  const level = { id: "01-fondasi", number: 1, name: "Fondasi", phase: "v1" as const, hintQuota: 3, items: [item] };

  it("accepts the item ids of the attempts table", () => {
    for (const id of ["L01-P1", "L09-P5", "L03-T", "UA"]) expect(id).toMatch(ITEM_ID_RE);
    for (const id of ["L1-P1", "L01-P6", "L01-T1", "UA1", "l01-p1"]) expect(id).not.toMatch(ITEM_ID_RE);
  });

  it.each([
    ["an item id of another level", { items: [{ ...item, id: "L02-P1" }] }],
    ["an item id that does not match its number", { items: [{ ...item, number: 2 }] }],
    ["a duplicate item", { items: [item, item] }],
    ["a folder that does not start with the level number", { id: "02-fondasi" }],
    ["a negative hint quota", { hintQuota: -1 }],
    ["an unknown phase", { phase: "later" }],
    ["an item without examCells", { items: [{ id: "L01-P1", kind: "practice", number: 1 }] }],
  ])("rejects %s", (_, change) => {
    const candidate = { ...level, ...change } as unknown as Parameters<typeof defineLevelModule>[0];
    expect(() => defineLevelModule(candidate)).toThrow();
  });

  it.each([
    ["no sheet", {}],
    ["a sheet without cells", { Data: {} }],
    ["a reference that is not A1", { Data: { a1: "x" } }],
  ])("rejects exam cells with %s", (_, cells) => {
    expect(examCellsSchema.safeParse(cells).success).toBe(false);
  });

  it("accepts the Test as item 6", () => {
    expect(() => defineLevelModule({ ...level, items: [item, { ...item, id: "L01-T", kind: "test", number: 6 }] })).not.toThrow();
    expect(itemLabel({ kind: "test", number: 6 })).toBe("Test");
  });
});
