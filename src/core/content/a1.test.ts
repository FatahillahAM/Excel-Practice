import { describe, expect, it } from "vitest";
import { cellRef, columnLetters, columnNumber, expandRange, parseCell } from "./a1";

describe("A1 helpers", () => {
  it("converts column letters and numbers both ways", () => {
    for (const [letters, n] of [["A", 1], ["Z", 26], ["AA", 27], ["AZ", 52], ["XFD", 16384]] as const) {
      expect(columnNumber(letters)).toBe(n);
      expect(columnLetters(n)).toBe(letters);
    }
    expect(cellRef(15, 2)).toBe("O2");
  });

  it.each(["", "a", "A1", "ABCD", "$A", " A", "Ä"])("columnNumber refuses %j", (input) => {
    expect(() => columnNumber(input)).toThrow(/Not a column/);
  });

  it("refuses columns outside the grid", () => {
    expect(() => columnLetters(0)).toThrow();
    expect(() => columnLetters(16385)).toThrow();
    expect(parseCell("XFE1")).toBeNull();
    expect(parseCell("A1048577")).toBeNull();
  });

  it("expands ranges row by row and refuses malformed or reversed ones", () => {
    expect(expandRange("I2")).toEqual(["I2"]);
    expect(expandRange("O2:P3")).toEqual(["O2", "P2", "O3", "P3"]);
    for (const range of ["H3:H2", "B1:A1", "$H$2:H3", "H2:", "h2"]) expect(expandRange(range)).toBeNull();
    expect(expandRange("A1:Z100", 100)).toBeNull();
  });
});
