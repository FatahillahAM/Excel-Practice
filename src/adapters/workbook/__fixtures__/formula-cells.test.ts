import { describe, expect, it } from "vitest";
import { generateExamWorkbook } from "../generate";
import { readWorkbook } from "../read";
import { formulaCell, sharedFill, typedValue, writeFormulaCells } from "./formula-cells";

const TOKEN = "A".repeat(43);

async function base(): Promise<Uint8Array> {
  const { bytes } = await generateExamWorkbook({
    token: TOKEN,
    serverUrl: "https://example.invalid",
    cells: { Data: { A1: "Unit", E2: 10, E3: 20, G2: 2, G3: 3, K2: "Tarif", L2: 5, M2: "Baut" } },
  });
  return bytes;
}

describe("writeFormulaCells (test fixture)", () => {
  it("round-trips every form through readWorkbook, in column order between existing cells", async () => {
    const bytes = await writeFormulaCells(await base(), "Data", {
      ...sharedFill("H2:H3", 0, "E2*G2", (ref) => (ref === "H2" ? 20 : 60)),
      I2: formulaCell("E2*$L$2", 50),
      I3: formulaCell('IF(E3>1,"besar","kecil")', "besar"),
      J2: formulaCell("E2/0", { error: "#DIV/0!" }),
      J3: formulaCell("E3/SUM($E$2:$E$3)", null),
      F2: typedValue(7),
      F3: typedValue("teks"),
      ...sharedFill("O2:P3", 1, "$N2*(1+O$1)", () => 1.5),
      B9: formulaCell("A1&\"<x>\"", "Unit<x>"),
    });
    const data = (await readWorkbook(bytes)).sheets.Data;
    expect(data.H2).toEqual({ formula: "E2*G2", value: 20, type: "number" });
    expect(data.H3).toEqual({ formula: "E3*G3", value: 60, type: "number" });
    expect(data.I2).toEqual({ formula: "E2*$L$2", value: 50, type: "number" });
    expect(data.I3).toEqual({ formula: 'IF(E3>1,"besar","kecil")', value: "besar", type: "string" });
    expect(data.J2).toEqual({ formula: "E2/0", value: "#DIV/0!", type: "error" });
    expect(data.J3).toEqual({ formula: "E3/SUM($E$2:$E$3)", value: null, type: "empty" });
    expect(data.F2).toEqual({ formula: null, value: 7, type: "number" });
    expect(data.F3).toEqual({ formula: null, value: "teks", type: "string" });
    expect(data.P3).toEqual({ formula: "$N3*(1+P$1)", value: 1.5, type: "number" });
    expect(data.B9).toEqual({ formula: 'A1&"<x>"', value: "Unit<x>", type: "string" });
    // The cells already there are untouched.
    expect(data.E2).toEqual({ formula: null, value: 10, type: "number" });
    expect(data.K2).toEqual({ formula: null, value: "Tarif", type: "string" });
    expect(data.M2).toEqual({ formula: null, value: "Baut", type: "string" });
  });

  it("refuses a cell that already exists, and an unknown sheet", async () => {
    await expect(writeFormulaCells(await base(), "Data", { E2: typedValue(1) })).rejects.toThrow(/already has/);
    await expect(writeFormulaCells(await base(), "Nope", { A1: typedValue(1) })).rejects.toThrow(/no sheet/);
  });
});
