import { describe, expect, it } from "vitest";
import { CHECK_NAMES, checkSchema, type Check } from "../content/checks";
import type { ExamQuestion } from "../content/level-module";
import { SNAPSHOT, formula, typed } from "./__fixtures__/exam";
import {
  CHECKER_REGISTRY,
  calledFunctions,
  callsUnknownFunction,
  formulaPresent,
  functionName,
  hasReference,
  notHardCoded,
  runCheck,
  shiftedReference,
  usesFunctions,
  usesReference,
  valueEqualsKey,
  valueMatches,
  type AnswerCell,
} from "./checkers";
import { REASON_TEMPLATES, reasonText } from "./reasons";
import type { CellReading, TableReading } from "./workbook-reading";

const q1 = SNAPSHOT.questions[0];

/** An L01-P1-shaped question on Data with this range (keys are not read by the formula checkers). */
const question = (range: string, key: ExamQuestion["key"] = {}): ExamQuestion => ({
  number: 1,
  prompt: "Soal",
  points: 20,
  sheet: "Data",
  range,
  checks: [{ name: "formula_present" }],
  key,
  hints: ["Petunjuk."],
  tip: { id: "tip-soal", title: "Tip", body: "Isi Tip.", shortcuts: [] },
});

const at = (ref: string, reading: CellReading | undefined): AnswerCell => ({ ref, reading });
const f = (text: string, cached: CellReading["value"] = 1) => formula(text, cached);

const CHECKS: Check[] = [
  { name: "formula_present" },
  { name: "not_hard_coded" },
  { name: "value_equals_key", tolerance: 1e-9 },
  { name: "uses_functions", functions: ["SUM"] },
  { name: "uses_any_function", functions: ["IF", "IFS"] },
  { name: "uses_reference", ref: "$L$2" },
];

describe("checker registry", () => {
  it("has a checker for every declared check name", () => {
    expect(Object.keys(CHECKER_REGISTRY).sort()).toEqual([...CHECK_NAMES].sort());
  });

  it("runCheck always runs the named checker (never skips)", () => {
    expect(runCheck({ name: "not_hard_coded" }, q1, [at("H2", f("=1"))])).toEqual({
      ok: false,
      reason: { kind: "hard_coded", ref: "H2" },
    });
  });

  it.each(CHECKS.map((check) => [check.name, check] as const))("%s fails closed on no answer cells (never passes vacuously)", (_, check) => {
    expect(() => runCheck(check, question("H2:H3", { H2: 1 }), [])).toThrow(/at least one answer cell/);
  });
});

describe("every checker stands on its own", () => {
  it.each(CHECKS.map((check) => [check.name, check] as const))("%s: an empty cell is empty, a typed value typed_value", (_, check) => {
    const q = question("H2:H3", { H2: 1, H3: 1 });
    expect(runCheck(check, q, [at("H2", undefined)])).toEqual({ ok: false, reason: { kind: "empty", ref: "H2" } });
    expect(runCheck(check, q, [at("H2", { formula: null, value: null, type: "empty" })])).toEqual({
      ok: false,
      reason: { kind: "empty", ref: "H2" },
    });
    expect(runCheck(check, q, [at("H2", typed(1))])).toEqual({ ok: false, reason: { kind: "typed_value", ref: "H2" } });
    expect(runCheck(check, q, [at("H2", typed("teks"))])).toEqual({ ok: false, reason: { kind: "typed_value", ref: "H2" } });
  });

  it.each(CHECKS.map((check) => [check.name, check] as const))("%s: a value of an array formula is array_formula, not typed_value", (_, check) => {
    const q = question("H2:H3", { H2: 1, H3: 1 });
    const member: CellReading = { formula: null, value: 1, type: "number", array: true };
    expect(runCheck(check, q, [at("H2", member)])).toEqual({ ok: false, reason: { kind: "array_formula", ref: "H2" } });
  });
});

describe("formula_present", () => {
  it("passes when every cell has a formula, whatever its value", () => {
    expect(formulaPresent({ name: "formula_present" }, q1, [at("H2", f("=1", 1)), at("H3", f("=A1", null))])).toEqual({ ok: true });
  });

  it("fails on the first empty or typed cell", () => {
    expect(formulaPresent({ name: "formula_present" }, q1, [at("H2", f("=1", 1)), at("H3", undefined)])).toEqual({
      ok: false,
      reason: { kind: "empty", ref: "H3" },
    });
    expect(formulaPresent({ name: "formula_present" }, q1, [at("H2", typed("teks")), at("H3", undefined)])).toEqual({
      ok: false,
      reason: { kind: "typed_value", ref: "H2" },
    });
  });
});

describe("not_hard_coded", () => {
  const check = { name: "not_hard_coded" } as const;
  const run = (text: string) => notHardCoded(check, q1, [at("H2", f(text))]);

  it("passes a formula referring to a cell, range, whole column or row, or structured reference", () => {
    for (const text of ["=E2*G2", "E2*1123.51", "=SUM($E$2:$E$13)", "=SUM(E:E)", "=SUM(2:2)", "=Data!E2", "='My Data'!E2", "=SUM(Tabel1[Unit])"]) {
      expect(run(text), text).toEqual({ ok: true });
    }
  });

  it("fails a formula of numbers only, a defined name, an external workbook name, text or a function without references", () => {
    for (const text of ["=1159*1123.51", "1159*1123.51", "=Tarif*2", "=[1]!Rate*2", '="E2"', "=PI()*2", "=#N/A*2"]) {
      expect(run(text), text).toEqual({ ok: false, reason: { kind: "hard_coded", ref: "H2" } });
    }
    // An external workbook's cells still are cells.
    expect(run("=[1]Data!A1*2")).toEqual({ ok: true });
  });

  it("a formula whose only references were deleted (#REF!) is error_value, not hard_coded", () => {
    for (const text of ["=#REF!*#REF!", "=#REF!*2", "=SUM(#REF!)"]) {
      expect(run(text), text).toEqual({ ok: false, reason: { kind: "error_value", ref: "H2" } });
    }
  });

  it("fails on the first hard-coded cell in range order", () => {
    expect(notHardCoded(check, q1, [at("H2", f("=E2*G2")), at("H3", f("=5")), at("H4", f("=6"))])).toEqual({
      ok: false,
      reason: { kind: "hard_coded", ref: "H3" },
    });
  });
});

describe("uses_functions", () => {
  const check = { name: "uses_functions" as const, functions: ["SUM"] };

  it("finds called functions: a name followed by (, _xlfn. dropped, any case, spaces allowed", () => {
    expect([...calledFunctions("=E2/SUM($E$2:$E$13)")]).toEqual(["SUM"]);
    expect([...calledFunctions("=e2/sum ( $e$2:$e$13 )")]).toEqual(["SUM"]);
    expect([...calledFunctions("_xlfn.XLOOKUP(A1,B:B,C:C)+LOG10(2)")].sort()).toEqual(["LOG10", "XLOOKUP"]);
    expect([...calledFunctions("_xlfn._xlws.SORT(_xlfn.UNIQUE(B2:B11))")].sort()).toEqual(["SORT", "UNIQUE"]);
    expect([...calledFunctions("_xlws.FILTER(A1:A9,A1:A9>0)")]).toEqual(["FILTER"]);
    expect([...calledFunctions("_xlfn.LET(_xlpm.x,A1,_xlpm.f(x))")].sort()).toEqual(["F", "LET"]);
    // A name not followed by ( (defined name, sheet), and text, are not calls.
    expect([...calledFunctions('=SUM+Sum!A1+"SUM(1)"')]).toEqual([]);
  });

  it("passes when every formula calls each declared function", () => {
    expect(usesFunctions(check, q1, [at("J2", f("=E2/SUM($E$2:$E$13)")), at("J3", f("=E3/_xlfn.SUM($E$2:$E$13)"))])).toEqual({ ok: true });
  });

  it("wrong function, right value: names the first missing function and the first cell", () => {
    const outcome = usesFunctions(check, q1, [
      at("J2", f("=E2/(AVERAGE($E$2:$E$13)*COUNT($E$2:$E$13))", 0.092461)),
      at("J3", f("=E3/1")),
    ]);
    expect(outcome).toEqual({ ok: false, reason: { kind: "missing_function", ref: "J2", function: "SUM" } });
    expect(reasonText((outcome as { reason: Parameters<typeof reasonText>[0] }).reason)).toBe("Rumus di J2 tidak memakai fungsi SUM.");
  });

  it("compares declared names like called ones: prefixes dropped, any case (the content schema refuses both)", () => {
    for (const name of ["_xlfn.SUM", "_xlws.SUM", "_XLPM.sum", "sum"]) {
      const declared = { name: "uses_functions" as const, functions: [name] };
      expect(usesFunctions(declared, q1, [at("J2", f("=E2/SUM($E$2:$E$13)"))]), name).toEqual({ ok: true });
      expect(usesFunctions(declared, q1, [at("J2", f("=E2/9"))]), name).toEqual({
        ok: false,
        reason: { kind: "missing_function", ref: "J2", function: "SUM" },
      });
      expect(checkSchema.safeParse(declared).success, name).toBe(false);
    }
    expect(functionName("_xlfn._xlws.sort")).toBe("SORT");
  });

  it("checks every declared function in order", () => {
    const both = { name: "uses_functions" as const, functions: ["SUM", "ROUND"] };
    expect(usesFunctions(both, q1, [at("J2", f("=SUM(E2:E3)"))])).toEqual({
      ok: false,
      reason: { kind: "missing_function", ref: "J2", function: "ROUND" },
    });
    expect(usesFunctions(both, q1, [at("J2", f("=ROUND(SUM(E2:E3),2)"))])).toEqual({ ok: true });
  });
});

describe("uses_reference", () => {
  it("shifts ref from the range's top-left cell like Excel's fill; $ parts stay", () => {
    expect(shiftedReference("$N2", "O2:R5", "O3")).toBe("$N3");
    expect(shiftedReference("$N2", "O2:R5", "R5")).toBe("$N5");
    expect(shiftedReference("O$1", "O2:R5", "P2")).toBe("P$1");
    expect(shiftedReference("O$1", "O2:R5", "R5")).toBe("R$1");
    expect(shiftedReference("$L$2", "I2:I13", "I13")).toBe("$L$2");
    expect(shiftedReference("$E$2:$E$13", "J2:J13", "J9")).toBe("$E$2:$E$13");
    // Pushed off the sheet: never matches.
    expect(shiftedReference("A1", "B2:B3", "B1")).toBeNull();
  });

  it("matches the token exactly, without a sheet prefix or with the question's own (any case, quoted or not)", () => {
    for (const text of ["E2*$L$2", "=$L$2*E2", "=Data!E2*Data!$L$2", "=data!e2*DATA!$l$2", "='Data'!$L$2*E2", "= E2 * $L$2"]) {
      expect(hasReference(text, "$L$2", "Data"), text).toBe(true);
    }
    for (const text of [
      "=E2*L$2",
      "=E2*$L2",
      "=E2*L2",
      "=E2*$L$2:$L$3",
      "=Sheet2!$L$2*E2",
      "=[1]Data!$L$2*E2",
      "=Data:Data2!$L$2*E2",
      '="$L$2"&E2',
      // A deleted sheet: Excel writes #REF! where the sheet name was.
      "=E2*#REF!$L$2",
      // A spill reference is the whole spilled range, not the cell.
      "=E2*$L$2#",
    ]) {
      expect(hasReference(text, "$L$2", "Data"), text).toBe(false);
    }
  });

  it("Q3: a range with only its rows locked is not the declared $E$2:$E$13", () => {
    expect(hasReference("=E2/SUM(E$2:E$13)", "$E$2:$E$13", "Data")).toBe(false);
    expect(hasReference("=E2/SUM($E$2:$E$13)", "$E$2:$E$13", "Data")).toBe(true);
    const q = question("J2:J13");
    const check = { name: "uses_reference", ref: "$E$2:$E$13" } as const;
    expect(usesReference(check, q, [at("J2", f("=E2/SUM(E$2:E$13)", 0.092461))])).toEqual({
      ok: false,
      reason: { kind: "wrong_reference", ref: "J2" },
    });
  });

  it("the anchor of an array formula is array_formula: one formula over ranges was not copied", () => {
    const q = question("I2:I13");
    const anchor: CellReading = { formula: "E2:E13*$L$2", value: 149511, type: "number", array: true };
    expect(usesReference({ name: "uses_reference", ref: "$L$2" }, q, [at("I2", anchor)])).toEqual({
      ok: false,
      reason: { kind: "array_formula", ref: "I2" },
    });
    // The other checks read the anchor as the formula it is.
    expect(formulaPresent({ name: "formula_present" }, q, [at("I2", anchor)])).toEqual({ ok: true });
  });

  it("unlocked reference, right value: wrong_reference without naming the reference", () => {
    const q = question("I2:I13");
    const check = { name: "uses_reference", ref: "$L$2" } as const;
    const outcome = usesReference(check, q, [at("I2", f("=E2*L$2", 149511)), at("I3", f("=E3*L$2"))]);
    expect(outcome).toEqual({ ok: false, reason: { kind: "wrong_reference", ref: "I2" } });
    const text = reasonText({ kind: "wrong_reference", ref: "I2" });
    expect(text).toBe("Rumus di I2 belum memakai referensi sel yang diminta, jadi hasilnya bisa salah saat disalin.");
    expect(text).not.toContain("$");
  });

  it("grades each cell against the shifted ref ($N2 down, O$1 right)", () => {
    const q = question("O2:P3");
    const n = { name: "uses_reference", ref: "$N2" } as const;
    const o = { name: "uses_reference", ref: "O$1" } as const;
    const filled = [
      at("O2", f("=$N2*(1+O$1)")),
      at("P2", f("=$N2*(1+P$1)")),
      at("O3", f("=$N3*(1+O$1)")),
      at("P3", f("=$N3*(1+P$1)")),
    ];
    expect(usesReference(n, q, filled)).toEqual({ ok: true });
    expect(usesReference(o, q, filled)).toEqual({ ok: true });
    // Every cell referring to $N2 (not shifted) fails on the first cell below the top row.
    const fixed = filled.map(({ ref }) => at(ref, f(`=$N2*(1+${ref[0]}$1)`)));
    expect(usesReference(n, q, fixed)).toEqual({ ok: false, reason: { kind: "wrong_reference", ref: "O3" } });
    // Relative O1 is not the token O$1, even in the top-left cell where it points to the same cell.
    const relative = filled.map(({ ref }) => at(ref, f(`=$N${ref[1]}*(1+${ref[0]}${Number(ref[1]) - 1})`)));
    expect(usesReference(o, q, relative)).toEqual({ ok: false, reason: { kind: "wrong_reference", ref: "O2" } });
  });

  it("a ref shifted off the sheet never matches", () => {
    const q = question("B2:B3");
    expect(usesReference({ name: "uses_reference", ref: "A1" }, q, [at("B2", f("=A1")), at("B3", f("=A2"))])).toEqual({ ok: true });
    // A cell above the top-left (not in a well-formed range, but the rule holds): A0 does not exist.
    expect(usesReference({ name: "uses_reference", ref: "A1" }, question("B2:B2"), [at("B1", f("=#REF!"))])).toEqual({
      ok: false,
      reason: { kind: "wrong_reference", ref: "B1" },
    });
  });
});

describe("value_equals_key", () => {
  const check = { name: "value_equals_key", tolerance: 1e-9 } as const;

  it("compares each formula's value with its key", () => {
    expect(valueEqualsKey(check, q1, [at("H2", f("=E2*G2", 1200))])).toEqual({ ok: true });
    expect(valueEqualsKey(check, q1, [at("H2", f("=E2*G2", 1201))])).toEqual({ ok: false, reason: { kind: "wrong_value", ref: "H2" } });
    expect(valueEqualsKey(check, q1, [at("H2", undefined)])).toEqual({ ok: false, reason: { kind: "empty", ref: "H2" } });
    // A cell outside the key is never equal.
    expect(valueEqualsKey(check, q1, [at("H9", f("=1", 1))])).toEqual({ ok: false, reason: { kind: "wrong_value", ref: "H9" } });
  });

  it("an error value is error_value, never naming the code", () => {
    for (const code of ["#DIV/0!", "#N/A", "#REF!"]) {
      expect(valueEqualsKey(check, q1, [at("H2", { formula: "E2/0", value: code, type: "error" })])).toEqual({
        ok: false,
        reason: { kind: "error_value", ref: "H2" },
      });
    }
    expect(reasonText({ kind: "error_value", ref: "H2" })).toBe("Rumus di H2 menghasilkan error.");
  });

  it("a formula without a cached value is not_calculated, before wrong_value", () => {
    expect(valueEqualsKey(check, q1, [at("H2", f("=E2*G2", null))])).toEqual({ ok: false, reason: { kind: "not_calculated", ref: "H2" } });
    expect(reasonText({ kind: "not_calculated", ref: "H2" })).toBe("Rumus di H2 belum dihitung oleh Excel.");
  });

  it("an empty text result (t=str, no value) is right where the key is \"\", else wrong_value (5.3)", () => {
    const emptyText: CellReading = { formula: 'IF(F2>0,"Cek","")', value: null, type: "string" };
    expect(valueEqualsKey(check, question("H2", { H2: "Cek" }), [at("H2", emptyText)])).toEqual({ ok: false, reason: { kind: "wrong_value", ref: "H2" } });
    expect(valueEqualsKey(check, question("H2", { H2: 5 }), [at("H2", emptyText)])).toEqual({ ok: false, reason: { kind: "wrong_value", ref: "H2" } });
    expect(valueEqualsKey(check, question("H2", { H2: "" }), [at("H2", emptyText)])).toEqual({ ok: true });
    // A non-text formula without a cached value is not_calculated, even where the key is "".
    expect(valueEqualsKey(check, question("H2", { H2: "" }), [at("H2", f('IF(F2>0,"Cek","")', null))])).toEqual({
      ok: false,
      reason: { kind: "not_calculated", ref: "H2" },
    });
  });

  it("the first failing cell decides, whatever its kind", () => {
    expect(valueEqualsKey(check, q1, [at("H2", f("=E2*G2", 1)), at("H3", f("=E3*G3", null))])).toEqual({
      ok: false,
      reason: { kind: "wrong_value", ref: "H2" },
    });
  });

  it("matches numbers within tolerance × max(1, |key|), text exactly", () => {
    expect(valueMatches(typed(1000.0000001), 1000, 1e-9)).toBe(true);
    expect(valueMatches(typed(1000.00001), 1000, 1e-9)).toBe(false);
    expect(valueMatches(typed(0.0000000005), 0, 1e-9)).toBe(true);
    expect(valueMatches(typed(0.000000002), 0, 1e-9)).toBe(false);
    expect(valueMatches(typed("Lini A"), "Lini A", 1e-9)).toBe(true);
    expect(valueMatches(typed("Lini A "), "Lini A", 1e-9)).toBe(false);
    expect(valueMatches(typed("lini a"), "Lini A", 1e-9)).toBe(false);
    expect(valueMatches(typed("5"), 5, 1e-9)).toBe(false);
    expect(valueMatches(formula("=A1", null), 5, 1e-9)).toBe(false);
  });
});

describe("reasons", () => {
  it("are the Indonesian templates, naming the cell (and function) only", () => {
    expect(reasonText({ kind: "typed_value", ref: "H2" })).toBe("Sel H2 berisi nilai yang diketik, bukan rumus.");
    expect(reasonText({ kind: "empty", ref: "O3" })).toBe("Sel O3 masih kosong.");
    expect(reasonText({ kind: "wrong_value", ref: "J13" })).toBe("Hasil di J13 belum sesuai.");
    expect(reasonText({ kind: "hard_coded", ref: "H2" })).toBe("Rumus di H2 hanya berisi angka, tidak merujuk sel.");
    expect(reasonText({ kind: "missing_function", ref: "J2", function: "SUM" })).toBe("Rumus di J2 tidak memakai fungsi SUM.");
    expect(reasonText({ kind: "array_formula", ref: "H3" })).toBe(
      "Sel H3 berisi hasil rumus array; tulis satu rumus biasa lalu salin ke sel lainnya.",
    );
    for (const template of Object.values(REASON_TEMPLATES)) {
      expect(template).toContain("{ref}");
      expect(template.replace("{ref}", "").replace("{function}", "")).not.toMatch(/[{}$]/);
    }
  });

  it("refuses a missing_function reason without the function", () => {
    expect(() => reasonText({ kind: "missing_function", ref: "J2" })).toThrow(/function/);
  });

  it("words typed_value neutrally: typed text is caught too, so it never says 'angka'", () => {
    expect(REASON_TEMPLATES.typed_value).not.toMatch(/angka/i);
  });
});

describe("is_table (5.2)", () => {
  const HEADERS = ["Kode Batch", "Lini", "Unit Diproduksi"];
  const check = { name: "is_table", ref: "A1:C13", headers: HEADERS } as const;
  const q = question("K2", { K2: 1 });
  const table = (ref: string, columns = HEADERS, headerRow = true): TableReading => ({ name: "Table1", ref, headerRow, columns });
  const run = (tables: TableReading[]) => runCheck(check, q, [at("K2", f("=1"))], { tables });

  it("passes on a Table over exactly the range with the data's headers, whatever its name", () => {
    expect(run([table("A1:C13")])).toEqual({ ok: true });
    expect(run([{ ...table("A1:C13"), name: "Produksi" }])).toEqual({ ok: true });
  });

  it("is not_a_table without a Table, or with one elsewhere on the sheet only", () => {
    expect(run([])).toEqual({ ok: false, reason: { kind: "not_a_table", ref: "A1:C13" } });
    expect(run([table("E1:F5", ["X", "Y"])])).toEqual({ ok: false, reason: { kind: "not_a_table", ref: "A1:C13" } });
    expect(runCheck(check, q, [at("K2", f("=1"))])).toEqual({ ok: false, reason: { kind: "not_a_table", ref: "A1:C13" } });
  });

  it("is wrong_table_range for a Table missing rows, or taking extra columns", () => {
    expect(run([table("A1:C12")])).toEqual({ ok: false, reason: { kind: "wrong_table_range", ref: "A1:C13" } });
    expect(run([table("A1:E13", [...HEADERS, "Kolom1", "Kolom2"])])).toEqual({ ok: false, reason: { kind: "wrong_table_range", ref: "A1:C13" } });
    expect(run([table("A2:C13")])).toEqual({ ok: false, reason: { kind: "wrong_table_range", ref: "A1:C13" } });
  });

  it("takes the exact Table when another one overlaps too", () => {
    expect(run([table("B5:B6", ["Lini"]), table("A1:C13")])).toEqual({ ok: true });
  });

  it("is wrong_table_header with the header row off or other column names", () => {
    expect(run([table("A1:C13", ["Column1", "Column2", "Column3"], false)])).toEqual({ ok: false, reason: { kind: "wrong_table_header", ref: "A1:C13" } });
    expect(run([table("A1:C13", ["Kode Batch", "Lini", "Unit"])])).toEqual({ ok: false, reason: { kind: "wrong_table_header", ref: "A1:C13" } });
  });

  it("passes a Table with its Total Row on (the reader leaves the Total Row out of the range)", () => {
    expect(run([{ ...table("A1:C13"), totalsRow: true }])).toEqual({ ok: true });
  });

  it("compares header names trimmed and case-insensitively", () => {
    expect(run([table("A1:C13", [" kode batch", "LINI ", "Unit diproduksi"])])).toEqual({ ok: true });
  });

  it("ignores the answer cells: a Table check passes over an empty answer", () => {
    expect(runCheck(check, q, [at("K2", undefined)], { tables: [table("A1:C13")] })).toEqual({ ok: true });
  });

  it("refuses a malformed range or no headers in the schema", () => {
    expect(checkSchema.safeParse({ name: "is_table", ref: "$A$1:$C$13", headers: HEADERS }).success).toBe(false);
    expect(checkSchema.safeParse({ name: "is_table", ref: "A1", headers: HEADERS }).success).toBe(false);
    expect(checkSchema.safeParse({ name: "is_table", ref: "A1:C13", headers: [] }).success).toBe(false);
    expect(checkSchema.safeParse(check).success).toBe(true);
  });
});

describe("spills (5.2)", () => {
  const spillQuestion = (range: string, key: ExamQuestion["key"]): ExamQuestion => ({
    ...question(range, key),
    checks: [{ name: "formula_present" }, { name: "not_hard_coded" }, { name: "uses_functions", functions: ["SORT"] }, { name: "spills" }, { name: "value_equals_key", tolerance: 1e-9 }],
  });
  const q = spillQuestion("I2:I4", { I2: 30, I3: 20, I4: 10 });
  const anchor = (formulaText: string, value: CellReading["value"], arrayRef?: string): CellReading => ({
    formula: formulaText,
    value,
    type: typeof value === "string" ? "string" : "number",
    ...(arrayRef === undefined ? {} : { array: true as const, arrayRef }),
  });
  const member = (value: number | string): CellReading => ({ formula: null, value, type: typeof value === "string" ? "string" : "number", array: true });
  const spilled = [at("I2", anchor("_XLFN._XLWS.SORT(E2:E4,1,-1)", 30, "I2:I4")), at("I3", member(20)), at("I4", member(10))];
  const grade = (cells: AnswerCell[]) => q.checks.map((check) => runCheck(check, q, cells));

  it("passes every check on one spilled SORT over exactly the range (prefixes _xlfn._xlws. dropped)", () => {
    expect(grade(spilled)).toEqual(q.checks.map(() => ({ ok: true })));
  });

  it("passes a spill over structured references to a Table", () => {
    const cells = [at("I2", anchor("SORT(TABLE1[UNIT DIPRODUKSI],1,-1)", 30, "I2:I4")), spilled[1], spilled[2]];
    expect(grade(cells)).toEqual(q.checks.map(() => ({ ok: true })));
  });

  it("is wrong_spill for a spill of another size, a formula that does not spill, or a cell inside another spill", () => {
    const longer = [at("I2", anchor("SORT(E2:E5,1,-1)", 30, "I2:I5")), spilled[1], spilled[2]];
    expect(runCheck({ name: "spills" }, q, longer)).toEqual({ ok: false, reason: { kind: "wrong_spill", ref: "I2" } });
    expect(runCheck({ name: "spills" }, q, [at("I2", anchor("MAX(E2:E4)", 30)), at("I3", typed(20)), at("I4", typed(10))])).toEqual({
      ok: false,
      reason: { kind: "wrong_spill", ref: "I2" },
    });
    expect(runCheck({ name: "spills" }, q, [at("I2", member(30)), spilled[1], spilled[2]])).toEqual({ ok: false, reason: { kind: "wrong_spill", ref: "I2" } });
  });

  it("is empty or typed_value at the top-left cell", () => {
    expect(runCheck({ name: "spills" }, q, [at("I2", undefined)])).toEqual({ ok: false, reason: { kind: "empty", ref: "I2" } });
    expect(runCheck({ name: "spills" }, q, [at("I2", typed(30))])).toEqual({ ok: false, reason: { kind: "typed_value", ref: "I2" } });
  });

  it("accepts a one-cell spill range as an ordinary formula", () => {
    const one = spillQuestion("I2", { I2: 30 });
    expect(runCheck({ name: "spills" }, one, [at("I2", anchor("SORT(E2,1,-1)", 30))])).toEqual({ ok: true });
    expect(runCheck({ name: "spills" }, one, [at("I2", anchor("SORT(E2:E3,1,-1)", 30, "I2:I3"))])).toEqual({ ok: false, reason: { kind: "wrong_spill", ref: "I2" } });
  });

  it("value_equals_key compares the spilled values: wrong order is wrong_value, a gap empty, a typed value typed_value", () => {
    const value = q.checks[4];
    expect(runCheck(value, q, [spilled[0], at("I3", member(10)), at("I4", member(20))])).toEqual({ ok: false, reason: { kind: "wrong_value", ref: "I3" } });
    expect(runCheck(value, q, [spilled[0], spilled[1], at("I4", undefined)])).toEqual({ ok: false, reason: { kind: "empty", ref: "I4" } });
    expect(runCheck(value, q, [spilled[0], spilled[1], at("I4", typed(10))])).toEqual({ ok: false, reason: { kind: "typed_value", ref: "I4" } });
    expect(runCheck(value, q, [spilled[0], spilled[1], at("I4", { formula: null, value: "#N/A", type: "error", array: true })])).toEqual({
      ok: false,
      reason: { kind: "error_value", ref: "I4" },
    });
  });

  it("without spills declared, the same cells are still array_formula (the fill questions are unchanged)", () => {
    expect(runCheck({ name: "formula_present" }, question("I2:I4", {}), spilled)).toEqual({ ok: false, reason: { kind: "array_formula", ref: "I3" } });
  });
});

describe("structured references and _xlws. prefixes (5.2)", () => {
  it("calledFunctions drops _xlfn. and _xlws. together or alone", () => {
    expect([...calledFunctions("_xlfn._xlws.SORT(Table1[Unit Diproduksi],1,-1)")]).toEqual(["SORT"]);
    expect([...calledFunctions("_xlws.FILTER(A2:A9,B2:B9=L2)")]).toEqual(["FILTER"]);
    expect([...calledFunctions("_xlfn._xlws.SORTBY(Table1[Kode Batch],Table1[Unit Diproduksi],-1)")]).toEqual(["SORTBY"]);
  });

  it("not_hard_coded counts a structured reference as a reference", () => {
    for (const text of ["SUM(Table1[Unit Diproduksi])", "[@[Unit Diproduksi]]-[@[Unit Cacat]]", "SUM(Table1[[#This Row],[Unit Cacat]])"]) {
      expect(notHardCoded({ name: "not_hard_coded" }, q1, [at("H2", f(text))]), text).toEqual({ ok: true });
    }
  });

  it("not_hard_coded counts a workbook Table's bare name, but not another defined name or a function of that name", () => {
    const context = { tables: [], tableNames: ["Table1"] };
    expect(notHardCoded({ name: "not_hard_coded" }, q1, [at("M2", f("SORT(TABLE1,5,1)"))], context)).toEqual({ ok: true });
    expect(notHardCoded({ name: "not_hard_coded" }, q1, [at("M2", f("SORT(TABLE1,5,1)"))])).toEqual({ ok: false, reason: { kind: "hard_coded", ref: "M2" } });
    expect(notHardCoded({ name: "not_hard_coded" }, q1, [at("M2", f("RATE*2"))], context)).toEqual({ ok: false, reason: { kind: "hard_coded", ref: "M2" } });
  });

  it("uses_functions finds SUM over a structured reference", () => {
    expect(usesFunctions({ name: "uses_functions", functions: ["SUM"] }, q1, [at("H2", f("SUM(TABLE1[UNIT DIPRODUKSI])"))])).toEqual({ ok: true });
  });
});

describe("Table and spill reasons", () => {
  it("name the range or cell only", () => {
    expect(reasonText({ kind: "not_a_table", ref: "A1:G13" })).toBe("Data di A1:G13 belum dijadikan Excel Table.");
    expect(reasonText({ kind: "wrong_table_range", ref: "A1:G13" })).toBe(
      "Range Excel Table belum sama dengan data di A1:G13: judul kolom dan semua baris data harus masuk, tanpa kolom atau baris tambahan.",
    );
    expect(reasonText({ kind: "wrong_table_header", ref: "A1:G13" })).toBe("Excel Table di A1:G13 belum memakai baris judul data sebagai header.");
    expect(reasonText({ kind: "wrong_spill", ref: "I2" })).toBe("Hasil rumus di I2 belum mengisi daftar yang diminta: jumlah baris atau kolom hasilnya berbeda.");
  });
});

describe("_xludf. functions Excel does not know (5.3)", () => {
  const xludf = f('_XLUDF.IFZ(D2>=90,"OK","NG")', "#NAME?");
  const asError: CellReading = { formula: '_XLUDF.IFZ(D2>=90,"OK","NG")', value: "#NAME?", type: "error" };

  it("calledFunctions drops _xludf. like the other prefixes; callsUnknownFunction finds it only before (", () => {
    expect([...calledFunctions('_xludf.IFS(A1>1,"a",TRUE,"b")')]).toEqual(["IFS"]);
    expect(functionName("_xludf.ifs")).toBe("IFS");
    expect(callsUnknownFunction('_XLUDF.IFZ(D2>=90,"OK","NG")')).toBe(true);
    expect(callsUnknownFunction('IF(A1>1,_xlfn._xludf.IFZ(B1),"b")')).toBe(true);
    expect(callsUnknownFunction('IF(A1="_xludf.X(","a","b")')).toBe(false);
    expect(callsUnknownFunction('_xlfn.IFS(A1>1,"a",TRUE,"b")')).toBe(false);
  });

  it.each(CHECKS.map((check) => [check.name, check] as const))("%s: an _xludf. call is unknown_function, never missing_function", (_, check) => {
    const q = question("H2:H3", { H2: "OK", H3: "OK" });
    for (const reading of [xludf, asError]) {
      expect(runCheck(check, q, [at("H3", reading)])).toEqual({ ok: false, reason: { kind: "unknown_function", ref: "H3" } });
    }
  });

  it("decides before missing_function even when the declared function is the unknown one (IFS saved by an older Excel)", () => {
    const check: Check = { name: "uses_functions", functions: ["IFS"] };
    expect(usesFunctions(check, q1, [at("H2", f('_xludf.IFS(D2>=90,"A",TRUE,"B")', "#NAME?"))])).toEqual({
      ok: false,
      reason: { kind: "unknown_function", ref: "H2" },
    });
  });

  it("is unknown_function at a spill's top-left cell too", () => {
    expect(runCheck({ name: "spills" }, question("H2:H3", { H2: 1, H3: 1 }), [at("H2", xludf), at("H3", undefined)])).toEqual({
      ok: false,
      reason: { kind: "unknown_function", ref: "H2" },
    });
  });

  it("reads as #NAME?, naming the cell only", () => {
    expect(reasonText({ kind: "unknown_function", ref: "H3" })).toBe("Excel tidak mengenali nama fungsi di rumus H3, jadi hasilnya #NAME?. Cek ejaan nama fungsinya, atau pastikan fungsinya ada di Excel 2021.");
  });
});

describe("uses_any_function (5.3)", () => {
  const check: Check = { name: "uses_any_function", functions: ["IF", "IFS"] };
  it("passes a formula calling any one of the functions, prefixes dropped", () => {
    for (const text of ['IF(E2>=$O$2,"Capai","Kurang")', '_xlfn.IFS(E2>=$O$2,"Capai",TRUE,"Kurang")', "if(A1>1,1,0)"]) {
      expect(runCheck(check, q1, [at("H2", f(text))]), text).toEqual({ ok: true });
    }
  });
  it("fails MAX, REPT and arithmetic tricks with missing_any_function, naming every function", () => {
    for (const text of ["MAX(0,E2-$O$2)", 'REPT("Cek mesin",G2>$O$4)', "(E2>$O$2)*(E2-$O$2)"]) {
      expect(runCheck(check, q1, [at("H2", f(text))]), text).toEqual({ ok: false, reason: { kind: "missing_any_function", ref: "H2", function: "IF atau IFS" } });
    }
    expect(reasonText({ kind: "missing_any_function", ref: "H2", function: "IF atau IFS" })).toBe("Rumus di H2 belum memakai IF atau IFS.");
  });
  it("is in the schema with at least two functions", () => {
    expect(checkSchema.safeParse(check).success).toBe(true);
    expect(checkSchema.safeParse({ name: "uses_any_function", functions: ["IF"] }).success).toBe(false);
  });
});
