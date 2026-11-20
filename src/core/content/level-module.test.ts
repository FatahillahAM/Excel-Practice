import { describe, expect, it } from "vitest";
import { itemFromId, kindFromItemId } from "./level-module";

describe("kindFromItemId / itemFromId", () => {
  it("derives the kind from the id alone", () => {
    expect(kindFromItemId("L01-T")).toBe("test");
    expect(kindFromItemId("L09-T")).toBe("test");
    expect(kindFromItemId("L01-P1")).toBe("practice");
    expect(kindFromItemId("L03-P5")).toBe("practice");
  });

  it("returns null for any other id", () => {
    for (const id of ["UA", "L01-P6", "L1-T", "l01-t", "L01-T ", "", "L01-P0"]) expect(kindFromItemId(id), id).toBeNull();
  });

  it("gives the Test number 6 and a practice its own number", () => {
    expect(itemFromId("L03-T")).toEqual({ kind: "test", number: 6 });
    expect(itemFromId("L02-P4")).toEqual({ kind: "practice", number: 4 });
  });
});
