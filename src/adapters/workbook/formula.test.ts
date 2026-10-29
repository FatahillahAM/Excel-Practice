import { describe, expect, it } from "vitest";
import { columnIndex, columnLetters, normalizeFormula, shiftFormula } from "./formula";

describe("normalizeFormula", () => {
  it("drops the leading =, upper-cases and removes whitespace outside strings", () => {
    expect(normalizeFormula('=sumifs( Data!e2:e11 , Data!b2:b11, "Lini A" )')).toBe(
      'SUMIFS(DATA!E2:E11,DATA!B2:B11,"Lini A")',
    );
    expect(normalizeFormula("=if(h2>3%,\r\n  true,\tfalse)")).toBe("IF(H2>3%,TRUE,FALSE)");
  });

  it("drops _xlfn., _xlws. and _xlpm. prefixes, also chained and in any case", () => {
    expect(normalizeFormula('_xlfn.XLOOKUP("B-2610-05",A2:A11,F2:F11)')).toBe('XLOOKUP("B-2610-05",A2:A11,F2:F11)');
    expect(normalizeFormula('_xlfn.IFS(L2>30,"besar",TRUE,"kecil")')).toBe('IFS(L2>30,"besar",TRUE,"kecil")');
    expect(normalizeFormula("_xlfn._xlws.SORT(_xlfn.UNIQUE(B2:B11))")).toBe("SORT(UNIQUE(B2:B11))");
    expect(normalizeFormula("_XLFN.LAMBDA(_xlpm.x,_xlpm.x+1)(2)")).toBe("LAMBDA(X,X+1)(2)");
  });

  it("keeps string literals byte for byte, including escaped quotes and prefixes", () => {
    expect(normalizeFormula('="a  b"&"_xlfn.x ""Q"" "&c1')).toBe('"a  b"&"_xlfn.x ""Q"" "&C1');
  });

  it("keeps spaces inside quoted sheet names and brackets, upper-casing them", () => {
    expect(normalizeFormula("='Data Produksi'!a1 + Tabel1[[#This Row],[Unit Cacat]]")).toBe(
      "'DATA PRODUKSI'!A1+TABEL1[[#THIS ROW],[UNIT CACAT]]",
    );
  });

  it("is unchanged by a second pass", () => {
    const once = normalizeFormula('=_xlfn.IFS( l2>30, "besar", TRUE, "kecil")');
    expect(normalizeFormula(once)).toBe(once);
  });
});

describe("shiftFormula", () => {
  it("moves relative cell references", () => {
    expect(shiftFormula("F2/E2", 1, 0)).toBe("F3/E3");
    expect(shiftFormula("F2/E2", 9, 2)).toBe("H11/G11");
    expect(shiftFormula("Z1+AA1", 0, 1)).toBe("AA1+AB1");
  });

  it("keeps $ parts in place", () => {
    expect(shiftFormula("E2/SUM($E$2:$E$11)", 1, 0)).toBe("E3/SUM($E$2:$E$11)");
    expect(shiftFormula("$A1+A$1+$A$1", 2, 3)).toBe("$A3+D$1+$A$1");
  });

  it("moves both ends of a range", () => {
    expect(shiftFormula("SUM(A2:B3)", 1, 1)).toBe("SUM(B3:C4)");
    expect(shiftFormula("SUM($A2:B$3)", 1, 1)).toBe("SUM($A3:C$3)");
  });

  it("moves whole-column and whole-row references only along their axis", () => {
    expect(shiftFormula("SUM(A:A)+SUM($B:C)", 5, 1)).toBe("SUM(B:B)+SUM($B:D)");
    expect(shiftFormula("SUM(1:1)+SUM(2:$4)", 2, 5)).toBe("SUM(3:3)+SUM(4:$4)");
  });

  it("moves references on other sheets, leaving the sheet name alone", () => {
    expect(shiftFormula("SUMIFS(Data!E2:E11,Data!B2:B11,B6)", 1, 0)).toBe("SUMIFS(Data!E3:E12,Data!B3:B12,B7)");
    expect(shiftFormula("'A1 Data'!A1+'It''s B2'!$B2", 1, 1)).toBe("'A1 Data'!B2+'It''s B2'!$B3");
    expect(shiftFormula("Jan:Mar!A1", 1, 0)).toBe("Jan:Mar!A2");
    expect(shiftFormula("Data!A:A", 0, 2)).toBe("Data!C:C");
  });

  it("does not touch strings", () => {
    expect(shiftFormula('IF(H2>3%,"Periksa A1","OK")&"B2:C3"', 1, 0)).toBe('IF(H3>3%,"Periksa A1","OK")&"B2:C3"');
  });

  it("does not treat function or defined names as references", () => {
    expect(shiftFormula("LOG10(A1)+ATAN2(B1,C1)+DAYS360(D1,E1)", 1, 0)).toBe("LOG10(A2)+ATAN2(B2,C2)+DAYS360(D2,E2)");
    expect(shiftFormula("_xlfn.XLOOKUP(A1,Pajak2023,R1C1,TRUE)", 1, 0)).toBe("_xlfn.XLOOKUP(A2,Pajak2023,R1C1,TRUE)");
    expect(shiftFormula("XFE1+A1", 1, 0)).toBe("XFE1+A2");
  });

  it("does not touch brackets, error literals or numbers", () => {
    expect(shiftFormula("Tabel1[[#This Row],[A1]]+[1]Data!A1", 1, 0)).toBe("Tabel1[[#This Row],[A1]]+[1]Data!A2");
    expect(shiftFormula("IFERROR(A1,#N/A)+#REF!+1E5+2.5", 1, 0)).toBe("IFERROR(A2,#N/A)+#REF!+1E5+2.5");
  });

  it("moves the anchor of a spill reference", () => {
    expect(shiftFormula("SUM(L6#)", 0, 1)).toBe("SUM(M6#)");
  });

  it("turns references pushed off the sheet into #REF!", () => {
    expect(shiftFormula("A1048576+XFD1", 1, 1)).toBe("#REF!+#REF!");
    expect(shiftFormula("Data!A1:B1048576", 1, 0)).toBe("Data!#REF!");
    expect(shiftFormula("A2", -1, 0)).toBe("A1");
    expect(shiftFormula("A1", -1, 0)).toBe("#REF!");
  });

  it("commutes with normalizeFormula", () => {
    const raw = "_xlfn.XLOOKUP( Data!a2 , Data!$A$2:$A$11, Data!f2:f11)";
    expect(normalizeFormula(shiftFormula(raw, 3, 1))).toBe(shiftFormula(normalizeFormula(raw), 3, 1));
    expect(normalizeFormula(shiftFormula(raw, 3, 1))).toBe("XLOOKUP(DATA!B5,DATA!$A$2:$A$11,DATA!G5:G14)");
  });

  it("rejects non-integer offsets", () => {
    expect(() => shiftFormula("A1", 0.5, 0)).toThrow(/integers/);
  });
});

describe("column letters", () => {
  it("round-trips A, Z, AA, XFD", () => {
    for (const [letters, index] of [["A", 1], ["Z", 26], ["AA", 27], ["AZ", 52], ["XFD", 16_384]] as const) {
      expect(columnIndex(letters)).toBe(index);
      expect(columnLetters(index)).toBe(letters);
    }
  });
});
