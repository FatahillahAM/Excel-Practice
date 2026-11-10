import { describe, expect, it } from "vitest";
import { CHECK_NAMES, type Check } from "../content/checks";
import type { ExamQuestion } from "../content/level-module";
import { SNAPSHOT, formula, typed } from "./__fixtures__/exam";
import {
  CHECKER_REGISTRY,
  calledFunctions,
  formulaPresent,
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
import type { CellReading } from "./workbook-reading";

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
});

const at = (ref: string, reading: CellReading | undefined): AnswerCell => ({ ref, reading });
const f = (text: string, cached: CellReading["value"] = 1) => formula(text, cached);

const CHECKS: Check[] = [
  { name: "formula_present" },
  { name: "not_hard_coded" },
  { name: "value_equals_key", tolerance: 1e-9 },
  { name: "uses_functions", functions: ["SUM"] },
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
    expect(runCheck({ name: "uses_functions", functions: ["SUM"] }, q1, [])).toEqual({ ok: true });
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

  it("fails a formula of numbers only, a defined name, text or a function without references", () => {
    for (const text of ["=1159*1123.51", "1159*1123.51", "=Tarif*2", '="E2"', "=PI()*2", "=#REF!*2"]) {
      expect(run(text), text).toEqual({ ok: false, reason: { kind: "hard_coded", ref: "H2" } });
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
    for (const text of ["=E2*L$2", "=E2*$L2", "=E2*L2", "=E2*$L$2:$L$3", "=Sheet2!$L$2*E2", "=[1]Data!$L$2*E2", "=Data:Data2!$L$2*E2", '="$L$2"&E2']) {
      expect(hasReference(text, "$L$2", "Data"), text).toBe(false);
    }
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
