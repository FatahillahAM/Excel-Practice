import { describe, expect, it } from "vitest";
import { CHECK_NAMES } from "../content/checks";
import { SNAPSHOT, formula, typed } from "./__fixtures__/exam";
import { CHECKER_REGISTRY, formulaPresent, runCheck, valueEqualsKey, valueMatches } from "./checkers";
import { REASON_TEMPLATES, reasonText } from "./reasons";

const q1 = SNAPSHOT.questions[0];

describe("checker registry", () => {
  it("implements formula_present and value_equals_key; every name is a declared check", () => {
    expect(Object.keys(CHECKER_REGISTRY).sort()).toEqual(["formula_present", "value_equals_key"]);
    for (const name of Object.keys(CHECKER_REGISTRY)) expect(CHECK_NAMES).toContain(name);
  });

  it("skips a check without a checker (null)", () => {
    expect(runCheck({ name: "not_hard_coded" }, q1, [{ ref: "H2", reading: typed(1) }])).toBeNull();
    expect(runCheck({ name: "uses_functions", functions: ["SUM"] }, q1, [])).toBeNull();
  });
});

describe("formula_present", () => {
  it("passes when every cell has a formula, whatever its value", () => {
    expect(formulaPresent({ name: "formula_present" }, q1, [
      { ref: "H2", reading: formula("=1", 1) },
      { ref: "H3", reading: formula("=A1", null) },
    ])).toEqual({ ok: true });
  });

  it("fails on the first empty or typed cell", () => {
    expect(formulaPresent({ name: "formula_present" }, q1, [
      { ref: "H2", reading: formula("=1", 1) },
      { ref: "H3", reading: undefined },
    ])).toEqual({ ok: false, reason: { kind: "empty", ref: "H3" } });
    expect(formulaPresent({ name: "formula_present" }, q1, [
      { ref: "H2", reading: typed("teks") },
      { ref: "H3", reading: undefined },
    ])).toEqual({ ok: false, reason: { kind: "typed_value", ref: "H2" } });
  });
});

describe("value_equals_key", () => {
  const check = { name: "value_equals_key", tolerance: 1e-9 } as const;

  it("compares each cell with its key", () => {
    expect(valueEqualsKey(check, q1, [{ ref: "H2", reading: typed(1200) }])).toEqual({ ok: true });
    expect(valueEqualsKey(check, q1, [{ ref: "H2", reading: formula("=1", 1201) }])).toEqual({
      ok: false,
      reason: { kind: "wrong_value", ref: "H2" },
    });
    expect(valueEqualsKey(check, q1, [{ ref: "H2", reading: undefined }])).toEqual({ ok: false, reason: { kind: "empty", ref: "H2" } });
  });

  it("matches numbers within tolerance × max(1, |key|), text exactly", () => {
    expect(valueMatches(typed(1000.0000001), 1000, 1e-9)).toBe(true);
    expect(valueMatches(typed(1000.00001), 1000, 1e-9)).toBe(false);
    expect(valueMatches(typed(0.0000000005), 0, 1e-9)).toBe(true);
    expect(valueMatches(typed("Lini A"), "Lini A", 1e-9)).toBe(true);
    expect(valueMatches(typed("Lini A "), "Lini A", 1e-9)).toBe(false);
    expect(valueMatches(typed("5"), 5, 1e-9)).toBe(false);
    expect(valueMatches(formula("=A1", null), 5, 1e-9)).toBe(false);
  });
});

describe("reasons", () => {
  it("are the Indonesian templates, naming the cell only", () => {
    expect(reasonText({ kind: "typed_value", ref: "H2" })).toBe("Sel H2 berisi angka yang diketik, bukan rumus.");
    expect(reasonText({ kind: "empty", ref: "O3" })).toBe("Sel O3 masih kosong.");
    expect(reasonText({ kind: "wrong_value", ref: "J13" })).toBe("Hasil di J13 belum sesuai.");
    for (const template of Object.values(REASON_TEMPLATES)) expect(template).toContain("{ref}");
  });
});
