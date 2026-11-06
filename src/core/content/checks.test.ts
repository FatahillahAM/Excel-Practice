import { describe, expect, it } from "vitest";
import { CHECK_NAMES, checkSchema, findM365Functions, M365_ONLY_FUNCTIONS, REFERENCE_RE } from "./checks";

describe("checkSchema", () => {
  it("lists the five checkers", () => {
    expect(CHECK_NAMES).toEqual(["formula_present", "not_hard_coded", "value_equals_key", "uses_functions", "uses_reference"]);
  });

  it.each([
    { name: "formula_present" },
    { name: "not_hard_coded" },
    { name: "value_equals_key", tolerance: 1e-9 },
    { name: "value_equals_key", tolerance: 0 },
    { name: "uses_functions", functions: ["SUM", "T.TEST", "COUNTIFS"] },
    { name: "uses_reference", ref: "$L$2" },
    { name: "uses_reference", ref: "$E$2:$E$13" },
    { name: "uses_reference", ref: "O$1" },
    { name: "uses_reference", ref: "$N2" },
  ])("accepts %o", (check) => {
    expect(checkSchema.safeParse(check).success).toBe(true);
  });

  it.each([
    ["an unknown checker", { name: "uses_pivot" }],
    ["a parameter on a checker without any", { name: "formula_present", ref: "A1" }],
    ["value_equals_key without tolerance", { name: "value_equals_key" }],
    ["a negative tolerance", { name: "value_equals_key", tolerance: -1 }],
    ["no functions", { name: "uses_functions", functions: [] }],
    ["a lowercase function", { name: "uses_functions", functions: ["sum"] }],
    ["a reference that is not A1", { name: "uses_reference", ref: "R1C1" }],
    ["a reference with a sheet", { name: "uses_reference", ref: "Data!$L$2" }],
  ])("rejects %s", (_, check) => {
    expect(checkSchema.safeParse(check).success).toBe(false);
  });

  it("matches A1 references with or without $ parts", () => {
    for (const ref of ["A1", "$A$1", "XFD1048576", "$H2:H$9"]) expect(ref).toMatch(REFERENCE_RE);
    for (const ref of ["A0", "$$A1", "A1:", "a1", "ABCD1"]) expect(ref).not.toMatch(REFERENCE_RE);
  });
});

describe("findM365Functions", () => {
  it("finds every Microsoft 365-only name as an uppercase whole word", () => {
    expect(M365_ONLY_FUNCTIONS).toEqual(["LAMBDA", "TEXTSPLIT", "VSTACK", "HSTACK", "TAKE", "DROP", "GROUPBY", "PIVOTBY"]);
    for (const name of M365_ONLY_FUNCTIONS) expect(findM365Functions(`Pakai ${name} di sini`)).toEqual([name]);
    expect(findM365Functions("=TAKE(A1:A9,3)+LAMBDA(x,x)+TAKE(B1:B2,1)")).toEqual(["TAKE", "LAMBDA"]);
    expect(findM365Functions("Jangan pakai DROP. Pakai VSTACK, ya")).toEqual(["DROP", "VSTACK"]);
  });

  it("ignores lowercase prose and longer names", () => {
    expect(findM365Functions("take a break, drop it, lambda")).toEqual([]);
    expect(findM365Functions("TAKEN DROPS XLAMBDA SUM VSTACK2 _TAKE T.TAKE TAKE.X")).toEqual([]);
    expect(findM365Functions("")).toEqual([]);
  });
});
